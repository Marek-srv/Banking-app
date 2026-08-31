import { prisma } from "../../config/prisma";
import { AuditContext, createAuditLog } from "../../services/audit.service";
import { paginationMetadata } from "../../schemas/pagination.schema";
import { CreateClosureRequestInput, CreateTransferLimitRequestInput, ServicingListInput } from "./account-servicing.schema";

type ErrorCode = "CUSTOMER_NOT_FOUND" | "CUSTOMER_NOT_ACTIVE" | "ACCOUNT_NOT_FOUND" |
  "UNAUTHORIZED_ACCOUNT" | "ACCOUNT_ALREADY_CLOSED" | "ACTIVE_ACCOUNT_CLOSURE_REQUEST_EXISTS" |
  "ACCOUNT_CLOSURE_REQUEST_NOT_FOUND" | "ACCOUNT_CLOSURE_REQUEST_NOT_CANCELLABLE" |
  "ACTIVE_TRANSFER_LIMIT_REQUEST_EXISTS" | "TRANSFER_LIMIT_REQUEST_NOT_FOUND" |
  "TRANSFER_LIMIT_REQUEST_NOT_CANCELLABLE";

export class AccountServicingError extends Error {
  constructor(public readonly code: ErrorCode) { super(code); }
}

async function customerFor(userId: bigint) {
  const customer = await prisma.customers.findUnique({ where: { user_id: userId } });
  if (!customer) throw new AccountServicingError("CUSTOMER_NOT_FOUND");
  if (customer.customer_status !== "ACTIVE") throw new AccountServicingError("CUSTOMER_NOT_ACTIVE");
  return customer;
}

async function ownedOpenAccount(customerId: bigint, accountId: bigint) {
  const account = await prisma.accounts.findUnique({ where: { account_id: accountId } });
  if (!account) throw new AccountServicingError("ACCOUNT_NOT_FOUND");
  if (account.customer_id !== customerId) throw new AccountServicingError("UNAUTHORIZED_ACCOUNT");
  if (account.account_status === "CLOSED") throw new AccountServicingError("ACCOUNT_ALREADY_CLOSED");
  return account;
}

export async function createClosureRequest(userId: bigint, input: CreateClosureRequestInput, context: AuditContext) {
  const customer = await customerFor(userId);
  await ownedOpenAccount(customer.customer_id, input.accountId);
  const duplicate = await prisma.account_closure_requests.findFirst({
    where: { customer_id: customer.customer_id, account_id: input.accountId, status: { in: ["PENDING", "UNDER_REVIEW"] } },
  });
  if (duplicate) throw new AccountServicingError("ACTIVE_ACCOUNT_CLOSURE_REQUEST_EXISTS");
  return prisma.$transaction(async (tx) => {
    const request = await tx.account_closure_requests.create({ data: {
      customer_id: customer.customer_id, account_id: input.accountId, reason: input.reason, status: "PENDING",
    } });
    await tx.request_status_history.create({ data: { request_type: "ACCOUNT_CLOSURE", request_id: request.account_closure_request_id, new_status: "PENDING", changed_by: userId } });
    await createAuditLog({ ...context, userId, action: "ACCOUNT_CLOSURE_REQUEST_CREATED", entity: "ACCOUNT_CLOSURE_REQUEST", entityId: request.account_closure_request_id, reason: input.reason }, tx);
    return request;
  });
}

export async function listClosureRequests(userId: bigint, query: ServicingListInput) {
  const customer = await customerFor(userId);
  const where = { customer_id: customer.customer_id };
  const [total, items] = await prisma.$transaction([
    prisma.account_closure_requests.count({ where }),
    prisma.account_closure_requests.findMany({ where, include: { accounts: { select: { account_number: true, account_type: true, account_status: true } } }, orderBy: { created_at: "desc" }, skip: (query.page - 1) * query.limit, take: query.limit }),
  ]);
  return { items, pagination: paginationMetadata(query, total) };
}

