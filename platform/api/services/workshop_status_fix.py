"""
Enhanced workshop status service to fix status inconsistency issues
"""
from typing import Optional
from sqlalchemy.orm import Session
from uuid import UUID

from models.workshop import Workshop
from models.attendee import Attendee
from services.workshop_status_service import WorkshopStatusService
from tasks.websocket_updates import broadcast_status_update


class WorkshopStatusFixService:
    """Enhanced service to fix workshop status inconsistencies"""
    
    @classmethod
    def force_workshop_status_update(cls, workshop_id: str, db: Session) -> Optional[str]:
        """
        Force update workshop status and ensure it's properly broadcast.
        This method adds extra validation and error handling to ensure status updates work.
        
        Args:
            workshop_id: The workshop ID to update
            db: Database session
            
        Returns:
            The new workshop status, or None if workshop not found
        """
        try:
            # Get the workshop
            workshop = db.query(Workshop).filter(Workshop.id == UUID(workshop_id)).first()
            if not workshop:
                return None
            
            # Get all attendees for this workshop (excluding deleted ones)
            attendees = db.query(Attendee).filter(
                Attendee.workshop_id == UUID(workshop_id),
                Attendee.status != 'deleted'
            ).all()
            
            # Store original status for comparison
            original_status = workshop.status
            
            # Use the existing service logic to calculate new status
            new_status = WorkshopStatusService.update_workshop_status_from_attendees(workshop_id, db)
            
            if new_status and new_status != original_status:
                # Force a database commit to ensure status is persisted
                db.commit()
                
                # Verify the status was actually updated
                workshop_updated = db.query(Workshop).filter(Workshop.id == UUID(workshop_id)).first()
                if workshop_updated and workshop_updated.status == new_status:
                    # Broadcast the status update via WebSocket
                    broadcast_status_update(
                        workshop_id,
                        "workshop",
                        workshop_id,
                        new_status,
                        {
                            "message": f"Workshop status updated from {original_status} to {new_status}",
                            "attendee_count": len(attendees),
                            "attendee_statuses": [a.status for a in attendees]
                        }
                    )
                    
                    return new_status
                else:
                    # Status update failed - log this issue
                    print(f"WARNING: Workshop status update failed for {workshop_id}. Expected: {new_status}, Actual: {workshop_updated.status if workshop_updated else 'None'}")
                    return None
            
            return new_status if new_status else original_status
            
        except Exception as e:
            print(f"ERROR: Failed to update workshop status for {workshop_id}: {str(e)}")
            return None
    
    @classmethod  
    def validate_workshop_status_consistency(cls, workshop_id: str, db: Session) -> dict:
        """
        Validate that workshop status is consistent with attendee states.
        Returns detailed information about the status consistency.
        
        Args:
            workshop_id: The workshop ID to validate
            db: Database session
            
        Returns:
            Dictionary with validation results and suggestions
        """
        try:
            workshop = db.query(Workshop).filter(Workshop.id == UUID(workshop_id)).first()
            if not workshop:
                return {"error": "Workshop not found"}
            
            attendees = db.query(Attendee).filter(
                Attendee.workshop_id == UUID(workshop_id),
                Attendee.status != 'deleted'
            ).all()
            
            attendee_statuses = [a.status for a in attendees]
            calculated_status = WorkshopStatusService.calculate_workshop_status_from_attendees(attendee_statuses)
            
            is_consistent = workshop.status == calculated_status
            
            result = {
                "workshop_id": workshop_id,
                "workshop_status": workshop.status,
                "calculated_status": calculated_status,
                "is_consistent": is_consistent,
                "attendee_count": len(attendees),
                "attendee_statuses": attendee_statuses,
                "status_breakdown": {
                    status: attendee_statuses.count(status) 
                    for status in set(attendee_statuses)
                } if attendee_statuses else {}
            }
            
            if not is_consistent:
                result["suggestion"] = f"Workshop status should be '{calculated_status}' based on attendee states"
                result["requires_update"] = True
            else:
                result["suggestion"] = "Workshop status is consistent with attendee states"  
                result["requires_update"] = False
                
            return result
            
        except Exception as e:
            return {"error": f"Validation failed: {str(e)}"}
    
    @classmethod
    def fix_all_workshop_status_inconsistencies(cls, db: Session) -> dict:
        """
        Check all workshops and fix any status inconsistencies.
        This can be used as a cleanup/maintenance function.
        
        Args:
            db: Database session
            
        Returns:
            Summary of fixes applied
        """
        try:
            # Get all workshops
            workshops = db.query(Workshop).all()
            
            results = {
                "total_workshops": len(workshops),
                "consistent_workshops": 0,
                "fixed_workshops": 0,
                "failed_workshops": 0,
                "details": []
            }
            
            for workshop in workshops:
                validation = cls.validate_workshop_status_consistency(str(workshop.id), db)
                
                if validation.get("error"):
                    results["failed_workshops"] += 1
                    results["details"].append({
                        "workshop_id": str(workshop.id),
                        "status": "error",
                        "message": validation["error"]
                    })
                    continue
                
                if validation["requires_update"]:
                    # Try to fix the inconsistency
                    new_status = cls.force_workshop_status_update(str(workshop.id), db)
                    if new_status == validation["calculated_status"]:
                        results["fixed_workshops"] += 1
                        results["details"].append({
                            "workshop_id": str(workshop.id),
                            "status": "fixed",
                            "old_status": validation["workshop_status"],
                            "new_status": new_status
                        })
                    else:
                        results["failed_workshops"] += 1
                        results["details"].append({
                            "workshop_id": str(workshop.id), 
                            "status": "fix_failed",
                            "expected": validation["calculated_status"],
                            "actual": new_status
                        })
                else:
                    results["consistent_workshops"] += 1
                    results["details"].append({
                        "workshop_id": str(workshop.id),
                        "status": "consistent"
                    })
            
            return results
            
        except Exception as e:
            return {"error": f"Failed to check workshop statuses: {str(e)}"}