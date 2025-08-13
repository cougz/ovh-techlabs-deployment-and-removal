from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from typing import List, Optional, Dict
from pydantic import BaseModel
from api.routes.auth import get_current_user
from services.ovh_service_enhanced import enhanced_ovh_service
from schemas.pci_project import PCIProjectResponse, PCIProjectBulkDeleteRequest, PCIProjectSearchRequest, PCIProjectAuditLog
from api.websocket import manager
from core.logging import get_logger
from core.validation import InputValidator

logger = get_logger(__name__)

router = APIRouter()

class BulkDeleteResponse(BaseModel):
    message: str
    task_id: str

@router.get("/", response_model=List[PCIProjectResponse])
async def list_pci_projects(
    search: Optional[str] = Query(None, description="Search in project names, IDs, or service IDs"),
    state: Optional[str] = Query(None, description="Filter by project state"),
    use_cache: bool = Query(True, description="Use cached data if available"),
    current_user: str = Depends(get_current_user)
):
    """List all PCI projects with optional filtering"""
    try:
        # Validate search input if provided
        if search:
            search = InputValidator.validate_string_input(search, "search", max_length=100)
        
        # Validate state input if provided
        if state:
            state = InputValidator.validate_string_input(state, "state", max_length=50)
        
        projects, from_cache = enhanced_ovh_service.get_all_pci_projects(
            use_cache=use_cache,
            performed_by=current_user
        )
        
        # Apply filters
        if state:
            projects = [p for p in projects if p['state'] == state]
        
        if search:
            projects = enhanced_ovh_service.search_pci_projects(search)
        
        # Send WebSocket update if data was refreshed
        if not from_cache:
            await manager.broadcast_to_workshop(
                "system",
                {
                    "type": "resource_sync",
                    "resource_type": "pci_projects",
                    "count": len(projects),
                    "from_cache": from_cache
                }
            )
        
        return projects
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch PCI projects: {str(e)}"
        )

@router.get("/filter", response_model=List[PCIProjectResponse])
async def filter_pci_projects(
    state: Optional[str] = Query(None, description="Filter by project state"),
    search: Optional[str] = Query(None, description="Search in project names, IDs, or service IDs"),
    created_after: Optional[str] = Query(None, description="Filter by creation date (ISO format)"),
    current_user: str = Depends(get_current_user)
):
    """Filter PCI projects with query parameters"""
    try:
        projects, _ = enhanced_ovh_service.get_all_pci_projects(use_cache=True)
        
        # Apply state filter
        if state:
            projects = [p for p in projects if p.get('state') == state]
        
        # Apply search filter
        if search:
            search_lower = search.lower()
            projects = [p for p in projects if 
                       search_lower in p.get('display_name', '').lower() or
                       search_lower in p.get('project_id', '').lower() or
                       search_lower in str(p.get('service_id', '')).lower()]
        
        # Apply date filter
        if created_after:
            from datetime import datetime
            try:
                date_threshold = datetime.fromisoformat(created_after)
                projects = [p for p in projects if p.get('creation_date') and
                           datetime.fromisoformat(p['creation_date']) > date_threshold]
            except:
                pass
        
        return projects
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to filter PCI projects: {str(e)}"
        )

@router.post("/search", response_model=List[PCIProjectResponse])
async def search_pci_projects(
    request: PCIProjectSearchRequest,
    current_user: str = Depends(get_current_user)
):
    """Search PCI projects with advanced filtering"""
    try:
        projects = enhanced_ovh_service.search_pci_projects(
            request.query,
            request.field
        )
        return projects
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )

