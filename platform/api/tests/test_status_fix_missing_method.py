"""
Test to reproduce STATUS-FIX-002: Missing _calculate_least_sane_status method error
"""
import pytest
import uuid
from unittest.mock import Mock, patch
from datetime import datetime, timezone as tz

from services.workshop_status_fix import WorkshopStatusFixService
from models.workshop import Workshop
from models.attendee import Attendee


class TestStatusFixMissingMethod:
    """Test to reproduce and fix the missing method error"""
    
    def test_should_reproduce_missing_calculate_least_sane_status_method_error(self):
        """Test that missing method error is now fixed"""
        
        # Use proper UUIDs
        workshop_id = str(uuid.uuid4())
        attendee1_id = str(uuid.uuid4())
        attendee2_id = str(uuid.uuid4())
        
        # Create mock workshop and attendees
        workshop = Workshop(
            id=workshop_id,
            name="Test Workshop",
            description="Test Description", 
            start_date=datetime.now(tz.utc),
            end_date=datetime.now(tz.utc),
            timezone="UTC",
            template="Generic",
            status="planning",  # Workshop status inconsistent with attendee status
            created_at=datetime.now(tz.utc),
            updated_at=datetime.now(tz.utc)
        )
        
        attendees = [
            Attendee(
                id=attendee1_id,
                workshop_id=workshop_id,
                username="user1",
                email="user1@test.com",
                status="active",  # Attendee is active but workshop is planning
                created_at=datetime.now(tz.utc)
            ),
            Attendee(
                id=attendee2_id,
                workshop_id=workshop_id,
                username="user2",
                email="user2@test.com",
                status="active",
                created_at=datetime.now(tz.utc)
            )
        ]
        
        # Mock database session
        mock_db = Mock()
        mock_db.query().filter().all.return_value = attendees
        mock_db.query().filter().first.return_value = workshop
        
        # Before fix: This would reproduce the AttributeError
        # After fix: This should work without error
        service = WorkshopStatusFixService()
        
        # Should now work without raising AttributeError (bug fixed!)
        result = service.validate_workshop_status_consistency(workshop_id, mock_db)
        
        # Should detect inconsistency (workshop: planning, attendees: active -> should be active)
        assert "error" not in result, f"Unexpected error: {result.get('error')}"
        assert result["is_consistent"] is False
        assert result["workshop_status"] == "planning"
        assert result["calculated_status"] == "active"
        assert result["requires_update"] is True
    
    def test_should_fix_workshop_status_after_method_fix(self):
        """Test that workshop status gets fixed after the missing method is corrected"""
        
        # Use proper UUIDs
        workshop_id = str(uuid.uuid4())
        attendee1_id = str(uuid.uuid4())
        attendee2_id = str(uuid.uuid4())
        
        # Create workshop with inconsistent status
        workshop = Workshop(
            id=workshop_id, 
            name="Test Workshop",
            description="Test Description",
            start_date=datetime.now(tz.utc),
            end_date=datetime.now(tz.utc),
            timezone="UTC",
            template="Generic", 
            status="planning",  # Inconsistent - should be 'active' based on attendees
            created_at=datetime.now(tz.utc),
            updated_at=datetime.now(tz.utc)
        )
        
        attendees = [
            Attendee(
                id=attendee1_id,
                workshop_id=workshop_id, 
                username="user1",
                email="user1@test.com",
                status="active",
                created_at=datetime.now(tz.utc)
            ),
            Attendee(
                id=attendee2_id,
                workshop_id=workshop_id,
                username="user2", 
                email="user2@test.com",
                status="active",
                created_at=datetime.now(tz.utc)
            )
        ]
        
        # Mock database session
        mock_db = Mock()
        mock_db.query().filter().all.return_value = attendees
        mock_db.query().filter().first.return_value = workshop
        mock_db.commit = Mock()
        
        # After fixing the missing method, this should work
        service = WorkshopStatusFixService()
        result = service.validate_workshop_status_consistency(workshop_id, mock_db)
        
        # Should detect inconsistency
        assert result["is_consistent"] is False
        assert result["workshop_status"] == "planning"
        assert result["calculated_status"] == "active"
        assert result["requires_update"] is True
    
    def test_should_handle_consistent_workshop_status(self):
        """Test that consistent workshop status is detected correctly"""
        
        # Use proper UUIDs
        workshop_id = str(uuid.uuid4())
        attendee_id = str(uuid.uuid4())
        
        workshop = Workshop(
            id=workshop_id,
            name="Test Workshop", 
            description="Test Description",
            start_date=datetime.now(tz.utc),
            end_date=datetime.now(tz.utc),
            timezone="UTC",
            template="Generic",
            status="active",  # Consistent with attendee statuses
            created_at=datetime.now(tz.utc),
            updated_at=datetime.now(tz.utc)
        )
        
        attendees = [
            Attendee(
                id=attendee_id,
                workshop_id=workshop_id,
                username="user1", 
                email="user1@test.com",
                status="active",
                created_at=datetime.now(tz.utc)
            )
        ]
        
        mock_db = Mock()
        mock_db.query().filter().all.return_value = attendees  
        mock_db.query().filter().first.return_value = workshop
        
        service = WorkshopStatusFixService()
        result = service.validate_workshop_status_consistency(workshop_id, mock_db)
        
        # Should detect no inconsistency
        assert result["is_consistent"] is True
        assert result["workshop_status"] == "active" 
        assert result["calculated_status"] == "active"
        assert result["requires_update"] is False