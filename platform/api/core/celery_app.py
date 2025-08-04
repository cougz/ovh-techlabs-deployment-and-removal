from celery import Celery
from celery.schedules import crontab
from core.config import settings

# Create Celery instance
celery_app = Celery(
    "techlabs_automation",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "tasks.terraform_tasks",
        "tasks.cleanup_tasks",
        "tasks.notification_tasks"
    ]
)

# Configure Celery
celery_app.conf.update(
    task_serializer=settings.CELERY_TASK_SERIALIZER,
    accept_content=settings.CELERY_ACCEPT_CONTENT,
    result_serializer=settings.CELERY_RESULT_SERIALIZER,
    timezone=settings.CELERY_TIMEZONE,
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
)

# Schedule periodic tasks
celery_app.conf.beat_schedule = {
    'process-workshop-lifecycle': {
        'task': 'tasks.cleanup_tasks.process_workshop_lifecycle',
        'schedule': crontab(minute='*/30'),  # Every 30 minutes
    },
    'update-workshop-statuses': {
        'task': 'tasks.cleanup_tasks.update_workshop_statuses',
        'schedule': crontab(minute='*/2'),  # Every 2 minutes
    },
    'health-check-resources': {
        'task': 'tasks.terraform_tasks.health_check_resources',
        'schedule': crontab(minute=0, hour='*/12'),  # Every 12 hours
    },
}

# Configure task routes
celery_app.conf.task_routes = {
    'tasks.terraform_tasks.*': {'queue': 'terraform'},
    'tasks.cleanup_tasks.*': {'queue': 'cleanup'},
    'tasks.notification_tasks.*': {'queue': 'notifications'},
}