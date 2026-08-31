import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { loanApi } from "@/api/loanApi";
import { inr } from "@/components/admin/admin-ui";
import { LoanProductFields } from "./loan-product-fields";

export function LoanApplicationFields() {
  const [amount, setAmount] = useState(200000);
  const [duration, setDuration] = useState(24);
  const valid = amount > 0 && amount <= 1_000_000_000 && Number.isInteger(duration) && duration >= 1 && duration <= 60;
  const preview = useQuery({ queryKey: ["loan-preview", amount, duration], queryFn: () => loanApi.preview(amount, duration), enabled: valid, staleTime: 60_000 });
  return <>
    <LoanProductFields />
    <label className="block text-[11px] font-bold text-bank-navy">Requested Amount<input name="requestedAmount" type="number" value={amount} onChange={event=>setAmount(Number(event.target.value))} min={0.01} max={1_000_000_000} step="0.01" required className="mt-1.5 h-10 w-full rounded-lg border border-bank-border px-3 text-xs font-normal"/></label>
    <label className="block text-[11px] font-bold text-bank-navy">Duration (months)<input name="durationMonths" type="number" value={duration} onChange={event=>setDuration(Number(event.target.value))} min={1} max={60} step={1} required className="mt-1.5 h-10 w-full rounded-lg border border-bank-border px-3 text-xs font-normal"/></label>
    <div className="grid grid-cols-2 gap-3 rounded-xl bg-bank-light p-3 text-xs"><p className="text-bank-muted">Estimated Interest Rate<b className="block text-bank-navy">{preview.data ? `${preview.data.interestRate.toFixed(2)}% p.a.` : "—"}</b></p><p className="text-bank-muted">Estimated EMI<b className="block text-bank-navy">{preview.data ? inr.format(preview.data.estimatedEmi) : "—"}</b></p></div>
  </>;
}
