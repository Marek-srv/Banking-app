import { apiClient } from "@/lib/apiClient";

export const LOAN_PRODUCTS = {
  PERSONAL: ["UNSECURED_PERSONAL"],
  HOME: ["HOME_PURCHASE"],
  VEHICLE: ["NEW_VEHICLE"],
  EDUCATION: ["HIGHER_EDUCATION"],
} as const;

export type LoanType = keyof typeof LOAN_PRODUCTS;
export type LoanSubtype = (typeof LOAN_PRODUCTS)[LoanType][number];
type Nested<T>={success:true;data:{items:T[];pagination:unknown}};type Envelope<T>={success:true;data:T};
export type LoanRequest=Record<string,any>;export type Loan=Record<string,any>;export type Emi=Record<string,any>;
export const loanApi={
  preview:async(requestedAmount:number,durationMonths:number)=>(await apiClient.get<Envelope<{interestRate:number;estimatedEmi:number}>>('/loan-requests/preview',{params:{requestedAmount,durationMonths}})).data.data,
  requests:async()=>{const items=(await apiClient.get<Nested<LoanRequest>>('/loan-requests',{params:{page:1,limit:100}})).data.data.items;return items.map(item=>({...item,duration_months:item.requested_duration_months??item.duration_months}));},
  createRequest:async(input:{requestedAmount:number;durationMonths:number;loanType:LoanType;loanSubtype:LoanSubtype;purpose:string})=>(await apiClient.post('/loan-requests',input)).data.data,
  cancelRequest:async(id:string)=>(await apiClient.post(`/loan-requests/${id}/cancel`)).data.data,
  loans:async()=>(await apiClient.get<Nested<Loan>>('/loans',{params:{page:1,limit:100}})).data.data.items,
  loan:async(id:string)=>(await apiClient.get<Envelope<Loan>>(`/loans/${id}`)).data.data,
  emis:async(id:string)=>(await apiClient.get<Envelope<Emi[]>>(`/loans/${id}/emis`)).data.data,
  payEmi:async(loanId:string,emiId:string,sourceAccountId:string)=>(await apiClient.post(`/loans/${loanId}/emis/${emiId}/pay`,{sourceAccountId})).data.data,
  autoDebit:async(loanId:string,enabled:boolean,accountId?:string)=>(await apiClient.patch(`/loans/${loanId}/auto-debit`,{enabled,...(accountId?{accountId}:{})})).data.data,
  prepay:async(loanId:string,sourceAccountId:string,amount:number)=>(await apiClient.post(`/loans/${loanId}/prepay`,{sourceAccountId,amount})).data.data,
  foreclosureQuote:async(loanId:string)=>(await apiClient.get<Envelope<{outstandingPrincipal:string;accruedCharges:string;totalPayable:string}>>(`/loans/${loanId}/foreclosure-quote`)).data.data,
  foreclose:async(loanId:string,sourceAccountId:string)=>(await apiClient.post(`/loans/${loanId}/foreclose`,{sourceAccountId})).data.data,
};
