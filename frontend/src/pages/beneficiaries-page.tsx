import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Plus, Search, UserRoundPlus, UsersRound } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { beneficiaryApi, type Beneficiary } from "@/api/beneficiaryApi";
import { AddBeneficiaryModal } from "@/components/beneficiaries/add-beneficiary-modal";
import { BeneficiaryCard } from "@/components/beneficiaries/beneficiary-card";
import { BeneficiaryDrawer } from "@/components/beneficiaries/beneficiary-drawer";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { useLogoutMutation } from "@/hooks/useAuthMutations";

export function BeneficiariesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(() => searchParams.get("add") === "1");
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
  const logoutMutation = useLogoutMutation();
  const navigate = useNavigate();
  const closeAdd = () => {
    setAddOpen(false);
    if (searchParams.has("add")) setSearchParams({}, { replace: true });
  };
  const beneficiariesQuery = useQuery({
    queryKey: ["beneficiaries"],
    queryFn: beneficiaryApi.listBeneficiaries,
    staleTime: 30_000,
  });

  const beneficiaries = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return beneficiariesQuery.data ?? [];
    return (beneficiariesQuery.data ?? []).filter((beneficiary) =>
      `${beneficiary.beneficiaryName} ${beneficiary.bankName} ${beneficiary.maskedAccountNumber} ${beneficiary.ifscCode} ${beneficiary.nickname ?? ""}`.toLowerCase().includes(value),
    );
  }, [beneficiariesQuery.data, search]);

  const transferTo = (beneficiary: Beneficiary) => {
    navigate("/transfer", {
      state: {
        beneficiary: {
          beneficiaryId: beneficiary.beneficiaryId,
          beneficiaryName: beneficiary.beneficiaryName,
          bankName: beneficiary.bankName,
          maskedAccountNumber: beneficiary.maskedAccountNumber,
          ifscCode: beneficiary.ifscCode,
        },
      },
    });
  };

  return (
    <div className="flex h-screen min-w-[1180px] overflow-hidden bg-bank-page">
      <DashboardSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} onLogout={() => logoutMutation.mutate()} logoutPending={logoutMutation.isPending} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader title="Beneficiaries" subtitle="Manage trusted recipients for faster transfers" />
        <main className="min-h-0 flex-1 overflow-y-auto bg-bank-page px-5 py-4">
          <div className="mx-auto max-w-[1460px]">
            <div className="flex items-center justify-between">
              <div><h1 className="text-[13px] font-extrabold tracking-[0.13em] text-bank-navy">BENEFICIARIES</h1><p className="mt-1 text-[10px] text-bank-muted">{beneficiariesQuery.data?.length ?? 0} active beneficiaries</p></div>
              <button type="button" onClick={() => setAddOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-bank-blue px-4 text-[11px] font-bold text-white shadow-[0_7px_18px_rgba(11,99,229,0.24)] hover:bg-blue-700"><Plus size={16} /> Add Beneficiary</button>
            </div>

            <label className="relative mt-4 block max-w-[440px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-bank-muted" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search beneficiary..." className="h-10 w-full rounded-xl border border-bank-border bg-white pl-9 pr-3 text-xs text-bank-text shadow-[0_3px_12px_rgba(11,31,58,0.035)] outline-none placeholder:text-slate-400 focus:border-bank-blue focus:ring-2 focus:ring-blue-100" />
            </label>

            {beneficiariesQuery.isLoading ? (
              <div className="mt-4 grid grid-cols-3 gap-4 2xl:grid-cols-4">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-[218px] animate-pulse rounded-2xl border border-bank-border bg-white p-4"><div className="h-11 w-11 rounded-xl bg-slate-100" /><div className="mt-4 h-4 w-1/2 rounded bg-slate-100" /><div className="mt-3 h-3 w-2/3 rounded bg-slate-100" /><div className="mt-8 h-10 rounded-lg bg-slate-100" /></div>)}</div>
            ) : null}

            {beneficiariesQuery.isError ? (
              <div className="mt-4 flex min-h-[430px] items-center justify-center rounded-2xl border border-red-100 bg-white"><div className="text-center"><AlertCircle size={28} className="mx-auto text-red-500" /><p className="mt-3 text-sm font-bold text-bank-navy">Unable to load beneficiaries</p><p className="mt-1 text-xs text-bank-muted">Please check your connection and try again.</p><button type="button" onClick={() => beneficiariesQuery.refetch()} className="mt-4 rounded-lg bg-bank-blue px-4 py-2 text-xs font-bold text-white">Try Again</button></div></div>
            ) : null}

            {!beneficiariesQuery.isLoading && !beneficiariesQuery.isError && beneficiaries.length === 0 ? (
              <div className="mt-4 flex min-h-[430px] items-center justify-center rounded-2xl border border-bank-border bg-white"><div className="text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bank-light text-bank-blue">{search ? <UsersRound size={21} /> : <UserRoundPlus size={21} />}</span><p className="mt-3 text-sm font-bold text-bank-navy">{search ? "No matching beneficiaries" : "No beneficiaries added"}</p><p className="mt-1 text-xs text-bank-muted">{search ? "Try a different name, bank, account, or IFSC." : "Add a beneficiary to make transfers faster."}</p>{!search ? <button type="button" onClick={() => setAddOpen(true)} className="mt-4 rounded-lg bg-bank-blue px-4 py-2 text-xs font-bold text-white">Add Beneficiary</button> : null}</div></div>
            ) : null}

            {!beneficiariesQuery.isLoading && !beneficiariesQuery.isError && beneficiaries.length > 0 ? (
              <div className="mt-4 grid grid-cols-3 gap-4 2xl:grid-cols-4">{beneficiaries.map((beneficiary) => <BeneficiaryCard key={beneficiary.beneficiaryId} beneficiary={beneficiary} onTransfer={transferTo} onView={setSelectedBeneficiary} />)}</div>
            ) : null}
          </div>
        </main>
      </div>

      <AddBeneficiaryModal open={addOpen} onClose={closeAdd} onTransfer={transferTo} />
      <BeneficiaryDrawer beneficiary={selectedBeneficiary} onClose={() => setSelectedBeneficiary(null)} onTransfer={transferTo} />
    </div>
  );
}
