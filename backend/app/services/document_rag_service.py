from dataclasses import dataclass
from typing import Optional, List
from langchain_core.documents import Document
from langchain_core.vectorstores import VectorStoreRetriever
from langchain_community.vectorstores import FAISS

from backend.app.core.config import settings
from backend.app.core.logging import get_logger
from backend.app.ingestion.document import create_document_documents
from backend.app.rag.chunking import split_documents
from backend.app.rag.vectorstore import create_vectorstore
from backend.app.rag.retriever import get_retriever

logger = get_logger(__name__)


@dataclass
class DocumentIndexResult:
    """Result data container for an indexed file document."""
    source_id: str
    source_type: str
    filename: str
    file_type: str
    chunk_count: int
    vector_store: FAISS
    retriever: VectorStoreRetriever
    raw_documents: List[Document]
    chunks: List[Document]


class DocumentRAGService:
    """Processes uploaded documents (PDF, DOCX, TXT, MD), chunks them, and indexes in FAISS."""

    def ingest_and_index_file(
        self,
        content: bytes,
        filename: str,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
        k: Optional[int] = None,
        source_id: Optional[str] = None,
    ) -> DocumentIndexResult:
        logger.info(f"Ingesting uploaded document: {filename} ({len(content)} bytes)")
        docs, meta = create_document_documents(
            content=content,
            filename=filename,
            source_id=source_id,
        )

        c_size = chunk_size if chunk_size is not None else settings.DEFAULT_CHUNK_SIZE
        c_overlap = chunk_overlap if chunk_overlap is not None else settings.DEFAULT_CHUNK_OVERLAP
        top_k = k if k is not None else settings.DEFAULT_TOP_K

        chunks = split_documents(docs, chunk_size=c_size, chunk_overlap=c_overlap)
        vector_store = create_vectorstore(chunks)
        retriever = get_retriever(vector_store, k=top_k)

        logger.info(
            f"Successfully indexed document '{filename}' (ID: {meta['source_id']}) with {len(chunks)} chunk(s)."
        )

        return DocumentIndexResult(
            source_id=meta["source_id"],
            source_type="document",
            filename=filename,
            file_type=meta["file_type"],
            chunk_count=len(chunks),
            vector_store=vector_store,
            retriever=retriever,
            raw_documents=docs,
            chunks=chunks,
        )


document_rag_service = DocumentRAGService()
