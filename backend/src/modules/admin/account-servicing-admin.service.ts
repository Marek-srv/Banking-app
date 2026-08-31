import { prisma } from "../../config/prisma";
import { Prisma, RequestStatus } from "../../generated/prisma/client";
import { paginationMetadata } from "../../schemas/pagination.schema";
import { AuditContext, createAuditLog } from "../../services/audit.service";
import { AdminServicingListInput, DirectLimitReductionInput } from "./admin.schema";

type Kind = "closure" | "limit";

async function history(tx: Prisma.TransactionClient, type: "ACCOUNT_CLOSURE" | "TRANSFER_LIMIT", requestId: bigint, oldStatus: RequestStatus, newStatus: RequestStatus, userId: bigint, reason?: string) {
  await tx.request_status_history.create({ data: { request_type: type, request_id: requestId, previous_status: oldStatus, new_status: newStatus, changed_by: userId, ...(reason === undefined ? {} : { reason }) } });
}

export async function listAdminClosureRequests(query: AdminServicingListInput) {
  const where = { ...(query.status ? { status: query.status } : {}), ...(query.customerId ? { customer_id: query.customerId } : {}), ...(query.accountId ? { account_id: query.accountId } : {}) };
  const [total, items] = await prisma.$transaction([
    prisma.account_closure_requests.count({ where }),
    prisma.account_closure_requests.findMany({ where, include: { customers: { select: { customer_number: true, first_name: true, last_name: true } }, accounts: { select: { account_number: true, account_type: true, account_status: true, current_balance: true } } }, orderBy: { created_at: "desc" }, skip: (query.page - 1) * query.limit, take: query.limit }),
  ]);
  return { items, pagination: paginationMetadata(query, total) };
}

export async function listAdminTransferLimitRequests(query: AdminServicingListInput) {
  const where = { ...(query.status ? { status: query.status } : {}), ...(query.customerId ? { customer_id: query.customerId } : {}), ...(query.accountId ? { account_id: query.accountId } : {}) };
  const [total, items] = await prisma.$transaction([
    prisma.transfer_limit_requests.count({ where }),
    prisma.transfer_limit_requests.findMany({ where, include: { customers: { select: { customer_number: true, first_name: true, last_name: true } }, accounts: { select: { account_number: true, account_type: true, account_status: true, per_transaction_limit: true, daily_transfer_limit: true } } }, orderBy: { created_at: "desc" }, skip: (query.page - 1) * query.limit, take: query.limit }),
  ]);
  return { items, pagination: paginationMetadata(query, total) };
}

export async function startServicingReview(kind: Kind, requestId: bigint, adminId: bigint, context: AuditContext) {
  return prisma.$transaction(async (tx) => {
    if (kind === "closure") {
      const request = await tx.account_closure_requests.findUnique({ where: { account_closure_request_id: requestId } });
      if (!request) throw new Error("ACCOUNT_CLOSURE_REQUEST_NOT_FOUND");
      if (request.status !== "PENDING") throw new Error("SERVICING_REQUEST_NOT_REVIEWABLE");
      const updated = await tx.account_closure_requests.update({ where: { account_closure_request_id: requestId }, data: { status: "UNDER_REVIEW", reviewed_by: adminId, reviewed_at: new Date() } });
      await history(tx, "ACCOUNT_CLOSURE", requestId, request.status, "UNDER_REVIEW", adminId);
      await createAuditLog({ ...context, userId: adminId, action: "ACCOUNT_CLOSURE_REQUEST_REVIEW_STARTED", entity: "ACCOUNT_CLOSURE_REQUEST", entityId: requestId }, tx);
      return updated;
    }
    const request = await tx.transfer_limit_requests.findUnique({ where: { transfer_limit_request_id: requestId } });
    if (!request) throw new Error("TRANSFER_LIMIT_REQUEST_NOT_FOUND");
    if (request.status !== "PENDING") throw new Error("SERVICING_REQUEST_NOT_REVIEWABLE");
    const updated = await tx.transfer_limit_requests.update({ where: { transfer_limit_request_id: requestId }, data: { status: "UNDER_REVIEW", reviewed_by: adminId, reviewed_at: new Date() } });
    await history(tx, "TRANSFER_LIMIT", requestId, request.status, "UNDER_REVIEW", adminId);
    await createAuditLog({ ...context, userId: adminId, action: "TRANSFER_LIMIT_REQUEST_REVIEW_STARTED", entity: "TRANSFER_LIMIT_REQUEST", entityId: requestId }, tx);
    return updated;
  });
}

