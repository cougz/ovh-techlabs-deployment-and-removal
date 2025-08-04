from celery import current_task
from sqlalchemy.orm import Session
from datetime import datetime
from uuid import UUID
import time

from core.celery_app import celery_app
from core.database import SessionLocal
from core.logging import get_logger
from models.attendee import Attendee
from models.deployment_log import DeploymentLog
from models.workshop import Workshop
from services.terraform_service import terraform_service
from services.workshop_status_service import WorkshopStatusService
from tasks.websocket_updates import (
    broadcast_status_update, 
    broadcast_deployment_log,
    broadcast_deployment_progress
)

logger = get_logger(__name__)

def update_workshop_status_based_on_attendees(db: Session, workshop_id: UUID):
    """Update workshop status based on attendee statuses using least sane status logic."""
    try:
        workshop = db.query(Workshop).filter(Workshop.id == workshop_id).first()
        if not workshop:
            return
        
        # Get current workshop status for comparison
        old_status = workshop.status
        
        # Use the new service to calculate and update status
        new_status = WorkshopStatusService.update_workshop_status_from_attendees(str(workshop_id), db)
        
        if new_status and old_status != new_status:
            # Broadcast status update via WebSocket
            broadcast_status_update(
                str(workshop_id),
                "workshop",
                str(workshop_id),
                new_status,
                {"reason": f"Workshop status updated based on attendee statuses (least sane status logic)"}
            )
            logger.info(f"Workshop {workshop_id} status updated from '{old_status}' to '{new_status}' using least sane status logic")
        
    except Exception as e:
        logger.error(f"Error updating workshop status: {str(e)}")
        db.rollback()

