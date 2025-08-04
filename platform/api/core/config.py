from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from typing import List, Optional
import os
import json

class Settings(BaseSettings):
    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "techlabs_automation"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"
    
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    # Redis
    REDIS_URL: str = "redis://redis:6379/0"
    
    # Application
    SECRET_KEY: str = "your-secret-key-here"
    DEBUG: bool = True
    CORS_ORIGINS: List[str] = Field(default=["http://localhost:3000"])
    
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
    JWT_SECRET_KEY: str = "your-jwt-secret-key"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # OVHcloud
    OVH_ENDPOINT: str = "ovh-eu"
    OVH_APPLICATION_KEY: str = ""
    OVH_APPLICATION_SECRET: str = ""
    OVH_CONSUMER_KEY: str = ""
    
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
    ENCRYPTION_KEY: str = "your-encryption-key"
    ALLOWED_HOSTS: List[str] = ["localhost", "127.0.0.1", "0.0.0.0"]
    INTERNAL_API_KEY: str = "internal-api-secret-key"
    
    # Logging
    LOG_LEVEL: str = "INFO"
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

# Global settings instance
settings = Settings()