from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.api import api_router
from backend.app.core.config import settings
from backend.app.core.exceptions import ResearchAppException
from backend.app.core.logging import get_logger

logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown routines."""
    logger.info("Initializing AI Research Analyst Backend...")
    logger.info(f"Loaded LLM Model: {settings.LLM_MODEL_NAME}")
    logger.info(f"Loaded Embedding Model: {settings.EMBEDDING_MODEL_NAME}")
    yield
    logger.info("Shutting down AI Research Analyst Backend...")


def create_app() -> FastAPI:
    """Factory creating and configuring the FastAPI application."""
    app = FastAPI(
        title="AI Research Analyst API",
        description=(
            "Advanced AI Research Analyst Backend with Multi-Source RAG, YouTube "
            "transcript extraction, citation mapping, and structured report generation."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS configuration for future React frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Open for development, configurable for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Custom Exception Handlers
    @app.exception_handler(ResearchAppException)
    async def research_exception_handler(request: Request, exc: ResearchAppException):
        logger.warning(f"Research domain error on {request.url.path}: {exc.message}")
        return JSONResponse(
            status_code=400,
            content={"error": exc.__class__.__name__, "detail": exc.message},
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled server error on {request.url.path}: {str(exc)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "error": "InternalServerError",
                "detail": "An unexpected error occurred while processing your request.",
            },
        )

    # Register API routers
    app.include_router(api_router)

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
