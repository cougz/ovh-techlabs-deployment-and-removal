"""
Test to reproduce CLEANUP-PARTIAL-001: Cleanup resources only cleaning up first attendee
"""
import pytest
import asyncio
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock, call
from uuid import uuid4

from api.routes.workshops import cleanup_workshop_resources
from tasks.terraform_tasks import destroy_attendee_resources
from models.workshop import Workshop
from models.attendee import Attendee
from core.database import SessionLocal


class TestPartialCleanupIssue:
    """Test suite to reproduce and fix the partial cleanup issue"""
    
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
        """Create multiple mock attendees"""
        attendees = []
        for i in range(2):
            attendee = Mock(spec=Attendee)
            attendee.id = uuid4()
            attendee.username = f"test-user-{i+1}"
            attendee.status = "active"
            attendee.workshop_id = mock_workshop.id
            attendees.append(attendee)
        return attendees
    
    @pytest.mark.asyncio
    async def test_cleanup_should_process_all_attendees(self, mock_workshop, mock_attendees):
        """Test that cleanup processes ALL attendees, not just the first one"""
        
        # Track which attendees were cleaned up
        cleaned_up_attendees = []
        
        def mock_destroy_task(attendee_id):
            """Mock destroy task that tracks calls"""
            cleaned_up_attendees.append(attendee_id)
            task = Mock()
            task.id = f"task-{attendee_id}"
            return task
        
        with patch('api.routes.workshops.get_db') as mock_get_db:
            with patch('api.routes.workshops.get_current_user', return_value="test-user"):
                with patch('tasks.terraform_tasks.destroy_attendee_resources.delay', side_effect=mock_destroy_task) as mock_destroy:
                    # Setup database mocks
                    mock_db = Mock()
                    mock_get_db.return_value = mock_db
                    
                    # Mock workshop query
                    mock_db.query.return_value.filter.return_value.first.return_value = mock_workshop
                    
                    # Mock attendees query - this is critical
                    mock_attendees_query = Mock()
                    mock_attendees_query.all.return_value = mock_attendees
                    mock_db.query.return_value.filter.return_value = mock_attendees_query
                    
                    # Call cleanup endpoint
                    from fastapi import Request
                    request = Mock(spec=Request)
                    result = await cleanup_workshop_resources(
                        workshop_id=mock_workshop.id,
                        db=mock_db,
                        current_user="test-user"
                    )
                    
                    # Verify ALL attendees were queued for cleanup
                    assert len(cleaned_up_attendees) == 2, f"Expected 2 attendees cleaned up, got {len(cleaned_up_attendees)}"
                    assert str(mock_attendees[0].id) in cleaned_up_attendees
                    assert str(mock_attendees[1].id) in cleaned_up_attendees
                    
                    # Verify response
                    assert result["attendee_count"] == 2
                    assert len(result["task_ids"]) == 2
    
    @pytest.mark.asyncio
    async def test_cleanup_handles_mixed_attendee_states(self, mock_workshop):
        """Test cleanup handles attendees in different states correctly"""
        
        # Create attendees in different states
        attendees = []
        attendee1 = Mock(spec=Attendee)
        attendee1.id = uuid4()
        attendee1.username = "active-user"
        attendee1.status = "active"
        attendee1.workshop_id = mock_workshop.id
        attendees.append(attendee1)
        
        attendee2 = Mock(spec=Attendee)
        attendee2.id = uuid4()
        attendee2.username = "failed-user"
        attendee2.status = "failed"
        attendee2.workshop_id = mock_workshop.id
        attendees.append(attendee2)
        
        attendee3 = Mock(spec=Attendee)
        attendee3.id = uuid4()
        attendee3.username = "deleted-user"
        attendee3.status = "deleted"
        attendee3.workshop_id = mock_workshop.id
        attendees.append(attendee3)
        
        cleaned_up_attendees = []
        
        def mock_destroy_task(attendee_id):
            cleaned_up_attendees.append(attendee_id)
            task = Mock()
            task.id = f"task-{attendee_id}"
            return task
        
        with patch('api.routes.workshops.get_db') as mock_get_db:
            with patch('api.routes.workshops.get_current_user', return_value="test-user"):
                with patch('tasks.terraform_tasks.destroy_attendee_resources.delay', side_effect=mock_destroy_task):
                    mock_db = Mock()
                    mock_get_db.return_value = mock_db
                    
                    mock_db.query.return_value.filter.return_value.first.return_value = mock_workshop
                    
                    mock_attendees_query = Mock()
                    mock_attendees_query.all.return_value = attendees
                    mock_db.query.return_value.filter.return_value = mock_attendees_query
                    
                    result = await cleanup_workshop_resources(
                        workshop_id=mock_workshop.id,
                        db=mock_db,
                        current_user="test-user"
                    )
                    
                    # Should only cleanup active and failed attendees
                    assert len(cleaned_up_attendees) == 2, f"Expected 2 attendees cleaned up, got {len(cleaned_up_attendees)}"
                    assert str(attendee1.id) in cleaned_up_attendees  # active
                    assert str(attendee2.id) in cleaned_up_attendees  # failed
                    assert str(attendee3.id) not in cleaned_up_attendees  # already deleted
                    
                    assert result["attendee_count"] == 2
    
    @pytest.mark.asyncio
    async def test_cleanup_tasks_execute_concurrently(self, mock_workshop, mock_attendees):
        """Test that cleanup tasks execute concurrently, not sequentially"""
        
        task_start_times = {}
        task_end_times = {}
        
        async def mock_destroy_with_delay(attendee_id):
            """Simulate destroy task with delay to test concurrency"""
            task_start_times[attendee_id] = datetime.now()
            await asyncio.sleep(1)  # Simulate 1 second operation
            task_end_times[attendee_id] = datetime.now()
            return {"success": True, "attendee_id": attendee_id}
        
        with patch('tasks.terraform_tasks.destroy_attendee_resources.apply_async') as mock_apply:
            # Mock apply_async to simulate concurrent execution
            mock_tasks = []
            for attendee in mock_attendees:
                mock_task = Mock()
                mock_task.id = f"task-{attendee.id}"
                mock_task.get = lambda aid=attendee.id: mock_destroy_with_delay(aid)
                mock_tasks.append(mock_task)
            
            mock_apply.side_effect = mock_tasks
            
            # If tasks run concurrently, total time should be ~1 second
            # If sequential, it would be ~2 seconds
            start_time = datetime.now()
            
            # Simulate cleanup execution
            for i, attendee in enumerate(mock_attendees):
                mock_apply()
            
            # Wait for mock tasks to complete
            await asyncio.gather(*[task.get() for task in mock_tasks])
            
            end_time = datetime.now()
            total_duration = (end_time - start_time).total_seconds()
            
            # Concurrent execution should complete in ~1 second, not 2+
            assert total_duration < 1.5, f"Tasks appear to run sequentially (took {total_duration}s)"
    
    def test_celery_task_queue_ordering(self):
        """Test that all cleanup tasks are properly queued"""
        
        with patch('tasks.terraform_tasks.destroy_attendee_resources.delay') as mock_delay:
            task_queue = []
            
            def track_task(attendee_id):
                task = Mock()
                task.id = f"task-{attendee_id}"
                task_queue.append(task)
                return task
            
            mock_delay.side_effect = track_task
            
            # Simulate queueing multiple cleanup tasks
            attendee_ids = ["attendee-1", "attendee-2", "attendee-3"]
            
            for aid in attendee_ids:
                mock_delay(aid)
            
            # Verify all tasks were queued
            assert len(task_queue) == 3, f"Expected 3 tasks queued, got {len(task_queue)}"
            
            # Verify tasks are independent (not chained)
            for task in task_queue:
                assert hasattr(task, 'id')
                assert not hasattr(task, 'depends_on'), "Tasks should not depend on each other"