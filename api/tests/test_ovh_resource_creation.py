#!/usr/bin/env python3
"""
Comprehensive test suite for OVH resource creation with detailed logging
"""
import os
import sys
import json
import tempfile
import subprocess
import time
from pathlib import Path
from datetime import datetime

sys.path.append('/app')

def log_with_timestamp(message, level="INFO"):
    """Print log message with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    print(f"[{timestamp}] [{level}] {message}")

def test_ovh_api_connection():
    """Test direct OVH API connection using Python client"""
    log_with_timestamp("Testing OVH API connection...", "INFO")
    
    try:
        import ovh
        
        # Get credentials from environment
        endpoint = os.getenv('OVH_ENDPOINT', 'ovh-eu')
        app_key = os.getenv('OVH_APPLICATION_KEY')
        app_secret = os.getenv('OVH_APPLICATION_SECRET')
        consumer_key = os.getenv('OVH_CONSUMER_KEY')
        
        if not all([app_key, app_secret, consumer_key]):
            log_with_timestamp("Missing OVH credentials in environment", "ERROR")
            return False
        
        log_with_timestamp(f"Using endpoint: {endpoint}", "DEBUG")
        log_with_timestamp(f"App key: {app_key[:8]}...", "DEBUG")
        
        # Create OVH client
        client = ovh.Client(
            endpoint=endpoint,
            application_key=app_key,
            application_secret=app_secret,
            consumer_key=consumer_key
        )
        
        # Test API connection
        log_with_timestamp("Attempting to get account information...", "INFO")
        me = client.get('/me')
        log_with_timestamp(f"Successfully connected to OVH API. Account: {me.get('nichandle', 'Unknown')}", "SUCCESS")
        
        # Get cloud projects
        log_with_timestamp("Fetching cloud projects...", "INFO")
        projects = client.get('/cloud/project')
        log_with_timestamp(f"Found {len(projects)} cloud projects", "INFO")
        
        return True
        
    except ImportError:
        log_with_timestamp("OVH Python client not installed. Install with: pip install ovh", "ERROR")
        return False
    except Exception as e:
        log_with_timestamp(f"OVH API connection failed: {str(e)}", "ERROR")
        return False

def test_terraform_with_detailed_logging():
    """Test Terraform with detailed logging of all operations"""
    log_with_timestamp("Starting Terraform test with detailed logging...", "INFO")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        workspace = Path(tmpdir)
        log_with_timestamp(f"Created temporary workspace: {workspace}", "DEBUG")
        
        # Create main.tf with debugging
        main_tf_content = '''
terraform {
  required_providers {
    ovh = {
      source  = "ovh/ovh"
      version = "~> 0.35"
    }
  }
}

provider "ovh" {
  endpoint = var.ovh_endpoint
}

variable "ovh_endpoint" {
  default = "ovh-eu"
}

# Test data source to verify connection
data "ovh_me" "current_account" {}

# Output account info
output "account_info" {
  value = {
    nichandle = data.ovh_me.current_account.nichandle
    email     = data.ovh_me.current_account.email
    state     = data.ovh_me.current_account.state
  }
}

# List cloud projects
data "ovh_cloud_projects" "projects" {}

output "cloud_projects" {
  value = data.ovh_cloud_projects.projects.project_ids
}
'''
        
        main_tf = workspace / "main.tf"
        main_tf.write_text(main_tf_content)
        log_with_timestamp("Created main.tf configuration", "INFO")
        
        # Set up environment with debugging
        env = os.environ.copy()
        env['TF_LOG'] = 'DEBUG'  # Enable Terraform debug logging
        env['TF_LOG_PATH'] = str(workspace / 'terraform.log')
        
        # Log environment variables (sanitized)
        log_with_timestamp("Environment variables:", "DEBUG")
        for var in ['OVH_ENDPOINT', 'OVH_APPLICATION_KEY', 'OVH_APPLICATION_SECRET', 'OVH_CONSUMER_KEY']:
            value = env.get(var, 'NOT SET')
            if value != 'NOT SET' and var != 'OVH_ENDPOINT':
                value = f"{value[:8]}..."
            log_with_timestamp(f"  {var}: {value}", "DEBUG")
        
        # Initialize Terraform
        log_with_timestamp("Running terraform init...", "INFO")
        init_result = subprocess.run(
            ["terraform", "init"],
            cwd=workspace,
            capture_output=True,
            text=True,
            env=env
        )
        
        if init_result.returncode != 0:
            log_with_timestamp("Terraform init failed", "ERROR")
            log_with_timestamp(f"STDOUT:\n{init_result.stdout}", "ERROR")
            log_with_timestamp(f"STDERR:\n{init_result.stderr}", "ERROR")
            
            # Read debug log
            debug_log_path = workspace / 'terraform.log'
            if debug_log_path.exists():
                log_with_timestamp("Terraform debug log:", "DEBUG")
                debug_log = debug_log_path.read_text()
                # Extract relevant error messages
                for line in debug_log.split('\n'):
                    if 'error' in line.lower() or 'fail' in line.lower():
                        log_with_timestamp(f"  {line}", "DEBUG")
            
            return False
        
        log_with_timestamp("Terraform init successful", "SUCCESS")
        
        # Run terraform plan with detailed output
        log_with_timestamp("Running terraform plan...", "INFO")
        plan_result = subprocess.run(
            ["terraform", "plan", "-detailed-exitcode", "-out=tfplan"],
            cwd=workspace,
            capture_output=True,
            text=True,
            env=env
        )
        
        if plan_result.returncode not in [0, 2]:  # 0 = no changes, 2 = changes
            log_with_timestamp("Terraform plan failed", "ERROR")
            log_with_timestamp(f"Exit code: {plan_result.returncode}", "ERROR")
            log_with_timestamp(f"STDOUT:\n{plan_result.stdout}", "ERROR")
            log_with_timestamp(f"STDERR:\n{plan_result.stderr}", "ERROR")
            
            # Read debug log for more details
            debug_log_path = workspace / 'terraform.log'
            if debug_log_path.exists():
                log_with_timestamp("Checking Terraform debug log for details...", "DEBUG")
                debug_log = debug_log_path.read_text()
                # Look for specific error patterns
                error_patterns = [
                    "Invalid authentication",
                    "Forbidden",
                    "401",
                    "403",
                    "connection refused",
                    "timeout"
                ]
                for line in debug_log.split('\n')[-100:]:  # Last 100 lines
                    for pattern in error_patterns:
                        if pattern.lower() in line.lower():
                            log_with_timestamp(f"Found error: {line}", "ERROR")
            
            return False
        
        log_with_timestamp("Terraform plan successful", "SUCCESS")
        
        # Apply the plan
        log_with_timestamp("Running terraform apply...", "INFO")
        apply_result = subprocess.run(
            ["terraform", "apply", "-auto-approve", "tfplan"],
            cwd=workspace,
            capture_output=True,
            text=True,
            env=env
        )
        
        if apply_result.returncode != 0:
            log_with_timestamp("Terraform apply failed", "ERROR")
            log_with_timestamp(f"STDOUT:\n{apply_result.stdout}", "ERROR")
            log_with_timestamp(f"STDERR:\n{apply_result.stderr}", "ERROR")
            return False
        
        log_with_timestamp("Terraform apply successful", "SUCCESS")
        
        # Get outputs
        log_with_timestamp("Getting Terraform outputs...", "INFO")
        output_result = subprocess.run(
            ["terraform", "output", "-json"],
            cwd=workspace,
            capture_output=True,
            text=True,
            env=env
        )
        
        if output_result.returncode == 0:
            outputs = json.loads(output_result.stdout)
            log_with_timestamp("Terraform outputs:", "INFO")
            for key, value in outputs.items():
                log_with_timestamp(f"  {key}: {json.dumps(value.get('value', 'N/A'))}", "INFO")
        
        # Clean up
        log_with_timestamp("Running terraform destroy...", "INFO")
        destroy_result = subprocess.run(
            ["terraform", "destroy", "-auto-approve"],
            cwd=workspace,
            capture_output=True,
            text=True,
            env=env
        )
        
        if destroy_result.returncode == 0:
            log_with_timestamp("Cleanup successful", "SUCCESS")
        else:
            log_with_timestamp("Cleanup failed (non-critical)", "WARNING")
        
        return True

def test_project_creation():
    """Test creating an actual OVH cloud project"""
    log_with_timestamp("Testing OVH cloud project creation...", "INFO")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        workspace = Path(tmpdir)
        
        # Create Terraform config for project creation
        main_tf_content = '''
terraform {
  required_providers {
    ovh = {
      source  = "ovh/ovh"
      version = "~> 0.35"
    }
  }
}

provider "ovh" {
  endpoint = "ovh-eu"
}

# Create a test project
resource "ovh_cloud_project" "test_project" {
  description = "TechLabs Test Project - DELETE ME"
  plan        = "discovery"
}

output "project_id" {
  value = ovh_cloud_project.test_project.project_id
}

output "project_status" {
  value = ovh_cloud_project.test_project.status
}
'''
        
        main_tf = workspace / "main.tf"
        main_tf.write_text(main_tf_content)
        
        env = os.environ.copy()
        env['TF_LOG'] = 'INFO'
        
        # Init
        log_with_timestamp("Initializing Terraform for project creation...", "INFO")
        init_result = subprocess.run(
            ["terraform", "init"],
            cwd=workspace,
            capture_output=True,
            text=True,
            env=env
        )
        
        if init_result.returncode != 0:
            log_with_timestamp("Init failed", "ERROR")
            log_with_timestamp(init_result.stderr, "ERROR")
            return False
        
        # Plan
        log_with_timestamp("Planning project creation...", "INFO")
        plan_result = subprocess.run(
            ["terraform", "plan", "-out=tfplan"],
            cwd=workspace,
            capture_output=True,
            text=True,
            env=env
        )
        
        if plan_result.returncode != 0:
            log_with_timestamp("Plan failed", "ERROR")
            log_with_timestamp(plan_result.stderr, "ERROR")
            return False
        
        # Show what will be created
        show_result = subprocess.run(
            ["terraform", "show", "tfplan"],
            cwd=workspace,
            capture_output=True,
            text=True,
            env=env
        )
        
        if show_result.returncode == 0:
            log_with_timestamp("Resources to be created:", "INFO")
            for line in show_result.stdout.split('\n'):
                if 'ovh_cloud_project' in line or 'description' in line or 'plan' in line:
                    log_with_timestamp(f"  {line.strip()}", "INFO")
        
        # Apply with monitoring
        log_with_timestamp("Creating project (this may take a few minutes)...", "INFO")
        start_time = time.time()
        
        apply_process = subprocess.Popen(
            ["terraform", "apply", "-auto-approve", "tfplan"],
            cwd=workspace,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        
        # Monitor output in real-time
        while True:
            output = apply_process.stdout.readline()
            if output:
                log_with_timestamp(f"Terraform: {output.strip()}", "DEBUG")
            
            if apply_process.poll() is not None:
                break
        
        elapsed = time.time() - start_time
        log_with_timestamp(f"Apply completed in {elapsed:.2f} seconds", "INFO")
        
        if apply_process.returncode != 0:
            stderr = apply_process.stderr.read()
            log_with_timestamp("Project creation failed", "ERROR")
            log_with_timestamp(stderr, "ERROR")
            
            # Check for specific error patterns
            if "network" in stderr.lower() or "connection" in stderr.lower():
                log_with_timestamp("Network connectivity issue detected", "ERROR")
            elif "forbidden" in stderr.lower() or "401" in stderr:
                log_with_timestamp("Authentication/Authorization issue detected", "ERROR")
            elif "quota" in stderr.lower():
                log_with_timestamp("Quota limit issue detected", "ERROR")
            
            return False
        
        log_with_timestamp("Project created successfully!", "SUCCESS")
        
        # Get outputs
        output_result = subprocess.run(
            ["terraform", "output", "-json"],
            cwd=workspace,
            capture_output=True,
            text=True,
            env=env
        )
        
        if output_result.returncode == 0:
            outputs = json.loads(output_result.stdout)
            project_id = outputs.get('project_id', {}).get('value', 'Unknown')
            log_with_timestamp(f"Created project ID: {project_id}", "SUCCESS")
        
        # Destroy
        log_with_timestamp("Cleaning up test project...", "INFO")
        destroy_result = subprocess.run(
            ["terraform", "destroy", "-auto-approve"],
            cwd=workspace,
            capture_output=True,
            text=True,
            env=env
        )
        
        if destroy_result.returncode == 0:
            log_with_timestamp("Test project cleaned up", "SUCCESS")
        else:
            log_with_timestamp("Failed to clean up test project - manual cleanup required", "WARNING")
        
        return True

def main():
    """Run all tests"""
    print("=" * 80)
    print("OVH Resource Creation Test Suite")
    print("=" * 80)
    
    tests = [
        ("OVH API Connection", test_ovh_api_connection),
        ("Terraform Detailed Test", test_terraform_with_detailed_logging),
        ("Project Creation Test", test_project_creation)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{'=' * 60}")
        print(f"Running: {test_name}")
        print('=' * 60)
        
        try:
            success = test_func()
            results.append((test_name, success))
        except Exception as e:
            log_with_timestamp(f"Test crashed: {str(e)}", "ERROR")
            results.append((test_name, False))
        
        print()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    all_passed = True
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{test_name:<40} {status}")
        if not success:
            all_passed = False
    
    print("\n" + "=" * 80)
    print(f"OVERALL RESULT: {'✅ ALL TESTS PASSED' if all_passed else '❌ SOME TESTS FAILED'}")
    
    if not all_passed:
        print("\nDEBUGGING STEPS:")
        print("1. Check OVH credentials are valid")
        print("2. Verify account has permissions to create cloud projects")
        print("3. Check if there are any network restrictions on the OVH account")
        print("4. Review OVH API logs in the OVH control panel")
        print("5. Try creating a project manually in OVH control panel to verify account status")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())