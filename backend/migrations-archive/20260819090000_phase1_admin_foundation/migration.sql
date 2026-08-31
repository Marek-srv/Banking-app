-- Phase 1 admin feature foundation. This migration is forward-only and preserves
-- all existing customer, account, transaction, and ledger rows.

CREATE TYPE "customer_status_v1" AS ENUM (
    'PENDING_ADMIN_APPROVAL', 'ACTIVE', 'REJECTED', 'BLOCKED', 'INACTIVE'
);
CREATE TYPE "kyc_status_v1" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "account_type_v1" AS ENUM ('SAVINGS', 'CURRENT', 'LOAN');
CREATE TYPE "request_status" AS ENUM (
    'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'
);
CREATE TYPE "request_type" AS ENUM (
    'ACCOUNT_OPENING', 'ACCOUNT_CLOSURE', 'TRANSFER_LIMIT', 'LOAN'
);
CREATE TYPE "loan_status" AS ENUM (
    'APPROVED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'FORECLOSED', 'CANCELLED'
);
CREATE TYPE "emi_status" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'PARTIALLY_PAID');

-- Preserve and safely convert existing string values to typed enums.
ALTER TABLE "accounts"
    ALTER COLUMN "account_type" TYPE "account_type_v1"
    USING ("account_type"::text::"account_type_v1"),
    ADD COLUMN "account_subtype" VARCHAR(50),
    ADD COLUMN "ifsc_code" VARCHAR(20),
    ADD COLUMN "per_transaction_limit" DECIMAL(19,4),
    ADD COLUMN "daily_transfer_limit" DECIMAL(19,4),
    ADD COLUMN "frozen_at" TIMESTAMP(6),
    ADD COLUMN "frozen_by" BIGINT,
    ADD COLUMN "freeze_reason" VARCHAR(500),
    ADD COLUMN "closed_by" BIGINT,
    ADD COLUMN "close_reason" VARCHAR(500);

ALTER TABLE "customers"
    ALTER COLUMN "kyc_status" DROP DEFAULT,
    ALTER COLUMN "kyc_status" TYPE "kyc_status_v1"
        USING ("kyc_status"::text::"kyc_status_v1"),
    ALTER COLUMN "kyc_status" SET DEFAULT 'PENDING',
    ALTER COLUMN "customer_status" DROP DEFAULT,
    ALTER COLUMN "customer_status" TYPE "customer_status_v1"
        USING ("customer_status"::text::"customer_status_v1"),
    ALTER COLUMN "customer_status" SET DEFAULT 'ACTIVE',
    ADD COLUMN "approved_at" TIMESTAMP(6),
    ADD COLUMN "approved_by" BIGINT,
    ADD COLUMN "rejected_at" TIMESTAMP(6),
    ADD COLUMN "rejected_by" BIGINT,
    ADD COLUMN "rejection_reason" VARCHAR(500),
    ADD COLUMN "blocked_at" TIMESTAMP(6),
    ADD COLUMN "blocked_by" BIGINT,
    ADD COLUMN "block_reason" VARCHAR(500),
    ADD COLUMN "kyc_verified_at" TIMESTAMP(6),
    ADD COLUMN "kyc_verified_by" BIGINT,
    ADD COLUMN "kyc_rejected_at" TIMESTAMP(6),
    ADD COLUMN "kyc_rejected_by" BIGINT,
    ADD COLUMN "kyc_rejection_reason" VARCHAR(500);

ALTER TABLE "audit_logs"
    ADD COLUMN "reason" VARCHAR(500),
    ADD COLUMN "metadata" JSONB;

