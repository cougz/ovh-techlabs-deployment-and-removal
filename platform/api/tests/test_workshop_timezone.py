#!/usr/bin/env python3
"""
Test suite for timezone-aware workshop dates and cleanup.
"""
import pytest
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from unittest.mock import patch

from models.workshop import Workshop
from schemas.workshop import WorkshopCreate, WorkshopCreateWithTimezone
from tasks.cleanup_tasks import check_workshop_end_dates, cleanup_expired_workshops
from core.database import SessionLocal


class TestWorkshopTimezone:
    """Test suite for timezone-aware workshop functionality."""
    
    def test_should_accept_timezone_aware_workshop_dates(self):
        """Should accept workshop creation with timezone-aware dates."""
        # This test will fail because WorkshopCreateWithTimezone doesn't exist yet
        madrid_tz = ZoneInfo("Europe/Madrid")
        start_date = datetime(2025, 7, 10, 9, 0, 0, tzinfo=madrid_tz)
        end_date = datetime(2025, 7, 10, 17, 0, 0, tzinfo=madrid_tz)
        
        workshop_data = WorkshopCreateWithTimezone(
            name="Madrid Workshop",
            description="Workshop in Madrid timezone",
            start_date=start_date,
            end_date=end_date,
            timezone="Europe/Madrid"
        )
        
        assert workshop_data.start_date.tzinfo == madrid_tz
        assert workshop_data.end_date.tzinfo == madrid_tz
        assert workshop_data.timezone == "Europe/Madrid"
    
    def test_should_convert_workshop_dates_to_correct_timezone(self):
        """Should convert workshop dates to specified timezone."""
        # Test with India timezone
        india_tz = ZoneInfo("Asia/Kolkata")
        start_date = datetime(2025, 7, 10, 14, 30, 0, tzinfo=india_tz)  # 2:30 PM IST
        end_date = datetime(2025, 7, 10, 22, 30, 0, tzinfo=india_tz)    # 10:30 PM IST
        
        workshop_data = WorkshopCreateWithTimezone(
            name="Bangalore Workshop",
            description="Workshop in India timezone",
            start_date=start_date,
            end_date=end_date,
            timezone="Asia/Kolkata"
        )
        
        # Should maintain the timezone info
        assert workshop_data.start_date.tzinfo == india_tz
        assert workshop_data.end_date.tzinfo == india_tz
        
        # Should be able to convert to UTC for storage
        utc_start = workshop_data.start_date.astimezone(ZoneInfo("UTC"))
        utc_end = workshop_data.end_date.astimezone(ZoneInfo("UTC"))
        
        # IST is UTC+5:30, so 14:30 IST = 09:00 UTC
        assert utc_start.hour == 9
        assert utc_start.minute == 0
        assert utc_end.hour == 17
        assert utc_end.minute == 0
    
    def test_should_schedule_cleanup_based_on_workshop_timezone(self):
        """Should schedule cleanup 72 hours after workshop end date in workshop timezone."""
        db = SessionLocal()
        
        try:
            # Create a workshop that ended in Madrid timezone
            madrid_tz = ZoneInfo("Europe/Madrid")
            end_date = datetime(2025, 7, 8, 18, 0, 0, tzinfo=madrid_tz)  # 6 PM Madrid time
            
            workshop = Workshop(
                name="Madrid Workshop",
                description="Test workshop",
                start_date=datetime(2025, 7, 8, 9, 0, 0, tzinfo=madrid_tz),
                end_date=end_date,
                status="active",
                timezone="Europe/Madrid"  # This field doesn't exist yet, will make test fail
            )
            
            db.add(workshop)
            db.commit()
            
            # Mock current time to be after workshop end
            mock_time = end_date + timedelta(hours=1)
            with patch('tasks.cleanup_tasks.datetime') as mock_datetime:
                mock_datetime.utcnow.return_value = mock_time.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
                check_workshop_end_dates()
                
                # Refresh workshop from database
                db.refresh(workshop)
                
                # Should schedule deletion 72 hours after end date in Madrid timezone
                expected_deletion = end_date + timedelta(hours=72)
                assert workshop.deletion_scheduled_at == expected_deletion
                assert workshop.status == "completed"
                
        finally:
            db.close()
    
    def test_should_handle_timezone_conversion_for_cleanup(self):
        """Should handle timezone conversion correctly when cleaning up workshops."""
        db = SessionLocal()
        
        try:
            # Create a workshop in India timezone that should be cleaned up
            india_tz = ZoneInfo("Asia/Kolkata")
            end_date = datetime(2025, 7, 5, 17, 0, 0, tzinfo=india_tz)  # 5 PM IST
            deletion_scheduled = end_date + timedelta(hours=72)
            
            workshop = Workshop(
                name="Bangalore Workshop",
                description="Test workshop",
                start_date=datetime(2025, 7, 5, 9, 0, 0, tzinfo=india_tz),
                end_date=end_date,
                status="completed",
                deletion_scheduled_at=deletion_scheduled,
                timezone="Asia/Kolkata"
            )
            
            db.add(workshop)
            db.commit()
            
            # Mock current time to be after scheduled deletion time
            mock_time = deletion_scheduled + timedelta(hours=1)
            with patch('tasks.cleanup_tasks.datetime') as mock_datetime:
                mock_datetime.utcnow.return_value = mock_time.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
                cleanup_expired_workshops()
                
                # Refresh workshop from database
                db.refresh(workshop)
                
                # Should update status to deleting
                assert workshop.status == "deleting"
                
        finally:
            db.close()
    
    def test_should_validate_supported_timezones(self):
        """Should validate that only supported timezones are accepted."""
        # Test with unsupported timezone
        with pytest.raises(ValueError, match="Unsupported timezone"):
            WorkshopCreateWithTimezone(
                name="Invalid Timezone Workshop",
                description="Workshop with invalid timezone",
                start_date=datetime(2025, 7, 10, 9, 0, 0),
                end_date=datetime(2025, 7, 10, 17, 0, 0),
                timezone="Invalid/Timezone"
            )
        
        # Test with supported timezones
        supported_timezones = [
            "Europe/Madrid",
            "Asia/Kolkata",
            "UTC",
            "America/New_York",
            "Europe/London"
        ]
        
        for tz in supported_timezones:
            tz_obj = ZoneInfo(tz)
            workshop_data = WorkshopCreateWithTimezone(
                name=f"Workshop in {tz}",
                description="Test workshop",
                start_date=datetime(2025, 7, 10, 9, 0, 0, tzinfo=tz_obj),
                end_date=datetime(2025, 7, 10, 17, 0, 0, tzinfo=tz_obj),
                timezone=tz
            )
            
            assert workshop_data.timezone == tz
    
    def test_should_migrate_existing_workshops_to_timezone_aware(self):
        """Should migrate existing workshops to be timezone-aware."""
        db = SessionLocal()
        
        try:
            # Create a workshop with naive datetime (existing behavior)
            workshop = Workshop(
                name="Legacy Workshop",
                description="Workshop created before timezone support",
                start_date=datetime(2025, 7, 10, 9, 0, 0),  # Naive datetime
                end_date=datetime(2025, 7, 10, 17, 0, 0),   # Naive datetime
                status="active"
            )
            
            db.add(workshop)
            db.commit()
            
            # Run migration function (doesn't exist yet)
            from tasks.migration_tasks import migrate_workshops_to_timezone_aware
            migrate_workshops_to_timezone_aware()
            
            # Refresh workshop from database
            db.refresh(workshop)
            
            # Should have timezone field set to UTC by default
            assert workshop.timezone == "UTC"
            assert workshop.start_date.tzinfo is not None
            assert workshop.end_date.tzinfo is not None
            
        finally:
            db.close()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])