import type { Account } from "@/api/accountApi";
import type { BankCard } from "@/api/cardApi";
import { BankCardVisual } from "@/components/cards/bank-card-visual";

type SelectedCardPanelProps = {
  card: BankCard;
  linkedAccount?: Account;
  cardholderName: string;
};

function display(value: string) {
  const normalized = value.toLowerCase().replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function accountLabel(account?: Account) {
  if (!account) return "Linked account unavailable";
  return `${display(account.accountType)} ${account.maskedAccountNumber}`;
}

export function SelectedCardPanel({ card, linkedAccount, cardholderName }: SelectedCardPanelProps) {
  return (
    <section className="rounded-2xl border border-bank-border/90 bg-white p-5 shadow-[0_6px_22px_rgba(11,31,58,0.05)]" aria-label="Selected card details">
      <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-bank-blue">Selected Card</p><h2 className="mt-1 text-base font-extrabold text-bank-navy">{display(card.cardType)} Card <span className="ml-1 text-xs tracking-[0.06em] text-bank-muted">{card.shortMaskedNumber}</span></h2></div><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold tracking-wide ${card.cardStatus === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{card.cardStatus}</span></div>
      <div className="flex items-center gap-6">
        <BankCardVisual card={card} cardholderName={cardholderName} />
        <dl className="min-w-0 flex-1 divide-y divide-bank-border/70">
          {[
            ["Card Type", display(card.cardType)],
            ["Network", card.network],
            ["Card Number", card.shortMaskedNumber],
            ["Linked Account", accountLabel(linkedAccount)],
            ["Status", display(card.cardStatus)],
          ].map(([label, value]) => <div key={label} className="grid grid-cols-[100px_1fr] gap-3 py-2.5"><dt className="text-[10px] text-bank-muted">{label}</dt><dd className={`truncate text-right text-[11px] font-bold ${label === "Status" && card.cardStatus === "ACTIVE" ? "text-emerald-700" : "text-bank-text"}`} title={value}>{value}</dd></div>)}
        </dl>
      </div>
    </section>
  );
}

export { accountLabel };
