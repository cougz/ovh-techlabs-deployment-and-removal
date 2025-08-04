import asyncio
from typing import Optional
import requests
import json
import logging

from core.config import settings

logger = logging.getLogger(__name__)

def send_websocket_update(workshop_id: str, message: dict):
    """
    Send WebSocket update from Celery task (sync context).
    This sends an HTTP request to the API to trigger the WebSocket broadcast.
    """
    try:
        # In production, we'd use a proper message queue (Redis pub/sub)
        # For now, we'll use a simple HTTP callback
        url = f"http://ovh-techlabs-api:8000/internal/broadcast"
        payload = {
            "workshop_id": workshop_id,
            "message": message
        }
        
        # Use internal API key for authentication
        headers = {
            "X-Internal-Key": settings.INTERNAL_API_KEY,
            "Content-Type": "application/json"
        }
        
        response = requests.post(url, json=payload, headers=headers, timeout=5)
        if response.status_code != 200:
            logger.error(f"Failed to send WebSocket update: {response.status_code}")
    except Exception as e:
        logger.error(f"Error sending WebSocket update: {e}")

def broadcast_status_update(workshop_id: str, entity_type: str, 
                          entity_id: str, status: str, details: dict = None):
    """Broadcast status update for workshop or attendee."""
    message = {
        "type": "status_update",
        "entity_type": entity_type,
        "entity_id": entity_id,
        "status": status,
        "details": details or {}
    }
    send_websocket_update(workshop_id, message)

def broadcast_deployment_log(workshop_id: str, attendee_id: str, 
                           action: str, status: str, output: str = None, 
                           error: str = None):
    """Broadcast deployment log entry."""
    message = {
        "type": "deployment_log",
        "attendee_id": attendee_id,
        "log_entry": {
            "action": action,
            "status": status,
            "output": output,
            "error": error
        }
    }
    send_websocket_update(workshop_id, message)

def broadcast_deployment_progress(workshop_id: str, attendee_id: str,
                                progress: int, current_step: str):
    """Broadcast deployment progress update."""
    message = {
        "type": "deployment_progress",
        "attendee_id": attendee_id,
        "progress": progress,
        "current_step": current_step
    }
    send_websocket_update(workshop_id, message)