CREATE TABLE "customer_kyc_status_history" (
    "kyc_history_id" BIGSERIAL PRIMARY KEY,
    "customer_id" BIGINT NOT NULL,
    "previous_status" "kyc_status_v1",
    "new_status" "kyc_status_v1" NOT NULL,
    "changed_by" BIGINT,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "account_requests" (
    "account_request_id" BIGSERIAL PRIMARY KEY,
    "customer_id" BIGINT NOT NULL,
    "account_type" "account_type_v1" NOT NULL,
    "account_subtype" VARCHAR(50),
    "preferred_branch_id" BIGINT,
    "purpose" VARCHAR(500),
    "requested_per_transaction_limit" DECIMAL(19,4),
    "requested_daily_transfer_limit" DECIMAL(19,4),
    "notes" TEXT,
    "status" "request_status" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" BIGINT,
    "reviewed_at" TIMESTAMP(6),
    "admin_note" TEXT,
    "rejection_reason" VARCHAR(500),
    "approved_account_id" BIGINT,
    "approved_branch_id" BIGINT,
    "approved_per_transaction_limit" DECIMAL(19,4),
    "approved_daily_transfer_limit" DECIMAL(19,4),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "account_closure_requests" (
    "account_closure_request_id" BIGSERIAL PRIMARY KEY,
    "customer_id" BIGINT NOT NULL,
    "account_id" BIGINT NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" "request_status" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" BIGINT,
    "reviewed_at" TIMESTAMP(6),
    "rejection_reason" VARCHAR(500),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "transfer_limit_requests" (
    "transfer_limit_request_id" BIGSERIAL PRIMARY KEY,
    "customer_id" BIGINT NOT NULL,
    "account_id" BIGINT NOT NULL,
    "current_per_transaction_limit" DECIMAL(19,4),
    "requested_per_transaction_limit" DECIMAL(19,4) NOT NULL,
    "current_daily_transfer_limit" DECIMAL(19,4),
    "requested_daily_transfer_limit" DECIMAL(19,4) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" "request_status" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" BIGINT,
    "reviewed_at" TIMESTAMP(6),
    "rejection_reason" VARCHAR(500),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "loan_requests" (
    "loan_request_id" BIGSERIAL PRIMARY KEY,
    "customer_id" BIGINT NOT NULL,
    "requested_amount" DECIMAL(19,4) NOT NULL,
    "requested_duration_months" INTEGER NOT NULL,
    "loan_type" VARCHAR(50) NOT NULL,
    "loan_subtype" VARCHAR(50),
    "purpose" VARCHAR(500) NOT NULL,
    "requested_interest_rate" DECIMAL(8,4),
    "status" "request_status" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" BIGINT,
    "reviewed_at" TIMESTAMP(6),
    "approved_amount" DECIMAL(19,4),
    "approved_duration_months" INTEGER,
    "approved_interest_rate" DECIMAL(8,4),
    "rejection_reason" VARCHAR(500),
    "admin_note" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "loans" (
    "loan_id" BIGSERIAL PRIMARY KEY,
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
    "status" "loan_status" NOT NULL DEFAULT 'APPROVED',
    "approved_at" TIMESTAMP(6),
    "approved_by" BIGINT,
    "disbursed_at" TIMESTAMP(6),
    "disbursed_by" BIGINT,
    "closed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "loan_emi_schedules" (
    "emi_schedule_id" BIGSERIAL PRIMARY KEY,
    "loan_id" BIGINT NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "principal_component" DECIMAL(19,4) NOT NULL,
    "interest_component" DECIMAL(19,4) NOT NULL,
    "total_emi" DECIMAL(19,4) NOT NULL,
    "amount_paid" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "late_fee" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "status" "emi_status" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(6),
    "transaction_id" BIGINT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "request_status_history" (
    "request_status_history_id" BIGSERIAL PRIMARY KEY,
    "request_type" "request_type" NOT NULL,
    "request_id" BIGINT NOT NULL,
    "previous_status" "request_status",
    "new_status" "request_status" NOT NULL,
    "changed_by" BIGINT,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "account_requests_approved_account_id_key"
    ON "account_requests"("approved_account_id");
CREATE UNIQUE INDEX "loans_account_id_key" ON "loans"("account_id");
CREATE UNIQUE INDEX "loans_loan_request_id_key" ON "loans"("loan_request_id");
CREATE UNIQUE INDEX "uq_emi_schedule_installment"
    ON "loan_emi_schedules"("loan_id", "installment_number");

CREATE INDEX "idx_account_closed_by" ON "accounts"("closed_by");
CREATE INDEX "idx_account_frozen_by" ON "accounts"("frozen_by");
CREATE INDEX "idx_customer_status" ON "customers"("customer_status");
CREATE INDEX "idx_customer_kyc_status" ON "customers"("kyc_status");
CREATE INDEX "idx_kyc_history_customer_created"
    ON "customer_kyc_status_history"("customer_id", "created_at");
CREATE INDEX "idx_kyc_history_status" ON "customer_kyc_status_history"("new_status");
CREATE INDEX "idx_account_request_customer" ON "account_requests"("customer_id");
CREATE INDEX "idx_account_request_customer_status"
    ON "account_requests"("customer_id", "status");
CREATE INDEX "idx_account_request_status_created"
    ON "account_requests"("status", "created_at");
CREATE INDEX "idx_account_closure_request_customer"
    ON "account_closure_requests"("customer_id");
CREATE INDEX "idx_account_closure_request_account"
    ON "account_closure_requests"("account_id");
CREATE INDEX "idx_account_closure_request_customer_status"
    ON "account_closure_requests"("customer_id", "status");
CREATE INDEX "idx_account_closure_request_status_created"
    ON "account_closure_requests"("status", "created_at");
CREATE INDEX "idx_transfer_limit_request_customer"
    ON "transfer_limit_requests"("customer_id");
CREATE INDEX "idx_transfer_limit_request_account"
    ON "transfer_limit_requests"("account_id");
CREATE INDEX "idx_transfer_limit_request_customer_status"
    ON "transfer_limit_requests"("customer_id", "status");
CREATE INDEX "idx_transfer_limit_request_status_created"
    ON "transfer_limit_requests"("status", "created_at");
CREATE INDEX "idx_loan_request_customer" ON "loan_requests"("customer_id");
CREATE INDEX "idx_loan_request_customer_status"
    ON "loan_requests"("customer_id", "status");
CREATE INDEX "idx_loan_request_status_created"
    ON "loan_requests"("status", "created_at");
CREATE INDEX "idx_loan_customer" ON "loans"("customer_id");
CREATE INDEX "idx_loan_status" ON "loans"("status");
CREATE INDEX "idx_emi_schedule_loan" ON "loan_emi_schedules"("loan_id");
CREATE INDEX "idx_emi_schedule_due_status"
    ON "loan_emi_schedules"("due_date", "status");
CREATE INDEX "idx_request_status_history_request"
    ON "request_status_history"("request_type", "request_id", "created_at");
CREATE INDEX "idx_request_status_history_status"
    ON "request_status_history"("new_status", "created_at");
CREATE INDEX "idx_audit_entity" ON "audit_logs"("entity", "entity_id");

ALTER TABLE "accounts"
    ADD CONSTRAINT "fk_account_closed_by" FOREIGN KEY ("closed_by")
        REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "fk_account_frozen_by" FOREIGN KEY ("frozen_by")
        REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "chk_account_per_transaction_limit"
        CHECK ("per_transaction_limit" IS NULL OR "per_transaction_limit" > 0),
    ADD CONSTRAINT "chk_account_daily_transfer_limit"
        CHECK ("daily_transfer_limit" IS NULL OR "daily_transfer_limit" > 0);

ALTER TABLE "customers"
    ADD CONSTRAINT "fk_customer_approved_by" FOREIGN KEY ("approved_by")
        REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "fk_customer_rejected_by" FOREIGN KEY ("rejected_by")
        REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "fk_customer_blocked_by" FOREIGN KEY ("blocked_by")
        REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "fk_customer_kyc_verified_by" FOREIGN KEY ("kyc_verified_by")
        REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "fk_customer_kyc_rejected_by" FOREIGN KEY ("kyc_rejected_by")
        REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "customer_kyc_status_history"
    ADD CONSTRAINT "fk_kyc_history_customer" FOREIGN KEY ("customer_id")
        REFERENCES "customers"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "fk_kyc_history_changed_by" FOREIGN KEY ("changed_by")
        REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "account_requests"
    ADD CONSTRAINT "fk_account_request_customer" FOREIGN KEY ("customer_id")
        REFERENCES "customers"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "fk_account_request_preferred_branch" FOREIGN KEY ("preferred_branch_id")
        REFERENCES "branches"("branch_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "fk_account_request_approved_branch" FOREIGN KEY ("approved_branch_id")
        REFERENCES "branches"("branch_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "fk_account_request_reviewed_by" FOREIGN KEY ("reviewed_by")
        REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "fk_account_request_approved_account" FOREIGN KEY ("approved_account_id")
        REFERENCES "accounts"("account_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "chk_account_request_requested_per_transaction_limit"
        CHECK ("requested_per_transaction_limit" IS NULL OR "requested_per_transaction_limit" > 0),
    ADD CONSTRAINT "chk_account_request_requested_daily_transfer_limit"
        CHECK ("requested_daily_transfer_limit" IS NULL OR "requested_daily_transfer_limit" > 0),
    ADD CONSTRAINT "chk_account_request_approved_per_transaction_limit"
        CHECK ("approved_per_transaction_limit" IS NULL OR "approved_per_transaction_limit" > 0),
    ADD CONSTRAINT "chk_account_request_approved_daily_transfer_limit"
        CHECK ("approved_daily_transfer_limit" IS NULL OR "approved_daily_transfer_limit" > 0);

ALTER TABLE "account_closure_requests"
    ADD CONSTRAINT "fk_account_closure_request_customer" FOREIGN KEY ("customer_id")
        REFERENCES "customers"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "fk_account_closure_request_account" FOREIGN KEY ("account_id")
        REFERENCES "accounts"("account_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "fk_account_closure_request_reviewed_by" FOREIGN KEY ("reviewed_by")
        REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "transfer_limit_requests"
    ADD CONSTRAINT "fk_transfer_limit_request_customer" FOREIGN KEY ("customer_id")
        REFERENCES "customers"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "fk_transfer_limit_request_account" FOREIGN KEY ("account_id")
        REFERENCES "accounts"("account_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "fk_transfer_limit_request_reviewed_by" FOREIGN KEY ("reviewed_by")
        REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "chk_transfer_limit_request_values"
        CHECK (
            "requested_per_transaction_limit" > 0
            AND "requested_daily_transfer_limit" > 0
            AND ("current_per_transaction_limit" IS NULL OR "current_per_transaction_limit" > 0)
            AND ("current_daily_transfer_limit" IS NULL OR "current_daily_transfer_limit" > 0)
        );

ALTER TABLE "loan_requests"
    ADD CONSTRAINT "fk_loan_request_customer" FOREIGN KEY ("customer_id")
        REFERENCES "customers"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "fk_loan_request_reviewed_by" FOREIGN KEY ("reviewed_by")
        REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "chk_loan_request_values"
        CHECK (
            "requested_amount" > 0
            AND "requested_duration_months" > 0
            AND ("requested_interest_rate" IS NULL OR "requested_interest_rate" >= 0)
            AND ("approved_amount" IS NULL OR "approved_amount" > 0)
            AND ("approved_duration_months" IS NULL OR "approved_duration_months" > 0)
            AND ("approved_interest_rate" IS NULL OR "approved_interest_rate" >= 0)
        );

ALTER TABLE "loans"
    ADD CONSTRAINT "fk_loan_customer" FOREIGN KEY ("customer_id")
        REFERENCES "customers"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "fk_loan_account" FOREIGN KEY ("account_id")
        REFERENCES "accounts"("account_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "fk_loan_request" FOREIGN KEY ("loan_request_id")
        REFERENCES "loan_requests"("loan_request_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "fk_loan_approved_by" FOREIGN KEY ("approved_by")
        REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "fk_loan_disbursed_by" FOREIGN KEY ("disbursed_by")
        REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "chk_loan_values"
        CHECK (
            "principal_amount" > 0
            AND "outstanding_principal" >= 0
            AND "interest_rate" >= 0
            AND "duration_months" > 0
            AND "emi_amount" > 0
        );

ALTER TABLE "loan_emi_schedules"
    ADD CONSTRAINT "fk_emi_schedule_loan" FOREIGN KEY ("loan_id")
        REFERENCES "loans"("loan_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "fk_emi_schedule_transaction" FOREIGN KEY ("transaction_id")
        REFERENCES "transactions"("transaction_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "chk_emi_schedule_values"
        CHECK (
            "installment_number" > 0
            AND "principal_component" >= 0
            AND "interest_component" >= 0
            AND "total_emi" > 0
            AND "amount_paid" >= 0
            AND "late_fee" >= 0
        );

ALTER TABLE "request_status_history"
    ADD CONSTRAINT "fk_request_status_history_changed_by" FOREIGN KEY ("changed_by")
        REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
