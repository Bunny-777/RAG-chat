from fastapi import APIRouter
from backend.app.core.config import settings
from backend.app.models.responses import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def get_health():
    """Returns application health status and loaded model configurations."""
    return HealthResponse(
        status="ok",
        version="1.0.0",
        app_name="AI Research Analyst",
        llm_model=settings.LLM_MODEL_NAME,
        embedding_model=settings.EMBEDDING_MODEL_NAME,
    )
