-- Add timezone column to workshops table
-- This migration adds timezone support to workshops for proper timezone-aware cleanup

BEGIN;

-- Add timezone column with default value 'UTC'
ALTER TABLE workshops ADD COLUMN timezone VARCHAR(50) NOT NULL DEFAULT 'UTC';

-- Add comment to document the purpose
COMMENT ON COLUMN workshops.timezone IS 'Workshop timezone (e.g., Europe/Madrid, Asia/Kolkata) for proper cleanup scheduling';

COMMIT;