from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional
from api.routes.auth import get_current_user
from services.ovh_service_enhanced import enhanced_ovh_service
from schemas.iam_policy import IAMPolicyResponse
from schemas.pci_project import PCIProjectAuditLog
from api.websocket import manager

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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch IAM policies: {str(e)}"
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get statistics: {str(e)}"
        )