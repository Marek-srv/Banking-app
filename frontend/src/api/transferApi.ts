import { apiClient } from "@/lib/apiClient";

type SuccessEnvelope<T> = { success: true; data: T };

type RawTransfer = {
  transaction_id?: string | number;
  transactionId?: string | number;
  reference_number?: string;
  referenceNumber?: string;
  amount?: string | number;
  currency?: string;
  status?: string;
  completed_at?: string | null;
  completedAt?: string | null;
};

export type CreateTransferRequest = {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  remarks?: string;
};

export type CompletedTransfer = {
  transactionId: string;
  referenceNumber: string;
  amount: number;
  currency: string;
  status: string;
  completedAt?: string;
};

export const transferApi = {
  async createTransfer(payload: CreateTransferRequest, idempotencyKey: string): Promise<CompletedTransfer> {
    const response = await apiClient.post<SuccessEnvelope<RawTransfer>>("/transfers", payload, {
      headers: { "Idempotency-Key": idempotencyKey },
    });
    const raw = response.data.data;
    return {
      transactionId: String(raw.transactionId ?? raw.transaction_id ?? ""),
      referenceNumber: raw.referenceNumber ?? raw.reference_number ?? "",
      amount: Number(raw.amount ?? payload.amount),
      currency: raw.currency ?? "INR",
      status: raw.status ?? "COMPLETED",
      completedAt: raw.completedAt ?? raw.completed_at ?? undefined,
    };
  },
};