export async function rejectServicingRequest(kind: Kind, requestId: bigint, adminId: bigint, reason: string, context: AuditContext) {
  return prisma.$transaction(async (tx) => {
    if (kind === "closure") {
      const request = await tx.account_closure_requests.findUnique({ where: { account_closure_request_id: requestId } });
      if (!request) throw new Error("ACCOUNT_CLOSURE_REQUEST_NOT_FOUND");
      if (!["PENDING", "UNDER_REVIEW"].includes(request.status)) throw new Error("SERVICING_REQUEST_NOT_REJECTABLE");
      const updated = await tx.account_closure_requests.update({ where: { account_closure_request_id: requestId }, data: { status: "REJECTED", reviewed_by: adminId, reviewed_at: new Date(), rejection_reason: reason } });
      await history(tx, "ACCOUNT_CLOSURE", requestId, request.status, "REJECTED", adminId, reason);
      await createAuditLog({ ...context, userId: adminId, action: "ACCOUNT_CLOSURE_REQUEST_REJECTED", entity: "ACCOUNT_CLOSURE_REQUEST", entityId: requestId, reason }, tx);
      return updated;
    }
    const request = await tx.transfer_limit_requests.findUnique({ where: { transfer_limit_request_id: requestId } });
    if (!request) throw new Error("TRANSFER_LIMIT_REQUEST_NOT_FOUND");
    if (!["PENDING", "UNDER_REVIEW"].includes(request.status)) throw new Error("SERVICING_REQUEST_NOT_REJECTABLE");
    const updated = await tx.transfer_limit_requests.update({ where: { transfer_limit_request_id: requestId }, data: { status: "REJECTED", reviewed_by: adminId, reviewed_at: new Date(), rejection_reason: reason } });
    await history(tx, "TRANSFER_LIMIT", requestId, request.status, "REJECTED", adminId, reason);
    await createAuditLog({ ...context, userId: adminId, action: "TRANSFER_LIMIT_REQUEST_REJECTED", entity: "TRANSFER_LIMIT_REQUEST", entityId: requestId, reason }, tx);
    return updated;
  });
}

export async function approveClosureRequest(requestId: bigint, adminId: bigint, context: AuditContext) {
  return prisma.$transaction(async (tx) => {
    const requests = await tx.$queryRaw<Array<{ account_closure_request_id: bigint; account_id: bigint; reason: string; status: RequestStatus }>>`
      SELECT account_closure_request_id, account_id, reason, status FROM account_closure_requests WHERE account_closure_request_id = ${requestId} FOR UPDATE
    `;
    const request = requests[0];
    if (!request) throw new Error("ACCOUNT_CLOSURE_REQUEST_NOT_FOUND");
    if (request.status !== "UNDER_REVIEW") throw new Error("SERVICING_REQUEST_NOT_APPROVABLE");
    const accounts = await tx.$queryRaw<Array<{ account_id: bigint; account_number: string; account_status: string; current_balance: Prisma.Decimal; available_balance: Prisma.Decimal }>>`
      SELECT account_id, account_number, account_status, current_balance, available_balance FROM accounts WHERE account_id = ${request.account_id} FOR UPDATE
    `;
    const account = accounts[0];
    if (!account || account.account_status === "CLOSED") throw new Error("ACCOUNT_ALREADY_CLOSED");
    if (!account.current_balance.isZero() || !account.available_balance.isZero()) throw new Error("ACCOUNT_CANNOT_CLOSE_WITH_BALANCE");
    const pending = await tx.transactions.count({ where: { OR: [{ source_account_id: account.account_id }, { destination_account_id: account.account_id }], status: { in: ["INITIATED", "PROCESSING", "PENDING"] } } });
    if (pending > 0) throw new Error("ACCOUNT_HAS_PENDING_TRANSACTIONS");
    const loan = await tx.loans.findFirst({ where: { account_id: account.account_id, OR: [{ status: { in: ["APPROVED", "ACTIVE", "OVERDUE"] } }, { emi_schedules: { some: { status: { in: ["PENDING", "OVERDUE", "PARTIALLY_PAID"] } } } }] } });
    if (loan) throw new Error("ACCOUNT_HAS_ACTIVE_LOAN_OBLIGATIONS");
    await tx.accounts.update({ where: { account_id: account.account_id }, data: { account_status: "CLOSED", closed_at: new Date(), closed_by: adminId, close_reason: request.reason, frozen_at: null, frozen_by: null, freeze_reason: null } });
    const cards = await tx.cards.updateMany({ where: { account_id: account.account_id, card_status: { not: "CLOSED" } }, data: { card_status: "CLOSED", freeze_source: "ACCOUNT_CLOSURE" } });
    const beneficiaries = await tx.beneficiaries.updateMany({ where: { beneficiary_account_no: account.account_number, status: "ACTIVE" }, data: { status: "INACTIVE" } });
    const updated = await tx.account_closure_requests.update({ where: { account_closure_request_id: requestId }, data: { status: "APPROVED", reviewed_by: adminId, reviewed_at: new Date() } });
    await history(tx, "ACCOUNT_CLOSURE", requestId, request.status, "APPROVED", adminId);
    await createAuditLog({ ...context, userId: adminId, action: "ACCOUNT_CLOSED", entity: "ACCOUNT", entityId: account.account_id, reason: request.reason, metadata: { requestId: requestId.toString(), cardsClosed: cards.count, beneficiariesDisabled: beneficiaries.count } }, tx);
    await createAuditLog({ ...context, userId: adminId, action: "ACCOUNT_CLOSURE_REQUEST_APPROVED", entity: "ACCOUNT_CLOSURE_REQUEST", entityId: requestId }, tx);
    return updated;
  });
}

