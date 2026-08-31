import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, LoaderCircle, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";

import { beneficiaryApi, type Beneficiary } from "@/api/beneficiaryApi";
import { getApiErrorMessage } from "@/lib/apiClient";

type BeneficiaryDrawerProps = {
  beneficiary: Beneficiary | null;
  onClose: () => void;
  onTransfer: (beneficiary: Beneficiary) => void;
};

export function BeneficiaryDrawer({ beneficiary, onClose, onTransfer }: BeneficiaryDrawerProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const queryClient = useQueryClient();
  const removeMutation = useMutation({
    mutationFn: beneficiaryApi.removeBeneficiary,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["beneficiaries"] });
      setConfirmRemove(false);
      onClose();
    },
  });

  useEffect(() => {
    if (!beneficiary) { setConfirmRemove(false); removeMutation.reset(); return; }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !removeMutation.isPending) onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [beneficiary, onClose, removeMutation.isPending]);

  if (!beneficiary) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="beneficiary-details-title">
      <button type="button" className="absolute inset-0 bg-bank-dark/30 backdrop-blur-[1px]" onClick={() => !removeMutation.isPending && onClose()} aria-label="Close beneficiary details" />
      <aside className="absolute inset-y-0 right-0 flex w-[430px] flex-col bg-white shadow-[-18px_0_45px_rgba(6,26,51,0.18)]">
        <header className="flex h-[70px] items-center justify-between border-b border-bank-border px-6"><h2 id="beneficiary-details-title" className="text-xs font-extrabold tracking-[0.12em] text-bank-navy">BENEFICIARY DETAILS</h2><button type="button" onClick={onClose} disabled={removeMutation.isPending} className="flex h-9 w-9 items-center justify-center rounded-full text-bank-muted hover:bg-bank-page hover:text-bank-navy disabled:opacity-50" aria-label="Close"><X size={19} /></button></header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="border-b border-bank-border pb-5 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-bank-light text-bank-blue"><UserRound size={23} /></span><h3 className="mt-3 text-lg font-extrabold text-bank-navy">{beneficiary.beneficiaryName}</h3>{beneficiary.nickname ? <p className="mt-1 text-[10px] text-bank-muted">{beneficiary.nickname}</p> : null}</div>
          <dl className="divide-y divide-bank-border/70">
            {[
              ["Bank", beneficiary.bankName],
              ["Account", beneficiary.maskedAccountNumber],
              ["IFSC", beneficiary.ifscCode],
              ["Nickname", beneficiary.nickname ?? "Not provided"],
              ["Status", beneficiary.status],
            ].map(([label, value]) => <div key={label} className="grid grid-cols-[105px_1fr] gap-4 py-3.5"><dt className="text-[11px] font-medium text-bank-muted">{label}</dt><dd className={`text-right text-[11px] font-bold ${label === "Status" ? "text-emerald-700" : "text-bank-text"}`}>{value}</dd></div>)}
          </dl>

          {confirmRemove ? (
            <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4">
              <div className="flex gap-3"><AlertTriangle size={18} className="shrink-0 text-red-600" /><div><p className="text-xs font-bold text-red-800">Remove this beneficiary?</p><p className="mt-1 text-[10px] leading-4 text-red-700">You’ll need to add the bank details again before making another transfer.</p></div></div>
              {removeMutation.isError ? <p className="mt-3 text-[10px] font-medium text-red-700">{getApiErrorMessage(removeMutation.error)}</p> : null}
              <div className="mt-4 flex justify-end gap-2"><button type="button" disabled={removeMutation.isPending} onClick={() => { setConfirmRemove(false); removeMutation.reset(); }} className="h-8 rounded-lg border border-red-200 px-3 text-[10px] font-bold text-red-700 disabled:opacity-50">Cancel</button><button type="button" disabled={removeMutation.isPending} onClick={() => removeMutation.mutate(beneficiary.beneficiaryId)} className="inline-flex h-8 min-w-[92px] items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 text-[10px] font-bold text-white disabled:opacity-60">{removeMutation.isPending ? <LoaderCircle size={13} className="animate-spin" /> : <Trash2 size={13} />} Confirm</button></div>
            </div>
          ) : null}
        </div>

        <footer className="grid grid-cols-2 gap-3 border-t border-bank-border p-5">
          <button type="button" onClick={() => onTransfer(beneficiary)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-bank-blue text-[11px] font-bold text-white shadow-[0_8px_20px_rgba(11,99,229,0.22)] hover:bg-blue-700"><ArrowUpRight size={16} /> Transfer Money</button>
          <button type="button" onClick={() => setConfirmRemove(true)} disabled={removeMutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={15} /> Remove Beneficiary</button>
        </footer>
      </aside>
    </div>
  );
}
