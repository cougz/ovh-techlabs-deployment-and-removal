"""Test for fixing workshop deployment status issue."""

import pytest
from unittest.mock import Mock, patch, MagicMock
from uuid import uuid4
from tasks.terraform_tasks import deploy_workshop_attendees_sequential
from models.workshop import Workshop
from models.attendee import Attendee
from sqlalchemy.orm import Session


def test_workshop_status_updates_to_active_after_deployment():
    """Test that workshop status correctly updates from 'deploying' to 'active' after all attendees are deployed."""
    
    # Create mock database session
    mock_db = Mock(spec=Session)
    
    # Create test workshop in deploying state
    workshop_id = str(uuid4())
    mock_workshop = Mock(spec=Workshop)
    mock_workshop.id = workshop_id
    mock_workshop.status = 'deploying'
    
    # Create test attendees
    attendee1 = Mock(spec=Attendee)
    attendee1.id = uuid4()
    attendee1.username = 'user1'
    attendee1.status = 'planning'
    attendee1.workshop_id = workshop_id
    
    attendee2 = Mock(spec=Attendee)
    attendee2.id = uuid4()
    attendee2.username = 'user2'
    attendee2.status = 'planning'
    attendee2.workshop_id = workshop_id
    
    # Mock database queries
    mock_db.query.return_value.filter.return_value.first.return_value = mock_workshop
    mock_db.query.return_value.filter.return_value.all.side_effect = [
        [attendee1, attendee2],  # Initial query for attendees
        [attendee1, attendee2]   # Query after deployment for status calculation
    ]
    
    # Mock successful deployment
    with patch('tasks.terraform_tasks.SessionLocal') as mock_session_local:
        mock_session_local.return_value = mock_db
        
        with patch('tasks.terraform_tasks.deploy_attendee_resources.apply') as mock_deploy:
            # Mock successful deployment results
            mock_result1 = Mock()
            mock_result1.successful.return_value = True
            mock_result1.result = {'success': True}
            
            mock_result2 = Mock()
            mock_result2.successful.return_value = True
            mock_result2.result = {'success': True}
            
            mock_deploy.side_effect = [mock_result1, mock_result2]
            
            # Simulate attendees becoming active after deployment
            def update_attendee_status(*args, **kwargs):
                attendee1.status = 'active'
                attendee2.status = 'active'
                return mock_db.query.return_value.filter.return_value.all.return_value
            
            # Update the second call to return active attendees
            mock_db.query.return_value.filter.return_value.all.side_effect = [
                [attendee1, attendee2],  # Initial query
                update_attendee_status()  # Query after deployment
            ]
            
            with patch('tasks.terraform_tasks.broadcast_deployment_progress'):
                with patch('tasks.terraform_tasks.broadcast_status_update'):
                    # Create mock task
                    mock_task = MagicMock()
                    mock_task.update_state = Mock()
                    
                    # Run the sequential deployment
                    with patch('tasks.terraform_tasks.deploy_workshop_attendees_sequential.request', mock_task):
                        result = deploy_workshop_attendees_sequential(workshop_id)
            
            # Verify workshop status was updated to 'active'
            assert mock_workshop.status == 'active'
            assert mock_db.commit.called
            
            # Verify the result
            assert result['attendees_deployed'] == 2
            assert result['attendees_failed'] == 0
            assert result['workshop_status'] == 'active'


