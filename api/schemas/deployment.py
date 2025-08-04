from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID

class DeploymentLogResponse(BaseModel):
    id: UUID
    attendee_id: UUID
    action: str
    status: str
    terraform_output: Optional[str] = None
    error_message: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True