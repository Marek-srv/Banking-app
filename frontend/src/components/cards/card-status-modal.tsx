import { AlertTriangle, LoaderCircle, ShieldCheck, X } from "lucide-react";

import type { BankCard } from "@/api/cardApi";
import { getApiErrorMessage } from "@/lib/apiClient";

type CardStatusModalProps = {
  card: BankCard | null;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onConfirm: () => void;
};

export function CardStatusModal({ card, pending, error, onClose, onConfirm }: CardStatusModalProps) {
  if (!card) return null;
  const unblock = card.cardStatus === "BLOCKED";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bank-dark/40 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="card-status-title">
      <button type="button" className="absolute inset-0" onClick={() => !pending && onClose()} aria-label="Close card confirmation" />
      <section className="relative z-10 w-[420px] rounded-2xl bg-white p-6 text-center shadow-[0_24px_70px_rgba(6,26,51,0.25)]">
        <button type="button" onClick={onClose} disabled={pending} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-bank-muted hover:bg-bank-page disabled:opacity-50" aria-label="Close"><X size={17} /></button>
        <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${unblock ? "bg-blue-50 text-bank-blue" : "bg-red-50 text-red-600"}`}>{unblock ? <ShieldCheck size={22} /> : <AlertTriangle size={22} />}</span>
        <h2 id="card-status-title" className="mt-4 text-base font-extrabold text-bank-navy">{unblock ? "Unblock this card?" : "Temporarily block this card?"}</h2>
        <p className="mt-2 text-[11px] leading-5 text-bank-muted">{unblock ? "Payments will be enabled again for card ending " : "Online and contactless payments will be paused for card ending "}<strong className="text-bank-text">{card.lastFour}</strong>.</p>
        {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[10px] font-medium text-red-700">{getApiErrorMessage(error)}</p> : null}
        <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={pending} onClick={onClose} className="h-10 rounded-xl border border-bank-border text-[11px] font-bold text-bank-navy disabled:opacity-50">Cancel</button><button type="button" disabled={pending} onClick={onConfirm} className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl text-[11px] font-bold text-white disabled:opacity-60 ${unblock ? "bg-bank-blue" : "bg-red-600"}`}>{pending ? <><LoaderCircle size={14} className="animate-spin" /> Updating…</> : unblock ? "Confirm Unblock" : "Confirm Block"}</button></div>
      </section>
    </div>
  );
}