@celery_app.task(bind=True)
def deploy_attendee_resources(self, attendee_id: str):
    """Deploy OVH resources for a specific attendee."""
    db = SessionLocal()
    attendee = None
    deployment_log = None
    
    try:
        # Get attendee
        attendee = db.query(Attendee).filter(Attendee.id == UUID(attendee_id)).first()
        if not attendee:
            logger.error(f"Attendee not found: {attendee_id}")
            return {"error": "Attendee not found"}
        
        # Create deployment log
        deployment_log = DeploymentLog(
            attendee_id=attendee.id,
            action="deploy",
            status="started"
        )
        db.add(deployment_log)
        db.commit()
        
        # Update attendee status
        attendee.status = "deploying"
        db.commit()
        
        # Broadcast status update
        broadcast_status_update(
            str(attendee.workshop_id),
            "attendee",
            str(attendee.id),
            "deploying"
        )
        
        # Update deployment log status
        deployment_log.status = "running"
        db.commit()
        
        # Broadcast deployment start
        broadcast_deployment_log(
            str(attendee.workshop_id),
            str(attendee.id),
            "deploy",
            "started"
        )
        
        # Create terraform workspace
        workspace_name = f"attendee-{attendee_id}"
        terraform_config = {
            "project_description": f"TechLabs environment for {attendee.username}",
            "username": attendee.username,
            "email": attendee.email
        }
        
        logger.info(f"Creating terraform workspace for attendee {attendee_id}")
        broadcast_deployment_progress(
            str(attendee.workshop_id),
            str(attendee.id),
            10,
            "Initializing workspace"
        )
        
        if not terraform_service.create_workspace(workspace_name, terraform_config):
            raise Exception("Failed to create terraform workspace")
        
        # Plan deployment
        logger.info(f"Planning terraform deployment for attendee {attendee_id}")
        broadcast_deployment_progress(
            str(attendee.workshop_id),
            str(attendee.id),
            40,
            "Planning infrastructure"
        )
        
        success, plan_output = terraform_service.plan(workspace_name)
        if not success:
            raise Exception(f"Terraform plan failed: {plan_output}")
        
        broadcast_deployment_log(
            str(attendee.workshop_id),
            str(attendee.id),
            "plan",
            "completed",
            plan_output
        )
        
        # Apply deployment
        logger.info(f"Applying terraform deployment for attendee {attendee_id}")
        broadcast_deployment_progress(
            str(attendee.workshop_id),
            str(attendee.id),
            70,
            "Creating OVH resources"
        )
        
        # Use apply_with_recovery to handle stale state errors automatically
        success, apply_output, recovered = terraform_service.apply_with_recovery(workspace_name, terraform_config)
        if not success:
            raise Exception(f"Terraform apply failed: {apply_output}")
        
        # If we recovered from stale state, log it for monitoring
        if recovered:
            logger.info(f"Successfully recovered from stale state for attendee {attendee_id}")
            broadcast_deployment_log(
                str(attendee.workshop_id),
                str(attendee.id),
                "recovery",
                "completed",
                "Successfully recovered from stale terraform state and deployed resources"
            )
        
        broadcast_deployment_log(
            str(attendee.workshop_id),
            str(attendee.id),
            "apply",
            "completed",
            apply_output
        )
        
        # Get outputs
        broadcast_deployment_progress(
            str(attendee.workshop_id),
            str(attendee.id),
            90,
            "Configuring access"
        )
        
        outputs = terraform_service.get_outputs(workspace_name)
        
        # Update attendee with OVH project information
        if "project_id" in outputs:
            attendee.ovh_project_id = outputs["project_id"]["value"]
        if "user_urn" in outputs:
            attendee.ovh_user_urn = outputs["user_urn"]["value"]
        
        attendee.status = "active"
        db.commit()
        
        # Update deployment log
        deployment_log.status = "completed"
        deployment_log.completed_at = datetime.utcnow()
        deployment_log.terraform_output = apply_output
        db.commit()
        
        # Broadcast completion
        broadcast_deployment_progress(
            str(attendee.workshop_id),
            str(attendee.id),
            100,
            "Deployment completed"
        )
        
        broadcast_status_update(
            str(attendee.workshop_id),
            "attendee",
            str(attendee.id),
            "active",
            {
                "project_id": outputs.get("project_id", {}).get("value"),
                "user_urn": outputs.get("user_urn", {}).get("value")
            }
        )
        
        # Note: Workshop status will be updated by sequential deployment function
        # Individual deployments should not update workshop status to prevent race conditions
        
        logger.info(f"Successfully deployed resources for attendee {attendee_id}")
        
        return {
            "success": True,
            "attendee_id": attendee_id,
            "project_id": outputs.get("project_id", {}).get("value"),
            "user_urn": outputs.get("user_urn", {}).get("value")
        }
        
    except Exception as e:
        logger.error(f"Error deploying resources for attendee {attendee_id}: {str(e)}")
        
        # Update attendee status
        if attendee:
            attendee.status = "failed"
            db.commit()
            
            # Broadcast failure
            broadcast_status_update(
                str(attendee.workshop_id),
                "attendee",
                str(attendee.id),
                "failed",
                {"error": str(e)}
            )
            
            broadcast_deployment_log(
                str(attendee.workshop_id),
                str(attendee.id),
                "deploy",
                "failed",
                error=str(e)
            )
            
            # Note: Workshop status will be updated by sequential deployment function
            # Individual deployments should not update workshop status to prevent race conditions
        
        # Update deployment log
        if deployment_log:
            deployment_log.status = "failed"
            deployment_log.completed_at = datetime.utcnow()
            deployment_log.error_message = str(e)
            db.commit()
        
        return {"error": str(e), "attendee_id": attendee_id}
        
    finally:
        db.close()

