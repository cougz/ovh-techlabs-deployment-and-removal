from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from core.database import get_db
from models.deployment_log import DeploymentLog
from models.attendee import Attendee
from api.routes.auth import get_current_user
from schemas.deployment import DeploymentLogResponse

router = APIRouter()

@router.get("/{deployment_id}", response_model=DeploymentLogResponse)
async def get_deployment_log(
    deployment_id: UUID,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Get deployment log details."""
    deployment_log = db.query(DeploymentLog).filter(DeploymentLog.id == deployment_id).first()
    
    if not deployment_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deployment log not found"
        )
    
    return deployment_log

@router.get("/attendee/{attendee_id}", response_model=List[DeploymentLogResponse])
async def get_attendee_deployment_logs(
    attendee_id: UUID,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Get all deployment logs for an attendee."""
    # Verify attendee exists
    attendee = db.query(Attendee).filter(Attendee.id == attendee_id).first()
    if not attendee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendee not found"
        )
    
    deployment_logs = db.query(DeploymentLog).filter(
        DeploymentLog.attendee_id == attendee_id
    ).order_by(DeploymentLog.started_at.desc()).all()
    
    return deployment_logs

@router.get("/workshop/{workshop_id}", response_model=List[DeploymentLogResponse])
async def get_workshop_deployment_logs(
    workshop_id: UUID,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Get all deployment logs for a workshop."""
    deployment_logs = db.query(DeploymentLog).join(Attendee).filter(
        Attendee.workshop_id == workshop_id
    ).order_by(DeploymentLog.started_at.desc()).all()
    
    return deployment_logs