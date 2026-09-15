from typing import List, Optional
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from backend.app.core.config import settings
from backend.app.core.logging import get_logger

logger = get_logger(__name__)


def get_text_splitter(
    chunk_size: Optional[int] = None,
    chunk_overlap: Optional[int] = None,
) -> RecursiveCharacterTextSplitter:
    """Creates a RecursiveCharacterTextSplitter with the specified or default parameters."""
    size = chunk_size if chunk_size is not None else settings.DEFAULT_CHUNK_SIZE
    overlap = chunk_overlap if chunk_overlap is not None else settings.DEFAULT_CHUNK_OVERLAP
    return RecursiveCharacterTextSplitter(chunk_size=size, chunk_overlap=overlap)


def split_text(
    text: str,
    chunk_size: Optional[int] = None,
    chunk_overlap: Optional[int] = None,
    metadata: Optional[dict] = None,
) -> List[Document]:
    """Splits raw text string into LangChain Document chunks with metadata."""
    splitter = get_text_splitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    docs = splitter.create_documents([text], metadatas=[metadata or {}])
    # Add chunk_index to metadata for citation traceability
    for idx, doc in enumerate(docs):
        doc.metadata["chunk_index"] = idx
    logger.info(f"Split text into {len(docs)} chunks.")
    return docs


def split_documents(
    documents: List[Document],
    chunk_size: Optional[int] = None,
    chunk_overlap: Optional[int] = None,
) -> List[Document]:
    """Splits a list of LangChain documents into chunks, preserving source metadata."""
    splitter = get_text_splitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    chunks = splitter.split_documents(documents)
    for idx, doc in enumerate(chunks):
        doc.metadata["chunk_index"] = idx
    logger.info(f"Split {len(documents)} input document(s) into {len(chunks)} chunk(s).")
    return chunks
