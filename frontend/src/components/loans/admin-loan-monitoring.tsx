import { StatusBadge, dateTime, inr } from "@/components/admin/admin-ui";

export function AdminLoanMonitoring({ data }: { data: any }) {
  const schedule = data.emi_schedules ?? [];
  const paid = schedule.filter((emi: any) => emi.status === "PAID").length;
  const remaining = schedule.filter((emi: any) => ["PENDING", "PARTIALLY_PAID", "OVERDUE"].includes(emi.status)).length;
  const totalPaid = schedule.reduce((sum: number, emi: any) => sum + Number(emi.amount_paid), 0);
  const remainingPayable = schedule.reduce((sum: number, emi: any) => sum + (["PENDING", "PARTIALLY_PAID", "OVERDUE"].includes(emi.status) ? Math.max(Number(emi.total_emi) + Number(emi.late_fee) - Number(emi.amount_paid), 0) : 0), 0);
  const next = schedule.find((emi: any) => ["PENDING", "PARTIALLY_PAID", "OVERDUE"].includes(emi.status));
  return <>
    <div className="mt-5 grid grid-cols-4 gap-3 text-xs">
      <p>Customer<b className="block">{data.customers.first_name} {data.customers.last_name}</b></p>
      <p>Loan Account<b className="block">****{data.accounts.account_number.slice(-4)}</b></p>
      <p>Original Principal<b className="block">{inr.format(Number(data.principal_amount))}</b></p>
      <p>Outstanding<b className="block">{inr.format(Number(data.outstanding_principal))}</b></p>
      <p>Rate / Duration<b className="block">{Number(data.interest_rate).toFixed(2)}% · {data.duration_months} months</b></p>
      <p>EMI<b className="block">{inr.format(Number(data.emi_amount))}</b></p>
      <p>Paid / Remaining<b className="block">{paid} / {remaining}</b></p>
      <p>Total Paid<b className="block">{inr.format(totalPaid)}</b></p>
      <p>Remaining Payable<b className="block">{inr.format(remainingPayable)}</b></p>
      <p>Next Due<b className="block">{dateTime(next?.due_date)}</b></p>
      <p>Status<span className="block"><StatusBadge value={data.status}/></span></p>
    </div>
    <h3 className="mt-6 text-sm font-extrabold">EMI Schedule</h3>
    <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-[9px]"><thead className="bg-slate-50"><tr>{["#","Due","EMI","Principal","Interest","Paid","Remaining","Late Fee","Paid Date","Status"].map(value=><th className="px-2 py-2" key={value}>{value}</th>)}</tr></thead><tbody>{schedule.map((emi:any)=><tr className="border-t" key={emi.emi_schedule_id}><td className="px-2 py-2">{emi.installment_number}</td><td>{dateTime(emi.due_date)}</td><td>{inr.format(Number(emi.total_emi))}</td><td>{inr.format(Number(emi.principal_component))}</td><td>{inr.format(Number(emi.interest_component))}</td><td>{inr.format(Number(emi.amount_paid))}</td><td>{inr.format(Math.max(Number(emi.total_emi)+Number(emi.late_fee)-Number(emi.amount_paid),0))}</td><td>{inr.format(Number(emi.late_fee))}</td><td>{dateTime(emi.paid_at)}</td><td><StatusBadge value={emi.status}/></td></tr>)}</tbody></table></div>
  </>;
}
