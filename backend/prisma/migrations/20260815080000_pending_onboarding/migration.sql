CREATE TABLE pending_registrations (
    pending_registration_id BIGSERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    otp_expires_at TIMESTAMP(6) NOT NULL,
    otp_attempts INTEGER NOT NULL DEFAULT 0,
    otp_used_at TIMESTAMP(6),
    email_verified_at TIMESTAMP(6),
    registration_token_hash CHAR(64),
    registration_token_expires_at TIMESTAMP(6),
    completed_at TIMESTAMP(6),
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_pending_registration_email UNIQUE (email),
    CONSTRAINT uq_pending_registration_token_hash UNIQUE (registration_token_hash),
    CONSTRAINT chk_pending_registration_otp_attempts
        CHECK (otp_attempts >= 0 AND otp_attempts <= 5)
);

CREATE INDEX idx_pending_registration_otp_expires
    ON pending_registrations(otp_expires_at);
CREATE INDEX idx_pending_registration_token_expires
    ON pending_registrations(registration_token_expires_at);

CREATE SEQUENCE customer_number_seq START WITH 1 INCREMENT BY 1;

SELECT setval(
    'customer_number_seq',
    GREATEST(
        COALESCE(
            (
                SELECT MAX(SUBSTRING(customer_number FROM 5)::BIGINT)
                FROM customers
                WHERE customer_number ~ '^CUST[0-9]+$'
            ),
            0
        ) + 1,
        1
    ),
    FALSE
);

INSERT INTO branches (
    branch_code,
    branch_name,
    country,
    created_at,
    updated_at
) VALUES (
    'DIGITAL001',
    'π Bank Digital Branch',
    'India',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (branch_code) DO NOTHING;