@celery_app.task(bind=True)
def destroy_attendee_resources(self, attendee_id: str):
    """Destroy OVH resources for a specific attendee."""
    db = SessionLocal()
    attendee = None
    deployment_log = None
    
    try:
        # Get attendee
        attendee = db.query(Attendee).filter(Attendee.id == UUID(attendee_id)).first()
        if not attendee:
            logger.error(f"Attendee not found: {attendee_id}")
            return {"error": "Attendee not found"}
        
        # Create deployment log
        deployment_log = DeploymentLog(
            attendee_id=attendee.id,
            action="destroy",
            status="started"
        )
        db.add(deployment_log)
        db.commit()
        
        # Update attendee status
        attendee.status = "deleting"
        db.commit()
        
        # Update deployment log status
        deployment_log.status = "running"
        db.commit()
        
        # Destroy terraform resources with retry mechanism
        workspace_name = f"attendee-{attendee_id}"
        
        logger.info(f"Destroying terraform resources for attendee {attendee_id} with retry mechanism")
        
        success, destroy_output = terraform_service.destroy_with_retry(workspace_name, max_retries=2)
        if not success:
            # Check if this is a retryable error at the task level
            if terraform_service._is_retryable_error(destroy_output) and self.request.retries < 2:
                logger.info(f"Terraform destroy failed with retryable error, retrying task. Attempt {self.request.retries + 1}/3")
                raise self.retry(countdown=120, max_retries=2)  # Wait 2 minutes before retry
            else:
                raise Exception(f"Terraform destroy failed after all retries: {destroy_output}")
        
        # Clean up workspace
        terraform_service.cleanup_workspace(workspace_name)
        
        # Update attendee
        attendee.status = "deleted"
        attendee.ovh_project_id = None
        attendee.ovh_user_urn = None
        db.commit()
        
        # Update deployment log
        deployment_log.status = "completed"
        deployment_log.completed_at = datetime.utcnow()
        deployment_log.terraform_output = destroy_output
        db.commit()
        
        # Update workshop status based on attendee statuses
        update_workshop_status_based_on_attendees(db, attendee.workshop_id)
        
        logger.info(f"Successfully destroyed resources for attendee {attendee_id}")
        
        return {
            "success": True,
            "attendee_id": attendee_id
        }
        
    except Exception as e:
        logger.error(f"Error destroying resources for attendee {attendee_id}: {str(e)}")
        
        # Update attendee status
        if attendee:
            attendee.status = "failed"
            db.commit()
            
            # Update workshop status based on attendee statuses
            update_workshop_status_based_on_attendees(db, attendee.workshop_id)
        
        # Update deployment log
        if deployment_log:
            deployment_log.status = "failed"
            deployment_log.completed_at = datetime.utcnow()
            deployment_log.error_message = str(e)
            db.commit()
        
        return {"error": str(e), "attendee_id": attendee_id}
        
    finally:
        db.close()

@celery_app.task
def health_check_resources():
    """Periodic task to check health of deployed resources."""
    db = SessionLocal()
    
    try:
        # Get all active attendees
        active_attendees = db.query(Attendee).filter(Attendee.status == "active").all()
        
        for attendee in active_attendees:
            workspace_name = f"attendee-{attendee.id}"
            
            # Check if terraform workspace still exists
            if not terraform_service._get_workspace_path(workspace_name).exists():
                logger.warning(f"Terraform workspace missing for attendee {attendee.id}")
                attendee.status = "failed"
                db.commit()
                continue
            
            # Get terraform outputs to verify resources
            outputs = terraform_service.get_outputs(workspace_name)
            if not outputs:
                logger.warning(f"No terraform outputs for attendee {attendee.id}")
                attendee.status = "failed"
                db.commit()
        
        logger.info(f"Health check completed for {len(active_attendees)} active attendees")
        
    except Exception as e:
        logger.error(f"Error during health check: {str(e)}")
        
    finally:
        db.close()

