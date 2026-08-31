import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Bot } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { accountApi, type AccountTransaction } from "@/api/accountApi";
import { cardApi } from "@/api/cardApi";
import { AccountSummary, DashboardMetrics, PhysicalBankCard } from "@/components/dashboard/banking-summaries";
import { MoneyMovementChart, SpendingCategoriesChart, type MoneyMovementPoint, type SpendingCategoryPoint } from "@/components/dashboard/dashboard-charts";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { MobileBottomNav } from "@/components/dashboard/mobile-bottom-nav";
import { OllamaPanel } from "@/components/dashboard/ollama-panel";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { useLogoutMutation } from "@/hooks/useAuthMutations";
import { useAuthenticatedCustomer } from "@/hooks/useAuthenticatedCustomer";
import { StatementModal } from "@/components/statements/statement-modal";

const categoryColors = ["#0B63E5", "#7C3AED", "#F59E0B", "#10B981", "#F43F5E", "#64748B"];

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function transactionDirection(transaction: AccountTransaction, ownedAccountIds: Set<string>) {
  const sourceOwned = Boolean(transaction.sourceAccountId && ownedAccountIds.has(transaction.sourceAccountId));
  const destinationOwned = Boolean(transaction.destinationAccountId && ownedAccountIds.has(transaction.destinationAccountId));
  return { incoming: destinationOwned && !sourceOwned, outgoing: sourceOwned && !destinationOwned };
}

function DashboardSkeleton() {
  const block = (className: string) => <div className={`h-[113px] rounded-2xl border border-bank-border bg-white p-4 ${className}`}><div className="h-3 w-24 rounded bg-slate-100" /><div className="mt-4 h-6 w-36 rounded bg-slate-100" /><div className="mt-3 h-3 w-28 rounded bg-slate-100" /></div>;
  return <div className="mx-auto max-w-[1180px] animate-pulse space-y-3.5" aria-label="Loading dashboard"><section className="grid grid-cols-12 gap-3">{block("col-span-3")}{block("col-span-3")}{block("col-span-6")}</section><section className="grid grid-cols-[minmax(0,1.12fr)_minmax(280px,0.88fr)] gap-3.5"><div className="h-[210px] rounded-2xl border border-bank-border bg-white" /><div className="h-[210px] rounded-2xl border border-bank-border bg-white" /></section><section className="grid grid-cols-[minmax(0,1.65fr)_minmax(250px,0.85fr)] gap-3.5"><div className="h-[248px] rounded-2xl border border-bank-border bg-white" /><div className="h-[248px] rounded-2xl border border-bank-border bg-white" /></section></div>;
}

