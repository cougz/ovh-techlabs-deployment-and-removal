from sqlalchemy import Column, String, Text, DateTime, Boolean, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from core.database import Base

class Workshop(Base):
    __tablename__ = "workshops"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    timezone = Column(String(50), default='UTC', nullable=False)
    template = Column(String(50), default='Generic', nullable=False)
    status = Column(
        String(50), 
        default='planning',
        nullable=False
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deletion_scheduled_at = Column(DateTime(timezone=True))
    
    # Relationships
    attendees = relationship("Attendee", back_populates="workshop", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('end_date > start_date', name='valid_dates'),
        CheckConstraint(
            "status IN ('planning', 'deploying', 'active', 'completed', 'failed', 'deleting')",
            name='valid_status'
        ),
    )
    
    def __repr__(self):
        return f"<Workshop(id={self.id}, name='{self.name}', status='{self.status}')>"