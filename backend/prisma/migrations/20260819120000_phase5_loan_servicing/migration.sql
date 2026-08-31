ALTER TYPE "emi_status" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "loans"
  ADD COLUMN "disbursement_transaction_id" BIGINT,
  ADD COLUMN "auto_debit_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "auto_debit_account_id" BIGINT;

CREATE UNIQUE INDEX "loans_disbursement_transaction_id_key"
  ON "loans"("disbursement_transaction_id");
CREATE INDEX "idx_loan_auto_debit_account"
  ON "loans"("auto_debit_account_id");

ALTER TABLE "loans"
  ADD CONSTRAINT "fk_loan_disbursement_transaction"
    FOREIGN KEY ("disbursement_transaction_id") REFERENCES "transactions"("transaction_id")
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT "fk_loan_auto_debit_account"
    FOREIGN KEY ("auto_debit_account_id") REFERENCES "accounts"("account_id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