export function DashboardPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const logoutMutation = useLogoutMutation();
  const navigate = useNavigate();

  const dates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const tenDayStart = new Date(today);
    tenDayStart.setDate(today.getDate() - 9);
    const queryStart = monthStart < tenDayStart ? monthStart : tenDayStart;
    return { today, monthStart, tenDayStart, queryStart: localDateKey(queryStart) };
  }, []);

  const profileQuery = useAuthenticatedCustomer();
  const accountsQuery = useQuery({ queryKey: ["accounts"], queryFn: accountApi.listAccounts, staleTime: 60_000 });
  const cardsQuery = useQuery({ queryKey: ["cards"], queryFn: cardApi.listCards, staleTime: 60_000 });
  const transactionsQuery = useQuery({
    queryKey: ["transactions", "dashboard", dates.queryStart, "COMPLETED"],
    queryFn: () => accountApi.listTransactions({ from: dates.queryStart, status: "COMPLETED" }),
    staleTime: 30_000,
  });

  const accounts = accountsQuery.data ?? [];
  const transactions = transactionsQuery.data ?? [];
  const operatingAccounts = useMemo(
    () => accounts.filter((account) => ["SAVINGS", "CURRENT"].includes(account.accountType)),
    [accounts],
  );
  const operatingAccountIds = useMemo(
    () => new Set(operatingAccounts.map((account) => account.accountId)),
    [operatingAccounts],
  );

  const dashboardData = useMemo(() => {
    const totalBalance = operatingAccounts.reduce((sum, account) => sum + account.availableBalance, 0);
    let monthlyExpense = 0;
    const movementMap = new Map<string, MoneyMovementPoint>();

    for (let offset = 0; offset < 10; offset += 1) {
      const date = new Date(dates.tenDayStart);
      date.setDate(dates.tenDayStart.getDate() + offset);
      const key = localDateKey(date);
      movementMap.set(key, { key, day: String(date.getDate()).padStart(2, "0"), moneyIn: 0, moneyOut: 0 });
    }

    const categoryTotals = new Map<string, number>();
    for (const transaction of transactions) {
      if (transaction.status !== "COMPLETED") continue;
      const initiatedAt = new Date(transaction.initiatedAt);
      if (Number.isNaN(initiatedAt.getTime())) continue;
      const direction = transactionDirection(transaction, operatingAccountIds);
      const inCurrentMonth = initiatedAt >= dates.monthStart && initiatedAt <= new Date();
      if (inCurrentMonth && direction.outgoing) {
        monthlyExpense += transaction.amount;
        if (transaction.categoryAvailable) categoryTotals.set(transaction.category, (categoryTotals.get(transaction.category) ?? 0) + transaction.amount);
      }
      const movement = movementMap.get(localDateKey(initiatedAt));
      if (movement && direction.incoming) movement.moneyIn += transaction.amount;
      if (movement && direction.outgoing) movement.moneyOut += transaction.amount;
    }

    const spendingCategories: SpendingCategoryPoint[] = [...categoryTotals.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6).map(([name, value], index) => ({ name, value, color: categoryColors[index] ?? "#64748B" }));
    const recentTransactions = [...transactions].sort((left, right) => new Date(right.initiatedAt).getTime() - new Date(left.initiatedAt).getTime()).slice(0, 4);
    return { totalBalance, monthlyExpense, movement: [...movementMap.values()], spendingCategories, recentTransactions };
  }, [dates.monthStart, dates.tenDayStart, operatingAccountIds, operatingAccounts, transactions]);

  const profile = profileQuery.data;
  const customerName = profile?.name ?? "Customer";
  const primaryCard = cardsQuery.data?.[0];
  const linkedAccount = primaryCard?.accountId ? accounts.find((account) => account.accountId === primaryCard.accountId) : undefined;
  const loading = accountsQuery.isLoading || cardsQuery.isLoading || transactionsQuery.isLoading;
  const failed = accountsQuery.isError || cardsQuery.isError || transactionsQuery.isError;
  const retryAll = () => void Promise.all([profileQuery.refetch(), accountsQuery.refetch(), cardsQuery.refetch(), transactionsQuery.refetch()]);

  return (
    <div className="flex h-screen min-w-[1180px] overflow-hidden bg-bank-page">
      <DashboardSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} onLogout={() => logoutMutation.mutate()} logoutPending={logoutMutation.isPending} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader onOpenAssistant={() => setAssistantOpen(true)} subtitle={`Welcome back, ${customerName.split(" ")[0]}`} />
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto bg-bank-page px-3 pb-24 pt-3 sm:px-5 sm:pb-6 sm:pt-4">
            {loading ? <DashboardSkeleton /> : null}
            {!loading && failed ? <div className="mx-auto flex min-h-[560px] max-w-[1180px] items-center justify-center rounded-2xl border border-red-100 bg-white"><div className="text-center"><AlertCircle className="mx-auto text-red-500" size={30} /><p className="mt-3 text-sm font-bold text-bank-navy">Unable to load your dashboard</p><p className="mt-1 text-xs text-bank-muted">Your banking information could not be refreshed. Please try again.</p><button type="button" onClick={retryAll} className="mt-4 rounded-lg bg-bank-blue px-4 py-2 text-xs font-bold text-white">Try Again</button></div></div> : null}
            {!loading && !failed ? <div className="mx-auto max-w-[1180px] space-y-3.5"><DashboardMetrics totalBalance={dashboardData.totalBalance} monthlyExpense={dashboardData.monthlyExpense} accountCount={operatingAccounts.length} onTransfer={() => navigate("/transfer")} onAddBeneficiary={() => navigate("/beneficiaries?add=1")} onViewStatement={() => setStatementOpen(true)} /><section className="grid min-w-0 gap-3.5 lg:grid-cols-[minmax(0,1.12fr)_minmax(280px,0.88fr)]"><AccountSummary accounts={accounts} onSelect={() => navigate("/accounts")} /><PhysicalBankCard card={primaryCard} cardholderName={customerName.toUpperCase()} linkedAccount={linkedAccount} onManage={() => navigate("/cards")} /></section><section className="grid gap-3.5 lg:grid-cols-[minmax(0,1.65fr)_minmax(250px,0.85fr)]"><MoneyMovementChart data={dashboardData.movement} /><SpendingCategoriesChart data={dashboardData.spendingCategories} /></section><RecentTransactions transactions={dashboardData.recentTransactions} ownedAccountIds={operatingAccountIds} onViewAll={() => navigate("/transactions")} /></div> : null}
          </main>
          <OllamaPanel customerName={customerName} />
        </div>
      </div>
      <button type="button" onClick={() => setAssistantOpen(true)} className="fixed bottom-[82px] right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-bank-blue text-white shadow-[0_10px_30px_rgba(11,99,229,0.35)] md:bottom-6 xl:hidden" aria-label="Open banking assistant"><Bot size={21} /></button>
      <OllamaPanel drawer open={assistantOpen} onClose={() => setAssistantOpen(false)} customerName={customerName} />
      <MobileBottomNav />
      <StatementModal open={statementOpen} accounts={operatingAccounts} onClose={() => setStatementOpen(false)} />
    </div>
  );
}
