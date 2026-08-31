import { z } from "zod";

export const cardRequestIdSchema = z.coerce.bigint().positive();
export const createCardRequestSchema = z.object({
  accountId: z.coerce.bigint().positive(),
  cardType: z.enum(["DEBIT", "CREDIT"]),
  cardVariant: z.string().trim().min(2).max(50).optional(),
  notes: z.string().trim().min(3).max(500).optional(),
}).strict();
export const cardRequestListSchema = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(20), status: z.enum(["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"]).optional() }).strict();
export const rejectCardRequestSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();

export type CreateCardRequestInput = z.infer<typeof createCardRequestSchema>;
export type CardRequestListInput = z.infer<typeof cardRequestListSchema>;
