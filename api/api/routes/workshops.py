from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from uuid import UUID

from core.database import get_db
from models.workshop import Workshop
from models.attendee import Attendee
from api.routes.auth import get_current_user
from schemas.workshop import WorkshopCreate, WorkshopCreateWithTemplate, WorkshopUpdate, WorkshopResponse, WorkshopSummary

router = APIRouter()

@router.post("/", response_model=WorkshopResponse)
async def create_workshop(
    workshop: WorkshopCreateWithTemplate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Create a new workshop."""
    # Validate dates
    if workshop.start_date >= workshop.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date"
        )
    
    # Calculate deletion schedule using configurable delay
    from core.config import settings
    deletion_scheduled_at = workshop.end_date + timedelta(hours=settings.AUTO_CLEANUP_DELAY_HOURS)
    
    db_workshop = Workshop(
        name=workshop.name,
        description=workshop.description,
        start_date=workshop.start_date,
        end_date=workshop.end_date,
        timezone=workshop.timezone,
        template=workshop.template,
        deletion_scheduled_at=deletion_scheduled_at
    )
    
    db.add(db_workshop)
    db.commit()
    db.refresh(db_workshop)
    
    return db_workshop

@router.get("/", response_model=List[WorkshopSummary])
async def list_workshops(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """List all workshops with optional filtering."""
    query = db.query(Workshop)
    
    if status:
        query = query.filter(Workshop.status == status)
    
    workshops = query.offset(skip).limit(limit).all()
    
    # Convert to summary format with attendee counts
    workshop_summaries = []
    for workshop in workshops:
        attendee_count = db.query(Attendee).filter(Attendee.workshop_id == workshop.id).count()
        active_attendees = db.query(Attendee).filter(
            Attendee.workshop_id == workshop.id,
            Attendee.status == 'active'
        ).count()
        
        workshop_summaries.append(WorkshopSummary(
            id=workshop.id,
            name=workshop.name,
            description=workshop.description,
            start_date=workshop.start_date,
            end_date=workshop.end_date,
            status=workshop.status,
            created_at=workshop.created_at,
            attendee_count=attendee_count,
            active_attendees=active_attendees
        ))
    
    return workshop_summaries

@router.get("/{workshop_id}", response_model=WorkshopResponse)
async def get_workshop(
    workshop_id: UUID,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Get workshop details."""
    workshop = db.query(Workshop).filter(Workshop.id == workshop_id).first()
    
    if not workshop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workshop not found"
        )
    
    return workshop

@router.put("/{workshop_id}", response_model=WorkshopResponse)
async def update_workshop(
    workshop_id: UUID,
    workshop_update: WorkshopUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Update workshop details."""
    workshop = db.query(Workshop).filter(Workshop.id == workshop_id).first()
    
    if not workshop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workshop not found"
        )
    
    # Update fields
    update_data = workshop_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(workshop, field, value)
    
    # Validate dates if both are provided
    if workshop.start_date >= workshop.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date"
        )
    
    # Recalculate deletion schedule if end date changed
    if 'end_date' in update_data:
        from core.config import settings
        workshop.deletion_scheduled_at = workshop.end_date + timedelta(hours=settings.AUTO_CLEANUP_DELAY_HOURS)
    
    db.commit()
    db.refresh(workshop)
    
    return workshop

@router.delete("/{workshop_id}")
async def delete_workshop(
    workshop_id: UUID,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Delete a workshop and all associated resources."""
    workshop = db.query(Workshop).filter(Workshop.id == workshop_id).first()
    
    if not workshop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workshop not found"
        )
    
    # Check if workshop has active deployments
    active_attendees = db.query(Attendee).filter(
        Attendee.workshop_id == workshop_id,
        Attendee.status.in_(['active', 'deploying'])
    ).count()
    
    if active_attendees > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete workshop with active deployments"
        )
    
    db.delete(workshop)
    db.commit()
    
    return {"message": "Workshop deleted successfully"}

@router.post("/{workshop_id}/deploy")
async def deploy_workshop(
    workshop_id: UUID,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Deploy resources for all attendees in the workshop."""
    workshop = db.query(Workshop).filter(Workshop.id == workshop_id).first()
    
    if not workshop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workshop not found"
        )
    
    # Update workshop status
    workshop.status = 'deploying'
    db.commit()
    
    # Queue sequential deployment task for the workshop
    attendees = db.query(Attendee).filter(Attendee.workshop_id == workshop_id).all()
    
    # Import here to avoid circular imports
    from tasks.terraform_tasks import deploy_workshop_attendees_sequential
    task = deploy_workshop_attendees_sequential.delay(str(workshop_id))
    
    return {
        "message": "Workshop sequential deployment started",
        "task_id": task.id,
        "attendee_count": len(attendees),
        "deployment_type": "sequential"
    }

@router.delete("/{workshop_id}/resources")
async def cleanup_workshop_resources(
    workshop_id: UUID,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Manual cleanup of workshop resources."""
    workshop = db.query(Workshop).filter(Workshop.id == workshop_id).first()
    
    if not workshop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workshop not found"
        )
    
    # Check if there are attendees to cleanup
    attendees = db.query(Attendee).filter(
        Attendee.workshop_id == workshop_id,
        Attendee.status.in_(['active', 'failed'])
    ).all()
    
    if not attendees:
        return {
            "message": "No resources to cleanup",
            "attendee_count": 0
        }
    
    # Use sequential cleanup to ensure all attendees are properly cleaned up
    # This addresses CLEANUP-PARTIAL-001 where only first attendee was cleaned up
    from tasks.terraform_tasks import cleanup_workshop_attendees_sequential
    task = cleanup_workshop_attendees_sequential.delay(str(workshop_id))
    
    return {
        "message": "Workshop sequential cleanup started",
        "task_id": task.id,
        "attendee_count": len(attendees),
        "cleanup_type": "sequential"
    }


@router.post("/{workshop_id}/fix-status")
async def fix_workshop_status(
    workshop_id: UUID,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Fix workshop status inconsistencies by forcing status update based on attendee states"""
    from services.workshop_status_fix import WorkshopStatusFixService
    
    # Validate workshop status and get details
    validation = WorkshopStatusFixService.validate_workshop_status_consistency(str(workshop_id), db)
    
    if validation.get("error"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=validation["error"]
        )
    
    if validation["requires_update"]:
        # Fix the status inconsistency
        new_status = WorkshopStatusFixService.force_workshop_status_update(str(workshop_id), db)
        
        if new_status:
            return {
                "message": "Workshop status updated successfully",
                "old_status": validation["workshop_status"],
                "new_status": new_status,
                "attendee_details": validation["status_breakdown"]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update workshop status"
            )
    else:
        return {
            "message": "Workshop status is already consistent",
            "current_status": validation["workshop_status"],
            "attendee_details": validation["status_breakdown"]
        }


@router.get("/{workshop_id}/status-check")  
async def check_workshop_status_consistency(
    workshop_id: UUID,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Check if workshop status is consistent with attendee states"""
    from services.workshop_status_fix import WorkshopStatusFixService
    
    validation = WorkshopStatusFixService.validate_workshop_status_consistency(str(workshop_id), db)
    
    if validation.get("error"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=validation["error"]
        )
    
    return validation

@router.post("/process-lifecycle")
async def trigger_lifecycle_check(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Manually trigger workshop lifecycle processing."""
    from tasks.cleanup_tasks import process_workshop_lifecycle
    task = process_workshop_lifecycle.delay()
    
    return {
        "message": "Workshop lifecycle check triggered",
        "task_id": task.id
    }