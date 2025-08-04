#!/usr/bin/env python3
"""
OVH Resource Creation Test with Comprehensive Logging
"""
import os
import sys
import json
import tempfile
import subprocess
import logging
import time
from pathlib import Path
from datetime import datetime

sys.path.append('/app')

# Create logs directory
LOGS_DIR = Path("/app/logs")
LOGS_DIR.mkdir(exist_ok=True)

# Setup comprehensive logging
def setup_logger():
    """Setup comprehensive logging system"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = LOGS_DIR / f"ovh_testing_{timestamp}.log"
    
    # Create logger
    logger = logging.getLogger('ovh_testing')
    logger.setLevel(logging.DEBUG)
    
    # Remove existing handlers
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
    
    # File handler
    file_handler = logging.FileHandler(log_file)
    file_handler.setLevel(logging.DEBUG)
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    
    # Formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger, log_file

logger, LOG_FILE_PATH = setup_logger()

def log_system_info():
    """Log system information"""
    logger.info("=" * 80)
    logger.info("SYSTEM INFORMATION")
    logger.info("=" * 80)
    
    # Environment info
    logger.info(f"Python version: {sys.version}")
    logger.info(f"Working directory: {os.getcwd()}")
    logger.info(f"Current user: {os.getenv('USER', 'unknown')}")
    
    # OVH credentials (sanitized)
    ovh_vars = ['OVH_ENDPOINT', 'OVH_APPLICATION_KEY', 'OVH_APPLICATION_SECRET', 'OVH_CONSUMER_KEY']
    for var in ovh_vars:
        value = os.getenv(var, 'NOT SET')
        if var == 'OVH_ENDPOINT':
            logger.info(f"{var}: {value}")
        else:
            if value != 'NOT SET':
                logger.info(f"{var}: {value[:8]}...{value[-4:]} (length: {len(value)})")
            else:
                logger.info(f"{var}: NOT SET")

def test_ovh_api_direct():
    """Test direct OVH API connection"""
    logger.info("\n" + "=" * 60)
    logger.info("TESTING DIRECT OVH API CONNECTION")
    logger.info("=" * 60)
    
    try:
        import ovh
        logger.info("OVH Python client imported successfully")
        
        # Create client
        client = ovh.Client(
            endpoint=os.getenv('OVH_ENDPOINT', 'ovh-eu'),
            application_key=os.getenv('OVH_APPLICATION_KEY'),
            application_secret=os.getenv('OVH_APPLICATION_SECRET'),
            consumer_key=os.getenv('OVH_CONSUMER_KEY')
        )
        logger.info("OVH client created successfully")
        
        # Test API calls
        logger.info("Attempting to get account information...")
        me = client.get('/me')
        logger.info(f"Account retrieved: {me.get('nichandle', 'Unknown')}")
        logger.info(f"Account email: {me.get('email', 'Unknown')}")
        logger.info(f"Account state: {me.get('state', 'Unknown')}")
        
        # Get projects
        logger.info("Fetching cloud projects...")
        projects = client.get('/cloud/project')
        logger.info(f"Found {len(projects)} cloud projects")
        
        for i, project_id in enumerate(projects[:3]):  # Log first 3 projects
            try:
                project_info = client.get(f'/cloud/project/{project_id}')
                logger.info(f"Project {i+1}: {project_id} - {project_info.get('description', 'No description')}")
            except Exception as e:
                logger.warning(f"Could not get details for project {project_id}: {str(e)}")
        
        return True
        
    except ImportError:
        logger.error("OVH Python client not available")
        return False
    except Exception as e:
        logger.error(f"OVH API test failed: {str(e)}")
        logger.exception("Full exception details:")
        return False

def test_terraform_resource_creation():
    """Test actual Terraform resource creation with detailed logging"""
    logger.info("\n" + "=" * 60)
    logger.info("TESTING TERRAFORM RESOURCE CREATION")
    logger.info("=" * 60)
    
    with tempfile.TemporaryDirectory() as tmpdir:
        workspace = Path(tmpdir)
        logger.info(f"Created temporary workspace: {workspace}")
        
        # Create terraform configuration for actual resource creation
        main_tf_content = '''
terraform {
  required_providers {
    ovh = {
      source  = "ovh/ovh"
      version = "~> 0.51"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "ovh" {
  endpoint = "ovh-eu"
}

provider "random" {}

# Generate unique identifier
resource "random_id" "unique" {
  byte_length = 4
}

# Create a cloud project
resource "ovh_cloud_project" "test_project" {
  ovh_subsidiary = "FR"
  description    = "TechLabs Test Project ${random_id.unique.hex}"
  
  plan {
    duration     = "P1M"
    plan_code    = "project.2018"
    pricing_mode = "default"
    
    configuration {
      label = "description"
      value = "TechLabs automated test project - created at ${timestamp()}"
    }
  }
}

# Create a user in the project
resource "ovh_cloud_project_user" "test_user" {
  service_name = ovh_cloud_project.test_project.project_id
  description  = "Test user ${random_id.unique.hex}"
  role_names   = ["compute_operator"]
}

# Output results
output "project_id" {
  value = ovh_cloud_project.test_project.project_id
}

output "project_description" {
  value = ovh_cloud_project.test_project.description
}

output "user_id" {
  value = ovh_cloud_project_user.test_user.id
}

output "user_username" {
  value = ovh_cloud_project_user.test_user.username
  sensitive = true
}

output "test_summary" {
  value = {
    project_created = ovh_cloud_project.test_project.project_id
    user_created    = ovh_cloud_project_user.test_user.username
    timestamp       = timestamp()
    unique_id       = random_id.unique.hex
  }
}
'''
        
        # Write configuration
        main_tf = workspace / "main.tf"
        main_tf.write_text(main_tf_content)
        logger.info("Terraform configuration written to main.tf")
        
        # Set up environment with debugging
        env = os.environ.copy()
        env['TF_LOG'] = 'DEBUG'
        env['TF_LOG_PATH'] = str(workspace / 'terraform_debug.log')
        
        logger.info(f"Terraform debug logging enabled: {env['TF_LOG_PATH']}")
        
        # Initialize
        logger.info("PHASE 1: Terraform Initialization")
        logger.info("-" * 40)
        
        init_result = subprocess.run(
            ["terraform", "init"],
            cwd=workspace,
            capture_output=True,
            text=True,
            env=env
        )
        
        logger.info(f"Init exit code: {init_result.returncode}")
        if init_result.stdout:
            logger.info(f"Init stdout:\n{init_result.stdout}")
        if init_result.stderr:
            logger.info(f"Init stderr:\n{init_result.stderr}")
        
        if init_result.returncode != 0:
            logger.error("Terraform init failed")
            return False
        
        # Plan
        logger.info("\nPHASE 2: Terraform Planning")
        logger.info("-" * 40)
        
        plan_result = subprocess.run(
            ["terraform", "plan", "-out=tfplan"],
            cwd=workspace,
            capture_output=True,
            text=True,
            env=env
        )
        
        logger.info(f"Plan exit code: {plan_result.returncode}")
        if plan_result.stdout:
            logger.info(f"Plan stdout:\n{plan_result.stdout}")
        if plan_result.stderr:
            logger.info(f"Plan stderr:\n{plan_result.stderr}")
        
        if plan_result.returncode != 0:
            logger.error("Terraform plan failed")
            # Log debug information
            debug_log = workspace / 'terraform_debug.log'
            if debug_log.exists():
                logger.info("Terraform debug log contents:")
                with open(debug_log, 'r') as f:
                    debug_content = f.read()
                    # Log last 50 lines
                    debug_lines = debug_content.split('\n')
                    for line in debug_lines[-50:]:
                        if line.strip():
                            logger.debug(f"TF_DEBUG: {line}")
            return False
        
        # Apply
        logger.info("\nPHASE 3: Terraform Apply (ACTUAL RESOURCE CREATION)")
        logger.info("-" * 40)
        logger.warning("⚠️  This will create REAL resources in OVH!")
        
        apply_start_time = time.time()
        
        apply_result = subprocess.run(
            ["terraform", "apply", "-auto-approve", "tfplan"],
            cwd=workspace,
            capture_output=True,
            text=True,
            env=env
        )
        
        apply_duration = time.time() - apply_start_time
        
        logger.info(f"Apply exit code: {apply_result.returncode}")
        logger.info(f"Apply duration: {apply_duration:.2f} seconds")
        
        if apply_result.stdout:
            logger.info(f"Apply stdout:\n{apply_result.stdout}")
        if apply_result.stderr:
            logger.info(f"Apply stderr:\n{apply_result.stderr}")
        
        if apply_result.returncode != 0:
            logger.error("Terraform apply failed")
            
            # Analyze the error
            error_output = apply_result.stderr
            if "network" in error_output.lower() or "not allowed to order" in error_output.lower():
                logger.error("NETWORK RESTRICTION DETECTED")
                logger.error("The OVH account has network restrictions preventing resource creation")
            
            # Log debug information
            debug_log = workspace / 'terraform_debug.log'
            if debug_log.exists():
                logger.info("Terraform debug log contents (last 100 lines):")
                with open(debug_log, 'r') as f:
                    debug_content = f.read()
                    debug_lines = debug_content.split('\n')
                    for line in debug_lines[-100:]:
                        if line.strip():
                            logger.debug(f"TF_DEBUG: {line}")
            
            return False
        
        # Get outputs
        logger.info("\nPHASE 4: Getting Outputs")
        logger.info("-" * 40)
        
        output_result = subprocess.run(
            ["terraform", "output", "-json"],
            cwd=workspace,
            capture_output=True,
            text=True,
            env=env
        )
        
        if output_result.returncode == 0:
            outputs = json.loads(output_result.stdout)
            logger.info("RESOURCE CREATION SUCCESSFUL!")
            logger.info("Created resources:")
            for key, value in outputs.items():
                if value.get('sensitive'):
                    logger.info(f"  {key}: [SENSITIVE]")
                else:
                    logger.info(f"  {key}: {value.get('value')}")
        
        # Cleanup
        logger.info("\nPHASE 5: Cleanup")
        logger.info("-" * 40)
        
        destroy_result = subprocess.run(
            ["terraform", "destroy", "-auto-approve"],
            cwd=workspace,
            capture_output=True,
            text=True,
            env=env
        )
        
        logger.info(f"Destroy exit code: {destroy_result.returncode}")
        if destroy_result.returncode == 0:
            logger.info("✅ Resources cleaned up successfully")
        else:
            logger.warning("⚠️  Cleanup had issues - manual verification may be needed")
            if destroy_result.stderr:
                logger.warning(f"Destroy stderr: {destroy_result.stderr}")
        
        return True

def test_workshop_deployment_flow():
    """Test the complete workshop deployment flow"""
    logger.info("\n" + "=" * 60)
    logger.info("TESTING WORKSHOP DEPLOYMENT FLOW")
    logger.info("=" * 60)
    
    try:
        import requests
        
        # Test API health
        logger.info("Testing API health...")
        response = requests.get("http://localhost:8000/health", timeout=5)
        logger.info(f"API health status: {response.status_code}")
        
        if response.status_code != 200:
            logger.error("API is not healthy")
            return False
        
        # Login
        logger.info("Logging in to API...")
        login_response = requests.post(
            "http://localhost:8000/api/auth/login",
            json={"username": "admin", "password": "admin"}
        )
        
        logger.info(f"Login status: {login_response.status_code}")
        if login_response.status_code != 200:
            logger.error("Login failed")
            return False
        
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create workshop
        logger.info("Creating test workshop...")
        workshop_data = {
            "name": f"Logging Test Workshop {datetime.now().strftime('%H%M%S')}",
            "description": "Test workshop with comprehensive logging",
            "start_date": "2025-01-08T10:00:00Z",
            "end_date": "2025-01-09T18:00:00Z"
        }
        
        workshop_response = requests.post(
            "http://localhost:8000/api/workshops",
            headers=headers,
            json=workshop_data
        )
        
        logger.info(f"Workshop creation status: {workshop_response.status_code}")
        if workshop_response.status_code != 200:
            logger.error("Workshop creation failed")
            return False
        
        workshop = workshop_response.json()
        workshop_id = workshop["id"]
        logger.info(f"Created workshop: {workshop_id}")
        
        # Add attendee
        logger.info("Adding test attendee...")
        attendee_data = {
            "username": f"testuser{datetime.now().strftime('%H%M%S')}",
            "email": f"testuser{datetime.now().strftime('%H%M%S')}@example.com"
        }
        
        attendee_response = requests.post(
            f"http://localhost:8000/api/attendees?workshop_id={workshop_id}",
            headers=headers,
            json=attendee_data
        )
        
        logger.info(f"Attendee creation status: {attendee_response.status_code}")
        if attendee_response.status_code != 200:
            logger.error("Attendee creation failed")
            return False
        
        attendee = attendee_response.json()
        logger.info(f"Created attendee: {attendee['id']}")
        
        # Start deployment
        logger.info("Starting deployment...")
        deploy_response = requests.post(
            f"http://localhost:8000/api/workshops/{workshop_id}/deploy",
            headers=headers
        )
        
        logger.info(f"Deployment start status: {deploy_response.status_code}")
        if deploy_response.status_code != 200:
            logger.error("Deployment start failed")
            return False
        
        # Monitor deployment
        logger.info("Monitoring deployment progress...")
        for attempt in range(30):  # 2.5 minutes max
            time.sleep(5)
            
            status_response = requests.get(
                f"http://localhost:8000/api/workshops/{workshop_id}",
                headers=headers
            )
            
            if status_response.status_code == 200:
                workshop_status = status_response.json()
                logger.info(f"Attempt {attempt + 1}: Workshop status = {workshop_status['status']}")
                
                if workshop_status['status'] in ['active', 'failed']:
                    break
        
        # Get final status and logs
        final_status = workshop_status['status']
        logger.info(f"Final workshop status: {final_status}")
        
        # Get deployment logs
        logs_response = requests.get(
            f"http://localhost:8000/api/deployments/workshop/{workshop_id}",
            headers=headers
        )
        
        if logs_response.status_code == 200:
            logs = logs_response.json()
            logger.info(f"Retrieved {len(logs)} deployment log entries")
            
            for log_entry in logs:
                logger.info(f"Log: {log_entry.get('action', 'unknown')} - {log_entry.get('status', 'unknown')}")
                if log_entry.get('error_message'):
                    logger.error(f"Error: {log_entry['error_message']}")
        
        return final_status == 'active'
        
    except Exception as e:
        logger.exception(f"Workshop deployment test failed: {str(e)}")
        return False

def main():
    """Main test runner"""
    logger.info("=" * 80)
    logger.info("TECHLABS AUTOMATION - COMPREHENSIVE OVH TESTING")
    logger.info("=" * 80)
    logger.info(f"Log file: {LOG_FILE_PATH}")
    logger.info("=" * 80)
    
    # Log system info
    log_system_info()
    
    # Run tests
    tests = [
        ("OVH API Direct Connection", test_ovh_api_direct),
        ("Terraform Resource Creation", test_terraform_resource_creation),
        ("Workshop Deployment Flow", test_workshop_deployment_flow)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        logger.info(f"\n🧪 Starting test: {test_name}")
        try:
            success = test_func()
            results.append((test_name, success))
            status = "✅ PASSED" if success else "❌ FAILED"
            logger.info(f"Test result: {status}")
        except Exception as e:
            logger.exception(f"Test crashed: {str(e)}")
            results.append((test_name, False))
    
    # Final summary
    logger.info("\n" + "=" * 80)
    logger.info("TEST SUMMARY")
    logger.info("=" * 80)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        logger.info(f"{test_name:<40} {status}")
    
    logger.info(f"\nOverall: {passed}/{total} tests passed")
    logger.info(f"Log file saved to: {LOG_FILE_PATH}")
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    exit_code = main()
    print(f"\n📁 Log file location: {LOG_FILE_PATH}")
    sys.exit(exit_code)