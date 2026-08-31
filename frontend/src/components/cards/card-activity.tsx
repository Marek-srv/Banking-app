import { ArrowRight, CreditCard, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";

import type { AccountTransaction } from "@/api/accountApi";
import { transactionMoneyFormatter } from "@/components/transactions/transaction-types";

type CardActivityProps = {
  transactions: AccountTransaction[];
  loading: boolean;
  attributionAvailable: boolean;
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(value));
}

export function CardActivity({ transactions, loading, attributionAvailable }: CardActivityProps) {
  return (
    <section className="rounded-2xl border border-bank-border/90 bg-white p-4 shadow-[0_5px_18px_rgba(11,31,58,0.045)]" aria-labelledby="recent-card-activity">
      <div className="flex items-center justify-between"><div><h2 id="recent-card-activity" className="text-xs font-extrabold text-bank-navy">Recent Card Activity</h2><p className="mt-0.5 text-[9px] text-bank-muted">Latest spending from the linked account</p></div><Link to="/transactions" className="inline-flex items-center gap-1 text-[10px] font-bold text-bank-blue hover:underline">View All <ArrowRight size={13} /></Link></div>
      <div className="mt-2 min-h-[144px] divide-y divide-bank-border/70">
        {loading ? Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-12 animate-pulse py-1.5"><div className="h-full rounded-lg bg-slate-100" /></div>) : null}
        {!loading && !attributionAvailable ? <div className="flex min-h-[144px] flex-col items-center justify-center px-5 text-center"><CreditCard size={20} className="text-bank-blue" /><p className="mt-2 text-[10px] font-bold text-bank-navy">Card-linked activity unavailable</p><p className="mt-1 text-[9px] leading-4 text-bank-muted">The current API does not identify this card’s linked account.</p></div> : null}
        {!loading && attributionAvailable && transactions.length === 0 ? <div className="flex min-h-[144px] flex-col items-center justify-center text-center"><ShoppingBag size={19} className="text-bank-blue" /><p className="mt-2 text-[10px] font-bold text-bank-navy">No recent card activity</p><p className="mt-1 text-[9px] text-bank-muted">Recent purchases will appear here.</p></div> : null}
        {!loading && attributionAvailable && transactions.slice(0, 4).map((transaction) => <div key={transaction.transactionId} className="flex h-12 items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-bank-light text-bank-blue"><ShoppingBag size={14} /></span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-bank-text">{transaction.description}</p><p className="mt-0.5 text-[9px] text-bank-muted">{transaction.category} · {dateLabel(transaction.initiatedAt)}</p></div><p className="text-[11px] font-extrabold text-red-600">−{transactionMoneyFormatter.format(transaction.amount)}</p></div>)}
      </div>
    </section>
  );
}
