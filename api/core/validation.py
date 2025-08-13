"""Input validation utilities for security and data integrity."""

import re
from typing import Any, List, Optional
from fastapi import HTTPException, status
import html


class InputValidator:
    """Security-focused input validation utility."""
    
    # Dangerous patterns that could indicate injection attempts
    SQL_INJECTION_PATTERNS = [
        r"(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)",
        r"([\'\"];?\s*(union|select|insert|update|delete|drop|create|alter|exec))",
        r"(\bor\b\s+[\'\"]?\d+[\'\"]?\s*=\s*[\'\"]?\d+)",
        r"([\'\"];?\s*--)",
        r"(\bxp_cmdshell\b)"
    ]
    
    XSS_PATTERNS = [
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"vbscript:",
        r"on\w+\s*=",
        r"<iframe[^>]*>",
        r"<object[^>]*>",
        r"<embed[^>]*>"
    ]
    
    PATH_TRAVERSAL_PATTERNS = [
        r"\.\./",
        r"\.\.\\",
        r"%2e%2e%2f",
        r"%2e%2e%5c",
        r"\.\.%2f",
        r"\.\.%5c"
    ]
    
    @classmethod
    def validate_string_input(cls, value: str, field_name: str, max_length: int = 255, 
                             min_length: int = 0, allow_empty: bool = True) -> str:
        """Validate and sanitize string input."""
        if not value and not allow_empty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} cannot be empty"
            )
        
        if not value:
            return ""
        
        # Check length constraints
        if len(value) > max_length:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} exceeds maximum length of {max_length} characters"
            )
        
        if len(value) < min_length:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} must be at least {min_length} characters"
            )
        
        # Check for SQL injection patterns
        for pattern in cls.SQL_INJECTION_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid characters detected in {field_name}"
                )
        
        # Check for XSS patterns
        for pattern in cls.XSS_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid characters detected in {field_name}"
                )
        
        # Check for path traversal patterns
        for pattern in cls.PATH_TRAVERSAL_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid path characters detected in {field_name}"
                )
        
        # HTML encode to prevent XSS
        return html.escape(value)
    
    @classmethod
    def validate_identifier(cls, value: str, field_name: str) -> str:
        """Validate identifiers (usernames, IDs, etc.)."""
        if not value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} cannot be empty"
            )
        
        # Only allow alphanumeric, hyphens, underscores, and periods
        if not re.match(r"^[a-zA-Z0-9\-_.]+$", value):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} can only contain letters, numbers, hyphens, underscores, and periods"
            )
        
        if len(value) > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} must be less than 100 characters"
            )
        
        return value
    
    @classmethod
    def validate_email(cls, value: str, field_name: str = "email") -> str:
        """Validate email format."""
        if not value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} cannot be empty"
            )
        
        email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        if not re.match(email_pattern, value):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid {field_name} format"
            )
        
        if len(value) > 254:  # RFC 5321 limit
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} exceeds maximum length"
            )
        
        return value.lower()
    
    @classmethod
    def validate_integer(cls, value: Any, field_name: str, min_value: Optional[int] = None, 
                        max_value: Optional[int] = None) -> int:
        """Validate integer input."""
        try:
            int_value = int(value)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} must be a valid integer"
            )
        
        if min_value is not None and int_value < min_value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} must be at least {min_value}"
            )
        
        if max_value is not None and int_value > max_value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} must be at most {max_value}"
            )
        
        return int_value
    
    @classmethod
    def validate_list_input(cls, values: List[str], field_name: str, max_items: int = 100,
                           item_validator=None) -> List[str]:
        """Validate list of string inputs."""
        if not values:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} cannot be empty"
            )
        
        if len(values) > max_items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} cannot contain more than {max_items} items"
            )
        
        validated_items = []
        for i, value in enumerate(values):
            if item_validator:
                validated_value = item_validator(value, f"{field_name}[{i}]")
            else:
                validated_value = cls.validate_string_input(value, f"{field_name}[{i}]")
            validated_items.append(validated_value)
        
        # Check for duplicates
        if len(validated_items) != len(set(validated_items)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Duplicate items found in {field_name}"
            )
        
        return validated_items


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal."""
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename cannot be empty"
        )
    
    # Remove path components
    filename = filename.split("/")[-1].split("\\")[-1]
    
    # Remove dangerous characters
    filename = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', filename)
    
    # Limit length
    if len(filename) > 255:
        filename = filename[:255]
    
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename"
        )
    
    return filename