import { apiClient } from "@/lib/apiClient";
type Pagination={page:number;limit:number;total:number;totalPages:number};
type Split<T>={success:true;data:T[];pagination:Pagination};type Nested<T>={success:true;data:{items:T[];pagination:Pagination}};
export type AccountRequest=Record<string,any>;export type ClosureRequest=Record<string,any>;export type LimitRequest=Record<string,any>;export type Branch={branchId:string;branchCode:string;branchName:string;status?:string};
export type AccountRequestInput={accountType:"SAVINGS"|"CURRENT";accountSubtype?:string;preferredBranchId:string;purpose?:string;requestedPerTransactionLimit:number;requestedDailyTransferLimit:number;notes?:string};
export const customerServicingApi={
  branches:async()=>{const r=await apiClient.get<{success:true;data:Branch[]}>('/branches',{params:{page:1,limit:100}});return r.data.data;},
  accountRequests:async()=>{const r=await apiClient.get<Split<AccountRequest>>('/account-requests',{params:{page:1,limit:100}});return r.data.data;},
  createAccountRequest:async(input:AccountRequestInput)=>(await apiClient.post('/account-requests',input)).data.data,
  updateAccountRequest:async(id:string,input:Partial<AccountRequestInput>)=>(await apiClient.patch(`/account-requests/${id}`,input)).data.data,
  cancelAccountRequest:async(id:string)=>(await apiClient.post(`/account-requests/${id}/cancel`)).data.data,
  closureRequests:async()=>{const r=await apiClient.get<Nested<ClosureRequest>>('/account-closure-requests',{params:{page:1,limit:100}});return r.data.data.items;},
  createClosureRequest:async(accountId:string,reason:string)=>(await apiClient.post('/account-closure-requests',{accountId,reason})).data.data,
  cancelClosureRequest:async(id:string)=>(await apiClient.post(`/account-closure-requests/${id}/cancel`)).data.data,
  limitRequests:async()=>{const r=await apiClient.get<Nested<LimitRequest>>('/transfer-limit-requests',{params:{page:1,limit:100}});return r.data.data.items;},
  createLimitRequest:async(input:{accountId:string;requestedPerTransactionLimit:number;requestedDailyTransferLimit:number;reason:string})=>(await apiClient.post('/transfer-limit-requests',input)).data.data,
  cancelLimitRequest:async(id:string)=>(await apiClient.post(`/transfer-limit-requests/${id}/cancel`)).data.data,
};
