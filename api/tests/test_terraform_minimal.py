#!/usr/bin/env python3
import os
import tempfile
import subprocess
from pathlib import Path

def test_minimal_terraform():
    """Test minimal OVH Terraform setup"""
    
    print("Testing minimal Terraform configuration...")
    
    # Create test directory
    with tempfile.TemporaryDirectory() as tmpdir:
        workspace = Path(tmpdir)
        
        # Write minimal main.tf
        main_tf = workspace / "main.tf"
        main_tf.write_text('''
terraform {
  required_providers {
    ovh = {
      source = "ovh/ovh"
    }
  }
}

provider "ovh" {
  endpoint = "ovh-eu"
}

# Test connection - get account info
data "ovh_me" "test" {}

output "account" {
  value = data.ovh_me.test.nichandle
}
''')
        
        # Set up environment
        env = os.environ.copy()
        
        # Ensure OVH credentials are in environment
        required_vars = ['OVH_ENDPOINT', 'OVH_APPLICATION_KEY', 'OVH_APPLICATION_SECRET', 'OVH_CONSUMER_KEY']
        missing_vars = [var for var in required_vars if not env.get(var)]
        
        if missing_vars:
            print(f"❌ Missing environment variables: {missing_vars}")
            return False
        
        print("✅ All required environment variables present")
        
        # Run terraform init
        print("\nRunning terraform init...")
        result = subprocess.run(
            ["terraform", "init"],
            cwd=workspace,
            capture_output=True,
            text=True,
            env=env
        )
        
        if result.returncode != 0:
            print(f"❌ Terraform init failed:")
            print(f"STDOUT:\n{result.stdout}")
            print(f"STDERR:\n{result.stderr}")
            return False
            
        print("✅ Terraform init successful")
        
        # Run terraform plan
        print("\nRunning terraform plan...")
        result = subprocess.run(
            ["terraform", "plan"],
            cwd=workspace,
            capture_output=True,
            text=True,
            env=env
        )
        
        if result.returncode != 0:
            print(f"❌ Terraform plan failed:")
            print(f"STDOUT:\n{result.stdout}")
            print(f"STDERR:\n{result.stderr}")
            # This will show the exact authentication error
            return False
            
        print("✅ Terraform plan successful")
        print(f"Plan output:\n{result.stdout}")
        return True

def check_ovh_credentials():
    """Check OVH credentials in environment"""
    print("Checking OVH Credentials in environment:")
    print(f"OVH_ENDPOINT: {os.getenv('OVH_ENDPOINT', 'NOT SET')}")
    print(f"OVH_APPLICATION_KEY: {'SET' if os.getenv('OVH_APPLICATION_KEY') else 'NOT SET'}")
    print(f"OVH_APPLICATION_SECRET: {'SET' if os.getenv('OVH_APPLICATION_SECRET') else 'NOT SET'}")
    print(f"OVH_CONSUMER_KEY: {'SET' if os.getenv('OVH_CONSUMER_KEY') else 'NOT SET'}")
    
    # Show sanitized values
    if os.getenv('OVH_APPLICATION_KEY'):
        print(f"OVH_APPLICATION_KEY value: {os.getenv('OVH_APPLICATION_KEY')[:8]}...")
    if os.getenv('OVH_APPLICATION_SECRET'):
        print(f"OVH_APPLICATION_SECRET value: {os.getenv('OVH_APPLICATION_SECRET')[:8]}...")
    if os.getenv('OVH_CONSUMER_KEY'):
        print(f"OVH_CONSUMER_KEY value: {os.getenv('OVH_CONSUMER_KEY')[:8]}...")

def test_terraform_binary():
    """Test that terraform binary is available"""
    print("\nTesting Terraform binary availability...")
    
    try:
        result = subprocess.run(
            ["terraform", "version"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print("✅ Terraform binary is available")
            print(f"Version: {result.stdout.strip()}")
            return True
        else:
            print("❌ Terraform binary failed to run")
            print(f"Error: {result.stderr}")
            return False
    except FileNotFoundError:
        print("❌ Terraform binary not found in PATH")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("TechLabs Automation - Terraform Minimal Test")
    print("=" * 60)
    
    check_ovh_credentials()
    
    terraform_available = test_terraform_binary()
    if not terraform_available:
        print("\n❌ Cannot proceed - Terraform binary not available")
        exit(1)
    
    success = test_minimal_terraform()
    
    print("\n" + "=" * 60)
    print(f"RESULT: {'✅ SUCCESS' if success else '❌ FAILED'}")
    
    if not success:
        print("\nTo debug:")
        print("1. Check that OVH credentials are valid")
        print("2. Verify API keys have correct permissions")
        print("3. Check OVH API status")
    
    exit(0 if success else 1)