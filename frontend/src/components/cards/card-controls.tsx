import { Ban, LockKeyhole, Radio, ShoppingBag } from "lucide-react";

import type { BankCard } from "@/api/cardApi";

type CardControlsProps = {
  card: BankCard;
  onlinePayments: boolean;
  contactless: boolean;
  onOnlinePaymentsChange: () => void;
  onContactlessChange: () => void;
  onChangeBlockStatus: () => void;
};

function Toggle({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
  return <button type="button" onClick={onToggle} className={`relative h-5 w-9 rounded-full transition ${enabled ? "bg-bank-blue" : "bg-slate-300"}`} role="switch" aria-checked={enabled} aria-label={label}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${enabled ? "left-[18px]" : "left-0.5"}`} /></button>;
}

export function CardControls(props: CardControlsProps) {
  const blocked = props.card.cardStatus === "BLOCKED";
  return (
    <section className="rounded-2xl border border-bank-border/90 bg-white p-4 shadow-[0_5px_18px_rgba(11,31,58,0.045)]" aria-labelledby="card-controls-heading">
      <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-bank-light text-bank-blue"><LockKeyhole size={16} /></span><div><h2 id="card-controls-heading" className="text-xs font-extrabold text-bank-navy">Card Controls</h2><p className="mt-0.5 text-[9px] text-bank-muted">Manage this card instantly</p></div></div>
      <div className="mt-3 divide-y divide-bank-border/70">
        <div className="flex h-10 items-center gap-2.5"><ShoppingBag size={15} className="text-bank-muted" /><span className="flex-1 text-[11px] font-semibold text-bank-text">Online Payments</span><span className="text-[9px] font-bold text-bank-blue">{props.onlinePayments ? "ON" : "OFF"}</span><Toggle enabled={props.onlinePayments} onToggle={props.onOnlinePaymentsChange} label="Toggle online payments" /></div>
        <div className="flex h-10 items-center gap-2.5"><Radio size={15} className="text-bank-muted" /><span className="flex-1 text-[11px] font-semibold text-bank-text">Contactless</span><span className="text-[9px] font-bold text-bank-blue">{props.contactless ? "ON" : "OFF"}</span><Toggle enabled={props.contactless} onToggle={props.onContactlessChange} label="Toggle contactless payments" /></div>
      </div>
      <button type="button" onClick={props.onChangeBlockStatus} className={`mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-[10px] font-bold transition ${blocked ? "bg-bank-blue text-white hover:bg-blue-700" : "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"}`}><Ban size={15} /> {blocked ? "Unblock Card" : "Temporarily Block Card"}</button>
    </section>
  );
}