export async function cancelClosureRequest(userId: bigint, requestId: bigint, context: AuditContext) {
  const customer = await customerFor(userId);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.account_closure_requests.findFirst({ where: { account_closure_request_id: requestId, customer_id: customer.customer_id } });
    if (!existing) throw new AccountServicingError("ACCOUNT_CLOSURE_REQUEST_NOT_FOUND");
    if (existing.status !== "PENDING") throw new AccountServicingError("ACCOUNT_CLOSURE_REQUEST_NOT_CANCELLABLE");
    const updated = await tx.account_closure_requests.update({ where: { account_closure_request_id: requestId }, data: { status: "CANCELLED" } });
    await tx.request_status_history.create({ data: { request_type: "ACCOUNT_CLOSURE", request_id: requestId, previous_status: "PENDING", new_status: "CANCELLED", changed_by: userId } });
    await createAuditLog({ ...context, userId, action: "ACCOUNT_CLOSURE_REQUEST_CANCELLED", entity: "ACCOUNT_CLOSURE_REQUEST", entityId: requestId }, tx);
    return updated;
  });
}

export async function createTransferLimitRequest(userId: bigint, input: CreateTransferLimitRequestInput, context: AuditContext) {
  const customer = await customerFor(userId);
  const account = await ownedOpenAccount(customer.customer_id, input.accountId);
  const duplicate = await prisma.transfer_limit_requests.findFirst({ where: { customer_id: customer.customer_id, account_id: input.accountId, status: { in: ["PENDING", "UNDER_REVIEW"] } } });
  if (duplicate) throw new AccountServicingError("ACTIVE_TRANSFER_LIMIT_REQUEST_EXISTS");
  return prisma.$transaction(async (tx) => {
    const request = await tx.transfer_limit_requests.create({ data: {
      customer_id: customer.customer_id, account_id: input.accountId,
      current_per_transaction_limit: account.per_transaction_limit,
      current_daily_transfer_limit: account.daily_transfer_limit,
      requested_per_transaction_limit: input.requestedPerTransactionLimit,
      requested_daily_transfer_limit: input.requestedDailyTransferLimit,
      reason: input.reason, status: "PENDING",
    } });
    await tx.request_status_history.create({ data: { request_type: "TRANSFER_LIMIT", request_id: request.transfer_limit_request_id, new_status: "PENDING", changed_by: userId } });
    await createAuditLog({ ...context, userId, action: "TRANSFER_LIMIT_REQUEST_CREATED", entity: "TRANSFER_LIMIT_REQUEST", entityId: request.transfer_limit_request_id, reason: input.reason }, tx);
    return request;
  });
}

export async function listTransferLimitRequests(userId: bigint, query: ServicingListInput) {
  const customer = await customerFor(userId);
  const where = { customer_id: customer.customer_id };
  const [total, items] = await prisma.$transaction([
    prisma.transfer_limit_requests.count({ where }),
    prisma.transfer_limit_requests.findMany({ where, include: { accounts: { select: { account_number: true, account_type: true, account_status: true } } }, orderBy: { created_at: "desc" }, skip: (query.page - 1) * query.limit, take: query.limit }),
  ]);
  return { items, pagination: paginationMetadata(query, total) };
}

export async function cancelTransferLimitRequest(userId: bigint, requestId: bigint, context: AuditContext) {
  const customer = await customerFor(userId);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.transfer_limit_requests.findFirst({ where: { transfer_limit_request_id: requestId, customer_id: customer.customer_id } });
    if (!existing) throw new AccountServicingError("TRANSFER_LIMIT_REQUEST_NOT_FOUND");
    if (existing.status !== "PENDING") throw new AccountServicingError("TRANSFER_LIMIT_REQUEST_NOT_CANCELLABLE");
    const updated = await tx.transfer_limit_requests.update({ where: { transfer_limit_request_id: requestId }, data: { status: "CANCELLED" } });
    await tx.request_status_history.create({ data: { request_type: "TRANSFER_LIMIT", request_id: requestId, previous_status: "PENDING", new_status: "CANCELLED", changed_by: userId } });
    await createAuditLog({ ...context, userId, action: "TRANSFER_LIMIT_REQUEST_CANCELLED", entity: "TRANSFER_LIMIT_REQUEST", entityId: requestId }, tx);
    return updated;
  });
}
