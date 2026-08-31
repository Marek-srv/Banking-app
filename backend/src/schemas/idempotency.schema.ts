import { z } from "zod";

const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, "Invalid Idempotency-Key format");

export function parseIdempotencyKey(value: string | undefined) {
  return value === undefined ? undefined : idempotencyKeySchema.parse(value);
}
