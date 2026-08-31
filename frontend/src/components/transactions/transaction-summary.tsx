import { ArrowDownLeft, ArrowUpRight, TrendingUp } from "lucide-react";

import { transactionMoneyFormatter } from "@/components/transactions/transaction-types";

type TransactionSummaryProps = {
  moneyIn: number;
  moneyOut: number;
};

export function TransactionSummary({ moneyIn, moneyOut }: TransactionSummaryProps) {
  const netFlow = moneyIn - moneyOut;
  const netPositive = netFlow >= 0;

  const cards = [
    { label: "MONEY IN", value: transactionMoneyFormatter.format(moneyIn), icon: ArrowDownLeft, colors: "bg-emerald-50 text-emerald-600", valueColor: "text-emerald-700" },
    { label: "MONEY OUT", value: transactionMoneyFormatter.format(moneyOut), icon: ArrowUpRight, colors: "bg-red-50 text-red-500", valueColor: "text-red-600" },
    { label: "NET FLOW", value: `${netPositive ? "+" : "−"}${transactionMoneyFormatter.format(Math.abs(netFlow))}`, icon: TrendingUp, colors: "bg-blue-50 text-bank-blue", valueColor: netPositive ? "text-bank-blue" : "text-red-600" },
  ];

  return (
    <section className="grid grid-cols-3 gap-3" aria-label="Filtered transaction summary">
      {cards.map(({ label, value, icon: Icon, colors, valueColor }) => (
        <article key={label} className="flex h-[88px] items-center rounded-2xl border border-bank-border/90 bg-white px-4 shadow-[0_5px_18px_rgba(11,31,58,0.045)]">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors}`}><Icon size={19} /></span>
          <div className="ml-3.5">
            <p className="text-[10px] font-bold tracking-[0.13em] text-bank-muted">{label}</p>
            <p className={`mt-1 text-xl font-extrabold tracking-[-0.025em] ${valueColor}`}>{value}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
