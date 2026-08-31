import { z } from "zod";

const limitSchema = z.coerce.number().positive().max(100_000_000);
const optionalText = (max: number) => z.string().trim().min(1).max(max).optional();

const editableFields = {
  accountSubtype: optionalText(50),
  preferredBranchId: z.coerce.bigint().positive(),
  purpose: optionalText(500),
  requestedPerTransactionLimit: limitSchema,
  requestedDailyTransferLimit: limitSchema,
  notes: optionalText(2000),
};

function dailyLimitCoversTransactionLimit(value: {
  requestedPerTransactionLimit?: number | undefined;
  requestedDailyTransferLimit?: number | undefined;
}) {
  return value.requestedPerTransactionLimit === undefined ||
    value.requestedDailyTransferLimit === undefined ||
    value.requestedDailyTransferLimit >= value.requestedPerTransactionLimit;
}

export const createAccountRequestSchema = z
  .object({ accountType: z.enum(["SAVINGS", "CURRENT"]), ...editableFields })
  .strict()
  .refine(dailyLimitCoversTransactionLimit, {
    path: ["requestedDailyTransferLimit"],
    message: "Daily transfer limit must cover the per-transaction limit",
  });

export const updateAccountRequestSchema = z
  .object(editableFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required")
  .refine(dailyLimitCoversTransactionLimit, {
    path: ["requestedDailyTransferLimit"],
    message: "Daily transfer limit must cover the per-transaction limit",
  });

export const accountRequestIdSchema = z.coerce.bigint().positive();

export type CreateAccountRequestInput = z.infer<typeof createAccountRequestSchema>;
export type UpdateAccountRequestInput = z.infer<typeof updateAccountRequestSchema>;
