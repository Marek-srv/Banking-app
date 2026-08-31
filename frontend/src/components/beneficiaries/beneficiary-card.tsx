import { ArrowUpRight, Building2, Eye, UserRound } from "lucide-react";

import type { Beneficiary } from "@/api/beneficiaryApi";

type BeneficiaryCardProps = {
  beneficiary: Beneficiary;
  onTransfer: (beneficiary: Beneficiary) => void;
  onView: (beneficiary: Beneficiary) => void;
};

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase();
}

export function BeneficiaryCard({ beneficiary, onTransfer, onView }: BeneficiaryCardProps) {
  return (
    <article className="rounded-2xl border border-bank-border/90 bg-white p-4 shadow-[0_5px_18px_rgba(11,31,58,0.045)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_28px_rgba(11,31,58,0.08)]">
      <div className="flex items-start justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-bank-light text-sm font-extrabold text-bank-blue">{initials(beneficiary.beneficiaryName) || <UserRound size={19} />}</span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold tracking-wide text-emerald-700">{beneficiary.status}</span>
      </div>
      <h2 className="mt-3 text-sm font-extrabold text-bank-navy">{beneficiary.beneficiaryName}</h2>
      <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-bank-muted"><Building2 size={13} /> {beneficiary.bankName}</p>
      <p className="mt-2 text-xs font-bold tracking-[0.09em] text-bank-text">{beneficiary.maskedAccountNumber}</p>
      {beneficiary.nickname ? <p className="mt-1 text-[9px] text-bank-muted">Nickname: {beneficiary.nickname}</p> : <div className="h-[17px]" />}

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-bank-border/70 pt-3">
        <button type="button" onClick={() => onTransfer(beneficiary)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-bank-blue text-[10px] font-bold text-white shadow-[0_5px_14px_rgba(11,99,229,0.2)] hover:bg-blue-700"><ArrowUpRight size={14} /> Transfer</button>
        <button type="button" onClick={() => onView(beneficiary)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-bank-border text-[10px] font-bold text-bank-navy hover:border-bank-blue hover:text-bank-blue"><Eye size={14} /> View</button>
      </div>
    </article>
  );
}
