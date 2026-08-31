import { CalendarDays, ChevronDown, ListFilter, RotateCcw, Search } from "lucide-react";

import type { Account } from "@/api/accountApi";
import { cn } from "@/lib/utils";

export type DateFilter = "today" | "last7" | "last30" | "thisMonth" | "lastMonth" | "custom";
export type TypeFilter = "all" | "credit" | "debit" | "transfer" | "atm";
export type StatusFilter = "all" | "COMPLETED" | "PROCESSING" | "FAILED";

type TransactionFiltersProps = {
  accounts: Account[];
  search: string;
  accountId: string;
  dateFilter: DateFilter;
  typeFilter: TypeFilter;
  statusFilter: StatusFilter;
  customFrom: string;
  customTo: string;
  moreOpen: boolean;
  onSearchChange: (value: string) => void;
  onAccountChange: (value: string) => void;
  onDateChange: (value: DateFilter) => void;
  onTypeChange: (value: TypeFilter) => void;
  onStatusChange: (value: StatusFilter) => void;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  onToggleMore: () => void;
  onReset: () => void;
};

const selectClass = "h-10 appearance-none rounded-xl border border-bank-border bg-white pl-3 pr-9 text-[11px] font-semibold text-bank-navy outline-none transition focus:border-bank-blue focus:ring-2 focus:ring-blue-100";

function accountLabel(account: Account) {
  const type = account.accountType.charAt(0) + account.accountType.slice(1).toLowerCase();
  return `${type} ${account.maskedAccountNumber}`;
}

export function TransactionFilters(props: TransactionFiltersProps) {
  const showExpanded = props.moreOpen || props.dateFilter === "custom";

  return (
    <section className="rounded-2xl border border-bank-border/90 bg-white px-4 py-3 shadow-[0_5px_18px_rgba(11,31,58,0.04)]" aria-label="Transaction filters">
      <div className="flex items-center gap-2.5">
        <label className="relative min-w-[240px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-bank-muted" />
          <input value={props.search} onChange={(event) => props.onSearchChange(event.target.value)} placeholder="Search transactions..." className="h-10 w-full rounded-xl border border-bank-border bg-bank-page/60 pl-9 pr-3 text-xs text-bank-text outline-none placeholder:text-slate-400 focus:border-bank-blue focus:bg-white focus:ring-2 focus:ring-blue-100" />
        </label>

        <label className="relative">
          <select value={props.accountId} onChange={(event) => props.onAccountChange(event.target.value)} className={`${selectClass} w-[176px]`} aria-label="Filter by account">
            <option value="all">All Accounts</option>
            {props.accounts.map((account) => <option key={account.accountId} value={account.accountId}>{accountLabel(account)}</option>)}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-bank-muted" />
        </label>

        <label className="relative">
          <select value={props.dateFilter} onChange={(event) => props.onDateChange(event.target.value as DateFilter)} className={`${selectClass} w-[142px]`} aria-label="Filter by date">
            <option value="today">Today</option>
            <option value="last7">Last 7 Days</option>
            <option value="last30">Last 30 Days</option>
            <option value="thisMonth">This Month</option>
            <option value="lastMonth">Last Month</option>
            <option value="custom">Custom</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-bank-muted" />
        </label>

        <label className="relative">
          <select value={props.typeFilter} onChange={(event) => props.onTypeChange(event.target.value as TypeFilter)} className={`${selectClass} w-[128px]`} aria-label="Filter by transaction type">
            <option value="all">All Types</option>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
            <option value="transfer">Transfer</option>
            <option value="atm">ATM</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-bank-muted" />
        </label>

        <button type="button" onClick={props.onToggleMore} className={cn("inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-[11px] font-bold transition", showExpanded ? "border-bank-blue bg-bank-light text-bank-blue" : "border-bank-border bg-white text-bank-navy hover:border-bank-blue hover:text-bank-blue")}>
          <ListFilter size={15} /> More Filters
        </button>
      </div>

      {showExpanded ? (
        <div className="mt-3 flex items-end gap-3 border-t border-bank-border/70 pt-3">
          {props.dateFilter === "custom" ? (
            <>
              <label className="text-[10px] font-semibold text-bank-muted">From<input type="date" value={props.customFrom} onChange={(event) => props.onCustomFromChange(event.target.value)} className="mt-1 block h-9 w-[150px] rounded-lg border border-bank-border px-2.5 text-[11px] text-bank-navy outline-none focus:border-bank-blue" /></label>
              <label className="text-[10px] font-semibold text-bank-muted">To<input type="date" value={props.customTo} min={props.customFrom} onChange={(event) => props.onCustomToChange(event.target.value)} className="mt-1 block h-9 w-[150px] rounded-lg border border-bank-border px-2.5 text-[11px] text-bank-navy outline-none focus:border-bank-blue" /></label>
            </>
          ) : <span className="flex h-9 items-center gap-2 rounded-lg bg-bank-light px-3 text-[11px] font-semibold text-bank-blue"><CalendarDays size={14} /> Date range applied</span>}
          <label className="text-[10px] font-semibold text-bank-muted">Status
            <select value={props.statusFilter} onChange={(event) => props.onStatusChange(event.target.value as StatusFilter)} className="mt-1 block h-9 w-[150px] rounded-lg border border-bank-border bg-white px-2.5 text-[11px] font-semibold text-bank-navy outline-none focus:border-bank-blue">
              <option value="all">All Statuses</option><option value="COMPLETED">Completed</option><option value="PROCESSING">Processing</option><option value="FAILED">Failed</option>
            </select>
          </label>
          <button type="button" onClick={props.onReset} className="ml-auto inline-flex h-9 items-center gap-1.5 text-[11px] font-bold text-bank-muted hover:text-bank-blue"><RotateCcw size={14} /> Reset Filters</button>
        </div>
      ) : null}
    </section>
  );
}
