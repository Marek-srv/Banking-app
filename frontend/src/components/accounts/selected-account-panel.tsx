import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

import type { Account } from "@/api/accountApi";
import { displayAccountType, moneyFormatter } from "@/components/accounts/account-carousel";

type SelectedAccountPanelProps = {
  account: Account;
  branchName: string;
  moneyIn: number;
  moneyOut: number;
  onStatement: () => void;
};

function valueLabel(value: string) {
  const normalized = value.toLowerCase().replace(/_/g, " ");
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

export function SelectedAccountPanel({ account, branchName, moneyIn, moneyOut, onStatement }: SelectedAccountPanelProps) {
  const navigate = useNavigate();
  const lastFour = account.maskedAccountNumber.slice(-4);
  const isLoan = account.accountType === "LOAN";
  const displayedBalance = isLoan ? account.currentBalance : account.availableBalance;

  return (
    <section className="rounded-2xl border border-bank-border/90 bg-white p-5 shadow-[0_6px_22px_rgba(11,31,58,0.05)]" aria-label="Selected account details">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-bank-blue">Selected Account</p>
          <h2 className="mt-1.5 text-lg font-extrabold text-bank-navy">{displayAccountType(account.accountType)} <span className="ml-1 text-sm font-semibold tracking-[0.07em] text-bank-muted">••••{lastFour}</span></h2>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{valueLabel(account.status)}</span>
      </div>

      <div className="mt-4 flex items-end justify-between border-b border-bank-border pb-4">
        <div>
          <p className="text-[11px] font-medium text-bank-muted">{isLoan ? "Outstanding Balance" : "Available Balance"}</p>
          <p className="mt-1 text-[28px] font-extrabold tracking-[-0.035em] text-bank-text">{moneyFormatter.format(displayedBalance)}</p>
          {!isLoan && account.currentBalance !== account.availableBalance ? <p className="mt-0.5 text-[10px] text-bank-muted">Current balance {moneyFormatter.format(account.currentBalance)}</p> : null}
        </div>
        <div className="flex gap-2">
          {!isLoan ? <button type="button" onClick={() => navigate("/transfer")} className="inline-flex h-9 items-center gap-2 rounded-lg bg-bank-blue px-3.5 text-[11px] font-bold text-white shadow-[0_6px_16px_rgba(11,99,229,0.22)] transition hover:bg-blue-700">
            <ArrowLeftRight size={15} /> Transfer Money
          </button> : null}
          <button type="button" onClick={onStatement} className="inline-flex h-9 items-center gap-2 rounded-lg border border-bank-border px-3.5 text-[11px] font-bold text-bank-navy transition hover:border-bank-blue hover:text-bank-blue">
            <FileText size={15} /> Statement
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1.15fr_0.85fr] gap-5 pt-4">
        <div>
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.11em] text-bank-navy">Account Information</h3>
          <dl className="mt-2.5 grid grid-cols-2 gap-x-5 gap-y-2.5 text-xs">
            <div><dt className="text-[10px] text-bank-muted">Account Type</dt><dd className="mt-0.5 font-semibold text-bank-text">{valueLabel(account.accountType)}</dd></div>
            <div><dt className="text-[10px] text-bank-muted">Account Number</dt><dd className="mt-0.5 font-semibold tracking-[0.06em] text-bank-text">••••••••{lastFour}</dd></div>
            <div><dt className="text-[10px] text-bank-muted">Branch</dt><dd className="mt-0.5 truncate font-semibold text-bank-text" title={branchName}>{branchName}</dd></div>
            <div><dt className="text-[10px] text-bank-muted">Status</dt><dd className="mt-0.5 font-semibold text-emerald-700">{valueLabel(account.status)}</dd></div>
          </dl>
        </div>

        <div>
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.11em] text-bank-navy">30-Day Summary</h3>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-emerald-50 p-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-emerald-600"><ArrowDownLeft size={15} /></span>
              <p className="mt-2 text-[10px] font-medium text-emerald-800/70">Money In</p>
              <p className="mt-0.5 text-sm font-extrabold text-emerald-800">{moneyFormatter.format(moneyIn)}</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-red-500"><ArrowUpRight size={15} /></span>
              <p className="mt-2 text-[10px] font-medium text-red-800/70">Money Out</p>
              <p className="mt-0.5 text-sm font-extrabold text-red-700">{moneyFormatter.format(moneyOut)}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
