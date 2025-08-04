from typing import List, Dict, Any
from schemas.workshop import WorkshopTemplate

class TemplateService:
    """Service for managing workshop templates."""
    
    def __init__(self):
        """Initialize the template service with predefined templates."""
        self._templates = {
            "Generic": WorkshopTemplate(
                name="Generic",
                description="Creates: IAM User, IAM Policy, OVHcloud Public Cloud Project",
                resources=["ovh_public_cloud_project"],
                is_active=True,
                resource_config={
                    "ovh_public_cloud_project": {
                        "enabled": True,
                        "config": {
                            "plan_code": "discovery"
                        }
                    }
                }
            )
        }
    
    def get_template(self, name: str) -> WorkshopTemplate:
        """Get a template by name."""
        if name not in self._templates:
            raise ValueError(f"Template not found: {name}")
        
        return self._templates[name]
    
    def list_templates(self) -> List[WorkshopTemplate]:
        """List all available templates."""
        return list(self._templates.values())
    
    def get_template_resources(self, name: str) -> List[str]:
        """Get list of resources for a template."""
        template = self.get_template(name)
        return template.resources
    
    def get_provisioning_config(self, name: str) -> Dict[str, Any]:
        """Get provisioning configuration for a template."""
        template = self.get_template(name)
        return template.resource_config or {}
    
    def get_template_schema(self) -> Dict[str, Any]:
        """Get the template schema structure."""
        return {
            "name": "string",
            "description": "string", 
            "resources": "array",
            "is_active": "boolean",
            "resource_config": "object"
        }