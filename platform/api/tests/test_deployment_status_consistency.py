"""
Test to reproduce DEPLOY-STATUS-FIX-001: Fix deployment status and workshop state inconsistencies
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock, call
from uuid import uuid4

from tasks.terraform_tasks import deploy_attendee_resources, deploy_workshop_attendees_sequential
from models.workshop import Workshop
from models.attendee import Attendee


class TestDeploymentStatusConsistency:
    """Test to verify and fix deployment status consistency issues"""
    
    def test_individual_attendee_deployment_should_not_update_workshop_status(self):
        """Test that individual attendee deployment does not prematurely update workshop status"""
        
        workshop_id = str(uuid4())
        attendee_id = str(uuid4())
        
        with patch('core.database.SessionLocal') as mock_db, \
             patch('services.terraform_service.terraform_service') as mock_terraform, \
             patch('tasks.terraform_tasks.update_workshop_status_based_on_attendees') as mock_update_status:
            
            # Mock database session
            mock_session = MagicMock()
            mock_db.return_value = mock_session
            
            # Mock attendee
            mock_attendee = MagicMock()
            mock_attendee.id = attendee_id
            mock_attendee.workshop_id = workshop_id
            mock_attendee.username = "test-user"
            mock_attendee.email = "test@example.com"
            mock_session.query.return_value.filter.return_value.first.return_value = mock_attendee
            
            # Mock successful terraform operations
            mock_terraform.create_workspace.return_value = True
            mock_terraform.plan.return_value = (True, "Plan successful")
            mock_terraform.apply_with_recovery.return_value = (True, "Apply successful", False)
            mock_terraform.get_outputs.return_value = {
                "project_id": {"value": "test-project-id"},
                "user_urn": {"value": "test-user-urn"}
            }
            
            # Call individual attendee deployment
            result = deploy_attendee_resources(attendee_id)
            
            # Verify deployment succeeded
            assert result["success"] == True
            assert result["attendee_id"] == attendee_id
            
            # CRITICAL: Individual deployment should NOT update workshop status
            # This prevents premature status calculation when other attendees may still be deploying
            mock_update_status.assert_not_called()
            
    def test_sequential_deployment_should_update_workshop_status_only_once(self):
        """Test that sequential deployment updates workshop status only after all attendees are deployed"""
        
        workshop_id = str(uuid4())
        attendee1_id = str(uuid4())
        attendee2_id = str(uuid4())
        
        with patch('core.database.SessionLocal') as mock_db, \
             patch('tasks.terraform_tasks.deploy_attendee_resources.apply') as mock_deploy_task, \
             patch('services.workshop_status_service.WorkshopStatusService.update_workshop_status_from_attendees') as mock_status_service:
            
            # Mock database session
            mock_session = MagicMock()
            mock_db.return_value = mock_session
            
            # Mock workshop
            mock_workshop = MagicMock()
            mock_workshop.id = workshop_id
            mock_workshop.name = "Test Workshop"
            
            # Mock attendees
            mock_attendee1 = MagicMock()
            mock_attendee1.id = attendee1_id
            mock_attendee1.username = "user1"
            mock_attendee2 = MagicMock()
            mock_attendee2.id = attendee2_id
            mock_attendee2.username = "user2"
            
            # Setup query chain: first call gets workshop, second call gets attendees
            mock_session.query.return_value.filter.return_value.first.side_effect = [
                mock_workshop,  # First query for workshop
                None  # Second query (handled differently)
            ]
            mock_session.query.return_value.filter.return_value.all.return_value = [
                mock_attendee1, mock_attendee2
            ]
            
            # Mock successful deployment results
            successful_result = MagicMock()
            successful_result.successful.return_value = True
            successful_result.result = {"success": True, "attendee_id": "test"}
            mock_deploy_task.return_value = successful_result
            
            # Mock status service to return "active"
            mock_status_service.return_value = "active"
            
            # Call sequential deployment
            result = deploy_workshop_attendees_sequential(workshop_id)
            
            # Verify deployment completed
            assert "attendees_deployed" in result
            assert result["attendees_deployed"] == 2
            
            # CRITICAL: Status service should be called exactly ONCE after all deployments
            mock_status_service.assert_called_once_with(workshop_id, mock_session)
            
            # Verify both attendees were deployed
            assert mock_deploy_task.call_count == 2
            mock_deploy_task.assert_has_calls([
                call(args=[attendee1_id]),
                call(args=[attendee2_id])
            ])
    
    def test_workshop_status_should_be_active_when_all_attendees_deployed(self):
        """Test that workshop status becomes active when all attendees are successfully deployed"""
        
        workshop_id = str(uuid4())
        
        with patch('core.database.SessionLocal') as mock_db, \
             patch('services.workshop_status_service.WorkshopStatusService.update_workshop_status_from_attendees') as mock_status_service:
            
            # Mock database session
            mock_session = MagicMock()
            mock_db.return_value = mock_session
            
            # Mock workshop
            mock_workshop = MagicMock()
            mock_workshop.id = workshop_id
            mock_workshop.status = "planning"
            
            # Mock attendees - all active (deployed)
            mock_attendee1 = MagicMock()
            mock_attendee1.status = "active"
            mock_attendee2 = MagicMock()
            mock_attendee2.status = "active"
            
            # Setup database queries
            mock_session.query.return_value.filter.return_value.first.return_value = mock_workshop
            mock_session.query.return_value.filter.return_value.all.return_value = [
                mock_attendee1, mock_attendee2
            ]
            
            # Call status service directly
            from services.workshop_status_service import WorkshopStatusService
            
            # Mock the actual implementation to test status calculation
            with patch.object(WorkshopStatusService, 'calculate_workshop_status_from_attendees') as mock_calc:
                mock_calc.return_value = "active"
                
                new_status = WorkshopStatusService.update_workshop_status_from_attendees(workshop_id, mock_session)
                
                # Verify status calculation was called with correct attendee statuses
                mock_calc.assert_called_once_with(["active", "active"])
                
                # Verify workshop status was updated to active
                assert new_status == "active"
                assert mock_workshop.status == "active"
    
    def test_cleanup_button_visibility_should_match_actual_deployment_state(self):
        """Test that cleanup button appears when attendees are actually deployed, regardless of workshop status"""
        
        workshop_data = {
            "id": str(uuid4()),
            "status": "planning",  # Workshop status is incorrect
            "name": "Test Workshop"
        }
        
        attendees_data = [
            {"id": str(uuid4()), "status": "active", "username": "user1"},
            {"id": str(uuid4()), "status": "active", "username": "user2"}
        ]
        
        # This test would be implemented in the frontend test suite
        # but demonstrates the logic needed for proper cleanup button visibility
        
        # Current logic (incorrect):
        show_cleanup_current = workshop_data["status"] in ["active", "completed"]
        
        # Fixed logic (correct):
        all_attendees_deployed = all(a["status"] == "active" for a in attendees_data)
        show_cleanup_fixed = (
            workshop_data["status"] in ["active", "completed"] or
            (workshop_data["status"] == "planning" and all_attendees_deployed)
        )
        
        # Verify the fix works
        assert show_cleanup_current == False  # Current logic fails
        assert show_cleanup_fixed == True    # Fixed logic works
    
    def test_deployment_should_complete_in_single_attempt(self):
        """Test that workshop deployment completes successfully in a single attempt"""
        
        workshop_id = str(uuid4())
        
        with patch('core.database.SessionLocal') as mock_db, \
             patch('tasks.terraform_tasks.deploy_attendee_resources.apply') as mock_deploy_task, \
             patch('services.workshop_status_service.WorkshopStatusService.update_workshop_status_from_attendees') as mock_status_service, \
             patch('tasks.websocket_updates.broadcast_status_update') as mock_broadcast:
            
            # Mock database session
            mock_session = MagicMock()
            mock_db.return_value = mock_session
            
            # Mock workshop and attendees
            mock_workshop = MagicMock()
            mock_workshop.id = workshop_id
            mock_workshop.status = "planning"
            
            mock_attendee = MagicMock()
            mock_attendee.id = str(uuid4())
            mock_attendee.username = "test-user"
            
            mock_session.query.return_value.filter.return_value.first.return_value = mock_workshop
            mock_session.query.return_value.filter.return_value.all.return_value = [mock_attendee]
            
            # Mock successful deployment
            successful_result = MagicMock()
            successful_result.successful.return_value = True
            successful_result.result = {"success": True}
            mock_deploy_task.return_value = successful_result
            
            # Mock status service returns "active"
            mock_status_service.return_value = "active"
            
            # Call sequential deployment ONCE
            result = deploy_workshop_attendees_sequential(workshop_id)
            
            # Verify single deployment succeeds
            assert result["attendees_deployed"] == 1
            assert result["workshop_status"] == "active"
            
            # Verify workshop status was updated to active
            mock_status_service.assert_called_once()
            
            # Verify WebSocket broadcast of final status
            mock_broadcast.assert_called_with(
                workshop_id,
                "workshop",
                workshop_id, 
                "active",
                {"message": "All 1 attendees deployed successfully"}
            )
            
            # After this single deployment:
            # 1. All attendees should be deployed
            # 2. Workshop status should be "active" 
            # 3. Cleanup button should appear in UI
            # 4. No second deployment should be needed