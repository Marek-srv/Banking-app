ALTER TABLE users
    ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN email_verified_at TIMESTAMP(6);

-- Users created before OTP verification existed are treated as already verified,
-- preserving their current login behavior. New rows retain the FALSE default.
UPDATE users
SET email_verified = TRUE,
    email_verified_at = COALESCE(last_login_at, created_at, CURRENT_TIMESTAMP);

CREATE TABLE email_verification_otps (
    otp_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    used_at TIMESTAMP(6),
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_email_verification_otp_user
        FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT chk_email_verification_otp_attempts
        CHECK (attempts >= 0 AND attempts <= 5)
);

CREATE INDEX idx_email_verification_otp_user
    ON email_verification_otps(user_id);
CREATE INDEX idx_email_verification_otp_expires
    ON email_verification_otps(expires_at);
CREATE UNIQUE INDEX uq_email_verification_otp_active_user
    ON email_verification_otps(user_id)
    WHERE used_at IS NULL;