@celery_app.task(bind=True)
def deploy_workshop_attendees_sequential(self, workshop_id: str):
    """Deploy all attendees in a workshop sequentially to avoid quota issues."""
    db = SessionLocal()
    
    try:
        workshop = db.query(Workshop).filter(Workshop.id == UUID(workshop_id)).first()
        if not workshop:
            logger.error(f"Workshop not found: {workshop_id}")
            return {"error": "Workshop not found"}
        
        # Get all attendees for this workshop
        attendees = db.query(Attendee).filter(Attendee.workshop_id == UUID(workshop_id)).all()
        if not attendees:
            logger.info(f"No attendees found for workshop {workshop_id}")
            workshop.status = 'active'  # Workshop is active even with no attendees
            db.commit()
            return {"message": "No attendees to deploy", "attendees_deployed": 0}
        
        logger.info(f"Starting sequential deployment of {len(attendees)} attendees for workshop {workshop_id}")
        
        deployed_count = 0
        failed_count = 0
        
        for i, attendee in enumerate(attendees):
            logger.info(f"Deploying attendee {i+1}/{len(attendees)}: {attendee.username}")
            
            # Update task progress
            self.update_state(
                state='PROGRESS',
                meta={
                    'current': i + 1,
                    'total': len(attendees),
                    'status': f'Deploying {attendee.username}',
                    'attendee_id': str(attendee.id)
                }
            )
            
            # Broadcast workshop deployment progress
            broadcast_deployment_progress(
                str(workshop_id),
                i + 1,
                len(attendees),
                f"Deploying {attendee.username}..."
            )
            
            try:
                # Call the individual attendee deployment task synchronously
                result = deploy_attendee_resources.apply(args=[str(attendee.id)])
                
                if result.successful() and not result.result.get('error'):
                    deployed_count += 1
                    logger.info(f"Successfully deployed {attendee.username}")
                else:
                    failed_count += 1
                    error_msg = result.result.get('error', 'Unknown error')
                    logger.error(f"Failed to deploy {attendee.username}: {error_msg}")
                    
                    # If deployment fails, mark attendee as failed and continue with next
                    attendee.status = 'failed'
                    db.commit()
                    
            except Exception as e:
                failed_count += 1
                logger.error(f"Exception during deployment of {attendee.username}: {str(e)}")
                attendee.status = 'failed'
                db.commit()
        
        # Update workshop status based on deployment results
        # Since we're completing a deployment lifecycle, we need to explicitly set the status
        # The WorkshopStatusService won't override 'deploying' status as it's a lifecycle state
        from services.workshop_status_fix import WorkshopStatusFixService
        
        # Calculate what the status should be based on attendees
        attendee_statuses = []
        attendees_after = db.query(Attendee).filter(Attendee.workshop_id == UUID(workshop_id)).all()
        for attendee in attendees_after:
            attendee_statuses.append(attendee.status)
        
        # Calculate the appropriate status based on attendee states
        calculated_status = WorkshopStatusService.calculate_workshop_status_from_attendees(attendee_statuses)
        
        # Explicitly set the workshop status since we're completing the deployment lifecycle
        workshop.status = calculated_status
        db.commit()
        new_status = calculated_status
        
        logger.info(f"Workshop {workshop_id} deployment completed. Status updated from 'deploying' to '{new_status}'")
        
        # Create appropriate status message
        if failed_count == 0:
            status_message = f"All {deployed_count} attendees deployed successfully"
        elif deployed_count > 0:
            status_message = f"{deployed_count} attendees deployed, {failed_count} failed"
        else:
            status_message = f"All {failed_count} attendees failed deployment"
        
        # Broadcast final status
        broadcast_status_update(
            str(workshop_id),
            "workshop", 
            str(workshop_id),
            new_status,
            {"message": status_message}
        )
        
        logger.info(f"Sequential deployment completed for workshop {workshop_id}: {status_message}")
        
        return {
            "message": status_message,
            "attendees_deployed": deployed_count,
            "attendees_failed": failed_count,
            "workshop_status": new_status
        }
        
    except Exception as e:
        logger.error(f"Error during sequential workshop deployment {workshop_id}: {str(e)}")
        
        # Update workshop status to failed
        try:
            workshop = db.query(Workshop).filter(Workshop.id == UUID(workshop_id)).first()
            if workshop:
                workshop.status = 'failed'
                db.commit()
        except:
            pass
        
        return {"error": str(e)}
        
    finally:
        db.close()


def create_retry_deployment_log(attendee_id: str, attempt_number: int, previous_error: str = None):
    """Create a deployment log entry for retry attempts"""
    db = SessionLocal()
    try:
        deployment_log = DeploymentLog(
            attendee_id=UUID(attendee_id),
            action="deploy_retry",
            status="started",
            notes=f"Retry attempt attempt_number={attempt_number}" + (f", previous_error: {previous_error}" if previous_error else "")
        )
        db.add(deployment_log)
        db.commit()
        return deployment_log.id
    except Exception as e:
        logger.error(f"Failed to create retry deployment log: {str(e)}")
        db.rollback()
        return None
    finally:
        db.close()


