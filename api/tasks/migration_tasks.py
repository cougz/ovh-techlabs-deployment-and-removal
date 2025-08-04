from celery import current_task
from sqlalchemy.orm import Session
from datetime import datetime
from zoneinfo import ZoneInfo

from core.celery_app import celery_app
from core.database import SessionLocal
from core.logging import get_logger
from models.workshop import Workshop

logger = get_logger(__name__)

@celery_app.task
def migrate_workshops_to_timezone_aware():
    """Migrate existing workshops to be timezone-aware."""
    db = SessionLocal()
    
    try:
        # Find workshops that might not be timezone-aware
        # (those with default timezone 'UTC' but were created before timezone support)
        workshops = db.query(Workshop).filter(
            Workshop.timezone == 'UTC'
        ).all()
        
        migrated_count = 0
        
        for workshop in workshops:
            # If the datetime objects are naive, make them timezone-aware
            if workshop.start_date.tzinfo is None:
                # Convert naive datetime to UTC
                utc_tz = ZoneInfo("UTC")
                workshop.start_date = workshop.start_date.replace(tzinfo=utc_tz)
                workshop.end_date = workshop.end_date.replace(tzinfo=utc_tz)
                
                if workshop.deletion_scheduled_at and workshop.deletion_scheduled_at.tzinfo is None:
                    workshop.deletion_scheduled_at = workshop.deletion_scheduled_at.replace(tzinfo=utc_tz)
                
                migrated_count += 1
                logger.info(f"Migrated workshop {workshop.id} to timezone-aware dates")
        
        # Commit all changes
        db.commit()
        logger.info(f"Successfully migrated {migrated_count} workshops to timezone-aware dates")
        
        return {"success": True, "migrated_count": migrated_count}
        
    except Exception as e:
        logger.error(f"Error migrating workshops to timezone-aware: {str(e)}")
        db.rollback()
        return {"success": False, "error": str(e)}
        
    finally:
        db.close()