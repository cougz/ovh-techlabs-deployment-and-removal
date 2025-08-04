from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel
from typing import Dict, Any
import asyncio

from core.config import settings

router = APIRouter()

class BroadcastRequest(BaseModel):
    workshop_id: str
    message: Dict[str, Any]

@router.post("/broadcast")
async def internal_broadcast(
    request: BroadcastRequest,
    x_internal_key: str = Header(None)
):
    """Internal endpoint for broadcasting WebSocket messages from Celery tasks."""
    # Verify internal API key
    if x_internal_key != settings.INTERNAL_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key"
        )
    
    # Import here to avoid circular import
    from api.websocket import manager
    
    # Broadcast message to workshop
    await manager.broadcast_to_workshop(
        request.workshop_id,
        request.message
    )
    
    return {"status": "broadcasted", "workshop_id": request.workshop_id}