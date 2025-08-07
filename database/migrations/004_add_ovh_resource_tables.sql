-- Migration: 004_add_ovh_resource_tables
-- Description: Add tables for OVH resource management and audit logging
-- Created: 2025-08-07

BEGIN;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- OVH Resource Audit Log table
CREATE TABLE ovh_resource_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN ('pci_project', 'iam_user', 'iam_policy')),
    resource_id VARCHAR(255) NOT NULL,
    resource_name VARCHAR(255),
    action VARCHAR(50) NOT NULL CHECK (action IN ('create', 'delete', 'sync', 'view', 'bulk_delete')),
    action_status VARCHAR(50) NOT NULL CHECK (action_status IN ('success', 'failed', 'pending')),
    performed_by VARCHAR(100) NOT NULL,
    error_message TEXT,
    resource_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit log
CREATE INDEX idx_ovh_audit_resource_type_id ON ovh_resource_audits(resource_type, resource_id);
CREATE INDEX idx_ovh_audit_created_at ON ovh_resource_audits(created_at);
CREATE INDEX idx_ovh_audit_performed_by ON ovh_resource_audits(performed_by);

-- OVH Resource Cache table
CREATE TABLE ovh_resource_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_type VARCHAR(50) NOT NULL,
    cache_key VARCHAR(255) NOT NULL UNIQUE,
    data JSONB NOT NULL,
    ttl_seconds INTEGER DEFAULT 3600,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Indexes for cache
CREATE INDEX idx_ovh_cache_key ON ovh_resource_cache(cache_key);
CREATE INDEX idx_ovh_cache_expires_at ON ovh_resource_cache(expires_at);

-- Function to automatically clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_ovh_cache()
RETURNS void AS $
BEGIN
    DELETE FROM ovh_resource_cache WHERE expires_at < CURRENT_TIMESTAMP;
END;
$ LANGUAGE plpgsql;

-- Create a scheduled job to clean cache (if pg_cron is available)
-- SELECT cron.schedule('clean-ovh-cache', '*/15 * * * *', 'SELECT clean_expired_ovh_cache()');

COMMIT;