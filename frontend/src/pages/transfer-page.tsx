import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, Send, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { accountApi } from "@/api/accountApi";
import { beneficiaryApi } from "@/api/beneficiaryApi";
import { transferApi } from "@/api/transferApi";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { useLogoutMutation } from "@/hooks/useAuthMutations";
import { getApiErrorMessage } from "@/lib/apiClient";

type TransferStep = "details" | "review" | "success";

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function createIdempotencyKey() {
  return globalThis.crypto.randomUUID();
}

export function TransferPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [step, setStep] = useState<TransferStep>("details");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [validationError, setValidationError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const logoutMutation = useLogoutMutation();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const accountsQuery = useQuery({ queryKey: ["accounts"], queryFn: accountApi.listAccounts, staleTime: 30_000 });
  const beneficiariesQuery = useQuery({ queryKey: ["beneficiaries"], queryFn: beneficiaryApi.listBeneficiaries, staleTime: 30_000 });
  const activeAccounts = useMemo(
    () => (accountsQuery.data ?? []).filter(
      (account) => account.status === "ACTIVE" && ["SAVINGS", "CURRENT"].includes(account.accountType),
    ),
    [accountsQuery.data],
  );
  const activeBeneficiaries = useMemo(() => (beneficiariesQuery.data ?? []).filter((beneficiary) => beneficiary.status === "ACTIVE"), [beneficiariesQuery.data]);
  const sourceAccount = activeAccounts.find((account) => account.accountId === sourceAccountId);
  const beneficiary = activeBeneficiaries.find((item) => item.beneficiaryId === beneficiaryId);
  const numericAmount = Number(amount);

  useEffect(() => {
    if (!sourceAccountId && activeAccounts.length > 0) setSourceAccountId(activeAccounts[0].accountId);
  }, [activeAccounts, sourceAccountId]);

  useEffect(() => {
    const requestedBeneficiaryId = (location.state as { beneficiary?: { beneficiaryId?: string } } | null)?.beneficiary?.beneficiaryId;
    if (requestedBeneficiaryId && activeBeneficiaries.some((item) => item.beneficiaryId === requestedBeneficiaryId)) {
      setBeneficiaryId(requestedBeneficiaryId);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [activeBeneficiaries, location.pathname, location.state, navigate]);

  const transferMutation = useMutation({
    mutationFn: () => transferApi.createTransfer({
      sourceAccountId,
      destinationAccountId: beneficiary!.destinationAccountId!,
      amount: numericAmount,
      ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
    }, idempotencyKey),
    onSuccess: async () => {
      setStep("success");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["account"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      ]);
    },
  });

  const reviewTransfer = (event: FormEvent) => {
    event.preventDefault();
    setValidationError("");
    transferMutation.reset();

    if (!sourceAccount) return setValidationError("Select an active source account.");
    if (!beneficiary) return setValidationError("Select a beneficiary.");
    if (!beneficiary.destinationAccountId) return setValidationError("This beneficiary is not linked to a π Bank account and cannot receive an internal transfer.");
    if (sourceAccount.accountId === beneficiary.destinationAccountId) return setValidationError("Source and destination accounts must be different.");
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setValidationError("Enter an amount greater than zero.");
    if (!/^\d+(\.\d{1,4})?$/.test(amount.trim())) return setValidationError("Amount can contain up to four decimal places.");
    if (numericAmount > sourceAccount.availableBalance) return setValidationError("Insufficient available balance.");
    if (remarks.trim().length > 500) return setValidationError("Remarks cannot exceed 500 characters.");

    setIdempotencyKey(createIdempotencyKey());
    setStep("review");
  };

  const resetTransfer = () => {
    setStep("details");
    setAmount("");
    setRemarks("");
    setValidationError("");
    setIdempotencyKey("");
    transferMutation.reset();
  };

  const loading = accountsQuery.isLoading || beneficiariesQuery.isLoading;
  const loadFailed = accountsQuery.isError || beneficiariesQuery.isError;

  return (
    <div className="flex h-screen min-w-[1180px] overflow-hidden bg-bank-page">
      <DashboardSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} onLogout={() => logoutMutation.mutate()} logoutPending={logoutMutation.isPending} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader title="Transfer" subtitle="Move money securely from your π Bank accounts" />
        <main className="min-h-0 flex-1 overflow-y-auto bg-bank-page px-5 py-4">
          <div className="mx-auto max-w-[920px]">
            <div className="mb-4 flex items-center justify-center gap-2 text-[10px] font-bold text-bank-muted">
              {[["details", "Transfer Details"], ["review", "Review"], ["success", "Complete"]].map(([key, label], index) => <div key={key} className="flex items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-full ${step === key || (step === "success" && key !== "success") || (step === "review" && key === "details") ? "bg-bank-blue text-white" : "border border-bank-border bg-white"}`}>{index + 1}</span><span className={step === key ? "text-bank-navy" : ""}>{label}</span>{index < 2 ? <span className="mx-2 h-px w-16 bg-bank-border" /> : null}</div>)}
            </div>

            {loading ? <div className="grid min-h-[470px] place-items-center rounded-2xl border border-bank-border bg-white"><div className="text-center"><LoaderCircle className="mx-auto animate-spin text-bank-blue" size={28} /><p className="mt-3 text-xs font-semibold text-bank-muted">Loading transfer details…</p></div></div> : null}
            {loadFailed ? <div className="grid min-h-[470px] place-items-center rounded-2xl border border-red-100 bg-white"><div className="text-center"><AlertCircle className="mx-auto text-red-500" size={29} /><p className="mt-3 text-sm font-bold text-bank-navy">Unable to prepare transfer</p><p className="mt-1 text-xs text-bank-muted">Accounts or beneficiaries could not be loaded.</p><button type="button" onClick={() => { accountsQuery.refetch(); beneficiariesQuery.refetch(); }} className="mt-4 rounded-xl bg-bank-blue px-4 py-2 text-xs font-bold text-white">Try Again</button></div></div> : null}

            {!loading && !loadFailed && step === "details" ? (
              <form onSubmit={reviewTransfer} className="rounded-2xl border border-bank-border bg-white p-6 shadow-[0_6px_22px_rgba(11,31,58,0.05)]">
                <div><h2 className="text-base font-extrabold text-bank-navy">Transfer Money</h2><p className="mt-1 text-xs text-bank-muted">Choose an account and a saved beneficiary.</p></div>
                <div className="mt-6 grid grid-cols-2 gap-5">
                  <label className="text-[11px] font-bold text-bank-navy">From Account<select value={sourceAccountId} onChange={(event) => { setSourceAccountId(event.target.value); setValidationError(""); }} className="mt-2 h-11 w-full rounded-xl border border-bank-border bg-white px-3 text-xs font-semibold outline-none focus:border-bank-blue"><option value="">Select account</option>{activeAccounts.map((account) => <option key={account.accountId} value={account.accountId}>{account.accountType} {account.maskedAccountNumber} — {moneyFormatter.format(account.availableBalance)}</option>)}</select></label>
                  <label className="text-[11px] font-bold text-bank-navy">Beneficiary<select value={beneficiaryId} onChange={(event) => { setBeneficiaryId(event.target.value); setValidationError(""); }} className="mt-2 h-11 w-full rounded-xl border border-bank-border bg-white px-3 text-xs font-semibold outline-none focus:border-bank-blue"><option value="">Select beneficiary</option>{activeBeneficiaries.map((item) => <option key={item.beneficiaryId} value={item.beneficiaryId}>{item.beneficiaryName} • {item.bankName} • {item.maskedAccountNumber}{item.destinationAccountId ? "" : " (external)"}</option>)}</select></label>
                  <label className="text-[11px] font-bold text-bank-navy">Amount<input value={amount} onChange={(event) => { setAmount(event.target.value); setValidationError(""); }} inputMode="decimal" placeholder="0.00" className="mt-2 h-11 w-full rounded-xl border border-bank-border px-3 text-sm font-semibold outline-none focus:border-bank-blue" /><span className="mt-1.5 block text-[10px] font-normal text-bank-muted">Available: {moneyFormatter.format(sourceAccount?.availableBalance ?? 0)}</span></label>
                  <label className="text-[11px] font-bold text-bank-navy">Remarks <span className="font-normal text-bank-muted">(Optional)</span><textarea value={remarks} onChange={(event) => { setRemarks(event.target.value); setValidationError(""); }} maxLength={500} rows={3} placeholder="Purpose of transfer" className="mt-2 w-full resize-none rounded-xl border border-bank-border px-3 py-2 text-xs font-medium outline-none focus:border-bank-blue" /></label>
                </div>
                {activeAccounts.length === 0 ? <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800">Open an active account before making a transfer.</p> : null}
                {activeBeneficiaries.length === 0 ? <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800">Add a beneficiary before making a transfer.</p> : null}
                {validationError ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700" role="alert">{validationError}</p> : null}
                <div className="mt-6 flex justify-end"><button type="submit" disabled={activeAccounts.length === 0 || activeBeneficiaries.length === 0} className="inline-flex h-11 items-center gap-2 rounded-xl bg-bank-blue px-5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">Review Transfer <ArrowRight size={16} /></button></div>
              </form>
            ) : null}

            {!loading && !loadFailed && step === "review" && sourceAccount && beneficiary ? (
              <section className="rounded-2xl border border-bank-border bg-white p-6 shadow-[0_6px_22px_rgba(11,31,58,0.05)]">
                <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bank-light text-bank-blue"><ShieldCheck size={20} /></span><div><h2 className="text-base font-extrabold text-bank-navy">Review Transfer</h2><p className="mt-0.5 text-xs text-bank-muted">Confirm the details before sending money.</p></div></div>
                <dl className="mt-6 divide-y divide-bank-border rounded-xl border border-bank-border px-4">{[["From", `${sourceAccount.accountType} ${sourceAccount.maskedAccountNumber}`], ["To", `${beneficiary.beneficiaryName} • ${beneficiary.maskedAccountNumber}`], ["Bank", beneficiary.bankName], ["Amount", moneyFormatter.format(numericAmount)], ["Remarks", remarks.trim() || "No remarks"]].map(([label, value]) => <div key={label} className="grid grid-cols-[120px_1fr] py-3"><dt className="text-[11px] text-bank-muted">{label}</dt><dd className="text-right text-xs font-bold text-bank-text">{value}</dd></div>)}</dl>
                {transferMutation.isError ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700" role="alert">{getApiErrorMessage(transferMutation.error)}</p> : null}
                <div className="mt-6 flex justify-between"><button type="button" onClick={() => { transferMutation.reset(); setStep("details"); }} disabled={transferMutation.isPending} className="inline-flex h-11 items-center gap-2 rounded-xl border border-bank-border px-4 text-xs font-bold text-bank-navy"><ArrowLeft size={16} /> Edit</button><button type="button" onClick={() => transferMutation.mutate()} disabled={transferMutation.isPending} className="inline-flex h-11 min-w-[160px] items-center justify-center gap-2 rounded-xl bg-bank-blue px-5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60">{transferMutation.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}{transferMutation.isPending ? "Transferring…" : "Confirm Transfer"}</button></div>
              </section>
            ) : null}

            {!loading && !loadFailed && step === "success" && transferMutation.data ? (
              <section className="rounded-2xl border border-bank-border bg-white px-8 py-10 text-center shadow-[0_6px_22px_rgba(11,31,58,0.05)]"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={28} /></span><h2 className="mt-4 text-xl font-extrabold text-bank-navy">Transfer Successful</h2><p className="mt-2 text-sm text-bank-muted">{moneyFormatter.format(transferMutation.data.amount)} was transferred successfully.</p><div className="mx-auto mt-5 max-w-md rounded-xl bg-bank-page px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-bank-muted">Transaction Reference</p><p className="mt-1 break-all text-sm font-extrabold text-bank-navy">{transferMutation.data.referenceNumber}</p></div><div className="mt-7 flex justify-center gap-3"><button type="button" onClick={resetTransfer} className="h-10 rounded-xl border border-bank-border px-4 text-xs font-bold text-bank-navy">Make Another Transfer</button><button type="button" onClick={() => navigate("/transactions")} className="h-10 rounded-xl bg-bank-blue px-4 text-xs font-bold text-white">View Transactions</button></div></section>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
