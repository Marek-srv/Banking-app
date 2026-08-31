import { LoaderCircle, LogOut, X } from "lucide-react";

type LogoutConfirmationModalProps = {
  open: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function LogoutConfirmationModal({ open, pending, onCancel, onConfirm }: LogoutConfirmationModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-bank-dark/45 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="logout-confirmation-title">
      <button type="button" className="absolute inset-0" onClick={() => !pending && onCancel()} aria-label="Cancel logout" />
      <section className="relative z-10 w-[410px] rounded-2xl bg-white p-6 text-center text-bank-text shadow-[0_24px_70px_rgba(6,26,51,0.28)]">
        <button type="button" onClick={onCancel} disabled={pending} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-bank-muted hover:bg-bank-page disabled:opacity-50" aria-label="Close"><X size={17} /></button>
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600"><LogOut size={21} /></span>
        <h2 id="logout-confirmation-title" className="mt-4 text-lg font-extrabold text-bank-navy">Logout?</h2>
        <p className="mx-auto mt-2 max-w-[270px] text-[11px] leading-5 text-bank-muted">Are you sure you want to end your Internet Banking session?</p>
        <div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={onCancel} disabled={pending} className="h-10 rounded-xl border border-bank-border text-[11px] font-bold text-bank-navy hover:border-bank-blue disabled:opacity-50">Cancel</button><button type="button" onClick={onConfirm} disabled={pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 text-[11px] font-bold text-white hover:bg-red-700 disabled:opacity-60">{pending ? <><LoaderCircle size={14} className="animate-spin" /> Logging out…</> : <><LogOut size={14} /> Logout</>}</button></div>
      </section>
    </div>
  );
}
