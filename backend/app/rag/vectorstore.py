from typing import List, Optional
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from backend.app.rag.embeddings import get_embeddings
from backend.app.core.logging import get_logger

logger = get_logger(__name__)


def create_vectorstore(
    documents: List[Document],
    embeddings: Optional[Embeddings] = None,
) -> FAISS:
    """Creates an in-memory FAISS vector store from document chunks."""
    emb = embeddings or get_embeddings()
    logger.info(f"Creating FAISS vector store with {len(documents)} document chunk(s).")
    vector_store = FAISS.from_documents(documents, emb)
    return vector_store


def add_documents_to_vectorstore(
    vector_store: FAISS,
    documents: List[Document],
) -> None:
    """Adds additional document chunks to an existing FAISS vector store."""
    logger.info(f"Adding {len(documents)} chunk(s) to existing FAISS vector store.")
    vector_store.add_documents(documents)
