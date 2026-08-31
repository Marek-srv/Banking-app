import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, ReceiptText } from "lucide-react";

import type { TransactionView } from "@/components/transactions/transaction-types";
import { transactionMoneyFormatter } from "@/components/transactions/transaction-types";
import { cn } from "@/lib/utils";

type TransactionListProps = {
  transactions: TransactionView[];
  page: number;
  totalPages: number;
  totalResults: number;
  loading: boolean;
  error: boolean;
  onPageChange: (page: number) => void;
  onSelect: (transaction: TransactionView) => void;
  onRetry: () => void;
};

function dateParts(value: string) {
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(date),
    time: new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).format(date),
  };
}

function statusClass(status: string) {
  if (status === "COMPLETED") return "bg-emerald-50 text-emerald-700";
  if (status === "FAILED") return "bg-red-50 text-red-600";
  return "bg-amber-50 text-amber-700";
}

function pageNumbers(current: number, total: number) {
  const count = Math.min(total, 5);
  const start = Math.max(1, Math.min(current - 2, total - count + 1));
  return Array.from({ length: count }, (_, index) => start + index);
}

export function TransactionList(props: TransactionListProps) {
  return (
    <section className="rounded-2xl border border-bank-border/90 bg-white px-4 py-3.5 shadow-[0_5px_18px_rgba(11,31,58,0.045)]" aria-labelledby="transactions-list-heading">
      <div className="flex h-8 items-center justify-between">
        <div>
          <h2 id="transactions-list-heading" className="text-[13px] font-extrabold uppercase tracking-[0.11em] text-bank-navy">Transactions</h2>
          <p className="mt-0.5 text-[9px] text-bank-muted">{props.totalResults} transaction{props.totalResults === 1 ? "" : "s"} found</p>
        </div>
        <p className="text-[10px] font-medium text-bank-muted">Showing up to 8 per page</p>
      </div>

      <div className="mt-2 min-h-[392px] divide-y divide-bank-border/70">
        {props.loading ? Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-[49px] animate-pulse py-1.5"><div className="h-full rounded-lg bg-slate-100" /></div>) : null}
        {!props.loading && props.error ? (
          <div className="flex min-h-[390px] flex-col items-center justify-center text-center"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-500"><ReceiptText size={20} /></span><p className="mt-3 text-xs font-bold text-bank-navy">Unable to load transactions</p><p className="mt-1 text-[10px] text-bank-muted">Please check your connection and try again.</p><button type="button" onClick={props.onRetry} className="mt-3 rounded-lg bg-bank-blue px-3.5 py-2 text-[10px] font-bold text-white">Try Again</button></div>
        ) : null}
        {!props.loading && !props.error && props.transactions.length === 0 ? (
          <div className="flex min-h-[390px] flex-col items-center justify-center text-center"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-bank-light text-bank-blue"><ReceiptText size={20} /></span><p className="mt-3 text-xs font-bold text-bank-navy">No transactions found</p><p className="mt-1 text-[10px] text-bank-muted">Try adjusting your search or filters.</p></div>
        ) : null}
        {!props.loading && !props.error && props.transactions.map((transaction) => {
          const credit = transaction.direction === "credit";
          const formattedDate = dateParts(transaction.initiatedAt);
          return (
            <button key={transaction.id} type="button" onClick={() => props.onSelect(transaction)} className="group flex h-[49px] w-full items-center gap-3 text-left transition hover:bg-bank-page/70">
              <span className={cn("ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", credit ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500")}>
                {credit ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
              </span>
              <div className="min-w-0 w-[28%]">
                <p className="truncate text-xs font-bold text-bank-text group-hover:text-bank-blue">{transaction.description}</p>
                <p className="mt-0.5 truncate text-[9px] text-bank-muted">{transaction.category} · {formattedDate.date} · {formattedDate.time}</p>
              </div>
              <p className="min-w-0 flex-1 truncate text-[10px] font-medium text-bank-muted">{transaction.accountLabel}</p>
              <span className={cn("rounded-full px-2 py-1 text-[9px] font-bold capitalize", statusClass(transaction.status))}>{transaction.status.toLowerCase()}</span>
              <p className={cn("w-[105px] text-right text-xs font-extrabold", credit ? "text-emerald-600" : "text-red-600")}>{credit ? "+" : "−"}{transactionMoneyFormatter.format(transaction.amount)}</p>
              <ChevronRight size={14} className="mr-1 text-slate-300 group-hover:text-bank-blue" />
            </button>
          );
        })}
      </div>

      <div className="flex h-10 items-end justify-between border-t border-bank-border/70 pt-2">
        <p className="text-[9px] text-bank-muted">Page {props.totalPages === 0 ? 0 : props.page} of {props.totalPages}</p>
        <nav className="flex items-center gap-1" aria-label="Transaction pagination">
          <button type="button" disabled={props.page <= 1} onClick={() => props.onPageChange(props.page - 1)} className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-bank-muted hover:bg-bank-page hover:text-bank-blue disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={13} /> Previous</button>
          {pageNumbers(props.page, props.totalPages).map((page) => <button key={page} type="button" onClick={() => props.onPageChange(page)} className={cn("h-7 min-w-7 rounded-lg px-1 text-[10px] font-bold", page === props.page ? "bg-bank-blue text-white" : "text-bank-muted hover:bg-bank-page hover:text-bank-blue")}>{page}</button>)}
          <button type="button" disabled={props.page >= props.totalPages || props.totalPages === 0} onClick={() => props.onPageChange(props.page + 1)} className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-bank-muted hover:bg-bank-page hover:text-bank-blue disabled:cursor-not-allowed disabled:opacity-40">Next <ChevronRight size={13} /></button>
        </nav>
      </div>
    </section>
  );
}
