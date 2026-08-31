import { z } from "zod";

const money = z.coerce.number().positive().max(1_000_000_000);
export const LOAN_PRODUCTS = {
  PERSONAL: ["UNSECURED_PERSONAL"],
  HOME: ["HOME_PURCHASE"],
  VEHICLE: ["NEW_VEHICLE"],
  EDUCATION: ["HIGHER_EDUCATION"],
} as const;

const loanTypeSchema = z.enum(Object.keys(LOAN_PRODUCTS) as [keyof typeof LOAN_PRODUCTS, ...(keyof typeof LOAN_PRODUCTS)[]]);
const loanSubtypeSchema = z.enum(
  Object.values(LOAN_PRODUCTS).flat() as [
    (typeof LOAN_PRODUCTS)[keyof typeof LOAN_PRODUCTS][number],
    ...(typeof LOAN_PRODUCTS)[keyof typeof LOAN_PRODUCTS][number][],
  ]
);

export const loanIdSchema = z.coerce.bigint().positive();
export const loanListSchema = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(20) }).strict();
export const createLoanRequestSchema = z.object({
  requestedAmount: money,
  durationMonths: z.coerce.number().int().min(1).max(60),
  loanType: z.string().trim().toUpperCase().pipe(loanTypeSchema),
  loanSubtype: z.string().trim().toUpperCase().pipe(loanSubtypeSchema),
  purpose: z.string().trim().min(5).max(500),
}).strict().superRefine((value, context) => {
  const acceptedSubtypes = LOAN_PRODUCTS[value.loanType] as readonly string[];
  if (!acceptedSubtypes.includes(value.loanSubtype)) {
    context.addIssue({
      code: "custom",
      path: ["loanSubtype"],
      message: `Invalid loanSubtype for ${value.loanType}`,
    });
  }
});
export const loanPreviewSchema = z.object({ requestedAmount: money, durationMonths: z.coerce.number().int().min(1).max(60) }).strict();
export const disburseLoanSchema = z.object({}).strict();
export const payEmiSchema = z.object({ sourceAccountId: z.coerce.bigint().positive() }).strict();
export const prepayLoanSchema = z.object({ sourceAccountId: z.coerce.bigint().positive(), amount: money }).strict();
export const forecloseLoanSchema = z.object({ sourceAccountId: z.coerce.bigint().positive() }).strict();
export const autoDebitSchema = z.object({ enabled: z.boolean(), accountId: z.coerce.bigint().positive().optional() }).strict().refine(v => !v.enabled || v.accountId !== undefined, { path: ["accountId"], message: "Account is required when enabling auto-debit" });
export const approveLoanRequestSchema = z.object({ approvedAmount: money, approvedDurationMonths: z.coerce.number().int().min(1).max(60), adminNote: z.string().trim().min(1).max(2000).optional() }).strict();
export const adminLoanListSchema = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(20), status: z.enum(["APPROVED", "ACTIVE", "OVERDUE", "CLOSED", "FORECLOSED", "CANCELLED"]).optional(), customerId: z.coerce.bigint().positive().optional(), customer: z.string().trim().max(100).optional(), overdue: z.enum(["true", "false"]).transform(v => v === "true").optional() }).strict();
export const adminLoanRequestListSchema = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(20), status: z.enum(["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"]).optional(), customerId: z.coerce.bigint().positive().optional() }).strict();
export const processOverdueSchema = z.object({ loanId: z.coerce.bigint().positive().optional() }).strict();

export type CreateLoanRequestInput = z.infer<typeof createLoanRequestSchema>;
export type ApproveLoanRequestInput = z.infer<typeof approveLoanRequestSchema>;
export type LoanListInput = z.infer<typeof loanListSchema>;
export type AdminLoanListInput = z.infer<typeof adminLoanListSchema>;
export type AdminLoanRequestListInput = z.infer<typeof adminLoanRequestListSchema>;
