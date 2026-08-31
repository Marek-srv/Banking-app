import { randomBytes } from "crypto";
import { prisma } from "../../config/prisma";
import {
  accountLimitForType,
  COUNTED_ACCOUNT_STATUSES,
  deriveIfscFromBranchCode,
  type NormalAccountType,
} from "../../domain/account.rules";
import { Prisma } from "../../generated/prisma/client";
import { paginationMetadata } from "../../schemas/pagination.schema";
import { AuditContext, createAuditLog } from "../../services/audit.service";
import {
  AdminAccountRequestListInput,
  ApproveAccountRequestInput,
  DirectAccountCreationInput,
} from "./admin.schema";

type AdminAccountRequestErrorCode =
  | "ACCOUNT_REQUEST_NOT_FOUND"
  | "ACCOUNT_REQUEST_NOT_REVIEWABLE"
  | "ACCOUNT_REQUEST_NOT_APPROVABLE"
  | "ACCOUNT_REQUEST_NOT_REJECTABLE"
  | "ACCOUNT_REQUEST_CONFLICT"
  | "CUSTOMER_NOT_FOUND"
  | "CUSTOMER_NOT_ACTIVE"
  | "CUSTOMER_KYC_NOT_VERIFIED"
  | "BRANCH_NOT_FOUND"
  | "BRANCH_NOT_ACTIVE"
  | "ACCOUNT_LIMIT_REACHED"
  | "INVALID_TRANSFER_LIMITS";

export class AdminAccountRequestError extends Error {
  constructor(public readonly code: AdminAccountRequestErrorCode) {
    super(code);
  }
}

function generateAccountNumber() {
  return `AC${randomBytes(9).toString("hex").toUpperCase()}`;
}

async function getEligibleCustomer(
  transaction: Prisma.TransactionClient,
  customerId: bigint
) {
  const customer = await transaction.customers.findUnique({
    where: { customer_id: customerId },
  });
  if (!customer) throw new AdminAccountRequestError("CUSTOMER_NOT_FOUND");
  if (customer.customer_status !== "ACTIVE") {
    throw new AdminAccountRequestError("CUSTOMER_NOT_ACTIVE");
  }
  if (customer.kyc_status !== "VERIFIED") {
    throw new AdminAccountRequestError("CUSTOMER_KYC_NOT_VERIFIED");
  }
  return customer;
}

async function getActiveBranch(transaction: Prisma.TransactionClient, branchId: bigint) {
  const branch = await transaction.branches.findUnique({
    where: { branch_id: branchId },
    select: { branch_id: true, branch_code: true, status: true },
  });
  if (!branch) throw new AdminAccountRequestError("BRANCH_NOT_FOUND");
  if (branch.status !== "ACTIVE") throw new AdminAccountRequestError("BRANCH_NOT_ACTIVE");
  return branch;
}

async function assertAccountLimit(
  transaction: Prisma.TransactionClient,
  customerId: bigint,
  accountType: NormalAccountType
) {
  const count = await transaction.accounts.count({
    where: {
      customer_id: customerId,
      account_type: accountType,
      account_status: { in: [...COUNTED_ACCOUNT_STATUSES] },
    },
  });
  if (count >= accountLimitForType(accountType)) {
    throw new AdminAccountRequestError("ACCOUNT_LIMIT_REACHED");
  }
}

