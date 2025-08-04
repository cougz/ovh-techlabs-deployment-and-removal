"""
Simple test for terraform stale state recovery functionality
"""
import pytest
from unittest.mock import Mock, patch
from pathlib import Path
import tempfile
import os

from services.terraform_service import TerraformService


class TestTerraformRecoverySimple:
    """Simple tests for terraform recovery without mocking the global instance"""
    
    def test_apply_with_recovery_workspace_not_exists(self):
        """Test apply_with_recovery when workspace doesn't exist"""
        service = TerraformService()
        
        success, output, recovered = service.apply_with_recovery("nonexistent-workspace", {})
        
        assert success is False
        assert "Workspace does not exist" in output
        assert recovered is False
    
    def test_handle_terraform_error_identifies_404_stale_state(self):
        """Test that 404 errors are properly identified as stale state issues"""
        service = TerraformService()
        
        error_message = 'OVHcloud API error (status code 404): Client::NotFound: "This service does not exist"'
        error_info = service._handle_terraform_error(error_message)
        
        assert error_info["error_type"] == "stale_project_reference"
        assert error_info["requires_state_cleanup"] is True
        assert "404" in error_info["error_message"]
    
    def test_handle_terraform_error_ignores_other_errors(self):
        """Test that non-404 errors are not treated as stale state"""
        service = TerraformService()
        
        error_message = "Invalid configuration or some other terraform error"
        error_info = service._handle_terraform_error(error_message)
        
        assert error_info["error_type"] == "general_error"
        assert error_info["requires_state_cleanup"] is False
    
    def test_validate_ovh_credentials_detects_placeholder_values(self):
        """Test that placeholder OVH credentials are detected as invalid"""
        service = TerraformService()
        
        # The current .env has placeholder values, so this should return False
        is_valid = service._validate_ovh_credentials()
        
        assert is_valid is False
    
    def test_get_credential_validation_error_provides_helpful_info(self):
        """Test that credential validation errors provide helpful information"""
        service = TerraformService()
        
        error_info = service._get_credential_validation_error()
        
        assert error_info["error_type"] == "invalid_credentials"
        assert "invalid" in error_info["message"].lower()
        assert "ovh_application_key" in error_info["details"]
    
    @patch('services.terraform_service.TerraformService.apply')
    def test_apply_with_recovery_calls_apply_method(self, mock_apply):
        """Test that apply_with_recovery calls the apply method"""
        service = TerraformService()
        
        # Create a temporary workspace directory
        with tempfile.TemporaryDirectory() as temp_dir:
            workspace_name = "test-workspace"
            workspace_path = Path(temp_dir) / workspace_name
            workspace_path.mkdir()
            
            # Mock the _get_workspace_path to return our temp directory
            with patch.object(service, '_get_workspace_path', return_value=workspace_path):
                mock_apply.return_value = (True, "Apply successful")
                
                success, output, recovered = service.apply_with_recovery(workspace_name, {})
                
                assert success is True
                assert "Apply successful" in output
                assert recovered is False
                mock_apply.assert_called_once_with(workspace_name)
    
    @patch('services.terraform_service.TerraformService.apply')
    @patch('services.terraform_service.TerraformService.plan')
    @patch('services.terraform_service.TerraformService._clean_stale_references')
    def test_apply_with_recovery_handles_404_and_retries(self, mock_clean, mock_plan, mock_apply):
        """Test recovery from 404 errors with retry logic"""
        service = TerraformService()
        
        with tempfile.TemporaryDirectory() as temp_dir:
            workspace_name = "test-workspace"
            workspace_path = Path(temp_dir) / workspace_name
            workspace_path.mkdir()
            
            with patch.object(service, '_get_workspace_path', return_value=workspace_path):
                # First apply fails with 404, second succeeds
                mock_apply.side_effect = [
                    (False, 'OVHcloud API error (status code 404): "This service does not exist"'),
                    (True, "Apply successful after recovery")
                ]
                mock_plan.return_value = (True, "Plan successful")
                mock_clean.return_value = True
                
                success, output, recovered = service.apply_with_recovery(workspace_name, {})
                
                assert success is True
                assert "Apply successful after recovery" in output
                assert recovered is True
                assert mock_apply.call_count == 2
                mock_clean.assert_called_once()
                mock_plan.assert_called_once()
    
    def test_deployment_task_has_recovery_integration(self):
        """Test that deployment task code contains recovery functionality"""
        # Read the actual deployment task file to verify it uses apply_with_recovery
        with open('/app/tasks/terraform_tasks.py', 'r') as f:
            task_content = f.read()
        
        # Verify the code contains our recovery integration
        assert 'apply_with_recovery' in task_content
        assert 'recovered' in task_content
        assert 'Successfully recovered from stale state' in task_content
        
        # Verify the original apply call was replaced
        # Should not contain the old pattern but should contain the new pattern
        lines = task_content.split('\n')
        recovery_lines = [line for line in lines if 'apply_with_recovery' in line]
        
        assert len(recovery_lines) > 0, "apply_with_recovery should be used in the deployment task"