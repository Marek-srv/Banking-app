import { randomBytes } from "crypto";
import { prisma } from "../../config/prisma";
import { Prisma } from "../../generated/prisma/client";
import {
  createCreditEntry,
  createDebitEntry,
} from "./ledger.service";
import { CashOperationInput } from "./transaction.schema";
import {
  AuditContext,
  createAuditLog,
} from "../../services/audit.service";
import {
  claimIdempotency,
  completeIdempotency,
  IdempotencyRequest,
} from "../../services/idempotency.service";

type CashOperation = "DEPOSIT" | "WITHDRAWAL";
type CashOperationErrorCode =
  | "CUSTOMER_NOT_FOUND"
  | "ACCOUNT_NOT_FOUND"
  | "UNAUTHORIZED_ACCOUNT"
  | "ACCOUNT_NOT_ACTIVE"
  | "INSUFFICIENT_FUNDS";

interface LockedAccount {
  account_id: bigint;
  customer_id: bigint;
  account_type: string;
  currency: string;
  current_balance: Prisma.Decimal;
  available_balance: Prisma.Decimal;
  account_status: string;
}

const REFERENCE_ATTEMPTS = 5;

export class CashOperationServiceError extends Error {
  constructor(public readonly code: CashOperationErrorCode) {
    super(code);
  }
}

function generateTransactionReference(operation: CashOperation): string {
  const prefix = operation === "DEPOSIT" ? "DEP" : "WDL";
  return `${prefix}${Date.now()}${randomBytes(6)
    .toString("hex")
    .toUpperCase()}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function executeCashOperation(
  userId: bigint,
  input: CashOperationInput,
  operation: CashOperation,
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
      throw new CashOperationServiceError("CUSTOMER_NOT_FOUND");
    }

    const lockedAccounts = await transaction.$queryRaw<LockedAccount[]>`
      SELECT
        account_id,
        customer_id,
        account_type::text,
        currency,
        current_balance,
        available_balance,
        account_status
      FROM accounts
      WHERE account_id = ${input.accountId}
      FOR UPDATE
    `;
    const account = lockedAccounts[0];

    if (!account) {
      throw new CashOperationServiceError("ACCOUNT_NOT_FOUND");
    }

    if (account.customer_id !== customer.customer_id) {
      throw new CashOperationServiceError("UNAUTHORIZED_ACCOUNT");
    }

    if (
      account.account_status !== "ACTIVE" ||
      !["SAVINGS", "CURRENT"].includes(account.account_type)
    ) {
      throw new CashOperationServiceError("ACCOUNT_NOT_ACTIVE");
    }

    const amount = new Prisma.Decimal(input.amount.toString());
    const currentBalanceBefore = new Prisma.Decimal(account.current_balance);
    const availableBalanceBefore = new Prisma.Decimal(
      account.available_balance
    );

    if (
      operation === "WITHDRAWAL" &&
      (availableBalanceBefore.lessThan(amount) ||
        currentBalanceBefore.lessThan(amount))
    ) {
      throw new CashOperationServiceError("INSUFFICIENT_FUNDS");
    }

    const bankingTransaction = await transaction.transactions.create({
      data: {
        reference_number: referenceNumber,
        transaction_type: operation,
        source_account_id:
          operation === "WITHDRAWAL" ? account.account_id : null,
        destination_account_id:
          operation === "DEPOSIT" ? account.account_id : null,
        amount,
        currency: account.currency,
        status: "PROCESSING",
      },
    });

    await transaction.transaction_status_history.create({
      data: {
        transaction_id: bankingTransaction.transaction_id,
        status: "PROCESSING",
        description: `${operation} processing started`,
      },
    });

    const isDeposit = operation === "DEPOSIT";
    const currentBalanceAfter = isDeposit
      ? currentBalanceBefore.plus(amount)
      : currentBalanceBefore.minus(amount);
    const availableBalanceAfter = isDeposit
      ? availableBalanceBefore.plus(amount)
      : availableBalanceBefore.minus(amount);

    if (isDeposit) {
      await createCreditEntry(
        {
          transactionId: bankingTransaction.transaction_id,
          accountId: account.account_id,
          amount,
          balanceBefore: currentBalanceBefore,
        },
        transaction
      );
    } else {
      await createDebitEntry(
        {
          transactionId: bankingTransaction.transaction_id,
          accountId: account.account_id,
          amount,
          balanceBefore: currentBalanceBefore,
        },
        transaction
      );
    }

    await transaction.accounts.update({
      where: { account_id: account.account_id },
      data: {
        current_balance: currentBalanceAfter,
        available_balance: availableBalanceAfter,
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
        description: `${operation} completed`,
      },
    });

    await createAuditLog(
      {
        ...auditContext,
        userId,
        action:
          operation === "DEPOSIT"
            ? "DEPOSIT_COMPLETED"
            : "WITHDRAWAL_COMPLETED",
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
  });
}

async function runWithUniqueReference(
  userId: bigint,
  input: CashOperationInput,
  operation: CashOperation,
  auditContext: AuditContext,
  idempotency: IdempotencyRequest | undefined
) {
  for (let attempt = 0; attempt < REFERENCE_ATTEMPTS; attempt++) {
    try {
      return await executeCashOperation(
        userId,
        input,
        operation,
        generateTransactionReference(operation),
        auditContext,
        idempotency
      );
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  throw new Error("TRANSACTION_REFERENCE_GENERATION_FAILED");
}

export function depositFunds(
  userId: bigint,
  input: CashOperationInput,
  auditContext: AuditContext,
  idempotency?: IdempotencyRequest
) {
  return runWithUniqueReference(
    userId,
    input,
    "DEPOSIT",
    auditContext,
    idempotency
  );
}

export function withdrawFunds(
  userId: bigint,
  input: CashOperationInput,
  auditContext: AuditContext,
  idempotency?: IdempotencyRequest
) {
  return runWithUniqueReference(
    userId,
    input,
    "WITHDRAWAL",
    auditContext,
    idempotency
  );
}
