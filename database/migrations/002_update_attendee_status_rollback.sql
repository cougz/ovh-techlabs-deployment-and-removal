-- Rollback Migration: 002_update_attendee_status
-- Description: Rollback attendee status constraint changes
-- Created: 2025-07-07

BEGIN;

-- Update any 'planning' status records back to 'pending'
UPDATE attendees SET status = 'pending' WHERE status = 'planning';

-- Drop the current check constraint
ALTER TABLE attendees DROP CONSTRAINT IF EXISTS attendees_status_check;

-- Restore the original check constraint
ALTER TABLE attendees ADD CONSTRAINT attendees_status_check 
    CHECK (status IN ('pending', 'deploying', 'active', 'failed', 'deleting', 'deleted'));

-- Restore the original default value
ALTER TABLE attendees ALTER COLUMN status SET DEFAULT 'pending';

COMMIT;