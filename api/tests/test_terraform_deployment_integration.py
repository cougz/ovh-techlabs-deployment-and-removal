"""
Integration test for terraform deployment with recovery functionality
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone as tz

from services.terraform_service import terraform_service


class TestTerraformDeploymentIntegration:
    """Integration tests for terraform deployment with stale state recovery"""
    
    def test_apply_with_recovery_should_succeed_on_first_attempt(self):
        """Test that apply_with_recovery works normally when no errors occur"""
        workspace_name = "test-workspace"
        terraform_config = {
            "username": "test-user",
            "email": "test@example.com",
            "project_description": "Test project"
        }
        
        # Mock successful apply
        with patch.object(terraform_service, 'apply') as mock_apply:
            mock_apply.return_value = (True, "Apply successful")
            
            success, output, recovered = terraform_service.apply_with_recovery(
                workspace_name, 
                terraform_config
            )
            
            assert success is True
            assert "Apply successful" in output
            assert recovered is False
            mock_apply.assert_called_once_with(workspace_name)
    
    def test_apply_with_recovery_should_handle_404_error_and_recover(self):
        """Test automatic recovery from 404 'service does not exist' errors"""
        workspace_name = "test-workspace"
        terraform_config = {
            "username": "test-user", 
            "email": "test@example.com",
            "project_description": "Test project"
        }
        
        # Mock first apply fails with 404, second succeeds
        with patch.object(terraform_service, 'apply') as mock_apply, \
             patch.object(terraform_service, 'plan') as mock_plan, \
             patch.object(terraform_service, '_clean_stale_references') as mock_clean:
            
            # First apply fails with 404 error
            # Second apply (after recovery) succeeds
            mock_apply.side_effect = [
                (False, 'OVHcloud API error (status code 404): "This service does not exist"'),
                (True, "Apply successful after recovery")
            ]
            mock_plan.return_value = (True, "Plan successful")
            mock_clean.return_value = True
            
            success, output, recovered = terraform_service.apply_with_recovery(
                workspace_name,
                terraform_config
            )
            
            assert success is True
            assert "Apply successful after recovery" in output
            assert recovered is True
            assert mock_apply.call_count == 2
            mock_clean.assert_called_once()
            mock_plan.assert_called_once()
    
    def test_apply_with_recovery_should_fail_if_recovery_plan_fails(self):
        """Test that recovery fails gracefully if re-plan fails after state cleanup"""
        workspace_name = "test-workspace"
        terraform_config = {"username": "test-user", "email": "test@example.com"}
        
        with patch.object(terraform_service, 'apply') as mock_apply, \
             patch.object(terraform_service, 'plan') as mock_plan, \
             patch.object(terraform_service, '_clean_stale_references') as mock_clean:
            
            mock_apply.return_value = (False, 'OVHcloud API error (status code 404): "This service does not exist"')
            mock_plan.return_value = (False, "Plan failed after recovery")
            mock_clean.return_value = True
            
            success, output, recovered = terraform_service.apply_with_recovery(
                workspace_name,
                terraform_config
            )
            
            assert success is False
            assert "Recovery failed - plan error" in output
            assert recovered is True
    
    def test_apply_with_recovery_should_handle_non_404_errors_normally(self):
        """Test that non-404 errors are handled normally without recovery attempts"""
        workspace_name = "test-workspace"
        terraform_config = {"username": "test-user", "email": "test@example.com"}
        
        with patch.object(terraform_service, 'apply') as mock_apply, \
             patch.object(terraform_service, '_clean_stale_references') as mock_clean:
            
            mock_apply.return_value = (False, "General terraform error - not 404")
            
            success, output, recovered = terraform_service.apply_with_recovery(
                workspace_name,
                terraform_config
            )
            
            assert success is False
            assert "General terraform error - not 404" in output
            assert recovered is False
            # Recovery should not be attempted for non-404 errors
            mock_clean.assert_not_called()
    
    def test_deployment_task_integration(self):
        """Test that the deployment task properly uses apply_with_recovery"""
        # This test ensures the deployment task correctly integrates with the recovery functionality
        from tasks.terraform_tasks import deploy_attendee_resources
        
        # Mock database and attendee
        mock_attendee = Mock()
        mock_attendee.id = "test-attendee-id"
        mock_attendee.username = "test-user"
        mock_attendee.email = "test@example.com"
        mock_attendee.workshop_id = "test-workshop-id"
        mock_attendee.status = "planning"
        
        with patch('tasks.terraform_tasks.SessionLocal') as mock_session, \
             patch.object(terraform_service, 'apply_with_recovery') as mock_apply_recovery, \
             patch.object(terraform_service, 'create_workspace') as mock_create, \
             patch.object(terraform_service, 'plan') as mock_plan, \
             patch.object(terraform_service, 'get_outputs') as mock_outputs, \
             patch('tasks.terraform_tasks.broadcast_deployment_progress'), \
             patch('tasks.terraform_tasks.broadcast_deployment_log'), \
             patch('tasks.terraform_tasks.update_workshop_status_based_on_attendees'):
            
            # Mock database query
            mock_db = mock_session.return_value.__enter__.return_value
            mock_db.query.return_value.filter.return_value.first.return_value = mock_attendee
            
            # Mock terraform operations
            mock_create.return_value = True
            mock_plan.return_value = (True, "Plan successful")
            mock_apply_recovery.return_value = (True, "Apply successful with recovery", True)  # recovered=True
            mock_outputs.return_value = (True, {"project_id": "test-project"})
            
            # Execute the task
            task = deploy_attendee_resources.s("test-attendee-id")
            result = task.apply().get()
            
            # Verify apply_with_recovery was called instead of regular apply
            mock_apply_recovery.assert_called_once()
            args, kwargs = mock_apply_recovery.call_args
            workspace_name = args[0]
            terraform_config = args[1]
            
            assert workspace_name.startswith("attendee-test-attendee-id")
            assert terraform_config["username"] == "test-user"
            assert terraform_config["email"] == "test@example.com"
            
            # Verify successful result
            assert result["success"] is True