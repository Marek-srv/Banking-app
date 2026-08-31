import { ArrowDownLeft, ArrowRight, ArrowUpRight, ReceiptText } from "lucide-react";
import { Link } from "react-router-dom";

import type { AccountTransaction } from "@/api/accountApi";
import { moneyFormatter } from "@/components/accounts/account-carousel";

type AccountTransactionsProps = {
  accountId: string;
  transactions: AccountTransaction[];
  loading: boolean;
};

function isCredit(transaction: AccountTransaction, accountId: string) {
  return transaction.destinationAccountId === accountId && transaction.sourceAccountId !== accountId;
}

function prettyDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(value));
}

export function AccountTransactions({ accountId, transactions, loading }: AccountTransactionsProps) {
  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-bank-border/90 bg-white p-5 shadow-[0_6px_22px_rgba(11,31,58,0.05)]" aria-labelledby="recent-account-transactions">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="recent-account-transactions" className="text-[13px] font-extrabold uppercase tracking-[0.11em] text-bank-navy">Recent Transactions</h2>
          <p className="mt-1 text-[10px] text-bank-muted">Latest activity for this account</p>
        </div>
        <Link to="/transactions" className="inline-flex items-center gap-1 text-[11px] font-bold text-bank-blue hover:underline">View All <ArrowRight size={14} /></Link>
      </div>

      <div className="mt-3 divide-y divide-bank-border/70">
        {loading ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-[54px] animate-pulse py-2"><div className="h-full rounded-lg bg-slate-100" /></div>) : null}
        {!loading && transactions.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-bank-light text-bank-blue"><ReceiptText size={20} /></span>
            <p className="mt-3 text-xs font-semibold text-bank-navy">No recent transactions</p>
            <p className="mt-1 text-[10px] text-bank-muted">New activity will appear here.</p>
          </div>
        ) : null}
        {!loading && transactions.slice(0, 5).map((transaction) => {
          const credit = isCredit(transaction, accountId);
          return (
            <div key={transaction.transactionId} className="flex h-[54px] items-center gap-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${credit ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                {credit ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-bank-text">{transaction.description}</p>
                <p className="mt-0.5 text-[9px] uppercase tracking-wide text-bank-muted">{transaction.type.replace(/_/g, " ")} · {prettyDate(transaction.initiatedAt)}</p>
              </div>
              <p className={`text-xs font-extrabold ${credit ? "text-emerald-600" : "text-bank-text"}`}>{credit ? "+" : "−"}{moneyFormatter.format(transaction.amount)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
