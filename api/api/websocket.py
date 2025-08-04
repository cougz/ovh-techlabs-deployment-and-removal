from fastapi import WebSocket, WebSocketDisconnect, Depends
from typing import Dict, Set
import json
import logging
from datetime import datetime
from uuid import UUID

from core.database import get_db
from sqlalchemy.orm import Session
from api.routes.auth import verify_websocket_token

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Store active connections by workshop ID
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Store connection to workshop mapping
        self.connection_workshops: Dict[WebSocket, Set[str]] = {}
        # Store global connections that receive updates for all workshops
        self.global_connections: Set[WebSocket] = set()
        # Store connection to global mapping
        self.connection_global: Dict[WebSocket, bool] = {}
    
    async def connect(self, websocket: WebSocket, workshop_id: str):
        """Accept WebSocket connection and add to workshop group."""
        await websocket.accept()
        
        # Add to workshop connections
        if workshop_id not in self.active_connections:
            self.active_connections[workshop_id] = set()
        self.active_connections[workshop_id].add(websocket)
        
        # Track which workshops this connection is subscribed to
        if websocket not in self.connection_workshops:
            self.connection_workshops[websocket] = set()
        self.connection_workshops[websocket].add(workshop_id)
        
        logger.info(f"WebSocket connected to workshop {workshop_id}")
    
    async def connect_global(self, websocket: WebSocket):
        """Accept WebSocket connection for global updates."""
        await websocket.accept()
        
        # Add to global connections
        self.global_connections.add(websocket)
        self.connection_global[websocket] = True
        
        logger.info("WebSocket connected to global updates")
    
    def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection from all workshop groups and global connections."""
        # Get all workshops this connection was subscribed to
        workshop_ids = self.connection_workshops.get(websocket, set())
        
        # Remove from each workshop
        for workshop_id in workshop_ids:
            if workshop_id in self.active_connections:
                self.active_connections[workshop_id].discard(websocket)
                # Clean up empty workshop groups
                if not self.active_connections[workshop_id]:
                    del self.active_connections[workshop_id]
        
        # Remove from global connections
        self.global_connections.discard(websocket)
        if websocket in self.connection_global:
            del self.connection_global[websocket]
        
        # Remove connection tracking
        if websocket in self.connection_workshops:
            del self.connection_workshops[websocket]
        
        logger.info(f"WebSocket disconnected from workshops: {workshop_ids} (global: {websocket in self.connection_global})")
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Send message to specific WebSocket connection."""
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            self.disconnect(websocket)
    
    async def broadcast_to_workshop(self, workshop_id: str, message: dict):
        """Broadcast message to all connections in a workshop and global connections."""
        message_str = json.dumps({
            **message,
            "timestamp": datetime.utcnow().isoformat(),
            "workshop_id": workshop_id
        })
        
        disconnected = []
        
        # Send to workshop-specific connections
        if workshop_id in self.active_connections:
            for connection in self.active_connections[workshop_id]:
                try:
                    await connection.send_text(message_str)
                except Exception as e:
                    logger.error(f"Error broadcasting to workshop connection: {e}")
                    disconnected.append(connection)
        
        # Send to global connections
        for connection in self.global_connections:
            try:
                await connection.send_text(message_str)
            except Exception as e:
                logger.error(f"Error broadcasting to global connection: {e}")
                disconnected.append(connection)
        
        # Clean up disconnected connections
        for connection in disconnected:
            self.disconnect(connection)
    
    async def broadcast_status_update(self, workshop_id: str, entity_type: str, 
                                    entity_id: str, status: str, details: dict = None):
        """Broadcast status update for workshop or attendee."""
        message = {
            "type": "status_update",
            "entity_type": entity_type,  # "workshop" or "attendee"
            "entity_id": entity_id,
            "status": status,
            "details": details or {}
        }
        await self.broadcast_to_workshop(workshop_id, message)
    
    async def broadcast_deployment_log(self, workshop_id: str, attendee_id: str, 
                                     log_entry: dict):
        """Broadcast deployment log entry."""
        message = {
            "type": "deployment_log",
            "attendee_id": attendee_id,
            "log_entry": log_entry
        }
        await self.broadcast_to_workshop(workshop_id, message)
    
    async def broadcast_deployment_progress(self, workshop_id: str, attendee_id: str,
                                          progress: int, current_step: str):
        """Broadcast deployment progress update."""
        message = {
            "type": "deployment_progress",
            "attendee_id": attendee_id,
            "progress": progress,
            "current_step": current_step
        }
        await self.broadcast_to_workshop(workshop_id, message)

# Global connection manager instance
manager = ConnectionManager()

async def websocket_endpoint(
    websocket: WebSocket,
    workshop_id: str,
    token: str = None,
    db: Session = Depends(get_db)
):
    """WebSocket endpoint for real-time updates."""
    # Verify token if provided
    if token:
        user = await verify_websocket_token(token)
        if not user:
            await websocket.close(code=1008, reason="Invalid token")
            return
    
    await manager.connect(websocket, workshop_id)
    
    try:
        # Send initial connection confirmation
        await manager.send_personal_message(
            json.dumps({
                "type": "connection",
                "status": "connected",
                "workshop_id": workshop_id,
                "timestamp": datetime.utcnow().isoformat()
            }),
            websocket
        )
        
        # Keep connection alive and handle incoming messages
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message.get("type") == "ping":
                await manager.send_personal_message(
                    json.dumps({"type": "pong", "timestamp": datetime.utcnow().isoformat()}),
                    websocket
                )
            elif message.get("type") == "subscribe":
                # Subscribe to additional workshops
                additional_workshop_id = message.get("workshop_id")
                if additional_workshop_id:
                    await manager.connect(websocket, additional_workshop_id)
                    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
        await websocket.close(code=1011, reason="Internal error")

async def global_websocket_endpoint(
    websocket: WebSocket,
    token: str = None,
    db: Session = Depends(get_db)
):
    """Global WebSocket endpoint for real-time updates across all workshops."""
    # Verify token if provided
    if token:
        user = await verify_websocket_token(token)
        if not user:
            await websocket.close(code=1008, reason="Invalid token")
            return
    
    await manager.connect_global(websocket)
    
    try:
        # Send initial connection confirmation
        await manager.send_personal_message(
            json.dumps({
                "type": "connection",
                "status": "connected",
                "global": True,
                "timestamp": datetime.utcnow().isoformat()
            }),
            websocket
        )
        
        # Keep connection alive and handle incoming messages
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message.get("type") == "ping":
                await manager.send_personal_message(
                    json.dumps({"type": "pong", "timestamp": datetime.utcnow().isoformat()}),
                    websocket
                )
                    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Global WebSocket error: {e}")
        manager.disconnect(websocket)
        await websocket.close(code=1011, reason="Internal error")