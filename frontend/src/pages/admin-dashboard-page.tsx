import { useQuery } from "@tanstack/react-query";
import { Activity, HandCoins, ReceiptText, ScrollText, Users, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { adminApi } from "@/api/adminApi";
import { AdminLayout } from "@/components/admin/admin-layout";
import { getApiErrorMessage } from "@/lib/apiClient";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export function AdminDashboardPage() {
  const query = useQuery({ queryKey: ["admin", "dashboard"], queryFn: adminApi.dashboard, staleTime: 30_000 });
  const data = query.data;
  const metrics = data ? [
    ["Total Customers", data.totalCustomers, Users, ""], ["Active Customers", data.activeCustomers, Users, ""], ["Total Accounts", data.totalAccounts, WalletCards, ""], ["Total Balance", money.format(Number(data.totalBalance)), Activity, ""], ["Transactions Today", data.transactionsToday, ReceiptText, ""], ["Active Loans", data.activeLoans, HandCoins, "/admin/loans"],
    ["Pending Customer Approvals", data.pendingCustomerApprovals, Users, "/admin/customers?status=PENDING_ADMIN_APPROVAL"], ["Pending Account Requests", data.pendingAccountRequests, ScrollText, "/admin/account-requests?status=PENDING"], ["Pending Loan Requests", data.pendingLoanRequests, ScrollText, "/admin/loan-requests?status=PENDING"], ["Pending Closure Requests", data.pendingClosureRequests, WalletCards, "/admin/accounts?tab=closures&status=PENDING"],
  ] as const : [];
  return <AdminLayout title="Admin Dashboard" subtitle="Real-time overview of π Bank operations">
    {query.isLoading ? <div className="grid grid-cols-5 gap-4">{Array.from({ length: 10 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />)}</div> : null}
    {query.isError ? <div className="rounded-2xl border border-red-100 bg-white p-8 text-center text-sm text-red-600">{getApiErrorMessage(query.error)} <button className="ml-2 font-bold text-bank-blue" onClick={() => query.refetch()}>Retry</button></div> : null}
    {data ? <><section className="grid grid-cols-5 gap-4">{metrics.map(([label, value, Icon, path]) => {const card=<article className={`rounded-2xl border border-bank-border bg-white p-4 shadow-[0_6px_22px_rgba(11,31,58,0.04)] ${path?"transition hover:-translate-y-0.5 hover:border-bank-blue":""}`}><div className="flex items-start justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-bank-muted">{label}</p><p className="mt-3 text-xl font-extrabold text-bank-navy">{value}</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-bank-light text-bank-blue"><Icon size={17} /></span></div></article>;return path?<Link key={label} to={path}>{card}</Link>:<div key={label}>{card}</div>})}</section><section className="mt-5 rounded-2xl border border-bank-border bg-white p-6"><h2 className="text-sm font-extrabold text-bank-navy">Operations overview</h2><p className="mt-2 text-xs leading-6 text-bank-muted">Review pending onboarding, account and lending requests from their dedicated modules. Financial balances and ledger records remain read-only.</p></section></> : null}
  </AdminLayout>;
}
