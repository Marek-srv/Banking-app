import { prisma } from "../../config/prisma";
import { Prisma } from "../../generated/prisma/client";

export type AnalyticsQuestionType =
  | "TOP_SPENDING_CATEGORY"
  | "AVERAGE_MONTHLY_EXPENDITURE"
  | "CATEGORY_SPENDING"
  | "MONTH_COMPARISON"
  | "HIGHEST_TRANSACTION"
  | "HIGHEST_SPENDING_WEEK"
  | "SAVINGS_PERCENTAGE"
  | "BENEFICIARY_TRANSFERS"
  | "TOP_SPENDING_CATEGORIES";

export type BankingAnalytics = {
  questionType: AnalyticsQuestionType;
  draftAnswer: string;
};

type CustomerContext = {
  customerId: bigint;
  accountIds: bigint[];
  ownedAccountIds: Set<bigint>;
};

type AnalyticsTransaction = Prisma.transactionsGetPayload<{
  include: { transaction_details: true };
}>;

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function utcMonthStart(date: Date, offset = 0) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
}

function amount(transaction: AnalyticsTransaction) {
  return Number(transaction.amount);
}

function isOutgoing(transaction: AnalyticsTransaction, owned: Set<bigint>) {
  const sourceOwned = transaction.source_account_id !== null && owned.has(transaction.source_account_id);
  const destinationOwned = transaction.destination_account_id !== null && owned.has(transaction.destination_account_id);
  return sourceOwned && !destinationOwned;
}

function isIncoming(transaction: AnalyticsTransaction, owned: Set<bigint>) {
  const sourceOwned = transaction.source_account_id !== null && owned.has(transaction.source_account_id);
  const destinationOwned = transaction.destination_account_id !== null && owned.has(transaction.destination_account_id);
  return destinationOwned && !sourceOwned;
}

function categoryOf(transaction: AnalyticsTransaction) {
  return transaction.transaction_details
    .map((detail) => detail.transaction_category?.trim())
    .find((category): category is string => Boolean(category));
}

function customerTransactionWhere(context: CustomerContext): Prisma.transactionsWhereInput {
  return {
    status: "COMPLETED",
    reversal_of_transaction_id: null,
    reversal_transaction: { is: null },
    OR: [
      { source_account_id: { in: context.accountIds } },
      { destination_account_id: { in: context.accountIds } },
    ],
  };
}

async function getCustomerContext(userId: bigint): Promise<CustomerContext> {
  const customer = await prisma.customers.findUnique({
    where: { user_id: userId },
    select: {
      customer_id: true,
      accounts: { select: { account_id: true } },
    },
  });

  if (!customer) {
    throw new Error("CUSTOMER_NOT_FOUND");
  }

  const accountIds = customer.accounts.map((account) => account.account_id);
  return {
    customerId: customer.customer_id,
    accountIds,
    ownedAccountIds: new Set(accountIds),
  };
}

async function transactionsSince(context: CustomerContext, from: Date) {
  if (context.accountIds.length === 0) return [];

  return prisma.transactions.findMany({
    where: {
      AND: [
        customerTransactionWhere(context),
        { completed_at: { gte: from } },
      ],
    },
    include: { transaction_details: true },
    orderBy: { completed_at: "asc" },
  });
}

function outgoingTotal(transactions: AnalyticsTransaction[], owned: Set<bigint>) {
  return transactions
    .filter((transaction) => isOutgoing(transaction, owned))
    .reduce((sum, transaction) => sum + amount(transaction), 0);
}

function incomingTotal(transactions: AnalyticsTransaction[], owned: Set<bigint>) {
  return transactions
    .filter((transaction) => isIncoming(transaction, owned))
    .reduce((sum, transaction) => sum + amount(transaction), 0);
}

function categoryTotals(transactions: AnalyticsTransaction[], owned: Set<bigint>) {
  const totals = new Map<string, number>();

  for (const transaction of transactions) {
    if (!isOutgoing(transaction, owned)) continue;
    const category = categoryOf(transaction);
    if (!category) continue;
    totals.set(category, (totals.get(category) ?? 0) + amount(transaction));
  }

  return [...totals.entries()].sort((left, right) => right[1] - left[1]);
}

export type ClassifiedQuestion =
  | { type: Exclude<AnalyticsQuestionType, "CATEGORY_SPENDING" | "BENEFICIARY_TRANSFERS"> }
  | { type: "CATEGORY_SPENDING"; category: string }
  | { type: "BENEFICIARY_TRANSFERS"; beneficiaryName: string };

