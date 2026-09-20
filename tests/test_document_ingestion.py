import io
import pytest
from backend.app.ingestion.document import (
    extract_text_from_pdf,
    extract_text_from_docx,
    extract_text_from_plain,
    create_document_documents,
)
from backend.app.core.exceptions import DocumentIngestionError
from backend.app.services.document_rag_service import document_rag_service


def test_extract_text_from_plain_text():
    content = b"Artificial Intelligence and Machine Learning are transforming modern software development."
    text, docs = extract_text_from_plain(content, "notes.txt")
    assert "Artificial Intelligence" in text
    assert len(docs) == 1
    assert docs[0].page_content == text
    assert docs[0].metadata["filename"] == "notes.txt"


def test_extract_text_from_plain_empty_fails():
    with pytest.raises(DocumentIngestionError):
        extract_text_from_plain(b"", "empty.txt")


def test_create_document_documents_markdown():
    content = b"# Document Title\n\nThis is a research document with important findings."
    docs, meta = create_document_documents(content, "report.md")
    assert len(docs) == 1
    assert meta["file_type"] == "text"
    assert meta["filename"] == "report.md"
    assert "Document Title" in docs[0].page_content


def test_document_rag_service_ingest_and_index():
    text_sample = b"LangChain and FAISS provide local vector storage and retrieval capabilities for RAG systems.\n" * 10
    result = document_rag_service.ingest_and_index_file(
        content=text_sample,
        filename="rag_guide.txt",
        chunk_size=200,
        chunk_overlap=50,
        k=2,
    )
    assert result.filename == "rag_guide.txt"
    assert result.file_type == "text"
    assert result.chunk_count > 0
    assert result.vector_store is not None
    assert result.retriever is not None
