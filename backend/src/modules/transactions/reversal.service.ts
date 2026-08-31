import { randomBytes } from "crypto";
import { prisma } from "../../config/prisma";
import { Prisma } from "../../generated/prisma/client";
import {
  AuditContext,
  createAuditLog,
} from "../../services/audit.service";
import { createCreditEntry, createDebitEntry } from "./ledger.service";

type ReversalErrorCode =
  | "CUSTOMER_NOT_FOUND"
  | "TRANSACTION_NOT_FOUND"
  | "TRANSACTION_NOT_REVERSIBLE"
  | "TRANSACTION_ALREADY_REVERSED"
  | "REVERSAL_ACCOUNT_NOT_ACTIVE"
  | "REVERSAL_INSUFFICIENT_FUNDS"
  | "REVERSAL_LEDGER_INVALID";

interface LockedTransaction {
  transaction_id: bigint;
  reference_number: string;
  transaction_type: string;
  source_account_id: bigint | null;
  destination_account_id: bigint | null;
  amount: Prisma.Decimal;
  currency: string;
  status: string;
  completed_at: Date | null;
  reversal_of_transaction_id: bigint | null;
}

interface LockedAccount {
  account_id: bigint;
  current_balance: Prisma.Decimal;
  available_balance: Prisma.Decimal;
  account_status: string;
}

const REVERSIBLE_TYPES = new Set(["TRANSFER", "DEPOSIT", "WITHDRAWAL"]);
const REFERENCE_ATTEMPTS = 5;

export class ReversalServiceError extends Error {
  constructor(public readonly code: ReversalErrorCode) {
    super(code);
  }
}

function generateReversalReference(): string {
  return `REV${Date.now()}${randomBytes(6).toString("hex").toUpperCase()}`;
}

function isReferenceConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function executeReversal(
  userId: bigint,
  transactionId: bigint,
  referenceNumber: string,
  auditContext: AuditContext
) {
  return prisma.$transaction(async (transaction) => {
    const customer = await transaction.customers.findUnique({
      where: { user_id: userId },
      select: { customer_id: true },
    });

    if (!customer) {
      throw new ReversalServiceError("CUSTOMER_NOT_FOUND");
    }

    const originalRows = await transaction.$queryRaw<LockedTransaction[]>`
      SELECT
        transaction_id,
        reference_number,
        transaction_type,
        source_account_id,
        destination_account_id,
        amount,
        currency,
        status,
        completed_at,
        reversal_of_transaction_id
      FROM transactions
      WHERE transaction_id = ${transactionId}
      FOR UPDATE
    `;
    const original = originalRows[0];

    if (!original) {
      throw new ReversalServiceError("TRANSACTION_NOT_FOUND");
    }

    const ownedParticipant = await transaction.accounts.findFirst({
      where: {
        customer_id: customer.customer_id,
        account_id: {
          in: [
            original.source_account_id,
            original.destination_account_id,
          ].filter((id): id is bigint => id !== null),
        },
      },
      select: { account_id: true },
    });

    if (!ownedParticipant) {
      throw new ReversalServiceError("TRANSACTION_NOT_FOUND");
    }

    if (
      original.status !== "COMPLETED" ||
      !original.completed_at ||
      original.reversal_of_transaction_id !== null ||
      !REVERSIBLE_TYPES.has(original.transaction_type)
    ) {
      throw new ReversalServiceError("TRANSACTION_NOT_REVERSIBLE");
    }

    const existingReversal = await transaction.transactions.findUnique({
      where: { reversal_of_transaction_id: original.transaction_id },
      select: { transaction_id: true },
    });

    if (existingReversal) {
      throw new ReversalServiceError("TRANSACTION_ALREADY_REVERSED");
    }

    const originalLedger = await transaction.ledger_entries.findMany({
      where: { transaction_id: original.transaction_id },
      orderBy: { ledger_entry_id: "asc" },
    });

    if (originalLedger.length === 0) {
      throw new ReversalServiceError("REVERSAL_LEDGER_INVALID");
    }

    const accountIds = [...new Set(originalLedger.map((entry) => entry.account_id))]
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
    const lockedAccounts = await transaction.$queryRaw<LockedAccount[]>(
      Prisma.sql`
        SELECT
          account_id,
          current_balance,
          available_balance,
          account_status
        FROM accounts
        WHERE account_id IN (${Prisma.join(accountIds)})
        ORDER BY account_id
        FOR UPDATE
      `
    );

    if (lockedAccounts.length !== accountIds.length) {
      throw new ReversalServiceError("REVERSAL_LEDGER_INVALID");
    }

    const balances = new Map(
      lockedAccounts.map((account) => [
        account.account_id.toString(),
        {
          accountId: account.account_id,
          current: new Prisma.Decimal(account.current_balance),
          available: new Prisma.Decimal(account.available_balance),
          status: account.account_status,
        },
      ])
    );

    if ([...balances.values()].some((account) => account.status !== "ACTIVE")) {
      throw new ReversalServiceError("REVERSAL_ACCOUNT_NOT_ACTIVE");
    }

    const reversalSource =
      original.transaction_type === "TRANSFER"
        ? original.destination_account_id
        : original.transaction_type === "DEPOSIT"
          ? original.destination_account_id
          : null;
    const reversalDestination =
      original.transaction_type === "TRANSFER"
        ? original.source_account_id
        : original.transaction_type === "WITHDRAWAL"
          ? original.source_account_id
          : null;

    const reversal = await transaction.transactions.create({
      data: {
        reference_number: referenceNumber,
        transaction_type: "REVERSAL",
        source_account_id: reversalSource,
        destination_account_id: reversalDestination,
        amount: original.amount,
        currency: original.currency,
        status: "PROCESSING",
        reversal_of_transaction_id: original.transaction_id,
      },
    });

    await transaction.transaction_status_history.create({
      data: {
        transaction_id: reversal.transaction_id,
        status: "PROCESSING",
        description: `Reversing transaction ${original.reference_number ?? original.transaction_id}`,
      },
    });

    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);

    for (const originalEntry of originalLedger) {
      const balance = balances.get(originalEntry.account_id.toString());

      if (!balance) {
        throw new ReversalServiceError("REVERSAL_LEDGER_INVALID");
      }

      const amount = new Prisma.Decimal(originalEntry.amount);

      if (originalEntry.entry_type === "CREDIT") {
        if (
          balance.current.lessThan(amount) ||
          balance.available.lessThan(amount)
        ) {
          throw new ReversalServiceError("REVERSAL_INSUFFICIENT_FUNDS");
        }

        await createDebitEntry(
          {
            transactionId: reversal.transaction_id,
            accountId: balance.accountId,
            amount,
            balanceBefore: balance.current,
          },
          transaction
        );
        balance.current = balance.current.minus(amount);
        balance.available = balance.available.minus(amount);
        totalDebit = totalDebit.plus(amount);
      } else if (originalEntry.entry_type === "DEBIT") {
        await createCreditEntry(
          {
            transactionId: reversal.transaction_id,
            accountId: balance.accountId,
            amount,
            balanceBefore: balance.current,
          },
          transaction
        );
        balance.current = balance.current.plus(amount);
        balance.available = balance.available.plus(amount);
        totalCredit = totalCredit.plus(amount);
      } else {
        throw new ReversalServiceError("REVERSAL_LEDGER_INVALID");
      }
    }

    if (
      original.transaction_type === "TRANSFER" &&
      !totalDebit.equals(totalCredit)
    ) {
      throw new ReversalServiceError("REVERSAL_LEDGER_INVALID");
    }

    for (const balance of balances.values()) {
      await transaction.accounts.update({
        where: { account_id: balance.accountId },
        data: {
          current_balance: balance.current,
          available_balance: balance.available,
        },
      });
    }

    const completed = await transaction.transactions.update({
      where: { transaction_id: reversal.transaction_id },
      data: { status: "COMPLETED", completed_at: new Date() },
    });

    await transaction.transaction_status_history.create({
      data: {
        transaction_id: reversal.transaction_id,
        status: "COMPLETED",
        description: "Transaction reversal completed",
      },
    });

    await createAuditLog(
      {
        ...auditContext,
        userId,
        action: "TRANSACTION_REVERSED",
        entity: "TRANSACTION",
        entityId: reversal.transaction_id,
      },
      transaction
    );

    return completed;
  });
}

export async function reverseTransaction(
  userId: bigint,
  transactionId: bigint,
  auditContext: AuditContext
) {
  for (let attempt = 0; attempt < REFERENCE_ATTEMPTS; attempt++) {
    try {
      return await executeReversal(
        userId,
        transactionId,
        generateReversalReference(),
        auditContext
      );
    } catch (error) {
      if (!isReferenceConflict(error)) {
        throw error;
      }
    }
  }

  throw new Error("TRANSACTION_REFERENCE_GENERATION_FAILED");
}
