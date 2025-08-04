"""
Test for CLEANUP-PARTIAL-001 fix: Sequential cleanup ensures all attendees are cleaned up
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from uuid import uuid4

from tasks.terraform_tasks import cleanup_workshop_attendees_sequential
from models.workshop import Workshop
from models.attendee import Attendee


class TestSequentialCleanupFix:
    """Test the sequential cleanup implementation that fixes partial cleanup issue"""
    
    @pytest.fixture
    def mock_workshop(self):
        """Create a mock workshop"""
        workshop = Mock(spec=Workshop)
        workshop.id = uuid4()
        workshop.name = "Test Workshop"
        workshop.status = "active"
        return workshop
    
    @pytest.fixture
    def mock_attendees(self, mock_workshop):
        """Create multiple mock attendees with active status"""
        attendees = []
        for i in range(3):
            attendee = Mock(spec=Attendee)
            attendee.id = uuid4()
            attendee.username = f"test-user-{i+1}"
            attendee.status = "active"
            attendee.workshop_id = mock_workshop.id
            attendees.append(attendee)
        return attendees
    
    def test_sequential_cleanup_processes_all_attendees(self, mock_workshop, mock_attendees):
        """Test that sequential cleanup processes ALL attendees in order"""
        
        # Track cleanup order and results
        cleanup_results = []
        
        def mock_destroy_apply(args):
            """Mock the synchronous apply() call"""
            attendee_id = args[0]
            result = Mock()
            result.successful.return_value = True
            result.result = {"success": True, "attendee_id": attendee_id}
            cleanup_results.append(attendee_id)
            return result
        
        with patch('tasks.terraform_tasks.SessionLocal') as mock_session:
            with patch('tasks.terraform_tasks.destroy_attendee_resources.apply', side_effect=mock_destroy_apply):
                with patch('tasks.terraform_tasks.broadcast_deployment_progress'):
                    with patch('tasks.terraform_tasks.broadcast_status_update'):
                        # Setup database mocks
                        mock_db = Mock()
                        mock_session.return_value = mock_db
                        
                        # Mock workshop query
                        mock_db.query.return_value.filter.return_value.first.return_value = mock_workshop
                        
                        # Mock attendees query
                        mock_db.query.return_value.filter.return_value.all.return_value = mock_attendees
                        
                        # Create mock task context
                        mock_task = Mock()
                        mock_task.update_state = Mock()
                        
                        # Execute sequential cleanup
                        with patch.object(cleanup_workshop_attendees_sequential, 'update_state', mock_task.update_state):
                            result = cleanup_workshop_attendees_sequential(str(mock_workshop.id))
                        
                        # Verify ALL attendees were cleaned up
                        assert len(cleanup_results) == 3, f"Expected 3 attendees cleaned, got {len(cleanup_results)}"
                        assert result["attendees_cleaned"] == 3
                        assert result["attendees_failed"] == 0
                        assert "All 3 attendees cleaned up successfully" in result["message"]
                        
                        # Verify progress updates were sent for each attendee
                        assert mock_task.update_state.call_count == 3
    
    def test_sequential_cleanup_continues_on_failure(self, mock_workshop, mock_attendees):
        """Test that cleanup continues even if one attendee fails"""
        
        cleanup_attempts = []
        
        def mock_destroy_apply_with_failure(args):
            """Mock apply() with one failure"""
            attendee_id = args[0]
            cleanup_attempts.append(attendee_id)
            
            result = Mock()
            # Make second attendee fail
            if len(cleanup_attempts) == 2:
                result.successful.return_value = False
                result.result = {"success": False, "error": "Terraform destroy failed"}
            else:
                result.successful.return_value = True
                result.result = {"success": True, "attendee_id": attendee_id}
            
            return result
        
        with patch('tasks.terraform_tasks.SessionLocal') as mock_session:
            with patch('tasks.terraform_tasks.destroy_attendee_resources.apply', side_effect=mock_destroy_apply_with_failure):
                with patch('tasks.terraform_tasks.broadcast_deployment_progress'):
                    with patch('tasks.terraform_tasks.broadcast_status_update'):
                        mock_db = Mock()
                        mock_session.return_value = mock_db
                        
                        mock_db.query.return_value.filter.return_value.first.return_value = mock_workshop
                        mock_db.query.return_value.filter.return_value.all.return_value = mock_attendees
                        
                        mock_task = Mock()
                        mock_task.update_state = Mock()
                        
                        with patch.object(cleanup_workshop_attendees_sequential, 'update_state', mock_task.update_state):
                            result = cleanup_workshop_attendees_sequential(str(mock_workshop.id))
                        
                        # Verify all attendees were attempted
                        assert len(cleanup_attempts) == 3, f"Expected 3 cleanup attempts, got {len(cleanup_attempts)}"
                        assert result["attendees_cleaned"] == 2
                        assert result["attendees_failed"] == 1
                        assert "2 attendees cleaned up, 1 failed" in result["message"]
    
    def test_sequential_cleanup_updates_workshop_status(self, mock_workshop, mock_attendees):
        """Test that workshop status is properly updated during cleanup"""
        
        status_updates = []
        
        def track_status_updates(*args, **kwargs):
            if hasattr(mock_workshop, 'status'):
                status_updates.append(mock_workshop.status)
        
        with patch('tasks.terraform_tasks.SessionLocal') as mock_session:
            with patch('tasks.terraform_tasks.destroy_attendee_resources.apply') as mock_apply:
                with patch('tasks.terraform_tasks.broadcast_deployment_progress'):
                    with patch('tasks.terraform_tasks.broadcast_status_update'):
                        mock_db = Mock()
                        mock_session.return_value = mock_db
                        mock_db.commit = track_status_updates
                        
                        # Setup successful cleanup
                        mock_result = Mock()
                        mock_result.successful.return_value = True
                        mock_result.result = {"success": True}
                        mock_apply.return_value = mock_result
                        
                        mock_db.query.return_value.filter.return_value.first.return_value = mock_workshop
                        mock_db.query.return_value.filter.return_value.all.return_value = mock_attendees
                        
                        mock_task = Mock()
                        mock_task.update_state = Mock()
                        
                        with patch.object(cleanup_workshop_attendees_sequential, 'update_state', mock_task.update_state):
                            result = cleanup_workshop_attendees_sequential(str(mock_workshop.id))
                        
                        # Workshop should start as 'deleting' and end as 'completed'
                        assert mock_workshop.status == 'completed'
                        assert 'deleting' in status_updates  # Should have been set to deleting at start
    
    def test_sequential_cleanup_handles_no_attendees(self, mock_workshop):
        """Test cleanup handles case with no attendees to cleanup"""
        
        with patch('tasks.terraform_tasks.SessionLocal') as mock_session:
            mock_db = Mock()
            mock_session.return_value = mock_db
            
            mock_db.query.return_value.filter.return_value.first.return_value = mock_workshop
            mock_db.query.return_value.filter.return_value.all.return_value = []  # No attendees
            
            result = cleanup_workshop_attendees_sequential(str(mock_workshop.id))
            
            assert result["attendees_cleaned"] == 0
            assert "No attendees to cleanup" in result["message"]
            assert mock_workshop.status == 'completed'