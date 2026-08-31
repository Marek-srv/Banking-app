import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Download, LoaderCircle, ReceiptText, X } from "lucide-react";

import { documentApi, saveDownloadedDocument } from "@/api/documentApi";
import type { TransactionView } from "@/components/transactions/transaction-types";
import { transactionMoneyFormatter } from "@/components/transactions/transaction-types";
import { getApiErrorMessage } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

type TransactionDrawerProps = {
  transaction: TransactionView | null;
  detailsLoading?: boolean;
  detailsError?: boolean;
  onRetry?: () => void;
  onClose: () => void;
};

function displayValue(value: string) {
  const normalized = value.toLowerCase().replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function fullDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(value)).replace(",", " ·");
}

export function TransactionDrawer({ transaction, detailsLoading = false, detailsError = false, onRetry, onClose }: TransactionDrawerProps) {
  const receiptMutation = useMutation({
    mutationFn: ({ transactionId, referenceNumber }: { transactionId: string; referenceNumber: string }) => documentApi.downloadReceipt(transactionId, referenceNumber),
    onSuccess: saveDownloadedDocument,
  });

  useEffect(() => {
    if (!transaction) return;
    receiptMutation.reset();
  }, [transaction?.id]);

  useEffect(() => {
    if (!transaction) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !receiptMutation.isPending) onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, receiptMutation.isPending, transaction]);

  if (!transaction) return null;
  const credit = transaction.direction === "credit";
  const downloadReceipt = () => {
    if (!receiptMutation.isPending) receiptMutation.mutate({ transactionId: transaction.id, referenceNumber: transaction.referenceNumber });
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="transaction-drawer-title">
      <button type="button" className="absolute inset-0 bg-bank-dark/30 backdrop-blur-[1px]" onClick={() => !receiptMutation.isPending && onClose()} aria-label="Close transaction details" />
      <aside className="absolute inset-y-0 right-0 flex w-[430px] flex-col bg-white shadow-[-18px_0_45px_rgba(6,26,51,0.18)]">
        <div className="flex h-[70px] items-center justify-between border-b border-bank-border px-6"><h2 id="transaction-drawer-title" className="text-xs font-extrabold tracking-[0.12em] text-bank-navy">TRANSACTION DETAILS</h2><button type="button" onClick={onClose} disabled={receiptMutation.isPending} className="flex h-9 w-9 items-center justify-center rounded-full text-bank-muted hover:bg-bank-page hover:text-bank-navy disabled:opacity-50" aria-label="Close"><X size={19} /></button></div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {detailsLoading ? <div className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-bank-light px-3 py-2 text-[10px] font-semibold text-bank-blue" role="status"><LoaderCircle size={14} className="animate-spin" /> Loading verified transaction details…</div> : null}
          {detailsError ? <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-red-50 px-3 py-2 text-[10px] font-semibold text-red-700" role="alert"><span className="inline-flex items-center gap-2"><AlertCircle size={14} /> Details could not be refreshed.</span>{onRetry ? <button type="button" onClick={onRetry} className="font-bold underline">Retry</button> : null}</div> : null}
          <div className="border-b border-bank-border pb-5 text-center"><span className={cn("mx-auto flex h-12 w-12 items-center justify-center rounded-2xl", credit ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500")}><ReceiptText size={21} /></span><p className="mt-3 text-base font-extrabold text-bank-navy">{transaction.description}</p><p className={cn("mt-1.5 text-2xl font-extrabold", credit ? "text-emerald-600" : "text-red-600")}>{credit ? "+" : "−"}{transactionMoneyFormatter.format(transaction.amount)}</p></div>
          <dl className="divide-y divide-bank-border/70">{[
            ["Reference", transaction.referenceNumber], ["Date / Time", fullDate(transaction.initiatedAt)], ["Type", displayValue(transaction.type)], ["Status", displayValue(transaction.status)], ["From", transaction.fromLabel], ["To", transaction.toLabel], ["Description", transaction.description], ["Category", transaction.category], ["Remarks", transaction.remarks],
          ].map(([label, value]) => <div key={label} className="grid grid-cols-[115px_1fr] gap-3 py-3.5"><dt className="text-[11px] font-medium text-bank-muted">{label}</dt><dd className={cn("break-words text-right text-[11px] font-semibold text-bank-text", label === "Status" && transaction.status === "COMPLETED" && "text-emerald-700")}>{value}</dd></div>)}</dl>
        </div>
        <div className="border-t border-bank-border p-5">{receiptMutation.isError ? <p className="mb-2 text-center text-[10px] text-red-600" role="alert">{getApiErrorMessage(receiptMutation.error)}</p> : null}<button type="button" onClick={downloadReceipt} disabled={receiptMutation.isPending} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-bank-blue text-xs font-bold text-white shadow-[0_8px_20px_rgba(11,99,229,0.25)] hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"><Download size={17} /> {receiptMutation.isPending ? "Generating Receipt…" : "Download Receipt"}</button></div>
      </aside>
    </div>
  );
}
