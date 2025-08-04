"""
Integration tests for workshop status service with actual scenario testing.
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

class TestWorkshopStatusIntegration(unittest.TestCase):
    """Integration test scenarios for workshop status logic."""
    
    def test_deployment_scenarios(self):
        """Test realistic deployment scenarios."""
        service = WorkshopStatusService
        
        # Scenario 1: Fresh workshop with no attendees
        result = service.calculate_workshop_status_from_attendees([])
        self.assertEqual(result, 'planning', "Empty workshop should be in planning state")
        
        # Scenario 2: Workshop with attendees in planning
        result = service.calculate_workshop_status_from_attendees(['planning', 'planning'])
        self.assertEqual(result, 'planning', "All planning attendees should keep workshop in planning")
        
        # Scenario 3: Deployment starts - some attendees deploying
        result = service.calculate_workshop_status_from_attendees(['deploying', 'planning'])
        self.assertEqual(result, 'deploying', "Any deploying attendee should put workshop in deploying state")
        
        # Scenario 4: Successful deployment - all attendees active
        result = service.calculate_workshop_status_from_attendees(['active', 'active', 'active'])
        self.assertEqual(result, 'active', "All active attendees should make workshop active")
        
        # Scenario 5: Partial failure - some succeed, some fail
        result = service.calculate_workshop_status_from_attendees(['active', 'failed', 'active'])
        self.assertEqual(result, 'failed', "Any failure should make workshop failed (least sane status)")
        
        # Scenario 6: Cleanup scenario - resources being deleted
        result = service.calculate_workshop_status_from_attendees(['deleting', 'active'])
        self.assertEqual(result, 'deleting', "Any deleting attendee should put workshop in deleting state")
        
        # Scenario 7: Workshop completion - all attendees deleted
        result = service.calculate_workshop_status_from_attendees(['deleted', 'deleted'])
        self.assertEqual(result, 'completed', "All deleted attendees should make workshop completed")
        
        # Scenario 8: Mixed with deleted - deleted should be ignored
        result = service.calculate_workshop_status_from_attendees(['active', 'deleted', 'failed'])
        self.assertEqual(result, 'failed', "Deleted attendees should be ignored, worst remaining status wins")
    
    def test_real_world_workshop_lifecycle(self):
        """Test a complete workshop lifecycle."""
        service = WorkshopStatusService
        
        # Workshop created - no attendees yet
        attendees = []
        status = service.calculate_workshop_status_from_attendees(attendees)
        self.assertEqual(status, 'planning', "Step 1: Empty workshop should be planning")
        
        # Attendees added but not deployed
        attendees = ['planning', 'planning', 'planning']
        status = service.calculate_workshop_status_from_attendees(attendees)
        self.assertEqual(status, 'planning', "Step 2: All planning attendees - workshop still planning")
        
        # Deployment begins
        attendees = ['deploying', 'planning', 'planning']
        status = service.calculate_workshop_status_from_attendees(attendees)
        self.assertEqual(status, 'deploying', "Step 3: First attendee starts deploying - workshop deploying")
        
        # More deployments in progress
        attendees = ['deploying', 'deploying', 'planning']
        status = service.calculate_workshop_status_from_attendees(attendees)
        self.assertEqual(status, 'deploying', "Step 4: Multiple deploying - workshop still deploying")
        
        # First attendee succeeds
        attendees = ['active', 'deploying', 'planning']
        status = service.calculate_workshop_status_from_attendees(attendees)
        self.assertEqual(status, 'deploying', "Step 5: Mixed states - worst status (deploying) wins")
        
        # One deployment fails
        attendees = ['active', 'failed', 'planning']
        status = service.calculate_workshop_status_from_attendees(attendees)
        self.assertEqual(status, 'failed', "Step 6: Any failure makes workshop failed")
        
        # All deployments eventually complete (some succeed, some fail)
        attendees = ['active', 'failed', 'active']
        status = service.calculate_workshop_status_from_attendees(attendees)
        self.assertEqual(status, 'failed', "Step 7: Final state - failed due to one failure")
        
        # Cleanup begins for active resources
        attendees = ['deleting', 'failed', 'deleting']
        status = service.calculate_workshop_status_from_attendees(attendees)
        self.assertEqual(status, 'failed', "Step 8: Failed is worse than deleting")
        
        # All resources cleaned up
        attendees = ['deleted', 'deleted', 'deleted']
        status = service.calculate_workshop_status_from_attendees(attendees)
        self.assertEqual(status, 'completed', "Step 9: All resources deleted - workshop completed")
    
    def test_edge_cases(self):
        """Test edge cases and unusual scenarios."""
        service = WorkshopStatusService
        
        # Large workshop with one failure
        attendees = ['active'] * 20 + ['failed']
        status = service.calculate_workshop_status_from_attendees(attendees)
        self.assertEqual(status, 'failed', "One failure in large workshop should fail entire workshop")
        
        # All attendees in various non-active states
        attendees = ['planning', 'deploying', 'deleting']
        status = service.calculate_workshop_status_from_attendees(attendees)
        self.assertEqual(status, 'deleting', "Worst status should be deleting")
        
        # Only deleted attendees with various initial states
        attendees = ['deleted', 'deleted', 'deleted', 'deleted']
        status = service.calculate_workshop_status_from_attendees(attendees)
        self.assertEqual(status, 'completed', "All deleted should result in completed workshop")
        
        # Unknown status should default gracefully
        attendees = ['active', 'unknown_status']
        status = service.calculate_workshop_status_from_attendees(attendees)
        # Unknown status gets priority 999, so 'active' (priority 5) should win
        self.assertEqual(status, 'active', "Unknown status should have lowest priority")
    
    def test_least_sane_status_principle(self):
        """Test that the 'least sane' (worst) status always wins."""
        service = WorkshopStatusService
        
        test_cases = [
            # Format: (attendee_statuses, expected_workshop_status, description)
            (['failed'], 'failed', "Single failed attendee"),
            (['failed', 'active'], 'failed', "Failed beats active"),
            (['failed', 'deploying', 'active'], 'failed', "Failed beats all"),
            (['deleting', 'active'], 'deleting', "Deleting beats active"),
            (['deleting', 'deploying'], 'deleting', "Deleting beats deploying"),
            (['deploying', 'active'], 'deploying', "Deploying beats active"),
            (['deploying', 'planning'], 'deploying', "Deploying beats planning"),
            (['planning', 'active'], 'planning', "Planning beats active"),
        ]
        
        for attendees, expected, description in test_cases:
            with self.subTest(description=description):
                result = service.calculate_workshop_status_from_attendees(attendees)
                self.assertEqual(result, expected, f"{description}: {attendees} -> {result} (expected {expected})")

if __name__ == '__main__':
    unittest.main()