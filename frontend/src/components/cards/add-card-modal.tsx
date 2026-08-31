import { useEffect, useMemo, useState } from "react";
import { CreditCard, LoaderCircle, X } from "lucide-react";

import type { Account } from "@/api/accountApi";
import type { CreateCardInput } from "@/api/cardApi";
import { getApiErrorMessage } from "@/lib/apiClient";

type AddCardModalProps = {
  open: boolean;
  accounts: Account[];
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (input: CreateCardInput) => void;
};

export function AddCardModal({ open, accounts, pending, error, onClose, onSubmit }: AddCardModalProps) {
  const activeAccounts = useMemo(() => accounts.filter((account) => account.status === "ACTIVE" && ["SAVINGS", "CURRENT"].includes(account.accountType)), [accounts]);
  const [accountId, setAccountId] = useState("");
  const [cardType, setCardType] = useState<CreateCardInput["cardType"]>("DEBIT");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setAccountId(activeAccounts[0]?.accountId ?? "");
    setCardType("DEBIT");
    setNotes("");
  }, [activeAccounts, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4" role="dialog" aria-modal="true" aria-labelledby="add-card-title">
      <button type="button" className="absolute inset-0 bg-bank-dark/35 backdrop-blur-[1px]" onClick={() => !pending && onClose()} aria-label="Close add card dialog" />
      <form
        className="relative w-full max-w-[450px] rounded-2xl border border-bank-border bg-white p-6 shadow-[0_24px_65px_rgba(6,26,51,0.22)]"
        onSubmit={(event) => { event.preventDefault(); if (accountId && !pending) onSubmit({ accountId, cardType, ...(notes.trim() ? { notes: notes.trim() } : {}) }); }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bank-light text-bank-blue"><CreditCard size={19} /></span>
            <div><h2 id="add-card-title" className="text-base font-extrabold text-bank-navy">Apply for Card</h2><p className="mt-0.5 text-[11px] text-bank-muted">Submit a card request for bank approval.</p></div>
          </div>
          <button type="button" onClick={onClose} disabled={pending} className="flex h-8 w-8 items-center justify-center rounded-full text-bank-muted hover:bg-bank-page hover:text-bank-navy disabled:opacity-50" aria-label="Close"><X size={18} /></button>
        </div>

        <label className="mt-6 block text-[11px] font-bold text-bank-navy" htmlFor="card-account">Linked Account</label>
        <select id="card-account" value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={pending || activeAccounts.length === 0} className="mt-2 h-11 w-full rounded-xl border border-bank-border bg-white px-3 text-sm font-semibold text-bank-text outline-none transition focus:border-bank-blue focus:ring-2 focus:ring-bank-blue/10 disabled:bg-bank-page">
          {activeAccounts.length === 0 ? <option value="">No active account available</option> : null}
          {activeAccounts.map((account) => <option key={account.accountId} value={account.accountId}>{account.accountType} {account.maskedAccountNumber}</option>)}
        </select>

        <label className="mt-4 block text-[11px] font-bold text-bank-navy" htmlFor="new-card-type">Card Type</label>
        <select id="new-card-type" value={cardType} onChange={(event) => setCardType(event.target.value as CreateCardInput["cardType"])} disabled={pending} className="mt-2 h-11 w-full rounded-xl border border-bank-border bg-white px-3 text-sm font-semibold text-bank-text outline-none transition focus:border-bank-blue focus:ring-2 focus:ring-bank-blue/10">
          <option value="DEBIT">Debit Card</option>
          <option value="CREDIT">Credit Card</option>
        </select>
        <p className="mt-2 text-[10px] leading-4 text-bank-muted">Only the bank-issued masked number and card reference will be displayed.</p>
        <label className="mt-4 block text-[11px] font-bold text-bank-navy" htmlFor="card-request-notes">Notes (Optional)</label>
        <textarea id="card-request-notes" value={notes} onChange={event=>setNotes(event.target.value)} minLength={3} maxLength={500} disabled={pending} className="mt-2 min-h-20 w-full rounded-xl border border-bank-border p-3 text-xs outline-none focus:border-bank-blue" />

        {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700" role="alert">{getApiErrorMessage(error)}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={pending} className="h-10 rounded-xl border border-bank-border px-4 text-xs font-bold text-bank-navy hover:bg-bank-page disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={pending || !accountId} className="inline-flex h-10 min-w-[120px] items-center justify-center gap-2 rounded-xl bg-bank-blue px-4 text-xs font-bold text-white shadow-[0_7px_18px_rgba(11,99,229,0.22)] hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {pending ? <LoaderCircle size={15} className="animate-spin" /> : null}{pending ? "Submitting…" : "Apply for Card"}
          </button>
        </div>
      </form>
    </div>
  );
}
