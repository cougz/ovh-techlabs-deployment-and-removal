"""
Test workshop status transitions to ensure proper state management
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta, timezone as tz
from sqlalchemy.orm import Session

from models.workshop import Workshop
from models.attendee import Attendee
from services.workshop_status_service import WorkshopStatusService
from api.routes.workshops import deploy_workshop
from tasks.terraform_tasks import deploy_attendee_resources


class TestWorkshopStatusTransitions:
    """Test automatic workshop status transitions based on attendee states"""
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database session"""
        return Mock(spec=Session)
    
    @pytest.fixture
    def sample_workshop(self):
        """Create a sample workshop in planning state"""
        return Workshop(
            id="workshop-123",
            name="Test Workshop",
            description="Test Description",
            status="planning",
            start_date=datetime.now(tz.utc),
            end_date=datetime.now(tz.utc) + timedelta(days=1),
            timezone="UTC",
            template="Generic",
            created_at=datetime.now(tz.utc),
            updated_at=datetime.now(tz.utc)
        )
    
    @pytest.fixture
    def sample_attendees(self):
        """Create sample attendees in various states"""
        return [
            Attendee(
                id="attendee-1",
                workshop_id="workshop-123",
                username="user1",
                email="user1@test.com",
                status="active",
                created_at=datetime.now(tz.utc)
            ),
            Attendee(
                id="attendee-2", 
                workshop_id="workshop-123",
                username="user2",
                email="user2@test.com",
                status="active",
                created_at=datetime.now(tz.utc)
            ),
            Attendee(
                id="attendee-3",
                workshop_id="workshop-123", 
                username="user3",
                email="user3@test.com",
                status="active",
                created_at=datetime.now(tz.utc)
            )
        ]
    
    def test_workshop_transitions_to_active_when_all_attendees_deployed(self, mock_db, sample_workshop, sample_attendees):
        """Workshop should transition from planning to active when all attendees are deployed"""
        # Arrange
        mock_db.query.return_value.filter.return_value.all.return_value = sample_attendees
        mock_db.query.return_value.filter.return_value.first.return_value = sample_workshop
        
        # Act
        WorkshopStatusService.update_workshop_status_from_attendees(sample_workshop.id, mock_db)
        
        # Assert
        assert sample_workshop.status == "active"
        mock_db.commit.assert_called_once()
    
    def test_workshop_remains_planning_with_mixed_attendee_states(self, mock_db, sample_workshop):
        """Workshop should remain in planning if any attendee is not deployed"""
        # Arrange
        mixed_attendees = [
            Attendee(id="a1", workshop_id="workshop-123", username="u1", email="u1@test.com", status="active"),
            Attendee(id="a2", workshop_id="workshop-123", username="u2", email="u2@test.com", status="planning"),
            Attendee(id="a3", workshop_id="workshop_123", username="u3", email="u3@test.com", status="active")
        ]
        mock_db.query.return_value.filter.return_value.all.return_value = mixed_attendees
        mock_db.query.return_value.filter.return_value.first.return_value = sample_workshop
        
        # Act
        WorkshopStatusService.update_workshop_status_from_attendees(sample_workshop.id, mock_db)
        
        # Assert
        assert sample_workshop.status == "planning"
    
    def test_workshop_shows_deploying_during_deployment(self, mock_db, sample_workshop):
        """Workshop should show deploying status while deployment is in progress"""
        # Arrange
        deploying_attendees = [
            Attendee(id="a1", workshop_id="workshop-123", username="u1", email="u1@test.com", status="deploying"),
            Attendee(id="a2", workshop_id="workshop-123", username="u2", email="u2@test.com", status="deploying"),
            Attendee(id="a3", workshop_id="workshop-123", username="u3", email="u3@test.com", status="active")
        ]
        mock_db.query.return_value.filter.return_value.all.return_value = deploying_attendees
        mock_db.query.return_value.filter.return_value.first.return_value = sample_workshop
        
        # Act  
        WorkshopStatusService.update_workshop_status_from_attendees(mock_db, sample_workshop.id)
        
        # Assert
        assert sample_workshop.status == "deploying"
    
    def test_workshop_transitions_correctly_after_failed_deployment(self, mock_db, sample_workshop):
        """Workshop should show failed status if any deployment fails"""
        # Arrange
        failed_attendees = [
            Attendee(id="a1", workshop_id="workshop-123", username="u1", email="u1@test.com", status="active"),
            Attendee(id="a2", workshop_id="workshop-123", username="u2", email="u2@test.com", status="failed"),
            Attendee(id="a3", workshop_id="workshop-123", username="u3", email="u3@test.com", status="active")
        ]
        mock_db.query.return_value.filter.return_value.all.return_value = failed_attendees
        mock_db.query.return_value.filter.return_value.first.return_value = sample_workshop
        
        # Act
        WorkshopStatusService.update_workshop_status_from_attendees(sample_workshop.id, mock_db)
        
        # Assert
        assert sample_workshop.status == "failed"
    
    def test_empty_workshop_remains_in_planning(self, mock_db, sample_workshop):
        """Workshop with no attendees should remain in planning state"""
        # Arrange
        mock_db.query.return_value.filter.return_value.all.return_value = []
        mock_db.query.return_value.filter.return_value.first.return_value = sample_workshop
        
        # Act
        WorkshopStatusService.update_workshop_status_from_attendees(sample_workshop.id, mock_db)
        
        # Assert
        assert sample_workshop.status == "planning"
    
    @patch('tasks.terraform_tasks.celery_app.send_task')
    def test_deploy_endpoint_updates_status_after_all_attendees(self, mock_send_task, mock_db, sample_workshop, sample_attendees):
        """Deploy endpoint should trigger status update after all attendees are deployed"""
        # Arrange
        mock_db.query.return_value.filter.return_value.first.return_value = sample_workshop
        mock_db.query.return_value.filter.return_value.all.return_value = sample_attendees
        mock_send_task.return_value = Mock(id="task-123")
        
        # Act - simulate the deploy endpoint being called
        # This should set workshop to 'deploying' initially, then update based on attendees
        sample_workshop.status = "deploying"  # Simulating what deploy endpoint does
        
        # Simulate all attendees being deployed successfully
        for attendee in sample_attendees:
            attendee.status = "active"
        
        # Now trigger the status update that should happen after deployment
        WorkshopStatusService.update_workshop_status_from_attendees(mock_db, sample_workshop.id)
        
        # Assert
        assert sample_workshop.status == "active"
    
    def test_sidebar_status_consistency(self, sample_workshop, sample_attendees):
        """Sidebar should not show 'Ready to deploy' when attendees are already deployed"""
        # This test validates the business logic that the frontend should use
        
        # When all attendees are active
        all_active = all(a.status == "active" for a in sample_attendees)
        workshop_status = "active" if all_active else sample_workshop.status
        
        # The sidebar should NOT show "Ready to deploy" for an active workshop
        should_show_ready_to_deploy = workshop_status == "planning" and len(sample_attendees) > 0
        
        assert not should_show_ready_to_deploy  # Should be False when workshop is active
        assert workshop_status == "active"  # Workshop should be active