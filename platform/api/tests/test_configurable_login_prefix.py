"""
Test to reproduce LOGIN-PREFIX-001: Configurable Login Prefix System
"""
import pytest
from unittest.mock import patch, MagicMock
from api.routes.attendees import get_attendee_credentials
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


class TestConfigurableLoginPrefix:
    """Test to implement and verify configurable login prefix system"""
    
    def test_should_apply_login_prefix_to_exported_credentials(self):
        """Test that credentials export includes configurable login prefix"""
        
        # Mock terraform outputs
        mock_outputs = {
            "username": {"value": "john-doe"},
            "password": {"value": "SecurePass123!"}
        }
        
        # Mock configuration with login prefix
        mock_config = {
            "login_prefix": "0541-8821-89/"
        }
        
        with patch('models.attendee.Attendee') as mock_attendee_model, \
             patch('services.terraform_service.terraform_service.get_outputs') as mock_get_outputs, \
             patch('api.routes.attendees.get_login_prefix_config') as mock_get_config:
            
            # Mock attendee object
            mock_attendee = MagicMock()
            mock_attendee.status = "active"
            mock_attendee.ovh_project_id = "test-project-123"
            mock_attendee.ovh_user_urn = "urn:ovh:test"
            
            mock_attendee_model.query.filter.return_value.first.return_value = mock_attendee
            
            mock_get_outputs.return_value = mock_outputs
            mock_get_config.return_value = mock_config
            
            # Call the credentials endpoint
            response = client.get("/api/attendees/test-attendee-id/credentials")
            
            assert response.status_code == 200
            credentials = response.json()
            
            # Username should include the configurable prefix
            expected_username = "0541-8821-89/john-doe"
            assert credentials["username"] == expected_username
            assert credentials["password"] == "SecurePass123!"
    
    def test_should_use_empty_prefix_when_not_configured(self):
        """Test that credentials work normally when no prefix is configured"""
        
        # Mock terraform outputs
        mock_outputs = {
            "username": {"value": "jane-smith"},
            "password": {"value": "AnotherPass456!"}
        }
        
        # No login prefix configured
        mock_config = {
            "login_prefix": ""
        }
        
        with patch('models.attendee.Attendee') as mock_attendee_model, \
             patch('services.terraform_service.terraform_service.get_outputs') as mock_get_outputs, \
             patch('api.routes.attendees.get_login_prefix_config') as mock_get_config:
            
            # Mock attendee object
            mock_attendee = MagicMock()
            mock_attendee.status = "active"
            mock_attendee.ovh_project_id = "test-project-456"
            mock_attendee.ovh_user_urn = "urn:ovh:test"
            
            mock_attendee_model.query.filter.return_value.first.return_value = mock_attendee
            
            mock_get_outputs.return_value = mock_outputs
            mock_get_config.return_value = mock_config
            
            response = client.get("/api/attendees/test-attendee-id/credentials")
            
            assert response.status_code == 200
            credentials = response.json()
            
            # Username should be unchanged when no prefix configured
            assert credentials["username"] == "jane-smith"
    
    def test_should_save_and_retrieve_login_prefix_configuration(self):
        """Test that login prefix can be configured and persisted"""
        
        # Test saving configuration
        config_data = {
            "login_prefix": "9876-5432-10/",
            "export_format": "OVHcloud Login"
        }
        
        with patch('api.routes.settings.save_login_prefix_config') as mock_save:
            mock_save.return_value = True
            
            response = client.post("/api/settings/login-prefix", json=config_data)
            
            assert response.status_code == 200
            mock_save.assert_called_once_with(config_data)
        
        # Test retrieving configuration
        with patch('api.routes.settings.get_login_prefix_config') as mock_get:
            mock_get.return_value = config_data
            
            response = client.get("/api/settings/login-prefix")
            
            assert response.status_code == 200
            result = response.json()
            assert result["login_prefix"] == "9876-5432-10/"
            assert result["export_format"] == "OVHcloud Login"
    
    def test_should_validate_login_prefix_format(self):
        """Test that login prefix validation works correctly"""
        
        invalid_configs = [
            {"login_prefix": "invalid-format"},  # Missing trailing slash
            {"login_prefix": "toolong" * 20},    # Too long
            {"login_prefix": "special@chars#/"}   # Invalid characters
        ]
        
        for invalid_config in invalid_configs:
            with patch('api.routes.settings.validate_login_prefix') as mock_validate:
                mock_validate.return_value = False
                
                response = client.post("/api/settings/login-prefix", json=invalid_config)
                
                # Should reject invalid format
                assert response.status_code == 400