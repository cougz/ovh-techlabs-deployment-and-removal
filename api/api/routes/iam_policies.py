from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional
from api.routes.auth import get_current_user
from services.ovh_service_enhanced import enhanced_ovh_service
from schemas.iam_policy import IAMPolicyResponse
from schemas.pci_project import PCIProjectAuditLog
from api.websocket import manager
from core.config import settings
from core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()

@router.get("/", response_model=List[IAMPolicyResponse])
async def list_iam_policies(
    use_cache: bool = Query(True, description="Use cached data if available"),
    current_user: str = Depends(get_current_user)
):
    """List all IAM policies"""
    try:
        policies, from_cache = enhanced_ovh_service.get_all_iam_policies(
            use_cache=use_cache,
            performed_by=current_user
        )
        
        # Send WebSocket update if data was refreshed
        if not from_cache:
            await manager.broadcast_to_workshop(
                "system",
                {
                    "type": "resource_sync",
                    "resource_type": "iam_policies",
                    "count": len(policies),
                    "from_cache": from_cache
                }
            )
        
        return policies
        
    except Exception as e:
        logger.error(f"Failed to fetch IAM policies: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error occurred while fetching policies" if not settings.DEBUG else f"Failed to fetch IAM policies: {str(e)}"
        )

@router.get("/filter", response_model=List[IAMPolicyResponse])
async def filter_iam_policies(
    owner: Optional[str] = Query(None, description="Filter by owner"),
    read_only: Optional[bool] = Query(None, description="Filter by read-only status"),
    search: Optional[str] = Query(None, description="Search in name, description, or ID"),
    has_identities: Optional[bool] = Query(None, description="Filter policies with identities"),
    has_resources: Optional[bool] = Query(None, description="Filter policies with resources"),
    current_user: str = Depends(get_current_user)
):
    """Filter IAM policies with query parameters"""
    try:
        policies, _ = enhanced_ovh_service.get_all_iam_policies(use_cache=True)
        
        # Apply owner filter
        if owner:
            policies = [p for p in policies if p.get('owner') == owner]
        
        # Apply read_only filter
        if read_only is not None:
            policies = [p for p in policies if p.get('read_only') == read_only]
        
        # Apply search filter
        if search:
            search_lower = search.lower()
            policies = [p for p in policies if 
                       search_lower in p.get('name', '').lower() or
                       search_lower in p.get('description', '').lower() or
                       search_lower in p.get('id', '').lower()]
        
        # Apply has_identities filter
        if has_identities is not None:
            if has_identities:
                policies = [p for p in policies if p.get('identities') and len(p['identities']) > 0]
            else:
                policies = [p for p in policies if not p.get('identities') or len(p['identities']) == 0]
        
        # Apply has_resources filter
        if has_resources is not None:
            if has_resources:
                policies = [p for p in policies if p.get('resources') and len(p['resources']) > 0]
            else:
                policies = [p for p in policies if not p.get('resources') or len(p['resources']) == 0]
        
        return policies
    except Exception as e:
        logger.error(f"Failed to filter IAM policies: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error occurred while filtering policies" if not settings.DEBUG else f"Failed to filter IAM policies: {str(e)}"
        )

@router.get("/audit-logs", response_model=List[PCIProjectAuditLog])
async def get_iam_policy_audit_logs(
    resource_id: Optional[str] = Query(None, description="Filter by specific policy ID"),
    limit: int = Query(100, le=1000, description="Maximum number of logs to return"),
    current_user: str = Depends(get_current_user)
):
    """Get audit logs for IAM policies"""
    logs = enhanced_ovh_service.get_audit_logs(
        resource_type="iam_policy",
        resource_id=resource_id,
        limit=limit
    )
    return logs

@router.delete("/{policy_id}")
async def delete_iam_policy(
    policy_id: str,
    current_user: str = Depends(get_current_user)
):
    """Delete an IAM policy"""
    success = enhanced_ovh_service.delete_iam_policy(policy_id, current_user)
    
    if success:
        # Broadcast deletion via WebSocket
        await manager.broadcast_to_workshop(
            "system",
            {
                "type": "resource_deleted",
                "resource_type": "iam_policy",
                "resource_id": policy_id
            }
        )
        return {"message": f"IAM policy {policy_id} deleted successfully"}
    else:
        logger.error(f"Failed to delete IAM policy {policy_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error occurred while deleting policy" if not settings.DEBUG else f"Failed to delete IAM policy {policy_id}"
        )

@router.post("/bulk-delete")
async def bulk_delete_iam_policies(
    policy_ids: List[str],
    current_user: str = Depends(get_current_user)
):
    """Bulk delete IAM policies"""
    if len(policy_ids) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete more than 50 policies at once"
        )
    
    results = enhanced_ovh_service.bulk_delete_iam_policies(policy_ids, current_user)
    
    # Broadcast bulk deletion via WebSocket
    await manager.broadcast_to_workshop(
        "system",
        {
            "type": "bulk_resource_deleted",
            "resource_type": "iam_policies",
            "count": len(results["success"]),
            "results": results
        }
    )
    
    return results

@router.get("/stats")
async def get_iam_policies_stats(
    current_user: str = Depends(get_current_user)
):
    """Get IAM policies statistics"""
    try:
        policies, _ = enhanced_ovh_service.get_all_iam_policies(use_cache=True)
        
        stats = {
            "total": len(policies),
            "read_only": 0,
            "with_identities": 0,
            "with_resources": 0,
            "by_owner": {}
        }
        
        for policy in policies:
            # Count read-only policies
            if policy.get('read_only', False):
                stats["read_only"] += 1
            
            # Count policies with identities
            if policy.get('identities'):
                stats["with_identities"] += 1
            
            # Count policies with resources
            if policy.get('resources'):
                stats["with_resources"] += 1
            
            # Count by owner
            owner = policy.get('owner', 'Unknown')
            stats["by_owner"][owner] = stats["by_owner"].get(owner, 0) + 1
        
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error occurred while getting statistics" if not settings.DEBUG else f"Failed to get statistics: {str(e)}"
        )