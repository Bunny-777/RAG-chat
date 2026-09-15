from fastapi import APIRouter
from backend.app.api.health import router as health_router
from backend.app.api.upload import router as upload_router
from backend.app.api.research import router as research_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["Health"])
api_router.include_router(upload_router, tags=["Upload & Sources"])
api_router.include_router(research_router, tags=["Research"])

__all__ = ["api_router"]
