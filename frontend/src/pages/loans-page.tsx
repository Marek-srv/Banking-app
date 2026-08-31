import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { loanApi, type LoanSubtype, type LoanType } from "@/api/loanApi";
import { actionButton, AdminModal, dateTime, Field, inr, StatusBadge } from "@/components/admin/admin-ui";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { LoanApplicationFields } from "@/components/loans/loan-application-fields";
import { useLogoutMutation } from "@/hooks/useAuthMutations";
import { getApiErrorMessage } from "@/lib/apiClient";

export function LoansPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const logout = useLogoutMutation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const loans = useQuery({ queryKey: ["loans"], queryFn: loanApi.loans });
  const requests = useQuery({ queryKey: ["loan-requests"], queryFn: loanApi.requests });
  const create = useMutation({
    mutationFn: (values: Record<string, string>) => loanApi.createRequest({
      loanType: values.loanType as LoanType,
      loanSubtype: values.loanSubtype as LoanSubtype,
      requestedAmount: Number(values.requestedAmount),
      durationMonths: Number(values.durationMonths),
      purpose: values.purpose,
    }),
    onSuccess: () => {
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["loan-requests"] });
    },
  });
  const cancel = useMutation({
    mutationFn: loanApi.cancelRequest,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["loan-requests"] }),
  });

  return (
    <div className="flex h-screen min-w-[1180px] overflow-hidden bg-bank-page">
      <DashboardSidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} onLogout={() => logout.mutate()} logoutPending={logout.isPending} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader title="Loans" subtitle="Applications, repayments, and active facilities" />
        <main className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mx-auto max-w-[1460px] space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setOpen(true)} className="flex h-9 items-center gap-2 rounded-xl bg-bank-blue px-4 text-xs font-bold text-white"><Plus size={15} /> Request Loan</button>
            </div>
            <section className="rounded-2xl border border-bank-border bg-white p-4">
              <h2 className="text-sm font-extrabold text-bank-navy">My Loans</h2>
              {loans.isLoading ? <p className="py-10 text-center text-xs text-bank-muted">Loading loans…</p> : loans.isError ? <p className="py-8 text-center text-xs text-red-600">{getApiErrorMessage(loans.error)}</p> : !loans.data?.length ? <div className="py-10 text-center"><Landmark className="mx-auto text-bank-blue" /><p className="mt-2 text-xs text-bank-muted">No active or historical loans.</p></div> : (
                <div className="mt-4 grid grid-cols-3 gap-3">{loans.data.map((loan: any) => (
                  <article key={loan.loan_id} className="rounded-xl border border-bank-border p-4">
                    <div className="flex justify-between"><b className="text-sm text-bank-navy">{loan.loan_type} {loan.loan_subtype ?? ""}</b><StatusBadge value={loan.status} /></div>
                    <p className="mt-4 text-[10px] uppercase text-bank-muted">Outstanding</p>
                    <p className="text-xl font-extrabold text-bank-navy">{inr.format(Number(loan.outstanding_principal))}</p>
                    <div className="mt-3 grid grid-cols-3 text-[10px] text-bank-muted">
                      <span>Rate<b className="block text-bank-navy">{Number(loan.interest_rate)}%</b></span>
                      <span>EMI<b className="block text-bank-navy">{inr.format(Number(loan.emi_amount))}</b></span>
                      <span>Next EMI<b className="block text-bank-navy">{loan.emi_schedules?.[0]?.due_date ? new Date(loan.emi_schedules[0].due_date).toLocaleDateString("en-IN") : "—"}</b></span>
                    </div>
                    <button onClick={() => navigate(`/loans/${loan.loan_id}`)} className="mt-4 w-full rounded-lg border py-2 text-xs font-bold text-bank-blue">View Details</button>
                  </article>
                ))}</div>
              )}
            </section>
            <section className="rounded-2xl border border-bank-border bg-white">
              <h2 className="border-b p-4 text-sm font-extrabold text-bank-navy">Loan Request History</h2>
              {requests.isLoading ? <p className="p-8 text-center text-xs">Loading requests…</p> : !requests.data?.length ? <p className="p-8 text-center text-xs text-bank-muted">No loan requests.</p> : (
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-[9px] uppercase text-bank-muted"><tr>{["Product", "Amount", "Duration", "Purpose", "Status", "Requested", "Action"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
                  <tbody>{requests.data.map((loanRequest: any) => (
                    <tr key={loanRequest.loan_request_id} className="border-t">
                      <td className="px-4 py-3 font-bold">{loanRequest.loan_type} {loanRequest.loan_subtype ?? ""}</td>
                      <td>{inr.format(Number(loanRequest.requested_amount))}</td><td>{loanRequest.duration_months} months</td>
                      <td className="max-w-56 truncate">{loanRequest.purpose}</td>
                      <td><StatusBadge value={loanRequest.status} />{loanRequest.rejection_reason ? <span className="block text-red-600">{loanRequest.rejection_reason}</span> : null}</td>
                      <td>{dateTime(loanRequest.created_at)}</td>
                      <td>{loanRequest.status === "PENDING" ? <button disabled={cancel.isPending} onClick={() => cancel.mutate(String(loanRequest.loan_request_id))} className={actionButton}>Cancel</button> : "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </section>
          </div>
        </main>
      </div>
      {open ? (
        <AdminModal title="Request a Loan" subtitle="Submit accurate information for bank review." pending={create.isPending} error={create.isError ? getApiErrorMessage(create.error) : undefined} submitLabel="Submit Request" onClose={() => setOpen(false)} onSubmit={(values) => create.mutate(values)}>
          <LoanApplicationFields />
          <Field name="purpose" label="Purpose" minLength={5} maxLength={500} />
        </AdminModal>
      ) : null}
    </div>
  );
}
