"""
Integration test for configurable login prefix system
"""
import json
import os
import tempfile
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from main import app
from api.routes.settings import get_login_prefix_config, save_login_prefix_config, validate_login_prefix


client = TestClient(app)


class TestLoginPrefixIntegration:
    """Integration test for login prefix functionality"""

    def test_prefix_configuration_storage(self):
        """Test that login prefix can be stored and retrieved"""
        config_data = {
            "login_prefix": "0541-8821-89/",
            "export_format": "OVHcloud Login"
        }
        
        # Test storage and retrieval functions directly
        assert save_login_prefix_config(config_data) == True
        
        retrieved_config = get_login_prefix_config()
        assert retrieved_config["login_prefix"] == "0541-8821-89/"
        assert retrieved_config["export_format"] == "OVHcloud Login"
        
        # Clean up
        try:
            os.remove("/app/config/login_prefix.json")
        except:
            pass

    def test_prefix_validation_logic(self):
        """Test login prefix validation rules"""
        
        # Valid prefixes
        assert validate_login_prefix("") == True  # Empty is valid
        assert validate_login_prefix("0541-8821-89/") == True
        assert validate_login_prefix("123-456-78/") == True
        
        # Invalid prefixes 
        assert validate_login_prefix("no-slash") == False  # Missing slash
        assert validate_login_prefix("invalid@chars/") == False  # Invalid chars
        assert validate_login_prefix("x" * 60 + "/") == False  # Too long

    def test_settings_endpoint_save_config(self):
        """Test settings API endpoint for saving config"""
        config_data = {
            "login_prefix": "1234-5678-90/",
            "export_format": "Custom Format"
        }
        
        with patch('api.routes.auth.get_current_user') as mock_auth:
            mock_auth.return_value = "test_user"
            
            response = client.post("/api/settings/login-prefix", json=config_data)
            
            assert response.status_code == 200
            assert "saved successfully" in response.json()["message"]

    def test_settings_endpoint_get_config(self):
        """Test settings API endpoint for getting config"""
        
        with patch('api.routes.auth.get_current_user') as mock_auth:
            mock_auth.return_value = "test_user"
            
            response = client.get("/api/settings/login-prefix")
            
            assert response.status_code == 200
            config = response.json()
            assert "login_prefix" in config
            assert "export_format" in config

    def test_settings_validation_reject_invalid(self):
        """Test that settings endpoint rejects invalid prefixes"""
        invalid_config = {
            "login_prefix": "invalid-format-no-slash"
        }
        
        with patch('api.routes.auth.get_current_user') as mock_auth:
            mock_auth.return_value = "test_user"
            
            response = client.post("/api/settings/login-prefix", json=invalid_config)
            
            assert response.status_code == 400
            assert "Invalid login prefix format" in response.json()["detail"]

    def test_credentials_endpoint_applies_prefix(self):
        """Test that credentials endpoint applies configured prefix"""
        
        # Create test config with prefix
        test_config = {"login_prefix": "TEST-PREFIX/"}
        
        with patch('api.routes.auth.get_current_user') as mock_auth, \
             patch('models.attendee.Attendee') as mock_attendee_model, \
             patch('services.terraform_service.terraform_service.get_outputs') as mock_outputs, \
             patch('api.routes.settings.get_login_prefix_config') as mock_get_config:
            
            mock_auth.return_value = "test_user"
            
            # Mock attendee
            mock_attendee = MagicMock()
            mock_attendee.status = "active"
            mock_attendee.ovh_project_id = "test-project"
            mock_attendee.ovh_user_urn = "urn:ovh:test"
            mock_attendee_model.query.filter.return_value.first.return_value = mock_attendee
            
            # Mock terraform outputs
            mock_outputs.return_value = {
                "username": {"value": "john-doe"},
                "password": {"value": "secure123!"}
            }
            
            # Mock config
            mock_get_config.return_value = test_config
            
            response = client.get("/api/attendees/test-id/credentials")
            
            assert response.status_code == 200
            credentials = response.json()
            assert credentials["username"] == "TEST-PREFIX/john-doe"
            assert credentials["password"] == "secure123!"