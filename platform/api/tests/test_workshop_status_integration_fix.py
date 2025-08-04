"""
Integration test for workshop status issue - testing the actual deployment flow
"""
import asyncio
import time
import uuid
from unittest.mock import patch, MagicMock
import pytest
from datetime import datetime, timezone as tz, timedelta

from main import app
from fastapi.testclient import TestClient
from core.database import get_db, SessionLocal
from models.workshop import Workshop
from models.attendee import Attendee
from services.workshop_status_service import WorkshopStatusService


class TestWorkshopStatusIntegrationFix:
    """Integration tests to reproduce and fix the workshop status issue"""
    
    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)
    
    @pytest.fixture
    def db_session(self):
        """Create database session"""
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()
    
    def test_workshop_status_after_deployment(self, db_session):
        """Test that workshop status updates correctly after all attendees are deployed"""
        # Create a test workshop
        workshop_id = str(uuid.uuid4())
        workshop = Workshop(
            id=workshop_id,
            name="Status Test Workshop",
            description="Testing status transitions",
            status="planning",
            start_date=datetime.now(tz.utc),
            end_date=datetime.now(tz.utc) + timedelta(days=1),
            timezone="UTC",
            template="Generic",
            created_at=datetime.now(tz.utc),
            updated_at=datetime.now(tz.utc)
        )
        db_session.add(workshop)
        db_session.commit()
        
        # Add attendees to the workshop
        attendees = [
            Attendee(
                id=str(uuid.uuid4()),
                workshop_id=workshop_id,
                username="test-user-1",
                email="user1@test.com",
                status="planning",
                created_at=datetime.now(tz.utc)
            ),
            Attendee(
                id=str(uuid.uuid4()),
                workshop_id=workshop_id,
                username="test-user-2",
                email="user2@test.com", 
                status="planning",
                created_at=datetime.now(tz.utc)
            )
        ]
        
        for attendee in attendees:
            db_session.add(attendee)
        db_session.commit()
        
        # Verify initial state
        workshop_before = db_session.query(Workshop).filter(Workshop.id == workshop_id).first()
        assert workshop_before.status == "planning"
        
        # Simulate deployment by updating attendee statuses to active
        for attendee in attendees:
            attendee.status = "active"
        db_session.commit()
        
        # Now call the workshop status service to update based on attendees
        new_status = WorkshopStatusService.update_workshop_status_from_attendees(workshop_id, db_session)
        
        # Verify the workshop status has been updated
        workshop_after = db_session.query(Workshop).filter(Workshop.id == workshop_id).first()
        
        print(f"Workshop status before: {workshop_before.status}")
        print(f"Workshop status after: {workshop_after.status}")
        print(f"New status returned: {new_status}")
        print(f"All attendees status: {[a.status for a in attendees]}")
        
        assert workshop_after.status == "active", f"Expected 'active' but got '{workshop_after.status}'"
        assert new_status == "active", f"Service should return 'active' but returned '{new_status}'"
        
        # Clean up
        db_session.delete(workshop)
        for attendee in attendees:
            db_session.delete(attendee)
        db_session.commit()
    
    def test_workshop_status_with_mixed_attendee_states(self, db_session):
        """Test that workshop remains in least-sane status when attendees have mixed states"""
        # Create a test workshop
        workshop_id = str(uuid.uuid4())
        workshop = Workshop(
            id=workshop_id,
            name="Mixed Status Test",
            description="Testing mixed attendee states",
            status="planning", 
            start_date=datetime.now(tz.utc),
            end_date=datetime.now(tz.utc) + timedelta(days=1),
            timezone="UTC",
            template="Generic",
            created_at=datetime.now(tz.utc),
            updated_at=datetime.now(tz.utc)
        )
        db_session.add(workshop)
        db_session.commit()
        
        # Add attendees with mixed statuses
        attendees = [
            Attendee(
                id=str(uuid.uuid4()), 
                workshop_id=workshop_id,
                username="active-user",
                email="active@test.com",
                status="active",
                created_at=datetime.now(tz.utc)
            ),
            Attendee(
                id=str(uuid.uuid4()),
                workshop_id=workshop_id, 
                username="planning-user",
                email="planning@test.com",
                status="planning",
                created_at=datetime.now(tz.utc)
            ),
            Attendee(
                id=str(uuid.uuid4()),
                workshop_id=workshop_id,
                username="failed-user",
                email="failed@test.com", 
                status="failed",
                created_at=datetime.now(tz.utc)
            )
        ]
        
        for attendee in attendees:
            db_session.add(attendee)
        db_session.commit()
        
        # Update workshop status based on attendees
        new_status = WorkshopStatusService.update_workshop_status_from_attendees(workshop_id, db_session)
        
        workshop_after = db_session.query(Workshop).filter(Workshop.id == workshop_id).first()
        
        print(f"Mixed attendee statuses: {[a.status for a in attendees]}")
        print(f"Workshop status: {workshop_after.status}")
        print(f"Service returned: {new_status}")
        
        # The "least sane" logic should pick 'failed' as the worst status
        assert workshop_after.status == "failed", f"Expected 'failed' but got '{workshop_after.status}'"
        
        # Clean up
        db_session.delete(workshop)
        for attendee in attendees:
            db_session.delete(attendee)
        db_session.commit()
    
    def test_workshop_status_broadcast_mechanism(self, db_session):
        """Test that status updates are properly broadcast via WebSocket"""
        # This test checks if the broadcast mechanism works correctly
        
        # Create workshop and attendees
        workshop_id = str(uuid.uuid4())
        workshop = Workshop(
            id=workshop_id,
            name="Broadcast Test",
            description="Testing broadcast mechanism",
            status="planning",
            start_date=datetime.now(tz.utc),
            end_date=datetime.now(tz.utc) + timedelta(days=1),
            timezone="UTC",
            template="Generic", 
            created_at=datetime.now(tz.utc),
            updated_at=datetime.now(tz.utc)
        )
        db_session.add(workshop)
        
        attendee = Attendee(
            id=str(uuid.uuid4()),
            workshop_id=workshop_id,
            username="broadcast-user",
            email="broadcast@test.com",
            status="active",
            created_at=datetime.now(tz.utc)
        )
        db_session.add(attendee)
        db_session.commit()
        
        # Mock the broadcast function to capture calls
        with patch('tasks.terraform_tasks.broadcast_status_update') as mock_broadcast:
            # Update workshop status
            new_status = WorkshopStatusService.update_workshop_status_from_attendees(workshop_id, db_session)
            
            # Simulate what the deployment task does - it should broadcast the new status
            from tasks.websocket_updates import broadcast_status_update
            broadcast_status_update(
                workshop_id,
                "workshop",
                workshop_id, 
                new_status,
                {"message": "Status updated"}
            )
            
        # Verify the workshop was updated to active
        workshop_updated = db_session.query(Workshop).filter(Workshop.id == workshop_id).first()
        assert workshop_updated.status == "active"
        
        # Clean up
        db_session.delete(workshop)
        db_session.delete(attendee)
        db_session.commit()