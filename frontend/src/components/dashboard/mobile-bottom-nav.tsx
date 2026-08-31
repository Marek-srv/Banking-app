import { ArrowLeftRight, LayoutDashboard, Menu, ReceiptText, WalletCards } from "lucide-react";

const items = [
  { label: "Home", icon: LayoutDashboard, active: true },
  { label: "Accounts", icon: WalletCards },
  { label: "Transfer", icon: ArrowLeftRight, primary: true },
  { label: "Activity", icon: ReceiptText },
  { label: "More", icon: Menu },
];

export function MobileBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-[68px] items-center justify-around border-t border-bank-border bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-5px_20px_rgba(11,31,58,0.08)] backdrop-blur md:hidden" aria-label="Mobile navigation">
      {items.map(({ label, icon: Icon, active, primary }) => (
        <button key={label} type="button" className={`flex min-w-[55px] flex-col items-center gap-1 text-[9px] font-medium ${active || primary ? "text-bank-blue" : "text-bank-muted"}`}>
          <span className={primary ? "-mt-5 flex h-12 w-12 items-center justify-center rounded-full border-4 border-bank-page bg-bank-blue text-white shadow-lg" : "flex h-6 items-center"}>
            <Icon size={primary ? 20 : 18} strokeWidth={active ? 2.4 : 2} />
          </span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
