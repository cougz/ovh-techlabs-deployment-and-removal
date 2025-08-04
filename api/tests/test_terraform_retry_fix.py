"""
Test to verify CLEANUP-WORKER-001 fix: Terraform retry mechanism
"""
import pytest
from unittest.mock import Mock, patch
from services.terraform_service import TerraformService


class TestTerraformRetryFix:
    
    def test_destroy_with_retry_should_retry_on_timeout(self):
        """Test that destroy_with_retry retries on timeout errors"""
        terraform_service = TerraformService()
        workspace_name = "test-workspace"
        
        # Mock workspace exists
        with patch.object(terraform_service, '_get_workspace_path') as mock_path:
            mock_workspace_path = Mock()
            mock_workspace_path.exists.return_value = True
            mock_path.return_value = mock_workspace_path
            
            # Mock first call times out, second succeeds
            call_count = 0
            def mock_run_command(*args, **kwargs):
                nonlocal call_count
                call_count += 1
                if call_count == 1:
                    return (1, "", "Command timed out after 10 minutes")
                else:
                    return (0, "Resources destroyed successfully", "")
            
            with patch.object(terraform_service, '_run_terraform_command', side_effect=mock_run_command):
                with patch('time.sleep'):  # Skip actual sleep in test
                    success, output = terraform_service.destroy_with_retry(workspace_name, max_retries=1)
                    
                    # Should succeed on retry
                    assert success is True
                    assert "successfully" in output.lower()
                    assert call_count == 2, f"Expected 2 calls but got {call_count}"
    
    def test_destroy_with_retry_should_not_retry_non_retryable_errors(self):
        """Test that destroy_with_retry doesn't retry non-retryable errors"""
        terraform_service = TerraformService()
        workspace_name = "test-workspace"
        
        with patch.object(terraform_service, '_get_workspace_path') as mock_path:
            mock_workspace_path = Mock()
            mock_workspace_path.exists.return_value = True
            mock_path.return_value = mock_workspace_path
            
            # Mock non-retryable error
            def mock_run_command(*args, **kwargs):
                return (1, "", "Authentication failed: Invalid credentials")
            
            with patch.object(terraform_service, '_run_terraform_command', side_effect=mock_run_command):
                success, output = terraform_service.destroy_with_retry(workspace_name, max_retries=2)
                
                # Should fail immediately without retry
                assert success is False
                assert "authentication failed" in output.lower()
                assert "non-retryable error" in output.lower()  # Should indicate non-retryable error
    
    def test_is_retryable_error_should_identify_timeout_errors(self):
        """Test that _is_retryable_error identifies timeout and network errors"""
        terraform_service = TerraformService()
        
        # Test retryable errors
        retryable_errors = [
            "Command timed out after 10 minutes",
            "Connection timeout occurred",
            "Network is unreachable",
            "502 Bad Gateway",
            "OVH API Error: rate limit exceeded"
        ]
        
        for error in retryable_errors:
            assert terraform_service._is_retryable_error(error), f"Should be retryable: {error}"
        
        # Test non-retryable errors
        non_retryable_errors = [
            "Authentication failed",
            "Invalid credentials",
            "Resource not found", 
            "Permission denied",
            "Invalid terraform configuration"
        ]
        
        for error in non_retryable_errors:
            assert not terraform_service._is_retryable_error(error), f"Should not be retryable: {error}"
    
    def test_destroy_has_shorter_timeout_than_default(self):
        """Test that destroy operations use 10 minute timeout instead of 30"""
        terraform_service = TerraformService()
        workspace_name = "test-workspace"
        
        with patch.object(terraform_service, '_get_workspace_path') as mock_path:
            mock_workspace_path = Mock()
            mock_workspace_path.exists.return_value = True
            mock_path.return_value = mock_workspace_path
            
            with patch.object(terraform_service, '_run_terraform_command') as mock_run:
                mock_run.return_value = (0, "Destroy completed", "")
                
                terraform_service.destroy(workspace_name)
                
                # Verify that _run_terraform_command was called with 600 seconds (10 minutes)
                mock_run.assert_called_once()
                call_args = mock_run.call_args
                
                # Check if timeout was passed as keyword argument
                assert call_args.kwargs.get('timeout') == 600, f"Expected timeout=600, got {call_args.kwargs.get('timeout')}"