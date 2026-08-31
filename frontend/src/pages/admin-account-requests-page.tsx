import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { adminApi } from "@/api/adminApi";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminModal, Field, SelectField, StatusBadge, actionButton, dateTime, inr } from "@/components/admin/admin-ui";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { getApiErrorMessage } from "@/lib/apiClient";

type Action={type:"review"|"approve"|"reject";item:any};
export function AdminAccountRequestsPage(){
  const [params]=useSearchParams(); const qc=useQueryClient();
  const [page,setPage]=useState(1); const [pageSize,setPageSize]=useState(10);
  const [status,setStatus]=useState(params.get("status")??""); const [type,setType]=useState("");
  const [action,setAction]=useState<Action|null>(null);
  const query=useQuery({queryKey:["admin","account-requests",{page,pageSize,status,type}],queryFn:()=>adminApi.accountRequests({page,limit:pageSize,...(status?{status}:{}),...(type?{accountType:type}:{})})});
  const branches=useQuery({queryKey:["admin","branches","request-options"],queryFn:()=>adminApi.branches({page:1,limit:100}),staleTime:60000});
  const mutation=useMutation({
    mutationFn:(values:Record<string,string>)=>{
      const id=String(action!.item.account_request_id);
      if(action!.type==="review") return adminApi.reviewAccountRequest(id);
      if(action!.type==="reject") return adminApi.rejectAccountRequest(id,values.reason);
      return adminApi.approveAccountRequest(id,{approvedBranchId:values.approvedBranchId,approvedPerTransactionLimit:Number(values.approvedPerTransactionLimit),approvedDailyTransferLimit:Number(values.approvedDailyTransferLimit)});
    },
    onSuccess:()=>{setAction(null);void qc.invalidateQueries({queryKey:["admin"]});},
  });
  const rows=query.data?.items??[];
  return <AdminLayout title="Account Requests" subtitle="Paginated customer account-opening requests">
    <section className="rounded-2xl border bg-white">
      <div className="flex gap-3 border-b p-4">
        <select value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}} className="h-10 rounded-lg border px-3 text-xs"><option value="">All statuses</option>{["PENDING","UNDER_REVIEW","APPROVED","REJECTED","CANCELLED"].map(x=><option key={x}>{x}</option>)}</select>
        <select value={type} onChange={e=>{setType(e.target.value);setPage(1)}} className="h-10 rounded-lg border px-3 text-xs"><option value="">All types</option><option>SAVINGS</option><option>CURRENT</option></select>
      </div>
      {query.isLoading?<p className="p-10 text-center text-xs">Loading requests…</p>:query.isError?<p className="p-10 text-center text-xs text-red-600">{getApiErrorMessage(query.error)}</p>:!rows.length?<p className="p-10 text-center text-xs text-bank-muted">No matching requests.</p>:<table className="w-full text-left text-[10px]"><thead className="bg-slate-50"><tr>{["Request","Customer","Product","Branch","Limits","Status","Submitted","Updated","Actions"].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{rows.map((r:any)=><tr className="border-t" key={r.account_request_id}><td className="px-3 py-3">#{r.account_request_id}</td><td>{r.customers.first_name} {r.customers.last_name}<small className="block">{r.customers.customer_number}</small></td><td>{r.account_type} {r.account_subtype??""}</td><td>{r.preferred_branch?.branch_name??"—"}</td><td>{inr.format(Number(r.requested_per_transaction_limit))}<small className="block">Daily {inr.format(Number(r.requested_daily_transfer_limit))}</small></td><td><StatusBadge value={r.status}/>{r.rejection_reason?<small className="block text-red-600">{r.rejection_reason}</small>:null}</td><td>{dateTime(r.created_at)}</td><td>{dateTime(r.updated_at)}</td><td><div className="flex gap-1">{r.status==="PENDING"?<button className={actionButton} onClick={()=>setAction({type:"review",item:r})}>Review</button>:null}{r.status==="UNDER_REVIEW"?<button className={actionButton} onClick={()=>setAction({type:"approve",item:r})}>Approve</button>:null}{["PENDING","UNDER_REVIEW"].includes(r.status)?<button className={actionButton} onClick={()=>setAction({type:"reject",item:r})}>Reject</button>:null}</div></td></tr>)}</tbody></table>}
      <AdminPagination pagination={query.data?.pagination} page={page} pageSize={pageSize} onPage={setPage} onPageSize={n=>{setPageSize(n);setPage(1)}}/>
    </section>
    {action?<AdminModal title={`${action.type} account request`} pending={mutation.isPending} error={mutation.isError?getApiErrorMessage(mutation.error):undefined} submitLabel="Confirm" onClose={()=>setAction(null)} onSubmit={v=>mutation.mutate(v)}>{action.type==="reject"?<Field name="reason" label="Reason"/>:action.type==="approve"?<><SelectField name="approvedBranchId" label="Approved Branch" defaultValue={String(action.item.preferred_branch?.branch_id??"")}>{branches.data?.items.map(b=><option key={b.branchId} value={b.branchId}>{b.branchName}</option>)}</SelectField><Field name="approvedPerTransactionLimit" label="Per Transaction Limit" type="number" defaultValue={Number(action.item.requested_per_transaction_limit)}/><Field name="approvedDailyTransferLimit" label="Daily Limit" type="number" defaultValue={Number(action.item.requested_daily_transfer_limit)}/></>:<p className="text-xs text-bank-muted">Move this request to review?</p>}</AdminModal>:null}
  </AdminLayout>;
}
