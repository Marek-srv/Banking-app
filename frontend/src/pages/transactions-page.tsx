import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown } from "lucide-react";

import { accountApi, type Account, type AccountTransaction } from "@/api/accountApi";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { TransactionDrawer } from "@/components/transactions/transaction-drawer";
import {
  TransactionFilters,
  type DateFilter,
  type StatusFilter,
  type TypeFilter,
} from "@/components/transactions/transaction-filters";
import { TransactionList } from "@/components/transactions/transaction-list";
import { TransactionSummary } from "@/components/transactions/transaction-summary";
import type { TransactionView } from "@/components/transactions/transaction-types";
import { useLogoutMutation } from "@/hooks/useAuthMutations";
import { StatementModal } from "@/components/statements/statement-modal";

const PAGE_SIZE = 8;

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateRange(option: DateFilter, customFrom: string, customTo: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (option === "today") return { from: isoDate(today), to: isoDate(today) };
  if (option === "last7" || option === "last30") {
    const from = new Date(today);
    from.setDate(from.getDate() - (option === "last7" ? 6 : 29));
    return { from: isoDate(from), to: isoDate(today) };
  }
  if (option === "thisMonth") return { from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: isoDate(today) };
  if (option === "lastMonth") {
    return {
      from: isoDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      to: isoDate(new Date(today.getFullYear(), today.getMonth(), 0)),
    };
  }
  return { from: customFrom || undefined, to: customTo || undefined };
}

function accountDisplay(account: Account | undefined) {
  if (!account) return "π Bank account";
  const type = account.accountType.charAt(0) + account.accountType.slice(1).toLowerCase();
  return `${type} ${account.maskedAccountNumber}`;
}

function transactionView(transaction: AccountTransaction, accounts: Account[], selectedAccountId: string): TransactionView {
  const sourceAccount = accounts.find((account) => account.accountId === transaction.sourceAccountId);
  const destinationAccount = accounts.find((account) => account.accountId === transaction.destinationAccountId);
  const sourceOwned = Boolean(sourceAccount);
  const destinationOwned = Boolean(destinationAccount);
  const credit = selectedAccountId !== "all"
    ? transaction.destinationAccountId === selectedAccountId && transaction.sourceAccountId !== selectedAccountId
    : destinationOwned && !sourceOwned;
  const displayAccount = credit ? destinationAccount : sourceAccount ?? destinationAccount;

  return {
    id: transaction.transactionId,
    referenceNumber: transaction.referenceNumber || `TXN-${transaction.transactionId}`,
    description: transaction.description,
    category: transaction.category,
    remarks: transaction.remarks,
    accountLabel: accountDisplay(displayAccount),
    fromLabel: sourceAccount ? accountDisplay(sourceAccount) : "External source",
    toLabel: destinationAccount ? accountDisplay(destinationAccount) : "External destination",
    amount: transaction.amount,
    direction: credit ? "credit" : "debit",
    status: transaction.status,
    type: transaction.type,
    initiatedAt: transaction.initiatedAt,
  };
}

function backendType(type: TypeFilter) {
  if (type === "credit") return "DEPOSIT";
  if (type === "debit") return "WITHDRAWAL";
  if (type === "transfer") return "TRANSFER";
  return undefined;
}

