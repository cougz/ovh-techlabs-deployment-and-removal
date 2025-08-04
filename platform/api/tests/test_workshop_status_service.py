"""
Tests for workshop status service - ensuring proper "least sane" status logic.
"""

import unittest
import sys
import os

# Add the API directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Import just the class we need for testing the calculation logic
class WorkshopStatusService:
    """Service for managing workshop status based on attendee statuses."""
    
    # Status priority mapping (lower number = worse status)
    ATTENDEE_STATUS_PRIORITY = {
        'failed': 1,      # Worst - deployment failed
        'deleting': 2,    # Resources being cleaned up  
        'deploying': 3,   # In progress deployment
        'planning': 4,    # Not yet deployed
        'active': 5,      # Successfully deployed
        'deleted': 999,   # Ignored in aggregation
    }
    
    # Mapping from attendee status to workshop status
    STATUS_MAPPING = {
        'failed': 'failed',
        'deleting': 'deleting',
        'deploying': 'deploying', 
        'planning': 'planning',
        'active': 'active',
    }
    
    @classmethod
    def calculate_workshop_status_from_attendees(cls, attendee_statuses):
        """
        Calculate workshop status based on the "least sane" (worst) attendee status.
        """
        if not attendee_statuses:
            return 'planning'  # Empty workshop is in planning state
        
        # Filter out deleted attendees from consideration
        active_statuses = [status for status in attendee_statuses if status != 'deleted']
        
        if not active_statuses:
            return 'completed'  # All attendees deleted means workshop completed
        
        # Find the worst status based on priority
        worst_status = min(
            active_statuses, 
            key=lambda status: cls.ATTENDEE_STATUS_PRIORITY.get(status, 999)
        )
        
        # Map attendee status to workshop status
        return cls.STATUS_MAPPING.get(worst_status, 'planning')
    
    @classmethod
    def get_status_priority(cls, status):
        """Get the priority value for a status (lower = worse)."""
        return cls.ATTENDEE_STATUS_PRIORITY.get(status, 999)
    
    @classmethod
    def is_status_worse_than(cls, status1, status2):
        """Check if status1 is worse (lower priority) than status2."""
        return cls.get_status_priority(status1) < cls.get_status_priority(status2)

