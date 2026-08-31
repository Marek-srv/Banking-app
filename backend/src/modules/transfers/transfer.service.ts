import { randomBytes } from "crypto";
import { prisma } from "../../config/prisma";
import { Prisma } from "../../generated/prisma/client";
import {
  createCreditEntry,
  createDebitEntry,
} from "../transactions/ledger.service";
import { CreateTransferInput } from "./transfer.schema";
import {
  AuditContext,
  createAuditLog,
} from "../../services/audit.service";
import {
  claimIdempotency,
  completeIdempotency,
  IdempotencyRequest,
} from "../../services/idempotency.service";

type TransferErrorCode =
  | "CUSTOMER_NOT_FOUND"
  | "SOURCE_ACCOUNT_NOT_FOUND"
  | "DESTINATION_ACCOUNT_NOT_FOUND"
  | "UNAUTHORIZED_SOURCE_ACCOUNT"
  | "SAME_ACCOUNT_TRANSFER_NOT_ALLOWED"
  | "SOURCE_ACCOUNT_NOT_ACTIVE"
  | "DESTINATION_ACCOUNT_NOT_ACTIVE"
  | "INSUFFICIENT_FUNDS"
  | "CURRENCY_MISMATCH"
  | "TRANSFER_PER_TRANSACTION_LIMIT_EXCEEDED"
  | "TRANSFER_DAILY_LIMIT_EXCEEDED"
  | "TRANSFER_TEMPORARILY_BUSY";

interface LockedAccount {
  account_id: bigint;
  customer_id: bigint;
  account_type: string;
  currency: string;
  current_balance: Prisma.Decimal;
  available_balance: Prisma.Decimal;
  account_status: string;
  per_transaction_limit: Prisma.Decimal | null;
  daily_transfer_limit: Prisma.Decimal | null;
}

const REFERENCE_ATTEMPTS = 5;
const TRANSFER_MAX_WAIT_MS = 10_000;
const TRANSFER_TIMEOUT_MS = 15_000;

export class TransferServiceError extends Error {
  constructor(public readonly code: TransferErrorCode) {
    super(code);
  }
}

