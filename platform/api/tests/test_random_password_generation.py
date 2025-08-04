"""
Test to reproduce PASSWORD-GEN-001: Implement Random Password Generation
"""
import pytest
import re
from unittest.mock import patch, MagicMock
from services.terraform_service import TerraformService


class TestRandomPasswordGeneration:
    """Test to implement and verify random password generation"""
    
    def test_should_generate_unique_passwords_for_each_user(self):
        """Test that each terraform deployment generates a unique password"""
        
        service = TerraformService()
        
        # Generate terraform content for two different users
        config1 = {
            "username": "john-doe",
            "user_email": "john@example.com", 
            "project_description": "Test project 1"
        }
        terraform_content_1 = service._generate_main_tf(config1)
        
        config2 = {
            "username": "jane-doe",
            "user_email": "jane@example.com",
            "project_description": "Test project 2"
        }
        terraform_content_2 = service._generate_main_tf(config2)
        
        # Extract passwords from both contents
        password_pattern = r'password\s*=\s*"([^"]+)"'
        password1_match = re.search(password_pattern, terraform_content_1)
        password2_match = re.search(password_pattern, terraform_content_2)
        
        assert password1_match, "Password not found in first terraform content"
        assert password2_match, "Password not found in second terraform content"
        
        password1 = password1_match.group(1)
        password2 = password2_match.group(1)
        
        # Passwords should be different for different users
        assert password1 != password2, "Passwords should be unique per user"
        
        # Neither should be the hardcoded password
        assert password1 != "TempPassword123!", "Should not use hardcoded password"
        assert password2 != "TempPassword123!", "Should not use hardcoded password"
    
    def test_should_generate_secure_passwords(self):
        """Test that generated passwords meet security requirements"""
        
        service = TerraformService()
        
        config = {
            "username": "test-user",
            "user_email": "test@example.com",
            "project_description": "Test project"
        }
        terraform_content = service._generate_main_tf(config)
        
        # Extract password from terraform content
        password_match = re.search(r'password\s*=\s*"([^"]+)"', terraform_content)
        assert password_match, "Password not found in terraform content"
        
        password = password_match.group(1)
        
        # Password should be at least 12 characters long
        assert len(password) >= 12, f"Password too short: {len(password)} chars"
        
        # Password should contain various character types
        assert any(c.isupper() for c in password), "Password should contain uppercase letters"
        assert any(c.islower() for c in password), "Password should contain lowercase letters" 
        assert any(c.isdigit() for c in password), "Password should contain digits"
        assert any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password), "Password should contain special characters"
    
    def test_should_be_deterministic_for_same_attendee(self):
        """Test that the same attendee gets the same password (for consistency)"""
        
        service = TerraformService()
        
        # Generate terraform content twice for the same attendee
        config = {
            "username": "same-user",
            "user_email": "same@example.com",
            "project_description": "Test project"
        }
        terraform_content_1 = service._generate_main_tf(config)
        terraform_content_2 = service._generate_main_tf(config)
        
        # Extract passwords from both contents
        password1_match = re.search(r'password\s*=\s*"([^"]+)"', terraform_content_1)
        password2_match = re.search(r'password\s*=\s*"([^"]+)"', terraform_content_2)
        
        assert password1_match and password2_match, "Passwords not found"
        
        password1 = password1_match.group(1)
        password2 = password2_match.group(1)
        
        # Same attendee should get same password (for consistency)
        assert password1 == password2, "Same attendee should get consistent password"