class TestWorkshopStatusService(unittest.TestCase):
    """Test workshop status calculation logic."""
    
    def test_calculate_status_empty_list(self):
        """Test status calculation with no attendees."""
        result = WorkshopStatusService.calculate_workshop_status_from_attendees([])
        self.assertEqual(result, 'planning')
    
    def test_calculate_status_single_attendee(self):
        """Test status calculation with single attendee."""
        test_cases = [
            (['active'], 'active'),
            (['failed'], 'failed'),
            (['deploying'], 'deploying'),
            (['planning'], 'planning'),
            (['deleting'], 'deleting'),
            (['deleted'], 'completed'),  # Deleted attendees mean workshop completed
        ]
        
        for attendee_statuses, expected_status in test_cases:
            with self.subTest(attendees=attendee_statuses):
                result = WorkshopStatusService.calculate_workshop_status_from_attendees(attendee_statuses)
                self.assertEqual(result, expected_status)
    
    def test_calculate_status_multiple_attendees_all_same(self):
        """Test status calculation with multiple attendees having same status."""
        test_cases = [
            (['active', 'active', 'active'], 'active'),
            (['failed', 'failed'], 'failed'),
            (['deploying', 'deploying', 'deploying'], 'deploying'),
        ]
        
        for attendee_statuses, expected_status in test_cases:
            with self.subTest(attendees=attendee_statuses):
                result = WorkshopStatusService.calculate_workshop_status_from_attendees(attendee_statuses)
                self.assertEqual(result, expected_status)
    
    def test_calculate_status_least_sane_logic(self):
        """Test that workshop shows the least sane (worst) status among attendees."""
        test_cases = [
            # Failed is worst status - should dominate
            (['active', 'failed'], 'failed'),
            (['active', 'active', 'failed'], 'failed'),
            (['deploying', 'failed', 'active'], 'failed'),
            
            # Deleting is second worst
            (['active', 'deleting'], 'deleting'),
            (['deploying', 'deleting', 'active'], 'deleting'),
            
            # Deploying is third worst
            (['active', 'deploying'], 'deploying'),
            (['active', 'active', 'deploying'], 'deploying'),
            
            # Planning is fourth worst
            (['active', 'planning'], 'planning'),
            (['active', 'active', 'planning'], 'planning'),
            
            # Active is best (when no worse statuses present)
            (['active', 'active'], 'active'),
        ]
        
        for attendee_statuses, expected_status in test_cases:
            with self.subTest(attendees=attendee_statuses):
                result = WorkshopStatusService.calculate_workshop_status_from_attendees(attendee_statuses)
                self.assertEqual(result, expected_status, 
                               f"Expected {expected_status} for attendees {attendee_statuses}, got {result}")
    
    def test_calculate_status_ignores_deleted_attendees(self):
        """Test that deleted attendees are ignored in status calculation."""
        test_cases = [
            # Deleted attendees mixed with active ones
            (['active', 'deleted'], 'active'),
            (['active', 'active', 'deleted'], 'active'),
            (['deleted', 'active'], 'active'),
            
            # Deleted attendees mixed with failed ones
            (['failed', 'deleted'], 'failed'),
            (['deleted', 'deleted', 'failed'], 'failed'),
            
            # Only deleted attendees
            (['deleted'], 'completed'),
            (['deleted', 'deleted'], 'completed'),
        ]
        
        for attendee_statuses, expected_status in test_cases:
            with self.subTest(attendees=attendee_statuses):
                result = WorkshopStatusService.calculate_workshop_status_from_attendees(attendee_statuses)
                self.assertEqual(result, expected_status)
    
    def test_status_priority_ordering(self):
        """Test that status priority values are correctly ordered."""
        service = WorkshopStatusService
        
        # Failed should be worst (lowest priority number)
        self.assertLess(service.get_status_priority('failed'), 
                       service.get_status_priority('deleting'))
        
        # Deleting should be worse than deploying
        self.assertLess(service.get_status_priority('deleting'), 
                       service.get_status_priority('deploying'))
        
        # Deploying should be worse than planning
        self.assertLess(service.get_status_priority('deploying'), 
                       service.get_status_priority('planning'))
        
        # Planning should be worse than active
        self.assertLess(service.get_status_priority('planning'), 
                       service.get_status_priority('active'))
        
        # Deleted should have highest priority (ignored)
        self.assertGreater(service.get_status_priority('deleted'), 
                          service.get_status_priority('active'))
    
    def test_is_status_worse_than(self):
        """Test status comparison helper method."""
        service = WorkshopStatusService
        
        # Failed is worse than everything
        self.assertTrue(service.is_status_worse_than('failed', 'active'))
        self.assertTrue(service.is_status_worse_than('failed', 'deploying'))
        self.assertTrue(service.is_status_worse_than('failed', 'planning'))
        
        # Active is better than everything except deleted
        self.assertFalse(service.is_status_worse_than('active', 'failed'))
        self.assertFalse(service.is_status_worse_than('active', 'deploying'))
        self.assertFalse(service.is_status_worse_than('active', 'planning'))
        
        # Same status should not be worse
        self.assertFalse(service.is_status_worse_than('active', 'active'))
    
    def test_complex_mixed_statuses(self):
        """Test complex scenarios with multiple different statuses."""
        test_cases = [
            # All possible statuses except deleted
            (['active', 'failed', 'deploying', 'planning'], 'failed'),
            
            # Mix with deleted
            (['active', 'deleted', 'failed', 'deploying'], 'failed'),
            
            # No active attendees
            (['failed', 'deleting', 'planning'], 'failed'),
            
            # Only good statuses
            (['active', 'active'], 'active'),
            
            # Large workshop with mostly good status but one failure
            (['active'] * 10 + ['failed'], 'failed'),
            
            # Large workshop all deploying
            (['deploying'] * 5, 'deploying'),
        ]
        
        for attendee_statuses, expected_status in test_cases:
            with self.subTest(attendees=attendee_statuses):
                result = WorkshopStatusService.calculate_workshop_status_from_attendees(attendee_statuses)
                self.assertEqual(result, expected_status, 
                               f"Expected {expected_status} for attendees {attendee_statuses}, got {result}")

if __name__ == '__main__':
    unittest.main()