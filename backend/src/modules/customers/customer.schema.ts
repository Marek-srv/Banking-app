// src/modules/customers/customer.schema.ts

import { z } from "zod";

export const createCustomerSchema = z
  .object({
    branchId: z.coerce.bigint().positive(),
    firstName: z.string().trim().min(2).max(100),
    lastName: z.string().trim().min(2).max(100),
    phone: z.string().trim().regex(/^\+?[0-9 -]{7,20}$/).optional(),
    dateOfBirth: z.iso.date().optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    address: z.string().trim().min(3).max(255).optional(),
    city: z.string().trim().min(2).max(100).optional(),
    state: z.string().trim().min(2).max(100).optional(),
    country: z.string().trim().min(2).max(100).default("India"),
    postalCode: z.string().trim().min(3).max(20).optional(),
  })
  .strict();
