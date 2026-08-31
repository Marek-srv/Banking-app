ALTER TABLE "cards"
ADD COLUMN "freeze_source" VARCHAR(30);

CREATE INDEX "idx_card_account_freeze_source"
ON "cards"("account_id", "freeze_source");
