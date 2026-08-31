import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, ChevronRight, LoaderCircle, Send, Sparkles, X } from "lucide-react";

import { assistantApi } from "@/api/assistantApi";
import { getApiErrorMessage } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

const suggestedQuestions = [
  "Where did I spend the most this month?",
  "Show my average monthly spending",
  "Compare this month with last month",
  "How much did I spend on shopping?",
];

type ConversationMessage = {
  id: number;
  role: "customer" | "assistant";
  text: string;
  error?: boolean;
};

function appendMessage(current: ConversationMessage[], message: ConversationMessage) {
  return [...current, message].slice(-8);
}

type OllamaPanelProps = {
  drawer?: boolean;
  open?: boolean;
  onClose?: () => void;
  customerName?: string;
};

function AssistantContent({ onClose, customerName }: Pick<OllamaPanelProps, "onClose" | "customerName">) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const messageId = useRef(0);
  const scrollArea = useRef<HTMLDivElement>(null);

  const queryMutation = useMutation({
    mutationFn: assistantApi.query,
    onSuccess: (result) => {
      setMessages((current) => appendMessage(current, {
        id: ++messageId.current,
        role: "assistant",
        text: result.answer,
      }));
    },
    onError: (error) => {
      setMessages((current) => appendMessage(current, {
          id: ++messageId.current,
          role: "assistant",
          text: getApiErrorMessage(error),
          error: true,
      }));
    },
  });

  useEffect(() => {
    scrollArea.current?.scrollTo({ top: scrollArea.current.scrollHeight, behavior: "smooth" });
  }, [messages, queryMutation.isPending]);

  function ask(value: string) {
    const trimmed = value.trim();
    if (!trimmed || queryMutation.isPending) return;

    setMessages((current) => appendMessage(current, {
      id: ++messageId.current,
      role: "customer",
      text: trimmed,
    }));
    setQuestion("");
    queryMutation.mutate(trimmed);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(question);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[70px] shrink-0 items-center gap-3 border-b border-bank-border px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bank-light text-bank-blue">
          <Bot size={21} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-bank-navy">Banking Assistant</h2>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-bank-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Powered by Ollama
          </p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-bank-muted hover:bg-bank-page" aria-label="Close assistant">
            <X size={18} />
          </button>
        )}
      </div>

      <div ref={scrollArea} className="flex-1 overflow-y-auto px-5 py-5" aria-live="polite">
        <div className="rounded-2xl rounded-tl-md bg-bank-light px-4 py-3 text-[13px] leading-5 text-bank-text">
          <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-bank-blue">
            <Sparkles size={14} /> π Assistant
          </div>
          Hello {customerName?.split(" ")[0] ?? "there"}! I can help you understand your spending and banking activity.
        </div>

        <p className="mb-3 mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-bank-muted">Suggested questions</p>
        <div className="space-y-2">
          {suggestedQuestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => ask(suggestion)}
              disabled={queryMutation.isPending}
              className="group flex w-full items-center gap-2 rounded-xl border border-bank-border bg-white px-3.5 py-2.5 text-left text-[11px] leading-4 text-bank-text transition hover:border-blue-200 hover:bg-bank-light disabled:cursor-not-allowed disabled:opacity-55"
            >
              <span className="flex-1">{suggestion}</span>
              <ChevronRight size={14} className="shrink-0 text-bank-muted transition group-hover:translate-x-0.5 group-hover:text-bank-blue" />
            </button>
          ))}
        </div>

        {messages.length > 0 && <div className="mt-5 space-y-2.5">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[12px] leading-[18px]",
                message.role === "customer"
                  ? "ml-auto rounded-tr-md bg-bank-blue text-white"
                  : message.error
                    ? "rounded-tl-md border border-red-100 bg-red-50 text-red-700"
                    : "rounded-tl-md bg-bank-light text-bank-text",
              )}
            >
              {message.text}
            </div>
          ))}
          {queryMutation.isPending && (
            <div className="flex w-fit items-center gap-2 rounded-2xl rounded-tl-md bg-bank-light px-3.5 py-2.5 text-[11px] text-bank-muted">
              <LoaderCircle size={13} className="animate-spin text-bank-blue" /> Reviewing your banking activity…
            </div>
          )}
        </div>}
      </div>

      <div className="border-t border-bank-border p-4">
        <form onSubmit={submit} className="flex items-center gap-2 rounded-xl border border-bank-border bg-bank-page p-1.5 focus-within:border-bank-blue">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={queryMutation.isPending}
            maxLength={300}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent px-2 text-xs text-bank-text outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
            placeholder="Ask anything about your finances…"
            aria-label="Ask banking assistant"
          />
          <button
            type="submit"
            disabled={!question.trim() || queryMutation.isPending}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bank-blue text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send question"
          >
            {queryMutation.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </form>
        <p className="mt-2 text-center text-[9px] text-bank-muted">Read-only insights from your π Bank activity</p>
      </div>
    </div>
  );
}

export function OllamaPanel({ drawer = false, open = false, onClose, customerName }: OllamaPanelProps) {
  if (drawer) {
    return (
      <div className={cn("fixed inset-0 z-50 transition xl:hidden", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
        <button type="button" className={cn("absolute inset-0 bg-bank-dark/45 backdrop-blur-[2px] transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={onClose} aria-label="Close assistant overlay" />
        <aside className={cn("absolute bottom-0 right-0 top-0 w-[min(360px,92vw)] bg-white shadow-2xl transition-transform duration-300", open ? "translate-x-0" : "translate-x-full")}>
          <AssistantContent onClose={onClose} customerName={customerName} />
        </aside>
      </div>
    );
  }

  return (
    <aside className="hidden w-[292px] shrink-0 border-l border-bank-border bg-white xl:block 2xl:w-[315px]">
      <AssistantContent customerName={customerName} />
    </aside>
  );
}
