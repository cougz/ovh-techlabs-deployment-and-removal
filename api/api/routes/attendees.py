from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from core.database import get_db
from models.attendee import Attendee
from models.workshop import Workshop
from models.credential import Credential
from api.routes.auth import get_current_user
from schemas.attendee import AttendeeCreate, AttendeeResponse, AttendeeCredentials
from core.security import encrypt_data, decrypt_data, generate_password

# Import configuration functions for login prefix
def get_login_prefix_config():
    """Import and use the settings configuration"""
    from api.routes.config_routes import get_login_prefix_config as get_config
    return get_config()

router = APIRouter()

@router.post("/", response_model=AttendeeResponse)
async def create_attendee(
    workshop_id: UUID,
    attendee: AttendeeCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Add a new attendee to a workshop."""
    # Verify workshop exists
    workshop = db.query(Workshop).filter(Workshop.id == workshop_id).first()
    if not workshop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workshop not found"
        )
    
    # Check for duplicate username/email in the same workshop
    existing_attendee = db.query(Attendee).filter(
        Attendee.workshop_id == workshop_id,
        (Attendee.username == attendee.username) | (Attendee.email == attendee.email)
    ).first()
    
    if existing_attendee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already exists in this workshop"
        )
    
    # Create attendee
    db_attendee = Attendee(
        workshop_id=workshop_id,
        username=attendee.username,
        email=attendee.email
    )
    
    db.add(db_attendee)
    db.commit()
    db.refresh(db_attendee)
    
    # Generate and store credentials
    password = generate_password()
    encrypted_password = encrypt_data(password)
    
    credential = Credential(
        attendee_id=db_attendee.id,
        username=attendee.username,
        encrypted_password=encrypted_password
    )
    
    db.add(credential)
    db.commit()
    
    return db_attendee

@router.get("/workshop/{workshop_id}", response_model=List[AttendeeResponse])
async def list_workshop_attendees(
    workshop_id: UUID,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """List all attendees for a workshop."""
    # Verify workshop exists
    workshop = db.query(Workshop).filter(Workshop.id == workshop_id).first()
    if not workshop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workshop not found"
        )
    
    attendees = db.query(Attendee).filter(Attendee.workshop_id == workshop_id).all()
    return attendees

@router.get("/{attendee_id}", response_model=AttendeeResponse)
async def get_attendee(
    attendee_id: UUID,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Get attendee details."""
    attendee = db.query(Attendee).filter(Attendee.id == attendee_id).first()
    
    if not attendee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendee not found"
        )
    
    return attendee

@router.get("/{attendee_id}/credentials", response_model=AttendeeCredentials)
async def get_attendee_credentials(
    attendee_id: UUID,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Get attendee's OVH IAM credentials from Terraform outputs."""
    attendee = db.query(Attendee).filter(Attendee.id == attendee_id).first()
    
    if not attendee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendee not found"
        )
    
    # Check if attendee has been deployed
    if attendee.status != "active":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No credentials available - attendee not deployed"
        )
    
    # Get Terraform outputs for OVH IAM user credentials
    from services.terraform_service import terraform_service
    workspace_name = f"attendee-{attendee_id}"
    outputs = terraform_service.get_outputs(workspace_name)
    
    if not outputs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Terraform outputs not available"
        )
    
    # Extract OVH IAM credentials from Terraform outputs
    ovh_username = outputs.get("username", {}).get("value")
    ovh_password = outputs.get("password", {}).get("value")
    
    if not ovh_username or not ovh_password:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="OVH IAM credentials not found in Terraform outputs"
        )
    
    # Apply configurable login prefix
    config = get_login_prefix_config()
    login_prefix = config.get("login_prefix", "")
    
    # Add prefix to username if configured
    final_username = f"{login_prefix}{ovh_username}" if login_prefix else ovh_username
    
    return AttendeeCredentials(
        username=final_username,
        password=ovh_password,
        ovh_project_id=attendee.ovh_project_id,
        ovh_user_urn=attendee.ovh_user_urn
    )

@router.delete("/{attendee_id}")
async def delete_attendee(
    attendee_id: UUID,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Remove an attendee from a workshop."""
    attendee = db.query(Attendee).filter(Attendee.id == attendee_id).first()
    
    if not attendee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendee not found"
        )
    
    # Check if attendee has active resources
    if attendee.status in ['active', 'deploying']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete attendee with active resources. Clean up resources first."
        )
    
    db.delete(attendee)
    db.commit()
    
    return {"message": "Attendee deleted successfully"}

@router.post("/{attendee_id}/deploy")
async def deploy_attendee(
    attendee_id: UUID,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Deploy resources for a specific attendee."""
    attendee = db.query(Attendee).filter(Attendee.id == attendee_id).first()
    
    if not attendee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendee not found"
        )
    
    if attendee.status in ['active', 'deploying']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendee resources are already deployed or deploying"
        )
    
    # Update status and queue deployment
    attendee.status = 'deploying'
    db.commit()
    
    # Import here to avoid circular imports
    from tasks.terraform_tasks import deploy_attendee_resources
    task = deploy_attendee_resources.delay(str(attendee_id))
    
    return {
        "message": "Attendee deployment started",
        "task_id": task.id,
        "attendee_id": attendee_id
    }

@router.post("/{attendee_id}/retry")
async def retry_attendee_deployment(
    attendee_id: UUID,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Retry deployment for a failed attendee."""
    attendee = db.query(Attendee).filter(Attendee.id == attendee_id).first()
    
    if not attendee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendee not found"
        )
    
    if attendee.status != 'failed':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only retry failed deployments"
        )
    
    # Reset status and queue deployment retry
    attendee.status = 'deploying'
    db.commit()
    
    # Import here to avoid circular imports
    from tasks.terraform_tasks import deploy_attendee_resources
    task = deploy_attendee_resources.delay(str(attendee_id))
    
    return {
        "message": "Attendee deployment retry started",
        "task_id": task.id,
        "attendee_id": attendee_id
    }

@router.post("/{attendee_id}/destroy")
async def destroy_attendee_resources(
    attendee_id: UUID,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Destroy resources for a specific attendee."""
    attendee = db.query(Attendee).filter(Attendee.id == attendee_id).first()
    
    if not attendee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendee not found"
        )
    
    if attendee.status not in ['active', 'failed']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No resources to destroy for this attendee"
        )
    
    # Update status and queue destruction
    attendee.status = 'deleting'
    db.commit()
    
    # Import here to avoid circular imports
    from tasks.terraform_tasks import destroy_attendee_resources
    task = destroy_attendee_resources.delay(str(attendee_id))
    
    return {
        "message": "Attendee resource destruction started",
        "task_id": task.id,
        "attendee_id": attendee_id
    }