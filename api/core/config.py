from pydantic_settings import BaseSettings
from pydantic import Field, field_validator, validator
from typing import List, Optional
import os
import json
import secrets
from cryptography.fernet import Fernet

class Settings(BaseSettings):
    # Database
    DB_HOST: str = Field(default="localhost", description="Database host")
    DB_PORT: int = Field(default=5432, ge=1, le=65535, description="Database port")
    DB_NAME: str = Field(min_length=1, max_length=64, description="Database name")
    DB_USER: str = Field(min_length=1, max_length=64, description="Database user")
    DB_PASSWORD: str = Field(min_length=1, description="Database password")
    
    @field_validator('DB_PASSWORD')
    @classmethod
    def validate_db_password(cls, v):
        if not v or v == "postgres" or len(v) < 8:
            raise ValueError("Database password must be at least 8 characters and not use default values")
        return v
    
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    # Redis
    REDIS_URL: str = "redis://redis:6379/0"
    
    # Application
    SECRET_KEY: str = Field(min_length=32, description="Application secret key")
    DEBUG: bool = Field(default=False, description="Debug mode")
    CORS_ORIGINS: List[str] = Field(default=["http://localhost:3000"], description="Allowed CORS origins")
    
    @field_validator('SECRET_KEY')
    @classmethod
    def validate_secret_key(cls, v):
        if not v or v == "your-secret-key-here" or len(v) < 32:
            if not v or v == "your-secret-key-here":
                v = secrets.token_urlsafe(32)
        return v
    
    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            if v.strip() == '':
                return ["http://localhost:3000"]
            # Try to parse as JSON first
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                # If not JSON, try comma-separated
                return [origin.strip() for origin in v.split(",")]
        return v
    
    # JWT
    JWT_SECRET_KEY: str = Field(default="", description="JWT secret key")
    JWT_ALGORITHM: str = Field(default="HS256", description="JWT algorithm")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, ge=5, le=1440, description="JWT expiration minutes")
    
    @field_validator('JWT_SECRET_KEY')
    @classmethod
    def validate_jwt_secret(cls, v):
        if not v or v == "your-jwt-secret-key" or len(v) < 32:
            if not v or v == "your-jwt-secret-key":
                v = secrets.token_urlsafe(32)
        return v
    
    # OVHcloud
    OVH_ENDPOINT: str = Field(default="ovh-eu", description="OVH API endpoint")
    OVH_APPLICATION_KEY: str = Field(description="OVH application key")
    OVH_APPLICATION_SECRET: str = Field(description="OVH application secret")
    OVH_CONSUMER_KEY: str = Field(description="OVH consumer key")
    
    @field_validator('OVH_APPLICATION_KEY', 'OVH_APPLICATION_SECRET', 'OVH_CONSUMER_KEY')
    @classmethod
    def validate_ovh_credentials(cls, v, info):
        if not v:
            raise ValueError(f"{info.field_name} is required")
        if len(v) < 8:
            raise ValueError(f"{info.field_name} must be at least 8 characters")
        return v
    
    # Terraform
    TERRAFORM_BINARY_PATH: str = "/usr/local/bin/terraform"
    TERRAFORM_WORKSPACE_DIR: str = "/tmp/terraform-workspaces"
    TERRAFORM_STATE_BUCKET: Optional[str] = None
    
    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@techlabs.local"
    SMTP_FROM_NAME: str = "TechLabs Automation"
    
    # Workshop
    DEFAULT_WORKSHOP_DURATION_HOURS: int = 8
    AUTO_CLEANUP_DELAY_HOURS: int = 1
    MAX_ATTENDEES_PER_WORKSHOP: int = 50
    
    # Security
    ENCRYPTION_KEY: str = Field(default="", description="Encryption key for sensitive data")
    ALLOWED_HOSTS: List[str] = Field(default=["localhost", "127.0.0.1"], description="Allowed hosts")
    INTERNAL_API_KEY: str = Field(default="", description="Internal API key")
    
    @field_validator('ENCRYPTION_KEY')
    @classmethod
    def validate_encryption_key(cls, v):
        if not v or v == "your-encryption-key":
            v = Fernet.generate_key().decode()
        return v
    
    @field_validator('INTERNAL_API_KEY')
    @classmethod
    def validate_internal_api_key(cls, v):
        if not v or v == "internal-api-secret-key" or len(v) < 32:
            if not v or v == "internal-api-secret-key":
                v = secrets.token_urlsafe(32)
        return v
    
    # Logging
    LOG_LEVEL: str = "DEBUG"
    LOG_FILE: Optional[str] = None
    
    # Rate limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_MINUTES: int = 1
    
    # Celery
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/0"
    CELERY_TASK_SERIALIZER: str = "json"
    CELERY_ACCEPT_CONTENT: List[str] = ["json"]
    CELERY_RESULT_SERIALIZER: str = "json"
    CELERY_TIMEZONE: str = "UTC"
    
    # Monitoring
    PROMETHEUS_METRICS_ENABLED: bool = True
    PROMETHEUS_METRICS_PORT: int = 9090
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._mask_sensitive_fields()
    
    def _mask_sensitive_fields(self):
        """Mask sensitive fields in logs and error messages"""
        sensitive_fields = [
            'DB_PASSWORD', 'SECRET_KEY', 'JWT_SECRET_KEY', 
            'OVH_APPLICATION_SECRET', 'OVH_CONSUMER_KEY',
            'ENCRYPTION_KEY', 'INTERNAL_API_KEY', 'SMTP_PASSWORD'
        ]
        for field in sensitive_fields:
            if hasattr(self, field):
                value = getattr(self, field)
                if value:
                    setattr(self, f'_{field}_MASKED', value[:4] + '*' * (len(value) - 4) if len(value) > 4 else '****')
    
    @property
    def safe_dict(self):
        """Return a dictionary with sensitive values masked for logging"""
        config_dict = self.dict()
        sensitive_fields = [
            'DB_PASSWORD', 'SECRET_KEY', 'JWT_SECRET_KEY', 
            'OVH_APPLICATION_SECRET', 'OVH_CONSUMER_KEY',
            'ENCRYPTION_KEY', 'INTERNAL_API_KEY', 'SMTP_PASSWORD'
        ]
        for field in sensitive_fields:
            if field in config_dict and config_dict[field]:
                value = config_dict[field]
                config_dict[field] = value[:4] + '*' * (len(value) - 4) if len(value) > 4 else '****'
        return config_dict

# Global settings instance
settings = Settings()