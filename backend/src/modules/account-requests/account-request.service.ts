import { prisma } from "../../config/prisma";
import {
  accountLimitForType,
  COUNTED_ACCOUNT_STATUSES,
} from "../../domain/account.rules";
import { PaginationInput, paginationMetadata } from "../../schemas/pagination.schema";
import { AuditContext, createAuditLog } from "../../services/audit.service";
import {
  CreateAccountRequestInput,
  UpdateAccountRequestInput,
} from "./account-request.schema";

type AccountRequestErrorCode =
  | "CUSTOMER_NOT_FOUND"
  | "CUSTOMER_NOT_ACTIVE"
  | "CUSTOMER_KYC_NOT_VERIFIED"
  | "BRANCH_NOT_FOUND"
  | "BRANCH_NOT_ACTIVE"
  | "ACCOUNT_LIMIT_REACHED"
  | "ACTIVE_ACCOUNT_REQUEST_EXISTS"
  | "ACCOUNT_REQUEST_NOT_FOUND"
  | "ACCOUNT_REQUEST_NOT_EDITABLE"
  | "ACCOUNT_REQUEST_NOT_CANCELLABLE";

export class AccountRequestServiceError extends Error {
  constructor(public readonly code: AccountRequestErrorCode) {
    super(code);
  }
}

async function getEligibleCustomer(userId: bigint) {
  const customer = await prisma.customers.findUnique({ where: { user_id: userId } });
  if (!customer) throw new AccountRequestServiceError("CUSTOMER_NOT_FOUND");
  if (customer.customer_status !== "ACTIVE") {
    throw new AccountRequestServiceError("CUSTOMER_NOT_ACTIVE");
  }
  if (customer.kyc_status !== "VERIFIED") {
    throw new AccountRequestServiceError("CUSTOMER_KYC_NOT_VERIFIED");
  }
  return customer;
}

async function assertActiveBranch(branchId: bigint) {
  const branch = await prisma.branches.findUnique({
    where: { branch_id: branchId },
    select: { branch_id: true, status: true },
  });
  if (!branch) throw new AccountRequestServiceError("BRANCH_NOT_FOUND");
  if (branch.status !== "ACTIVE") {
    throw new AccountRequestServiceError("BRANCH_NOT_ACTIVE");
  }
  return branch;
}

async function assertAccountLimit(customerId: bigint, accountType: "SAVINGS" | "CURRENT") {
  const count = await prisma.accounts.count({
    where: {
      customer_id: customerId,
      account_type: accountType,
      account_status: { in: [...COUNTED_ACCOUNT_STATUSES] },
    },
  });
  if (count >= accountLimitForType(accountType)) {
    throw new AccountRequestServiceError("ACCOUNT_LIMIT_REACHED");
  }
}

async function assertNoActiveDuplicate(
  customerId: bigint,
  accountType: "SAVINGS" | "CURRENT",
  accountSubtype: string | undefined,
  excludingRequestId?: bigint
) {
  const duplicate = await prisma.account_requests.findFirst({
    where: {
      customer_id: customerId,
      account_type: accountType,
      account_subtype: accountSubtype ?? null,
      status: { in: ["PENDING", "UNDER_REVIEW"] },
      ...(excludingRequestId ? { account_request_id: { not: excludingRequestId } } : {}),
    },
    select: { account_request_id: true },
  });
  if (duplicate) {
    throw new AccountRequestServiceError("ACTIVE_ACCOUNT_REQUEST_EXISTS");
  }
}

export async function createAccountRequest(
  userId: bigint,
  input: CreateAccountRequestInput,
  auditContext: AuditContext
) {
  const customer = await getEligibleCustomer(userId);
  await assertActiveBranch(input.preferredBranchId);
  await assertAccountLimit(customer.customer_id, input.accountType);
  await assertNoActiveDuplicate(customer.customer_id, input.accountType, input.accountSubtype);

  return prisma.$transaction(async (transaction) => {
    const request = await transaction.account_requests.create({
      data: {
        customer_id: customer.customer_id,
        account_type: input.accountType,
        account_subtype: input.accountSubtype ?? null,
        preferred_branch_id: input.preferredBranchId,
        purpose: input.purpose ?? null,
        requested_per_transaction_limit: input.requestedPerTransactionLimit,
        requested_daily_transfer_limit: input.requestedDailyTransferLimit,
        notes: input.notes ?? null,
        status: "PENDING",
      },
    });
    await transaction.request_status_history.create({
      data: {
        request_type: "ACCOUNT_OPENING",
        request_id: request.account_request_id,
        new_status: "PENDING",
        changed_by: userId,
      },
    });
    await createAuditLog(
      { ...auditContext, userId, action: "ACCOUNT_REQUEST_CREATED", entity: "ACCOUNT_REQUEST", entityId: request.account_request_id },
      transaction
    );
    return request;
  });
}

