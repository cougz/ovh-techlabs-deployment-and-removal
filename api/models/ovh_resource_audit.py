from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer, JSON, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from core.database import Base

class OVHResourceAudit(Base):
    """Audit log for OVH resource operations"""
    __tablename__ = "ovh_resource_audits"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_type = Column(String(50), nullable=False)  # 'pci_project', 'iam_user', 'iam_policy'
    resource_id = Column(String(255), nullable=False)   # Service ID, username, or policy ID
    resource_name = Column(String(255))                  # Human-readable name
    action = Column(String(50), nullable=False)          # 'create', 'delete', 'sync', 'view'
    action_status = Column(String(50), nullable=False)   # 'success', 'failed', 'pending'
    performed_by = Column(String(100), nullable=False)   # User who performed action
    error_message = Column(Text)
    metadata = Column(JSON)                              # Additional resource details
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_resource_type_id', 'resource_type', 'resource_id'),
        Index('idx_created_at', 'created_at'),
        Index('idx_performed_by', 'performed_by'),
    )

class OVHResourceCache(Base):
    """Cache table for OVH resources to reduce API calls"""
    __tablename__ = "ovh_resource_cache"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_type = Column(String(50), nullable=False)
    cache_key = Column(String(255), nullable=False, unique=True)
    data = Column(JSON, nullable=False)
    ttl_seconds = Column(Integer, default=3600)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    
    __table_args__ = (
        Index('idx_cache_key', 'cache_key'),
        Index('idx_expires_at', 'expires_at'),
    )