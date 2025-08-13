#!/bin/bash

# Entrypoint script for OVH TechLabs API
set -e

echo "🚀 Starting OVH TechLabs API..."

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
python3 -c "
import time
import sys
import os
sys.path.append('/app')

from core.database import engine
from sqlalchemy import text
from core.logging import get_logger

logger = get_logger(__name__)

max_attempts = 30
attempt = 0

while attempt < max_attempts:
    try:
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        logger.info('✅ Database connection successful')
        break
    except Exception as e:
        attempt += 1
        logger.info(f'⏳ Database not ready (attempt {attempt}/{max_attempts}): {e}')
        if attempt >= max_attempts:
            logger.error('❌ Database connection failed after maximum attempts')
            sys.exit(1)
        time.sleep(2)
"

# Run database migrations and create tables
echo "📊 Creating database tables..."
python3 -c "
import sys
sys.path.append('/app')

from core.database import engine, Base
from core.logging import get_logger
import models  # Import all models

logger = get_logger(__name__)

try:
    # Create all tables
    Base.metadata.create_all(bind=engine)
    logger.info('✅ Database tables created successfully')
except Exception as e:
    logger.error(f'❌ Failed to create database tables: {e}')
    sys.exit(1)
"

# Run any additional SQL migrations
echo "🔧 Running SQL migrations..."
python3 -c "
import sys
import os
sys.path.append('/app')

from core.database import engine
from sqlalchemy import text
from core.logging import get_logger

logger = get_logger(__name__)

def create_migration_table():
    with engine.connect() as conn:
        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                version VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        '''))
        conn.commit()

def check_migration_applied(version):
    with engine.connect() as conn:
        result = conn.execute(text(
            'SELECT COUNT(*) FROM schema_migrations WHERE version = :version'
        ), {'version': version})
        return result.scalar() > 0

def apply_ovh_migration():
    if check_migration_applied('004_add_ovh_resource_tables'):
        logger.info('✅ OVH resource tables migration already applied')
        return
    
    migration_sql = '''
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";

-- OVH Resource Audit Log table
CREATE TABLE IF NOT EXISTS ovh_resource_audits (
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
CREATE INDEX IF NOT EXISTS idx_ovh_audit_resource_type_id ON ovh_resource_audits(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_ovh_audit_created_at ON ovh_resource_audits(created_at);
CREATE INDEX IF NOT EXISTS idx_ovh_audit_performed_by ON ovh_resource_audits(performed_by);

-- OVH Resource Cache table
CREATE TABLE IF NOT EXISTS ovh_resource_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_type VARCHAR(50) NOT NULL,
    cache_key VARCHAR(255) NOT NULL UNIQUE,
    data JSONB NOT NULL,
    ttl_seconds INTEGER DEFAULT 3600,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Indexes for cache
CREATE INDEX IF NOT EXISTS idx_ovh_cache_key ON ovh_resource_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_ovh_cache_expires_at ON ovh_resource_cache(expires_at);

-- Function to automatically clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_ovh_cache()
RETURNS void AS \$\$
BEGIN
    DELETE FROM ovh_resource_cache WHERE expires_at < CURRENT_TIMESTAMP;
END;
\$\$ LANGUAGE plpgsql;
'''
    
    try:
        with engine.connect() as conn:
            trans = conn.begin()
            try:
                conn.execute(text(migration_sql))
                conn.execute(text(
                    'INSERT INTO schema_migrations (version) VALUES (:version)'
                ), {'version': '004_add_ovh_resource_tables'})
                trans.commit()
                logger.info('✅ OVH resource tables migration applied successfully')
            except Exception as e:
                trans.rollback()
                raise e
    except Exception as e:
        logger.error(f'❌ Failed to apply OVH migration: {e}')
        raise

try:
    create_migration_table()
    apply_ovh_migration()
    logger.info('✅ All migrations completed successfully')
except Exception as e:
    logger.error(f'❌ Migration failed: {e}')
    sys.exit(1)
"

echo "✅ Database setup completed!"

# Start the application
# Check if any command was passed as arguments
if [ $# -gt 0 ]; then
    echo "🎯 Running command: $@"
    exec "$@"
else
    echo "🎯 Starting FastAPI application..."
    exec uvicorn main:app --host 0.0.0.0 --port 8000
fi