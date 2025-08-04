from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from zoneinfo import ZoneInfo

class WorkshopBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime

class WorkshopCreate(WorkshopBase):
    pass

class WorkshopCreateWithTimezone(WorkshopBase):
    timezone: str = Field(..., description="Workshop timezone (e.g., 'Europe/Madrid', 'Asia/Kolkata')")
    
    @validator('timezone')
    def validate_timezone(cls, v):
        """Validate that the timezone is supported."""
        supported_timezones = [
            "Europe/Madrid",
            "Asia/Kolkata", 
            "UTC",
            "America/New_York",
            "Europe/London"
        ]
        
        if v not in supported_timezones:
            raise ValueError(f"Unsupported timezone: {v}")
        
        return v
    
    @validator('start_date', 'end_date')
    def validate_timezone_aware_dates(cls, v):
        """Ensure dates are timezone-aware."""
        if v.tzinfo is None:
            raise ValueError("Dates must be timezone-aware")
        return v

class WorkshopCreateWithTemplate(WorkshopCreateWithTimezone):
    template: str = Field(..., description="Workshop template (e.g., 'Generic')")
    
    @validator('template')
    def validate_template(cls, v):
        """Validate that the template is supported."""
        supported_templates = [
            "Generic"
        ]
        
        if v not in supported_templates:
            raise ValueError(f"Unsupported template: {v}")
        
        return v

class WorkshopTemplate(BaseModel):
    name: str
    description: str
    resources: List[str]
    is_active: bool = True
    resource_config: Optional[dict] = None

class WorkshopUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None
    deletion_scheduled_at: Optional[datetime] = Field(None, nullable=True)

class WorkshopResponse(WorkshopBase):
    id: UUID
    status: str
    created_at: datetime
    updated_at: datetime
    deletion_scheduled_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class WorkshopSummary(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime
    status: str
    created_at: datetime
    attendee_count: int
    active_attendees: int
    
    class Config:
        from_attributes = True