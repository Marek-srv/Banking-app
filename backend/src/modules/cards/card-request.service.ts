import { prisma } from "../../config/prisma";
import { Prisma, RequestStatus } from "../../generated/prisma/client";
import { paginationMetadata } from "../../schemas/pagination.schema";
import { AuditContext, createAuditLog } from "../../services/audit.service";
import { createApprovedCard } from "./card.service";
import { CardRequestListInput, CreateCardRequestInput } from "./card-request.schema";

async function history(tx: Prisma.TransactionClient, requestId: bigint, previous: RequestStatus | null, next: RequestStatus, changedBy: bigint, reason?: string) {
  await tx.request_status_history.create({ data: { request_type: "CARD", request_id: requestId, previous_status: previous, new_status: next, changed_by: changedBy, ...(reason ? { reason } : {}) } });
}

async function activeCustomer(userId: bigint) {
  const customer = await prisma.customers.findUnique({ where: { user_id: userId } });
  if (!customer) throw new Error("CUSTOMER_NOT_FOUND");
  if (customer.customer_status !== "ACTIVE") throw new Error("CUSTOMER_NOT_ACTIVE");
  if (customer.kyc_status !== "VERIFIED") throw new Error("CUSTOMER_KYC_NOT_VERIFIED");
  return customer;
}

export async function createCardRequest(userId: bigint, input: CreateCardRequestInput, context: AuditContext) {
  const customer = await activeCustomer(userId);
  const account = await prisma.accounts.findFirst({ where: { account_id: input.accountId, customer_id: customer.customer_id } });
  if (!account) throw new Error("ACCOUNT_NOT_FOUND");
  if (account.account_status !== "ACTIVE" || !["SAVINGS", "CURRENT"].includes(account.account_type)) throw new Error("ACCOUNT_NOT_ACTIVE");
  const duplicate = await prisma.card_requests.findFirst({ where: { customer_id: customer.customer_id, account_id: account.account_id, card_type: input.cardType, status: { in: ["PENDING", "UNDER_REVIEW"] } } });
  if (duplicate) throw new Error("ACTIVE_CARD_REQUEST_EXISTS");
  return prisma.$transaction(async tx => {
    const request = await tx.card_requests.create({ data: { customer_id: customer.customer_id, account_id: account.account_id, card_type: input.cardType, card_variant: input.cardVariant ?? null, notes: input.notes ?? null } });
    await history(tx, request.card_request_id, null, "PENDING", userId);
    await createAuditLog({ ...context, userId, action: "CARD_REQUEST_CREATED", entity: "CARD_REQUEST", entityId: request.card_request_id }, tx);
    return request;
  });
}

export async function listCustomerCardRequests(userId: bigint, query: CardRequestListInput) {
  const customer = await activeCustomer(userId); const where = { customer_id: customer.customer_id, ...(query.status ? { status: query.status } : {}) };
  const [total, items] = await prisma.$transaction([prisma.card_requests.count({ where }), prisma.card_requests.findMany({ where, include: { accounts: { select: { account_number: true, account_type: true } }, approved_card: { select: { card_id: true, masked_card_number: true } } }, orderBy: { created_at: "desc" }, skip: (query.page - 1) * query.limit, take: query.limit })]);
  return { items, pagination: paginationMetadata(query, total) };
}

export async function cancelCardRequest(userId: bigint, requestId: bigint, context: AuditContext) {
  const customer = await activeCustomer(userId);
  return prisma.$transaction(async tx => {
    const request = await tx.card_requests.findFirst({ where: { card_request_id: requestId, customer_id: customer.customer_id } });
    if (!request) throw new Error("CARD_REQUEST_NOT_FOUND"); if (request.status !== "PENDING") throw new Error("CARD_REQUEST_NOT_CANCELLABLE");
    const updated = await tx.card_requests.update({ where: { card_request_id: requestId }, data: { status: "CANCELLED" } }); await history(tx, requestId, request.status, "CANCELLED", userId); await createAuditLog({ ...context, userId, action: "CARD_REQUEST_CANCELLED", entity: "CARD_REQUEST", entityId: requestId }, tx); return updated;
  });
}

