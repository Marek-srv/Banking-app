import { z } from "zod";

export const createAccountSchema = z.object({
  accountType: z.enum(["SAVINGS", "CURRENT"]),
}).strict();

export const accountIdSchema = z.coerce.bigint().positive();

export const statementQuerySchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    format: z.enum(["pdf", "csv"]).default("pdf"),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.from > value.to) {
      context.addIssue({ code: "custom", path: ["to"], message: "to must be on or after from" });
      return;
    }
    const from = new Date(`${value.from}T00:00:00.000Z`);
    const to = new Date(`${value.to}T00:00:00.000Z`);
    const days = (to.getTime() - from.getTime()) / 86_400_000;
    if (days > 366) context.addIssue({ code: "custom", path: ["to"], message: "Statement period cannot exceed 366 days" });
  });

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type StatementQuery = z.infer<typeof statementQuerySchema>;
