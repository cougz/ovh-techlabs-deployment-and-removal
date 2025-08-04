from sqlalchemy import Column, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from core.database import Base

class Credential(Base):
    __tablename__ = "credentials"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    attendee_id = Column(UUID(as_uuid=True), ForeignKey("attendees.id", ondelete="CASCADE"), nullable=False)
    username = Column(String(100), nullable=False)
    encrypted_password = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    attendee = relationship("Attendee", back_populates="credential")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('attendee_id', name='unique_attendee_credential'),
    )
    
    def __repr__(self):
        return f"<Credential(id={self.id}, username='{self.username}')>"