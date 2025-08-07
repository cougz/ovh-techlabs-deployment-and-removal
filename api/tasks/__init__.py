# Tasks package

# Import all task modules to ensure they're discovered by Celery
from . import terraform_tasks
from . import cleanup_tasks
from . import notification_tasks
from . import websocket_updates
from . import ovh_tasks  # New OVH tasks

__all__ = [
    "terraform_tasks",
    "cleanup_tasks", 
    "notification_tasks",
    "websocket_updates",
    "ovh_tasks"
]