def is_transient_error(error_message: str) -> bool:
    """Check if an error is transient and should be retried"""
    transient_patterns = [
        "quota exceeded",
        "rate limit",
        "timeout",
        "temporarily unavailable",
        "server error",
        "connection reset",
        "network error"
    ]
    
    error_lower = error_message.lower()
    return any(pattern in error_lower for pattern in transient_patterns)


def deploy_attendee_resources_with_retry(attendee_id: str, max_retries: int = 3):
    """Deploy attendee resources with automatic retry and exponential backoff"""
    db = SessionLocal()
    attendee = None
    
    for attempt in range(max_retries):
        try:
            # Get attendee
            attendee = db.query(Attendee).filter(Attendee.id == UUID(attendee_id)).first()
            if not attendee:
                return {"success": False, "error": "Attendee not found"}
            
            # For retry attempts, create retry log
            if attempt > 0:
                create_retry_deployment_log(attendee_id, attempt + 1)
                
                # Exponential backoff: wait 2^attempt seconds
                backoff_time = 2 ** attempt
                logger.info(f"Retry attempt {attempt + 1} for attendee {attendee_id}, waiting {backoff_time}s")
                time.sleep(backoff_time)
            
            # Create terraform workspace
            workspace_name = f"attendee-{attendee_id}"
            terraform_config = {
                "project_description": f"TechLabs environment for {attendee.username}",
                "username": attendee.username,
                "email": attendee.email
            }
            
            # Try terraform operations
            if not terraform_service.create_workspace(workspace_name, terraform_config):
                error_msg = "Failed to create terraform workspace"
                if is_transient_error(error_msg) and attempt < max_retries - 1:
                    logger.warning(f"Transient error on attempt {attempt + 1}: {error_msg}")
                    continue
                else:
                    raise Exception(error_msg)
            
            # Plan deployment
            success, plan_output = terraform_service.plan(workspace_name)
            if not success:
                error_msg = f"Terraform plan failed: {plan_output}"
                if is_transient_error(plan_output) and attempt < max_retries - 1:
                    logger.warning(f"Transient error on attempt {attempt + 1}: {error_msg}")
                    continue
                else:
                    raise Exception(error_msg)
            
            # Apply deployment
            success, apply_output, recovered = terraform_service.apply_with_recovery(workspace_name, terraform_config)
            if not success:
                error_msg = f"Terraform apply failed: {apply_output}"
                if is_transient_error(apply_output) and attempt < max_retries - 1:
                    logger.warning(f"Transient error on attempt {attempt + 1}: {error_msg}")
                    continue
                else:
                    raise Exception(error_msg)
            
            # Success! Get outputs and update attendee
            outputs = terraform_service.get_outputs(workspace_name)
            
            if "project_id" in outputs:
                attendee.ovh_project_id = outputs["project_id"]["value"]
            if "user_urn" in outputs:
                attendee.ovh_user_urn = outputs["user_urn"]["value"]
            
            attendee.status = "active"
            db.commit()
            
            logger.info(f"Successfully deployed resources for attendee {attendee_id} on attempt {attempt + 1}")
            
            return {
                "success": True,
                "attendee_id": attendee_id,
                "attempt": attempt + 1,
                "project_id": outputs.get("project_id", {}).get("value"),
                "user_urn": outputs.get("user_urn", {}).get("value")
            }
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Deployment attempt {attempt + 1} failed for attendee {attendee_id}: {error_msg}")
            
            # If this is the last attempt or not a transient error, fail permanently
            if attempt == max_retries - 1 or not is_transient_error(error_msg):
                if attendee:
                    attendee.status = "failed"
                    db.commit()
                
                return {
                    "success": False,
                    "error": f"Max retry attempts exceeded. Last error: {error_msg}",
                    "attendee_id": attendee_id,
                    "attempts": attempt + 1
                }
    
    # This is a fallback return (should not reach here)
    db.close()
    return {"success": False, "error": "Unexpected code path"}


