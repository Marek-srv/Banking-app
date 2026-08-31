import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().min(1).max(max).optional();

export const createEmployeeSchema = z
  .object({
    branchId: z.coerce.bigint().positive(),
    employeeNumber: z.string().trim().min(3).max(30),
    firstName: z.string().trim().min(2).max(100),
    lastName: z.string().trim().min(2).max(100),
    position: optionalText(100),
    phone: z.string().trim().regex(/^\+?[0-9 -]{7,20}$/).optional(),
    email: z.string().trim().email().max(255).toLowerCase().optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    hireDate: z.iso.date().optional(),
    qualification: optionalText(150),
  })
  .strict();

export const employeeStatusSchema = z
  .object({ status: z.enum(["ACTIVE", "INACTIVE"]) })
  .strict();

export const customerStatusSchema = z
  .object({ status: z.enum(["ACTIVE", "BLOCKED", "INACTIVE", "SUSPENDED"]) })
  .strict();

export const customerKycStatusSchema = z
  .object({
    status: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
    reason: z.string().trim().min(5).max(500).optional(),
  })
  .strict()
  .refine(
    (value) => value.status !== "REJECTED" || value.reason !== undefined,
    { message: "A rejection reason is required", path: ["reason"] }
  );

export const requiredReasonSchema = z
  .object({ reason: z.string().trim().min(5).max(500) })
  .strict();

export const adminServicingListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
  customerId: z.coerce.bigint().positive().optional(),
  accountId: z.coerce.bigint().positive().optional(),
}).strict();

export const directLimitReductionSchema = z.object({
  perTransactionLimit: z.coerce.number().positive().max(100_000_000).optional(),
  dailyTransferLimit: z.coerce.number().positive().max(100_000_000).optional(),
  reason: z.string().trim().min(5).max(500),
}).strict().refine((value) => value.perTransactionLimit !== undefined || value.dailyTransferLimit !== undefined, {
  message: "At least one limit is required",
});

export type AdminServicingListInput = z.infer<typeof adminServicingListSchema>;
export type DirectLimitReductionInput = z.infer<typeof directLimitReductionSchema>;

const approvedLimitSchema = z.coerce.number().positive().max(100_000_000);

export const adminAccountRequestListSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
    customerId: z.coerce.bigint().positive().optional(),
    accountType: z.enum(["SAVINGS", "CURRENT"]).optional(),
  })
  .strict();

export const approveAccountRequestSchema = z
  .object({
    approvedBranchId: z.coerce.bigint().positive().optional(),
    approvedPerTransactionLimit: approvedLimitSchema.optional(),
    approvedDailyTransferLimit: approvedLimitSchema.optional(),
    adminNote: z.string().trim().min(1).max(2000).optional(),
  })
  .strict()
  .refine(
    (value) => value.approvedPerTransactionLimit === undefined ||
      value.approvedDailyTransferLimit === undefined ||
      value.approvedDailyTransferLimit >= value.approvedPerTransactionLimit,
    { path: ["approvedDailyTransferLimit"], message: "Daily transfer limit must cover the per-transaction limit" }
  );

export const directAccountCreationSchema = z
  .object({
    accountType: z.enum(["SAVINGS", "CURRENT"]),
    accountSubtype: z.string().trim().min(1).max(50).optional(),
    branchId: z.coerce.bigint().positive(),
    perTransactionLimit: approvedLimitSchema,
    dailyTransferLimit: approvedLimitSchema,
    reason: z.string().trim().min(5).max(500),
    externalReference: z.string().trim().min(1).max(100).optional(),
    adminNote: z.string().trim().min(1).max(2000).optional(),
  })
  .strict()
  .refine((value) => value.dailyTransferLimit >= value.perTransactionLimit, {
    path: ["dailyTransferLimit"], message: "Daily transfer limit must cover the per-transaction limit",
  });

export const adminListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().max(100).optional(),
    status: z.string().trim().max(30).optional(),
    type: z.string().trim().max(30).optional(),
    kycStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
    branchId: z.coerce.bigint().positive().optional(),
    customer: z.string().trim().max(100).optional(),
    entity: z.string().trim().max(50).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .transform((value) => ({
    ...value,
    search: value.search || undefined,
    status: value.status || undefined,
    type: value.type || undefined,
    customer: value.customer || undefined,
    entity: value.entity || undefined,
  }));

export const adminEntityIdSchema = z.coerce.bigint().positive();

const branchFields = {
  branchName: z.string().trim().min(2).max(150),
  address: optionalText(255),
  city: optionalText(100),
  state: optionalText(100),
  postalCode: optionalText(20),
  phone: z.string().trim().regex(/^\+?[0-9 -]{7,20}$/).optional(),
  email: z.string().trim().email().max(255).toLowerCase().optional(),
  operatingHours: optionalText(100),
};

export const createBranchSchema = z.object({
  branchCode: z.string().trim().min(3).max(20).regex(/^[A-Za-z0-9-]+$/).transform((value) => value.toUpperCase()),
  ...branchFields,
}).strict();

export const updateBranchSchema = z.object(branchFields).partial().strict().refine((value) => Object.keys(value).length > 0, "At least one branch field is required");
export const branchStatusSchema = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) }).strict();
export const branchManagerSchema = z.object({ managerId: z.coerce.bigint().positive().nullable() }).strict();

const atmFields = {
  branchId: z.coerce.bigint().positive(),
  location: z.string().trim().min(3).max(255),
  operatingHours: optionalText(100),
  supportedTransactions: optionalText(255),
};
export const createAtmSchema = z.object({
  atmCode: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9-]+$/).transform((value) => value.toUpperCase()),
  ...atmFields,
  status: z.enum(["ACTIVE", "MAINTENANCE", "OUT_OF_SERVICE"]).default("ACTIVE"),
}).strict();
export const updateAtmSchema = z.object(atmFields).partial().strict().refine((value) => Object.keys(value).length > 0, "At least one ATM field is required");
export const atmStatusSchema = z.object({ status: z.enum(["ACTIVE", "MAINTENANCE", "OUT_OF_SERVICE"]) }).strict();

export const updateEmployeeSchema = z.object({
  branchId: z.coerce.bigint().positive().optional(),
  firstName: z.string().trim().min(2).max(100).optional(),
  lastName: z.string().trim().min(2).max(100).optional(),
  position: optionalText(100), phone: z.string().trim().regex(/^\+?[0-9 -]{7,20}$/).optional(),
  email: z.string().trim().email().max(255).toLowerCase().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(), hireDate: z.iso.date().optional(), qualification: optionalText(150),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one employee field is required");

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type AdminListInput = z.infer<typeof adminListQuerySchema>;
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type CreateAtmInput = z.infer<typeof createAtmSchema>;
export type UpdateAtmInput = z.infer<typeof updateAtmSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type AdminAccountRequestListInput = z.infer<typeof adminAccountRequestListSchema>;
export type ApproveAccountRequestInput = z.infer<typeof approveAccountRequestSchema>;
export type DirectAccountCreationInput = z.infer<typeof directAccountCreationSchema>;
