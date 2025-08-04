import os
import json
import subprocess
import tempfile
import shutil
from typing import Dict, Optional, List, Tuple
from pathlib import Path
import uuid
from datetime import datetime

from core.config import settings
from core.logging import get_logger

logger = get_logger(__name__)

class EnhancedTerraformService:
    """Enhanced Terraform service with detailed logging and debugging capabilities."""
    
    def __init__(self):
        self.terraform_binary = settings.TERRAFORM_BINARY_PATH
        self.workspace_dir = Path(settings.TERRAFORM_WORKSPACE_DIR)
        self.workspace_dir.mkdir(parents=True, exist_ok=True)
        self.debug_mode = True  # Enable detailed debugging
        
        self._log_initialization()
    
    def _log_initialization(self):
        """Log detailed initialization information."""
        logger.info("=" * 80)
        logger.info("Enhanced TerraformService Initialization")
        logger.info("=" * 80)
        logger.info(f"Terraform binary path: {self.terraform_binary}")
        logger.info(f"Workspace directory: {self.workspace_dir}")
        logger.info(f"Debug mode: {self.debug_mode}")
        
        # Check terraform binary
        if os.path.exists(self.terraform_binary):
            logger.info(f"✅ Terraform binary found")
            # Check version
            version_result = subprocess.run(
                [self.terraform_binary, "version"],
                capture_output=True,
                text=True
            )
            if version_result.returncode == 0:
                logger.info(f"Terraform version: {version_result.stdout.split()[1]}")
        else:
            logger.error(f"❌ Terraform binary not found at: {self.terraform_binary}")
        
        # Check workspace permissions
        if os.access(self.workspace_dir, os.W_OK):
            logger.info(f"✅ Workspace directory is writable")
        else:
            logger.error(f"❌ Workspace directory not writable")
        
        # Log OVH configuration status
        logger.info("\nOVH Configuration Status:")
        logger.info(f"  OVH_ENDPOINT: {settings.OVH_ENDPOINT}")
        logger.info(f"  OVH_APPLICATION_KEY: {'✅ SET' if settings.OVH_APPLICATION_KEY else '❌ NOT SET'}")
        logger.info(f"  OVH_APPLICATION_SECRET: {'✅ SET' if settings.OVH_APPLICATION_SECRET else '❌ NOT SET'}")
        logger.info(f"  OVH_CONSUMER_KEY: {'✅ SET' if settings.OVH_CONSUMER_KEY else '❌ NOT SET'}")
        logger.info("=" * 80)
    
    def _get_workspace_path(self, workspace_name: str) -> Path:
        """Get the path for a specific workspace."""
        return self.workspace_dir / workspace_name
    
    def _create_debug_log_path(self, workspace_path: Path) -> Path:
        """Create a debug log file path for Terraform operations."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        debug_dir = workspace_path / "debug_logs"
        debug_dir.mkdir(exist_ok=True)
        return debug_dir / f"terraform_debug_{timestamp}.log"
    
    def _run_terraform_command(
        self, 
        command: List[str], 
        workspace_path: Path,
        capture_output: bool = True,
        env: Optional[Dict[str, str]] = None,
        stream_output: bool = False
    ) -> Tuple[int, str, str]:
        """Run a terraform command with enhanced logging and debugging."""
        cmd = [self.terraform_binary] + command
        
        # Log command execution start
        logger.info("\n" + "=" * 60)
        logger.info(f"Executing Terraform Command")
        logger.info("=" * 60)
        logger.info(f"Command: {' '.join(cmd)}")
        logger.info(f"Working directory: {workspace_path}")
        logger.info(f"Timestamp: {datetime.now().isoformat()}")
        
        # Set up environment with enhanced debugging
        terraform_env = os.environ.copy()
        
        # OVH environment variables
        ovh_env_vars = {
            'OVH_ENDPOINT': settings.OVH_ENDPOINT,
            'OVH_APPLICATION_KEY': settings.OVH_APPLICATION_KEY,
            'OVH_APPLICATION_SECRET': settings.OVH_APPLICATION_SECRET,
            'OVH_CONSUMER_KEY': settings.OVH_CONSUMER_KEY
        }
        terraform_env.update(ovh_env_vars)
        
        # Enable Terraform debugging if in debug mode
        if self.debug_mode:
            debug_log_path = self._create_debug_log_path(workspace_path)
            terraform_env['TF_LOG'] = 'DEBUG'
            terraform_env['TF_LOG_PATH'] = str(debug_log_path)
            logger.info(f"Debug logging enabled. Log file: {debug_log_path}")
        
        if env:
            terraform_env.update(env)
        
        # Log environment status
        logger.info("\nEnvironment Variables Status:")
        for key in ['OVH_ENDPOINT', 'OVH_APPLICATION_KEY', 'OVH_APPLICATION_SECRET', 'OVH_CONSUMER_KEY']:
            if key in terraform_env:
                value = terraform_env[key]
                if key == 'OVH_ENDPOINT':
                    logger.info(f"  {key}: {value}")
                else:
                    logger.info(f"  {key}: {'***' + value[-4:] if len(value) > 4 else '***'}")
            else:
                logger.error(f"  {key}: NOT SET ❌")
        
        # Execute command
        start_time = datetime.now()
        logger.info(f"\nStarting execution at: {start_time.isoformat()}")
        
        try:
            if stream_output and not capture_output:
                # Stream output in real-time
                process = subprocess.Popen(
                    cmd,
                    cwd=workspace_path,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    env=terraform_env
                )
                
                stdout_lines = []
                stderr_lines = []
                
                # Read output line by line
                while True:
                    stdout_line = process.stdout.readline()
                    if stdout_line:
                        stdout_lines.append(stdout_line)
                        logger.info(f"[TERRAFORM] {stdout_line.rstrip()}")
                    
                    if process.poll() is not None:
                        break
                
                # Get any remaining stderr
                stderr = process.stderr.read()
                if stderr:
                    stderr_lines.append(stderr)
                    logger.error(f"[TERRAFORM ERROR] {stderr}")
                
                returncode = process.returncode
                stdout = ''.join(stdout_lines)
                stderr = ''.join(stderr_lines)
            else:
                # Standard execution with captured output
                result = subprocess.run(
                    cmd,
                    cwd=workspace_path,
                    capture_output=capture_output,
                    text=True,
                    env=terraform_env,
                    timeout=1800  # 30 minutes
                )
                
                returncode = result.returncode
                stdout = result.stdout
                stderr = result.stderr
            
            # Calculate execution time
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            # Log execution results
            logger.info(f"\nExecution completed at: {end_time.isoformat()}")
            logger.info(f"Duration: {duration:.2f} seconds")
            logger.info(f"Return code: {returncode}")
            
            # Log output
            if stdout:
                logger.info("\nSTDOUT:")
                logger.info("-" * 40)
                logger.info(stdout)
                logger.info("-" * 40)
            
            if stderr:
                log_func = logger.error if returncode != 0 else logger.warning
                log_func("\nSTDERR:")
                log_func("-" * 40)
                log_func(stderr)
                log_func("-" * 40)
            
            # If command failed and debug mode is on, analyze the debug log
            if returncode != 0 and self.debug_mode and 'TF_LOG_PATH' in terraform_env:
                self._analyze_debug_log(terraform_env['TF_LOG_PATH'])
            
            # Log summary
            status = "✅ SUCCESS" if returncode == 0 else "❌ FAILED"
            logger.info(f"\nCommand Status: {status}")
            logger.info("=" * 60)
            
            return returncode, stdout, stderr
            
        except subprocess.TimeoutExpired:
            logger.error(f"❌ Command timed out after 30 minutes")
            return 1, "", "Command timed out after 30 minutes"
        except Exception as e:
            logger.error(f"❌ Unexpected error: {str(e)}")
            return 1, "", str(e)
    
    def _analyze_debug_log(self, debug_log_path: str):
        """Analyze Terraform debug log for common issues."""
        logger.info("\nAnalyzing Terraform debug log for issues...")
        
        if not os.path.exists(debug_log_path):
            logger.warning(f"Debug log not found: {debug_log_path}")
            return
        
        error_patterns = {
            "authentication": ["401", "403", "forbidden", "unauthorized", "invalid credentials"],
            "network": ["connection refused", "timeout", "no route to host", "network unreachable"],
            "api_error": ["invalid request", "bad request", "400", "500", "502", "503"],
            "quota": ["quota exceeded", "limit reached", "insufficient"],
            "permission": ["permission denied", "access denied", "insufficient privileges"]
        }
        
        found_issues = {}
        
        try:
            with open(debug_log_path, 'r') as f:
                content = f.read()
                
                # Search for error patterns
                for category, patterns in error_patterns.items():
                    for pattern in patterns:
                        if pattern.lower() in content.lower():
                            if category not in found_issues:
                                found_issues[category] = []
                            # Find the line containing the error
                            for line in content.split('\n'):
                                if pattern.lower() in line.lower():
                                    found_issues[category].append(line.strip())
                                    break
            
            # Report findings
            if found_issues:
                logger.error("\n🔍 Detected Issues in Debug Log:")
                for category, errors in found_issues.items():
                    logger.error(f"\n{category.upper()} ISSUES:")
                    for error in errors[:3]:  # Show max 3 examples per category
                        logger.error(f"  - {error[:200]}...")
            else:
                logger.info("No specific error patterns detected in debug log")
                
        except Exception as e:
            logger.error(f"Failed to analyze debug log: {str(e)}")
    
    def test_ovh_connection(self) -> bool:
        """Test OVH API connection using a minimal Terraform configuration."""
        logger.info("\n" + "=" * 80)
        logger.info("Testing OVH API Connection")
        logger.info("=" * 80)
        
        workspace_name = f"test_connection_{uuid.uuid4().hex[:8]}"
        workspace_path = self._get_workspace_path(workspace_name)
        
        try:
            # Create test workspace
            workspace_path.mkdir(parents=True, exist_ok=True)
            
            # Create minimal test configuration
            test_config = '''
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
data "ovh_me" "test_connection" {}

output "account_info" {
  value = {
    nichandle = data.ovh_me.test_connection.nichandle
    state     = data.ovh_me.test_connection.state
  }
  sensitive = true
}
'''
            
            # Write configuration
            main_tf_path = workspace_path / "main.tf"
            main_tf_path.write_text(test_config)
            logger.info(f"Created test configuration at: {main_tf_path}")
            
            # Initialize
            logger.info("\nRunning terraform init...")
            returncode, stdout, stderr = self._run_terraform_command(
                ["init"],
                workspace_path
            )
            
            if returncode != 0:
                logger.error("Terraform init failed")
                return False
            
            # Plan
            logger.info("\nRunning terraform plan...")
            returncode, stdout, stderr = self._run_terraform_command(
                ["plan"],
                workspace_path
            )
            
            if returncode != 0:
                logger.error("Terraform plan failed - OVH API connection test failed")
                return False
            
            logger.info("✅ OVH API connection test successful!")
            return True
            
        finally:
            # Cleanup
            if workspace_path.exists():
                shutil.rmtree(workspace_path)
                logger.info(f"Cleaned up test workspace: {workspace_path}")
    
    def deploy_resources(
        self,
        workspace_name: str,
        terraform_config: Dict,
        auto_approve: bool = False
    ) -> Tuple[bool, Dict]:
        """Deploy resources with enhanced monitoring and logging."""
        logger.info("\n" + "=" * 80)
        logger.info(f"Deploying Resources for Workspace: {workspace_name}")
        logger.info("=" * 80)
        
        workspace_path = self._get_workspace_path(workspace_name)
        results = {
            "workspace": workspace_name,
            "status": "unknown",
            "outputs": {},
            "errors": [],
            "debug_logs": []
        }
        
        try:
            # Create workspace
            if not self.create_workspace(workspace_name, terraform_config):
                results["status"] = "failed"
                results["errors"].append("Failed to create workspace")
                return False, results
            
            # Initialize
            logger.info("\n📦 Initializing Terraform...")
            returncode, stdout, stderr = self._run_terraform_command(
                ["init"],
                workspace_path
            )
            
            if returncode != 0:
                results["status"] = "failed"
                results["errors"].append(f"Init failed: {stderr}")
                return False, results
            
            # Plan
            logger.info("\n📋 Planning deployment...")
            returncode, stdout, stderr = self._run_terraform_command(
                ["plan", "-out=tfplan"],
                workspace_path
            )
            
            if returncode != 0:
                results["status"] = "failed"
                results["errors"].append(f"Plan failed: {stderr}")
                return False, results
            
            # Apply
            logger.info("\n🚀 Applying configuration...")
            apply_cmd = ["apply"]
            if auto_approve:
                apply_cmd.append("-auto-approve")
            apply_cmd.append("tfplan")
            
            returncode, stdout, stderr = self._run_terraform_command(
                apply_cmd,
                workspace_path,
                stream_output=True,
                capture_output=False
            )
            
            if returncode != 0:
                results["status"] = "failed"
                results["errors"].append(f"Apply failed: {stderr}")
                return False, results
            
            # Get outputs
            logger.info("\n📊 Retrieving outputs...")
            returncode, stdout, stderr = self._run_terraform_command(
                ["output", "-json"],
                workspace_path
            )
            
            if returncode == 0 and stdout:
                try:
                    outputs = json.loads(stdout)
                    results["outputs"] = {
                        k: v.get("value") for k, v in outputs.items()
                    }
                    logger.info(f"Retrieved {len(outputs)} outputs")
                except json.JSONDecodeError:
                    logger.warning("Failed to parse outputs")
            
            results["status"] = "success"
            logger.info("\n✅ Deployment completed successfully!")
            return True, results
            
        except Exception as e:
            logger.error(f"Deployment failed with exception: {str(e)}")
            results["status"] = "failed"
            results["errors"].append(str(e))
            return False, results
    
    def create_workspace(self, workspace_name: str, terraform_config: Dict) -> bool:
        """Create a new Terraform workspace with the given configuration."""
        workspace_path = self._get_workspace_path(workspace_name)
        
        logger.info(f"\n📁 Creating workspace: {workspace_name}")
        
        try:
            # Create workspace directory
            workspace_path.mkdir(parents=True, exist_ok=True)
            
            # Generate and write main.tf
            main_tf_content = self._generate_main_tf(terraform_config)
            main_tf_path = workspace_path / "main.tf"
            main_tf_path.write_text(main_tf_content)
            logger.info(f"✅ Created main.tf")
            
            # Write variables if provided
            if terraform_config.get("variables"):
                vars_content = self._generate_variables_tf(terraform_config["variables"])
                vars_path = workspace_path / "variables.tf"
                vars_path.write_text(vars_content)
                logger.info(f"✅ Created variables.tf")
            
            # Write outputs if provided
            if terraform_config.get("outputs"):
                outputs_content = self._generate_outputs_tf(terraform_config["outputs"])
                outputs_path = workspace_path / "outputs.tf"
                outputs_path.write_text(outputs_content)
                logger.info(f"✅ Created outputs.tf")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to create workspace: {str(e)}")
            return False
    
    def _generate_main_tf(self, config: Dict) -> str:
        """Generate main.tf content from configuration."""
        # Implementation would be similar to existing service
        # but with enhanced error handling and logging
        return ""
    
    def _generate_variables_tf(self, variables: Dict) -> str:
        """Generate variables.tf content."""
        return ""
    
    def _generate_outputs_tf(self, outputs: Dict) -> str:
        """Generate outputs.tf content."""
        return ""