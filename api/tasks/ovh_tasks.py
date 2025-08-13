from celery import current_task, group
from core.celery_app import celery_app
from core.logging import get_logger
from services.ovh_service_enhanced import enhanced_ovh_service
from typing import List
import time

logger = get_logger(__name__)

@celery_app.task(bind=True)
def bulk_delete_pci_projects_task(self, service_ids: List[str], performed_by: str):
    """Background task for bulk deleting PCI projects"""
    try:
        total = len(service_ids)
        results = {
            "success": [],
            "failed": [],
            "total": total
        }
        
        for i, service_id in enumerate(service_ids):
            # Update task progress
            self.update_state(
                state='PROGRESS',
                meta={
                    'current': i + 1,
                    'total': total,
                    'status': f'Deleting project {service_id}',
                    'results': results
                }
            )
            
            try:
                if enhanced_ovh_service.delete_pci_project(service_id, performed_by):
                    results["success"].append(service_id)
                    logger.info(f"Successfully deleted PCI project {service_id}")
                else:
                    results["failed"].append({"id": service_id, "error": "Deletion failed"})
                    logger.error(f"Failed to delete PCI project {service_id}")
            except Exception as e:
                error_msg = str(e)
                results["failed"].append({"id": service_id, "error": error_msg})
                logger.error(f"Error deleting PCI project {service_id}: {error_msg}")
            
            # Rate limiting between deletions
            time.sleep(2)
        
        logger.info(f"Bulk delete task completed: {len(results['success'])} successful, {len(results['failed'])} failed")
        return results
        
    except Exception as e:
        logger.error(f"Bulk delete task failed: {str(e)}")
        raise

@celery_app.task
def sync_all_ovh_resources(performed_by: str = "system"):
    """Sync all OVH resources in parallel"""
    logger.info(f"Starting full OVH resources sync requested by {performed_by}")
    
    # Execute sync tasks in parallel without blocking
    job = group(
        sync_pci_projects.s(performed_by),
        sync_iam_users.s(performed_by),
        sync_iam_policies.s(performed_by)
    )
    
    # Apply tasks asynchronously - don't wait for results in the task
    result = job.apply_async()
    
    logger.info(f"Full OVH resources sync initiated by {performed_by}")
    return f"Sync tasks dispatched: {result.id}"

@celery_app.task
def sync_pci_projects(performed_by: str = "system"):
    """Sync PCI projects"""
    try:
        logger.info("Starting PCI projects sync")
        projects, _ = enhanced_ovh_service.get_all_pci_projects(
            use_cache=False,
            performed_by=performed_by
        )
        logger.info(f"Successfully synced {len(projects)} PCI projects")
        return {"type": "pci_projects", "count": len(projects), "status": "success"}
    except Exception as e:
        logger.error(f"Failed to sync PCI projects: {str(e)}")
        return {"type": "pci_projects", "status": "failed", "error": str(e)}

@celery_app.task
def sync_iam_users(performed_by: str = "system"):
    """Sync IAM users"""
    try:
        logger.info("Starting IAM users sync")
        users, _ = enhanced_ovh_service.get_all_iam_users(
            use_cache=False,
            performed_by=performed_by
        )
        logger.info(f"Successfully synced {len(users)} IAM users")
        return {"type": "iam_users", "count": len(users), "status": "success"}
    except Exception as e:
        logger.error(f"Failed to sync IAM users: {str(e)}")
        return {"type": "iam_users", "status": "failed", "error": str(e)}

@celery_app.task
def sync_iam_policies(performed_by: str = "system"):
    """Sync IAM policies"""
    try:
        logger.info("Starting IAM policies sync")
        policies, _ = enhanced_ovh_service.get_all_iam_policies(
            use_cache=False,
            performed_by=performed_by
        )
        logger.info(f"Successfully synced {len(policies)} IAM policies")
        return {"type": "iam_policies", "count": len(policies), "status": "success"}
    except Exception as e:
        logger.error(f"Failed to sync IAM policies: {str(e)}")
        return {"type": "iam_policies", "status": "failed", "error": str(e)}

@celery_app.task
def cleanup_expired_cache():
    """Clean up expired cache entries"""
    try:
        from core.database import SessionLocal
        from models.ovh_resource_audit import OVHResourceCache
        from datetime import datetime
        
        db = SessionLocal()
        try:
            # Delete expired cache entries
            expired_count = db.query(OVHResourceCache).filter(
                OVHResourceCache.expires_at < datetime.utcnow()
            ).delete()
            
            db.commit()
            logger.info(f"Cleaned up {expired_count} expired cache entries")
            return {"cleaned": expired_count, "status": "success"}
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Failed to cleanup expired cache: {str(e)}")
        return {"status": "failed", "error": str(e)}

@celery_app.task
def cleanup_old_audit_logs(retention_days: int = 90):
    """Clean up old audit logs"""
    try:
        from core.database import SessionLocal
        from models.ovh_resource_audit import OVHResourceAudit
        from datetime import datetime, timedelta
        
        db = SessionLocal()
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
            
            # Delete old audit logs
            deleted_count = db.query(OVHResourceAudit).filter(
                OVHResourceAudit.created_at < cutoff_date
            ).delete()
            
            db.commit()
            logger.info(f"Cleaned up {deleted_count} audit log entries older than {retention_days} days")
            return {"cleaned": deleted_count, "status": "success"}
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Failed to cleanup old audit logs: {str(e)}")
        return {"status": "failed", "error": str(e)}

# Check if the celery app is configured and add periodic tasks
try:
    from celery.schedules import crontab
    
    # Update the beat schedule with OVH-specific tasks
    celery_app.conf.beat_schedule.update({
        'sync-ovh-resources': {
            'task': 'tasks.ovh_tasks.sync_all_ovh_resources',
            'schedule': crontab(minute='*/15'),  # Every 15 minutes
            'args': ('scheduler',)
        },
        'cleanup-expired-cache': {
            'task': 'tasks.ovh_tasks.cleanup_expired_cache',
            'schedule': crontab(minute='*/5'),  # Every 5 minutes
        },
        'cleanup-old-audit-logs': {
            'task': 'tasks.ovh_tasks.cleanup_old_audit_logs',
            'schedule': crontab(hour=2, minute=0),  # Daily at 2 AM
            'args': (90,)  # Keep 90 days of logs
        },
    })
    
    logger.info("OVH periodic tasks scheduled successfully")
    
except Exception as e:
    logger.error(f"Failed to schedule OVH periodic tasks: {str(e)}")