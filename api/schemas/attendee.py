from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID

class AttendeeBase(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    email: EmailStr

class AttendeeCreate(AttendeeBase):
    pass

class AttendeeResponse(AttendeeBase):
    id: UUID
    workshop_id: UUID
    ovh_project_id: Optional[str] = None
    ovh_user_urn: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class AttendeeCredentials(BaseModel):
    username: str
    password: str
    ovh_project_id: Optional[str] = None
    ovh_user_urn: Optional[str] = None