export async function listAdminAccountRequests(input: AdminAccountRequestListInput) {
  const where: Prisma.account_requestsWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.customerId ? { customer_id: input.customerId } : {}),
    ...(input.accountType ? { account_type: input.accountType } : {}),
  };
  const [total, items] = await prisma.$transaction([
    prisma.account_requests.count({ where }),
    prisma.account_requests.findMany({
      where,
      include: {
        customers: { select: { customer_id: true, customer_number: true, first_name: true, last_name: true, customer_status: true, kyc_status: true } },
        preferred_branch: { select: { branch_id: true, branch_code: true, branch_name: true, status: true } },
        approved_branch: { select: { branch_id: true, branch_code: true, branch_name: true } },
      },
      orderBy: { created_at: "asc" },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
  ]);
  return { items, pagination: paginationMetadata(input, total) };
}

export async function startAccountRequestReview(
  adminUserId: bigint,
  requestId: bigint,
  auditContext: AuditContext
) {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.account_requests.findUnique({
      where: { account_request_id: requestId },
      select: { status: true },
    });
    if (!existing) throw new AdminAccountRequestError("ACCOUNT_REQUEST_NOT_FOUND");
    if (existing.status !== "PENDING") {
      throw new AdminAccountRequestError("ACCOUNT_REQUEST_NOT_REVIEWABLE");
    }
    const now = new Date();
    const updated = await transaction.account_requests.update({
      where: { account_request_id: requestId },
      data: { status: "UNDER_REVIEW", reviewed_by: adminUserId, reviewed_at: now, updated_at: now },
    });
    await transaction.request_status_history.create({
      data: { request_type: "ACCOUNT_OPENING", request_id: requestId, previous_status: "PENDING", new_status: "UNDER_REVIEW", changed_by: adminUserId },
    });
    await createAuditLog(
      { ...auditContext, userId: adminUserId, action: "ACCOUNT_REQUEST_REVIEW_STARTED", entity: "ACCOUNT_REQUEST", entityId: requestId },
      transaction
    );
    return updated;
  });
}

