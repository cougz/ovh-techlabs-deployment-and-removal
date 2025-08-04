#!/usr/bin/env python3

import os
import psycopg2
import argparse
from pathlib import Path

def get_db_connection():
    """Get database connection from environment variables."""
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'techlabs_automation'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', 'postgres')
    )

def create_migration_table(conn):
    """Create the migrations table if it doesn't exist."""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                version VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """)
    conn.commit()

def get_applied_migrations(conn):
    """Get list of applied migrations."""
    with conn.cursor() as cur:
        cur.execute("SELECT version FROM schema_migrations ORDER BY version")
        return [row[0] for row in cur.fetchall()]

def apply_migration(conn, migration_file):
    """Apply a single migration file."""
    version = migration_file.stem
    
    print(f"Applying migration: {version}")
    
    with open(migration_file, 'r') as f:
        sql_content = f.read()
    
    with conn.cursor() as cur:
        try:
            cur.execute(sql_content)
            cur.execute(
                "INSERT INTO schema_migrations (version) VALUES (%s)",
                (version,)
            )
            conn.commit()
            print(f"✓ Successfully applied migration: {version}")
        except Exception as e:
            conn.rollback()
            print(f"✗ Failed to apply migration {version}: {e}")
            raise

def rollback_migration(conn, version):
    """Rollback a specific migration (if rollback file exists)."""
    migrations_dir = Path(__file__).parent
    rollback_file = migrations_dir / f"{version}_rollback.sql"
    
    if not rollback_file.exists():
        print(f"No rollback file found for migration: {version}")
        return False
    
    print(f"Rolling back migration: {version}")
    
    with open(rollback_file, 'r') as f:
        sql_content = f.read()
    
    with conn.cursor() as cur:
        try:
            cur.execute(sql_content)
            cur.execute(
                "DELETE FROM schema_migrations WHERE version = %s",
                (version,)
            )
            conn.commit()
            print(f"✓ Successfully rolled back migration: {version}")
            return True
        except Exception as e:
            conn.rollback()
            print(f"✗ Failed to rollback migration {version}: {e}")
            raise

def run_migrations(conn, target_version=None):
    """Run all pending migrations up to target version."""
    migrations_dir = Path(__file__).parent
    migration_files = sorted([
        f for f in migrations_dir.glob("*.sql") 
        if not f.name.endswith("_rollback.sql")
    ])
    
    applied_migrations = get_applied_migrations(conn)
    
    pending_migrations = [
        f for f in migration_files 
        if f.stem not in applied_migrations
    ]
    
    if target_version:
        pending_migrations = [
            f for f in pending_migrations 
            if f.stem <= target_version
        ]
    
    if not pending_migrations:
        print("No pending migrations to apply.")
        return
    
    print(f"Found {len(pending_migrations)} pending migrations:")
    for migration in pending_migrations:
        print(f"  - {migration.stem}")
    
    for migration_file in pending_migrations:
        apply_migration(conn, migration_file)

def show_status(conn):
    """Show migration status."""
    migrations_dir = Path(__file__).parent
    all_migrations = sorted([
        f.stem for f in migrations_dir.glob("*.sql") 
        if not f.name.endswith("_rollback.sql")
    ])
    
    applied_migrations = get_applied_migrations(conn)
    
    print("Migration Status:")
    print("================")
    
    for migration in all_migrations:
        status = "✓ Applied" if migration in applied_migrations else "✗ Pending"
        print(f"{migration}: {status}")

def main():
    parser = argparse.ArgumentParser(description='Database Migration Tool')
    parser.add_argument('command', choices=['migrate', 'rollback', 'status'], 
                       help='Migration command to run')
    parser.add_argument('--version', help='Target version for migration or rollback')
    
    args = parser.parse_args()
    
    try:
        conn = get_db_connection()
        create_migration_table(conn)
        
        if args.command == 'migrate':
            run_migrations(conn, args.version)
        elif args.command == 'rollback':
            if not args.version:
                print("Rollback requires --version argument")
                return
            rollback_migration(conn, args.version)
        elif args.command == 'status':
            show_status(conn)
            
    except psycopg2.Error as e:
        print(f"Database error: {e}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == '__main__':
    main()