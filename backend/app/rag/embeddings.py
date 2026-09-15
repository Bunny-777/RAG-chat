from functools import lru_cache
from typing import Optional
from langchain_core.embeddings import Embeddings
from backend.app.core.config import settings
from backend.app.core.logging import get_logger

logger = get_logger(__name__)


@lru_cache(maxsize=1)
def get_embeddings(model_name: Optional[str] = None) -> Embeddings:
    """Returns a cached singleton instance of HuggingFace embeddings."""
    name = model_name or settings.EMBEDDING_MODEL_NAME
    logger.info(f"Loading HuggingFace embeddings model: {name}")
    try:
        from langchain_huggingface import HuggingFaceEmbeddings
        return HuggingFaceEmbeddings(model_name=name)
    except ImportError:
        try:
            from langchain_community.embeddings import HuggingFaceEmbeddings
            return HuggingFaceEmbeddings(model_name=name)
        except ImportError:
            from langchain_core.embeddings import FakeEmbeddings
            logger.warning("HuggingFaceEmbeddings not installed; falling back to FakeEmbeddings for testing.")
            return FakeEmbeddings(size=384)
