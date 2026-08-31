ALTER TABLE branches
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_branch_status'
    ) THEN
        ALTER TABLE branches
            ADD CONSTRAINT chk_branch_status
            CHECK (status IN ('ACTIVE', 'INACTIVE'));
    END IF;
END $$;
