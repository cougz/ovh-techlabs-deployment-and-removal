-- Migration: 002_update_attendee_status
-- Description: Update attendee status constraint to include 'planning' status
-- Created: 2025-07-07

BEGIN;

-- Drop the existing check constraint
ALTER TABLE attendees DROP CONSTRAINT IF EXISTS attendees_status_check;

-- Add the new check constraint with 'planning' status
ALTER TABLE attendees ADD CONSTRAINT attendees_status_check 
    CHECK (status IN ('planning', 'deploying', 'active', 'failed', 'deleting', 'deleted'));

-- Update the default value for the status column
ALTER TABLE attendees ALTER COLUMN status SET DEFAULT 'planning';

-- Update any existing 'pending' status records to 'planning'
UPDATE attendees SET status = 'planning' WHERE status = 'pending';

COMMIT;