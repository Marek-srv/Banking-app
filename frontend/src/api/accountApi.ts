import { apiClient } from "@/lib/apiClient";

type SuccessEnvelope<T> = {
  success: true;
  data: T;
  pagination?: {
    totalPages?: number;
  };
};

type RawAccount = {
  account_id?: string | number;
  accountId?: string | number;
  account_number?: string;
  accountNumber?: string;
  account_type?: string;
  accountType?: string;
  currency?: string;
  current_balance?: string | number;
  currentBalance?: string | number;
  available_balance?: string | number;
  availableBalance?: string | number;
  account_status?: string;
  accountStatus?: string;
  branch_id?: string | number;
  branchId?: string | number;
  branch_name?: string;
  branchName?: string;
  account_subtype?: string | null;
  accountSubtype?: string | null;
  ifsc_code?: string | null;
  ifscCode?: string | null;
  per_transaction_limit?: string | number | null;
  perTransactionLimit?: string | number | null;
  daily_transfer_limit?: string | number | null;
  dailyTransferLimit?: string | number | null;
};

type RawTransactionDetail = {
  merchant_payee?: string | null;
  merchantPayee?: string | null;
  description?: string | null;
  transaction_category?: string | null;
  transactionCategory?: string | null;
  notes?: string | null;
};

type RawTransaction = {
  transaction_id?: string | number;
  transactionId?: string | number;
  reference_number?: string;
  referenceNumber?: string;
  transaction_type?: string;
  transactionType?: string;
  source_account_id?: string | number | null;
  sourceAccountId?: string | number | null;
  destination_account_id?: string | number | null;
  destinationAccountId?: string | number | null;
  amount?: string | number;
  currency?: string;
  status?: string;
  initiated_at?: string;
  initiatedAt?: string;
  transaction_details?: RawTransactionDetail[];
  transactionDetails?: RawTransactionDetail[];
};

type RawBranch = {
  branchName?: string;
  branch_name?: string;
};

export type Account = {
  accountId: string;
  maskedAccountNumber: string;
  accountType: string;
  currency: string;
  currentBalance: number;
  availableBalance: number;
  status: string;
  accountStatus: string;
  accountSubtype?: string;
  ifscCode?: string;
  perTransactionLimit?: number;
  dailyTransferLimit?: number;
  branchLookupId?: string;
  branchName?: string;
};

export type AccountTransaction = {
  transactionId: string;
  referenceNumber: string;
  type: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  amount: number;
  currency: string;
  status: string;
  initiatedAt: string;
  description: string;
  category: string;
  categoryAvailable: boolean;
  remarks: string;
};

export type TransactionQuery = {
  from?: string;
  to?: string;
  type?: string;
  status?: string | null;
};

export type CreateAccountInput = {
  accountType: "SAVINGS" | "CURRENT";
};

function asId(value: string | number | null | undefined) {
  return value === null || value === undefined ? undefined : String(value);
}

function maskAccountNumber(value = "") {
  const lastFour = value.slice(-4).padStart(4, "•");
  return `•••• ${lastFour}`;
}

function normalizeAccount(account: RawAccount): Account {
  const accountId = asId(account.accountId ?? account.account_id);

  if (!accountId) {
    throw new Error("Account response is missing its identifier");
  }

  const accountNumber = account.accountNumber ?? account.account_number ?? "";

  return {
    accountId,
    maskedAccountNumber: maskAccountNumber(accountNumber),
    accountType: account.accountType ?? account.account_type ?? "ACCOUNT",
    currency: account.currency ?? "INR",
    currentBalance: Number(account.currentBalance ?? account.current_balance ?? 0),
    availableBalance: Number(account.availableBalance ?? account.available_balance ?? 0),
    status: account.accountStatus ?? account.account_status ?? "UNKNOWN",
    accountStatus: account.accountStatus ?? account.account_status ?? "UNKNOWN",
    branchLookupId: asId(account.branchId ?? account.branch_id),
    branchName: account.branchName ?? account.branch_name,
    accountSubtype: account.accountSubtype ?? account.account_subtype ?? undefined,
    ifscCode: account.ifscCode ?? account.ifsc_code ?? undefined,
    perTransactionLimit: account.perTransactionLimit === null || account.per_transaction_limit === null ? undefined : Number(account.perTransactionLimit ?? account.per_transaction_limit),
    dailyTransferLimit: account.dailyTransferLimit === null || account.daily_transfer_limit === null ? undefined : Number(account.dailyTransferLimit ?? account.daily_transfer_limit),
  };
}

