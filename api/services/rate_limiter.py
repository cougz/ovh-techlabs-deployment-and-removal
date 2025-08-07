import time
from typing import Dict, Optional
from functools import wraps
import redis
from core.config import settings
from core.logging import get_logger

logger = get_logger(__name__)

class RateLimiter:
    """Rate limiter for OVH API calls"""
    
    def __init__(self):
        self.redis_client = redis.from_url(settings.REDIS_URL)
        # OVH API limits: 60 calls per minute per endpoint
        self.limits = {
            'default': {'calls': 60, 'period': 60},
            'write': {'calls': 30, 'period': 60},  # More conservative for write ops
        }
    
    def check_rate_limit(self, key: str, limit_type: str = 'default') -> tuple[bool, int]:
        """Check if rate limit allows the request"""
        limit = self.limits.get(limit_type, self.limits['default'])
        
        # Use sliding window counter
        now = time.time()
        window_start = now - limit['period']
        
        # Remove old entries
        self.redis_client.zremrangebyscore(key, 0, window_start)
        
        # Count current entries
        current_count = self.redis_client.zcard(key)
        
        if current_count >= limit['calls']:
            # Calculate wait time
            oldest = self.redis_client.zrange(key, 0, 0, withscores=True)
            if oldest:
                wait_time = int(oldest[0][1] + limit['period'] - now)
                return False, wait_time
            return False, limit['period']
        
        # Add current request
        self.redis_client.zadd(key, {str(now): now})
        self.redis_client.expire(key, limit['period'])
        
        return True, 0
    
    def rate_limit_decorator(self, endpoint: str, limit_type: str = 'default'):
        """Decorator for rate limiting functions"""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                key = f"rate_limit:ovh:{endpoint}"
                allowed, wait_time = self.check_rate_limit(key, limit_type)
                
                if not allowed:
                    raise Exception(f"Rate limit exceeded. Wait {wait_time} seconds.")
                
                return func(*args, **kwargs)
            return wrapper
        return decorator

rate_limiter = RateLimiter()