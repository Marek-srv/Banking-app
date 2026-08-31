import { ArrowDownLeft, ArrowUpRight, ReceiptText } from "lucide-react";

import type { AccountTransaction } from "@/api/accountApi";
import { formatTransactionDate, inrFormatter } from "@/lib/banking-format";

type RecentTransactionsProps = {
  transactions: AccountTransaction[];
  ownedAccountIds: Set<string>;
  onViewAll: () => void;
};

export function RecentTransactions({ transactions, ownedAccountIds, onViewAll }: RecentTransactionsProps) {
  return (
    <article className="rounded-2xl border border-bank-border/80 bg-white p-4 shadow-[0_4px_16px_rgba(11,31,58,0.04)]">
      <div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-bank-navy">Recent Transactions</h2><p className="mt-0.5 text-[10px] text-bank-muted">Your latest completed account activity</p></div><button type="button" onClick={onViewAll} className="text-[10px] font-semibold text-bank-blue hover:underline">View all</button></div>
      {transactions.length === 0 ? <div className="flex h-[102px] items-center justify-center text-center"><div><ReceiptText className="mx-auto text-bank-muted" size={21} /><p className="mt-2 text-[10px] text-bank-muted">No completed transactions yet.</p></div></div> : (
        <div className="mt-3 grid gap-x-6 md:grid-cols-2 2xl:grid-cols-1">
          {transactions.slice(0, 4).map((transaction) => {
            const sourceOwned = Boolean(transaction.sourceAccountId && ownedAccountIds.has(transaction.sourceAccountId));
            const destinationOwned = Boolean(transaction.destinationAccountId && ownedAccountIds.has(transaction.destinationAccountId));
            const credit = destinationOwned && !sourceOwned;
            const internal = sourceOwned && destinationOwned;
            const Icon = credit ? ArrowDownLeft : ArrowUpRight;
            return <button key={transaction.transactionId} type="button" onClick={onViewAll} className="flex items-center gap-3 border-t border-bank-border/70 py-2.5 text-left first:border-t-0 md:[&:nth-child(2)]:border-t-0 2xl:[&:nth-child(2)]:border-t"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${credit ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-bank-blue"}`}><Icon size={17} /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-bank-navy">{transaction.description}</span><span className="mt-0.5 block text-[10px] text-bank-muted">{formatTransactionDate(transaction.initiatedAt)}{internal ? " · Between your accounts" : ""}</span></span><span className={`whitespace-nowrap text-xs font-bold ${credit ? "text-emerald-600" : internal ? "text-bank-muted" : "text-red-500"}`}>{credit ? "+" : internal ? "" : "−"}{inrFormatter.format(transaction.amount)}</span></button>;
          })}
        </div>
      )}
    </article>
  );
}
