import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

import type { Account } from "@/api/accountApi";
import { cn } from "@/lib/utils";

type AccountCarouselProps = {
  accounts: Account[];
  selectedAccountId?: string;
  onSelect: (accountId: string) => void;
  onViewDetails: (accountId: string) => void;
};

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function displayAccountType(type: string) {
  const normalized = type.toLowerCase().replace(/_/g, " ");
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)} Account`;
}

export function AccountCarousel({ accounts, selectedAccountId, onSelect, onViewDetails }: AccountCarouselProps) {
  const carouselRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: -1 | 1) => {
    carouselRef.current?.scrollBy({ left: direction * 310, behavior: "smooth" });
  };

  return (
    <section aria-labelledby="my-accounts-heading">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 id="my-accounts-heading" className="text-[13px] font-extrabold tracking-[0.13em] text-bank-navy">MY ACCOUNTS</h2>
          <p className="mt-1 text-[11px] text-bank-muted">Select an account to view its details</p>
        </div>
        {accounts.length > 1 ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => scroll(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-bank-border bg-white text-bank-navy shadow-sm transition hover:border-bank-blue hover:text-bank-blue" aria-label="Previous accounts">
              <ChevronLeft size={17} />
            </button>
            <button type="button" onClick={() => scroll(1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-bank-border bg-white text-bank-navy shadow-sm transition hover:border-bank-blue hover:text-bank-blue" aria-label="Next accounts">
              <ChevronRight size={17} />
            </button>
          </div>
        ) : null}
      </div>

      <div ref={carouselRef} className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {accounts.map((account) => {
          const selected = account.accountId === selectedAccountId;
          const isLoan = account.accountType === "LOAN";
          const displayedBalance = isLoan ? account.currentBalance : account.availableBalance;
          return (
            <article
              key={account.accountId}
              onClick={() => onSelect(account.accountId)}
              className={cn(
                "relative min-w-[270px] cursor-pointer overflow-hidden rounded-2xl border bg-white px-4 py-3.5 shadow-[0_5px_18px_rgba(11,31,58,0.05)] transition",
                selected ? "border-bank-blue ring-2 ring-bank-blue/10" : "border-bank-border hover:border-blue-200 hover:shadow-[0_8px_24px_rgba(11,31,58,0.08)]",
              )}
            >
              {selected ? <span className="absolute inset-y-0 left-0 w-1 bg-bank-blue" /> : null}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold text-bank-navy">{displayAccountType(account.accountType)}</p>
                  <p className="mt-1 text-[11px] font-medium tracking-[0.08em] text-bank-muted">{account.maskedAccountNumber}</p>
                </div>
                <span className={cn("rounded-full px-2 py-1 text-[9px] font-bold tracking-wide", account.status === "ACTIVE" || account.status === "LOAN" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{account.status}</span>
              </div>
              <p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-bank-muted">{isLoan ? "Outstanding Balance" : "Available Balance"}</p>
              <p className="mt-0.5 text-xl font-extrabold tracking-[-0.02em] text-bank-text">{moneyFormatter.format(displayedBalance)}</p>
              <button
                type="button"
                className="mt-2 text-[11px] font-bold text-bank-blue hover:underline"
                onClick={(event) => { event.stopPropagation(); onViewDetails(account.accountId); }}
              >View Details</button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export { displayAccountType, moneyFormatter };
