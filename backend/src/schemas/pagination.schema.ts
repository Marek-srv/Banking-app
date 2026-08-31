import { z } from "zod";

const pageSchema = z.coerce.number().int().positive().max(1_000_000);
const limitSchema = z.coerce.number().int().positive().max(100);

export const paginationQuerySchema = z
  .object({
    page: pageSchema.default(1),
    limit: limitSchema.optional(),
    pageSize: limitSchema.optional(),
  })
  .transform((value) => ({
    page: value.page,
    limit: value.limit ?? value.pageSize ?? 20,
  }));

export interface PaginationInput {
  page: number;
  limit: number;
}

export function paginationMetadata(input: PaginationInput, total: number) {
  return {
    page: input.page,
    limit: input.limit,
    pageSize: input.limit,
    total,
    totalPages: Math.ceil(total / input.limit),
  };
}
