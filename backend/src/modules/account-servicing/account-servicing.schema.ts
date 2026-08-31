import { z } from "zod";

const amount = z.coerce.number().positive().max(100_000_000);

export const servicingRequestIdSchema = z.coerce.bigint().positive();
export const servicingListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
}).strict();

export const createClosureRequestSchema = z.object({
  accountId: z.coerce.bigint().positive(),
  reason: z.string().trim().min(5).max(500),
}).strict();

export const createTransferLimitRequestSchema = z.object({
  accountId: z.coerce.bigint().positive(),
  requestedPerTransactionLimit: amount,
  requestedDailyTransferLimit: amount,
  reason: z.string().trim().min(5).max(500),
}).strict().refine(
  (value) => value.requestedDailyTransferLimit >= value.requestedPerTransactionLimit,
  { path: ["requestedDailyTransferLimit"], message: "Daily transfer limit must cover the per-transaction limit" }
);

export type CreateClosureRequestInput = z.infer<typeof createClosureRequestSchema>;
export type CreateTransferLimitRequestInput = z.infer<typeof createTransferLimitRequestSchema>;
export type ServicingListInput = z.infer<typeof servicingListSchema>;
