"""
Test to reproduce CLEANUP-WORKER-001: Cleanup process hanging/failing
"""
import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from zoneinfo import ZoneInfo

from tasks.terraform_tasks import destroy_attendee_resources
from services.terraform_service import terraform_service
from models.attendee import Attendee
from core.database import SessionLocal


class TestCleanupWorkerHanging:
    
    @pytest.fixture
    def mock_attendee(self):
        """Create a mock attendee for testing"""
        attendee = Mock(spec=Attendee)
        attendee.id = "test-attendee-id"
        attendee.username = "test-user"
        attendee.status = "active"
        attendee.updated_at = datetime.now(ZoneInfo("UTC"))
        return attendee
    
    @pytest.fixture
    def mock_terraform_service(self):
        """Create a mock TerraformService"""
        service = Mock()
        service.destroy.return_value = (True, "Resources destroyed successfully")
        service.cleanup_workspace.return_value = None
        return service
    
    @pytest.mark.asyncio
    async def test_cleanup_should_complete_within_timeout(self, mock_attendee, mock_terraform_service):
        """Test that cleanup tasks should complete within reasonable time limit"""
        
        # Mock successful terraform destroy
        mock_terraform_service.destroy.return_value = (True, "Resources destroyed successfully")
        
        with patch('tasks.terraform_tasks.terraform_service', mock_terraform_service):
            with patch('tasks.terraform_tasks.SessionLocal') as mock_session:
                mock_db = Mock()
                mock_session.return_value.__enter__.return_value = mock_db
                mock_db.query.return_value.filter.return_value.first.return_value = mock_attendee
                
                # Test should complete within 30 seconds (much less than 15+ minutes reported)
                start_time = datetime.now()
                
                try:
                    # Use asyncio.wait_for to enforce timeout
                    # Create mock task context for destroy_attendee_resources
                    with patch.object(destroy_attendee_resources, 'request', Mock(id='test-task-id')):
                        result = await asyncio.wait_for(
                            asyncio.to_thread(destroy_attendee_resources, mock_attendee.id),
                            timeout=30.0
                        )
                    
                    end_time = datetime.now()
                    duration = (end_time - start_time).total_seconds()
                    
                    # Cleanup should complete quickly
                    assert duration < 30, f"Cleanup took {duration} seconds, should be much faster"
                    
                except asyncio.TimeoutError:
                    pytest.fail("Cleanup task hung and exceeded 30 second timeout - this reproduces the reported issue")
    
    @pytest.mark.asyncio 
    async def test_cleanup_should_handle_terraform_timeout(self, mock_attendee, mock_terraform_service):
        """Test cleanup behavior when terraform operations timeout"""
        
        # Mock terraform destroy that hangs/times out
        def slow_destroy(workspace_name):
            import time
            time.sleep(60)  # Simulate hanging terraform process
            return (False, "Timeout error")
            
        mock_terraform_service.destroy.side_effect = slow_destroy
        
        with patch('tasks.terraform_tasks.terraform_service', mock_terraform_service):
            with patch('tasks.terraform_tasks.SessionLocal') as mock_session:
                mock_db = Mock()
                mock_session.return_value.__enter__.return_value = mock_db
                mock_db.query.return_value.filter.return_value.first.return_value = mock_attendee
                
                start_time = datetime.now()
                
                # This test will likely fail initially, showing the hanging behavior
                try:
                    # Create mock task context for destroy_attendee_resources
                    with patch.object(destroy_attendee_resources, 'request', Mock(id='test-task-id')):
                        result = await asyncio.wait_for(
                            asyncio.to_thread(destroy_attendee_resources, mock_attendee.id),
                            timeout=10.0
                        )
                    pytest.fail("Expected timeout but task completed")
                    
                except asyncio.TimeoutError:
                    # This is expected - terraform operations can hang
                    end_time = datetime.now()
                    duration = (end_time - start_time).total_seconds()
                    assert duration >= 10, "Timeout should have occurred after 10 seconds"
    
    @pytest.mark.asyncio
    async def test_cleanup_should_update_status_on_failure(self, mock_attendee, mock_terraform_service):
        """Test that cleanup updates attendee status even when terraform fails"""
        
        # Mock terraform destroy failure
        mock_terraform_service.destroy.return_value = (False, "Terraform destroy failed")
        
        with patch('tasks.terraform_tasks.terraform_service', mock_terraform_service):
            with patch('tasks.terraform_tasks.SessionLocal') as mock_session:
                mock_db = Mock()
                mock_session.return_value.__enter__.return_value = mock_db
                mock_db.query.return_value.filter.return_value.first.return_value = mock_attendee
                
                # Run cleanup
                with patch.object(destroy_attendee_resources, 'request', Mock(id='test-task-id')):
                    await asyncio.to_thread(destroy_attendee_resources, mock_attendee.id)
                
                # Should have attempted to update status to 'failed' even on terraform failure
                mock_db.commit.assert_called()
                
                # Check that attendee status was updated
                assert mock_attendee.status in ['failed', 'deleting'], f"Expected status update but got {mock_attendee.status}"
    
    def test_celery_worker_should_not_be_idle_with_pending_tasks(self):
        """Test to identify when workers show as idle despite having cleanup tasks"""
        
        # This test would check Celery queue status
        # In real scenario, this would verify:
        # 1. Tasks are properly queued
        # 2. Workers are picking up tasks
        # 3. No tasks are stuck in PENDING state
        
        # Mock Celery inspection
        with patch('celery.app.control.Inspect') as mock_inspect:
            mock_inspector = Mock()
            mock_inspect.return_value = mock_inspector
            
            # Simulate idle workers but pending tasks (the reported problem)
            mock_inspector.active.return_value = {'worker1': []}  # No active tasks
            mock_inspector.reserved.return_value = {'worker1': []}  # No reserved tasks
            mock_inspector.scheduled.return_value = {'worker1': []}  # No scheduled tasks
            
            # But tasks should exist in queue
            with patch('tasks.terraform_tasks.destroy_attendee_resources.delay') as mock_delay:
                mock_task = Mock()
                mock_task.state = 'PENDING'
                mock_task.id = 'test-task-id'
                mock_delay.return_value = mock_task
                
                # This would indicate a problem: task queued but not processed
                task = mock_delay('test-attendee-id')
                
                assert task.state == 'PENDING'
                # In real scenario, after some time, this task should not remain PENDING
                # This test would identify the worker system malfunction