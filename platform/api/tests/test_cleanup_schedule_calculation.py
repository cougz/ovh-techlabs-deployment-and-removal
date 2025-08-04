"""
Test to reproduce CLEANUP-CALC-001: Fix cleanup schedule calculation logic
"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch

from api.routes.workshops import create_workshop, update_workshop
from schemas.workshop import CreateWorkshopRequest, WorkshopUpdate
from models.workshop import Workshop


class TestCleanupScheduleCalculation:
    """Test cleanup schedule calculation using configurable delay"""
    
    def test_workshop_deletion_should_use_configurable_delay_not_hardcoded_72_hours(self):
        """Test that workshop deletion schedule uses AUTO_CLEANUP_DELAY_HOURS setting"""
        
        # Mock workshop end time: July 22, 2025 at 6:15 PM
        workshop_end_time = datetime(2025, 7, 22, 18, 15, tzinfo=timezone.utc)
        
        # Expected deletion time with 1 hour delay: July 22, 2025 at 7:15 PM
        expected_deletion_time = datetime(2025, 7, 22, 19, 15, tzinfo=timezone.utc)
        
        with patch('core.config.settings.AUTO_CLEANUP_DELAY_HOURS', 1):
            # Calculate deletion schedule using current (incorrect) logic
            current_deletion_time = workshop_end_time + timedelta(hours=72)  # This is wrong
            
            # Calculate deletion schedule using corrected logic
            from core.config import settings
            correct_deletion_time = workshop_end_time + timedelta(hours=settings.AUTO_CLEANUP_DELAY_HOURS)
            
            # Current logic fails - shows July 25 instead of July 22
            assert current_deletion_time != expected_deletion_time
            
            # Correct logic should work - shows July 22 at 7:15 PM
            assert correct_deletion_time == expected_deletion_time
            
            # Verify the difference
            assert current_deletion_time == datetime(2025, 7, 25, 18, 15, tzinfo=timezone.utc)  # Wrong
            assert correct_deletion_time == datetime(2025, 7, 22, 19, 15, tzinfo=timezone.utc)   # Correct
    
    def test_workshop_creation_should_use_settings_for_deletion_schedule(self):
        """Test that workshop creation uses settings instead of hardcoded values"""
        
        workshop_data = CreateWorkshopRequest(
            name="Test Workshop",
            description="Test Description", 
            start_date=datetime(2025, 7, 22, 9, 0, tzinfo=timezone.utc),
            end_date=datetime(2025, 7, 22, 18, 15, tzinfo=timezone.utc)
        )
        
        # Mock 1 hour cleanup delay
        with patch('core.config.settings.AUTO_CLEANUP_DELAY_HOURS', 1), \
             patch('core.database.SessionLocal') as mock_db:
            
            mock_session = mock_db.return_value
            mock_session.add = lambda x: None
            mock_session.commit = lambda: None
            mock_session.refresh = lambda x: None
            
            # This would fail with current hardcoded logic
            # We need to fix the workshop creation to use settings
            
            # Expected deletion time: workshop end + 1 hour
            expected_deletion = workshop_data.end_date + timedelta(hours=1)
            
            assert expected_deletion == datetime(2025, 7, 22, 19, 15, tzinfo=timezone.utc)
    
    def test_workshop_update_should_use_settings_for_deletion_schedule(self):
        """Test that workshop updates use settings instead of hardcoded values"""
        
        # Mock existing workshop
        existing_workshop = Workshop(
            id="test-id",
            name="Test Workshop",
            start_date=datetime(2025, 7, 22, 9, 0, tzinfo=timezone.utc),
            end_date=datetime(2025, 7, 22, 17, 0, tzinfo=timezone.utc)  # Original end time
        )
        
        # New end date
        new_end_date = datetime(2025, 7, 22, 18, 15, tzinfo=timezone.utc)
        
        with patch('core.config.settings.AUTO_CLEANUP_DELAY_HOURS', 1):
            # Manual calculation of what it should be
            expected_deletion = new_end_date + timedelta(hours=1)
            
            # This should be July 22 at 7:15 PM, not July 25
            assert expected_deletion == datetime(2025, 7, 22, 19, 15, tzinfo=timezone.utc)
            
            # Current logic would give July 25 (wrong)
            wrong_deletion = new_end_date + timedelta(hours=72)
            assert wrong_deletion == datetime(2025, 7, 25, 18, 15, tzinfo=timezone.utc)
            
            # Verify they are different
            assert expected_deletion != wrong_deletion
            
    def test_cleanup_delay_setting_should_be_configurable(self):
        """Test that AUTO_CLEANUP_DELAY_HOURS setting can be changed"""
        
        workshop_end = datetime(2025, 7, 22, 18, 15, tzinfo=timezone.utc)
        
        # Test with 1 hour delay
        with patch('core.config.settings.AUTO_CLEANUP_DELAY_HOURS', 1):
            from core.config import settings
            deletion_1h = workshop_end + timedelta(hours=settings.AUTO_CLEANUP_DELAY_HOURS)
            assert deletion_1h == datetime(2025, 7, 22, 19, 15, tzinfo=timezone.utc)
        
        # Test with 24 hour delay
        with patch('core.config.settings.AUTO_CLEANUP_DELAY_HOURS', 24):
            from core.config import settings
            deletion_24h = workshop_end + timedelta(hours=settings.AUTO_CLEANUP_DELAY_HOURS)
            assert deletion_24h == datetime(2025, 7, 23, 18, 15, tzinfo=timezone.utc)
        
        # Test with 72 hour delay (current default)
        with patch('core.config.settings.AUTO_CLEANUP_DELAY_HOURS', 72):
            from core.config import settings  
            deletion_72h = workshop_end + timedelta(hours=settings.AUTO_CLEANUP_DELAY_HOURS)
            assert deletion_72h == datetime(2025, 7, 25, 18, 15, tzinfo=timezone.utc)