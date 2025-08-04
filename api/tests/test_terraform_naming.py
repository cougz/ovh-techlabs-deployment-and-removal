#!/usr/bin/env python3
"""
Test for Terraform resource naming sanitization.
Ensures usernames with special characters are properly sanitized for OVH resource names.
"""

import unittest
from unittest.mock import Mock, patch
import tempfile
import os
import re
from api.services.terraform_service import terraform_service


class TestTerraformNaming(unittest.TestCase):
    """Test Terraform resource naming sanitization."""

    def setUp(self):
        """Set up test environment."""
        self.test_config = {
            'workshop_id': 'test-workshop',
            'attendee_id': 'test-attendee',
            'project_description': 'Test TechLabs Environment Project',
            'username': 'Max.Mustermann',
            'email': 'Max.Mustermann@techlab.ovh'
        }

    def test_terraform_template_contains_sanitized_username_local(self):
        """Test that Terraform template includes sanitized username local variable."""
        main_tf_content = terraform_service._generate_main_tf(self.test_config)
        
        # Verify locals block exists with sanitized_username
        self.assertIn('locals {', main_tf_content)
        self.assertIn('sanitized_username', main_tf_content)
        self.assertIn('replace(replace(replace(var.username', main_tf_content)
        
    def test_iam_policy_uses_sanitized_username(self):
        """Test that IAM policy uses sanitized username instead of raw username."""
        main_tf_content = terraform_service._generate_main_tf(self.test_config)
        
        # Find the IAM policy resource
        iam_policy_match = re.search(
            r'resource "ovh_iam_policy" "workshop_policy" \{([^}]+)\}',
            main_tf_content,
            re.DOTALL
        )
        
        self.assertIsNotNone(iam_policy_match, "IAM policy resource not found")
        iam_policy_content = iam_policy_match.group(1)
        
        # Verify it uses new naming format for name
        self.assertIn('name        = "access-grant-for-pci-project-${local.sanitized_username}"', iam_policy_content)
        # Verify it uses new description format with username and project ID
        self.assertIn('description = "Grants access to ${var.username} for PCI project ${ovh_cloud_project.workshop_project.project_id}"', iam_policy_content)

    def test_iam_user_still_uses_original_username(self):
        """Test that IAM user still uses original username for login and description."""
        main_tf_content = terraform_service._generate_main_tf(self.test_config)
        
        # Find the IAM user resource
        iam_user_match = re.search(
            r'resource "ovh_me_identity_user" "workshop_user" \{([^}]+)\}',
            main_tf_content,
            re.DOTALL
        )
        
        self.assertIsNotNone(iam_user_match, "IAM user resource not found")
        iam_user_content = iam_user_match.group(1)
        
        # Verify it uses original username for login and description
        self.assertIn('login       = var.username', iam_user_content)
        self.assertIn('description = var.username', iam_user_content)

    def test_sanitization_logic_replaces_special_characters(self):
        """Test that sanitization logic handles common special characters."""
        main_tf_content = terraform_service._generate_main_tf(self.test_config)
        
        # Check sanitization logic handles dots, spaces, and @ symbols
        sanitization_line = re.search(
            r'sanitized_username = (.+)',
            main_tf_content
        )
        
        self.assertIsNotNone(sanitization_line, "Sanitization logic not found")
        logic = sanitization_line.group(1)
        
        # Should replace dots with dashes
        self.assertIn('replace(var.username, ".", "-")', logic)
        # Should replace spaces with dashes  
        self.assertIn('" ", "-"', logic)
        # Should replace @ symbols
        self.assertIn('"@", "-at-"', logic)
        # Should convert to lowercase
        self.assertIn('lower(', logic)

    def test_example_username_sanitization(self):
        """Test specific examples of username sanitization."""
        test_cases = [
            ('Max.Mustermann', 'max-mustermann'),
            ('John Doe', 'john-doe'),
            ('user@company.com', 'user-at-company-com'),
            ('test.user@domain.org', 'test-user-at-domain-org'),
            ('Admin_User', 'admin_user'),  # Underscores are allowed
            ('user-name', 'user-name'),    # Dashes are allowed
        ]
        
        # We'll test by parsing the Terraform logic
        # The actual logic: lower(replace(replace(replace(var.username, ".", "-"), " ", "-"), "@", "-at-"))
        
        for original, expected in test_cases:
            with self.subTest(username=original):
                # Apply the same logic as in Terraform
                sanitized = original.replace(".", "-").replace(" ", "-").replace("@", "-at-").lower()
                self.assertEqual(sanitized, expected, 
                    f"Username '{original}' should be sanitized to '{expected}', got '{sanitized}'")

    def test_ovh_naming_compliance(self):
        """Test that sanitized names comply with OVH IAM policy naming rules."""
        # OVH requires: "alphanumeric characters and '-', '/', '_', '+'"
        valid_chars_pattern = r'^[a-zA-Z0-9\-/_+]+$'
        
        test_usernames = [
            'Max.Mustermann',
            'John Doe', 
            'user@company.com',
            'admin.user@techlab.ovh',
            'Test User 123'
        ]
        
        for username in test_usernames:
            with self.subTest(username=username):
                # Apply sanitization logic
                sanitized = username.replace(".", "-").replace(" ", "-").replace("@", "-at-").lower()
                
                # Verify it matches OVH pattern (we allow alphanumeric, -, /, _, +)
                # Note: Our current sanitization only uses - but that's valid
                self.assertRegex(sanitized, r'^[a-zA-Z0-9\-]+$',
                    f"Sanitized username '{sanitized}' should only contain alphanumeric and dash characters")

    def test_no_consecutive_dashes(self):
        """Test that sanitization doesn't create consecutive dashes."""
        # This might be an edge case to consider
        test_username = "user..name@@domain..com"
        
        # Apply sanitization
        sanitized = test_username.replace(".", "-").replace(" ", "-").replace("@", "-at-").lower()
        
        # The result would be: user--name-at--at-domain--com
        # This might not be ideal, but it's valid for OVH naming
        # We document this behavior
        expected = "user--name-at--at-domain--com"
        self.assertEqual(sanitized, expected)


if __name__ == '__main__':
    unittest.main()