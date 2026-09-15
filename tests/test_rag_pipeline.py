from langchain_core.embeddings import FakeEmbeddings
from langchain_core.documents import Document

from backend.app.rag.chunking import split_text, split_documents
from backend.app.rag.vectorstore import create_vectorstore, add_documents_to_vectorstore
from backend.app.rag.retriever import get_retriever, format_documents


def test_split_text_and_metadata():
    text = "Hello world. " * 50
    chunks = split_text(text, chunk_size=100, chunk_overlap=20, metadata={"source": "test"})
    assert len(chunks) > 1
    for idx, chunk in enumerate(chunks):
        assert chunk.metadata["source"] == "test"
        assert chunk.metadata["chunk_index"] == idx


def test_split_documents():
    docs = [
        Document(page_content="Content paragraph 1. " * 30, metadata={"doc_id": "1"}),
        Document(page_content="Content paragraph 2. " * 30, metadata={"doc_id": "2"}),
    ]
    chunks = split_documents(docs, chunk_size=100, chunk_overlap=20)
    assert len(chunks) > 2
    assert any(c.metadata["doc_id"] == "1" for c in chunks)
    assert any(c.metadata["doc_id"] == "2" for c in chunks)


def test_vectorstore_and_retriever():
    fake_embeddings = FakeEmbeddings(size=384)
    docs = [
        Document(page_content="LangChain is a framework for developing applications powered by LLMs.", metadata={"id": 1}),
        Document(page_content="FAISS is a library for efficient similarity search and clustering of dense vectors.", metadata={"id": 2}),
        Document(page_content="Groq provides fast inference processing units for language models.", metadata={"id": 3}),
    ]
    vector_store = create_vectorstore(docs, embeddings=fake_embeddings)
    assert vector_store is not None

    retriever = get_retriever(vector_store, k=2)
    retrieved_docs = retriever.invoke("What is FAISS?")
    assert len(retrieved_docs) == 2

    formatted = format_documents(retrieved_docs)
    assert isinstance(formatted, str)
    assert len(formatted) > 0


def test_add_documents_to_vectorstore():
    fake_embeddings = FakeEmbeddings(size=384)
    initial_docs = [Document(page_content="Document 1", metadata={"id": 1})]
    vector_store = create_vectorstore(initial_docs, embeddings=fake_embeddings)

    new_docs = [Document(page_content="Document 2", metadata={"id": 2})]
    add_documents_to_vectorstore(vector_store, new_docs)

    retriever = get_retriever(vector_store, k=2)
    results = retriever.invoke("Document")
    assert len(results) == 2
