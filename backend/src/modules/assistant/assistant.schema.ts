import { z } from "zod";

export const assistantQuerySchema = z
  .object({
    question: z
      .string()
      .trim()
      .min(3, "Question is required")
      .max(300, "Question must not exceed 300 characters"),
  })
  .strict();

export type AssistantQueryInput = z.infer<typeof assistantQuerySchema>;
