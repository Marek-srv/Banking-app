import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";

export type AuditAction =
  | "LOGIN"
  | "CUSTOMER_CREATED"
  | "ACCOUNT_CREATED"
  | "BENEFICIARY_CREATED"
  | "TRANSFER_COMPLETED"
  | "DEPOSIT_COMPLETED"
  | "WITHDRAWAL_COMPLETED"
  | "CARD_CREATED"
  | "CARD_BLOCKED"
  | "CARD_UNBLOCKED"
  | "LOGOUT"
  | "EMPLOYEE_CREATED"
  | "EMPLOYEE_STATUS_UPDATED"
  | "EMPLOYEE_UPDATED"
  | "EMPLOYEE_STATUS_CHANGED"
  | "CUSTOMER_STATUS_UPDATED"
  | "CUSTOMER_BLOCKED"
  | "CUSTOMER_UNBLOCKED"
  | "ACCOUNT_FROZEN"
  | "ACCOUNT_UNFROZEN"
  | "ACCOUNT_CLOSED"
  | "BRANCH_CREATED"
  | "BRANCH_UPDATED"
  | "BRANCH_STATUS_CHANGED"
  | "ATM_CREATED"
  | "ATM_UPDATED"
  | "ATM_STATUS_CHANGED"
  | "TRANSACTION_REVERSED"
  | "CUSTOMER_ID_RECOVERED"
  | "PASSWORD_RESET"
  | "CUSTOMER_APPROVED"
  | "CUSTOMER_REJECTED"
  | "KYC_VERIFIED"
  | "KYC_REJECTED"
  | "KYC_STATUS_CHANGED"
  | "ACCOUNT_REQUEST_STATUS_CHANGED"
  | "ACCOUNT_REQUEST_CREATED"
  | "ACCOUNT_REQUEST_CANCELLED"
  | "ACCOUNT_REQUEST_REVIEW_STARTED"
  | "ACCOUNT_REQUEST_APPROVED"
  | "ACCOUNT_REQUEST_REJECTED"
  | "ADMIN_ACCOUNT_CREATED"
  | "ACCOUNT_CLOSURE_REQUEST_STATUS_CHANGED"
  | "TRANSFER_LIMIT_REQUEST_STATUS_CHANGED"
  | "ACCOUNT_CLOSURE_REQUEST_CREATED"
  | "ACCOUNT_CLOSURE_REQUEST_CANCELLED"
  | "ACCOUNT_CLOSURE_REQUEST_REVIEW_STARTED"
  | "ACCOUNT_CLOSURE_REQUEST_APPROVED"
  | "ACCOUNT_CLOSURE_REQUEST_REJECTED"
  | "TRANSFER_LIMIT_REQUEST_CREATED"
  | "TRANSFER_LIMIT_REQUEST_CANCELLED"
  | "TRANSFER_LIMIT_REQUEST_REVIEW_STARTED"
  | "TRANSFER_LIMIT_REQUEST_APPROVED"
  | "TRANSFER_LIMIT_REQUEST_REJECTED"
  | "ACCOUNT_LIMITS_REDUCED"
  | "LOAN_REQUEST_STATUS_CHANGED"
  | "LOAN_APPROVED"
  | "LOAN_DISBURSED"
  | "LOAN_REQUEST_CREATED"
  | "LOAN_REQUEST_CANCELLED"
  | "LOAN_REQUEST_REVIEW_STARTED"
  | "LOAN_REQUEST_REJECTED"
  | "LOAN_EMI_PAID"
  | "LOAN_AUTO_DEBIT_UPDATED"
  | "LOAN_PREPAID"
  | "LOAN_FORECLOSED"
  | "CARD_REQUEST_CREATED"
  | "CARD_REQUEST_CANCELLED"
  | "CARD_REQUEST_REVIEW_STARTED"
  | "CARD_REQUEST_APPROVED"
  | "CARD_REQUEST_REJECTED";

export interface AuditContext {
  ipAddress: string;
}

export interface AuditInput extends AuditContext {
  userId: bigint;
  action: AuditAction;
  entity: "USER" | "CUSTOMER" | "ACCOUNT" | "BENEFICIARY" | "TRANSACTION" | "CARD" | "EMPLOYEE" | "BRANCH" | "ATM" | "KYC" | "ACCOUNT_REQUEST" | "ACCOUNT_CLOSURE_REQUEST" | "TRANSFER_LIMIT_REQUEST" | "LOAN_REQUEST" | "LOAN" | "CARD_REQUEST";
  entityId: bigint;
  reason?: string;
  metadata?: Prisma.InputJsonValue;
}

type AuditClient = Pick<Prisma.TransactionClient, "audit_logs">;

export function createAuditLog(
  input: AuditInput,
  client: AuditClient = prisma
) {
  return client.audit_logs.create({
    data: {
      user_id: input.userId,
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId,
      ip_address: input.ipAddress,
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    },
  });
}
