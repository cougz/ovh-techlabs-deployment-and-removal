from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Dict
from api.routes.auth import get_current_user
from services.ovh_service_enhanced import enhanced_ovh_service
from schemas.iam_user import IAMUserResponse, IAMUserFilterRequest
from schemas.pci_project import PCIProjectAuditLog
from api.websocket import manager

router = APIRouter()

@router.get("/", response_model=List[IAMUserResponse])
async def list_iam_users(
    use_cache: bool = Query(True, description="Use cached data if available"),
    current_user: str = Depends(get_current_user)
):
    """List all IAM users"""
    try:
        users, from_cache = enhanced_ovh_service.get_all_iam_users(
            use_cache=use_cache,
            performed_by=current_user
        )
        
        # Send WebSocket update if data was refreshed
        if not from_cache:
            await manager.broadcast_to_workshop(
                "system",
                {
                    "type": "resource_sync",
                    "resource_type": "iam_users",
                    "count": len(users),
                    "from_cache": from_cache
                }
            )
        
        return users
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch IAM users: {str(e)}"
        )

@router.get("/filter", response_model=List[IAMUserResponse])
async def filter_iam_users_get(
    status: Optional[str] = Query(None, description="Filter by status"),
    group: Optional[str] = Query(None, description="Filter by group"),
    search: Optional[str] = Query(None, description="Search in username, email, description"),
    created_after: Optional[str] = Query(None, description="Filter by creation date (ISO format)"),
    current_user: str = Depends(get_current_user)
):
    """Filter IAM users with query parameters"""
    try:
        filters = {}
        if status:
            filters['status'] = status
        if group:
            filters['group'] = group
        if search:
            filters['search'] = search
        if created_after:
            filters['created_after'] = created_after
            
        users = enhanced_ovh_service.filter_iam_users(filters)
        return users
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Filtering failed: {str(e)}"
        )

@router.post("/filter", response_model=List[IAMUserResponse])
async def filter_iam_users_post(
    filters: IAMUserFilterRequest,
    current_user: str = Depends(get_current_user)
):
    """Filter IAM users with advanced criteria (POST)"""
    try:
        users = enhanced_ovh_service.filter_iam_users(filters.dict(exclude_unset=True))
        return users
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Filtering failed: {str(e)}"
        )

@router.get("/audit-logs", response_model=List[PCIProjectAuditLog])
async def get_iam_user_audit_logs(
    resource_id: Optional[str] = Query(None, description="Filter by specific username"),
    limit: int = Query(100, le=1000, description="Maximum number of logs to return"),
    current_user: str = Depends(get_current_user)
):
    """Get audit logs for IAM users"""
    logs = enhanced_ovh_service.get_audit_logs(
        resource_type="iam_user",
        resource_id=resource_id,
        limit=limit
    )
    return logs

@router.delete("/{username}")
async def delete_iam_user(
    username: str,
    current_user: str = Depends(get_current_user)
):
    """Delete an IAM user"""
    success = enhanced_ovh_service.delete_iam_user(username, current_user)
    
    if success:
        # Broadcast deletion via WebSocket
        await manager.broadcast_to_workshop(
            "system",
            {
                "type": "resource_deleted",
                "resource_type": "iam_user",
                "resource_id": username
            }
        )
        return {"message": f"IAM user {username} deleted successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete IAM user {username}"
        )

@router.post("/bulk-delete")
async def bulk_delete_iam_users(
    usernames: List[str],
    current_user: str = Depends(get_current_user)
):
    """Bulk delete IAM users"""
    if len(usernames) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete more than 50 users at once"
        )
    
    results = enhanced_ovh_service.bulk_delete_iam_users(usernames, current_user)
    
    # Broadcast bulk deletion via WebSocket
    await manager.broadcast_to_workshop(
        "system",
        {
            "type": "bulk_resource_deleted",
            "resource_type": "iam_users",
            "count": len(results["success"]),
            "results": results
        }
    )
    
    return results

@router.get("/stats")
async def get_iam_users_stats(
    current_user: str = Depends(get_current_user)
):
    """Get IAM users statistics"""
    try:
        users, _ = enhanced_ovh_service.get_all_iam_users(use_cache=True)
        
        stats = {
            "total": len(users),
            "by_status": {},
            "by_group": {},
            "recent_activity": 0
        }
        
        from datetime import datetime, timedelta
        thirty_days_ago = datetime.now() - timedelta(days=30)
        
        for user in users:
            # Count by status
            status = user.get('status', 'Unknown')
            stats["by_status"][status] = stats["by_status"].get(status, 0) + 1
            
            # Count by group
            group = user.get('group', 'Unknown')
            stats["by_group"][group] = stats["by_group"].get(group, 0) + 1
            
            # Count recent activity
            if user.get('last_update'):
                try:
                    last_update = datetime.fromisoformat(user['last_update'])
                    if last_update > thirty_days_ago:
                        stats["recent_activity"] += 1
                except:
                    pass
        
        return stats
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get statistics: {str(e)}"
        )