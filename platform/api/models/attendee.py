from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from core.database import Base

class Attendee(Base):
    __tablename__ = "attendees"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workshop_id = Column(UUID(as_uuid=True), ForeignKey("workshops.id", ondelete="CASCADE"), nullable=False)
    username = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    ovh_project_id = Column(String(100))
    ovh_user_urn = Column(String(255))
    status = Column(
        String(50), 
        default='planning',
        nullable=False
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    workshop = relationship("Workshop", back_populates="attendees")
    deployment_logs = relationship("DeploymentLog", back_populates="attendee", cascade="all, delete-orphan")
    credential = relationship("Credential", back_populates="attendee", uselist=False, cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('workshop_id', 'username', name='unique_workshop_username'),
        UniqueConstraint('workshop_id', 'email', name='unique_workshop_email'),
    )
    
    def __repr__(self):
        return f"<Attendee(id={self.id}, username='{self.username}', status='{self.status}')>"