@router.delete("/{service_id}")
async def delete_pci_project(
    service_id: str,
    current_user: str = Depends(get_current_user)
):
    """Delete a PCI project"""
    # Validate service_id to prevent injection
    service_id = InputValidator.validate_identifier(service_id, "service_id")
    
    success = enhanced_ovh_service.delete_pci_project(service_id, current_user)
    
    if success:
        # Broadcast deletion via WebSocket
        await manager.broadcast_to_workshop(
            "system",
            {
                "type": "resource_deleted",
                "resource_type": "pci_project",
                "resource_id": service_id,
                "performed_by": current_user
            }
        )
        return {"message": f"PCI project {service_id} deletion initiated successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete PCI project {service_id}"
        )

@router.post("/bulk-delete-debug")
async def bulk_delete_debug(
    raw_request: Request,
    current_user: str = Depends(get_current_user)
):
    """Debug endpoint to see raw request data"""
    try:
        body = await raw_request.body()
        logger.info(f"DEBUG - Raw request body: {body.decode('utf-8')}")
        
        import json
        data = json.loads(body.decode('utf-8'))
        logger.info(f"DEBUG - Parsed JSON: {data}")
        
        return {"debug": "success", "data": data}
    except Exception as e:
        logger.error(f"DEBUG - Error: {str(e)}")
        return {"debug": "error", "error": str(e)}

@router.post("/bulk-delete", response_model=BulkDeleteResponse)
async def bulk_delete_pci_projects(
    raw_request: Request,
    request: PCIProjectBulkDeleteRequest,
    current_user: str = Depends(get_current_user)
):
    """Bulk delete PCI projects"""
    # Log raw request body for debugging
    try:
        body = await raw_request.body()
        logger.info(f"Raw request body: {body.decode('utf-8')}")
    except Exception as e:
        logger.warning(f"Could not read raw body: {e}")
    
    # Log the request for debugging
    logger.info(f"Bulk delete request received from user: {current_user}")
    logger.info(f"Parsed request: {request}")
    logger.info(f"Service IDs: {request.service_ids}")
    logger.info(f"Number of service IDs: {len(request.service_ids)}")
    
    # Log each service ID individually for debugging
    for i, service_id in enumerate(request.service_ids):
        logger.info(f"Service ID {i}: '{service_id}' (type: {type(service_id)}, length: {len(str(service_id))})")
    
    if not request.service_ids or len(request.service_ids) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one service ID is required"
        )
    
    if len(request.service_ids) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 50 projects can be deleted at once"
        )
    
    # Validate that all service_ids are strings and not empty
    for service_id in request.service_ids:
        if not service_id or not isinstance(service_id, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid service ID: {service_id}"
            )
    
    # Queue as Celery task for background processing
    from tasks.ovh_tasks import bulk_delete_pci_projects_task
    task = bulk_delete_pci_projects_task.delay(
        request.service_ids,
        current_user
    )
    
    return BulkDeleteResponse(
        message=f"Bulk deletion initiated for {len(request.service_ids)} projects",
        task_id=task.id
    )

@router.get("/audit-logs", response_model=List[PCIProjectAuditLog])
async def get_pci_audit_logs(
    resource_id: Optional[str] = Query(None, description="Filter by specific resource ID"),
    limit: int = Query(100, le=1000, description="Maximum number of logs to return"),
    current_user: str = Depends(get_current_user)
):
    """Get audit logs for PCI projects"""
    logs = enhanced_ovh_service.get_audit_logs(
        resource_type="pci_project",
        resource_id=resource_id,
        limit=limit
    )
    return logs

@router.get("/stats")
async def get_pci_projects_stats(
    current_user: str = Depends(get_current_user)
):
    """Get PCI projects statistics"""
    try:
        projects, _ = enhanced_ovh_service.get_all_pci_projects(use_cache=True)
        
        stats = {
            "total": len(projects),
            "by_state": {},
            "with_termination": 0
        }
        
        for project in projects:
            state = project.get('state', 'Unknown')
            stats["by_state"][state] = stats["by_state"].get(state, 0) + 1
            
            if project.get('termination_date'):
                stats["with_termination"] += 1
        
        return stats
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get statistics: {str(e)}"
        )