from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class IAMUserResponse(BaseModel):
    """Response schema for IAM Users"""
    username: str
    description: str
    email: str
    creation: Optional[str]
    last_update: Optional[str]
    status: str
    group: str
    urn: str

class IAMUserFilterRequest(BaseModel):
    """Request schema for filtering IAM users"""
    group: Optional[str] = None
    status: Optional[str] = None
    created_after: Optional[str] = None
    search: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "group": "administrators",
                "status": "active",
                "search": "john"
            }
        }

class IAMUserBulkDeleteRequest(BaseModel):
    """Request schema for bulk delete operations"""
    usernames: List[str] = Field(
        ..., 
        min_items=1, 
        max_items=50,
        description="List of usernames to delete"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "usernames": ["user1", "user2", "user3"]
            }
        }