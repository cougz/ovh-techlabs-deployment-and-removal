from pydantic import BaseModel
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