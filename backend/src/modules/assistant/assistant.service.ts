import { env } from "../../config/env";
import {
  BankingAnalytics,
  calculateBankingAnalytics,
  classifyQuestion,
} from "./analytics.service";

type OllamaGenerateResponse = {
  response?: unknown;
};

export type AssistantResponse = {
  answer: string;
  questionType: BankingAnalytics["questionType"];
};

export type AnalyticsExplainer = (analytics: BankingAnalytics) => Promise<string>;

export async function explainWithOllama(analytics: BankingAnalytics): Promise<string> {
  const configuration = env.OLLAMA;

  if (!configuration) {
    throw new Error("ASSISTANT_UNAVAILABLE");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), configuration.timeoutMs);

  try {
    const response = await fetch(`${configuration.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: configuration.model,
        stream: false,
        prompt: [
          "You are the read-only π Bank assistant.",
          "Return the approved banking answer below verbatim.",
          "Do not add, remove, reorder, calculate, infer, advise, or alter any word, amount, count, date, or limitation.",
          "Do not mention databases or claim that you can take actions.",
          "Return only the approved answer with no prefix, quotation marks, or commentary.",
          `Analysis type: ${analytics.questionType}`,
          `Approved answer: ${analytics.draftAnswer}`,
        ].join("\n"),
        options: { temperature: 0, num_predict: 120 },
      }),
    });

    if (!response.ok) {
      throw new Error("OLLAMA_REQUEST_FAILED");
    }

    const payload = (await response.json()) as OllamaGenerateResponse;
    if (typeof payload.response !== "string" || !payload.response.trim()) {
      throw new Error("OLLAMA_RESPONSE_INVALID");
    }

    const candidate = payload.response.replace(/\s+/g, " ").trim();
    const approved = analytics.draftAnswer.replace(/\s+/g, " ").trim();

    // Local models can still invent financial facts despite a strict prompt.
    // Only a verbatim result is trusted; otherwise return the backend-calculated answer.
    return candidate === approved ? candidate : approved;
  } catch (error) {
    if (error instanceof Error && error.message === "ASSISTANT_UNAVAILABLE") {
      throw error;
    }
    throw new Error("ASSISTANT_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }
}

export async function queryAssistant(
  userId: bigint,
  question: string,
  explain: AnalyticsExplainer = explainWithOllama
): Promise<AssistantResponse> {
  const classified = classifyQuestion(question);
  const analytics = await calculateBankingAnalytics(userId, classified);
  const answer = await explain(analytics);
  return { answer, questionType: analytics.questionType };
}
