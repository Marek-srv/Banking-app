// src/modules/auth/auth.schema.ts

import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .max(254)
  .email()
  .transform((email) => email.toLowerCase());

const customerIdSchema = z
  .string()
  .trim()
  .min(1, "Customer ID is required")
  .max(30)
  .regex(/^[A-Za-z0-9-]+$/, "Customer ID contains invalid characters")
  .transform((customerId) => customerId.toUpperCase());

export const strongPasswordSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/\d/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character");

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(2).max(100).regex(/^[A-Za-z][A-Za-z .'-]*$/),
    lastName: z.string().trim().min(2).max(100).regex(/^[A-Za-z][A-Za-z .'-]*$/),
    dateOfBirth: z.iso.date().refine(
      (value) => new Date(`${value}T00:00:00.000Z`) < new Date(),
      "Date of birth must be in the past"
    ),
    mobile: z.string().trim().regex(/^[6-9]\d{9}$/, "Mobile must be a valid 10-digit number"),
    email: emailSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    customerId: customerIdSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export const verifyOtpSchema = z
  .object({
    email: emailSchema,
    otp: z.string().regex(/^\d{6}$/, "OTP must contain exactly 6 digits"),
  })
  .strict();

export const resendOtpSchema = z
  .object({ email: emailSchema })
  .strict();

export const completeRegistrationSchema = z
  .object({
    registrationToken: z.string().regex(/^[a-f0-9]{64}$/i, "Invalid registration token"),
    password: strongPasswordSchema,
    confirmPassword: strongPasswordSchema,
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match",
  });

const recoveryOtpSchema = z
  .string()
  .regex(/^\d{6}$/, "OTP must contain exactly 6 digits");

export const customerIdRecoveryRequestSchema = z
  .object({
    email: emailSchema,
    dateOfBirth: z.iso.date(),
  })
  .strict();

export const customerIdRecoveryVerifySchema = customerIdRecoveryRequestSchema
  .extend({ otp: recoveryOtpSchema })
  .strict();

export const passwordRecoveryRequestSchema = z
  .object({ customerId: customerIdSchema })
  .strict();

export const passwordRecoveryVerifySchema = passwordRecoveryRequestSchema
  .extend({ otp: recoveryOtpSchema })
  .strict();

export const passwordRecoveryResetSchema = passwordRecoveryRequestSchema
  .extend({
    resetToken: z.string().regex(/^[a-f0-9]{64}$/i, "Invalid reset token"),
    newPassword: strongPasswordSchema,
  })
  .strict();
