import { prisma } from "../../config/prisma";
import { getTransactionLedger } from "./ledger.service";
import { Prisma } from "../../generated/prisma/client";
import { paginationMetadata } from "../../schemas/pagination.schema";
import { TransactionListInput } from "./transaction.schema";

type TransactionErrorCode = "CUSTOMER_NOT_FOUND" | "TRANSACTION_NOT_FOUND";

export class TransactionServiceError extends Error {
  constructor(public readonly code: TransactionErrorCode) {
    super(code);
  }
}

async function getOwnedAccountIds(userId: bigint): Promise<bigint[]> {
  const customer = await prisma.customers.findUnique({
    where: { user_id: userId },
    select: { customer_id: true },
  });

  if (!customer) {
    throw new TransactionServiceError("CUSTOMER_NOT_FOUND");
  }

  const accounts = await prisma.accounts.findMany({
    where: { customer_id: customer.customer_id },
    select: { account_id: true },
  });

  return accounts.map((account) => account.account_id);
}

const transactionRelations = {
  transaction_details: {
    orderBy: { created_at: "asc" as const },
  },
  transaction_status_history: {
    orderBy: { created_at: "asc" as const },
  },
};

async function attachOwnedLedgerEntries<
  T extends { transaction_id: bigint }
>(transaction: T, ownedAccountIds: bigint[]) {
  const ledgerEntries = await getTransactionLedger(
    transaction.transaction_id,
    ownedAccountIds
  );

  return {
    ...transaction,
    ledger_entries: ledgerEntries,
  };
}

export async function listTransactions(
  userId: bigint,
  input: TransactionListInput
) {
  const ownedAccountIds = await getOwnedAccountIds(userId);

  if (ownedAccountIds.length === 0) {
    return { items: [], pagination: paginationMetadata(input, 0) };
  }

  const filters: Prisma.transactionsWhereInput[] = [
    {
      OR: [
        { source_account_id: { in: ownedAccountIds } },
        { destination_account_id: { in: ownedAccountIds } },
      ],
    },
  ];

  if (input.type) {
    filters.push({ transaction_type: input.type });
  }

  if (input.status) {
    filters.push({ status: input.status });
  }

  if (input.from || input.to) {
    const initiatedAt: Prisma.DateTimeFilter<"transactions"> = {};

    if (input.from) {
      initiatedAt.gte = new Date(`${input.from}T00:00:00.000Z`);
    }

    if (input.to) {
      const exclusiveEnd = new Date(`${input.to}T00:00:00.000Z`);
      exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
      initiatedAt.lt = exclusiveEnd;
    }

    filters.push({ initiated_at: initiatedAt });
  }

  const where: Prisma.transactionsWhereInput = { AND: filters };
  const [total, transactions] = await prisma.$transaction([
    prisma.transactions.count({ where }),
    prisma.transactions.findMany({
      where,
      include: transactionRelations,
      orderBy: { initiated_at: "desc" },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
  ]);

  const items = await Promise.all(
    transactions.map((transaction) =>
      attachOwnedLedgerEntries(transaction, ownedAccountIds)
    )
  );

  return { items, pagination: paginationMetadata(input, total) };
}

export async function getTransaction(
  userId: bigint,
  transactionId: bigint
) {
  const ownedAccountIds = await getOwnedAccountIds(userId);

  if (ownedAccountIds.length === 0) {
    throw new TransactionServiceError("TRANSACTION_NOT_FOUND");
  }

  const transaction = await prisma.transactions.findFirst({
    where: {
      transaction_id: transactionId,
      OR: [
        { source_account_id: { in: ownedAccountIds } },
        { destination_account_id: { in: ownedAccountIds } },
      ],
    },
    include: transactionRelations,
  });

  if (!transaction) {
    throw new TransactionServiceError("TRANSACTION_NOT_FOUND");
  }

  return attachOwnedLedgerEntries(transaction, ownedAccountIds);
}
