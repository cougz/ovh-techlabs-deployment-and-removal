"""
Test to reproduce Terraform deployment failure
"""
import pytest
from unittest.mock import Mock, patch
from datetime import datetime, timezone as tz

from tasks.terraform_tasks import deploy_attendee_resources
from models.attendee import Attendee
from models.workshop import Workshop


class TestTerraformDeploymentFailure:
    """Test to reproduce and fix the Terraform deployment failure"""
    
    @pytest.fixture
    def mock_attendee(self):
        """Create a mock attendee for testing"""
        return Attendee(
            id="test-attendee-id",
            workshop_id="test-workshop-id",
            username="test-user",
            email="test@example.com",
            status="planning",
            created_at=datetime.now(tz.utc)
        )
    
    @pytest.fixture
    def mock_workshop(self):
        """Create a mock workshop for testing"""
        return Workshop(
            id="test-workshop-id",
            name="Test Workshop",
            description="Test Description",
            start_date=datetime.now(tz.utc),
            end_date=datetime.now(tz.utc),
            timezone="UTC",
            template="Generic",
            status="planning",
            created_at=datetime.now(tz.utc),
            updated_at=datetime.now(tz.utc)
        )

    def test_terraform_deployment_should_handle_nonexistent_project_error(self, mock_attendee):
        """Test that deployment gracefully handles 404 'service does not exist' errors"""
        # This test should fail initially to reproduce the issue
        
        # Simulate the actual error that's occurring
        expected_error = 'OVHcloud API error (status code 404): Client::NotFound: "This service does not exist"'
        
        with patch('tasks.terraform_tasks.run_terraform_command') as mock_terraform:
            # Mock the terraform command to return the actual error we're seeing
            mock_terraform.side_effect = Exception(expected_error)
            
            # This should handle the error gracefully instead of crashing
            result = deploy_attendee_resources.apply_async(
                args=[str(mock_attendee.id)],
                countdown=0
            ).get(propagate=False)
            
            # The deployment should fail but return structured error information
            assert "error" in result
            assert "404" in str(result["error"]) or "does not exist" in str(result["error"])
    
    def test_should_validate_ovh_credentials_before_terraform_run(self):
        """Test that OVH credentials are validated before attempting Terraform operations"""
        # This will help us identify if the issue is with credentials
        from core.config import settings
        
        # Check if OVH credentials are properly configured
        assert hasattr(settings, 'OVH_APPLICATION_KEY'), "OVH_APPLICATION_KEY must be configured"
        assert hasattr(settings, 'OVH_APPLICATION_SECRET'), "OVH_APPLICATION_SECRET must be configured"
        assert hasattr(settings, 'OVH_CONSUMER_KEY'), "OVH_CONSUMER_KEY must be configured"
        
        # Credentials should not be empty or default values
        assert settings.OVH_APPLICATION_KEY != "", "OVH_APPLICATION_KEY cannot be empty"
        assert settings.OVH_APPLICATION_SECRET != "", "OVH_APPLICATION_SECRET cannot be empty"
        assert settings.OVH_CONSUMER_KEY != "", "OVH_CONSUMER_KEY cannot be empty"
    
    def test_should_verify_ovh_api_connectivity_before_deployment(self):
        """Test OVH API connectivity before attempting deployment"""
        # This test will help us identify if the issue is with API connectivity
        import requests
        from core.config import settings
        
        # Test basic connectivity to OVH API
        try:
            response = requests.get("https://api.ovh.com/1.0/", timeout=10)
            assert response.status_code == 200, f"OVH API not reachable: {response.status_code}"
        except requests.exceptions.RequestException as e:
            pytest.fail(f"Cannot connect to OVH API: {str(e)}")
    
    def test_terraform_template_should_not_reference_hardcoded_project_id(self):
        """Test that Terraform template doesn't contain hardcoded project IDs"""
        # The error shows a specific project ID that might be hardcoded
        problematic_project_id = "b054df82344d44f49cad9bb1451ac19c"
        
        # Check if this ID appears in any Terraform templates
        import os
        import glob
        
        terraform_files = glob.glob("/app/terraform/*.tf", recursive=True)
        
        for tf_file in terraform_files:
            if os.path.exists(tf_file):
                with open(tf_file, 'r') as f:
                    content = f.read()
                    assert problematic_project_id not in content, \
                        f"Hardcoded project ID {problematic_project_id} found in {tf_file}"
    
    def test_terraform_project_creation_logic(self):
        """Test that Terraform project creation uses dynamic values, not hardcoded ones"""
        # This test verifies that project creation is dynamic
        from services.terraform_service import TerraformService
        
        # Mock attendee data
        attendee_data = {
            "username": "test-user",
            "email": "test@example.com"
        }
        
        # The service should generate dynamic project configurations
        with patch('services.terraform_service.TerraformService._write_terraform_files') as mock_write:
            service = TerraformService()
            
            # This should not use any hardcoded project IDs
            mock_write.return_value = None
            
            # Verify the template generation doesn't use hardcoded values
            # This test will help us understand how projects are being created
            assert True  # Placeholder - will implement based on investigation