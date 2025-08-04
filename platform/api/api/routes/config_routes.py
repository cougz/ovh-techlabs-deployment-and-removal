from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any
import json
import os

from core.database import get_db
from api.routes.auth import get_current_user

router = APIRouter()

CONFIG_DIR = "/app/config"
LOGIN_PREFIX_CONFIG_FILE = os.path.join(CONFIG_DIR, "login_prefix.json")

def ensure_config_dir():
    """Ensure config directory exists"""
    os.makedirs(CONFIG_DIR, exist_ok=True)

def get_login_prefix_config() -> Dict[str, Any]:
    """Get login prefix configuration from file storage"""
    try:
        if os.path.exists(LOGIN_PREFIX_CONFIG_FILE):
            with open(LOGIN_PREFIX_CONFIG_FILE, 'r') as f:
                return json.load(f)
        return {"login_prefix": "", "export_format": "OVHcloud Login"}
    except Exception:
        return {"login_prefix": "", "export_format": "OVHcloud Login"}

def save_login_prefix_config(config: Dict[str, Any]) -> bool:
    """Save login prefix configuration to file storage"""
    try:
        ensure_config_dir()
        with open(LOGIN_PREFIX_CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
        return True
    except Exception:
        return False

def validate_login_prefix(prefix: str) -> bool:
    """Validate login prefix format"""
    if not prefix:
        return True  # Empty prefix is valid
    
    # Check length (reasonable limit)
    if len(prefix) > 50:
        return False
    
    # Must end with slash if not empty
    if prefix and not prefix.endswith('/'):
        return False
    
    # Check for valid characters (alphanumeric, dash, slash)
    import re
    if not re.match(r'^[0-9a-zA-Z\-/]*/$', prefix):
        return False
    
    return True

@router.get("/login-prefix")
async def get_login_prefix_settings(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Get login prefix configuration"""
    return get_login_prefix_config()

@router.post("/login-prefix")
async def save_login_prefix_settings(
    config: Dict[str, Any],
    db: Session = Depends(get_db), 
    current_user: str = Depends(get_current_user)
):
    """Save login prefix configuration"""
    login_prefix = config.get("login_prefix", "")
    
    # Validate prefix format
    if not validate_login_prefix(login_prefix):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid login prefix format"
        )
    
    # Save configuration
    if save_login_prefix_config(config):
        return {"message": "Login prefix configuration saved successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save configuration"
        )