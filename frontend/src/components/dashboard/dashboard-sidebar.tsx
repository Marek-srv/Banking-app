import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  HandCoins,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Settings,
  Users,
  WalletCards,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Fragment, useState } from "react";

import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";
import { LogoutConfirmationModal } from "@/components/dashboard/logout-confirmation-modal";

const primaryNavigation = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Accounts", icon: WalletCards, path: "/accounts" },
  { label: "Transfer", icon: ArrowLeftRight, path: "/transfer" },
  { label: "Transactions", icon: ReceiptText, path: "/transactions" },
  { label: "Beneficiaries", icon: Users, path: "/beneficiaries" },
  { label: "Cards", icon: CreditCard, path: "/cards" },
  { label: "Loans", icon: HandCoins, path: "/loans" },
];

type DashboardSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
  logoutPending: boolean;
};

export function DashboardSidebar({
  collapsed,
  onToggle,
  onLogout,
  logoutPending,
}: DashboardSidebarProps) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const labelsHidden = collapsed ? "hidden" : "md:max-xl:hidden";

  return (
    <Fragment>
    <aside
      className={cn(
        "relative hidden h-screen shrink-0 flex-col bg-bank-dark text-white shadow-xl transition-[width] duration-300 md:flex md:max-xl:w-[84px]",
        collapsed ? "w-[84px]" : "w-[232px]",
      )}
    >
      <div className={cn("flex h-[70px] items-center border-b border-white/10 px-5", collapsed && "justify-center px-0", "md:max-xl:justify-center md:max-xl:px-0")}>
        <BrandMark inverse compact={collapsed} className={cn(collapsed && "[&>span:last-child]:hidden", "md:max-xl:[&>span:last-child]:hidden")} />
      </div>

      <button
        type="button"
        onClick={onToggle}
        className="absolute -right-3 top-[84px] z-10 hidden h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-bank-navy shadow-md transition hover:text-bank-blue xl:flex"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </button>

      <nav className="flex-1 px-3 py-7" aria-label="Primary navigation">
        <p className={cn("mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500", labelsHidden)}>
          Banking
        </p>
        <div className="space-y-1.5">
          {primaryNavigation.map(({ label, icon: Icon, path }) => {
            const active = path === location.pathname;
            return (
            <button
              key={label}
              type="button"
              title={label}
              onClick={() => path && navigate(path)}
              className={cn(
                "group flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white",
                active && "bg-bank-blue text-white shadow-[0_8px_22px_rgba(11,99,229,0.28)] hover:bg-bank-blue",
                (collapsed || false) && "justify-center",
                "md:max-xl:justify-center",
              )}
            >
              <Icon size={19} strokeWidth={active ? 2.3 : 2} className="shrink-0" />
              <span className={labelsHidden}>{label}</span>
            </button>
            );
          })}
        </div>
      </nav>

      <div className="space-y-1.5 border-t border-white/10 px-3 py-5">
        <button
          type="button"
          title="Settings"
          onClick={() => navigate("/settings")}
          className={cn("flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white", location.pathname === "/settings" && "bg-bank-blue text-white shadow-[0_8px_22px_rgba(11,99,229,0.28)]", collapsed && "justify-center", "md:max-xl:justify-center")}
        >
          <Settings size={19} />
          <span className={labelsHidden}>Settings</span>
        </button>
        <button
          type="button"
          title="Logout"
          onClick={() => setLogoutOpen(true)}
          disabled={logoutPending}
          className={cn("flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-400 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-60", collapsed && "justify-center", "md:max-xl:justify-center")}
        >
          {logoutPending ? <HandCoins size={19} className="animate-pulse" /> : <LogOut size={19} />}
          <span className={labelsHidden}>{logoutPending ? "Signing out…" : "Logout"}</span>
        </button>
      </div>
    </aside>
    <LogoutConfirmationModal open={logoutOpen} pending={logoutPending} onCancel={() => !logoutPending && setLogoutOpen(false)} onConfirm={onLogout} />
    </Fragment>
  );
}