export async function listAdminCardRequests(query: CardRequestListInput) {
  const where = query.status ? { status: query.status } : {};
  const [total, items] = await prisma.$transaction([prisma.card_requests.count({ where }), prisma.card_requests.findMany({ where, include: { customers: { select: { customer_number: true, first_name: true, last_name: true, customer_status: true, kyc_status: true } }, accounts: { select: { account_number: true, account_type: true, account_status: true } } }, orderBy: { created_at: "desc" }, skip: (query.page - 1) * query.limit, take: query.limit })]);
  return { items, pagination: paginationMetadata(query, total) };
}

export async function reviewCardRequest(adminId: bigint, requestId: bigint, context: AuditContext) {
  return prisma.$transaction(async tx => { const request = await tx.card_requests.findUnique({ where: { card_request_id: requestId } }); if (!request) throw new Error("CARD_REQUEST_NOT_FOUND"); if (request.status !== "PENDING") throw new Error("CARD_REQUEST_NOT_REVIEWABLE"); const updated = await tx.card_requests.update({ where: { card_request_id: requestId }, data: { status: "UNDER_REVIEW", reviewed_by: adminId, reviewed_at: new Date() } }); await history(tx, requestId, request.status, "UNDER_REVIEW", adminId); await createAuditLog({ ...context, userId: adminId, action: "CARD_REQUEST_REVIEW_STARTED", entity: "CARD_REQUEST", entityId: requestId }, tx); return updated; });
}

export async function approveCardRequest(adminId: bigint, requestId: bigint, context: AuditContext) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT card_request_id FROM card_requests WHERE card_request_id=${requestId} FOR UPDATE`;
    const request = await tx.card_requests.findUnique({ where: { card_request_id: requestId }, include: { customers: true, accounts: true } });
    if (!request) throw new Error("CARD_REQUEST_NOT_FOUND"); if (request.status !== "UNDER_REVIEW" || request.approved_card_id) throw new Error("CARD_REQUEST_NOT_APPROVABLE");
    if (request.customers.customer_status !== "ACTIVE") throw new Error("CUSTOMER_NOT_ACTIVE"); if (request.customers.kyc_status !== "VERIFIED") throw new Error("CUSTOMER_KYC_NOT_VERIFIED");
    if (request.accounts.account_status !== "ACTIVE" || !["SAVINGS", "CURRENT"].includes(request.accounts.account_type)) throw new Error("ACCOUNT_NOT_ACTIVE");
    const card = await createApprovedCard(tx, request.account_id, request.card_type as "DEBIT" | "CREDIT");
    const updated = await tx.card_requests.update({ where: { card_request_id: requestId }, data: { status: "APPROVED", approved_card_id: card.card_id, reviewed_by: adminId, reviewed_at: new Date() } });
    await history(tx, requestId, request.status, "APPROVED", adminId); await createAuditLog({ ...context, userId: adminId, action: "CARD_REQUEST_APPROVED", entity: "CARD_REQUEST", entityId: requestId, metadata: { cardId: card.card_id.toString() } }, tx); await createAuditLog({ ...context, userId: adminId, action: "CARD_CREATED", entity: "CARD", entityId: card.card_id }, tx); return { request: updated, card };
  });
}

export async function rejectCardRequest(adminId: bigint, requestId: bigint, reason: string, context: AuditContext) {
  return prisma.$transaction(async tx => { const request = await tx.card_requests.findUnique({ where: { card_request_id: requestId } }); if (!request) throw new Error("CARD_REQUEST_NOT_FOUND"); if (!["PENDING", "UNDER_REVIEW"].includes(request.status)) throw new Error("CARD_REQUEST_NOT_REJECTABLE"); const updated = await tx.card_requests.update({ where: { card_request_id: requestId }, data: { status: "REJECTED", rejection_reason: reason, reviewed_by: adminId, reviewed_at: new Date() } }); await history(tx, requestId, request.status, "REJECTED", adminId, reason); await createAuditLog({ ...context, userId: adminId, action: "CARD_REQUEST_REJECTED", entity: "CARD_REQUEST", entityId: requestId, reason }, tx); return updated; });
}
