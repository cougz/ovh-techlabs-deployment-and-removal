from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
import logging
from typing import Optional

from core.config import settings
from core.database import engine, Base
from core.celery_app import celery_app
# Import all models to ensure they're registered with SQLAlchemy
import models
from api.routes import workshops, attendees, deployments, auth, health, internal, config_routes, templates, pci_projects, iam_users, iam_policies
from api.websocket import websocket_endpoint, global_websocket_endpoint, manager
from core.logging import setup_logging

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Create database tables
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting TechLabs Automation API")
    
    # Queue immediate cleanup check on startup
    from tasks.cleanup_tasks import process_workshop_lifecycle
    process_workshop_lifecycle.delay()
    logger.info("Queued startup workshop lifecycle check")
    
    yield
    # Shutdown
    logger.info("Shutting down TechLabs Automation API")

# Create FastAPI app
app = FastAPI(
    title="TechLabs Automation API",
    description="API for managing workshop environments and OVHcloud resources",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "Accept",
        "Accept-Language",
        "Content-Language",
        "Content-Type",
        "Authorization",
        "X-Requested-With"
    ],
    expose_headers=["X-Total-Count"],
    max_age=3600  # Cache preflight for 1 hour
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    # Log all requests to PCI projects endpoints
    if "pci-projects" in str(request.url):
        logger.info(f"REQUEST DEBUG: {request.method} {request.url}")
        logger.info(f"REQUEST DEBUG: Headers: {dict(request.headers)}")
        
        # Read body for POST requests
        if request.method == "POST":
            try:
                body = await request.body()
                logger.info(f"REQUEST DEBUG: Body: {body.decode('utf-8')}")
            except Exception as e:
                logger.info(f"REQUEST DEBUG: Could not read body: {e}")
    
    response = await call_next(request)
    
    if "pci-projects" in str(request.url):
        logger.info(f"RESPONSE DEBUG: Status: {response.status_code}")
        
    return response

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Content Security Policy
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' localhost:* ws:; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "img-src 'self' data: https: blob:; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "connect-src 'self' ws: wss: localhost:* https:; "
        "frame-ancestors 'none'; "
        "object-src 'none'; "
        "base-uri 'self'"
    )
    
    response.headers["Content-Security-Policy"] = csp
    
    # Remove server header if present
    if "server" in response.headers:
        del response.headers["server"]
    
    return response

# Include routers
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(workshops.router, prefix="/api/workshops", tags=["workshops"])
app.include_router(attendees.router, prefix="/api/attendees", tags=["attendees"])
app.include_router(deployments.router, prefix="/api/deployments", tags=["deployments"])
app.include_router(config_routes.router, prefix="/api/settings", tags=["settings"])
app.include_router(templates.router, prefix="/api/templates", tags=["templates"])
app.include_router(pci_projects.router, prefix="/api/ovh/pci-projects", tags=["pci-projects"])
app.include_router(iam_users.router, prefix="/api/ovh/iam-users", tags=["iam-users"])
app.include_router(iam_policies.router, prefix="/api/ovh/iam-policies", tags=["iam-policies"])
app.include_router(internal.router, prefix="/internal", tags=["internal"])

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "TechLabs Automation API",
        "version": "1.0.0",
        "status": "running"
    }

# WebSocket endpoints
@app.websocket("/ws/{workshop_id}")
async def websocket_route(websocket: WebSocket, workshop_id: str, token: str = None):
    await websocket_endpoint(websocket, workshop_id, token)

@app.websocket("/ws/global")
async def global_websocket_route(websocket: WebSocket, token: str = None):
    await global_websocket_endpoint(websocket, token)

# Make celery available for tasks
celery = celery_app

# Export manager for use in other modules
websocket_manager = manager

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )