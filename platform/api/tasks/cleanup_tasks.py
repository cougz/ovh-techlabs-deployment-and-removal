from celery import current_task
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from core.celery_app import celery_app
from core.database import SessionLocal
from core.logging import get_logger
from core.config import settings
from models.workshop import Workshop
from models.attendee import Attendee
from services.workshop_status_service import WorkshopStatusService
from tasks.terraform_tasks import destroy_attendee_resources, cleanup_workshop_attendees_sequential

logger = get_logger(__name__)

@celery_app.task
def process_workshop_lifecycle():
    """Single task to handle both scheduling and executing workshop cleanup."""
    db = SessionLocal()
    
    try:
        now = datetime.now(ZoneInfo("UTC"))
        
        # Part 1: Schedule deletion for workshops that have ended
        ended_workshops = db.query(Workshop).filter(
            Workshop.end_date <= now,
            Workshop.deletion_scheduled_at.is_(None),
            Workshop.status.in_(["active", "deploying", "planning"])
        ).all()
        
        for workshop in ended_workshops:
            # Calculate deletion time using configured delay
            deletion_time = workshop.end_date + timedelta(hours=settings.AUTO_CLEANUP_DELAY_HOURS)
            workshop.deletion_scheduled_at = deletion_time
            
            logger.info(f"Scheduled workshop {workshop.id} for deletion at {deletion_time}")
        
        # Only commit after all workshops are processed
        if ended_workshops:
            db.commit()
        
        # Part 2: Execute cleanup for workshops past their deletion time
        workshops_to_cleanup = db.query(Workshop).filter(
            Workshop.deletion_scheduled_at <= now,
            ~Workshop.status.in_(["deleting", "deleted"])
        ).all()
        
        for workshop in workshops_to_cleanup:
            # Validate workshop has attendees that need cleanup
            attendees_needing_cleanup = db.query(Attendee).filter(
                Attendee.workshop_id == workshop.id,
                Attendee.status.in_(["active", "failed"])
            ).count()
            
            if attendees_needing_cleanup == 0:
                logger.info(f"Workshop {workshop.id} has no attendees needing cleanup, marking as completed")
                workshop.status = "completed"
                workshop.deletion_scheduled_at = None
                db.commit()
                continue
            
            logger.info(f"Starting cleanup for workshop {workshop.id} (scheduled for {workshop.deletion_scheduled_at})")
            
            # Update status
            workshop.status = "deleting"
            db.commit()
            
            # Queue cleanup task
            cleanup_workshop_attendees_sequential.delay(str(workshop.id))
        
        logger.info(f"Processed {len(ended_workshops)} ended workshops and {len(workshops_to_cleanup)} cleanups")
        
        # Add metrics for monitoring cleanup operations
        logger.info(f"Cleanup metrics - Scheduled: {len(ended_workshops)}, Cleaned: {len(workshops_to_cleanup)}")
        
        # Consider adding Prometheus metrics if enabled
        # if settings.PROMETHEUS_METRICS_ENABLED:
        #     workshops_scheduled_for_cleanup.inc(len(ended_workshops))
        #     workshops_cleaned_up.inc(len(workshops_to_cleanup))
        
    except Exception as e:
        logger.error(f"Error in workshop lifecycle processing: {str(e)}")
        db.rollback()
    finally:
        db.close()

@celery_app.task
def check_workshop_end_dates():
    """Check for workshops that have ended and schedule cleanup."""
    db = SessionLocal()
    
    try:
        now = datetime.now(ZoneInfo("UTC"))
        
        # Get workshops that have ended but are still active
        ended_workshops = db.query(Workshop).filter(
            Workshop.end_date <= now,
            Workshop.status.in_(["active", "completed"])
        ).all()
        
        for workshop in ended_workshops:
            # Schedule deletion 72 hours after end date
            if not workshop.deletion_scheduled_at:
                # Calculate deletion time in workshop's timezone
                workshop_tz = ZoneInfo(workshop.timezone)
                end_date_in_tz = workshop.end_date.astimezone(workshop_tz)
                deletion_time_in_tz = end_date_in_tz + timedelta(hours=72)
                
                # Convert back to UTC for storage
                workshop.deletion_scheduled_at = deletion_time_in_tz.astimezone(ZoneInfo("UTC"))
                workshop.status = "completed"
                db.commit()
                
                logger.info(f"Scheduled workshop {workshop.id} for deletion at {workshop.deletion_scheduled_at} (workshop timezone: {workshop.timezone})")
        
        logger.info(f"Processed {len(ended_workshops)} ended workshops")
        
    except Exception as e:
        logger.error(f"Error checking workshop end dates: {str(e)}")
        
    finally:
        db.close()

@celery_app.task
def cleanup_expired_workshops():
    """Clean up workshops that are scheduled for deletion."""
    db = SessionLocal()
    
    try:
        now = datetime.now(ZoneInfo("UTC"))
        
        # Get workshops scheduled for deletion
        expired_workshops = db.query(Workshop).filter(
            Workshop.deletion_scheduled_at <= now,
            Workshop.status.in_(["completed", "active"])
        ).all()
        
        for workshop in expired_workshops:
            logger.info(f"Starting cleanup for expired workshop {workshop.id}")
            
            # Update workshop status
            workshop.status = "deleting"
            db.commit()
            
            # Get all attendees with active resources
            attendees_to_cleanup = db.query(Attendee).filter(
                Attendee.workshop_id == workshop.id,
                Attendee.status.in_(["active", "failed"])
            ).all()
            
            # Queue destruction tasks for each attendee
            for attendee in attendees_to_cleanup:
                destroy_attendee_resources.delay(str(attendee.id))
            
            logger.info(f"Queued cleanup for {len(attendees_to_cleanup)} attendees in workshop {workshop.id}")
        
        logger.info(f"Processed {len(expired_workshops)} expired workshops")
        
    except Exception as e:
        logger.error(f"Error cleaning up expired workshops: {str(e)}")
        
    finally:
        db.close()

