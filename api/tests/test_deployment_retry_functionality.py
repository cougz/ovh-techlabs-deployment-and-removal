"""
Test to reproduce RETRY-DEPLOY-001: Add Deployment Retry Functionality
"""
import pytest
import time
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from uuid import uuid4

from main import app

client = TestClient(app)


class TestDeploymentRetryFunctionality:
    """Test to implement and verify deployment retry functionality"""
    
    def test_should_allow_retry_for_failed_deployments(self):
        """Test that failed attendee deployments can be retried"""
        attendee_id = str(uuid4())
        
        with patch('models.attendee.Attendee') as mock_attendee_model, \
             patch('api.routes.auth.get_current_user') as mock_auth, \
             patch('tasks.terraform_tasks.deploy_attendee_resources.delay') as mock_deploy_task:
            
            mock_auth.return_value = "test_user"
            
            # Mock failed attendee 
            mock_attendee = MagicMock()
            mock_attendee.status = "failed"
            mock_attendee.id = attendee_id
            mock_attendee_model.query.filter.return_value.first.return_value = mock_attendee
            
            # Mock Celery task
            mock_task = MagicMock()
            mock_task.id = "retry-task-123"
            mock_deploy_task.return_value = mock_task
            
            # Call retry endpoint
            response = client.post(f"/api/attendees/{attendee_id}/retry")
            
            assert response.status_code == 200
            result = response.json()
            assert "retry started" in result["message"].lower()
            assert result["task_id"] == "retry-task-123"
            assert result["attendee_id"] == attendee_id
            
            # Verify attendee status was reset to deploying
            assert mock_attendee.status == "deploying"
            
            # Verify deployment task was queued
            mock_deploy_task.assert_called_once_with(attendee_id)
    
    def test_should_reject_retry_for_non_failed_attendees(self):
        """Test that retry is only allowed for failed attendees"""
        attendee_id = str(uuid4())
        
        with patch('models.attendee.Attendee') as mock_attendee_model, \
             patch('api.routes.auth.get_current_user') as mock_auth:
            
            mock_auth.return_value = "test_user"
            
            # Mock active attendee (should not allow retry)
            mock_attendee = MagicMock()
            mock_attendee.status = "active"
            mock_attendee_model.query.filter.return_value.first.return_value = mock_attendee
            
            response = client.post(f"/api/attendees/{attendee_id}/retry")
            
            assert response.status_code == 400
            assert "only retry failed deployments" in response.json()["detail"].lower()
    
    def test_should_implement_exponential_backoff_for_automatic_retries(self):
        """Test automatic retry with exponential backoff for transient failures"""
        
        # Mock deployment task that fails with transient error
        with patch('tasks.terraform_tasks.deploy_attendee_resources') as mock_deploy, \
             patch('core.database.SessionLocal') as mock_db, \
             patch('time.sleep') as mock_sleep:
            
            attendee_id = str(uuid4())
            
            # Mock database and attendee
            mock_session = MagicMock()
            mock_db.return_value = mock_session
            
            mock_attendee = MagicMock()
            mock_attendee.id = attendee_id
            mock_attendee.status = "deploying"
            mock_session.query.return_value.filter.return_value.first.return_value = mock_attendee
            
            # Mock terraform service to fail with quota error first time, succeed second time
            from tasks.terraform_tasks import deploy_attendee_resources_with_retry
            
            with patch('services.terraform_service.terraform_service.apply_with_recovery') as mock_apply:
                # First attempt: fail with quota error
                mock_apply.side_effect = [
                    (False, "Error: Quota exceeded. Please try again later", False),
                    (True, "Resources created successfully", False)
                ]
                
                # Call retry function
                result = deploy_attendee_resources_with_retry(attendee_id, max_retries=2)
                
                # Should succeed on second attempt
                assert result["success"] == True
                
                # Verify exponential backoff was used (first retry after 2^1 = 2 seconds)
                mock_sleep.assert_called_with(2)
                
                # Verify terraform was called twice (initial + 1 retry)
                assert mock_apply.call_count == 2
    
    def test_should_track_retry_attempts_in_deployment_log(self):
        """Test that retry attempts are logged properly"""
        attendee_id = str(uuid4())
        
        with patch('core.database.SessionLocal') as mock_db, \
             patch('models.deployment_log.DeploymentLog') as mock_log_model:
            
            mock_session = MagicMock()
            mock_db.return_value = mock_session
            
            # Mock attendee
            mock_attendee = MagicMock()
            mock_attendee.id = attendee_id
            mock_session.query.return_value.filter.return_value.first.return_value = mock_attendee
            
            # Mock deployment log creation
            mock_log = MagicMock()
            mock_log_model.return_value = mock_log
            
            from tasks.terraform_tasks import create_retry_deployment_log
            
            # Test retry log creation
            create_retry_deployment_log(attendee_id, attempt_number=2, previous_error="Quota exceeded")
            
            # Verify log was created with retry information
            mock_log_model.assert_called_once()
            call_args = mock_log_model.call_args[1]
            
            assert call_args["attendee_id"] == attendee_id
            assert call_args["action"] == "deploy_retry"
            assert call_args["status"] == "started"
            assert "attempt_number=2" in call_args["notes"]
            assert "Quota exceeded" in call_args["notes"]
    
    def test_should_provide_retry_button_in_frontend(self):
        """Test that frontend has retry functionality for failed deployments"""
        
        # This test validates that the API endpoint exists and works
        # The frontend implementation will be tested separately
        attendee_id = str(uuid4())
        
        with patch('models.attendee.Attendee') as mock_attendee_model, \
             patch('api.routes.auth.get_current_user') as mock_auth:
            
            mock_auth.return_value = "test_user"
            
            # Test retry endpoint exists
            mock_attendee = MagicMock()
            mock_attendee.status = "failed"
            mock_attendee_model.query.filter.return_value.first.return_value = mock_attendee
            
            response = client.post(f"/api/attendees/{attendee_id}/retry")
            
            # Should return 200 (endpoint exists and works)
            assert response.status_code == 200
    
    def test_should_limit_maximum_retry_attempts(self):
        """Test that there's a maximum limit on retry attempts"""
        
        from tasks.terraform_tasks import deploy_attendee_resources_with_retry
        
        attendee_id = str(uuid4())
        
        with patch('core.database.SessionLocal') as mock_db, \
             patch('services.terraform_service.terraform_service.apply_with_recovery') as mock_apply, \
             patch('time.sleep') as mock_sleep:
            
            # Mock database
            mock_session = MagicMock()
            mock_db.return_value = mock_session
            
            mock_attendee = MagicMock()
            mock_attendee.id = attendee_id
            mock_session.query.return_value.filter.return_value.first.return_value = mock_attendee
            
            # Mock terraform to always fail
            mock_apply.return_value = (False, "Persistent error", False)
            
            # Call with max retries of 3
            result = deploy_attendee_resources_with_retry(attendee_id, max_retries=3)
            
            # Should fail after 3 attempts
            assert result["success"] == False
            assert "max retry attempts exceeded" in result["error"].lower()
            
            # Should have tried exactly 3 times (initial + 2 retries)
            assert mock_apply.call_count == 3
            
            # Should have used exponential backoff: 1s, 2s
            expected_calls = [patch.call(1), patch.call(2)]
            mock_sleep.assert_has_calls(expected_calls)