export async function approveTransferLimitRequest(requestId: bigint, adminId: bigint, context: AuditContext) {
  return prisma.$transaction(async (tx) => {
    const requests = await tx.$queryRaw<Array<{ transfer_limit_request_id: bigint; account_id: bigint; status: RequestStatus; requested_per_transaction_limit: Prisma.Decimal; requested_daily_transfer_limit: Prisma.Decimal }>>`
      SELECT transfer_limit_request_id, account_id, status, requested_per_transaction_limit, requested_daily_transfer_limit FROM transfer_limit_requests WHERE transfer_limit_request_id = ${requestId} FOR UPDATE
    `;
    const request = requests[0];
    if (!request) throw new Error("TRANSFER_LIMIT_REQUEST_NOT_FOUND");
    if (request.status !== "UNDER_REVIEW") throw new Error("SERVICING_REQUEST_NOT_APPROVABLE");
    const account = await tx.accounts.findUnique({ where: { account_id: request.account_id } });
    if (!account) throw new Error("ACCOUNT_NOT_FOUND");
    if (account.account_status === "CLOSED") throw new Error("ACCOUNT_ALREADY_CLOSED");
    await tx.accounts.update({ where: { account_id: account.account_id }, data: { per_transaction_limit: request.requested_per_transaction_limit, daily_transfer_limit: request.requested_daily_transfer_limit } });
    const updated = await tx.transfer_limit_requests.update({ where: { transfer_limit_request_id: requestId }, data: { status: "APPROVED", reviewed_by: adminId, reviewed_at: new Date() } });
    await history(tx, "TRANSFER_LIMIT", requestId, request.status, "APPROVED", adminId);
    await createAuditLog({ ...context, userId: adminId, action: "TRANSFER_LIMIT_REQUEST_APPROVED", entity: "TRANSFER_LIMIT_REQUEST", entityId: requestId, metadata: { accountId: account.account_id.toString(), perTransactionLimit: request.requested_per_transaction_limit.toString(), dailyTransferLimit: request.requested_daily_transfer_limit.toString() } }, tx);
    return updated;
  });
}

export async function reduceAccountLimits(accountId: bigint, adminId: bigint, input: DirectLimitReductionInput, context: AuditContext) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ account_id: bigint; account_status: string; per_transaction_limit: Prisma.Decimal | null; daily_transfer_limit: Prisma.Decimal | null }>>`
      SELECT account_id, account_status, per_transaction_limit, daily_transfer_limit FROM accounts WHERE account_id = ${accountId} FOR UPDATE
    `;
    const account = rows[0];
    if (!account) throw new Error("ACCOUNT_NOT_FOUND");
    if (account.account_status === "CLOSED") throw new Error("ACCOUNT_ALREADY_CLOSED");
    const per = input.perTransactionLimit === undefined ? account.per_transaction_limit : new Prisma.Decimal(input.perTransactionLimit);
    const daily = input.dailyTransferLimit === undefined ? account.daily_transfer_limit : new Prisma.Decimal(input.dailyTransferLimit);
    if (input.perTransactionLimit !== undefined && account.per_transaction_limit && per!.greaterThanOrEqualTo(account.per_transaction_limit)) throw new Error("DIRECT_LIMIT_INCREASE_NOT_ALLOWED");
    if (input.dailyTransferLimit !== undefined && account.daily_transfer_limit && daily!.greaterThanOrEqualTo(account.daily_transfer_limit)) throw new Error("DIRECT_LIMIT_INCREASE_NOT_ALLOWED");
    if (per && daily && daily.lessThan(per)) throw new Error("INVALID_TRANSFER_LIMITS");
    const updated = await tx.accounts.update({ where: { account_id: accountId }, data: { ...(input.perTransactionLimit !== undefined ? { per_transaction_limit: per } : {}), ...(input.dailyTransferLimit !== undefined ? { daily_transfer_limit: daily } : {}) } });
    await createAuditLog({ ...context, userId: adminId, action: "ACCOUNT_LIMITS_REDUCED", entity: "ACCOUNT", entityId: accountId, reason: input.reason, metadata: { oldPerTransactionLimit: account.per_transaction_limit?.toString() ?? null, oldDailyTransferLimit: account.daily_transfer_limit?.toString() ?? null, newPerTransactionLimit: per?.toString() ?? null, newDailyTransferLimit: daily?.toString() ?? null } }, tx);
    return updated;
  });
}