export async function approveAccountRequest(
  adminUserId: bigint,
  requestId: bigint,
  input: ApproveAccountRequestInput,
  auditContext: AuditContext
) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT account_request_id FROM account_requests WHERE account_request_id = ${requestId} FOR UPDATE`;
    const request = await transaction.account_requests.findUnique({
      where: { account_request_id: requestId },
    });
    if (!request) throw new AdminAccountRequestError("ACCOUNT_REQUEST_NOT_FOUND");
    if (request.status !== "UNDER_REVIEW") {
      throw new AdminAccountRequestError("ACCOUNT_REQUEST_NOT_APPROVABLE");
    }
    if (request.account_type !== "SAVINGS" && request.account_type !== "CURRENT") {
      throw new AdminAccountRequestError("ACCOUNT_REQUEST_NOT_APPROVABLE");
    }

    await getEligibleCustomer(transaction, request.customer_id);
    const branchId = input.approvedBranchId ?? request.preferred_branch_id;
    if (!branchId) throw new AdminAccountRequestError("BRANCH_NOT_FOUND");
    const branch = await getActiveBranch(transaction, branchId);
    await assertAccountLimit(transaction, request.customer_id, request.account_type);

    const conflict = await transaction.account_requests.findFirst({
      where: {
        account_request_id: { not: requestId },
        customer_id: request.customer_id,
        account_type: request.account_type,
        account_subtype: request.account_subtype,
        status: { in: ["PENDING", "UNDER_REVIEW"] },
      },
      select: { account_request_id: true },
    });
    if (conflict) throw new AdminAccountRequestError("ACCOUNT_REQUEST_CONFLICT");

    const perTransactionLimit = input.approvedPerTransactionLimit ?? Number(request.requested_per_transaction_limit);
    const dailyTransferLimit = input.approvedDailyTransferLimit ?? Number(request.requested_daily_transfer_limit);
    if (!Number.isFinite(perTransactionLimit) || !Number.isFinite(dailyTransferLimit) || perTransactionLimit <= 0 || dailyTransferLimit < perTransactionLimit) {
      throw new AdminAccountRequestError("INVALID_TRANSFER_LIMITS");
    }

    const now = new Date();
    const account = await transaction.accounts.create({
      data: {
        account_number: generateAccountNumber(),
        customer_id: request.customer_id,
        branch_id: branch.branch_id,
        account_type: request.account_type,
        account_subtype: request.account_subtype,
        ifsc_code: deriveIfscFromBranchCode(branch.branch_code),
        per_transaction_limit: perTransactionLimit,
        daily_transfer_limit: dailyTransferLimit,
        currency: "INR",
        current_balance: 0,
        available_balance: 0,
        account_status: "ACTIVE",
        opened_at: now,
      },
    });
    const updated = await transaction.account_requests.update({
      where: { account_request_id: requestId },
      data: {
        status: "APPROVED",
        reviewed_by: adminUserId,
        reviewed_at: now,
        admin_note: input.adminNote ?? null,
        approved_account_id: account.account_id,
        approved_branch_id: branch.branch_id,
        approved_per_transaction_limit: perTransactionLimit,
        approved_daily_transfer_limit: dailyTransferLimit,
        updated_at: now,
      },
    });
    await transaction.request_status_history.create({
      data: { request_type: "ACCOUNT_OPENING", request_id: requestId, previous_status: "UNDER_REVIEW", new_status: "APPROVED", changed_by: adminUserId },
    });
    await createAuditLog(
      { ...auditContext, userId: adminUserId, action: "ACCOUNT_REQUEST_APPROVED", entity: "ACCOUNT_REQUEST", entityId: requestId, metadata: { accountId: account.account_id.toString() } },
      transaction
    );
    await createAuditLog(
      { ...auditContext, userId: adminUserId, action: "ACCOUNT_CREATED", entity: "ACCOUNT", entityId: account.account_id, metadata: { accountRequestId: requestId.toString() } },
      transaction
    );
    return { request: updated, account };
  }, { isolationLevel: "Serializable", timeout: 15_000 });
}

export async function rejectAccountRequest(
  adminUserId: bigint,
  requestId: bigint,
  reason: string,
  auditContext: AuditContext
) {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.account_requests.findUnique({
      where: { account_request_id: requestId },
      select: { status: true },
    });
    if (!existing) throw new AdminAccountRequestError("ACCOUNT_REQUEST_NOT_FOUND");
    if (existing.status !== "PENDING" && existing.status !== "UNDER_REVIEW") {
      throw new AdminAccountRequestError("ACCOUNT_REQUEST_NOT_REJECTABLE");
    }
    const now = new Date();
    const updated = await transaction.account_requests.update({
      where: { account_request_id: requestId },
      data: { status: "REJECTED", rejection_reason: reason, reviewed_by: adminUserId, reviewed_at: now, updated_at: now },
    });
    await transaction.request_status_history.create({
      data: { request_type: "ACCOUNT_OPENING", request_id: requestId, previous_status: existing.status, new_status: "REJECTED", changed_by: adminUserId, reason },
    });
    await createAuditLog(
      { ...auditContext, userId: adminUserId, action: "ACCOUNT_REQUEST_REJECTED", entity: "ACCOUNT_REQUEST", entityId: requestId, reason },
      transaction
    );
    return updated;
  });
}

export async function createExceptionalAdminAccount(
  adminUserId: bigint,
  customerId: bigint,
  input: DirectAccountCreationInput,
  auditContext: AuditContext
) {
  return prisma.$transaction(async (transaction) => {
    await getEligibleCustomer(transaction, customerId);
    const branch = await getActiveBranch(transaction, input.branchId);
    await assertAccountLimit(transaction, customerId, input.accountType);
    const account = await transaction.accounts.create({
      data: {
        account_number: generateAccountNumber(),
        customer_id: customerId,
        branch_id: branch.branch_id,
        account_type: input.accountType,
        account_subtype: input.accountSubtype ?? null,
        ifsc_code: deriveIfscFromBranchCode(branch.branch_code),
        per_transaction_limit: input.perTransactionLimit,
        daily_transfer_limit: input.dailyTransferLimit,
        currency: "INR",
        current_balance: 0,
        available_balance: 0,
        account_status: "ACTIVE",
        opened_at: new Date(),
      },
    });
    await createAuditLog(
      {
        ...auditContext,
        userId: adminUserId,
        action: "ADMIN_ACCOUNT_CREATED",
        entity: "ACCOUNT",
        entityId: account.account_id,
        reason: input.reason,
        metadata: {
          ...(input.externalReference ? { externalReference: input.externalReference } : {}),
          ...(input.adminNote ? { adminNote: input.adminNote } : {}),
        },
      },
      transaction
    );
    return account;
  }, { isolationLevel: "Serializable" });
}