export async function listAccountRequests(userId: bigint, pagination: PaginationInput) {
  const customer = await getEligibleCustomer(userId);
  const where = { customer_id: customer.customer_id };
  const [total, items] = await prisma.$transaction([
    prisma.account_requests.count({ where }),
    prisma.account_requests.findMany({
      where,
      select: {
        account_request_id: true,
        account_type: true,
        account_subtype: true,
        purpose: true,
        notes: true,
        requested_per_transaction_limit: true,
        requested_daily_transfer_limit: true,
        status: true,
        rejection_reason: true,
        approved_account_id: true,
        created_at: true,
        updated_at: true,
        preferred_branch: { select: { branch_id: true, branch_code: true, branch_name: true } },
      },
      orderBy: { created_at: "desc" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    }),
  ]);
  return { items, pagination: paginationMetadata(pagination, total) };
}

export async function updateAccountRequest(
  userId: bigint,
  requestId: bigint,
  input: UpdateAccountRequestInput
) {
  const customer = await getEligibleCustomer(userId);
  const existing = await prisma.account_requests.findFirst({
    where: { account_request_id: requestId, customer_id: customer.customer_id },
  });
  if (!existing) throw new AccountRequestServiceError("ACCOUNT_REQUEST_NOT_FOUND");
  if (existing.status !== "PENDING") {
    throw new AccountRequestServiceError("ACCOUNT_REQUEST_NOT_EDITABLE");
  }
  if (input.preferredBranchId !== undefined) await assertActiveBranch(input.preferredBranchId);
  const subtype = input.accountSubtype ?? existing.account_subtype ?? undefined;
  await assertNoActiveDuplicate(customer.customer_id, existing.account_type as "SAVINGS" | "CURRENT", subtype, requestId);

  const perTransaction = input.requestedPerTransactionLimit ?? Number(existing.requested_per_transaction_limit);
  const daily = input.requestedDailyTransferLimit ?? Number(existing.requested_daily_transfer_limit);
  if (daily < perTransaction) throw new Error("INVALID_TRANSFER_LIMITS");

  return prisma.account_requests.update({
    where: { account_request_id: requestId },
    data: {
      ...(input.accountSubtype !== undefined ? { account_subtype: input.accountSubtype } : {}),
      ...(input.preferredBranchId !== undefined ? { preferred_branch_id: input.preferredBranchId } : {}),
      ...(input.purpose !== undefined ? { purpose: input.purpose } : {}),
      ...(input.requestedPerTransactionLimit !== undefined ? { requested_per_transaction_limit: input.requestedPerTransactionLimit } : {}),
      ...(input.requestedDailyTransferLimit !== undefined ? { requested_daily_transfer_limit: input.requestedDailyTransferLimit } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updated_at: new Date(),
    },
  });
}

export async function cancelAccountRequest(
  userId: bigint,
  requestId: bigint,
  auditContext: AuditContext
) {
  const customer = await getEligibleCustomer(userId);
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.account_requests.findFirst({
      where: { account_request_id: requestId, customer_id: customer.customer_id },
      select: { status: true },
    });
    if (!existing) throw new AccountRequestServiceError("ACCOUNT_REQUEST_NOT_FOUND");
    if (existing.status !== "PENDING") {
      throw new AccountRequestServiceError("ACCOUNT_REQUEST_NOT_CANCELLABLE");
    }
    const updated = await transaction.account_requests.update({
      where: { account_request_id: requestId },
      data: { status: "CANCELLED", updated_at: new Date() },
    });
    await transaction.request_status_history.create({
      data: { request_type: "ACCOUNT_OPENING", request_id: requestId, previous_status: "PENDING", new_status: "CANCELLED", changed_by: userId },
    });
    await createAuditLog(
      { ...auditContext, userId, action: "ACCOUNT_REQUEST_CANCELLED", entity: "ACCOUNT_REQUEST", entityId: requestId },
      transaction
    );
    return updated;
  });
}
