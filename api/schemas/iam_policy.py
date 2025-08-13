from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class IAMPolicyResponse(BaseModel):
    """Response schema for IAM Policies"""
    id: Optional[str]
    name: Optional[str]
    description: str
    owner: Optional[str]
    read_only: bool
    identities: List[str]
    resources: List[str]
    permissions: Dict[str, Any]
    created_at: Optional[str]

class IAMPolicyBulkDeleteRequest(BaseModel):
    """Request schema for bulk delete operations"""
    policy_ids: List[str] = Field(
        ..., 
        min_items=1, 
        max_items=50,
        description="List of policy IDs to delete"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "policy_ids": ["policy-id-1", "policy-id-2", "policy-id-3"]
            }
        }