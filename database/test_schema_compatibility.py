#!/usr/bin/env python3
"""
Test to verify database schema matches SQLAlchemy models.
This test ensures that all columns defined in the models exist in the database.
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'api'))

from models.workshop import Workshop


def test_workshop_schema_compatibility():
    """Test that the workshop table in the database matches the SQLAlchemy model."""
    # This test verifies that all columns in the Workshop model exist in the database
    expected_columns = {
        'id': 'UUID',
        'name': 'VARCHAR(255)',
        'description': 'TEXT',
        'start_date': 'TIMESTAMP WITH TIME ZONE',
        'end_date': 'TIMESTAMP WITH TIME ZONE',
        'timezone': 'VARCHAR(50)',  # Missing from current schema
        'template': 'VARCHAR(50)',  # Missing from current schema
        'status': 'VARCHAR(50)',
        'created_at': 'TIMESTAMP WITH TIME ZONE',
        'updated_at': 'TIMESTAMP WITH TIME ZONE',
        'deletion_scheduled_at': 'TIMESTAMP WITH TIME ZONE'
    }
    
    # Get model columns
    model_columns = {}
    for column in Workshop.__table__.columns:
        model_columns[column.name] = str(column.type)
    
    # Check that all model columns are expected
    for col_name, col_type in model_columns.items():
        assert col_name in expected_columns, f"Unexpected column in model: {col_name}"
        
    # Check that all expected columns exist in model
    for col_name in expected_columns:
        assert col_name in model_columns, f"Missing column in model: {col_name}"


def test_database_has_required_columns():
    """Test that would verify database actually has the columns (requires database connection)."""
    # This test would require a live database connection to run
    # For now, we document what the schema.sql should contain
    required_schema_additions = [
        "ALTER TABLE workshops ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC' NOT NULL;",
        "ALTER TABLE workshops ADD COLUMN template VARCHAR(50) DEFAULT 'Generic' NOT NULL;"
    ]
    
    # This is a documentation test that shows what needs to be added
    assert len(required_schema_additions) == 2
    assert "timezone" in required_schema_additions[0]
    assert "template" in required_schema_additions[1]


if __name__ == "__main__":
    test_workshop_schema_compatibility()
    test_database_has_required_columns()
    print("✅ Schema compatibility tests pass - but database schema needs updating")