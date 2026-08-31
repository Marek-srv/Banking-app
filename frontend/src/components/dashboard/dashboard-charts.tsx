import { Tags } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { compactInrFormatter, inrFormatter } from "@/lib/banking-format";

export type MoneyMovementPoint = { key: string; day: string; moneyIn: number; moneyOut: number };
export type SpendingCategoryPoint = { name: string; value: number; color: string };

const tooltipStyle = { borderRadius: "10px", border: "1px solid #E4E7EC", boxShadow: "0 8px 24px rgba(11,31,58,0.10)", fontSize: "11px" };

export function MoneyMovementChart({ data }: { data: MoneyMovementPoint[] }) {
  return (
    <article className="rounded-2xl border border-bank-border/80 bg-white p-4 shadow-[0_4px_16px_rgba(11,31,58,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-sm font-bold text-bank-navy">Money Movement</h2><p className="mt-0.5 text-[10px] text-bank-muted">Last 10 days · amounts in ₹</p></div><div className="flex items-center gap-3 text-[10px] font-medium text-bank-muted"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Money In</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" />Money Out</span></div></div>
      <div className="mt-3 h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%"><BarChart data={data} barGap={3} barCategoryGap="25%" margin={{ top: 4, right: 2, bottom: 0, left: -25 }}><CartesianGrid vertical={false} stroke="#EEF1F5" strokeDasharray="3 3" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#98A2B3", fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#98A2B3", fontSize: 9 }} tickFormatter={(value) => Number(value) === 0 ? "0" : compactInrFormatter.format(Number(value)).replace("₹", "")} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#F6F8FB" }} formatter={(value) => [inrFormatter.format(Number(value)), ""]} /><Bar dataKey="moneyIn" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={14} /><Bar dataKey="moneyOut" fill="#F87171" radius={[4, 4, 0, 0]} maxBarSize={14} /></BarChart></ResponsiveContainer>
      </div>
    </article>
  );
}

export function SpendingCategoriesChart({ data }: { data: SpendingCategoryPoint[] }) {
  const total = data.reduce((sum, category) => sum + category.value, 0);
  return (
    <article className="rounded-2xl border border-bank-border/80 bg-white p-4 shadow-[0_4px_16px_rgba(11,31,58,0.04)]">
      <div><h2 className="text-sm font-bold text-bank-navy">Spending Categories</h2><p className="mt-0.5 text-[10px] text-bank-muted">Completed outgoing transactions this month</p></div>
      {data.length === 0 ? <div className="flex h-[146px] flex-col items-center justify-center text-center"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bank-page text-bank-muted"><Tags size={18} /></span><p className="mt-2 text-[11px] font-semibold text-bank-navy">Category data unavailable</p><p className="mt-1 max-w-[210px] text-[9px] leading-4 text-bank-muted">The transaction API does not currently provide categorized activity.</p></div> : (
        <div className="mt-1 flex items-center gap-1"><div className="relative h-[145px] min-w-[135px] flex-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" innerRadius={42} outerRadius={62} paddingAngle={3} stroke="none">{data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(value) => [inrFormatter.format(Number(value)), "Spent"]} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-[10px] text-bank-muted">Spent</span><span className="text-sm font-bold text-bank-navy">{compactInrFormatter.format(total)}</span></div></div><div className="w-[110px] space-y-2">{data.map((category) => <div key={category.name} className="flex items-center gap-1.5 text-[10px]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} /><span className="min-w-0 flex-1 truncate text-bank-muted">{category.name}</span><span className="font-semibold text-bank-navy">{Math.round((category.value / total) * 100)}%</span></div>)}</div></div>
      )}
    </article>
  );
}