@celery_app.task
def update_workshop_statuses():
    """Update workshop statuses based on attendee deployment results."""
    db = SessionLocal()
    
    try:
        # Get workshops in deploying status
        deploying_workshops = db.query(Workshop).filter(
            Workshop.status == "deploying"
        ).all()
        
        for workshop in deploying_workshops:
            attendees = db.query(Attendee).filter(
                Attendee.workshop_id == workshop.id
            ).all()
            
            if not attendees:
                continue
            
            attendee_statuses = [attendee.status for attendee in attendees]
            
            # Check if any attendees are still deploying
            deploying_count = attendee_statuses.count('deploying')
            
            # If no attendees are still deploying, update status using least sane logic
            if deploying_count == 0:
                old_status = workshop.status
                new_status = WorkshopStatusService.update_workshop_status_from_attendees(str(workshop.id), db)
                
                if new_status and old_status != new_status:
                    logger.info(f"Updated workshop {workshop.id} status from {old_status} to {new_status} using least sane status logic")
        
        # Also check for workshops that might be stuck in deploying
        stuck_threshold = datetime.now(ZoneInfo("UTC")) - timedelta(minutes=30)
        stuck_workshops = db.query(Workshop).filter(
            Workshop.status == "deploying",
            Workshop.updated_at < stuck_threshold
        ).all()
        
        for workshop in stuck_workshops:
            logger.warning(f"Workshop {workshop.id} has been deploying for >30 minutes, marking as failed")
            workshop.status = "failed"
            db.commit()
        
        logger.info(f"Processed {len(deploying_workshops)} deploying workshops")
        
    except Exception as e:
        logger.error(f"Error updating workshop statuses: {str(e)}")
        
    finally:
        db.close()

@celery_app.task
def cleanup_orphaned_workspaces():
    """Clean up orphaned Terraform workspaces."""
    db = SessionLocal()
    
    try:
        from services.terraform_service import terraform_service
        
        # Get all workspace directories
        workspace_dir = terraform_service.workspace_dir
        if not workspace_dir.exists():
            return
        
        orphaned_count = 0
        
        for workspace_path in workspace_dir.iterdir():
            if not workspace_path.is_dir():
                continue
            
            workspace_name = workspace_path.name
            
            # Check if workspace corresponds to an active attendee
            if workspace_name.startswith("attendee-"):
                attendee_id = workspace_name.replace("attendee-", "")
                
                try:
                    attendee = db.query(Attendee).filter(Attendee.id == attendee_id).first()
                    
                    # If attendee doesn't exist or is deleted, clean up workspace
                    if not attendee or attendee.status == "deleted":
                        logger.info(f"Cleaning up orphaned workspace: {workspace_name}")
                        terraform_service.cleanup_workspace(workspace_name)
                        orphaned_count += 1
                        
                except Exception as e:
                    logger.error(f"Error processing workspace {workspace_name}: {str(e)}")
                    continue
        
        logger.info(f"Cleaned up {orphaned_count} orphaned workspaces")
        
    except Exception as e:
        logger.error(f"Error cleaning up orphaned workspaces: {str(e)}")
        
    finally:
        db.close()


@celery_app.task
def send_cleanup_warnings():
    """Send cleanup warnings to attendees 24 hours before environment deletion."""
    db = SessionLocal()
    
    try:
        now = datetime.now(ZoneInfo("UTC"))
        # Find workshops scheduled for deletion in approximately 24 hours (23-25 hours to handle timing variations)
        warning_start = now + timedelta(hours=23)
        warning_end = now + timedelta(hours=25)
        
        # Get workshops that need cleanup warnings
        # Note: In production, this would use cleanup_warning_sent field to avoid duplicates
        # For now, we'll send warnings for all qualifying workshops
        workshops_needing_warning = db.query(Workshop).filter(
            Workshop.deletion_scheduled_at >= warning_start,
            Workshop.deletion_scheduled_at <= warning_end,
            Workshop.status.in_(["completed", "active"])
        ).all()
        
        warnings_sent = 0
        
        for workshop in workshops_needing_warning:
            # Get active attendees for this workshop
            attendees = db.query(Attendee).filter(
                Attendee.workshop_id == workshop.id,
                Attendee.status.in_(["active"])  # Only notify attendees with active resources
            ).all()
            
            # Send warning to each attendee
            for attendee in attendees:
                try:
                    from tasks.notification_tasks import send_cleanup_warning_notification
                    send_cleanup_warning_notification.delay(
                        attendee.email,
                        attendee.username,
                        workshop.name,
                        workshop.deletion_scheduled_at.isoformat()
                    )
                    warnings_sent += 1
                    logger.info(f"Queued cleanup warning for {attendee.email} (workshop: {workshop.name})")
                except Exception as e:
                    logger.error(f"Failed to send cleanup warning to {attendee.email}: {str(e)}")
            
            # Mark warning as sent for this workshop (would be implemented with database migration)
            # workshop.cleanup_warning_sent = True
            # db.commit()
            
            logger.info(f"Sent cleanup warnings for workshop {workshop.id} ({workshop.name}) to {len(attendees)} attendees")
        
        logger.info(f"Cleanup warning check completed. Sent {warnings_sent} warnings for {len(workshops_needing_warning)} workshops")
        return f"Sent {warnings_sent} warnings for {len(workshops_needing_warning)} workshops"
        
    except Exception as e:
        logger.error(f"Error sending cleanup warnings: {str(e)}")
        db.rollback()
        raise
        
    finally:
        db.close()