def test_workshop_status_updates_to_failed_when_all_deployments_fail():
    """Test that workshop status correctly updates to 'failed' when all attendee deployments fail."""
    
    # Create mock database session
    mock_db = Mock(spec=Session)
    
    # Create test workshop in deploying state
    workshop_id = str(uuid4())
    mock_workshop = Mock(spec=Workshop)
    mock_workshop.id = workshop_id
    mock_workshop.status = 'deploying'
    
    # Create test attendees
    attendee1 = Mock(spec=Attendee)
    attendee1.id = uuid4()
    attendee1.username = 'user1'
    attendee1.status = 'planning'
    attendee1.workshop_id = workshop_id
    
    attendee2 = Mock(spec=Attendee)
    attendee2.id = uuid4()
    attendee2.username = 'user2'
    attendee2.status = 'planning'
    attendee2.workshop_id = workshop_id
    
    # Mock database queries
    mock_db.query.return_value.filter.return_value.first.return_value = mock_workshop
    mock_db.query.return_value.filter.return_value.all.side_effect = [
        [attendee1, attendee2],  # Initial query for attendees
        [attendee1, attendee2]   # Query after deployment for status calculation
    ]
    
    # Mock failed deployment
    with patch('tasks.terraform_tasks.SessionLocal') as mock_session_local:
        mock_session_local.return_value = mock_db
        
        with patch('tasks.terraform_tasks.deploy_attendee_resources.apply') as mock_deploy:
            # Mock failed deployment results
            mock_result1 = Mock()
            mock_result1.successful.return_value = False
            mock_result1.result = {'error': 'Deployment failed'}
            
            mock_result2 = Mock()
            mock_result2.successful.return_value = False
            mock_result2.result = {'error': 'Deployment failed'}
            
            mock_deploy.side_effect = [mock_result1, mock_result2]
            
            # Simulate attendees failing after deployment
            def update_attendee_status(*args, **kwargs):
                attendee1.status = 'failed'
                attendee2.status = 'failed'
                return [attendee1, attendee2]
            
            # Update the second call to return failed attendees
            mock_db.query.return_value.filter.return_value.all.side_effect = [
                [attendee1, attendee2],  # Initial query
                update_attendee_status()  # Query after deployment
            ]
            
            with patch('tasks.terraform_tasks.broadcast_deployment_progress'):
                with patch('tasks.terraform_tasks.broadcast_status_update'):
                    # Create mock task
                    mock_task = MagicMock()
                    mock_task.update_state = Mock()
                    
                    # Run the sequential deployment
                    with patch('tasks.terraform_tasks.deploy_workshop_attendees_sequential.request', mock_task):
                        result = deploy_workshop_attendees_sequential(workshop_id)
            
            # Verify workshop status was updated to 'failed'
            assert mock_workshop.status == 'failed'
            assert mock_db.commit.called
            
            # Verify the result
            assert result['attendees_deployed'] == 0
            assert result['attendees_failed'] == 2
            assert result['workshop_status'] == 'failed'


def test_workshop_status_remains_deploying_during_partial_deployment():
    """Test that workshop status remains 'deploying' when only some attendees are deployed."""
    
    # Create mock database session
    mock_db = Mock(spec=Session)
    
    # Create test workshop in deploying state
    workshop_id = str(uuid4())
    mock_workshop = Mock(spec=Workshop)
    mock_workshop.id = workshop_id
    mock_workshop.status = 'deploying'
    
    # Create test attendees
    attendee1 = Mock(spec=Attendee)
    attendee1.id = uuid4()
    attendee1.username = 'user1'
    attendee1.status = 'planning'
    attendee1.workshop_id = workshop_id
    
    attendee2 = Mock(spec=Attendee)
    attendee2.id = uuid4()
    attendee2.username = 'user2'
    attendee2.status = 'planning'
    attendee2.workshop_id = workshop_id
    
    # Mock database queries
    mock_db.query.return_value.filter.return_value.first.return_value = mock_workshop
    mock_db.query.return_value.filter.return_value.all.side_effect = [
        [attendee1, attendee2],  # Initial query for attendees
        [attendee1, attendee2]   # Query after deployment for status calculation
    ]
    
    # Mock mixed deployment results
    with patch('tasks.terraform_tasks.SessionLocal') as mock_session_local:
        mock_session_local.return_value = mock_db
        
        with patch('tasks.terraform_tasks.deploy_attendee_resources.apply') as mock_deploy:
            # Mock one success and one failure
            mock_result1 = Mock()
            mock_result1.successful.return_value = True
            mock_result1.result = {'success': True}
            
            mock_result2 = Mock()
            mock_result2.successful.return_value = False
            mock_result2.result = {'error': 'Deployment failed'}
            
            mock_deploy.side_effect = [mock_result1, mock_result2]
            
            # Simulate mixed attendee statuses after deployment
            def update_attendee_status(*args, **kwargs):
                attendee1.status = 'active'
                attendee2.status = 'failed'
                return [attendee1, attendee2]
            
            # Update the second call to return mixed status attendees
            mock_db.query.return_value.filter.return_value.all.side_effect = [
                [attendee1, attendee2],  # Initial query
                update_attendee_status()  # Query after deployment
            ]
            
            with patch('tasks.terraform_tasks.broadcast_deployment_progress'):
                with patch('tasks.terraform_tasks.broadcast_status_update'):
                    # Create mock task
                    mock_task = MagicMock()
                    mock_task.update_state = Mock()
                    
                    # Run the sequential deployment
                    with patch('tasks.terraform_tasks.deploy_workshop_attendees_sequential.request', mock_task):
                        result = deploy_workshop_attendees_sequential(workshop_id)
            
            # Verify workshop status was updated to 'failed' (worst status wins)
            assert mock_workshop.status == 'failed'
            assert mock_db.commit.called
            
            # Verify the result
            assert result['attendees_deployed'] == 1
            assert result['attendees_failed'] == 1
            assert result['workshop_status'] == 'failed'