export function classifyQuestion(question: string): ClassifiedQuestion {
  const normalized = question.toLowerCase().replace(/\s+/g, " ").trim();

  if (/^(transfer|send|move|withdraw|deposit|block|unblock|add|delete|remove|change|update)\b/.test(normalized)) {
    throw new Error("ASSISTANT_READ_ONLY");
  }

  if (normalized.includes("average") && (normalized.includes("spend") || normalized.includes("expenditure"))) {
    return { type: "AVERAGE_MONTHLY_EXPENDITURE" };
  }
  if (normalized.includes("compare") && normalized.includes("last month")) {
    return { type: "MONTH_COMPARISON" };
  }
  if (normalized.includes("highest transaction") || normalized.includes("largest transaction")) {
    return { type: "HIGHEST_TRANSACTION" };
  }
  if (normalized.includes("week") && (normalized.includes("most") || normalized.includes("highest"))) {
    return { type: "HIGHEST_SPENDING_WEEK" };
  }
  if (normalized.includes("percentage") && (normalized.includes("income") || normalized.includes("save"))) {
    return { type: "SAVINGS_PERCENTAGE" };
  }

  const beneficiaryMatch = normalized.match(/(?:transfer|transferred|send|sent)(?:red)?(?: money)? to ([a-z][a-z .'-]{0,79})[?.!]*$/i);
  if (beneficiaryMatch?.[1]) {
    return { type: "BENEFICIARY_TRANSFERS", beneficiaryName: beneficiaryMatch[1].trim() };
  }

  if (normalized.includes("top spending categories") || normalized.includes("top categories")) {
    return { type: "TOP_SPENDING_CATEGORIES" };
  }

  const categoryMatch = normalized.match(/how much (?:did i |have i )?spend(?:ing)? (?:on|for) ([a-z][a-z &'-]{1,49})[?.!]*$/i);
  if (categoryMatch?.[1]) {
    return { type: "CATEGORY_SPENDING", category: categoryMatch[1].trim() };
  }

  if (normalized.includes("spend the most") || normalized.includes("highest spending category")) {
    return { type: "TOP_SPENDING_CATEGORY" };
  }

  throw new Error("ASSISTANT_UNSUPPORTED_QUESTION");
}

async function currentMonthTransactions(context: CustomerContext, now: Date) {
  return transactionsSince(context, utcMonthStart(now));
}

export async function calculateBankingAnalytics(
  userId: bigint,
  classified: ClassifiedQuestion,
  now = new Date()
): Promise<BankingAnalytics> {
  const context = await getCustomerContext(userId);

  if (classified.type === "TOP_SPENDING_CATEGORY" || classified.type === "TOP_SPENDING_CATEGORIES") {
    const transactions = await currentMonthTransactions(context, now);
    const totals = categoryTotals(transactions, context.ownedAccountIds);
    if (totals.length === 0) {
      return {
        questionType: classified.type,
        draftAnswer: "Spending category data is not available for your completed outgoing transactions this month.",
      };
    }
    if (classified.type === "TOP_SPENDING_CATEGORY") {
      const [category, total] = totals[0]!;
      return {
        questionType: classified.type,
        draftAnswer: `Your highest spending category this month was ${category}, at ${inr.format(total)}.`,
      };
    }
    const top = totals.slice(0, 3).map(([category, total]) => `${category}: ${inr.format(total)}`).join(", ");
    return { questionType: classified.type, draftAnswer: `Your top spending categories this month were ${top}.` };
  }

  if (classified.type === "CATEGORY_SPENDING") {
    const transactions = await currentMonthTransactions(context, now);
    const available = transactions.some((transaction) => categoryOf(transaction));
    if (!available) {
      return {
        questionType: classified.type,
        draftAnswer: "Spending category data is not available for your completed outgoing transactions this month.",
      };
    }
    const search = classified.category.toLowerCase();
    const matching = transactions.filter((transaction) => {
      const category = categoryOf(transaction)?.toLowerCase();
      return isOutgoing(transaction, context.ownedAccountIds) && Boolean(category?.includes(search));
    });
    return {
      questionType: classified.type,
      draftAnswer: `You spent ${inr.format(outgoingTotal(matching, context.ownedAccountIds))} on ${classified.category} this month across ${matching.length} completed ${matching.length === 1 ? "transaction" : "transactions"}.`,
    };
  }

  if (classified.type === "AVERAGE_MONTHLY_EXPENDITURE") {
    const monthCount = 6;
    const transactions = await transactionsSince(context, utcMonthStart(now, -(monthCount - 1)));
    const average = outgoingTotal(transactions, context.ownedAccountIds) / monthCount;
    return {
      questionType: classified.type,
      draftAnswer: `Your average monthly expenditure over the last ${monthCount} calendar months, including this month, was ${inr.format(average)}.`,
    };
  }

  if (classified.type === "MONTH_COMPARISON") {
    const thisStart = utcMonthStart(now);
    const lastStart = utcMonthStart(now, -1);
    const transactions = await transactionsSince(context, lastStart);
    const thisMonth = outgoingTotal(transactions.filter((transaction) => transaction.completed_at! >= thisStart), context.ownedAccountIds);
    const lastMonth = outgoingTotal(transactions.filter((transaction) => transaction.completed_at! < thisStart), context.ownedAccountIds);
    const difference = thisMonth - lastMonth;
    const comparison = difference === 0 ? "the same as" : `${inr.format(Math.abs(difference))} ${difference > 0 ? "more" : "less"} than`;
    return {
      questionType: classified.type,
      draftAnswer: `You spent ${inr.format(thisMonth)} this month, ${comparison} last month's ${inr.format(lastMonth)}.`,
    };
  }

  if (classified.type === "HIGHEST_TRANSACTION") {
    if (context.accountIds.length === 0) {
      return { questionType: classified.type, draftAnswer: "You do not have any completed transactions yet." };
    }
    const transaction = await prisma.transactions.findFirst({
      where: customerTransactionWhere(context),
      include: { transaction_details: true },
      orderBy: { amount: "desc" },
    });
    if (!transaction) {
      return { questionType: classified.type, draftAnswer: "You do not have any completed transactions yet." };
    }
    const direction = isOutgoing(transaction, context.ownedAccountIds)
      ? "outgoing"
      : isIncoming(transaction, context.ownedAccountIds)
        ? "incoming"
        : "between your accounts";
    const date = (transaction.completed_at ?? transaction.initiated_at).toLocaleDateString("en-IN", { timeZone: "UTC" });
    return {
      questionType: classified.type,
      draftAnswer: `Your highest completed transaction was ${inr.format(amount(transaction))}, an ${direction} ${transaction.transaction_type.toLowerCase()} on ${date}.`,
    };
  }

  if (classified.type === "HIGHEST_SPENDING_WEEK") {
    const transactions = await currentMonthTransactions(context, now);
    const weeks = [0, 0, 0, 0, 0];
    for (const transaction of transactions) {
      if (!isOutgoing(transaction, context.ownedAccountIds)) continue;
      const day = (transaction.completed_at ?? transaction.initiated_at).getUTCDate();
      weeks[Math.min(4, Math.floor((day - 1) / 7))]! += amount(transaction);
    }
    const highest = Math.max(...weeks);
    if (highest === 0) {
      return { questionType: classified.type, draftAnswer: "You have no completed outgoing transactions this month." };
    }
    const index = weeks.indexOf(highest);
    const startDay = index * 7 + 1;
    const endDay = index === 4 ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate() : startDay + 6;
    return {
      questionType: classified.type,
      draftAnswer: `Your highest-spending week this month was ${startDay}–${endDay}, with ${inr.format(highest)} in completed outgoing transactions.`,
    };
  }

  if (classified.type === "SAVINGS_PERCENTAGE") {
    const transactions = await currentMonthTransactions(context, now);
    const income = incomingTotal(transactions, context.ownedAccountIds);
    const spending = outgoingTotal(transactions, context.ownedAccountIds);
    if (income <= 0) {
      return {
        questionType: classified.type,
        draftAnswer: "A savings percentage cannot be calculated because you have no completed incoming transactions this month.",
      };
    }
    const percentage = ((income - spending) / income) * 100;
    return {
      questionType: classified.type,
      draftAnswer: `You saved ${percentage.toFixed(1)}% of your income this month: ${inr.format(income)} came in and ${inr.format(spending)} went out.`,
    };
  }

  if (classified.type !== "BENEFICIARY_TRANSFERS") {
    throw new Error("ASSISTANT_UNSUPPORTED_QUESTION");
  }

  const beneficiary = await prisma.beneficiaries.findFirst({
    where: {
      customer_id: context.customerId,
      status: "ACTIVE",
      OR: [
        { beneficiary_name: { equals: classified.beneficiaryName, mode: "insensitive" } },
        { nickname: { equals: classified.beneficiaryName, mode: "insensitive" } },
      ],
    },
    select: { beneficiary_name: true, beneficiary_account_no: true },
  });
  if (!beneficiary) {
    return {
      questionType: classified.type,
      draftAnswer: `No active beneficiary named ${classified.beneficiaryName} was found in your beneficiary list.`,
    };
  }
  const destination = await prisma.accounts.findUnique({
    where: { account_number: beneficiary.beneficiary_account_no },
    select: { account_id: true },
  });
  if (!destination || context.accountIds.length === 0) {
    return {
      questionType: classified.type,
      draftAnswer: `No completed internal transfers to ${beneficiary.beneficiary_name} were found.`,
    };
  }
  const result = await prisma.transactions.aggregate({
    where: {
      status: "COMPLETED",
      transaction_type: "TRANSFER",
      source_account_id: { in: context.accountIds },
      destination_account_id: destination.account_id,
    },
    _sum: { amount: true },
    _count: { transaction_id: true },
  });
  const total = Number(result._sum.amount ?? 0);
  return {
    questionType: classified.type,
    draftAnswer: `You transferred ${inr.format(total)} to ${beneficiary.beneficiary_name} across ${result._count.transaction_id} completed ${result._count.transaction_id === 1 ? "transfer" : "transfers"}.`,
  };
}
