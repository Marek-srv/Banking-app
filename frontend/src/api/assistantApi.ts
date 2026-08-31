import { apiClient } from "@/lib/apiClient";

type SuccessEnvelope<T> = {
  success: true;
  data: T;
};

export type AssistantAnswer = {
  answer: string;
  questionType: string;
};

export const assistantApi = {
  async query(question: string) {
    const response = await apiClient.post<SuccessEnvelope<AssistantAnswer>>(
      "/assistant/query",
      { question },
      { timeout: 65_000 },
    );
    return response.data.data;
  },
};
