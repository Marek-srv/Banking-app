import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText, LoaderCircle, X } from "lucide-react";

import type { Account } from "@/api/accountApi";
import { documentApi, saveDownloadedDocument, type StatementFormat } from "@/api/documentApi";
import { titleCaseBankingValue } from "@/lib/banking-format";
import { getApiErrorMessage } from "@/lib/apiClient";

type StatementModalProps = {
  open: boolean;
  accounts: Account[];
  initialAccountId?: string;
  onClose: () => void;
};

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function StatementModal({ open, accounts, initialAccountId, onClose }: StatementModalProps) {
  const today = isoDate(new Date());
  const monthStart = isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [format, setFormat] = useState<StatementFormat>("pdf");
  const [validationError, setValidationError] = useState("");
  const accountKey = accounts.map((account) => account.accountId).join("|");
  const mutation = useMutation({
    mutationFn: documentApi.downloadStatement,
    onSuccess: (document) => {
      saveDownloadedDocument(document);
      onClose();
    },
  });

  useEffect(() => {
    if (!open) return;
    setAccountId(initialAccountId && accounts.some((account) => account.accountId === initialAccountId) ? initialAccountId : accounts[0]?.accountId ?? "");
    setFrom(monthStart);
    setTo(today);
    setFormat("pdf");
    setValidationError("");
    mutation.reset();
  }, [accountKey, initialAccountId, monthStart, open, today]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !mutation.isPending) onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mutation.isPending, onClose, open]);

  if (!open) return null;

  const download = () => {
    setValidationError("");
    mutation.reset();
    if (!accountId) { setValidationError("Select an account"); return; }
    if (!from || !to || from > to) { setValidationError("Choose a valid statement date range"); return; }
    if ((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000 > 366) { setValidationError("Statement period cannot exceed 366 days"); return; }
    mutation.mutate({ accountId, from, to, format });
  };

  const error = validationError || (mutation.isError ? getApiErrorMessage(mutation.error) : "");
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="statement-modal-title">
      <button type="button" className="absolute inset-0 bg-bank-dark/40 backdrop-blur-[2px]" onClick={() => !mutation.isPending && onClose()} aria-label="Close statement dialog" />
      <section className="relative w-[520px] rounded-2xl border border-white/80 bg-white shadow-[0_24px_65px_rgba(6,26,51,0.24)]">
        <div className="flex items-center justify-between border-b border-bank-border px-6 py-4"><div><h2 id="statement-modal-title" className="text-lg font-extrabold text-bank-navy">Download Statement</h2><p className="mt-0.5 text-[10px] text-bank-muted">Generate a secure account statement from trusted banking records.</p></div><button type="button" onClick={onClose} disabled={mutation.isPending} className="flex h-9 w-9 items-center justify-center rounded-full text-bank-muted hover:bg-bank-page disabled:opacity-50" aria-label="Close"><X size={19} /></button></div>
        <div className="space-y-5 px-6 py-5">
          <label className="block text-xs font-bold text-bank-navy">Account<select value={accountId} onChange={(event) => { setAccountId(event.target.value); setValidationError(""); }} className="mt-2 h-11 w-full rounded-xl border border-bank-border bg-white px-3 text-xs font-semibold text-bank-text outline-none focus:border-bank-blue focus:ring-2 focus:ring-blue-100" disabled={mutation.isPending}>{accounts.length === 0 ? <option value="">No accounts available</option> : accounts.map((account) => <option key={account.accountId} value={account.accountId}>{titleCaseBankingValue(account.accountType)} {account.maskedAccountNumber}</option>)}</select></label>
          <fieldset><legend className="text-xs font-bold text-bank-navy">Date Range</legend><div className="mt-2 grid grid-cols-2 gap-3"><label className="text-[10px] font-semibold text-bank-muted">From<input type="date" value={from} max={to || today} onChange={(event) => { setFrom(event.target.value); setValidationError(""); }} className="mt-1 h-11 w-full rounded-xl border border-bank-border px-3 text-xs text-bank-text outline-none focus:border-bank-blue" disabled={mutation.isPending} /></label><label className="text-[10px] font-semibold text-bank-muted">To<input type="date" value={to} min={from} max={today} onChange={(event) => { setTo(event.target.value); setValidationError(""); }} className="mt-1 h-11 w-full rounded-xl border border-bank-border px-3 text-xs text-bank-text outline-none focus:border-bank-blue" disabled={mutation.isPending} /></label></div></fieldset>
          <fieldset><legend className="text-xs font-bold text-bank-navy">Format</legend><div className="mt-2 grid grid-cols-2 gap-3">{(["pdf", "csv"] as StatementFormat[]).map((value) => { const selected = format === value; const Icon = value === "pdf" ? FileText : FileSpreadsheet; return <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 ${selected ? "border-bank-blue bg-bank-light" : "border-bank-border"}`}><input type="radio" name="statement-format" value={value} checked={selected} onChange={() => setFormat(value)} disabled={mutation.isPending} className="accent-bank-blue" /><Icon size={17} className={selected ? "text-bank-blue" : "text-bank-muted"} /><span className="text-xs font-bold uppercase text-bank-navy">{value}</span></label>; })}</div></fieldset>
          <p className="min-h-4 text-xs text-red-600" role={error ? "alert" : undefined}>{error}</p>
        </div>
        <div className="flex justify-end gap-3 border-t border-bank-border px-6 py-4"><button type="button" onClick={onClose} disabled={mutation.isPending} className="h-10 rounded-xl border border-bank-border px-5 text-xs font-bold text-bank-navy hover:border-bank-blue disabled:opacity-50">Cancel</button><button type="button" onClick={download} disabled={mutation.isPending || accounts.length === 0} className="inline-flex h-10 min-w-32 items-center justify-center gap-2 rounded-xl bg-bank-blue px-5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{mutation.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}{mutation.isPending ? "Generating…" : "Download"}</button></div>
      </section>
    </div>
  );
}
