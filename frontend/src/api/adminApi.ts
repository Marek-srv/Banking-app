import { apiClient } from "@/lib/apiClient";

type Envelope<T> = { success: true; data: T };
export type Pagination = { page: number; limit: number; total: number; totalPages: number };
export type AdminList<T> = { items: T[]; pagination: Pagination };
export type AdminQuery = { page?: number; limit?: number; search?: string; status?: string; type?: string; kycStatus?: string; branchId?: string; customer?: string; entity?: string; from?: string; to?: string };

export type AdminDashboard = {
  totalCustomers: number; activeCustomers: number; totalAccounts: number; frozenAccounts: number; totalBalance: string; transactionsToday: number;
  activeCards: number; branches: number; employees: number; atms: number;
  activeLoans: number; pendingCustomerApprovals: number; pendingAccountRequests: number; pendingLoanRequests: number; pendingClosureRequests: number;
};
export type AdminCustomer = {
  customerId: string; customerNumber: string; firstName: string; lastName: string; email: string;
  phone?: string | null; dateOfBirth?: string | null; maritalStatus?: string | null; address?: string | null;
  city?: string | null; state?: string | null; postalCode?: string | null; country?: string | null;
  kycStatus: string; customerStatus: string; createdAt?: string;
  branch: { branchId: string; branchCode: string; branchName: string };
  accounts?: Array<{ accountId: string; maskedAccountNumber: string; accountType: string; currentBalance: string; currency: string; accountStatus: string }>;
  cards?: AdminCard[];
  transactions?: AdminTransaction[];
  accountRequests?: Array<Record<string, unknown>>; loanRequests?: Array<Record<string, unknown>>; loans?: Array<Record<string, unknown>>;
};
export type AdminAccount = {
  accountId: string; maskedAccountNumber: string; accountType: string; currency: string; currentBalance: string;
  availableBalance: string; accountStatus: string; openedAt: string;
  accountSubtype?: string | null; ifscCode?: string | null; perTransactionLimit?: string | null; dailyTransferLimit?: string | null;
  customer: { customerId: string; customerNumber: string; firstName: string; lastName: string };
  branch: { branchCode: string; branchName: string };
};
export type AdminTransaction = {
  transactionId: string; referenceNumber: string; transactionType: string; sourceAccount: string | null;
  destinationAccount: string | null; amount: string; currency: string; status: string; initiatedAt: string; completedAt: string | null;
  source?: { maskedAccountNumber: string; customerNumber: string; customerName: string } | null;
  destination?: { maskedAccountNumber: string; customerNumber: string; customerName: string } | null;
  details?: Array<{ description: string | null; merchant_payee: string | null; transaction_category: string | null; notes: string | null }>;
  description?: string | null;
};
export type AdminEmployee = { employeeId: string; employeeNumber: string; firstName: string; lastName: string; position: string | null; email: string | null; phone?: string | null; gender?: string | null; hireDate?: string | null; qualification?: string | null; status: string; branch: { branchId: string; branchCode: string; branchName: string } };
export type AdminBranch = { branchId: string; branchCode: string; branchName: string; address: string | null; city: string | null; state: string | null; postalCode: string | null; phone: string | null; email: string | null; operatingHours: string | null; status: string; manager: { employeeId: string; employeeNumber: string; name: string } | null; employees: Array<{ employeeId: string; employeeNumber: string; name: string; position: string | null; status: string }>; atms: Array<{ atmId: string; atmCode: string; location: string; status: string }>; counts: { employees: number; atms: number; accounts: number; customers: number } };
export type AdminAtm = { atmId: string; atmCode: string; location: string; status: string; operatingHours: string | null; supportedTransactions: string | null; branch: { branchId: string; branchCode: string; branchName: string; city: string | null } };
export type AdminCard = { cardId: string; cardReference: string; maskedCardNumber: string | null; cardType: string; cardStatus: string; createdAt: string; account: { maskedAccountNumber: string; accountType: string }; customer: { customerNumber: string; name: string } };
export type AdminAuditLog = { auditId: string; user: { email: string; customerNumber: string | null; name: string }; action: string; entity: string; entityId: string; ipAddress: string; reason?: string | null; metadata?: unknown; createdAt: string };
export type AdminAccountRequest = Record<string, any>;
export type AdminClosureRequest = Record<string, any>;
export type AdminLimitRequest = Record<string, any>;
export type AdminLoanRequest = Record<string, any>;
export type AdminLoan = Record<string, any>;

