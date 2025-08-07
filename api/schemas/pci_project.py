from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class PCIProjectResponse(BaseModel):
    """Response schema for PCI Projects"""
    service_id: str
    project_id: Optional[str]
    display_name: str
    state: str
    creation_date: Optional[str]
    next_billing_date: Optional[str]
    termination_date: Optional[str]

class PCIProjectBulkDeleteRequest(BaseModel):
    """Request schema for bulk delete operations"""
    service_ids: List[str]
    
    class Config:
        schema_extra = {
            "example": {
                "service_ids": ["12345", "67890", "11111"]
            }
        }

class PCIProjectSearchRequest(BaseModel):
    """Request schema for search operations"""
    query: str
    field: str = "all"  # all, name, id, service_id
    
    class Config:
        schema_extra = {
            "example": {
                "query": "test project",
                "field": "name"
            }
        }

class PCIProjectAuditLog(BaseModel):
    """Response schema for audit logs"""
    id: str
    resource_type: str
    resource_id: str
    resource_name: Optional[str]
    action: str
    action_status: str
    performed_by: str
    error_message: Optional[str]
    metadata: Optional[dict]
    created_at: str