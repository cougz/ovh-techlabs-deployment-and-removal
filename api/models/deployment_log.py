from sqlalchemy import Column, String, Text, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from core.database import Base

class DeploymentLog(Base):
    __tablename__ = "deployment_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    attendee_id = Column(UUID(as_uuid=True), ForeignKey("attendees.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False)
    terraform_output = Column(Text)
    error_message = Column(Text)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    
    # Relationships
    attendee = relationship("Attendee", back_populates="deployment_logs")
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "action IN ('deploy', 'destroy', 'plan', 'apply')",
            name='valid_action'
        ),
        CheckConstraint(
            "status IN ('started', 'running', 'completed', 'failed')",
            name='valid_status'
        ),
    )
    
    def __repr__(self):
        return f"<DeploymentLog(id={self.id}, action='{self.action}', status='{self.status}')>"