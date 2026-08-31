-- Preserve the pre-existing Admin API's supported SUSPENDED customer state.
ALTER TYPE "customer_status_v1" ADD VALUE IF NOT EXISTS 'SUSPENDED';
