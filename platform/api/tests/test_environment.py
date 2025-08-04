#!/usr/bin/env python3
import os
import sys
sys.path.append('/app')

from core.config import settings

def test_environment():
    """Test that all OVH credentials are loaded from .env"""
    print("Testing environment configuration...")
    
    # Check settings object
    print(f"OVH_ENDPOINT: {settings.OVH_ENDPOINT}")
    print(f"OVH_APPLICATION_KEY exists: {bool(settings.OVH_APPLICATION_KEY)}")
    print(f"OVH_APPLICATION_KEY length: {len(settings.OVH_APPLICATION_KEY) if settings.OVH_APPLICATION_KEY else 0}")
    print(f"OVH_APPLICATION_SECRET exists: {bool(settings.OVH_APPLICATION_SECRET)}")
    print(f"OVH_CONSUMER_KEY exists: {bool(settings.OVH_CONSUMER_KEY)}")
    
    # Check OS environment
    print("\nOS Environment:")
    print(f"OVH_APPLICATION_KEY in env: {'OVH_APPLICATION_KEY' in os.environ}")
    print(f"OVH_APPLICATION_SECRET in env: {'OVH_APPLICATION_SECRET' in os.environ}")
    print(f"OVH_CONSUMER_KEY in env: {'OVH_CONSUMER_KEY' in os.environ}")
    print(f"OVH_ENDPOINT in env: {'OVH_ENDPOINT' in os.environ}")
    
    # Show actual values (sanitized)
    if 'OVH_APPLICATION_KEY' in os.environ:
        print(f"OVH_APPLICATION_KEY value: {os.environ['OVH_APPLICATION_KEY'][:8]}...")
    if 'OVH_APPLICATION_SECRET' in os.environ:
        print(f"OVH_APPLICATION_SECRET value: {os.environ['OVH_APPLICATION_SECRET'][:8]}...")
    if 'OVH_CONSUMER_KEY' in os.environ:
        print(f"OVH_CONSUMER_KEY value: {os.environ['OVH_CONSUMER_KEY'][:8]}...")
    
    # Test validation
    missing_vars = []
    if not settings.OVH_ENDPOINT:
        missing_vars.append('OVH_ENDPOINT')
    if not settings.OVH_APPLICATION_KEY:
        missing_vars.append('OVH_APPLICATION_KEY')
    if not settings.OVH_APPLICATION_SECRET:
        missing_vars.append('OVH_APPLICATION_SECRET')
    if not settings.OVH_CONSUMER_KEY:
        missing_vars.append('OVH_CONSUMER_KEY')
    
    if missing_vars:
        print(f"\n❌ Missing required OVH variables: {missing_vars}")
        return False
    else:
        print("\n✅ All OVH variables are present")
        return True

def test_terraform_config():
    """Test Terraform configuration"""
    print("\nTesting Terraform configuration...")
    print(f"TERRAFORM_BINARY_PATH: {settings.TERRAFORM_BINARY_PATH}")
    print(f"TERRAFORM_WORKSPACE_DIR: {settings.TERRAFORM_WORKSPACE_DIR}")
    
    # Check if terraform binary exists
    terraform_exists = os.path.exists(settings.TERRAFORM_BINARY_PATH)
    print(f"Terraform binary exists: {terraform_exists}")
    
    # Check if workspace directory exists and is writable
    workspace_dir = settings.TERRAFORM_WORKSPACE_DIR
    workspace_exists = os.path.exists(workspace_dir)
    workspace_writable = os.access(workspace_dir, os.W_OK) if workspace_exists else False
    
    print(f"Workspace directory exists: {workspace_exists}")
    print(f"Workspace directory writable: {workspace_writable}")
    
    return terraform_exists and workspace_exists and workspace_writable

if __name__ == "__main__":
    print("=" * 60)
    print("TechLabs Automation - Environment Test")
    print("=" * 60)
    
    env_ok = test_environment()
    terraform_ok = test_terraform_config()
    
    print("\n" + "=" * 60)
    print("SUMMARY:")
    print(f"Environment: {'✅ PASS' if env_ok else '❌ FAIL'}")
    print(f"Terraform:   {'✅ PASS' if terraform_ok else '❌ FAIL'}")
    
    print("\nTo test inside containers:")
    print("docker exec -it techlabs-api-prod python /app/tests/test_environment.py")
    print("docker exec -it techlabs-celery-worker-prod python /app/tests/test_environment.py")
    
    sys.exit(0 if env_ok and terraform_ok else 1)