@celery_app.task(bind=True, name='cleanup_workshop_attendees_sequential')
def cleanup_workshop_attendees_sequential(self, workshop_id: str):
    """
    Cleanup all attendees in a workshop sequentially to ensure all resources are properly destroyed.
    This addresses CLEANUP-PARTIAL-001 where sometimes only the first attendee is cleaned up.
    """
    db = SessionLocal()
    
    try:
        logger.info(f"Starting sequential cleanup for workshop {workshop_id}")
        
        # Get workshop
        workshop = db.query(Workshop).filter(Workshop.id == UUID(workshop_id)).first()
        if not workshop:
            logger.error(f"Workshop not found: {workshop_id}")
            return {"error": "Workshop not found"}
        
        # Update workshop status to deleting
        workshop.status = 'deleting'
        db.commit()
        
        # Get all attendees that need cleanup (active or failed status)
        attendees = db.query(Attendee).filter(
            Attendee.workshop_id == UUID(workshop_id),
            Attendee.status.in_(['active', 'failed'])
        ).all()
        
        if not attendees:
            logger.info(f"No attendees to cleanup for workshop {workshop_id}")
            workshop.status = 'completed'
            db.commit()
            return {"message": "No attendees to cleanup", "attendees_cleaned": 0}
        
        logger.info(f"Starting sequential cleanup of {len(attendees)} attendees for workshop {workshop_id}")
        
        cleaned_count = 0
        failed_count = 0
        
        for i, attendee in enumerate(attendees):
            logger.info(f"Cleaning up attendee {i+1}/{len(attendees)}: {attendee.username}")
            
            # Update task progress
            self.update_state(
                state='PROGRESS',
                meta={
                    'current': i + 1,
                    'total': len(attendees),
                    'status': f'Cleaning up {attendee.username}',
                    'attendee_id': str(attendee.id)
                }
            )
            
            # Broadcast cleanup progress
            broadcast_deployment_progress(
                str(workshop_id),
                i + 1,
                len(attendees),
                f"Cleaning up {attendee.username}..."
            )
            
            try:
                # Call the individual attendee cleanup task synchronously
                result = destroy_attendee_resources.apply(args=[str(attendee.id)])
                
                if result.successful() and result.result.get('success'):
                    cleaned_count += 1
                    logger.info(f"Successfully cleaned up {attendee.username}")
                else:
                    failed_count += 1
                    error_msg = result.result.get('error', 'Unknown error')
                    logger.error(f"Failed to cleanup {attendee.username}: {error_msg}")
                    
                    # Mark attendee cleanup as failed but continue with others
                    attendee.status = 'failed'
                    db.commit()
                    
            except Exception as e:
                failed_count += 1
                logger.error(f"Exception during cleanup of {attendee.username}: {str(e)}")
                attendee.status = 'failed'
                db.commit()
        
        # Update workshop status based on cleanup results
        if failed_count == 0:
            workshop.status = 'completed'
            workshop.deletion_scheduled_at = None  # Clear the scheduled time
            status_message = f"All {cleaned_count} attendees cleaned up successfully"
        else:
            workshop.status = 'completed'  # Still mark as completed but note failures
            # Log failures for manual intervention
            status_message = f"{cleaned_count} attendees cleaned up, {failed_count} failed"
        
        db.commit()
        
        # Broadcast final status
        broadcast_status_update(
            str(workshop_id),
            "workshop", 
            str(workshop_id),
            workshop.status,
            {"message": status_message}
        )
        
        logger.info(f"Sequential cleanup completed for workshop {workshop_id}: {status_message}")
        
        return {
            "message": status_message,
            "attendees_cleaned": cleaned_count,
            "attendees_failed": failed_count,
            "workshop_status": workshop.status
        }
        
    except Exception as e:
        logger.error(f"Error during sequential workshop cleanup {workshop_id}: {str(e)}")
        
        # Update workshop status to failed
        if workshop:
            workshop.status = 'failed'
            db.commit()
        
        return {"error": str(e)}
        
    finally:
        db.close()