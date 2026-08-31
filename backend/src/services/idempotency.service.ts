import { createHash } from "crypto";
import { Prisma } from "../generated/prisma/client";

export type IdempotentOperation = "TRANSFER" | "DEPOSIT" | "WITHDRAWAL";

export interface IdempotencyRequest {
  key: string;
  operation: IdempotentOperation;
  requestHash: string;
}

export interface IdempotencyClaim {
  recordId?: bigint;
  replayTransaction?: Awaited<
    ReturnType<Prisma.TransactionClient["transactions"]["findUnique"]>
  >;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }

  return value;
}

export function createIdempotencyRequest(
  key: string | undefined,
  operation: IdempotentOperation,
  payload: Record<string, unknown>
): IdempotencyRequest | undefined {
  if (!key) {
    return undefined;
  }

  const requestHash = createHash("sha256")
    .update(JSON.stringify(canonicalize({ operation, ...payload })))
    .digest("hex");

  return { key, operation, requestHash };
}

export async function claimIdempotency(
  client: Prisma.TransactionClient,
  userId: bigint,
  request: IdempotencyRequest | undefined
): Promise<IdempotencyClaim> {
  if (!request) {
    return {};
  }

  const inserted = await client.$queryRaw<Array<{ idempotency_id: bigint }>>`
    INSERT INTO idempotency_records (
      user_id,
      idempotency_key,
      operation,
      request_hash,
      status
    ) VALUES (
      ${userId},
      ${request.key},
      ${request.operation},
      ${request.requestHash},
      'PROCESSING'
    )
    ON CONFLICT (user_id, idempotency_key) DO NOTHING
    RETURNING idempotency_id
  `;

  if (inserted[0]) {
    return { recordId: inserted[0].idempotency_id };
  }

  const existing = await client.idempotency_records.findFirst({
    where: {
      user_id: userId,
      idempotency_key: request.key,
    },
    include: { transactions: true },
  });

  if (!existing) {
    throw new Error("IDEMPOTENCY_STATE_NOT_FOUND");
  }

  if (
    existing.operation !== request.operation ||
    existing.request_hash !== request.requestHash
  ) {
    throw new Error("IDEMPOTENCY_KEY_REUSED");
  }

  if (existing.status === "COMPLETED" && existing.transactions) {
    return { replayTransaction: existing.transactions };
  }

  throw new Error("IDEMPOTENCY_REQUEST_IN_PROGRESS");
}

export async function completeIdempotency(
  client: Prisma.TransactionClient,
  recordId: bigint | undefined,
  transactionId: bigint
) {
  if (recordId === undefined) {
    return;
  }

  await client.idempotency_records.update({
    where: { idempotency_id: recordId },
    data: {
      status: "COMPLETED",
      transaction_id: transactionId,
      updated_at: new Date(),
    },
  });
}
