ALTER TABLE users
    ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP,
    ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS reversal_of_transaction_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transaction_reversal_of
    ON transactions(reversal_of_transaction_id)
    WHERE reversal_of_transaction_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_transaction_reversal_of'
    ) THEN
        ALTER TABLE transactions
            ADD CONSTRAINT fk_transaction_reversal_of
            FOREIGN KEY (reversal_of_transaction_id)
            REFERENCES transactions(transaction_id);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS idempotency_records (
    idempotency_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    operation VARCHAR(30) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
    transaction_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_idempotency_user
        FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT fk_idempotency_transaction
        FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id),
    CONSTRAINT uq_idempotency_user_key
        UNIQUE (user_id, idempotency_key),
    CONSTRAINT chk_idempotency_status
        CHECK (status IN ('PROCESSING', 'COMPLETED'))
);

CREATE INDEX IF NOT EXISTS idx_idempotency_transaction
    ON idempotency_records(transaction_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_created_at
    ON idempotency_records(created_at);
