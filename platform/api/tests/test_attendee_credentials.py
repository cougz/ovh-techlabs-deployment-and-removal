"""
Test attendee credentials retrieval from Terraform outputs.

This test verifies that attendee credentials are properly retrieved
from OVH IAM user outputs, not from locally generated credentials.
"""

import pytest
from unittest.mock import patch, MagicMock
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from core.database import get_db
from models.attendee import Attendee
from models.workshop import Workshop
from models.credential import Credential


def create_mock_workshop(db: Session) -> Workshop:
    """Factory for creating a test workshop."""
    workshop = Workshop(
        name="Test Workshop",
        description="Test workshop description",
        start_date="2024-07-15T10:00:00Z",
        end_date="2024-07-15T18:00:00Z",
        status="active"
    )
    db.add(workshop)
    db.commit()
    db.refresh(workshop)
    return workshop


def create_mock_attendee_with_deployment(db: Session, workshop_id: str) -> Attendee:
    """Factory for creating a test attendee with active deployment."""
    attendee = Attendee(
        workshop_id=workshop_id,
        username="testuser01",
        email="test@example.com",
        status="active",
        ovh_project_id="test-project-123",
        ovh_user_urn="urn:v1:eu:identity:user:xx123456-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    )
    db.add(attendee)
    db.commit()
    db.refresh(attendee)
    return attendee


@pytest.fixture
def client():
    """Test client fixture."""
    return TestClient(app)


@pytest.fixture 
def auth_headers():
    """Mock authentication headers."""
    return {"Authorization": "Bearer test-token"}


def test_get_attendee_credentials_should_return_ovh_iam_credentials(client, auth_headers):
    """
    Test that retrieving attendee credentials returns the actual OVH IAM user
    credentials from Terraform outputs, not locally generated credentials.
    
    This is critical for providing attendees with working OVH access.
    """
    with patch("api.routes.auth.get_current_user", return_value="test-user"):
        with patch("core.database.get_db") as mock_get_db:
            # Set up mock database
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db
            
            # Create test attendee with active deployment
            test_attendee_id = str(uuid4())
            mock_attendee = MagicMock()
            mock_attendee.id = test_attendee_id
            mock_attendee.workshop_id = str(uuid4())
            mock_attendee.username = "testuser01"
            mock_attendee.status = "active"
            mock_attendee.ovh_project_id = "test-project-123"
            mock_attendee.ovh_user_urn = "urn:v1:eu:identity:user:xx123456-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            
            mock_db.query.return_value.filter.return_value.first.return_value = mock_attendee
            
            # Mock terraform service to return OVH IAM credentials
            with patch("services.terraform_service.terraform_service") as mock_tf:
                mock_tf.get_outputs.return_value = {
                    "username": {"value": "ovh_testuser01"},
                    "password": {"value": "OVH_Generated_Password_123!"},
                    "project_id": {"value": "test-project-123"},
                    "user_urn": {"value": "urn:v1:eu:identity:user:xx123456-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}
                }
                
                # Make request
                response = client.get(
                    f"/api/attendees/{test_attendee_id}/credentials",
                    headers=auth_headers
                )
                
                # Verify behavior
                assert response.status_code == 200
                credentials = response.json()
                
                # These should be the OVH IAM credentials from Terraform
                assert credentials["username"] == "ovh_testuser01"
                assert credentials["password"] == "OVH_Generated_Password_123!"
                assert credentials["ovh_project_id"] == "test-project-123"
                assert credentials["ovh_user_urn"] == "urn:v1:eu:identity:user:xx123456-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                
                # Verify terraform service was called with correct workspace
                expected_workspace = f"attendee-{test_attendee_id}"
                mock_tf.get_outputs.assert_called_once_with(expected_workspace)


def test_get_credentials_should_fail_when_attendee_not_found(client, auth_headers):
    """Test that credentials endpoint returns 404 when attendee doesn't exist."""
    with patch("api.routes.auth.get_current_user", return_value="test-user"):
        with patch("core.database.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db
            
            # Return None for attendee query (not found)
            mock_db.query.return_value.filter.return_value.first.return_value = None
            
            nonexistent_id = str(uuid4())
            response = client.get(
                f"/api/attendees/{nonexistent_id}/credentials",
                headers=auth_headers
            )
            
            assert response.status_code == 404
            assert "Attendee not found" in response.json()["detail"]


def test_get_credentials_should_fail_when_attendee_not_deployed(client, auth_headers):
    """Test that credentials endpoint returns 404 when attendee has no deployment."""
    with patch("api.routes.auth.get_current_user", return_value="test-user"):
        with patch("core.database.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db
            
            # Create attendee without deployment
            test_attendee_id = str(uuid4())
            mock_attendee = MagicMock()
            mock_attendee.id = test_attendee_id
            mock_attendee.status = "planning"  # Not deployed
            mock_attendee.ovh_project_id = None
            
            mock_db.query.return_value.filter.return_value.first.return_value = mock_attendee
            
            response = client.get(
                f"/api/attendees/{test_attendee_id}/credentials",
                headers=auth_headers
            )
            
            assert response.status_code == 404
            assert "No credentials available" in response.json()["detail"]


def test_get_credentials_should_fail_when_terraform_outputs_missing(client, auth_headers):
    """Test that credentials endpoint handles missing Terraform outputs gracefully."""
    with patch("api.routes.auth.get_current_user", return_value="test-user"):
        with patch("core.database.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db
            
            # Create attendee with active deployment
            test_attendee_id = str(uuid4())
            mock_attendee = MagicMock()
            mock_attendee.id = test_attendee_id
            mock_attendee.status = "active"
            mock_attendee.ovh_project_id = "test-project-123"
            
            mock_db.query.return_value.filter.return_value.first.return_value = mock_attendee
            
            # Mock terraform service with no outputs
            with patch("services.terraform_service.terraform_service") as mock_tf:
                mock_tf.get_outputs.return_value = {}
                
                response = client.get(
                    f"/api/attendees/{test_attendee_id}/credentials",
                    headers=auth_headers
                )
                
                assert response.status_code == 404
                assert "Terraform outputs not available" in response.json()["detail"]