export type TransactionDirection = "credit" | "debit";

export type TransactionView = {
  id: string;
  referenceNumber: string;
  description: string;
  category: string;
  remarks: string;
  accountLabel: string;
  fromLabel: string;
  toLabel: string;
  amount: number;
  direction: TransactionDirection;
  status: string;
  type: string;
  initiatedAt: string;
};

export const transactionMoneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});
