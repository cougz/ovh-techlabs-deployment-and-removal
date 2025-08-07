from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Union
from datetime import datetime
import re

class PCIProjectResponse(BaseModel):
    """Response schema for PCI Projects"""
    service_id: Union[str, int] = Field(..., description="Service ID")
    project_id: Optional[str] = Field(None, max_length=100, description="Project ID")
    display_name: str = Field(..., min_length=1, max_length=255, description="Display name")
    state: str = Field(..., max_length=50, description="Project state")
    creation_date: Optional[str] = Field(None, description="Creation date in ISO format")
    next_billing_date: Optional[str] = Field(None, description="Next billing date in ISO format")
    termination_date: Optional[str] = Field(None, description="Termination date in ISO format")

class PCIProjectBulkDeleteRequest(BaseModel):
    """Request schema for bulk delete operations"""
    service_ids: List[str] = Field(
        ..., 
        min_items=1, 
        max_items=50,
        description="List of service IDs to delete"
    )
    
    @field_validator('service_ids')
    @classmethod
    def validate_service_ids(cls, v):
        if not v:
            raise ValueError("At least one service ID is required")
        
        validated_ids = []
        for service_id in v:
            if not service_id or not isinstance(service_id, str):
                raise ValueError("Service ID must be a non-empty string")
            
            # Remove whitespace
            service_id = service_id.strip()
            
            if not service_id:
                raise ValueError("Service ID cannot be empty or whitespace")
            
            # Validate format - only alphanumeric, hyphens, underscores
            if not re.match(r'^[a-zA-Z0-9\-_]+$', service_id):
                raise ValueError(f"Invalid service ID format: {service_id}")
            
            if len(service_id) > 50:
                raise ValueError(f"Service ID too long: {service_id}")
            
            validated_ids.append(service_id)
        
        # Check for duplicates
        if len(validated_ids) != len(set(validated_ids)):
            raise ValueError("Duplicate service IDs found")
        
        return validated_ids
    
    class Config:
        json_schema_extra = {
            "example": {
                "service_ids": ["12345", "67890", "11111"]
            }
        }

class PCIProjectSearchRequest(BaseModel):
    """Request schema for search operations"""
    query: str = Field(
        ..., 
        min_length=1, 
        max_length=100,
        description="Search query"
    )
    field: str = Field(
        default="all", 
        description="Field to search in"
    )
    
    @field_validator('query')
    @classmethod
    def validate_query(cls, v):
        if not v or not v.strip():
            raise ValueError("Query cannot be empty")
        
        # Remove extra whitespace
        v = v.strip()
        
        # Check for potentially malicious patterns
        if re.search(r'[<>"\']', v):
            raise ValueError("Query contains invalid characters")
        
        return v
    
    @field_validator('field')
    @classmethod
    def validate_field(cls, v):
        allowed_fields = ["all", "name", "id", "service_id"]
        if v not in allowed_fields:
            raise ValueError(f"Field must be one of: {allowed_fields}")
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "query": "test project",
                "field": "name"
            }
        }

class PCIProjectAuditLog(BaseModel):
    """Response schema for audit logs"""
    id: str = Field(..., description="Audit log ID")
    resource_type: str = Field(..., max_length=50, description="Resource type")
    resource_id: str = Field(..., max_length=100, description="Resource ID")
    resource_name: Optional[str] = Field(None, max_length=255, description="Resource name")
    action: str = Field(..., max_length=50, description="Action performed")
    action_status: str = Field(..., max_length=20, description="Action status")
    performed_by: str = Field(..., max_length=100, description="User who performed action")
    error_message: Optional[str] = Field(None, max_length=1000, description="Error message if any")
    metadata: Optional[dict] = Field(None, description="Additional metadata")
    created_at: str = Field(..., description="Creation timestamp in ISO format")