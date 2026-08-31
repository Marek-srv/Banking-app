import { Bell, Bot, ChevronDown, CircleHelp, Menu } from "lucide-react";

import { useAuthenticatedCustomer } from "@/hooks/useAuthenticatedCustomer";

type DashboardHeaderProps = {
  onOpenAssistant?: () => void;
  title?: string;
  subtitle?: string;
};

export function DashboardHeader({
  onOpenAssistant,
  title = "Overview",
  subtitle = "Welcome back, Maya",
}: DashboardHeaderProps) {
  const customerQuery = useAuthenticatedCustomer();
  const customerName = customerQuery.data?.name ?? "Customer";
  const customerId = customerQuery.data?.customerId || "Profile temporarily unavailable";
  const initials = customerName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CU";
  return (
    <header className="relative z-20 flex h-[70px] shrink-0 items-center border-b border-bank-border bg-white px-4 shadow-[0_2px_10px_rgba(11,31,58,0.03)] sm:px-6">
      <button type="button" className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg text-bank-navy hover:bg-bank-page md:hidden" aria-label="Open navigation">
        <Menu size={21} />
      </button>
      <div>
        <h1 className="text-xl font-bold tracking-[-0.02em] text-bank-navy sm:text-[22px]">{title}</h1>
        <p className="mt-0.5 hidden text-xs text-bank-muted sm:block">{subtitle}</p>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {onOpenAssistant ? (
          <button
            type="button"
            onClick={onOpenAssistant}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-bank-light text-bank-blue xl:hidden"
            aria-label="Open banking assistant"
          >
            <Bot size={18} />
          </button>
        ) : null}
        <button type="button" className="relative flex h-9 w-9 items-center justify-center rounded-full text-bank-muted transition hover:bg-bank-page hover:text-bank-blue" aria-label="Notifications">
          <Bell size={18} />
          <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
        </button>
        <button type="button" className="hidden h-9 w-9 items-center justify-center rounded-full text-bank-muted transition hover:bg-bank-page hover:text-bank-blue sm:flex" aria-label="Help">
          <CircleHelp size={18} />
        </button>
        <span className="mx-1 hidden h-7 w-px bg-bank-border sm:block" />
        <button type="button" className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-1.5 text-left transition hover:bg-bank-page sm:pr-2" aria-label="Open customer menu">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-bank-blue to-[#4F8EE8] text-sm font-bold text-white">{initials}</span>
          <span className="hidden sm:block">
            {customerQuery.isLoading ? (
              <span className="block w-32 animate-pulse" aria-label="Loading customer identity">
                <span className="block h-3 w-24 rounded bg-slate-200" />
                <span className="mt-1.5 block h-2 w-28 rounded bg-slate-100" />
              </span>
            ) : (
              <>
                <span className="block max-w-36 truncate text-xs font-semibold text-bank-navy">{customerName}</span>
                <span className="mt-0.5 block max-w-36 truncate text-[10px] text-bank-muted">{customerId}</span>
              </>
            )}
          </span>
          <ChevronDown size={15} className="hidden text-bank-muted sm:block" />
        </button>
      </div>
    </header>
  );
}