export function TransactionsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("thisMonth");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [selectedTransactionPreview, setSelectedTransactionPreview] = useState<TransactionView | null>(null);
  const [statementOpen, setStatementOpen] = useState(false);
  const logoutMutation = useLogoutMutation();

  const range = useMemo(() => dateRange(dateFilter, customFrom, customTo), [customFrom, customTo, dateFilter]);
  const queryType = backendType(typeFilter);

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: accountApi.listAccounts,
    staleTime: 30_000,
  });

  const transactionsQuery = useQuery({
    queryKey: ["transactions", "transactions-page", range.from, range.to, queryType, statusFilter],
    queryFn: () => accountApi.listTransactions({
      from: range.from,
      to: range.to,
      type: queryType,
      status: statusFilter === "all" ? null : statusFilter,
    }),
    staleTime: 20_000,
  });

  const transactionDetailsQuery = useQuery({
    queryKey: ["transaction", selectedTransactionId],
    queryFn: () => accountApi.getTransaction(selectedTransactionId!),
    enabled: Boolean(selectedTransactionId),
    staleTime: 20_000,
    retry: 1,
  });

  const filteredPairs = useMemo(() => {
    const accounts = accountsQuery.data ?? [];
    const normalizedSearch = search.trim().toLowerCase();

    return (transactionsQuery.data ?? [])
      .map((raw) => ({ raw, view: transactionView(raw, accounts, accountId) }))
      .filter(({ raw, view }) => {
        if (accountId !== "all" && raw.sourceAccountId !== accountId && raw.destinationAccountId !== accountId) return false;
        if (typeFilter === "atm" && !`${raw.type} ${raw.category} ${raw.description}`.toLowerCase().includes("atm")) return false;
        if (!normalizedSearch) return true;
        return `${view.description} ${view.category} ${view.remarks} ${view.referenceNumber} ${view.accountLabel} ${view.type}`.toLowerCase().includes(normalizedSearch);
      })
      .sort((left, right) => new Date(right.view.initiatedAt).getTime() - new Date(left.view.initiatedAt).getTime());
  }, [accountId, accountsQuery.data, search, transactionsQuery.data, typeFilter]);

  const summary = useMemo(() => {
    const ownedIds = new Set((accountsQuery.data ?? []).map((account) => account.accountId));
    return filteredPairs.reduce((totals, { raw }) => {
      if (accountId !== "all") {
        if (raw.destinationAccountId === accountId && raw.sourceAccountId !== accountId) totals.moneyIn += raw.amount;
        if (raw.sourceAccountId === accountId && raw.destinationAccountId !== accountId) totals.moneyOut += raw.amount;
        return totals;
      }

      const sourceOwned = raw.sourceAccountId ? ownedIds.has(raw.sourceAccountId) : false;
      const destinationOwned = raw.destinationAccountId ? ownedIds.has(raw.destinationAccountId) : false;
      if (destinationOwned && !sourceOwned) totals.moneyIn += raw.amount;
      if (sourceOwned && !destinationOwned) totals.moneyOut += raw.amount;
      return totals;
    }, { moneyIn: 0, moneyOut: 0 });
  }, [accountId, accountsQuery.data, filteredPairs]);

  const totalPages = Math.ceil(filteredPairs.length / PAGE_SIZE);
  const visibleTransactions = filteredPairs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(({ view }) => view);
  const selectedTransaction = transactionDetailsQuery.data
    ? transactionView(transactionDetailsQuery.data, accountsQuery.data ?? [], accountId)
    : selectedTransactionPreview;

  const openTransactionDetails = (transaction: TransactionView) => {
    setSelectedTransactionPreview(transaction);
    setSelectedTransactionId(transaction.id);
  };

  const closeTransactionDetails = () => {
    setSelectedTransactionId(null);
    setSelectedTransactionPreview(null);
  };

  useEffect(() => { setPage(1); }, [accountId, customFrom, customTo, dateFilter, search, statusFilter, typeFilter]);
  useEffect(() => { if (totalPages > 0 && page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const resetFilters = () => {
    setSearch("");
    setAccountId("all");
    setDateFilter("thisMonth");
    setTypeFilter("all");
    setStatusFilter("all");
    setCustomFrom("");
    setCustomTo("");
    setMoreOpen(false);
  };

  return (
    <div className="flex h-screen min-w-[1180px] overflow-hidden bg-bank-page">
      <DashboardSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} onLogout={() => logoutMutation.mutate()} logoutPending={logoutMutation.isPending} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader title="Transactions" subtitle="Review and track your banking activity" />
        <main className="min-h-0 flex-1 overflow-y-auto bg-bank-page px-5 py-3.5">
          <div className="mx-auto max-w-[1460px] space-y-3">
            <div className="flex justify-end"><button type="button" onClick={() => setStatementOpen(true)} disabled={accountsQuery.isLoading || !accountsQuery.data?.length} className="inline-flex h-9 items-center gap-2 rounded-xl border border-bank-border bg-white px-3.5 text-[10px] font-bold text-bank-navy shadow-[0_3px_12px_rgba(11,31,58,0.04)] hover:border-bank-blue hover:text-bank-blue disabled:cursor-not-allowed disabled:opacity-50"><FileDown size={15} /> Statement</button></div>
            <TransactionSummary moneyIn={summary.moneyIn} moneyOut={summary.moneyOut} />
            <TransactionFilters
              accounts={accountsQuery.data ?? []}
              search={search}
              accountId={accountId}
              dateFilter={dateFilter}
              typeFilter={typeFilter}
              statusFilter={statusFilter}
              customFrom={customFrom}
              customTo={customTo}
              moreOpen={moreOpen}
              onSearchChange={setSearch}
              onAccountChange={setAccountId}
              onDateChange={setDateFilter}
              onTypeChange={setTypeFilter}
              onStatusChange={setStatusFilter}
              onCustomFromChange={setCustomFrom}
              onCustomToChange={setCustomTo}
              onToggleMore={() => setMoreOpen((value) => !value)}
              onReset={resetFilters}
            />
            <TransactionList
              transactions={visibleTransactions}
              page={page}
              totalPages={totalPages}
              totalResults={filteredPairs.length}
              loading={transactionsQuery.isLoading}
              error={transactionsQuery.isError}
              onPageChange={setPage}
              onSelect={openTransactionDetails}
              onRetry={() => transactionsQuery.refetch()}
            />
          </div>
        </main>
      </div>
      <TransactionDrawer
        transaction={selectedTransaction}
        detailsLoading={transactionDetailsQuery.isFetching}
        detailsError={transactionDetailsQuery.isError}
        onRetry={() => transactionDetailsQuery.refetch()}
        onClose={closeTransactionDetails}
      />
      <StatementModal open={statementOpen} accounts={accountsQuery.data ?? []} onClose={() => setStatementOpen(false)} />
    </div>
  );
}
