from typing import Dict, Any, List
from langchain_core.documents import Document
from langchain_core.vectorstores import VectorStoreRetriever
from backend.app.core.logging import get_logger

logger = get_logger(__name__)


def search_uploaded_sources(
    retriever: VectorStoreRetriever,
    query: str,
) -> Dict[str, Any]:
    """
    RAG Search Tool: Searches indexed document chunks for the query.
    Returns structured results with page_content, score, and source metadata.
    """
    logger.info(f"Executing RAG search tool for query: '{query}'")
    docs: List[Document] = retriever.invoke(query)

    chunks = []
    for doc in docs:
        chunks.append({
            "content": doc.page_content,
            "metadata": doc.metadata,
        })

    return {
        "tool": "rag_search",
        "query": query,
        "results_count": len(chunks),
        "chunks": chunks,
    }
