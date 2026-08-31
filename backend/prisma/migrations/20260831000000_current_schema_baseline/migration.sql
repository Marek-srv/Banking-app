-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."account_type_v1" AS ENUM ('SAVINGS', 'CURRENT', 'LOAN');

-- CreateEnum
CREATE TYPE "public"."customer_status_v1" AS ENUM ('PENDING_ADMIN_APPROVAL', 'ACTIVE', 'REJECTED', 'BLOCKED', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."emi_status" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'PARTIALLY_PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."kyc_status_v1" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."loan_status" AS ENUM ('APPROVED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'FORECLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."request_status" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."request_type" AS ENUM ('ACCOUNT_OPENING', 'ACCOUNT_CLOSURE', 'TRANSFER_LIMIT', 'LOAN', 'CARD');

-- CreateTable
CREATE TABLE "public"."account_closure_requests" (
    "account_closure_request_id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "account_id" BIGINT NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" "public"."request_status" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" BIGINT,
    "reviewed_at" TIMESTAMP(6),
    "rejection_reason" VARCHAR(500),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_closure_requests_pkey" PRIMARY KEY ("account_closure_request_id")
);

-- CreateTable
CREATE TABLE "public"."account_recovery_otps" (
    "recovery_otp_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "purpose" VARCHAR(30) NOT NULL,
    "otp_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used_at" TIMESTAMP(6),
    "reset_token_hash" CHAR(64),
    "reset_token_expires_at" TIMESTAMP(6),
    "reset_completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_recovery_otps_pkey" PRIMARY KEY ("recovery_otp_id")
);

-- CreateTable
CREATE TABLE "public"."account_requests" (
    "account_request_id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "account_type" "public"."account_type_v1" NOT NULL,
    "account_subtype" VARCHAR(50),
    "preferred_branch_id" BIGINT,
    "purpose" VARCHAR(500),
    "requested_per_transaction_limit" DECIMAL(19,4),
    "requested_daily_transfer_limit" DECIMAL(19,4),
    "notes" TEXT,
    "status" "public"."request_status" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" BIGINT,
    "reviewed_at" TIMESTAMP(6),
    "admin_note" TEXT,
    "rejection_reason" VARCHAR(500),
    "approved_account_id" BIGINT,
    "approved_branch_id" BIGINT,
    "approved_per_transaction_limit" DECIMAL(19,4),
    "approved_daily_transfer_limit" DECIMAL(19,4),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_requests_pkey" PRIMARY KEY ("account_request_id")
);

-- CreateTable
CREATE TABLE "public"."accounts" (
    "account_id" BIGSERIAL NOT NULL,
    "account_number" VARCHAR(20) NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "account_type" "public"."account_type_v1" NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "current_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "available_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "account_status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "opened_at" DATE NOT NULL,
    "closed_at" DATE,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "account_subtype" VARCHAR(50),
    "ifsc_code" VARCHAR(20),
    "per_transaction_limit" DECIMAL(19,4),
    "daily_transfer_limit" DECIMAL(19,4),
    "frozen_at" TIMESTAMP(6),
    "frozen_by" BIGINT,
    "freeze_reason" VARCHAR(500),
    "closed_by" BIGINT,
    "close_reason" VARCHAR(500),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "public"."atms" (
    "atm_id" BIGSERIAL NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "atm_code" VARCHAR(30) NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "operating_hours" VARCHAR(100),
    "supported_transactions" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atms_pkey" PRIMARY KEY ("atm_id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "audit_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "entity" VARCHAR(50) NOT NULL,
    "entity_id" BIGINT NOT NULL,
    "ip_address" VARCHAR(45) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" VARCHAR(500),
    "metadata" JSONB,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("audit_id")
);

-- CreateTable
CREATE TABLE "public"."beneficiaries" (
    "beneficiary_id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "beneficiary_name" VARCHAR(150) NOT NULL,
    "beneficiary_account_no" VARCHAR(20) NOT NULL,
    "bank_name" VARCHAR(150),
    "bank_code" VARCHAR(30),
    "nickname" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beneficiaries_pkey" PRIMARY KEY ("beneficiary_id")
);

-- CreateTable
CREATE TABLE "public"."branches" (
    "branch_id" BIGSERIAL NOT NULL,
    "branch_code" VARCHAR(20) NOT NULL,
    "branch_name" VARCHAR(150) NOT NULL,
    "address" VARCHAR(255),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "country" VARCHAR(100) DEFAULT 'India',
    "postal_code" VARCHAR(20),
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "operating_hours" VARCHAR(100),
    "manager_id" BIGINT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "branches_pkey" PRIMARY KEY ("branch_id")
);

-- CreateTable
CREATE TABLE "public"."card_requests" (
    "card_request_id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "account_id" BIGINT NOT NULL,
    "card_type" VARCHAR(30) NOT NULL,
    "card_variant" VARCHAR(50),
    "notes" VARCHAR(500),
    "status" "public"."request_status" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" BIGINT,
    "reviewed_at" TIMESTAMP(6),
    "rejection_reason" VARCHAR(500),
    "approved_card_id" BIGINT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_requests_pkey" PRIMARY KEY ("card_request_id")
);

-- CreateTable
CREATE TABLE "public"."cards" (
    "card_id" BIGSERIAL NOT NULL,
    "account_id" BIGINT NOT NULL,
    "card_reference" VARCHAR(50) NOT NULL,
    "masked_card_number" VARCHAR(25),
    "card_type" VARCHAR(30) NOT NULL,
    "expiry_date" DATE,
    "card_status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "freeze_source" VARCHAR(30),

    CONSTRAINT "cards_pkey" PRIMARY KEY ("card_id")
);

-- CreateTable
CREATE TABLE "public"."customer_kyc_status_history" (
    "kyc_history_id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "previous_status" "public"."kyc_status_v1",
    "new_status" "public"."kyc_status_v1" NOT NULL,
    "changed_by" BIGINT,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_kyc_status_history_pkey" PRIMARY KEY ("kyc_history_id")
);

-- CreateTable
CREATE TABLE "public"."customers" (
    "customer_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "customer_number" VARCHAR(30) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "date_of_birth" DATE,
    "gender" VARCHAR(20),
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "address" VARCHAR(255),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "country" VARCHAR(100) DEFAULT 'India',
    "postal_code" VARCHAR(20),
    "kyc_status" "public"."kyc_status_v1" NOT NULL DEFAULT 'PENDING',
    "customer_status" "public"."customer_status_v1" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(6),
    "approved_by" BIGINT,
    "rejected_at" TIMESTAMP(6),
    "rejected_by" BIGINT,
    "rejection_reason" VARCHAR(500),
    "blocked_at" TIMESTAMP(6),
    "blocked_by" BIGINT,
    "block_reason" VARCHAR(500),
    "kyc_verified_at" TIMESTAMP(6),
    "kyc_verified_by" BIGINT,
    "kyc_rejected_at" TIMESTAMP(6),
    "kyc_rejected_by" BIGINT,
    "kyc_rejection_reason" VARCHAR(500),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "public"."email_verification_otps" (
    "otp_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "otp_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_otps_pkey" PRIMARY KEY ("otp_id")
);

-- CreateTable
CREATE TABLE "public"."employees" (
    "employee_id" BIGSERIAL NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "employee_number" VARCHAR(30) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "position" VARCHAR(100),
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "gender" VARCHAR(20),
    "hire_date" DATE,
    "qualification" VARCHAR(150),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("employee_id")
);

-- CreateTable
CREATE TABLE "public"."idempotency_records" (
    "idempotency_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "operation" VARCHAR(30) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
    "transaction_id" BIGINT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("idempotency_id")
);

-- CreateTable
CREATE TABLE "public"."ledger_entries" (
    "ledger_entry_id" BIGSERIAL NOT NULL,
    "transaction_id" BIGINT NOT NULL,
    "account_id" BIGINT NOT NULL,
    "entry_type" VARCHAR(10) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "balance_before" DECIMAL(19,4) NOT NULL,
    "balance_after" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("ledger_entry_id")
);

-- CreateTable
CREATE TABLE "public"."loan_emi_schedules" (
    "emi_schedule_id" BIGSERIAL NOT NULL,
    "loan_id" BIGINT NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "principal_component" DECIMAL(19,4) NOT NULL,
    "interest_component" DECIMAL(19,4) NOT NULL,
    "total_emi" DECIMAL(19,4) NOT NULL,
    "amount_paid" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "late_fee" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "status" "public"."emi_status" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(6),
    "transaction_id" BIGINT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_emi_schedules_pkey" PRIMARY KEY ("emi_schedule_id")
);

-- CreateTable
CREATE TABLE "public"."loan_requests" (
    "loan_request_id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "requested_amount" DECIMAL(19,4) NOT NULL,
    "requested_duration_months" INTEGER NOT NULL,
    "loan_type" VARCHAR(50) NOT NULL,
    "loan_subtype" VARCHAR(50),
    "purpose" VARCHAR(500) NOT NULL,
    "requested_interest_rate" DECIMAL(8,4),
    "status" "public"."request_status" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" BIGINT,
    "reviewed_at" TIMESTAMP(6),
    "approved_amount" DECIMAL(19,4),
    "approved_duration_months" INTEGER,
    "approved_interest_rate" DECIMAL(8,4),
    "rejection_reason" VARCHAR(500),
    "admin_note" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_requests_pkey" PRIMARY KEY ("loan_request_id")
);

-- CreateTable
CREATE TABLE "public"."loans" (
    "loan_id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "account_id" BIGINT NOT NULL,
    "loan_request_id" BIGINT NOT NULL,
    "principal_amount" DECIMAL(19,4) NOT NULL,
    "outstanding_principal" DECIMAL(19,4) NOT NULL,
    "interest_rate" DECIMAL(8,4) NOT NULL,
    "duration_months" INTEGER NOT NULL,
    "emi_amount" DECIMAL(19,4) NOT NULL,
    "loan_type" VARCHAR(50) NOT NULL,
    "loan_subtype" VARCHAR(50),
    "status" "public"."loan_status" NOT NULL DEFAULT 'APPROVED',
    "approved_at" TIMESTAMP(6),
    "approved_by" BIGINT,
    "disbursed_at" TIMESTAMP(6),
    "disbursed_by" BIGINT,
    "closed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disbursement_transaction_id" BIGINT,
    "auto_debit_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_debit_account_id" BIGINT,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("loan_id")
);

-- CreateTable
CREATE TABLE "public"."pending_registrations" (
    "pending_registration_id" BIGSERIAL NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "mobile" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "otp_hash" VARCHAR(255) NOT NULL,
    "otp_expires_at" TIMESTAMP(6) NOT NULL,
    "otp_attempts" INTEGER NOT NULL DEFAULT 0,
    "otp_used_at" TIMESTAMP(6),
    "email_verified_at" TIMESTAMP(6),
    "registration_token_hash" CHAR(64),
    "registration_token_expires_at" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_registrations_pkey" PRIMARY KEY ("pending_registration_id")
);

-- CreateTable
CREATE TABLE "public"."request_status_history" (
    "request_status_history_id" BIGSERIAL NOT NULL,
    "request_type" "public"."request_type" NOT NULL,
    "request_id" BIGINT NOT NULL,
    "previous_status" "public"."request_status",
    "new_status" "public"."request_status" NOT NULL,
    "changed_by" BIGINT,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_status_history_pkey" PRIMARY KEY ("request_status_history_id")
);

-- CreateTable
CREATE TABLE "public"."transaction_details" (
    "transaction_detail_id" BIGSERIAL NOT NULL,
    "transaction_id" BIGINT NOT NULL,
    "description" VARCHAR(255),
    "merchant_payee" VARCHAR(150),
    "transaction_category" VARCHAR(100),
    "notes" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_details_pkey" PRIMARY KEY ("transaction_detail_id")
);

-- CreateTable
CREATE TABLE "public"."transaction_status_history" (
    "status_history_id" BIGSERIAL NOT NULL,
    "transaction_id" BIGINT NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_status_history_pkey" PRIMARY KEY ("status_history_id")
);

-- CreateTable
CREATE TABLE "public"."transactions" (
    "transaction_id" BIGSERIAL NOT NULL,
    "reference_number" VARCHAR(50) NOT NULL,
    "transaction_type" VARCHAR(30) NOT NULL,
    "source_account_id" BIGINT,
    "destination_account_id" BIGINT,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "status" VARCHAR(30) NOT NULL DEFAULT 'INITIATED',
    "initiated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversal_of_transaction_id" BIGINT,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateTable
CREATE TABLE "public"."transfer_limit_requests" (
    "transfer_limit_request_id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "account_id" BIGINT NOT NULL,
    "current_per_transaction_limit" DECIMAL(19,4),
    "requested_per_transaction_limit" DECIMAL(19,4) NOT NULL,
    "current_daily_transfer_limit" DECIMAL(19,4),
    "requested_daily_transfer_limit" DECIMAL(19,4) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" "public"."request_status" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" BIGINT,
    "reviewed_at" TIMESTAMP(6),
    "rejection_reason" VARCHAR(500),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_limit_requests_pkey" PRIMARY KEY ("transfer_limit_request_id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "user_id" BIGSERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(30) NOT NULL DEFAULT 'CUSTOMER',
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(6),
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMP(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "idx_account_closure_request_account" ON "public"."account_closure_requests"("account_id" ASC);

-- CreateIndex
CREATE INDEX "idx_account_closure_request_customer" ON "public"."account_closure_requests"("customer_id" ASC);

-- CreateIndex
CREATE INDEX "idx_account_closure_request_customer_status" ON "public"."account_closure_requests"("customer_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "idx_account_closure_request_status_created" ON "public"."account_closure_requests"("status" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_account_recovery_otp_expires" ON "public"."account_recovery_otps"("expires_at" ASC);

-- CreateIndex
CREATE INDEX "idx_account_recovery_otp_user_purpose" ON "public"."account_recovery_otps"("user_id" ASC, "purpose" ASC);

-- CreateIndex
CREATE INDEX "idx_account_recovery_reset_token" ON "public"."account_recovery_otps"("reset_token_hash" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_account_recovery_active_purpose" ON "public"."account_recovery_otps"("user_id" ASC, "purpose" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "account_requests_approved_account_id_key" ON "public"."account_requests"("approved_account_id" ASC);

-- CreateIndex
CREATE INDEX "idx_account_request_customer" ON "public"."account_requests"("customer_id" ASC);

-- CreateIndex
CREATE INDEX "idx_account_request_customer_status" ON "public"."account_requests"("customer_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "idx_account_request_status_created" ON "public"."account_requests"("status" ASC, "created_at" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_account_number_key" ON "public"."accounts"("account_number" ASC);

-- CreateIndex
CREATE INDEX "idx_account_closed_by" ON "public"."accounts"("closed_by" ASC);

-- CreateIndex
CREATE INDEX "idx_account_frozen_by" ON "public"."accounts"("frozen_by" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "atms_atm_code_key" ON "public"."atms"("atm_code" ASC);

-- CreateIndex
CREATE INDEX "idx_audit_action" ON "public"."audit_logs"("action" ASC);

-- CreateIndex
CREATE INDEX "idx_audit_created_at" ON "public"."audit_logs"("created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_audit_entity" ON "public"."audit_logs"("entity" ASC, "entity_id" ASC);

-- CreateIndex
CREATE INDEX "idx_audit_user" ON "public"."audit_logs"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "branches_branch_code_key" ON "public"."branches"("branch_code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "branches_email_key" ON "public"."branches"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "card_requests_approved_card_id_key" ON "public"."card_requests"("approved_card_id" ASC);

-- CreateIndex
CREATE INDEX "idx_card_request_account_status" ON "public"."card_requests"("account_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "idx_card_request_customer_status" ON "public"."card_requests"("customer_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "idx_card_request_status_created" ON "public"."card_requests"("status" ASC, "created_at" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "cards_card_reference_key" ON "public"."cards"("card_reference" ASC);

-- CreateIndex
CREATE INDEX "idx_card_account_freeze_source" ON "public"."cards"("account_id" ASC, "freeze_source" ASC);

-- CreateIndex
CREATE INDEX "idx_kyc_history_customer_created" ON "public"."customer_kyc_status_history"("customer_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_kyc_history_status" ON "public"."customer_kyc_status_history"("new_status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "customers_customer_number_key" ON "public"."customers"("customer_number" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "public"."customers"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "customers_user_id_key" ON "public"."customers"("user_id" ASC);

-- CreateIndex
CREATE INDEX "idx_customer_kyc_status" ON "public"."customers"("kyc_status" ASC);

-- CreateIndex
CREATE INDEX "idx_customer_status" ON "public"."customers"("customer_status" ASC);

-- CreateIndex
CREATE INDEX "idx_email_verification_otp_expires" ON "public"."email_verification_otps"("expires_at" ASC);

-- CreateIndex
CREATE INDEX "idx_email_verification_otp_user" ON "public"."email_verification_otps"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_email_verification_otp_active_user" ON "public"."email_verification_otps"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "public"."employees"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_number_key" ON "public"."employees"("employee_number" ASC);

-- CreateIndex
CREATE INDEX "idx_idempotency_created_at" ON "public"."idempotency_records"("created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_idempotency_transaction" ON "public"."idempotency_records"("transaction_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_idempotency_user_key" ON "public"."idempotency_records"("user_id" ASC, "idempotency_key" ASC);

-- CreateIndex
CREATE INDEX "idx_emi_schedule_due_status" ON "public"."loan_emi_schedules"("due_date" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "idx_emi_schedule_loan" ON "public"."loan_emi_schedules"("loan_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_emi_schedule_installment" ON "public"."loan_emi_schedules"("loan_id" ASC, "installment_number" ASC);

-- CreateIndex
CREATE INDEX "idx_loan_request_customer" ON "public"."loan_requests"("customer_id" ASC);

-- CreateIndex
CREATE INDEX "idx_loan_request_customer_status" ON "public"."loan_requests"("customer_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "idx_loan_request_status_created" ON "public"."loan_requests"("status" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_loan_auto_debit_account" ON "public"."loans"("auto_debit_account_id" ASC);

-- CreateIndex
CREATE INDEX "idx_loan_customer" ON "public"."loans"("customer_id" ASC);

-- CreateIndex
CREATE INDEX "idx_loan_status" ON "public"."loans"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "loans_account_id_key" ON "public"."loans"("account_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "loans_disbursement_transaction_id_key" ON "public"."loans"("disbursement_transaction_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "loans_loan_request_id_key" ON "public"."loans"("loan_request_id" ASC);

-- CreateIndex
CREATE INDEX "idx_pending_registration_otp_expires" ON "public"."pending_registrations"("otp_expires_at" ASC);

-- CreateIndex
CREATE INDEX "idx_pending_registration_token_expires" ON "public"."pending_registrations"("registration_token_expires_at" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_pending_registration_email" ON "public"."pending_registrations"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_pending_registration_token_hash" ON "public"."pending_registrations"("registration_token_hash" ASC);

-- CreateIndex
CREATE INDEX "idx_request_status_history_request" ON "public"."request_status_history"("request_type" ASC, "request_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_request_status_history_status" ON "public"."request_status_history"("new_status" ASC, "created_at" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reference_number_key" ON "public"."transactions"("reference_number" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_transaction_reversal_of" ON "public"."transactions"("reversal_of_transaction_id" ASC);

-- CreateIndex
CREATE INDEX "idx_transfer_limit_request_account" ON "public"."transfer_limit_requests"("account_id" ASC);

-- CreateIndex
CREATE INDEX "idx_transfer_limit_request_customer" ON "public"."transfer_limit_requests"("customer_id" ASC);

-- CreateIndex
CREATE INDEX "idx_transfer_limit_request_customer_status" ON "public"."transfer_limit_requests"("customer_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "idx_transfer_limit_request_status_created" ON "public"."transfer_limit_requests"("status" ASC, "created_at" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email" ASC);

-- AddForeignKey
ALTER TABLE "public"."account_closure_requests" ADD CONSTRAINT "fk_account_closure_request_account" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("account_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."account_closure_requests" ADD CONSTRAINT "fk_account_closure_request_customer" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."account_closure_requests" ADD CONSTRAINT "fk_account_closure_request_reviewed_by" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."account_recovery_otps" ADD CONSTRAINT "fk_account_recovery_otp_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."account_requests" ADD CONSTRAINT "fk_account_request_approved_account" FOREIGN KEY ("approved_account_id") REFERENCES "public"."accounts"("account_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."account_requests" ADD CONSTRAINT "fk_account_request_approved_branch" FOREIGN KEY ("approved_branch_id") REFERENCES "public"."branches"("branch_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."account_requests" ADD CONSTRAINT "fk_account_request_customer" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."account_requests" ADD CONSTRAINT "fk_account_request_preferred_branch" FOREIGN KEY ("preferred_branch_id") REFERENCES "public"."branches"("branch_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."account_requests" ADD CONSTRAINT "fk_account_request_reviewed_by" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "fk_account_branch" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("branch_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "fk_account_closed_by" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "fk_account_customer" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "fk_account_frozen_by" FOREIGN KEY ("frozen_by") REFERENCES "public"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."atms" ADD CONSTRAINT "fk_atm_branch" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("branch_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "fk_audit_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."beneficiaries" ADD CONSTRAINT "fk_beneficiary_customer" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."branches" ADD CONSTRAINT "fk_branch_manager" FOREIGN KEY ("manager_id") REFERENCES "public"."employees"("employee_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."card_requests" ADD CONSTRAINT "fk_card_request_account" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("account_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."card_requests" ADD CONSTRAINT "fk_card_request_approved_card" FOREIGN KEY ("approved_card_id") REFERENCES "public"."cards"("card_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."card_requests" ADD CONSTRAINT "fk_card_request_customer" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."card_requests" ADD CONSTRAINT "fk_card_request_reviewed_by" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cards" ADD CONSTRAINT "fk_card_account" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("account_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."customer_kyc_status_history" ADD CONSTRAINT "fk_kyc_history_changed_by" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."customer_kyc_status_history" ADD CONSTRAINT "fk_kyc_history_customer" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "fk_customer_approved_by" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "fk_customer_blocked_by" FOREIGN KEY ("blocked_by") REFERENCES "public"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "fk_customer_branch" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("branch_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "fk_customer_kyc_rejected_by" FOREIGN KEY ("kyc_rejected_by") REFERENCES "public"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "fk_customer_kyc_verified_by" FOREIGN KEY ("kyc_verified_by") REFERENCES "public"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "fk_customer_rejected_by" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "fk_customer_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."email_verification_otps" ADD CONSTRAINT "fk_email_verification_otp_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "fk_employee_branch" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("branch_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."idempotency_records" ADD CONSTRAINT "fk_idempotency_transaction" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("transaction_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."idempotency_records" ADD CONSTRAINT "fk_idempotency_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ledger_entries" ADD CONSTRAINT "fk_ledger_account" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("account_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ledger_entries" ADD CONSTRAINT "fk_ledger_transaction" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("transaction_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."loan_emi_schedules" ADD CONSTRAINT "fk_emi_schedule_loan" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("loan_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."loan_emi_schedules" ADD CONSTRAINT "fk_emi_schedule_transaction" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("transaction_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."loan_requests" ADD CONSTRAINT "fk_loan_request_customer" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."loan_requests" ADD CONSTRAINT "fk_loan_request_reviewed_by" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."loans" ADD CONSTRAINT "fk_loan_account" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("account_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."loans" ADD CONSTRAINT "fk_loan_approved_by" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."loans" ADD CONSTRAINT "fk_loan_auto_debit_account" FOREIGN KEY ("auto_debit_account_id") REFERENCES "public"."accounts"("account_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."loans" ADD CONSTRAINT "fk_loan_customer" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."loans" ADD CONSTRAINT "fk_loan_disbursed_by" FOREIGN KEY ("disbursed_by") REFERENCES "public"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."loans" ADD CONSTRAINT "fk_loan_disbursement_transaction" FOREIGN KEY ("disbursement_transaction_id") REFERENCES "public"."transactions"("transaction_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."loans" ADD CONSTRAINT "fk_loan_request" FOREIGN KEY ("loan_request_id") REFERENCES "public"."loan_requests"("loan_request_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."request_status_history" ADD CONSTRAINT "fk_request_status_history_changed_by" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."transaction_details" ADD CONSTRAINT "fk_transaction_detail" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("transaction_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."transaction_status_history" ADD CONSTRAINT "fk_transaction_status" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("transaction_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "fk_transaction_destination" FOREIGN KEY ("destination_account_id") REFERENCES "public"."accounts"("account_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "fk_transaction_reversal_of" FOREIGN KEY ("reversal_of_transaction_id") REFERENCES "public"."transactions"("transaction_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "fk_transaction_source" FOREIGN KEY ("source_account_id") REFERENCES "public"."accounts"("account_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."transfer_limit_requests" ADD CONSTRAINT "fk_transfer_limit_request_account" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("account_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."transfer_limit_requests" ADD CONSTRAINT "fk_transfer_limit_request_customer" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."transfer_limit_requests" ADD CONSTRAINT "fk_transfer_limit_request_reviewed_by" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;


-- PostgreSQL check constraints introspected from the current database.
ALTER TABLE "account_recovery_otps" ADD CONSTRAINT "chk_account_recovery_attempts" CHECK (attempts >= 0 AND attempts <= 5);
ALTER TABLE "account_recovery_otps" ADD CONSTRAINT "chk_account_recovery_purpose" CHECK (purpose::text = ANY (ARRAY['CUSTOMER_ID'::character varying, 'PASSWORD_RESET'::character varying]::text[]));
ALTER TABLE "account_requests" ADD CONSTRAINT "chk_account_request_approved_daily_transfer_limit" CHECK (approved_daily_transfer_limit IS NULL OR approved_daily_transfer_limit > 0::numeric);
ALTER TABLE "account_requests" ADD CONSTRAINT "chk_account_request_approved_per_transaction_limit" CHECK (approved_per_transaction_limit IS NULL OR approved_per_transaction_limit > 0::numeric);
ALTER TABLE "account_requests" ADD CONSTRAINT "chk_account_request_requested_daily_transfer_limit" CHECK (requested_daily_transfer_limit IS NULL OR requested_daily_transfer_limit > 0::numeric);
ALTER TABLE "account_requests" ADD CONSTRAINT "chk_account_request_requested_per_transaction_limit" CHECK (requested_per_transaction_limit IS NULL OR requested_per_transaction_limit > 0::numeric);
ALTER TABLE "accounts" ADD CONSTRAINT "chk_account_daily_transfer_limit" CHECK (daily_transfer_limit IS NULL OR daily_transfer_limit > 0::numeric);
ALTER TABLE "accounts" ADD CONSTRAINT "chk_account_per_transaction_limit" CHECK (per_transaction_limit IS NULL OR per_transaction_limit > 0::numeric);
ALTER TABLE "accounts" ADD CONSTRAINT "chk_available_balance" CHECK (available_balance >= 0::numeric);
ALTER TABLE "accounts" ADD CONSTRAINT "chk_current_balance" CHECK (current_balance >= 0::numeric);
ALTER TABLE "branches" ADD CONSTRAINT "chk_branch_status" CHECK (status::text = ANY (ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying]::text[]));
ALTER TABLE "email_verification_otps" ADD CONSTRAINT "chk_email_verification_otp_attempts" CHECK (attempts >= 0 AND attempts <= 5);
ALTER TABLE "idempotency_records" ADD CONSTRAINT "chk_idempotency_status" CHECK (status::text = ANY (ARRAY['PROCESSING'::character varying, 'COMPLETED'::character varying]::text[]));
ALTER TABLE "ledger_entries" ADD CONSTRAINT "chk_ledger_amount" CHECK (amount > 0::numeric);
ALTER TABLE "ledger_entries" ADD CONSTRAINT "chk_ledger_balance" CHECK (entry_type::text = 'DEBIT'::text AND balance_after = (balance_before - amount) OR entry_type::text = 'CREDIT'::text AND balance_after = (balance_before + amount));
ALTER TABLE "ledger_entries" ADD CONSTRAINT "chk_ledger_type" CHECK (entry_type::text = ANY (ARRAY['DEBIT'::character varying, 'CREDIT'::character varying]::text[]));
ALTER TABLE "loan_emi_schedules" ADD CONSTRAINT "chk_emi_schedule_values" CHECK (installment_number > 0 AND principal_component >= 0::numeric AND interest_component >= 0::numeric AND total_emi > 0::numeric AND amount_paid >= 0::numeric AND late_fee >= 0::numeric);
ALTER TABLE "loan_requests" ADD CONSTRAINT "chk_loan_request_values" CHECK (requested_amount > 0::numeric AND requested_duration_months > 0 AND (requested_interest_rate IS NULL OR requested_interest_rate >= 0::numeric) AND (approved_amount IS NULL OR approved_amount > 0::numeric) AND (approved_duration_months IS NULL OR approved_duration_months > 0) AND (approved_interest_rate IS NULL OR approved_interest_rate >= 0::numeric));
ALTER TABLE "loans" ADD CONSTRAINT "chk_loan_values" CHECK (principal_amount > 0::numeric AND outstanding_principal >= 0::numeric AND interest_rate >= 0::numeric AND duration_months > 0 AND emi_amount > 0::numeric);
ALTER TABLE "pending_registrations" ADD CONSTRAINT "chk_pending_registration_otp_attempts" CHECK (otp_attempts >= 0 AND otp_attempts <= 5);
ALTER TABLE "transactions" ADD CONSTRAINT "chk_completed_at" CHECK (status::text <> 'COMPLETED'::text OR completed_at IS NOT NULL);
ALTER TABLE "transactions" ADD CONSTRAINT "chk_different_accounts" CHECK (destination_account_id IS NULL OR source_account_id <> destination_account_id);
ALTER TABLE "transactions" ADD CONSTRAINT "chk_transaction_amount" CHECK (amount > 0::numeric);
ALTER TABLE "transactions" ADD CONSTRAINT "chk_transfer_destination" CHECK (transaction_type::text <> 'TRANSFER'::text OR source_account_id IS NOT NULL AND destination_account_id IS NOT NULL);
ALTER TABLE "transfer_limit_requests" ADD CONSTRAINT "chk_transfer_limit_request_values" CHECK (requested_per_transaction_limit > 0::numeric AND requested_daily_transfer_limit > 0::numeric AND (current_per_transaction_limit IS NULL OR current_per_transaction_limit > 0::numeric) AND (current_daily_transfer_limit IS NULL OR current_daily_transfer_limit > 0::numeric));
