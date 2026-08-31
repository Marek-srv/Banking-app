ALTER TYPE "request_type" ADD VALUE IF NOT EXISTS 'CARD';

CREATE TABLE "card_requests" (
  "card_request_id" BIGSERIAL PRIMARY KEY,
  "customer_id" BIGINT NOT NULL,
  "account_id" BIGINT NOT NULL,
  "card_type" VARCHAR(30) NOT NULL,
  "card_variant" VARCHAR(50),
  "notes" VARCHAR(500),
  "status" "request_status" NOT NULL DEFAULT 'PENDING',
  "reviewed_by" BIGINT,
  "reviewed_at" TIMESTAMP(6),
  "rejection_reason" VARCHAR(500),
  "approved_card_id" BIGINT UNIQUE,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_card_request_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id"),
  CONSTRAINT "fk_card_request_account" FOREIGN KEY ("account_id") REFERENCES "accounts"("account_id"),
  CONSTRAINT "fk_card_request_reviewed_by" FOREIGN KEY ("reviewed_by") REFERENCES "users"("user_id"),
  CONSTRAINT "fk_card_request_approved_card" FOREIGN KEY ("approved_card_id") REFERENCES "cards"("card_id")
);

CREATE INDEX "idx_card_request_customer_status" ON "card_requests"("customer_id", "status");
CREATE INDEX "idx_card_request_account_status" ON "card_requests"("account_id", "status");
CREATE INDEX "idx_card_request_status_created" ON "card_requests"("status", "created_at");