async function list<T>(path: string, query: AdminQuery) {
  const response = await apiClient.get<Envelope<AdminList<T>>>(path, { params: query });
  return response.data.data;
}
async function nestedList<T>(path: string, query: Record<string, unknown>) { return (await apiClient.get<Envelope<AdminList<T>>>(path, { params: query })).data.data; }
async function splitList<T>(path: string, query: Record<string, unknown>) { const response = await apiClient.get<{ success: true; data: T[]; pagination: Pagination }>(path, { params: query }); return { items: response.data.data, pagination: response.data.pagination }; }
async function allPages<T>(fetchPage:(query:AdminQuery)=>Promise<AdminList<T>>,query:AdminQuery){const first=await fetchPage({...query,page:1,limit:100});const items=[...first.items];for(let page=2;page<=first.pagination.totalPages;page++)items.push(...(await fetchPage({...query,page,limit:100})).items);return items;}

export const adminApi = {
  dashboard: async () => (await apiClient.get<Envelope<AdminDashboard>>("/admin/dashboard")).data.data,
  customers: (query: AdminQuery) => list<AdminCustomer>("/admin/customers", query),
  allCustomers: (query: AdminQuery) => allPages(q=>list<AdminCustomer>("/admin/customers",q),query),
  customer: async (id: string) => (await apiClient.get<Envelope<AdminCustomer>>(`/admin/customers/${id}`)).data.data,
  customerStatus: async (id: string, status: "ACTIVE" | "BLOCKED" | "INACTIVE") => (await apiClient.patch(`/admin/customers/${id}/status`, { status })).data.data,
  approveCustomer: async (id: string) => (await apiClient.post(`/admin/customers/${id}/approve`)).data.data,
  rejectCustomer: async (id: string, reason: string) => (await apiClient.post(`/admin/customers/${id}/reject`, { reason })).data.data,
  blockCustomer: async (id: string, reason: string) => (await apiClient.post(`/admin/customers/${id}/block`, { reason })).data.data,
  unblockCustomer: async (id: string) => (await apiClient.post(`/admin/customers/${id}/unblock`)).data.data,
  updateCustomerKyc: async (id: string, status: "PENDING" | "VERIFIED" | "REJECTED", reason?: string) => (await apiClient.patch(`/admin/customers/${id}/kyc`, { status, ...(reason ? { reason } : {}) })).data.data,
  accounts: (query: AdminQuery) => list<AdminAccount>("/admin/accounts", query),
  allAccounts: (query: AdminQuery) => allPages(q=>list<AdminAccount>("/admin/accounts",q),query),
  account: async (id: string) => (await apiClient.get(`/admin/accounts/${id}`)).data.data,
  freezeAccount: async (id: string, reason = "Administrative account freeze") => (await apiClient.post(`/admin/accounts/${id}/freeze`, { reason })).data.data,
  unfreezeAccount: async (id: string, reason = "Administrative account unfreeze") => (await apiClient.post(`/admin/accounts/${id}/unfreeze`, { reason })).data.data,
  closeAccount: async (id: string, reason = "Exceptional administrative account closure") => (await apiClient.patch(`/admin/accounts/${id}/close`, { reason })).data.data,
  reduceLimits: async (id: string, input: { perTransactionLimit?: number; dailyTransferLimit?: number; reason: string }) => (await apiClient.post(`/admin/accounts/${id}/limits/reduce`, input)).data.data,
  accountRequests: (query: Record<string, unknown>) => splitList<AdminAccountRequest>("/admin/account-requests", query),
  reviewAccountRequest: async (id: string) => (await apiClient.post(`/admin/account-requests/${id}/review`)).data.data,
  approveAccountRequest: async (id: string, input: Record<string, unknown>) => (await apiClient.post(`/admin/account-requests/${id}/approve`, input)).data.data,
  rejectAccountRequest: async (id: string, reason: string) => (await apiClient.post(`/admin/account-requests/${id}/reject`, { reason })).data.data,
  closureRequests: (query: Record<string, unknown>) => nestedList<AdminClosureRequest>("/admin/account-closure-requests", query),
  reviewClosureRequest: async (id: string) => (await apiClient.post(`/admin/account-closure-requests/${id}/review`)).data.data,
  approveClosureRequest: async (id: string) => (await apiClient.post(`/admin/account-closure-requests/${id}/approve`)).data.data,
  rejectClosureRequest: async (id: string, reason: string) => (await apiClient.post(`/admin/account-closure-requests/${id}/reject`, { reason })).data.data,
  limitRequests: (query: Record<string, unknown>) => nestedList<AdminLimitRequest>("/admin/transfer-limit-requests", query),
  reviewLimitRequest: async (id: string) => (await apiClient.post(`/admin/transfer-limit-requests/${id}/review`)).data.data,
  approveLimitRequest: async (id: string) => (await apiClient.post(`/admin/transfer-limit-requests/${id}/approve`)).data.data,
  rejectLimitRequest: async (id: string, reason: string) => (await apiClient.post(`/admin/transfer-limit-requests/${id}/reject`, { reason })).data.data,
  loanRequests: (query: Record<string, unknown>) => nestedList<AdminLoanRequest>("/admin/loan-requests", query),
  reviewLoanRequest: async (id: string) => (await apiClient.post(`/admin/loan-requests/${id}/review`)).data.data,
  approveLoanRequest: async (id: string, input: Record<string, unknown>) => (await apiClient.post(`/admin/loan-requests/${id}/approve`, input)).data.data,
  rejectLoanRequest: async (id: string, reason: string) => (await apiClient.post(`/admin/loan-requests/${id}/reject`, { reason })).data.data,
  loans: (query: Record<string, unknown>) => nestedList<AdminLoan>("/admin/loans", query),
  loan: async (id: string) => (await apiClient.get<Envelope<AdminLoan>>(`/admin/loans/${id}`)).data.data,
  disburseLoan: async (id: string) => (await apiClient.post(`/admin/loans/${id}/disburse`, {})).data.data,
  cardRequests: (query: Record<string, unknown>) => nestedList<any>("/admin/card-requests", query),
  reviewCardRequest: async (id: string) => (await apiClient.post(`/admin/card-requests/${id}/review`)).data.data,
  approveCardRequest: async (id: string) => (await apiClient.post(`/admin/card-requests/${id}/approve`)).data.data,
  rejectCardRequest: async (id: string, reason: string) => (await apiClient.post(`/admin/card-requests/${id}/reject`, { reason })).data.data,
  transactions: (query: AdminQuery) => list<AdminTransaction>("/admin/transactions", query),
  allTransactions: (query: AdminQuery) => allPages(q=>list<AdminTransaction>("/admin/transactions",q),query),
  transaction: async (id: string) => (await apiClient.get<Envelope<AdminTransaction>>(`/admin/transactions/${id}`)).data.data,
  employees: (query: AdminQuery) => list<AdminEmployee>("/admin/employees", query),
  createEmployee: async (input: Record<string, string>) => (await apiClient.post("/admin/employees", input)).data.data,
  updateEmployee: async (id: string, input: Record<string, string>) => (await apiClient.patch(`/admin/employees/${id}`, input)).data.data,
  employeeStatus: async (id: string, status: "ACTIVE" | "INACTIVE") => (await apiClient.patch(`/admin/employees/${id}/status`, { status })).data.data,
  branches: (query: AdminQuery) => list<AdminBranch>("/admin/branches", query),
  createBranch: async (input: Record<string, string>) => (await apiClient.post("/admin/branches", input)).data.data,
  updateBranch: async (id: string, input: Record<string, string>) => (await apiClient.patch(`/admin/branches/${id}`, input)).data.data,
  branchStatus: async (id: string, status: "ACTIVE" | "INACTIVE") => (await apiClient.patch(`/admin/branches/${id}/status`, { status })).data.data,
  branchManager: async (id: string, managerId: string | null) => (await apiClient.patch(`/admin/branches/${id}/manager`, { managerId })).data.data,
  atms: (query: AdminQuery) => list<AdminAtm>("/admin/atms", query),
  createAtm: async (input: Record<string, string>) => (await apiClient.post("/admin/atms", input)).data.data,
  updateAtm: async (id: string, input: Record<string, string>) => (await apiClient.patch(`/admin/atms/${id}`, input)).data.data,
  atmStatus: async (id: string, status: "ACTIVE" | "MAINTENANCE" | "OUT_OF_SERVICE") => (await apiClient.patch(`/admin/atms/${id}/status`, { status })).data.data,
  cards: (query: AdminQuery) => list<AdminCard>("/admin/cards", query),
  auditLogs: (query: AdminQuery) => list<AdminAuditLog>("/admin/audit-logs", query),
};
