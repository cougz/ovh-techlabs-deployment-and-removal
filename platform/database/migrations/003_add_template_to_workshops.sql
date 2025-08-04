-- Add template column to workshops table
-- This migration adds template support to workshops for resource provisioning

BEGIN;

-- Add template column with default value 'Generic'
ALTER TABLE workshops ADD COLUMN template VARCHAR(50) NOT NULL DEFAULT 'Generic';

-- Add comment to document the purpose
COMMENT ON COLUMN workshops.template IS 'Workshop template (e.g., Generic) for resource provisioning configuration';

COMMIT;