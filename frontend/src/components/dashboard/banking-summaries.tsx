import { useRef } from "react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  CreditCard,
  FileText,
  IndianRupee,
  SendHorizontal,
  UserPlus,
  Wallet,
  Wifi,
} from "lucide-react";

import type { Account } from "@/api/accountApi";
import type { BankCard } from "@/api/cardApi";
import { inrFormatter, titleCaseBankingValue } from "@/lib/banking-format";

const accountAccents = ["bg-bank-blue", "bg-violet-500", "bg-emerald-500", "bg-amber-500"];

type DashboardMetricsProps = {
  totalBalance: number;
  monthlyExpense: number;
  accountCount: number;
  onTransfer: () => void;
  onAddBeneficiary: () => void;
  onViewStatement: () => void;
};

export function DashboardMetrics({ totalBalance, monthlyExpense, accountCount, onTransfer, onAddBeneficiary, onViewStatement }: DashboardMetricsProps) {
  const quickActions = [
    { label: "Transfer Money", icon: SendHorizontal, onClick: onTransfer },
    { label: "Add Beneficiary", icon: UserPlus, onClick: onAddBeneficiary },
    { label: "View Statement", icon: FileText, onClick: onViewStatement },
  ];

  return (
    <section className="grid gap-3 lg:grid-cols-12" aria-label="Financial overview">
      <article className="rounded-2xl border border-bank-border/80 bg-white p-4 shadow-[0_4px_16px_rgba(11,31,58,0.04)] lg:col-span-3">
        <div className="flex items-start justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-bank-muted">Total Balance</p><p className="mt-2 text-[22px] font-bold tracking-[-0.03em] text-bank-navy">{inrFormatter.format(totalBalance)}</p></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-bank-blue"><Wallet size={18} /></span></div>
        <p className="mt-2 text-[11px] text-bank-muted">Across {accountCount} customer {accountCount === 1 ? "account" : "accounts"}</p>
      </article>

      <article className="rounded-2xl border border-bank-border/80 bg-white p-4 shadow-[0_4px_16px_rgba(11,31,58,0.04)] lg:col-span-3">
        <div className="flex items-start justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-bank-muted">Monthly Expense</p><p className="mt-2 text-[22px] font-bold tracking-[-0.03em] text-bank-navy">{inrFormatter.format(monthlyExpense)}</p></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500"><IndianRupee size={18} /></span></div>
        <p className="mt-2 text-[11px] text-bank-muted">Completed outgoing transactions this month</p>
      </article>

      <article className="rounded-2xl border border-bank-border/80 bg-white p-4 shadow-[0_4px_16px_rgba(11,31,58,0.04)] lg:col-span-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-bank-muted">Quick Actions</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {quickActions.map(({ label, icon: Icon, onClick }) => <button key={label} type="button" onClick={onClick} className="group flex min-h-[70px] flex-col items-center justify-center gap-1.5 rounded-xl border border-blue-100 bg-bank-light px-2 text-center text-[10px] font-semibold leading-tight text-bank-navy transition hover:border-bank-blue hover:bg-blue-100/70 sm:min-h-[58px] sm:flex-row sm:gap-2 sm:text-xs"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-bank-blue shadow-sm transition group-hover:bg-bank-blue group-hover:text-white"><Icon size={16} /></span><span>{label}</span></button>)}
        </div>
      </article>
    </section>
  );
}

export function AccountSummary({ accounts, onSelect }: { accounts: Account[]; onSelect: () => void }) {
  const scrollContainer = useRef<HTMLDivElement>(null);
  const scroll = (direction: number) => scrollContainer.current?.scrollBy({ left: direction * 275, behavior: "smooth" });

  return (
    <article className="min-w-0 rounded-2xl border border-bank-border/80 bg-white p-4 shadow-[0_4px_16px_rgba(11,31,58,0.04)]">
      <div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-bank-navy">Account Summary</h2><p className="mt-0.5 text-[10px] text-bank-muted">Your π Bank accounts</p></div><div className="flex gap-1.5"><button type="button" onClick={() => scroll(-1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-bank-border text-bank-muted hover:text-bank-blue" aria-label="Previous account"><ArrowLeft size={14} /></button><button type="button" onClick={() => scroll(1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-bank-border text-bank-muted hover:text-bank-blue" aria-label="Next account"><ArrowRight size={14} /></button></div></div>
      {accounts.length === 0 ? <div className="mt-3 flex h-[112px] items-center justify-center rounded-xl border border-dashed border-bank-border bg-bank-page text-xs text-bank-muted">No accounts are available.</div> : (
        <div ref={scrollContainer} className="mt-3 flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {accounts.map((account, index) => {
            const isLoan = account.accountType === "LOAN";
            const displayedBalance = isLoan ? account.currentBalance : account.availableBalance;
            return <button key={account.accountId} type="button" onClick={onSelect} className="min-w-[245px] snap-start rounded-xl border border-bank-border bg-bank-page p-3 text-left transition hover:border-blue-200"><div className="flex items-center justify-between"><span className={`h-2.5 w-2.5 rounded-full ${accountAccents[index % accountAccents.length]}`} /><span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${account.status === "ACTIVE" || account.status === "LOAN" ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{account.status}</span></div><p className="mt-3 text-xs font-semibold text-bank-navy">{titleCaseBankingValue(account.accountType)} Account</p><p className="mt-1 text-[10px] tracking-[0.12em] text-bank-muted">{account.maskedAccountNumber}</p><p className="mt-2 text-[9px] font-semibold uppercase tracking-wide text-bank-muted">{isLoan ? "Outstanding Balance" : "Available Balance"}</p><div className="mt-0.5 flex items-center justify-between"><p className="text-lg font-bold text-bank-navy">{inrFormatter.format(displayedBalance)}</p><ChevronRight size={14} className="text-bank-muted" /></div></button>;
          })}
        </div>
      )}
    </article>
  );
}

type PhysicalBankCardProps = {
  card?: BankCard;
  cardholderName: string;
  linkedAccount?: Account;
  onManage: () => void;
};

export function PhysicalBankCard({ card, cardholderName, linkedAccount, onManage }: PhysicalBankCardProps) {
  const blocked = card?.cardStatus === "BLOCKED";
  const linkedLabel = linkedAccount ? `${titleCaseBankingValue(linkedAccount.accountType)} ${linkedAccount.maskedAccountNumber}` : card ? "Linked account unavailable" : "No issued card";
  return (
    <article className="rounded-2xl border border-bank-border/80 bg-white p-4 shadow-[0_4px_16px_rgba(11,31,58,0.04)]">
      <div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-bank-navy">Card Summary</h2><p className="mt-0.5 text-[10px] text-bank-muted">{linkedLabel}</p></div><button type="button" onClick={onManage} className="text-[10px] font-semibold text-bank-blue hover:underline">Manage</button></div>
      {!card ? <div className="mx-auto mt-3 flex aspect-[1.586/1] w-full max-w-[300px] items-center justify-center rounded-[18px] border border-dashed border-bank-border bg-bank-page"><div className="text-center text-bank-muted"><CreditCard className="mx-auto" size={24} /><p className="mt-2 text-[10px]">No cards are available.</p></div></div> : (
        <div className={`relative mx-auto mt-3 aspect-[1.586/1] w-full max-w-[300px] overflow-hidden rounded-[18px] bg-gradient-to-br from-[#061A33] via-[#0B2D56] to-[#0B63E5] p-4 text-white shadow-[0_14px_30px_rgba(6,26,51,0.24)] ${blocked ? "grayscale opacity-60" : ""}`}>
          <div className="absolute -right-10 -top-16 h-40 w-40 rounded-full border-[28px] border-white/5" /><div className="absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-blue-400/10" />
          <div className="relative flex items-start justify-between"><p className="font-serif text-2xl font-black tracking-[-0.08em]">π <span className="font-sans text-xs font-semibold tracking-normal">Bank</span></p><div className="text-right"><Wifi size={23} className="ml-auto rotate-90 text-white/85" /><p className="mt-0.5 text-[7px] font-bold tracking-[0.14em] text-white/65">{card.cardType}</p></div></div>
          <div className="relative mt-5 h-7 w-9 rounded-md bg-gradient-to-br from-[#F8E39A] via-[#CFAE52] to-[#FFF0B0]"><span className="absolute left-1/2 top-0 h-full w-px bg-amber-700/30" /><span className="absolute left-0 top-1/2 h-px w-full bg-amber-700/30" /></div>
          <p className="relative mt-4 text-[15px] font-medium tracking-[0.16em]">{card.maskedCardNumber}</p>
          <div className="relative mt-3 flex items-end justify-between"><div><p className="text-[7px] uppercase tracking-[0.15em] text-white/55">Card holder</p><p className="mt-0.5 max-w-[190px] truncate text-[10px] font-semibold uppercase tracking-[0.08em]">{cardholderName}</p></div><p className="rounded-full bg-white/10 px-2 py-1 text-[7px] font-bold tracking-wider">{card.cardStatus}</p></div>
        </div>
      )}
    </article>
  );
}

export const transactionDirectionIcons = { debit: ArrowUpRight, credit: ArrowDownRight };
