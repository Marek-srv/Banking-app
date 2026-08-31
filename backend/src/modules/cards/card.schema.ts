import { z } from "zod";

export const createCardSchema = z.object({
  accountId: z.coerce.bigint().positive(),
  cardType: z.enum(["DEBIT", "CREDIT"]),
}).strict();

export const cardIdSchema = z.coerce.bigint().positive();

export type CreateCardInput = z.infer<typeof createCardSchema>;
