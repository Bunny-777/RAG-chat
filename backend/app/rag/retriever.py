from typing import List, Optional
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_core.vectorstores import VectorStoreRetriever
from backend.app.core.config import settings
from backend.app.core.logging import get_logger

logger = get_logger(__name__)


def get_retriever(
    vector_store: FAISS,
    k: Optional[int] = None,
    search_type: str = "similarity",
) -> VectorStoreRetriever:
    """Creates a retriever from a FAISS vector store with configurable top-k."""
    top_k = k if k is not None else settings.DEFAULT_TOP_K
    logger.info(f"Configuring retriever with search_type='{search_type}', k={top_k}")
    return vector_store.as_retriever(
        search_type=search_type,
        search_kwargs={"k": top_k},
    )


def format_documents(retrieved_docs: List[Document]) -> str:
    """Formats retrieved LangChain documents into a single context string for the prompt."""
    return "\n\n".join(doc.page_content for doc in retrieved_docs)
