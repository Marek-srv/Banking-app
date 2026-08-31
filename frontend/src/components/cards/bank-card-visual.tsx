import { Wifi } from "lucide-react";

import type { BankCard } from "@/api/cardApi";
import { cn } from "@/lib/utils";

type BankCardVisualProps = {
  card: BankCard;
  cardholderName: string;
  compact?: boolean;
  selected?: boolean;
};

export function BankCardVisual({ card, cardholderName, compact = false, selected = false }: BankCardVisualProps) {
  const blocked = card.cardStatus === "BLOCKED";
  return (
    <div className={cn(
      "relative shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#102d51] via-bank-dark to-[#020c18] text-white shadow-[0_15px_32px_rgba(6,26,51,0.25)] transition",
      compact ? "h-[150px] w-[268px] p-4" : "h-[210px] w-[365px] p-5",
      blocked && "grayscale opacity-55",
      selected && "ring-2 ring-bank-blue ring-offset-2 ring-offset-bank-page",
    )}>
      <span className="absolute -right-14 -top-16 h-40 w-40 rounded-full border border-white/10" />
      <span className="absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-blue-500/10 blur-sm" />
      <div className="relative flex items-start justify-between">
        <div className="flex items-baseline gap-1"><span className={cn("font-black text-blue-300", compact ? "text-2xl" : "text-3xl")}>π</span><span className={cn("font-bold", compact ? "text-[11px]" : "text-sm")}>Bank</span></div>
        <div className="text-right"><p className={cn("font-black italic tracking-[-0.04em]", compact ? "text-base" : "text-xl")}>{card.network}</p><p className="mt-0.5 text-[8px] font-bold tracking-[0.15em] text-blue-200">{card.cardType}</p></div>
      </div>
      <div className={cn("relative flex items-center", compact ? "mt-4" : "mt-6")}>
        <span className={cn("grid grid-cols-2 overflow-hidden rounded-md border border-amber-200/80 bg-gradient-to-br from-amber-200 to-amber-500", compact ? "h-7 w-9" : "h-9 w-12")}><i className="border-b border-r border-amber-700/30" /><i className="border-b border-amber-700/30" /><i className="border-r border-amber-700/30" /><i /></span>
        <Wifi size={compact ? 20 : 24} className="ml-2 rotate-90 text-white/75" />
        {blocked ? <span className="ml-auto rounded-full border border-white/20 bg-black/30 px-2 py-1 text-[8px] font-bold tracking-wider">BLOCKED</span> : null}
      </div>
      <p className={cn("relative font-semibold tracking-[0.16em] text-slate-100", compact ? "mt-3 text-[13px]" : "mt-5 text-lg")}>{card.maskedCardNumber}</p>
      <div className={cn("relative flex items-end justify-between", compact ? "mt-3" : "mt-4")}><div><p className="text-[7px] uppercase tracking-[0.15em] text-slate-400">Cardholder</p><p className={cn("mt-0.5 font-semibold tracking-[0.08em]", compact ? "text-[9px]" : "text-[11px]")}>{cardholderName}</p></div>{!compact ? <p className="text-[8px] text-slate-400">Secure synthetic card</p> : null}</div>
    </div>
  );
}
