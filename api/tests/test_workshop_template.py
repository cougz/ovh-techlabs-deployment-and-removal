#!/usr/bin/env python3
"""
Test suite for workshop template system.
"""
import pytest
from datetime import datetime
from zoneinfo import ZoneInfo

from models.workshop import Workshop
from schemas.workshop import WorkshopCreateWithTemplate, WorkshopTemplate
from services.template_service import TemplateService
from core.database import SessionLocal


class TestWorkshopTemplate:
    """Test suite for workshop template functionality."""
    
    def test_should_create_workshop_with_generic_template(self):
        """Should create workshop with 'Generic' template."""
        # This test will fail because WorkshopCreateWithTemplate doesn't exist yet
        madrid_tz = ZoneInfo("Europe/Madrid")
        start_date = datetime(2025, 7, 10, 9, 0, 0, tzinfo=madrid_tz)
        end_date = datetime(2025, 7, 10, 17, 0, 0, tzinfo=madrid_tz)
        
        workshop_data = WorkshopCreateWithTemplate(
            name="Madrid Workshop",
            description="Workshop using Generic template",
            start_date=start_date,
            end_date=end_date,
            timezone="Europe/Madrid",
            template="Generic"
        )
        
        assert workshop_data.template == "Generic"
        assert workshop_data.name == "Madrid Workshop"
        assert workshop_data.timezone == "Europe/Madrid"
    
    def test_should_validate_template_exists(self):
        """Should validate that template exists in supported templates."""
        # Test with unsupported template
        with pytest.raises(ValueError, match="Unsupported template"):
            WorkshopCreateWithTemplate(
                name="Invalid Template Workshop",
                description="Workshop with invalid template",
                start_date=datetime(2025, 7, 10, 9, 0, 0, tzinfo=ZoneInfo("UTC")),
                end_date=datetime(2025, 7, 10, 17, 0, 0, tzinfo=ZoneInfo("UTC")),
                timezone="UTC",
                template="InvalidTemplate"
            )
        
        # Test with supported template
        workshop_data = WorkshopCreateWithTemplate(
            name="Generic Template Workshop",
            description="Workshop with Generic template",
            start_date=datetime(2025, 7, 10, 9, 0, 0, tzinfo=ZoneInfo("UTC")),
            end_date=datetime(2025, 7, 10, 17, 0, 0, tzinfo=ZoneInfo("UTC")),
            timezone="UTC",
            template="Generic"
        )
        
        assert workshop_data.template == "Generic"
    
    def test_should_get_template_definition(self):
        """Should get template definition from template service."""
        template_service = TemplateService()
        
        # Test getting Generic template
        generic_template = template_service.get_template("Generic")
        
        assert generic_template.name == "Generic"
        assert generic_template.description == "Creates: IAM User, IAM Policy, OVHcloud Public Cloud Project"
        assert generic_template.resources == ["ovh_public_cloud_project"]
        assert generic_template.is_active is True
    
    def test_should_list_available_templates(self):
        """Should list all available templates."""
        template_service = TemplateService()
        
        templates = template_service.list_templates()
        
        assert len(templates) == 1
        assert templates[0].name == "Generic"
        assert templates[0].description == "Creates: IAM User, IAM Policy, OVHcloud Public Cloud Project"
        assert templates[0].resources == ["ovh_public_cloud_project"]
    
    def test_should_get_template_resources(self):
        """Should get list of resources for a template."""
        template_service = TemplateService()
        
        # Test Generic template resources
        resources = template_service.get_template_resources("Generic")
        
        assert resources == ["ovh_public_cloud_project"]
        
        # Test invalid template
        with pytest.raises(ValueError, match="Template not found"):
            template_service.get_template_resources("InvalidTemplate")
    
    def test_should_create_workshop_with_template_in_database(self):
        """Should create workshop with template stored in database."""
        db = SessionLocal()
        
        try:
            # Create workshop with Generic template
            madrid_tz = ZoneInfo("Europe/Madrid")
            workshop = Workshop(
                name="Madrid Workshop",
                description="Workshop using Generic template",
                start_date=datetime(2025, 7, 10, 9, 0, 0, tzinfo=madrid_tz),
                end_date=datetime(2025, 7, 10, 17, 0, 0, tzinfo=madrid_tz),
                timezone="Europe/Madrid",
                template="Generic",  # This field doesn't exist yet, will make test fail
                status="planning"
            )
            
            db.add(workshop)
            db.commit()
            
            # Verify workshop was created with template
            assert workshop.template == "Generic"
            assert workshop.name == "Madrid Workshop"
            assert workshop.timezone == "Europe/Madrid"
            
        finally:
            db.close()
    
    def test_should_use_template_for_resource_provisioning(self):
        """Should use template configuration for resource provisioning."""
        template_service = TemplateService()
        
        # Test resource provisioning for Generic template
        resources = template_service.get_provisioning_config("Generic")
        
        assert "ovh_public_cloud_project" in resources
        assert resources["ovh_public_cloud_project"]["enabled"] is True
        assert resources["ovh_public_cloud_project"]["config"]["plan_code"] == "discovery"
        
        # Generic template should not provision additional resources
        assert "compute_instances" not in resources
        assert "storage_volumes" not in resources
        assert "networking" not in resources
    
    def test_should_extend_template_system_for_future_resources(self):
        """Should demonstrate template system is extensible for future resource types."""
        template_service = TemplateService()
        
        # Test that template system supports extensibility
        template_schema = template_service.get_template_schema()
        
        # Should support basic template structure
        assert "name" in template_schema
        assert "description" in template_schema
        assert "resources" in template_schema
        assert "is_active" in template_schema
        
        # Should support resource configuration
        assert "resource_config" in template_schema
        
        # Verify Generic template follows schema
        generic_template = template_service.get_template("Generic")
        assert hasattr(generic_template, 'name')
        assert hasattr(generic_template, 'description')
        assert hasattr(generic_template, 'resources')
        assert hasattr(generic_template, 'is_active')


if __name__ == "__main__":
    pytest.main([__file__, "-v"])