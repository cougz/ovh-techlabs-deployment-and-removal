"""
Tests for Terraform state recovery and error handling
"""
import pytest
import tempfile
import os
import json
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

from services.terraform_service import TerraformService
from core.config import settings


class TestTerraformStateRecovery:
    """Test terraform state recovery for handling stale project references"""
    
    @pytest.fixture
    def terraform_service(self):
        """Create a TerraformService instance for testing"""
        return TerraformService()
    
    @pytest.fixture
    def temp_workspace(self):
        """Create a temporary workspace for testing"""
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace_path = Path(tmpdir) / "test-workspace"
            workspace_path.mkdir()
            yield workspace_path
    
    def test_should_detect_stale_project_reference_in_state(self, terraform_service, temp_workspace):
        """Test detection of stale project references in terraform state"""
        # Create a fake terraform state with a non-existent project
        stale_project_id = "b054df82344d44f49cad9bb1451ac19c"
        
        state_content = {
            "version": 4,
            "terraform_version": "1.0.0",
            "serial": 1,
            "resources": [
                {
                    "type": "ovh_cloud_project",
                    "name": "workshop_project",
                    "provider": "provider[\"registry.terraform.io/ovh/ovh\"]",
                    "instances": [
                        {
                            "schema_version": 0,
                            "attributes": {
                                "project_id": stale_project_id,
                                "description": "Test project",
                                "status": "ok"
                            }
                        }
                    ]
                }
            ]
        }
        
        # Write state file
        state_file = temp_workspace / "terraform.tfstate"
        with open(state_file, 'w') as f:
            json.dump(state_content, f)
        
        # The service should detect this stale reference
        has_stale_refs = terraform_service._has_stale_project_references(str(temp_workspace))
        assert has_stale_refs is True
    
    def test_should_handle_404_service_not_exist_error_gracefully(self, terraform_service):
        """Test graceful handling of 404 'service does not exist' errors"""
        # Mock terraform command to return 404 error
        error_message = 'OVHcloud API error (status code 404): Client::NotFound: "This service does not exist"'
        
        with patch('services.terraform_service.TerraformService._run_terraform_command') as mock_command:
            mock_command.side_effect = Exception(error_message)
            
            # The service should handle this error gracefully
            result = terraform_service._handle_terraform_error(error_message)
            
            assert result["error_type"] == "stale_project_reference"
            assert result["requires_state_cleanup"] is True
            assert "404" in result["error_message"]
    
    def test_should_clean_stale_project_from_state(self, terraform_service, temp_workspace):
        """Test removal of stale project references from terraform state"""
        stale_project_id = "b054df82344d44f49cad9bb1451ac19c"
        
        # Create state with stale project
        state_content = {
            "version": 4,
            "resources": [
                {
                    "type": "ovh_cloud_project",
                    "name": "workshop_project",
                    "instances": [{"attributes": {"project_id": stale_project_id}}]
                },
                {
                    "type": "ovh_me_identity_user", 
                    "name": "workshop_user",
                    "instances": [{"attributes": {"login": "test-user"}}]
                }
            ]
        }
        
        state_file = temp_workspace / "terraform.tfstate"
        with open(state_file, 'w') as f:
            json.dump(state_content, f)
        
        # Clean stale project reference
        terraform_service._clean_stale_project_from_state(str(temp_workspace), stale_project_id)
        
        # Verify project was removed but user remains
        with open(state_file, 'r') as f:
            updated_state = json.load(f)
        
        project_resources = [r for r in updated_state["resources"] if r["type"] == "ovh_cloud_project"]
        user_resources = [r for r in updated_state["resources"] if r["type"] == "ovh_me_identity_user"]
        
        assert len(project_resources) == 0
        assert len(user_resources) == 1
    
    def test_should_validate_ovh_credentials_before_deployment(self, terraform_service):
        """Test OVH credential validation before attempting deployment"""
        # Test with invalid credentials
        with patch('services.terraform_service.settings') as mock_settings:
            mock_settings.OVH_APPLICATION_KEY = "your-application-key"
            mock_settings.OVH_APPLICATION_SECRET = "your-application-secret"
            mock_settings.OVH_CONSUMER_KEY = "your-consumer-key"
            
            is_valid = terraform_service._validate_ovh_credentials()
            assert is_valid is False
    
    def test_should_provide_clear_error_for_invalid_credentials(self, terraform_service):
        """Test clear error messaging for invalid OVH credentials"""
        with patch('services.terraform_service.settings') as mock_settings:
            mock_settings.OVH_APPLICATION_KEY = "invalid"
            mock_settings.OVH_APPLICATION_SECRET = "invalid"
            mock_settings.OVH_CONSUMER_KEY = "invalid"
            
            error_info = terraform_service._get_credential_validation_error()
            
            assert "invalid" in error_info["message"].lower()
            assert "ovh_application_key" in error_info["details"]
            assert error_info["error_type"] == "invalid_credentials"
    
    def test_should_recover_from_stale_state_automatically(self, terraform_service, temp_workspace):
        """Test automatic recovery from stale state during deployment"""
        attendee_config = {
            "username": "test-user",
            "email": "test@example.com",
            "project_description": "Test project"
        }
        
        # Mock terraform apply to initially fail with 404, then succeed after state cleanup
        with patch('services.terraform_service.TerraformService._run_terraform_command') as mock_command:
            # First call fails with 404
            # Second call (after state cleanup) succeeds
            mock_command.side_effect = [
                Exception('OVHcloud API error (status code 404): "This service does not exist"'),
                {"success": True, "output": "Apply complete"}
            ]
            
            with patch('services.terraform_service.TerraformService._clean_stale_references') as mock_clean:
                mock_clean.return_value = True
                
                # Should recover automatically and retry
                result = terraform_service._deploy_with_recovery(str(temp_workspace), attendee_config)
                
                assert result["success"] is True
                assert result["recovered_from_stale_state"] is True
                mock_clean.assert_called_once()
    
    def test_should_create_workspace_backup_before_state_cleanup(self, terraform_service, temp_workspace):
        """Test that workspace is backed up before state cleanup operations"""
        # Create some files in workspace
        (temp_workspace / "main.tf").write_text("# terraform config")
        (temp_workspace / "terraform.tfstate").write_text('{"version": 4}')
        
        # Mock the backup functionality
        with patch('services.terraform_service.TerraformService._create_workspace_backup') as mock_backup:
            mock_backup.return_value = str(temp_workspace) + ".backup"
            
            terraform_service._safe_cleanup_workspace(str(temp_workspace))
            
            mock_backup.assert_called_once_with(str(temp_workspace))