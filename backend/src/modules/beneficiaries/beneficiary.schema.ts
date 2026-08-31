import { z } from "zod";

const optionalText = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength).optional();

export const createBeneficiarySchema = z.object({
  beneficiaryName: z.string().trim().min(2).max(150),
  beneficiaryAccountNo: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{6,20}$/, "Account number must contain 6 to 20 letters or digits")
    .transform((accountNumber) => accountNumber.toUpperCase()),
  bankName: optionalText(150),
  bankCode: optionalText(30),
  nickname: optionalText(100),
}).strict();

export const beneficiaryIdSchema = z.coerce.bigint().positive();

export type CreateBeneficiaryInput = z.infer<
  typeof createBeneficiarySchema
>;
