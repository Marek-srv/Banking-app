import { z } from "zod";

export const cashOperationSchema = z.object({
  accountId: z.coerce.bigint().positive(),
  amount: z
    .number()
    .positive()
    .finite()
    .refine(
      (value) => Number.isInteger(value * 10_000),
      "Amount cannot have more than 4 decimal places"
    ),
}).strict();

export type CashOperationInput = z.infer<typeof cashOperationSchema>;

export const transactionListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional(),
    type: z
      .enum(["TRANSFER", "DEPOSIT", "WITHDRAWAL", "REVERSAL"])
      .optional(),
    status: z
      .enum(["INITIATED", "PROCESSING", "COMPLETED", "FAILED"])
      .optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .superRefine((value, context) => {
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "to must be on or after from",
      });
    }
  })
  .transform((value) => ({
    page: value.page,
    limit: value.limit ?? value.pageSize ?? 20,
    type: value.type,
    status: value.status,
    from: value.from,
    to: value.to,
  }));

export type TransactionListInput = z.infer<typeof transactionListQuerySchema>;
