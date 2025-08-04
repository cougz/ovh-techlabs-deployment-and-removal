"""
Test to reproduce WEBSOCKET-FIX-001: Celery WebSocket Connection Errors
"""
import pytest
from unittest.mock import patch, MagicMock
from tasks.websocket_updates import send_websocket_update, broadcast_status_update


class TestWebSocketConnectionFix:
    """Test to reproduce and fix the WebSocket connection errors"""
    
    def test_should_connect_to_correct_api_hostname(self):
        """Test that WebSocket updates use the correct container hostname"""
        
        # Mock the requests.post call to verify hostname
        with patch('tasks.websocket_updates.requests.post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_post.return_value = mock_response
            
            # Call the WebSocket update function
            send_websocket_update("test-workshop-id", {"type": "test"})
            
            # Verify the correct hostname is used
            mock_post.assert_called_once()
            call_args = mock_post.call_args
            
            # Should use ovh-techlabs-api, not techlabs-api-prod
            expected_url = "http://ovh-techlabs-api:8000/internal/broadcast"
            actual_url = call_args[0][0]  # First positional argument is the URL
            assert actual_url == expected_url
    
    def test_should_handle_successful_websocket_broadcast(self):
        """Test that WebSocket broadcast works without connection errors"""
        
        with patch('tasks.websocket_updates.requests.post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_post.return_value = mock_response
            
            # Should not raise any exceptions
            broadcast_status_update(
                workshop_id="test-workshop-id",
                entity_type="attendee", 
                entity_id="test-attendee-id",
                status="deploying"
            )
            
            # Verify request was made successfully
            mock_post.assert_called_once()
            
    def test_should_not_fail_with_name_resolution_error(self):
        """Test that the fix prevents NameResolutionError"""
        
        # Before fix: techlabs-api-prod would cause NameResolutionError
        # After fix: ovh-techlabs-api should resolve correctly
        
        with patch('tasks.websocket_updates.requests.post') as mock_post:
            # Simulate successful connection to correct hostname
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_post.return_value = mock_response
            
            # This should work without NameResolutionError
            send_websocket_update("test-workshop", {"type": "test"})
            
            # Verify we're not using the problematic hostname
            mock_post.assert_called_once()
            call_url = mock_post.call_args[0][0]  # First positional argument is the URL
            
            # Should not contain the problematic hostname
            assert "techlabs-api-prod" not in call_url
            assert "ovh-techlabs-api" in call_url