function generateTransactionReference(): string {
  return `TRF${Date.now()}${randomBytes(6).toString("hex").toUpperCase()}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function isTransactionStartTimeout(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2028" &&
    /unable to start a transaction/i.test(error.message)
  );
}

function waitBeforeRetry(attempt: number): Promise<void> {
  const exponentialDelay = Math.min(100 * 2 ** attempt, 1_000);
  const jitter = Math.floor(Math.random() * 100);

  return new Promise((resolve) => {
    setTimeout(resolve, exponentialDelay + jitter);
  });
}

async function executeTransfer(
  userId: bigint,
  input: CreateTransferInput,
  referenceNumber: string,
  auditContext: AuditContext,
  idempotency: IdempotencyRequest | undefined
) {
  return prisma.$transaction(async (transaction) => {
    const idempotencyClaim = await claimIdempotency(
      transaction,
      userId,
      idempotency
    );

    if (idempotencyClaim.replayTransaction) {
      return idempotencyClaim.replayTransaction;
    }

    const customer = await transaction.customers.findUnique({
      where: { user_id: userId },
      select: { customer_id: true },
    });

    if (!customer) {
      throw new TransferServiceError("CUSTOMER_NOT_FOUND");
    }

    if (input.sourceAccountId === input.destinationAccountId) {
      throw new TransferServiceError("SAME_ACCOUNT_TRANSFER_NOT_ALLOWED");
    }

    // Lock both rows in a consistent order. The returned balances remain stable
    // until this transaction commits or rolls back.
    const lockedAccounts = await transaction.$queryRaw<LockedAccount[]>`
      SELECT
        account_id,
        customer_id,
        account_type::text,
        currency,
        current_balance,
        available_balance,
        account_status,
        per_transaction_limit,
        daily_transfer_limit
      FROM accounts
      WHERE account_id IN (
        ${input.sourceAccountId},
        ${input.destinationAccountId}
      )
      ORDER BY account_id
      FOR UPDATE
    `;

    const source = lockedAccounts.find(
      (account) => account.account_id === input.sourceAccountId
    );
    const destination = lockedAccounts.find(
      (account) => account.account_id === input.destinationAccountId
    );

    if (!source) {
      throw new TransferServiceError("SOURCE_ACCOUNT_NOT_FOUND");
    }

    if (!destination) {
      throw new TransferServiceError("DESTINATION_ACCOUNT_NOT_FOUND");
    }

    if (source.customer_id !== customer.customer_id) {
      throw new TransferServiceError("UNAUTHORIZED_SOURCE_ACCOUNT");
    }

    if (
      source.account_status !== "ACTIVE" ||
      !["SAVINGS", "CURRENT"].includes(source.account_type)
    ) {
      throw new TransferServiceError("SOURCE_ACCOUNT_NOT_ACTIVE");
    }

    if (
      destination.account_status !== "ACTIVE" ||
      !["SAVINGS", "CURRENT"].includes(destination.account_type)
    ) {
      throw new TransferServiceError("DESTINATION_ACCOUNT_NOT_ACTIVE");
    }

    if (source.currency !== destination.currency) {
      throw new TransferServiceError("CURRENCY_MISMATCH");
    }

    const amount = new Prisma.Decimal(input.amount.toString());
    if (source.per_transaction_limit && amount.greaterThan(source.per_transaction_limit)) {
      throw new TransferServiceError("TRANSFER_PER_TRANSACTION_LIMIT_EXCEEDED");
    }
    if (source.daily_transfer_limit) {
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const today = await transaction.transactions.aggregate({
        where: { source_account_id: source.account_id, transaction_type: "TRANSFER", status: "COMPLETED", completed_at: { gte: dayStart } },
        _sum: { amount: true },
      });
      const transferredToday = today._sum.amount ?? new Prisma.Decimal(0);
      if (transferredToday.plus(amount).greaterThan(source.daily_transfer_limit)) {
        throw new TransferServiceError("TRANSFER_DAILY_LIMIT_EXCEEDED");
      }
    }
    const sourceCurrentBefore = new Prisma.Decimal(source.current_balance);
    const sourceAvailableBefore = new Prisma.Decimal(
      source.available_balance
    );
    const destinationCurrentBefore = new Prisma.Decimal(
      destination.current_balance
    );
    const destinationAvailableBefore = new Prisma.Decimal(
      destination.available_balance
    );

    if (
      sourceAvailableBefore.lessThan(amount) ||
      sourceCurrentBefore.lessThan(amount)
    ) {
      throw new TransferServiceError("INSUFFICIENT_FUNDS");
    }

    const bankingTransaction = await transaction.transactions.create({
      data: {
        reference_number: referenceNumber,
        transaction_type: "TRANSFER",
        source_account_id: source.account_id,
        destination_account_id: destination.account_id,
        amount,
        currency: source.currency,
        status: "PROCESSING",
      },
    });

    await transaction.transaction_details.create({
      data: {
        transaction_id: bankingTransaction.transaction_id,
        description: "Account transfer",
        notes: input.remarks || null,
      },
    });

    await transaction.transaction_status_history.create({
      data: {
        transaction_id: bankingTransaction.transaction_id,
        status: "PROCESSING",
        description: "Transfer processing started",
      },
    });

    const debitEntry = await createDebitEntry(
      {
        transactionId: bankingTransaction.transaction_id,
        accountId: source.account_id,
        amount,
        balanceBefore: sourceCurrentBefore,
      },
      transaction
    );

    const creditEntry = await createCreditEntry(
      {
        transactionId: bankingTransaction.transaction_id,
        accountId: destination.account_id,
        amount,
        balanceBefore: destinationCurrentBefore,
      },
      transaction
    );

    if (!debitEntry.amount.equals(creditEntry.amount)) {
      throw new Error("UNBALANCED_LEDGER_ENTRIES");
    }

    await transaction.accounts.update({
      where: { account_id: source.account_id },
      data: {
        current_balance: sourceCurrentBefore.minus(amount),
        available_balance: sourceAvailableBefore.minus(amount),
      },
    });

    await transaction.accounts.update({
      where: { account_id: destination.account_id },
      data: {
        current_balance: destinationCurrentBefore.plus(amount),
        available_balance: destinationAvailableBefore.plus(amount),
      },
    });

    const completedAt = new Date();
    const completedTransaction = await transaction.transactions.update({
      where: { transaction_id: bankingTransaction.transaction_id },
      data: {
        status: "COMPLETED",
        completed_at: completedAt,
      },
    });

    await transaction.transaction_status_history.create({
      data: {
        transaction_id: bankingTransaction.transaction_id,
        status: "COMPLETED",
        description: "Transfer completed",
      },
    });

    await createAuditLog(
      {
        ...auditContext,
        userId,
        action: "TRANSFER_COMPLETED",
        entity: "TRANSACTION",
        entityId: bankingTransaction.transaction_id,
      },
      transaction
    );

    await completeIdempotency(
      transaction,
      idempotencyClaim.recordId,
      bankingTransaction.transaction_id
    );

    return completedTransaction;
  }, {
    maxWait: TRANSFER_MAX_WAIT_MS,
    timeout: TRANSFER_TIMEOUT_MS,
  });
}

export async function transferFunds(
  userId: bigint,
  input: CreateTransferInput,
  auditContext: AuditContext,
  idempotency?: IdempotencyRequest
) {
  for (let attempt = 0; attempt < REFERENCE_ATTEMPTS; attempt++) {
    try {
      return await executeTransfer(
        userId,
        input,
        generateTransactionReference(),
        auditContext,
        idempotency
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        continue;
      }

      if (isTransactionStartTimeout(error)) {
        if (attempt < REFERENCE_ATTEMPTS - 1) {
          await waitBeforeRetry(attempt);
          continue;
        }

        throw new TransferServiceError("TRANSFER_TEMPORARILY_BUSY");
      }

      throw error;
    }
  }

  throw new Error("TRANSACTION_REFERENCE_GENERATION_FAILED");
}
