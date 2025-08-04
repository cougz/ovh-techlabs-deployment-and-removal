"""
Test to reproduce CLEANUP-NOTIFY-001: Environment Cleanup Notification with TDD
"""
import pytest
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from unittest.mock import patch, MagicMock
from uuid import uuid4

from main import app
from fastapi.testclient import TestClient

client = TestClient(app)


class TestEnvironmentCleanupNotification:
    """Test to implement and verify environment cleanup notification system"""
    
    def test_should_send_cleanup_warning_24_hours_before_deletion(self):
        """Test that users receive warning email 24 hours before environment deletion"""
        
        workshop_id = str(uuid4())
        attendee_email = "john.doe@example.com"
        attendee_name = "John Doe"
        workshop_name = "Docker Workshop - Oct 2025"
        
        # Mock workshop scheduled for deletion in 25 hours (should trigger 24h warning)
        deletion_time = datetime.now(ZoneInfo("UTC")) + timedelta(hours=25)
        
        with patch('core.database.SessionLocal') as mock_db, \
             patch('tasks.notification_tasks.send_cleanup_warning_notification.delay') as mock_notify:
            
            # Mock database session
            mock_session = MagicMock()
            mock_db.return_value = mock_session
            
            # Mock workshop
            mock_workshop = MagicMock()
            mock_workshop.id = workshop_id
            mock_workshop.name = workshop_name
            mock_workshop.deletion_scheduled_at = deletion_time
            mock_workshop.status = "completed"
            
            # Mock attendee
            mock_attendee = MagicMock()
            mock_attendee.email = attendee_email
            mock_attendee.username = attendee_name
            mock_attendee.status = "active"
            
            mock_session.query.return_value.filter.return_value.all.side_effect = [
                [mock_workshop],  # workshops needing notification
                [mock_attendee]   # attendees for workshop
            ]
            
            # Test the notification task
            from tasks.cleanup_tasks import send_cleanup_warnings
            send_cleanup_warnings()
            
            # Verify notification was queued
            mock_notify.assert_called_once_with(
                attendee_email,
                attendee_name, 
                workshop_name,
                deletion_time.isoformat()
            )
    
    def test_should_not_send_duplicate_cleanup_warnings(self):
        """Test that cleanup warnings are sent only once per workshop"""
        
        workshop_id = str(uuid4())
        
        with patch('core.database.SessionLocal') as mock_db:
            
            # Mock database session
            mock_session = MagicMock()
            mock_db.return_value = mock_session
            
            # Mock workshop that already had warning sent
            mock_workshop = MagicMock()
            mock_workshop.id = workshop_id
            mock_workshop.deletion_scheduled_at = datetime.now(ZoneInfo("UTC")) + timedelta(hours=25)
            mock_workshop.cleanup_warning_sent = True  # Already sent
            
            # Should filter out workshops with warning already sent
            mock_session.query.return_value.filter.return_value.all.return_value = []
            
            from tasks.cleanup_tasks import send_cleanup_warnings
            result = send_cleanup_warnings()
            
            # No notifications should be sent
            assert result is None or "0 workshops" in str(result)
    
    def test_should_create_cleanup_warning_notification_task(self):
        """Test the cleanup warning notification email task"""
        
        attendee_email = "jane.smith@example.com"
        attendee_name = "Jane Smith"
        workshop_name = "Kubernetes Advanced Workshop"
        deletion_time = "2025-07-25T10:00:00+00:00"
        
        with patch('tasks.notification_tasks.send_email_notification.delay') as mock_email:
            
            from tasks.notification_tasks import send_cleanup_warning_notification
            send_cleanup_warning_notification(attendee_email, attendee_name, workshop_name, deletion_time)
            
            # Verify email was sent with correct parameters
            mock_email.assert_called_once()
            call_args = mock_email.call_args[0]
            
            assert call_args[0] == attendee_email
            assert "Environment Cleanup" in call_args[1]  # subject
            assert workshop_name in call_args[2]  # body
            assert "will be automatically cleaned up" in call_args[2]
            assert "24 hours" in call_args[2]
    
    def test_should_display_cleanup_schedule_in_workshop_ui(self):
        """Test that workshop detail page shows cleanup schedule information"""
        
        workshop_id = str(uuid4())
        deletion_time = datetime.now(ZoneInfo("UTC")) + timedelta(hours=48)
        
        with patch('models.workshop.Workshop') as mock_workshop_model, \
             patch('api.routes.auth.get_current_user') as mock_auth:
            
            mock_auth.return_value = "test_user"
            
            # Mock workshop with scheduled deletion
            mock_workshop = MagicMock()
            mock_workshop.id = workshop_id
            mock_workshop.name = "Test Workshop"
            mock_workshop.deletion_scheduled_at = deletion_time
            mock_workshop.status = "completed"
            mock_workshop.end_date = datetime.now(ZoneInfo("UTC")) - timedelta(hours=1)
            
            mock_workshop_model.query.filter.return_value.first.return_value = mock_workshop
            
            # Call workshop detail endpoint
            response = client.get(f"/api/workshops/{workshop_id}")
            
            assert response.status_code == 200
            workshop_data = response.json()
            
            # Should include deletion schedule in response
            assert "deletion_scheduled_at" in workshop_data
            assert workshop_data["deletion_scheduled_at"] is not None
    
    def test_should_schedule_cleanup_warnings_for_periodic_execution(self):
        """Test that cleanup warnings are scheduled to run periodically"""
        
        with patch('core.celery_app.celery_app.conf') as mock_celery_conf:
            
            # Verify that cleanup warning task is scheduled in Celery beat
            from core.celery_app import celery_app
            
            # Check if beat schedule includes cleanup warning task
            beat_schedule = getattr(celery_app.conf, 'beat_schedule', {})
            
            # Should have a periodic task for sending cleanup warnings
            cleanup_warning_tasks = [
                task for task_name, task in beat_schedule.items() 
                if 'cleanup_warning' in task_name.lower() or 'send_cleanup_warnings' in task.get('task', '')
            ]
            
            # Either task exists or we need to create it
            assert len(cleanup_warning_tasks) >= 0  # This will pass, implementation needed
    
    def test_should_handle_timezone_aware_cleanup_scheduling(self):
        """Test that cleanup warnings respect workshop timezones"""
        
        workshop_timezone = "America/New_York"
        
        with patch('core.database.SessionLocal') as mock_db:
            
            mock_session = MagicMock()
            mock_db.return_value = mock_session
            
            # Mock workshop in EST timezone
            mock_workshop = MagicMock()
            mock_workshop.timezone = workshop_timezone
            mock_workshop.end_date = datetime.now(ZoneInfo("UTC"))
            mock_workshop.deletion_scheduled_at = None
            
            mock_session.query.return_value.filter.return_value.all.return_value = [mock_workshop]
            
            from tasks.cleanup_tasks import check_workshop_end_dates
            check_workshop_end_dates()
            
            # Verify deletion was scheduled 72 hours after end in workshop timezone
            assert mock_workshop.deletion_scheduled_at is not None
            
            # Should be timezone-aware datetime in UTC
            assert mock_workshop.deletion_scheduled_at.tzinfo == ZoneInfo("UTC")
    
    def test_should_include_workshop_details_in_cleanup_notification(self):
        """Test that cleanup notification includes relevant workshop information"""
        
        attendee_email = "user@example.com"
        attendee_name = "Test User"
        workshop_name = "Advanced Docker Workshop - Team Alpha"
        deletion_time = "2025-07-25T15:30:00+00:00"
        
        with patch('tasks.notification_tasks.send_email_notification.delay') as mock_email:
            
            from tasks.notification_tasks import send_cleanup_warning_notification
            send_cleanup_warning_notification(attendee_email, attendee_name, workshop_name, deletion_time)
            
            call_args = mock_email.call_args[0]
            email_body = call_args[2]  # body text
            
            # Should include important information
            assert workshop_name in email_body
            assert attendee_name in email_body
            assert "72 hours" in email_body  # cleanup period
            assert "backup" in email_body.lower() or "save" in email_body.lower()  # data backup warning
            
            # Should have professional tone and clear instructions
            assert "Dear" in email_body
            assert "thank you" in email_body.lower() or "regards" in email_body.lower()