import type { ReactNode } from "react";
import { useState } from "react";
import { Building2, CreditCard, FileClock, HandCoins, Landmark, LayoutDashboard, LogOut, ReceiptText, ScrollText, Users, UserRoundCog, WalletCards } from "lucide-react";
import { NavLink } from "react-router-dom";
import { BrandMark } from "@/components/brand-mark";
import { LogoutConfirmationModal } from "@/components/dashboard/logout-confirmation-modal";
import { useLogoutMutation } from "@/hooks/useAuthMutations";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";

const links = [
  ["Admin Dashboard", LayoutDashboard, "/admin/dashboard"], ["Customers", Users, "/admin/customers"],
  ["Account Requests", ScrollText, "/admin/account-requests"], ["Accounts", WalletCards, "/admin/accounts"],
  ["Loan Requests", ScrollText, "/admin/loan-requests"], ["Loans", HandCoins, "/admin/loans"], ["Transactions", ReceiptText, "/admin/transactions"],
  ["Employees", UserRoundCog, "/admin/employees"], ["Branches", Building2, "/admin/branches"],
  ["ATMs", Landmark, "/admin/atms"], ["Card Requests", ScrollText, "/admin/card-requests"], ["Cards", CreditCard, "/admin/cards"], ["Audit Logs", FileClock, "/admin/audit-logs"],
] as const;

export function AdminLayout({ title, subtitle, children, action }: { title: string; subtitle: string; children: ReactNode; action?: ReactNode }) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const logout = useLogoutMutation();
  const user = useAuthStore((state) => state.user);
  return <div className="flex h-screen min-w-[1180px] overflow-hidden bg-bank-page">
    <aside className="flex w-[238px] shrink-0 flex-col bg-bank-dark text-white shadow-xl">
      <div className="flex h-[70px] items-center border-b border-white/10 px-5"><BrandMark inverse /></div>
      <div className="px-5 pt-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">Administration</p></div>
      <nav className="flex-1 space-y-1 px-3 py-4">{links.map(([label, Icon, path]) => <NavLink key={path} to={path} className={({ isActive }) => cn("flex h-10 items-center gap-3 rounded-xl px-3 text-[12px] font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white", isActive && "bg-bank-blue text-white shadow-[0_8px_22px_rgba(11,99,229,0.28)]")}><Icon size={17} /><span>{label}</span></NavLink>)}</nav>
      <div className="border-t border-white/10 p-3"><button type="button" onClick={() => setLogoutOpen(true)} className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-300"><LogOut size={18} />Logout</button></div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-[70px] shrink-0 items-center border-b border-bank-border bg-white px-7"><div><h1 className="text-xl font-extrabold text-bank-navy">{title}</h1><p className="mt-0.5 text-[11px] text-bank-muted">{subtitle}</p></div><div className="ml-auto flex items-center gap-4">{action}<span className="h-8 w-px bg-bank-border" /><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-bank-blue text-xs font-bold text-white">AD</span><div><p className="text-xs font-bold text-bank-navy">Administrator</p><p className="max-w-48 truncate text-[10px] text-bank-muted">{user?.email}</p></div></div></div></header>
      <main className="min-h-0 flex-1 overflow-y-auto bg-bank-page p-6">{children}</main>
    </div>
    <LogoutConfirmationModal open={logoutOpen} pending={logout.isPending} onCancel={() => setLogoutOpen(false)} onConfirm={() => logout.mutate()} />
  </div>;
}
