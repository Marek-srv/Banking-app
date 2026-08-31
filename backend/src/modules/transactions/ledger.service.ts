import { prisma } from "../../config/prisma";
import { Prisma } from "../../generated/prisma/client";

type MoneyValue = Prisma.Decimal | number | string;
type LedgerClient = Pick<Prisma.TransactionClient, "ledger_entries">;

export interface CreateLedgerEntryInput {
  transactionId: bigint;
  accountId: bigint;
  amount: MoneyValue;
  balanceBefore: MoneyValue;
}

function positiveAmount(amount: MoneyValue): Prisma.Decimal {
  const value = new Prisma.Decimal(amount);

  if (!value.isPositive()) {
    throw new Error("LEDGER_AMOUNT_MUST_BE_POSITIVE");
  }

  return value;
}

export async function createDebitEntry(
  input: CreateLedgerEntryInput,
  client: LedgerClient = prisma
) {
  const amount = positiveAmount(input.amount);
  const balanceBefore = new Prisma.Decimal(input.balanceBefore);

  return client.ledger_entries.create({
    data: {
      transaction_id: input.transactionId,
      account_id: input.accountId,
      entry_type: "DEBIT",
      amount,
      balance_before: balanceBefore,
      balance_after: balanceBefore.minus(amount),
    },
  });
}

export async function createCreditEntry(
  input: CreateLedgerEntryInput,
  client: LedgerClient = prisma
) {
  const amount = positiveAmount(input.amount);
  const balanceBefore = new Prisma.Decimal(input.balanceBefore);

  return client.ledger_entries.create({
    data: {
      transaction_id: input.transactionId,
      account_id: input.accountId,
      entry_type: "CREDIT",
      amount,
      balance_before: balanceBefore,
      balance_after: balanceBefore.plus(amount),
    },
  });
}

export async function getTransactionLedger(
  transactionId: bigint,
  ownedAccountIds: bigint[]
) {
  if (ownedAccountIds.length === 0) {
    return [];
  }

  return prisma.ledger_entries.findMany({
    where: {
      transaction_id: transactionId,
      account_id: { in: ownedAccountIds },
    },
    orderBy: { created_at: "asc" },
  });
}
