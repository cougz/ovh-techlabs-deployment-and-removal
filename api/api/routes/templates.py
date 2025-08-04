from fastapi import APIRouter, Depends, HTTPException
from typing import List

from api.routes.auth import get_current_user
from schemas.workshop import WorkshopTemplate
from services.template_service import TemplateService

router = APIRouter()

@router.get("/", response_model=List[WorkshopTemplate])
async def list_templates(
    current_user: str = Depends(get_current_user)
):
    """List all available workshop templates."""
    template_service = TemplateService()
    return template_service.list_templates()

@router.get("/{template_name}", response_model=WorkshopTemplate)
async def get_template(
    template_name: str,
    current_user: str = Depends(get_current_user)
):
    """Get a specific template by name."""
    template_service = TemplateService()
    try:
        return template_service.get_template(template_name)
    except ValueError as e:
        raise HTTPException(
            status_code=404,
            detail=str(e)
        )