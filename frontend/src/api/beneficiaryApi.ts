import { apiClient } from "@/lib/apiClient";

type SuccessEnvelope<T> = {
  success: true;
  data: T;
  pagination?: { totalPages?: number };
};

type RawBeneficiary = {
  beneficiary_id?: string | number;
  beneficiaryId?: string | number;
  beneficiary_name?: string;
  beneficiaryName?: string;
  beneficiary_account_no?: string;
  beneficiaryAccountNo?: string;
  bank_name?: string | null;
  bankName?: string | null;
  bank_code?: string | null;
  bankCode?: string | null;
  nickname?: string | null;
  status?: string;
  destination_account_id?: string | number | null;
  destinationAccountId?: string | number | null;
};

export type Beneficiary = {
  beneficiaryId: string;
  beneficiaryName: string;
  maskedAccountNumber: string;
  bankName: string;
  ifscCode: string;
  nickname?: string;
  status: string;
  destinationAccountId?: string;
};

export type CreateBeneficiaryRequest = {
  beneficiaryName: string;
  beneficiaryAccountNo: string;
  bankName: string;
  bankCode: string;
  nickname?: string;
};

function maskAccountNumber(accountNumber = "") {
  return `••••${accountNumber.slice(-4).padStart(4, "•")}`;
}

function normalizeBeneficiary(raw: RawBeneficiary): Beneficiary {
  const beneficiaryId = raw.beneficiaryId ?? raw.beneficiary_id;
  if (beneficiaryId === undefined) throw new Error("Beneficiary response is missing its identifier");

  return {
    beneficiaryId: String(beneficiaryId),
    beneficiaryName: raw.beneficiaryName ?? raw.beneficiary_name ?? "Beneficiary",
    maskedAccountNumber: maskAccountNumber(raw.beneficiaryAccountNo ?? raw.beneficiary_account_no),
    bankName: raw.bankName ?? raw.bank_name ?? "Bank not provided",
    ifscCode: raw.bankCode ?? raw.bank_code ?? "Not provided",
    nickname: raw.nickname ?? undefined,
    status: raw.status ?? "UNKNOWN",
    destinationAccountId: raw.destinationAccountId === null || raw.destination_account_id === null
      ? undefined
      : String(raw.destinationAccountId ?? raw.destination_account_id ?? "") || undefined,
  };
}

export const beneficiaryApi = {
  async listBeneficiaries() {
    const requestPage = (page: number) => apiClient.get<SuccessEnvelope<RawBeneficiary[]>>("/beneficiaries", { params: { page, limit: 100 } });
    const firstPage = await requestPage(1);
    const pages = [firstPage.data.data];
    const totalPages = firstPage.data.pagination?.totalPages ?? 1;

    for (let page = 2; page <= totalPages; page += 1) {
      const response = await requestPage(page);
      pages.push(response.data.data);
    }

    return pages.flat().map(normalizeBeneficiary);
  },

  async createBeneficiary(payload: CreateBeneficiaryRequest) {
    const response = await apiClient.post<SuccessEnvelope<RawBeneficiary>>("/beneficiaries", payload);
    return normalizeBeneficiary(response.data.data);
  },

  async removeBeneficiary(beneficiaryId: string) {
    const response = await apiClient.delete<SuccessEnvelope<RawBeneficiary>>(`/beneficiaries/${beneficiaryId}`);
    return normalizeBeneficiary(response.data.data);
  },
};
