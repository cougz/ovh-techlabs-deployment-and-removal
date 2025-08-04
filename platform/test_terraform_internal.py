#!/usr/bin/env python3
"""
Internal test script to run inside the API container to test Terraform functionality.
This bypasses network issues and tests the Terraform service directly.
"""

import os
import sys
import asyncio
from datetime import datetime, timedelta
from uuid import UUID

# Add the API directory to Python path
sys.path.append('/app')

from sqlalchemy.orm import Session
from core.database import SessionLocal
from models.workshop import Workshop
from models.attendee import Attendee
from models.deployment_log import DeploymentLog
from services.terraform_service import terraform_service
from tasks.terraform_tasks import deploy_attendee_resources, destroy_attendee_resources

def create_test_attendees(workshop_id: str, db: Session):
    """Create test attendees for the workshop."""
    print(f"🧪 Creating test attendees for workshop {workshop_id}")
    
    test_attendees = [
        {"username": "alice.test", "email": "alice.test@example.com"},
        {"username": "bob.test", "email": "bob.test@example.com"}
    ]
    
    created_attendees = []
    for attendee_data in test_attendees:
        # Check if attendee already exists
        existing = db.query(Attendee).filter(
            Attendee.workshop_id == UUID(workshop_id),
            Attendee.username == attendee_data["username"]
        ).first()
        
        if existing:
            print(f"   ✅ Attendee {attendee_data['username']} already exists (ID: {existing.id})")
            created_attendees.append(existing)
        else:
            attendee = Attendee(
                workshop_id=UUID(workshop_id),
                username=attendee_data["username"],
                email=attendee_data["email"],
                status="pending"
            )
            db.add(attendee)
            db.commit()
            db.refresh(attendee)
            created_attendees.append(attendee)
            print(f"   ✅ Created attendee {attendee_data['username']} (ID: {attendee.id})")
    
    return created_attendees

def test_terraform_service_directly():
    """Test the Terraform service directly without OVH to verify it works."""
    print(f"\n🔧 Testing Terraform service directly...")
    
    # Create a simple test workspace
    workspace_name = "test-workspace"
    config = {
        "project_description": "Test Project",
        "username": "test-user"
    }
    
    print(f"   📁 Creating workspace: {workspace_name}")
    success = terraform_service.create_workspace(workspace_name, config)
    
    if success:
        print(f"   ✅ Workspace created successfully")
        
        # Check if files were created
        workspace_path = terraform_service._get_workspace_path(workspace_name)
        print(f"   📍 Workspace path: {workspace_path}")
        
        if workspace_path.exists():
            files = list(workspace_path.glob("*"))
            print(f"   📄 Files created: {[f.name for f in files]}")
            
            # Read main.tf to verify content
            main_tf = workspace_path / "main.tf"
            if main_tf.exists():
                print(f"   📝 main.tf content preview:")
                with open(main_tf, 'r') as f:
                    lines = f.readlines()[:10]  # First 10 lines
                    for i, line in enumerate(lines, 1):
                        print(f"      {i:2d}: {line.rstrip()}")
                    if len(lines) == 10:
                        print(f"      ... (truncated)")
        
        # Cleanup test workspace
        print(f"   🧹 Cleaning up test workspace...")
        terraform_service.cleanup_workspace(workspace_name)
        print(f"   ✅ Test workspace cleaned up")
        
        return True
    else:
        print(f"   ❌ Failed to create workspace")
        return False

def test_deployment_workflow(workshop_id: str):
    """Test the complete deployment workflow."""
    print(f"\n🚀 Testing deployment workflow for workshop {workshop_id}")
    
    db = SessionLocal()
    try:
        # Get workshop
        workshop = db.query(Workshop).filter(Workshop.id == UUID(workshop_id)).first()
        if not workshop:
            print(f"   ❌ Workshop {workshop_id} not found")
            return False
        
        print(f"   📋 Workshop: {workshop.name} (Status: {workshop.status})")
        
        # Create test attendees if none exist
        attendees = db.query(Attendee).filter(Attendee.workshop_id == UUID(workshop_id)).all()
        if not attendees:
            attendees = create_test_attendees(workshop_id, db)
        else:
            print(f"   👥 Found {len(attendees)} existing attendees")
        
        if not attendees:
            print(f"   ❌ No attendees available for testing")
            return False
        
        # Test deployment for one attendee
        test_attendee = attendees[0]
        print(f"\n   🎯 Testing deployment for attendee: {test_attendee.username} (ID: {test_attendee.id})")
        
        # Update workshop status to deploying
        workshop.status = "deploying"
        db.commit()
        
        # Test the deployment task
        print(f"   ⚙️ Running deployment task...")
        result = deploy_attendee_resources(str(test_attendee.id))
        
        print(f"   📊 Deployment result: {result}")
        
        # Refresh attendee to see updated status
        db.refresh(test_attendee)
        print(f"   📈 Attendee status after deployment: {test_attendee.status}")
        
        if test_attendee.ovh_project_id:
            print(f"   🎉 OVH Project ID: {test_attendee.ovh_project_id}")
        if test_attendee.ovh_user_urn:
            print(f"   🎉 OVH User URN: {test_attendee.ovh_user_urn}")
        
        # Get deployment logs
        logs = db.query(DeploymentLog).filter(DeploymentLog.attendee_id == test_attendee.id).all()
        print(f"   📜 Deployment logs ({len(logs)} entries):")
        for log in logs[-3:]:  # Show last 3 logs
            print(f"      {log.started_at}: {log.action} - {log.status}")
            if log.error_message:
                print(f"         Error: {log.error_message}")
        
        return result.get('success', False) if isinstance(result, dict) else False
        
    except Exception as e:
        print(f"   ❌ Error during deployment test: {e}")
        return False
    finally:
        db.close()

def main():
    """Main test function."""
    print("🔬 TechLabs Automation - Internal Terraform Test")
    print("=" * 60)
    
    # Workshop ID that was created through the frontend
    workshop_id = "480b4c78-5e36-4def-a0ce-db73d2d93f2d"
    
    # Test 1: Terraform service directly
    print(f"\n🧪 Test 1: Terraform Service Direct Test")
    terraform_test_success = test_terraform_service_directly()
    
    # Test 2: Full deployment workflow
    print(f"\n🧪 Test 2: Full Deployment Workflow Test")
    deployment_test_success = test_deployment_workflow(workshop_id)
    
    # Summary
    print(f"\n📊 Test Results Summary:")
    print(f"   Terraform Service Test: {'✅ PASS' if terraform_test_success else '❌ FAIL'}")
    print(f"   Deployment Workflow Test: {'✅ PASS' if deployment_test_success else '❌ FAIL'}")
    
    if terraform_test_success and deployment_test_success:
        print(f"\n🎉 All tests passed! Terraform functionality is working correctly.")
        print(f"\n💡 Next steps:")
        print(f"   1. Add attendees through the web interface")
        print(f"   2. Click 'Deploy Workshop' to start Terraform deployment")
        print(f"   3. Monitor progress in the workshop detail page")
    else:
        print(f"\n⚠️ Some tests failed. Check the logs above for details.")
        print(f"\n🔍 Troubleshooting:")
        if not terraform_test_success:
            print(f"   - Check Terraform installation: terraform version")
            print(f"   - Check workspace directory permissions: /tmp/terraform-workspaces")
        if not deployment_test_success:
            print(f"   - Check OVH credentials in environment variables")
            print(f"   - Check Celery worker is running")
            print(f"   - Check database connectivity")
    
    return 0 if (terraform_test_success and deployment_test_success) else 1

if __name__ == "__main__":
    sys.exit(main())