import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { Prisma } from "../generated/prisma/client";
import { AppError } from "../errors/app-error";

interface ErrorDefinition {
  statusCode: number;
  message: string;
}

const errorDefinitions: Record<string, ErrorDefinition> = {
  UNAUTHORIZED: { statusCode: 401, message: "Authentication required" },
  INVALID_TOKEN: { statusCode: 401, message: "Invalid or expired token" },
  FORBIDDEN: { statusCode: 403, message: "Access denied" },
  INVALID_CREDENTIALS: { statusCode: 401, message: "Invalid Customer ID or password" },
  ACCOUNT_TEMPORARILY_LOCKED: { statusCode: 423, message: "Account temporarily locked after repeated login failures" },
  EMAIL_ALREADY_EXISTS: { statusCode: 409, message: "Email already exists" },
  MOBILE_ALREADY_EXISTS: { statusCode: 409, message: "Mobile number is already registered" },
  REGISTRATION_COOLING_PERIOD: { statusCode: 409, message: "A new registration can be started 24 hours after rejection" },
  EMAIL_NOT_VERIFIED: { statusCode: 403, message: "Email verification is required" },
  INVALID_OR_EXPIRED_OTP: { statusCode: 400, message: "Invalid or expired OTP" },
  OTP_ATTEMPTS_EXCEEDED: { statusCode: 429, message: "Maximum OTP verification attempts exceeded" },
  INVALID_REGISTRATION_TOKEN: { statusCode: 400, message: "Invalid or expired registration authorization" },
  REGISTRATION_ALREADY_COMPLETED: { statusCode: 409, message: "Registration has already been completed" },
  ONBOARDING_BRANCH_NOT_FOUND: { statusCode: 503, message: "Online onboarding is temporarily unavailable" },
  INVALID_OR_EXPIRED_RECOVERY_OTP: { statusCode: 400, message: "Invalid or expired recovery OTP" },
  RECOVERY_OTP_ATTEMPTS_EXCEEDED: { statusCode: 429, message: "Maximum recovery OTP attempts exceeded" },
  INVALID_PASSWORD_RESET_TOKEN: { statusCode: 400, message: "Invalid or expired password reset authorization" },
  EMAIL_DELIVERY_FAILED: { statusCode: 503, message: "Unable to send verification email" },
  EMAIL_DELIVERY_NOT_CONFIGURED: { statusCode: 503, message: "Email delivery is not configured" },
  CUSTOMER_ALREADY_EXISTS: { statusCode: 409, message: "Customer already exists" },
  CUSTOMER_NUMBER_GENERATION_FAILED: { statusCode: 500, message: "Unable to generate Customer ID" },
  CUSTOMER_NOT_FOUND: { statusCode: 404, message: "Customer not found" },
  CUSTOMER_PENDING_ADMIN_APPROVAL: { statusCode: 403, message: "Customer registration is awaiting admin approval" },
  CUSTOMER_REGISTRATION_REJECTED: { statusCode: 403, message: "Customer registration was rejected" },
  CUSTOMER_BLOCKED: { statusCode: 403, message: "Customer access is blocked" },
  CUSTOMER_LOGIN_DISABLED: { statusCode: 403, message: "Customer login is disabled" },
  INVALID_KYC_STATUS_TRANSITION: { statusCode: 409, message: "KYC status transition is not allowed" },
  CUSTOMER_APPROVAL_INVALID_STATE: { statusCode: 409, message: "Customer is not awaiting approval" },
  CUSTOMER_KYC_NOT_VERIFIED: { statusCode: 409, message: "Customer KYC must be verified before approval" },
  CUSTOMER_PROFILE_INCOMPLETE: { statusCode: 409, message: "Customer profile is incomplete" },
  DUPLICATE_ACTIVE_CUSTOMER: { statusCode: 409, message: "An active customer already uses this email or mobile number" },
  CUSTOMER_REJECTION_INVALID_STATE: { statusCode: 409, message: "Only a pending customer can be rejected" },
  CUSTOMER_BLOCK_INVALID_STATE: { statusCode: 409, message: "Only an active customer can be blocked" },
  CUSTOMER_UNBLOCK_INVALID_STATE: { statusCode: 409, message: "Only a blocked customer can be unblocked" },
  BLOCK_REASON_REQUIRED: { statusCode: 400, message: "Use the block action and provide a reason" },
  ACCOUNT_NOT_FOUND: { statusCode: 404, message: "Account not found" },
  SOURCE_ACCOUNT_NOT_FOUND: { statusCode: 404, message: "Source account not found" },
  DESTINATION_ACCOUNT_NOT_FOUND: { statusCode: 404, message: "Destination account not found" },
  UNAUTHORIZED_ACCOUNT: { statusCode: 403, message: "Account access denied" },
  UNAUTHORIZED_SOURCE_ACCOUNT: { statusCode: 403, message: "Source account access denied" },
  ACCOUNT_NOT_ACTIVE: { statusCode: 409, message: "Account is not active" },
  SOURCE_ACCOUNT_NOT_ACTIVE: { statusCode: 409, message: "Source account is not active" },
  DESTINATION_ACCOUNT_NOT_ACTIVE: { statusCode: 409, message: "Destination account is not active" },
  ACCOUNT_BRANCH_MUST_MATCH_CUSTOMER_BRANCH: { statusCode: 400, message: "Account branch must match customer branch" },
  ACCOUNT_NUMBER_GENERATION_FAILED: { statusCode: 500, message: "Unable to generate account number" },
  CUSTOMER_NOT_ACTIVE: { statusCode: 403, message: "Customer must be active" },
  BRANCH_NOT_ACTIVE: { statusCode: 409, message: "Branch is not active" },
  ACCOUNT_LIMIT_REACHED: { statusCode: 409, message: "Maximum number of accounts for this type has been reached" },
  ACTIVE_ACCOUNT_REQUEST_EXISTS: { statusCode: 409, message: "An active request already exists for this account type and subtype" },
  ACCOUNT_REQUEST_NOT_FOUND: { statusCode: 404, message: "Account request not found" },
  ACCOUNT_REQUEST_NOT_EDITABLE: { statusCode: 409, message: "Only pending account requests can be edited" },
  ACCOUNT_REQUEST_NOT_CANCELLABLE: { statusCode: 409, message: "Only pending account requests can be cancelled" },
  ACCOUNT_REQUEST_NOT_REVIEWABLE: { statusCode: 409, message: "Only pending account requests can enter review" },
  ACCOUNT_REQUEST_NOT_APPROVABLE: { statusCode: 409, message: "Only account requests under review can be approved" },
  ACCOUNT_REQUEST_NOT_REJECTABLE: { statusCode: 409, message: "Account request cannot be rejected in its current state" },
  ACCOUNT_REQUEST_CONFLICT: { statusCode: 409, message: "A conflicting active account request exists" },
  INVALID_TRANSFER_LIMITS: { statusCode: 400, message: "Transfer limits are invalid" },
  ACCOUNT_CANNOT_CLOSE_WITH_BALANCE: { statusCode: 409, message: "Account balance must be zero before closure" },
  ACCOUNT_ALREADY_CLOSED: { statusCode: 409, message: "Account is already closed" },
  ACCOUNT_ALREADY_FROZEN: { statusCode: 409, message: "Account is already frozen" },
  ACCOUNT_NOT_FROZEN: { statusCode: 409, message: "Account is not frozen" },
  ACTIVE_ACCOUNT_CLOSURE_REQUEST_EXISTS: { statusCode: 409, message: "An active closure request already exists for this account" },
  ACCOUNT_CLOSURE_REQUEST_NOT_FOUND: { statusCode: 404, message: "Account closure request not found" },
  ACCOUNT_CLOSURE_REQUEST_NOT_CANCELLABLE: { statusCode: 409, message: "Only pending closure requests can be cancelled" },
  ACTIVE_TRANSFER_LIMIT_REQUEST_EXISTS: { statusCode: 409, message: "An active transfer-limit request already exists for this account" },
  TRANSFER_LIMIT_REQUEST_NOT_FOUND: { statusCode: 404, message: "Transfer-limit request not found" },
  TRANSFER_LIMIT_REQUEST_NOT_CANCELLABLE: { statusCode: 409, message: "Only pending transfer-limit requests can be cancelled" },
  SERVICING_REQUEST_NOT_REVIEWABLE: { statusCode: 409, message: "Only pending requests can enter review" },
  SERVICING_REQUEST_NOT_APPROVABLE: { statusCode: 409, message: "Only requests under review can be approved" },
  SERVICING_REQUEST_NOT_REJECTABLE: { statusCode: 409, message: "Request cannot be rejected in its current state" },
  ACCOUNT_HAS_PENDING_TRANSACTIONS: { statusCode: 409, message: "Account has pending transactions" },
  ACCOUNT_HAS_ACTIVE_LOAN_OBLIGATIONS: { statusCode: 409, message: "Account has active loan or EMI obligations" },
  DIRECT_LIMIT_INCREASE_NOT_ALLOWED: { statusCode: 409, message: "Direct admin changes may only reduce transfer limits" },
  BENEFICIARY_NOT_FOUND: { statusCode: 404, message: "Beneficiary not found" },
  BENEFICIARY_ALREADY_EXISTS: { statusCode: 409, message: "Beneficiary already exists" },
  TRANSACTION_NOT_FOUND: { statusCode: 404, message: "Transaction not found" },
  TRANSACTION_REFERENCE_GENERATION_FAILED: { statusCode: 500, message: "Unable to generate transaction reference" },
  SAME_ACCOUNT_TRANSFER_NOT_ALLOWED: { statusCode: 400, message: "Source and destination accounts must differ" },
  INSUFFICIENT_FUNDS: { statusCode: 409, message: "Insufficient available balance" },
  CURRENCY_MISMATCH: { statusCode: 409, message: "Account currencies do not match" },
  TRANSFER_TEMPORARILY_BUSY: { statusCode: 503, message: "Transfer service is busy. Please retry shortly" },
  TRANSFER_PER_TRANSACTION_LIMIT_EXCEEDED: { statusCode: 409, message: "Transfer exceeds the account per-transaction limit" },
  TRANSFER_DAILY_LIMIT_EXCEEDED: { statusCode: 409, message: "Transfer exceeds the account daily transfer limit" },
  CARD_NOT_FOUND: { statusCode: 404, message: "Card not found" },
  CARD_REFERENCE_GENERATION_FAILED: { statusCode: 500, message: "Unable to generate card reference" },
  CARD_BLOCKED_BY_ACCOUNT: { statusCode: 409, message: "Card cannot be unblocked while its account is frozen" },
  BRANCH_NOT_FOUND: { statusCode: 404, message: "Branch not found" },
  ATM_NOT_FOUND: { statusCode: 404, message: "ATM not found" },
  EMPLOYEE_NOT_FOUND: { statusCode: 404, message: "Employee not found" },
  MANAGER_MUST_BELONG_TO_BRANCH: { statusCode: 409, message: "Branch manager must be assigned to the same branch" },
  TRANSACTION_NOT_REVERSIBLE: { statusCode: 409, message: "Transaction is not eligible for reversal" },
  TRANSACTION_ALREADY_REVERSED: { statusCode: 409, message: "Transaction has already been reversed" },
  REVERSAL_ACCOUNT_NOT_ACTIVE: { statusCode: 409, message: "A reversal account is not active" },
  REVERSAL_INSUFFICIENT_FUNDS: { statusCode: 409, message: "Insufficient funds to reverse transaction" },
  REVERSAL_LEDGER_INVALID: { statusCode: 409, message: "Original transaction ledger cannot be reversed" },
  IDEMPOTENCY_KEY_REUSED: { statusCode: 409, message: "Idempotency key was already used for a different request" },
  IDEMPOTENCY_REQUEST_IN_PROGRESS: { statusCode: 409, message: "Idempotent request is still processing" },
  IDEMPOTENCY_STATE_NOT_FOUND: { statusCode: 500, message: "Idempotency state could not be resolved" },
  ASSISTANT_UNAVAILABLE: { statusCode: 503, message: "Banking Assistant is temporarily unavailable" },
  ASSISTANT_UNSUPPORTED_QUESTION: { statusCode: 400, message: "This question is not supported yet. Try one of the suggested banking questions." },
  ASSISTANT_READ_ONLY: { statusCode: 400, message: "The Banking Assistant can explain your finances but cannot perform banking actions." },
  LOAN_REQUEST_NOT_FOUND: { statusCode: 404, message: "Loan request not found" },
  LOAN_REQUEST_NOT_CANCELLABLE: { statusCode: 409, message: "Only pending loan requests can be cancelled" },
  LOAN_REQUEST_NOT_REVIEWABLE: { statusCode: 409, message: "Only pending loan requests can enter review" },
  LOAN_REQUEST_NOT_APPROVABLE: { statusCode: 409, message: "Only loan requests under review can be approved" },
  LOAN_REQUEST_NOT_REJECTABLE: { statusCode: 409, message: "Loan request cannot be rejected in its current state" },
  UNSUPPORTED_LOAN_DURATION: { statusCode: 400, message: "Loan duration must be between 1 and 60 months" },
  LOAN_ACCOUNT_NOT_FOUND: { statusCode: 409, message: "Loan liability account is unavailable" },
  ACTIVE_CARD_REQUEST_EXISTS: { statusCode: 409, message: "An active card request already exists for this account and card type" },
  CARD_REQUEST_NOT_FOUND: { statusCode: 404, message: "Card request not found" },
  CARD_REQUEST_NOT_CANCELLABLE: { statusCode: 409, message: "Only pending card requests can be cancelled" },
  CARD_REQUEST_NOT_REVIEWABLE: { statusCode: 409, message: "Only pending card requests can enter review" },
  CARD_REQUEST_NOT_APPROVABLE: { statusCode: 409, message: "Only card requests under review can be approved" },
  CARD_REQUEST_NOT_REJECTABLE: { statusCode: 409, message: "Card request cannot be rejected in its current state" },
  LOAN_NOT_FOUND: { statusCode: 404, message: "Loan not found" },
  LOAN_NOT_DISBURSABLE: { statusCode: 409, message: "Loan is not eligible for disbursement" },
  LOAN_NOT_PAYABLE: { statusCode: 409, message: "Loan is not currently payable" },
  EMI_NOT_FOUND: { statusCode: 404, message: "EMI installment not found" },
  EMI_NOT_PAYABLE: { statusCode: 409, message: "EMI installment is not payable" },
  INVALID_LOAN_PAYMENT_AMOUNT: { statusCode: 400, message: "Loan payment amount must be greater than zero" },
  PREPAYMENT_MUST_BE_LESS_THAN_FORECLOSURE_AMOUNT: { statusCode: 409, message: "Partial prepayment must be less than the foreclosure amount" },
  LOAN_AUTO_DEBIT_NOT_ENABLED: { statusCode: 409, message: "Auto-debit is not enabled for this loan" },
};

function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new AppError(400, "INVALID_REQUEST", "Invalid request", error.issues);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return new AppError(409, "RESOURCE_CONFLICT", "Resource already exists");
    }

    if (error.code === "P2025") {
      return new AppError(404, "RESOURCE_NOT_FOUND", "Resource not found");
    }

    return new AppError(500, "DATABASE_ERROR", "Database operation failed");
  }

  if (error instanceof Error) {
    const definition = errorDefinitions[error.message];

    if (definition) {
      return new AppError(
        definition.statusCode,
        error.message,
        definition.message
      );
    }
  }

  return new AppError(500, "INTERNAL_SERVER_ERROR", "Internal server error");
}

export const errorMiddleware: ErrorRequestHandler = (
  error,
  _req,
  res,
  next
) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const appError = normalizeError(error);

  if (appError.statusCode >= 500) {
    console.error("Request failed:", error);
  }

  res.status(appError.statusCode).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details === undefined
        ? {}
        : { details: appError.details }),
    },
  });
};
