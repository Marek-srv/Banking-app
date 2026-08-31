CREATE TABLE account_recovery_otps (
    recovery_otp_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    purpose VARCHAR(30) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    used_at TIMESTAMP(6),
    reset_token_hash CHAR(64),
    reset_token_expires_at TIMESTAMP(6),
    reset_completed_at TIMESTAMP(6),
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_account_recovery_otp_user
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT chk_account_recovery_purpose
        CHECK (purpose IN ('CUSTOMER_ID', 'PASSWORD_RESET')),
    CONSTRAINT chk_account_recovery_attempts
        CHECK (attempts >= 0 AND attempts <= 5)
);

CREATE INDEX idx_account_recovery_otp_user_purpose
    ON account_recovery_otps(user_id, purpose);
CREATE INDEX idx_account_recovery_otp_expires
    ON account_recovery_otps(expires_at);
CREATE INDEX idx_account_recovery_reset_token
    ON account_recovery_otps(reset_token_hash);
CREATE UNIQUE INDEX uq_account_recovery_active_purpose
    ON account_recovery_otps(user_id, purpose)
    WHERE used_at IS NULL;
