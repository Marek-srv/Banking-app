import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

import type { BankCard } from "@/api/cardApi";
import { BankCardVisual } from "@/components/cards/bank-card-visual";

type CardCarouselProps = {
  cards: BankCard[];
  selectedCardId?: string;
  cardholderName: string;
  onSelect: (cardId: string) => void;
};

export function CardCarousel({ cards, selectedCardId, cardholderName, onSelect }: CardCarouselProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: -1 | 1) => carouselRef.current?.scrollBy({ left: direction * 290, behavior: "smooth" });

  return (
    <section aria-labelledby="my-cards-heading">
      <div className="mb-3 flex items-center justify-between"><div><h1 id="my-cards-heading" className="text-[13px] font-extrabold tracking-[0.13em] text-bank-navy">MY CARDS</h1><p className="mt-1 text-[10px] text-bank-muted">Select a card to view details and controls</p></div>{cards.length > 1 ? <div className="flex gap-2"><button type="button" onClick={() => scroll(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-bank-border bg-white text-bank-navy shadow-sm hover:border-bank-blue hover:text-bank-blue" aria-label="Previous cards"><ChevronLeft size={16} /></button><button type="button" onClick={() => scroll(1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-bank-border bg-white text-bank-navy shadow-sm hover:border-bank-blue hover:text-bank-blue" aria-label="Next cards"><ChevronRight size={16} /></button></div> : null}</div>
      <div ref={carouselRef} className="flex gap-4 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cards.map((card) => <button key={card.cardId} type="button" onClick={() => onSelect(card.cardId)} className="rounded-2xl text-left" aria-label={`Select ${card.cardType.toLowerCase()} card ending ${card.lastFour}`}><BankCardVisual card={card} cardholderName={cardholderName} compact selected={card.cardId === selectedCardId} /></button>)}
      </div>
    </section>
  );
}
