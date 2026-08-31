import { apiClient } from "@/lib/apiClient";

type SuccessEnvelope<T> = {
  success: true;
  data: T;
  pagination?: { totalPages?: number };
};

type RawCard = {
  card_id?: string | number;
  cardId?: string | number;
  card_reference?: string;
  cardReference?: string;
  masked_card_number?: string | null;
  maskedCardNumber?: string | null;
  card_type?: string;
  cardType?: string;
  card_status?: string;
  cardStatus?: string;
  account_id?: string | number;
  accountId?: string | number;
  network?: string;
};

export type BankCard = {
  cardId: string;
  cardReference: string;
  maskedCardNumber: string;
  shortMaskedNumber: string;
  lastFour: string;
  cardType: string;
  cardStatus: string;
  accountId?: string;
  network: string;
};

export type CreateCardInput = {
  accountId: string;
  cardType: "DEBIT" | "CREDIT";
  notes?: string;
};

export type CardRequest = { card_request_id: string; account_id: string; card_type: string; status: string; rejection_reason?: string | null; created_at: string };

function normalizeCard(raw: RawCard): BankCard {
  const cardId = raw.cardId ?? raw.card_id;
  if (cardId === undefined) throw new Error("Card response is missing its identifier");
  const suppliedMask = raw.maskedCardNumber ?? raw.masked_card_number ?? "";
  const lastFour = suppliedMask.replace(/\D/g, "").slice(-4).padStart(4, "•");
  const accountId = raw.accountId ?? raw.account_id;

  return {
    cardId: String(cardId),
    cardReference: raw.cardReference ?? raw.card_reference ?? "",
    maskedCardNumber: `•••• •••• •••• ${lastFour}`,
    shortMaskedNumber: `••••${lastFour}`,
    lastFour,
    cardType: raw.cardType ?? raw.card_type ?? "DEBIT",
    cardStatus: raw.cardStatus ?? raw.card_status ?? "UNKNOWN",
    accountId: accountId === undefined ? undefined : String(accountId),
    network: raw.network ?? "VISA",
  };
}

export const cardApi = {
  async listCards() {
    const requestPage = (page: number) => apiClient.get<SuccessEnvelope<RawCard[]>>("/cards", { params: { page, limit: 100 } });
    const firstPage = await requestPage(1);
    const pages = [firstPage.data.data];
    const totalPages = firstPage.data.pagination?.totalPages ?? 1;
    for (let page = 2; page <= totalPages; page += 1) pages.push((await requestPage(page)).data.data);
    return pages.flat().map(normalizeCard);
  },

  async getCard(cardId: string) {
    const response = await apiClient.get<SuccessEnvelope<RawCard>>(`/cards/${cardId}`);
    return normalizeCard(response.data.data);
  },

  async createRequest(input: CreateCardInput) {
    return (await apiClient.post<SuccessEnvelope<CardRequest>>("/card-requests", input)).data.data;
  },

  async listRequests() {
    return (await apiClient.get<SuccessEnvelope<{items:CardRequest[]}>>("/card-requests", { params: { page: 1, limit: 100 } })).data.data.items;
  },

  async cancelRequest(requestId:string) {
    return (await apiClient.post<SuccessEnvelope<CardRequest>>(`/card-requests/${requestId}/cancel`)).data.data;
  },

  async blockCard(cardId: string) {
    const response = await apiClient.patch<SuccessEnvelope<RawCard>>(`/cards/${cardId}/block`);
    return normalizeCard(response.data.data);
  },

  async unblockCard(cardId: string) {
    const response = await apiClient.patch<SuccessEnvelope<RawCard>>(`/cards/${cardId}/unblock`);
    return normalizeCard(response.data.data);
  },
};