function normalizeTransaction(transaction: RawTransaction): AccountTransaction {
  const details = transaction.transactionDetails ?? transaction.transaction_details ?? [];
  const firstDetail = details[0];
  const type = transaction.transactionType ?? transaction.transaction_type ?? "TRANSACTION";
  const suppliedCategory = firstDetail?.transactionCategory ?? firstDetail?.transaction_category;

  return {
    transactionId: asId(transaction.transactionId ?? transaction.transaction_id) ?? "unknown",
    referenceNumber: transaction.referenceNumber ?? transaction.reference_number ?? "",
    type,
    sourceAccountId: asId(transaction.sourceAccountId ?? transaction.source_account_id),
    destinationAccountId: asId(transaction.destinationAccountId ?? transaction.destination_account_id),
    amount: Number(transaction.amount ?? 0),
    currency: transaction.currency ?? "INR",
    status: transaction.status ?? "UNKNOWN",
    initiatedAt: transaction.initiatedAt ?? transaction.initiated_at ?? new Date(0).toISOString(),
    description:
      firstDetail?.merchantPayee ??
      firstDetail?.merchant_payee ??
      firstDetail?.description ??
      type.replace(/_/g, " "),
    category: suppliedCategory ??
      (type === "WITHDRAWAL" ? "Cash Withdrawal" : type === "DEPOSIT" ? "Income" : "Transfer"),
    categoryAvailable: Boolean(suppliedCategory?.trim()),
    remarks: firstDetail?.notes ?? firstDetail?.description ?? "No remarks provided",
  };
}

export const accountApi = {
  async listAccounts() {
    const response = await apiClient.get<SuccessEnvelope<RawAccount[]>>("/accounts", {
      params: { page: 1, limit: 100 },
    });
    return response.data.data.map(normalizeAccount);
  },

  async getAccount(accountId: string) {
    const response = await apiClient.get<SuccessEnvelope<RawAccount>>(`/accounts/${accountId}`);
    return normalizeAccount(response.data.data);
  },

  async createAccount(input: CreateAccountInput) {
    const response = await apiClient.post<SuccessEnvelope<RawAccount>>("/accounts", input);
    return normalizeAccount(response.data.data);
  },

  async listTransactions(params: TransactionQuery = {}) {
    const { status = "COMPLETED", ...filters } = params;
    const requestPage = (page: number) => apiClient.get<SuccessEnvelope<RawTransaction[]>>("/transactions", {
      params: {
        page,
        limit: 100,
        ...filters,
        ...(status ? { status } : {}),
      },
    });
    const firstPage = await requestPage(1);
    const totalPages = firstPage.data.pagination?.totalPages ?? 1;
    const remainingPages: RawTransaction[][] = [];

    for (let page = 2; page <= totalPages; page += 1) {
      const response = await requestPage(page);
      remainingPages.push(response.data.data);
    }

    return [firstPage.data.data, ...remainingPages].flat().map(normalizeTransaction);
  },

  async getTransaction(transactionId: string) {
    const response = await apiClient.get<SuccessEnvelope<RawTransaction>>(`/transactions/${transactionId}`);
    return normalizeTransaction(response.data.data);
  },

  async getBranchName(branchId: string) {
    const response = await apiClient.get<SuccessEnvelope<RawBranch>>(`/branches/${branchId}`);
    return response.data.data.branchName ?? response.data.data.branch_name ?? "Branch on file";
  },
};
