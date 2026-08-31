import { useEffect, useState } from "react";
import { Landmark, LoaderCircle, X } from "lucide-react";

import type { CreateAccountInput } from "@/api/accountApi";
import { getApiErrorMessage } from "@/lib/apiClient";

type OpenAccountModalProps = {
  open: boolean;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (input: CreateAccountInput) => void;
};

export function OpenAccountModal({ open, pending, error, onClose, onSubmit }: OpenAccountModalProps) {
  const [accountType, setAccountType] = useState<CreateAccountInput["accountType"]>("SAVINGS");

  useEffect(() => {
    if (open) setAccountType("SAVINGS");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4" role="dialog" aria-modal="true" aria-labelledby="open-account-title">
      <button type="button" className="absolute inset-0 bg-bank-dark/35 backdrop-blur-[1px]" onClick={() => !pending && onClose()} aria-label="Close open account dialog" />
      <form
        className="relative w-full max-w-[430px] rounded-2xl border border-bank-border bg-white p-6 shadow-[0_24px_65px_rgba(6,26,51,0.22)]"
        onSubmit={(event) => { event.preventDefault(); if (!pending) onSubmit({ accountType }); }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bank-light text-bank-blue"><Landmark size={19} /></span>
            <div><h2 id="open-account-title" className="text-base font-extrabold text-bank-navy">Open New Account</h2><p className="mt-0.5 text-[11px] text-bank-muted">Choose the account type you need.</p></div>
          </div>
          <button type="button" onClick={onClose} disabled={pending} className="flex h-8 w-8 items-center justify-center rounded-full text-bank-muted hover:bg-bank-page hover:text-bank-navy disabled:opacity-50" aria-label="Close"><X size={18} /></button>
        </div>

        <label className="mt-6 block text-[11px] font-bold text-bank-navy" htmlFor="new-account-type">Account Type</label>
        <select id="new-account-type" value={accountType} onChange={(event) => setAccountType(event.target.value as CreateAccountInput["accountType"])} disabled={pending} className="mt-2 h-11 w-full rounded-xl border border-bank-border bg-white px-3 text-sm font-semibold text-bank-text outline-none transition focus:border-bank-blue focus:ring-2 focus:ring-bank-blue/10">
          <option value="SAVINGS">Savings Account</option>
          <option value="CURRENT">Current Account</option>
        </select>
        <p className="mt-2 text-[10px] leading-4 text-bank-muted">Your branch is assigned from your customer profile. New accounts always start with a zero balance.</p>

        {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700" role="alert">{getApiErrorMessage(error)}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={pending} className="h-10 rounded-xl border border-bank-border px-4 text-xs font-bold text-bank-navy hover:bg-bank-page disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={pending} className="inline-flex h-10 min-w-[132px] items-center justify-center gap-2 rounded-xl bg-bank-blue px-4 text-xs font-bold text-white shadow-[0_7px_18px_rgba(11,99,229,0.22)] hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {pending ? <LoaderCircle size={15} className="animate-spin" /> : null}{pending ? "Opening…" : "Open Account"}
          </button>
        </div>
      </form>
    </div>
  );
}
