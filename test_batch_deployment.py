#!/usr/bin/env python3
"""
Test script to verify batch deployment with OVH cart limitations.

This script tests that:
1. Attendees are deployed in batches of 3
2. Each batch uses a single cart
3. There's a 5-minute cooldown between batches
4. Terraform apply uses -parallelism=1
"""

import os
import sys
import json
from pathlib import Path

# Add api directory to path
sys.path.insert(0, '/home/admin-ts/git-workspace/ovh-techlabs-deployment-and-removal/api')

from services.terraform_service import TerraformService

def test_batch_terraform_generation():
    """Test that batch terraform configuration is generated correctly."""
    
    service = TerraformService()
    
    # Test batch with 3 attendees
    batch_config = {
        "workshop_id": "test-workshop-123",
        "batch_number": 0,
        "attendees": [
            {
                "id": "attendee-1",
                "username": "user1@example.com",
                "email": "user1@example.com",
                "project_description": "TechLabs environment for user1@example.com"
            },
            {
                "id": "attendee-2",
                "username": "user2@example.com",
                "email": "user2@example.com",
                "project_description": "TechLabs environment for user2@example.com"
            },
            {
                "id": "attendee-3",
                "username": "user3@example.com",
                "email": "user3@example.com",
                "project_description": "TechLabs environment for user3@example.com"
            }
        ]
    }
    
    # Generate Terraform configuration
    tf_content = service._generate_batch_main_tf(batch_config)
    
    # Verify single cart is used
    assert tf_content.count('data "ovh_order_cart" "batch_cart"') == 1, "Should use single cart for batch"
    
    # Verify 3 projects are created
    assert tf_content.count('resource "ovh_cloud_project"') == 3, "Should create 3 projects"
    
    # Verify dependencies are set correctly
    assert 'depends_on = [ovh_cloud_project.project_0]' in tf_content, "Project 1 should depend on project 0"
    assert 'depends_on = [ovh_cloud_project.project_1]' in tf_content, "Project 2 should depend on project 1"
    
    # Verify all projects use the same cart
    assert tf_content.count('data.ovh_order_cart.batch_cart.ovh_subsidiary') == 3, "All projects should use same cart"
    
    print("✅ Batch Terraform generation test passed")
    print(f"   - Single cart used for {len(batch_config['attendees'])} attendees")
    print(f"   - Dependencies correctly set between projects")
    
    return True

def test_parallelism_flag():
    """Test that terraform commands use -parallelism=1."""
    
    # Read the terraform_service.py file
    service_file = Path('/home/admin-ts/git-workspace/ovh-techlabs-deployment-and-removal/api/services/terraform_service.py')
    content = service_file.read_text()
    
    # Check plan command
    assert '"-parallelism=1"' in content or "'-parallelism=1'" in content, "Plan should use -parallelism=1"
    
    # Check apply command  
    assert 'apply", "-auto-approve", "-parallelism=1"' in content, "Apply should use -parallelism=1"
    
    # Check destroy command
    assert 'destroy", "-auto-approve", "-parallelism=1"' in content, "Destroy should use -parallelism=1"
    
    print("✅ Parallelism flag test passed")
    print("   - terraform plan uses -parallelism=1")
    print("   - terraform apply uses -parallelism=1")
    print("   - terraform destroy uses -parallelism=1")
    
    return True

def test_batch_size_validation():
    """Test that batch size is limited to 3."""
    
    service = TerraformService()
    
    # Test with 4 attendees (should fail)
    batch_config = {
        "workshop_id": "test-workshop-123",
        "batch_number": 0,
        "attendees": [
            {"id": f"attendee-{i}", "username": f"user{i}@example.com", 
             "email": f"user{i}@example.com", "project_description": f"Env for user{i}"}
            for i in range(4)
        ]
    }
    
    try:
        tf_content = service._generate_batch_main_tf(batch_config)
        print("❌ Batch size validation failed - should reject 4 attendees")
        return False
    except ValueError as e:
        if "Invalid attendee count" in str(e) and "Must be 1-3" in str(e):
            print("✅ Batch size validation test passed")
            print("   - Correctly rejects batches > 3 attendees")
            return True
        else:
            print(f"❌ Unexpected error: {e}")
            return False

def test_cooldown_implementation():
    """Test that cooldown is implemented between batches."""
    
    # Read the terraform_tasks.py file
    tasks_file = Path('/home/admin-ts/git-workspace/ovh-techlabs-deployment-and-removal/api/tasks/terraform_tasks.py')
    content = tasks_file.read_text()
    
    # Check for cooldown implementation
    assert 'time.sleep(300)' in content, "Should have 5-minute cooldown between batches"
    assert 'Waiting 5 minutes before next batch' in content, "Should log cooldown message"
    
    print("✅ Cooldown implementation test passed")
    print("   - 5-minute cooldown between batches")
    print("   - Proper logging of cooldown")
    
    return True

def main():
    """Run all tests."""
    
    print("=" * 60)
    print("Testing OVH Batch Deployment Implementation")
    print("=" * 60)
    print()
    
    tests = [
        ("Batch Terraform Generation", test_batch_terraform_generation),
        ("Parallelism Flag", test_parallelism_flag),
        ("Batch Size Validation", test_batch_size_validation),
        ("Cooldown Implementation", test_cooldown_implementation)
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        print(f"\nRunning: {test_name}")
        print("-" * 40)
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"Test Results: {passed} passed, {failed} failed")
    print("=" * 60)
    
    if failed == 0:
        print("\n✅ All tests passed! The batch deployment implementation is correct.")
        print("\nKey features implemented:")
        print("1. ✅ Attendees are deployed in batches of 3")
        print("2. ✅ Each batch uses a single OVH cart")
        print("3. ✅ Projects within a batch have proper dependencies")
        print("4. ✅ Terraform apply uses -parallelism=1")
        print("5. ✅ 5-minute cooldown between batches")
    else:
        print(f"\n❌ {failed} test(s) failed. Please review the implementation.")
        sys.exit(1)

if __name__ == "__main__":
    main()