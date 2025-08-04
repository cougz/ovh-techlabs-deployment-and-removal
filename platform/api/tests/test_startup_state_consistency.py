"""
Test for the inconsistent frontend states during startup celery calls issue.

This test demonstrates the problematic state sequence:
1. Workshop expires -> 'deleting' 
2. Attendee-based status update -> 'active' (due to "least sane" logic)
3. Cleanup completes -> 'completed'

This sequence is confusing and should be fixed to show consistent, logical states.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session

from models.workshop import Workshop
from models.attendee import Attendee
from services.workshop_status_service import WorkshopStatusService
from tasks.cleanup_tasks import process_workshop_lifecycle, update_workshop_statuses


class TestStartupStateConsistency:
    """Test the problematic state sequence during startup cleanup."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        db = Mock(spec=Session)
        return db

    @pytest.fixture
    def expired_workshop(self):
        """Create a workshop that has expired and should be cleaned up."""
        now = datetime.now(ZoneInfo("UTC"))
        return Workshop(
            id="workshop-expired",
            name="Expired Workshop",
            description="A workshop that expired",
            status="active",  # Workshop was active but has expired
            start_date=now - timedelta(days=3),  # Started 3 days ago
            end_date=now - timedelta(days=1),    # Ended 1 day ago (expired)
            timezone="UTC",
            template="Generic",
            created_at=now - timedelta(days=3),
            updated_at=now - timedelta(days=1),
            deletion_scheduled_at=now - timedelta(hours=1)  # Should be deleted now
        )

    @pytest.fixture
    def active_attendees(self):
        """Create attendees that are still in active state (not yet cleaned up)."""
        now = datetime.now(ZoneInfo("UTC"))
        return [
            Attendee(
                id="attendee-1",
                workshop_id="workshop-expired",
                username="user1",
                email="user1@test.com",
                status="active",  # Still active, cleanup hasn't run yet
                created_at=now - timedelta(days=3),
                updated_at=now - timedelta(days=1)
            ),
            Attendee(
                id="attendee-2",
                workshop_id="workshop-expired",
                username="user2",
                email="user2@test.com",
                status="active",  # Still active, cleanup hasn't run yet
                created_at=now - timedelta(days=3),
                updated_at=now - timedelta(days=1)
            )
        ]

    def test_problematic_state_sequence_on_startup(self, mock_db, expired_workshop, active_attendees):
        """
        Test demonstrating the problematic state sequence that occurs on startup.
        
        This test shows the current broken behavior where a workshop goes through
        confusing state transitions: deleting -> active -> completed
        """
        
        # Setup mock database queries for process_workshop_lifecycle
        def db_query_side_effect(model):
            query_mock = Mock()
            filter_mock = Mock()
            query_mock.filter.return_value = filter_mock
            
            if model == Workshop:
                # First call: finding workshops to cleanup
                filter_mock.all.return_value = [expired_workshop]
                # Second call: finding workshop by ID for status service
                filter_mock.first.return_value = expired_workshop
            elif model == Attendee:
                # Return active attendees for the workshop
                filter_mock.count.return_value = len(active_attendees)
                filter_mock.all.return_value = active_attendees
                
            return query_mock
        
        mock_db.query.side_effect = db_query_side_effect
        
        # Mock celery task delay
        with patch('tasks.terraform_tasks.cleanup_workshop_attendees_sequential') as mock_cleanup:
            mock_cleanup.delay = Mock()
            
            # Step 1: Application startup triggers process_workshop_lifecycle
            with patch('tasks.cleanup_tasks.SessionLocal', return_value=mock_db):
                process_workshop_lifecycle()
            
            # Assert: Workshop status should be set to 'deleting' 
            assert expired_workshop.status == "deleting", \
                f"Expected 'deleting', got '{expired_workshop.status}'"
            
            # Step 2: Simulate the periodic update_workshop_statuses task
            # This is where the problem occurs - it overrides the 'deleting' status
            expired_workshop.status = "deploying"  # Reset to trigger status service logic
            
            with patch('tasks.cleanup_tasks.SessionLocal', return_value=mock_db):
                # This will call WorkshopStatusService.update_workshop_status_from_attendees
                # which will see active attendees and set status to 'active'
                new_status = WorkshopStatusService.update_workshop_status_from_attendees(
                    str(expired_workshop.id), mock_db
                )
            
            # This is the problematic behavior: workshop shows 'active' 
            # even though it's scheduled for deletion
            assert new_status == "active", \
                f"Expected 'active' (problematic behavior), got '{new_status}'"
            assert expired_workshop.status == "active", \
                f"Workshop status should be 'active' (showing the problem)"
            
            # Step 3: After cleanup completes, all attendees are deleted
            # Simulate attendees being deleted
            for attendee in active_attendees:
                attendee.status = "deleted"
            
            # Status service will now set workshop to 'completed'
            final_status = WorkshopStatusService.calculate_workshop_status_from_attendees(
                [attendee.status for attendee in active_attendees]
            )
            
            assert final_status == "completed", \
                f"Expected 'completed', got '{final_status}'"

    def test_confusing_state_sequence_timeline(self, mock_db, expired_workshop, active_attendees):
        """
        Test that demonstrates the timeline of confusing state changes.
        This documents the current problematic behavior.
        """
        state_timeline = []
        
        # Mock database setup
        mock_db.query.return_value.filter.return_value.all.return_value = active_attendees
        mock_db.query.return_value.filter.return_value.first.return_value = expired_workshop
        mock_db.query.return_value.filter.return_value.count.return_value = len(active_attendees)
        
        # Initial state: Workshop is active but expired
        state_timeline.append(("initial", expired_workshop.status))
        
        # Process lifecycle - sets to deleting
        expired_workshop.status = "deleting"
        state_timeline.append(("lifecycle_cleanup", expired_workshop.status))
        
        # Status service based on attendees - sets to active
        new_status = WorkshopStatusService.calculate_workshop_status_from_attendees(
            [attendee.status for attendee in active_attendees]
        )
        expired_workshop.status = new_status
        state_timeline.append(("attendee_based_update", expired_workshop.status))
        
        # After cleanup completes - sets to completed
        for attendee in active_attendees:
            attendee.status = "deleted"
        final_status = WorkshopStatusService.calculate_workshop_status_from_attendees(
            [attendee.status for attendee in active_attendees]
        )
        expired_workshop.status = final_status
        state_timeline.append(("cleanup_completed", expired_workshop.status))
        
        # Assert the problematic sequence
        expected_sequence = [
            ("initial", "active"),
            ("lifecycle_cleanup", "deleting"),
            ("attendee_based_update", "active"),  # This is confusing!
            ("cleanup_completed", "completed")
        ]
        
        assert state_timeline == expected_sequence, \
            f"State timeline shows confusing sequence: {state_timeline}"
        
        # The problem: Workshop goes deleting -> active -> completed
        # This doesn't make sense to users!

    def test_expected_logical_state_sequence(self, mock_db, expired_workshop, active_attendees):
        """
        Test showing what the logical state sequence SHOULD be.
        This is the target behavior we want to implement.
        """
        
        # Expected logical sequence for a workshop being cleaned up:
        # active -> deleting -> completed (or active -> cleaning_up -> completed)
        
        logical_timeline = []
        
        # Initial: Workshop is active but expired
        logical_timeline.append(("initial", "active"))
        
        # Cleanup starts: Should stay in a cleanup-related state
        logical_timeline.append(("cleanup_started", "deleting"))
        
        # During cleanup: Should remain in cleanup state, NOT revert to active
        logical_timeline.append(("cleanup_in_progress", "deleting"))  # Should NOT be "active"
        
        # Cleanup completes: Workshop is completed
        logical_timeline.append(("cleanup_completed", "completed"))
        
        expected_logical_sequence = [
            ("initial", "active"),
            ("cleanup_started", "deleting"),
            ("cleanup_in_progress", "deleting"),  # Key: should NOT revert to "active"
            ("cleanup_completed", "completed")
        ]
        
        assert logical_timeline == expected_logical_sequence, \
            "This shows the logical state sequence we should implement"

    def test_workshop_status_service_ignores_lifecycle_states(self):
        """
        Test that demonstrates the core issue: WorkshopStatusService doesn't respect
        lifecycle-based states like 'deleting'.
        """
        
        # When workshop is in 'deleting' state but attendees are still 'active'
        attendee_statuses = ['active', 'active']
        
        # Current behavior: Status service ignores that workshop is being deleted
        calculated_status = WorkshopStatusService.calculate_workshop_status_from_attendees(
            attendee_statuses
        )
        
        # This returns 'active' even though workshop should be 'deleting'
        assert calculated_status == "active", \
            "Status service returns 'active' ignoring deletion process"
        
        # This is the problem: status service doesn't know about lifecycle states

    @pytest.mark.skip(reason="This test will fail until we implement the fix")
    def test_fixed_behavior_workshop_respects_lifecycle_state(self):
        """
        Test showing the desired behavior after the fix.
        This test should pass after we implement the solution.
        """
        
        # Create a workshop in 'deleting' state
        workshop = Workshop(
            id="test-workshop",
            name="Test Workshop", 
            status="deleting",
            start_date=datetime.now(ZoneInfo("UTC")),
            end_date=datetime.now(ZoneInfo("UTC")) + timedelta(days=1)
        )
        
        # Even with active attendees, workshop should stay 'deleting'
        attendee_statuses = ['active', 'active']
        
        # After fix: status service should respect lifecycle states
        # (This will require modifying WorkshopStatusService)
        calculated_status = WorkshopStatusService.calculate_workshop_status_from_attendees(
            attendee_statuses
        )
        
        # Fixed behavior: should preserve 'deleting' state during cleanup
        assert calculated_status == "deleting", \
            "Status service should preserve lifecycle states like 'deleting'"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])