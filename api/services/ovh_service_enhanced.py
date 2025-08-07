import ovh
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import json
import asyncio
from functools import lru_cache
import backoff
import time
import re
from sqlalchemy.orm import Session

from core.config import settings
from core.logging import get_logger
from core.database import SessionLocal
from models.ovh_resource_audit import OVHResourceAudit, OVHResourceCache
from services.rate_limiter import rate_limiter

logger = get_logger(__name__)

class EnhancedOVHService:
    """Enhanced OVH Service with caching, rate limiting, and audit logging"""
    
    def __init__(self):
        """Initialize OVH clients"""
        logger.debug(f"Initializing OVH client with endpoint: {settings.OVH_ENDPOINT}")
        logger.debug(f"OVH Application Key: {settings.OVH_APPLICATION_KEY[:8] if settings.OVH_APPLICATION_KEY else 'NOT SET'}...")
        logger.debug(f"OVH Consumer Key: {settings.OVH_CONSUMER_KEY[:8] if settings.OVH_CONSUMER_KEY else 'NOT SET'}...")
        
        self.client = ovh.Client(
            endpoint=settings.OVH_ENDPOINT,
            application_key=settings.OVH_APPLICATION_KEY,
            application_secret=settings.OVH_APPLICATION_SECRET,
            consumer_key=settings.OVH_CONSUMER_KEY
        )
        
        # Log the actual endpoint URL that will be used
        logger.debug(f"OVH Client initialized. Base endpoint URL: {getattr(self.client, '_endpoint', 'UNKNOWN')}")
    
    # ===== Caching Layer =====
    
    def _get_from_cache(self, resource_type: str, cache_key: str) -> Optional[Any]:
        """Get data from cache if not expired"""
        db = SessionLocal()
        try:
            cache_entry = db.query(OVHResourceCache).filter(
                OVHResourceCache.cache_key == cache_key,
                OVHResourceCache.expires_at > datetime.utcnow()
            ).first()
            
            if cache_entry:
                logger.info(f"Cache hit for {cache_key}")
                return cache_entry.data
            
            return None
        finally:
            db.close()
    
    def _save_to_cache(self, resource_type: str, cache_key: str, data: Any, ttl_seconds: int = 3600):
        """Save data to cache"""
        db = SessionLocal()
        try:
            # Remove old cache entry if exists
            db.query(OVHResourceCache).filter(
                OVHResourceCache.cache_key == cache_key
            ).delete()
            
            cache_entry = OVHResourceCache(
                resource_type=resource_type,
                cache_key=cache_key,
                data=data,
                ttl_seconds=ttl_seconds,
                expires_at=datetime.utcnow() + timedelta(seconds=ttl_seconds)
            )
            db.add(cache_entry)
            db.commit()
            logger.info(f"Cached {cache_key} for {ttl_seconds} seconds")
        except Exception as e:
            logger.error(f"Failed to save to cache: {str(e)}")
            db.rollback()
        finally:
            db.close()
    
    # ===== Audit Logging =====
    
    def _log_audit(self, resource_type: str, resource_id: str, resource_name: str,
                   action: str, action_status: str, performed_by: str,
                   error_message: str = None, resource_metadata: Dict = None):
        """Log audit entry"""
        db = SessionLocal()
        try:
            audit_entry = OVHResourceAudit(
                resource_type=resource_type,
                resource_id=resource_id,
                resource_name=resource_name,
                action=action,
                action_status=action_status,
                performed_by=performed_by,
                error_message=error_message,
                resource_metadata=resource_metadata
            )
            db.add(audit_entry)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to log audit: {str(e)}")
            db.rollback()
        finally:
            db.close()
    
    # ===== PCI Projects with Enhanced Features =====
    
    @rate_limiter.rate_limit_decorator('pci_projects')
    @backoff.on_exception(backoff.expo, Exception, max_tries=3)
    def get_all_pci_projects(self, use_cache: bool = True, performed_by: str = "system") -> Tuple[List[Dict[str, Any]], bool]:
        """
        Fetch all PCI projects with caching and rate limiting.
        Returns (projects, from_cache)
        """
        cache_key = "ovh:pci_projects:all"
        
        # Try cache first
        if use_cache:
            cached_data = self._get_from_cache("pci_project", cache_key)
            if cached_data:
                return cached_data, True
        
        try:
            logger.info("Fetching PCI projects from OVH API")
            
            # Get all service IDs
            # Note: OVH SDK uses /1.0 as base, so we don't include version in path
            api_path = "/services"
            logger.debug(f"Calling OVH API: GET {api_path}")
            logger.debug(f"OVH Client endpoint: {getattr(self.client, '_endpoint', 'UNKNOWN')}")
            logger.debug(f"OVH Client credentials: app_key={bool(getattr(self.client, '_application_key', None))}, consumer_key={bool(getattr(self.client, '_consumer_key', None))}")
            
            try:
                service_ids = self.client.get(api_path)
                logger.debug(f"Successfully retrieved {len(service_ids)} service IDs")
            except Exception as e:
                logger.error(f"Failed to get services: {type(e).__name__}: {str(e)}")
                raise
            
            pci_projects = []
            
            # Process in batches to avoid overwhelming the API
            for i in range(0, len(service_ids), 10):
                batch = service_ids[i:i+10]
                
                for service_id in batch:
                    try:
                        detail_path = f"/services/{service_id}"
                        logger.debug(f"Calling OVH API: GET {detail_path}")
                        service_details = self.client.get(detail_path)
                        
                        if (service_details.get('resource', {}).get('product', {}).get('name') == 
                            'publiccloud-project'):
                            
                            project_info = self._extract_project_info(service_id, service_details)
                            pci_projects.append(project_info)
                            
                    except Exception as e:
                        logger.error(f"Error fetching service {service_id}: {str(e)}")
                        continue
                
                # Small delay between batches
                time.sleep(0.1)
            
            # Cache the results
            self._save_to_cache("pci_project", cache_key, pci_projects, ttl_seconds=300)  # 5 min cache
            
            # Log audit
            self._log_audit(
                "pci_project", "all", f"{len(pci_projects)} projects",
                "sync", "success", performed_by,
                resource_metadata={"count": len(pci_projects)}
            )
            
            logger.info(f"Found {len(pci_projects)} PCI projects")
            return pci_projects, False
            
        except Exception as e:
            logger.error(f"Error fetching PCI projects: {str(e)}")
            self._log_audit(
                "pci_project", "all", "unknown",
                "sync", "failed", performed_by,
                error_message=str(e)
            )
            raise
    
    def search_pci_projects(self, query: str, field: str = "all") -> List[Dict[str, Any]]:
        """Search PCI projects by name, ID, or service ID"""
        # Input sanitization
        if not query or len(query.strip()) == 0:
            return []
        
        # Limit query length to prevent abuse
        if len(query) > 100:
            raise ValueError("Search query too long")
        
        # Sanitize field parameter
        allowed_fields = ["all", "name", "id", "service_id"]
        if field not in allowed_fields:
            raise ValueError(f"Invalid field parameter. Must be one of: {allowed_fields}")
        
        projects, _ = self.get_all_pci_projects(use_cache=True)
        
        # Escape special regex characters in query for safe comparison
        query_escaped = re.escape(query.strip().lower())
        results = []
        
        for project in projects:
            if field == "all":
                if (query_escaped in project.get('display_name', '').lower() or
                    query_escaped in project.get('project_id', '').lower() or
                    query_escaped in str(project.get('service_id', '')).lower()):
                    results.append(project)
            elif field == "name" and query_escaped in project.get('display_name', '').lower():
                results.append(project)
            elif field == "id" and query_escaped in project.get('project_id', '').lower():
                results.append(project)
            elif field == "service_id" and query_escaped in str(project.get('service_id', '')).lower():
                results.append(project)
        
        return results
    
    @rate_limiter.rate_limit_decorator('pci_projects', 'write')
    def delete_pci_project(self, service_id: str, performed_by: str) -> bool:
        """Delete a PCI project with audit logging"""
        try:
            # Get project details for audit
            project_details = None
            project_name = 'Unknown'
            try:
                projects, _ = self.get_all_pci_projects(use_cache=True)
                project_details = next((p for p in projects if str(p['service_id']) == str(service_id)), None)
                if project_details:
                    project_name = project_details.get('display_name', 'Unknown')
            except:
                pass
            
            logger.info(f"Deleting PCI project {service_id} ({project_name})")
            
            # Initiate deletion
            result = self.client.delete(f"/services/{service_id}")
            
            # Clear cache
            self._invalidate_cache("pci_project")
            
            # Log success audit
            self._log_audit(
                "pci_project", service_id, project_name,
                "delete", "success", performed_by,
                resource_metadata=project_details
            )
            
            logger.info(f"Successfully initiated deletion of PCI project {service_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting PCI project {service_id}: {str(e)}")
            
            # Log failure audit
            self._log_audit(
                "pci_project", service_id, project_name,
                "delete", "failed", performed_by,
                error_message=str(e)
            )
            return False
    
    def bulk_delete_pci_projects(self, service_ids: List[str], performed_by: str) -> Dict[str, Any]:
        """Bulk delete PCI projects"""
        results = {
            "success": [],
            "failed": [],
            "total": len(service_ids)
        }
        
        for service_id in service_ids:
            try:
                if self.delete_pci_project(service_id, performed_by):
                    results["success"].append(service_id)
                else:
                    results["failed"].append({"id": service_id, "error": "Deletion failed"})
            except Exception as e:
                results["failed"].append({"id": service_id, "error": str(e)})
            
            # Rate limit between deletions
            time.sleep(1)
        
        return results
    
    # ===== IAM Users with Enhanced Features =====
    
    @rate_limiter.rate_limit_decorator('iam_users')
    @backoff.on_exception(backoff.expo, Exception, max_tries=3)
    def get_all_iam_users(self, use_cache: bool = True, performed_by: str = "system") -> Tuple[List[Dict[str, Any]], bool]:
        """Fetch all IAM users with caching and rate limiting"""
        cache_key = "ovh:iam_users:all"
        
        if use_cache:
            cached_data = self._get_from_cache("iam_user", cache_key)
            if cached_data:
                return cached_data, True
        
        try:
            logger.info("Fetching IAM users from OVH API")
            
            # Note: OVH SDK uses /1.0 as base, so we don't include version in path
            api_path = "/me/identity/user"
            logger.debug(f"Calling OVH API: GET {api_path}")
            logger.debug(f"OVH Client endpoint: {getattr(self.client, '_endpoint', 'UNKNOWN')}")
            logger.debug(f"OVH Client credentials: app_key={bool(getattr(self.client, '_application_key', None))}, consumer_key={bool(getattr(self.client, '_consumer_key', None))}")
            
            try:
                user_names = self.client.get(api_path)
                logger.debug(f"Successfully retrieved {len(user_names)} user names")
            except Exception as e:
                logger.error(f"Failed to get IAM users: {type(e).__name__}: {str(e)}")
                raise
            logger.info(f"Found {len(user_names)} IAM users")
            
            users = []
            
            # Process in batches
            for i in range(0, len(user_names), 10):
                batch = user_names[i:i+10]
                
                for username in batch:
                    try:
                        detail_path = f"/me/identity/user/{username}"
                        logger.debug(f"Calling OVH API: GET {detail_path}")
                        user_details = self.client.get(detail_path)
                        user_info = self._extract_user_info(username, user_details)
                        users.append(user_info)
                    except Exception as e:
                        logger.error(f"Error fetching user {username}: {str(e)}")
                        continue
                
                time.sleep(0.1)
            
            # Cache results
            self._save_to_cache("iam_user", cache_key, users, ttl_seconds=300)
            
            # Log audit
            self._log_audit(
                "iam_user", "all", f"{len(users)} users",
                "sync", "success", performed_by,
                resource_metadata={"count": len(users)}
            )
            
            return users, False
            
        except Exception as e:
            logger.error(f"Error fetching IAM users: {str(e)}")
            self._log_audit(
                "iam_user", "all", "unknown",
                "sync", "failed", performed_by,
                error_message=str(e)
            )
            raise
    
    @rate_limiter.rate_limit_decorator('iam_users', 'write')
    def delete_iam_user(self, username: str, performed_by: str) -> bool:
        """Delete an IAM user with audit logging"""
        try:
            logger.info(f"Deleting IAM user {username}")
            
            # Delete the user
            result = self.client.delete(f"/me/identity/user/{username}")
            
            # Clear cache
            self._invalidate_cache("iam_user")
            
            # Log success audit
            self._log_audit(
                "iam_user", username, username,
                "delete", "success", performed_by
            )
            
            logger.info(f"Successfully deleted IAM user {username}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting IAM user {username}: {str(e)}")
            
            # Log failure audit
            self._log_audit(
                "iam_user", username, username,
                "delete", "failed", performed_by,
                error_message=str(e)
            )
            return False
    
    def bulk_delete_iam_users(self, usernames: List[str], performed_by: str) -> Dict[str, Any]:
        """Bulk delete IAM users"""
        results = {
            "success": [],
            "failed": [],
            "total": len(usernames)
        }
        
        for username in usernames:
            try:
                if self.delete_iam_user(username, performed_by):
                    results["success"].append(username)
                else:
                    results["failed"].append({"username": username, "error": "Deletion failed"})
            except Exception as e:
                results["failed"].append({"username": username, "error": str(e)})
        
        return results
    
    def filter_iam_users(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Filter IAM users by various criteria"""
        users, _ = self.get_all_iam_users(use_cache=True)
        
        filtered = users
        
        # Sanitize filter inputs
        if filters.get('group'):
            group = str(filters['group']).strip()
            if len(group) > 50:
                raise ValueError("Group filter too long")
            filtered = [u for u in filtered if u.get('group', '') == group]
        
        if filters.get('status'):
            status = str(filters['status']).strip()
            if len(status) > 20:
                raise ValueError("Status filter too long")
            filtered = [u for u in filtered if u.get('status', '') == status]
        
        if filters.get('created_after'):
            try:
                date_threshold = datetime.fromisoformat(str(filters['created_after']))
                filtered = [u for u in filtered if u.get('creation') and 
                           datetime.fromisoformat(u['creation']) > date_threshold]
            except ValueError:
                raise ValueError("Invalid date format for created_after filter")
        
        if filters.get('search'):
            search_term = str(filters['search']).strip()
            if len(search_term) > 100:
                raise ValueError("Search term too long")
            # Escape special characters for safe comparison
            search_lower = re.escape(search_term.lower())
            filtered = [u for u in filtered if 
                       search_lower in u.get('username', '').lower() or
                       search_lower in u.get('email', '').lower() or
                       search_lower in u.get('description', '').lower()]
        
        return filtered
    
    # ===== IAM Policies with Enhanced Features =====
    
    @rate_limiter.rate_limit_decorator('iam_policies')
    @backoff.on_exception(backoff.expo, Exception, max_tries=3)
    def get_all_iam_policies(self, use_cache: bool = True, performed_by: str = "system") -> Tuple[List[Dict[str, Any]], bool]:
        """Fetch all IAM policies with caching and rate limiting"""
        cache_key = "ovh:iam_policies:all"
        
        if use_cache:
            cached_data = self._get_from_cache("iam_policy", cache_key)
            if cached_data:
                return cached_data, True
        
        try:
            logger.info("Fetching IAM policies from OVH API v2")
            
            # Use OVH SDK with v2 API path
            api_path = "/v2/iam/policy"
            logger.debug(f"Calling OVH API: GET {api_path}")
            
            try:
                policies = self.client.get(api_path)
                logger.debug(f"Successfully retrieved {len(policies)} policies from v2 API")
            except Exception as e:
                logger.error(f"Failed to get IAM policies from v2: {type(e).__name__}: {str(e)}")
                # Fallback: empty policy list
                policies = []
                logger.warning("Using empty policy list as fallback")
            logger.info(f"Found {len(policies)} IAM policies")
            
            formatted_policies = []
            for policy in policies:
                policy_info = self._extract_policy_info(policy)
                formatted_policies.append(policy_info)
            
            # Cache results
            self._save_to_cache("iam_policy", cache_key, formatted_policies, ttl_seconds=300)
            
            # Log audit
            self._log_audit(
                "iam_policy", "all", f"{len(formatted_policies)} policies",
                "sync", "success", performed_by,
                resource_metadata={"count": len(formatted_policies)}
            )
            
            return formatted_policies, False
            
        except Exception as e:
            logger.error(f"Error fetching IAM policies: {str(e)}")
            self._log_audit(
                "iam_policy", "all", "unknown",
                "sync", "failed", performed_by,
                error_message=str(e)
            )
            raise
    
    @rate_limiter.rate_limit_decorator('iam_policies', 'write')
    def delete_iam_policy(self, policy_id: str, performed_by: str) -> bool:
        """Delete an IAM policy with audit logging"""
        try:
            # Get policy details for audit
            policy_name = 'Unknown'
            try:
                policies, _ = self.get_all_iam_policies(use_cache=True)
                policy = next((p for p in policies if p['id'] == policy_id), None)
                if policy:
                    policy_name = policy.get('name', 'Unknown')
            except:
                pass
            
            logger.info(f"Deleting IAM policy {policy_id} ({policy_name})")
            
            # Use OVH SDK with v2 API path
            # Sanitize policy_id to prevent injection
            if not re.match(r'^[a-zA-Z0-9\-_]+$', policy_id):
                raise ValueError("Invalid policy ID format")
            
            api_path = f"/v2/iam/policy/{policy_id}"
            logger.debug(f"Calling OVH API: DELETE {api_path}")
            
            # Delete the policy using OVH SDK
            result = self.client.delete(api_path)
            
            # Clear cache
            self._invalidate_cache("iam_policy")
            
            # Log success audit
            self._log_audit(
                "iam_policy", policy_id, policy_name,
                "delete", "success", performed_by
            )
            
            logger.info(f"Successfully deleted IAM policy {policy_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting IAM policy {policy_id}: {str(e)}")
            
            # Log failure audit
            self._log_audit(
                "iam_policy", policy_id, policy_name,
                "delete", "failed", performed_by,
                error_message=str(e)
            )
            return False
    
    def bulk_delete_iam_policies(self, policy_ids: List[str], performed_by: str) -> Dict[str, Any]:
        """Bulk delete IAM policies"""
        results = {
            "success": [],
            "failed": [],
            "total": len(policy_ids)
        }
        
        for policy_id in policy_ids:
            try:
                if self.delete_iam_policy(policy_id, performed_by):
                    results["success"].append(policy_id)
                else:
                    results["failed"].append({"id": policy_id, "error": "Deletion failed"})
            except Exception as e:
                results["failed"].append({"id": policy_id, "error": str(e)})
        
        return results
    
    # ===== Helper Methods =====
    
    def _extract_project_info(self, service_id: str, service_details: Dict) -> Dict:
        """Extract project information from service details"""
        return {
            'service_id': service_id,
            'project_id': service_details.get('resource', {}).get('name'),
            'display_name': service_details.get('resource', {}).get('displayName', 'N/A'),
            'state': service_details.get('resource', {}).get('state', 'Unknown'),
            'creation_date': self._parse_date(
                service_details.get('billing', {})
                .get('lifecycle', {})
                .get('current', {})
                .get('creationDate')
            ),
            'next_billing_date': self._parse_date(
                service_details.get('billing', {}).get('nextBillingDate')
            ),
            'termination_date': self._parse_date(
                service_details.get('billing', {})
                .get('lifecycle', {})
                .get('current', {})
                .get('terminationDate')
            )
        }
    
    def _extract_user_info(self, username: str, user_details: Dict) -> Dict:
        """Extract user information from API response"""
        return {
            'username': username,
            'description': user_details.get('description', ''),
            'email': user_details.get('email', ''),
            'creation': self._parse_date(user_details.get('creation')),
            'last_update': self._parse_date(user_details.get('lastUpdate')),
            'status': user_details.get('status', 'Unknown'),
            'group': user_details.get('group', 'Unknown'),
            'urn': user_details.get('urn', '')
        }
    
    def _extract_policy_info(self, policy: Dict) -> Dict:
        """Extract policy information from API response"""
        return {
            'id': policy.get('id'),
            'name': policy.get('name'),
            'description': policy.get('description', ''),
            'owner': policy.get('owner'),
            'read_only': policy.get('readOnly', False),
            'identities': policy.get('identities', []),
            'resources': [r.get('urn') for r in policy.get('resources', [])],
            'permissions': policy.get('permissions', {}),
            'created_at': self._parse_date(policy.get('createdAt'))
        }
    
    def _parse_date(self, date_string: Optional[str]) -> Optional[str]:
        """Parse OVH date format to ISO format"""
        if not date_string:
            return None
        try:
            dt = datetime.fromisoformat(date_string.replace('Z', '+00:00'))
            return dt.isoformat()
        except:
            return date_string
    
    def _invalidate_cache(self, resource_type: str):
        """Invalidate cache for a resource type"""
        db = SessionLocal()
        try:
            db.query(OVHResourceCache).filter(
                OVHResourceCache.resource_type == resource_type
            ).delete()
            db.commit()
            logger.info(f"Invalidated cache for {resource_type}")
        except Exception as e:
            logger.error(f"Failed to invalidate cache: {str(e)}")
            db.rollback()
        finally:
            db.close()
    
    def get_audit_logs(self, resource_type: Optional[str] = None, 
                      resource_id: Optional[str] = None,
                      performed_by: Optional[str] = None,
                      limit: int = 100) -> List[Dict]:
        """Get audit logs with filtering"""
        db = SessionLocal()
        try:
            query = db.query(OVHResourceAudit)
            
            if resource_type:
                query = query.filter(OVHResourceAudit.resource_type == resource_type)
            if resource_id:
                query = query.filter(OVHResourceAudit.resource_id == resource_id)
            if performed_by:
                query = query.filter(OVHResourceAudit.performed_by == performed_by)
            
            logs = query.order_by(OVHResourceAudit.created_at.desc()).limit(limit).all()
            
            return [
                {
                    'id': str(log.id),
                    'resource_type': log.resource_type,
                    'resource_id': log.resource_id,
                    'resource_name': log.resource_name,
                    'action': log.action,
                    'action_status': log.action_status,
                    'performed_by': log.performed_by,
                    'error_message': log.error_message,
                    'metadata': log.resource_metadata,
                    'created_at': log.created_at.isoformat()
                }
                for log in logs
            ]
        finally:
            db.close()

# Global instance
enhanced_ovh_service = EnhancedOVHService()