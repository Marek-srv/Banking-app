import { z } from "zod";

export const createTransferSchema = z.object({
  sourceAccountId: z.coerce.bigint().positive(),
  destinationAccountId: z.coerce.bigint().positive(),
  amount: z
    .number()
    .positive()
    .finite()
    .refine(
      (value) => Number.isInteger(value * 10_000),
      "Amount cannot have more than 4 decimal places"
    ),
  remarks: z.string().trim().max(500, "Remarks cannot exceed 500 characters").optional(),
}).strict();

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
