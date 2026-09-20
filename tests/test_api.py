import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.embeddings import FakeEmbeddings

from backend.app.main import app
from backend.app.services.source_store import source_store

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_store():
    source_store.clear()
    yield
    source_store.clear()


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app_name"] == "AI Research Analyst"
    assert "llm_model" in data
    assert "embedding_model" in data


def test_upload_youtube_manual_transcript(sample_transcript_text):
    fake_embeddings = FakeEmbeddings(size=384)
    with patch("backend.app.rag.vectorstore.get_embeddings", return_value=fake_embeddings):
        payload = {
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "manual_transcript": sample_transcript_text,
            "chunk_size": 200,
            "chunk_overlap": 50,
            "k": 2,
        }
        response = client.post("/upload", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["source"]["source_id"] == "yt_dQw4w9WgXcQ"
        assert data["source"]["source_type"] == "youtube"
        assert data["source"]["chunk_count"] > 0


def test_list_and_get_sources(sample_transcript_text):
    fake_embeddings = FakeEmbeddings(size=384)
    with patch("backend.app.rag.vectorstore.get_embeddings", return_value=fake_embeddings):
        # Upload a source
        client.post(
            "/upload",
            json={
                "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "manual_transcript": sample_transcript_text,
            },
        )

        # List sources
        list_res = client.get("/sources")
        assert list_res.status_code == 200
        sources = list_res.json()
        assert len(sources) == 1
        assert sources[0]["source_id"] == "yt_dQw4w9WgXcQ"

        # Get specific source
        get_res = client.get("/sources/yt_dQw4w9WgXcQ")
        assert get_res.status_code == 200
        assert get_res.json()["source_id"] == "yt_dQw4w9WgXcQ"

        # Get non-existent source
        not_found_res = client.get("/sources/non_existent_id")
        assert not_found_res.status_code == 404


def test_research_endpoint_with_uploaded_source(sample_transcript_text):
    fake_embeddings = FakeEmbeddings(size=384)
    fake_llm = FakeListChatModel(
        responses=[
            "Retrieval Augmented Generation combines vector search with LLMs.\n\n"
            "Key finding: FAISS provides fast nearest-neighbor lookups.\n\n"
            "In conclusion, RAG provides grounded factual answers."
        ]
    )

    with patch("backend.app.rag.vectorstore.get_embeddings", return_value=fake_embeddings), \
         patch("backend.app.services.youtube_rag_service.youtube_rag_service.get_llm", return_value=fake_llm):
        
        # 1. Upload source
        upload_res = client.post(
            "/upload",
            json={
                "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "manual_transcript": sample_transcript_text,
            },
        )
        source_id = upload_res.json()["source"]["source_id"]

        # 2. Perform research query
        research_res = client.post(
            "/research",
            json={
                "query": "What is RAG and how does it work?",
                "source_ids": [source_id],
                "options": {"mode": "standard", "web_search": False},
            },
        )
        assert research_res.status_code == 200
        report = research_res.json()
        assert "research_id" in report
        assert "executive_summary" in report
        assert len(report["key_findings"]) > 0
        assert len(report["sources"]) == 1
        assert report["sources"][0]["source_id"] == source_id

        research_id = report["research_id"]

        # 3. Retrieve saved report
        get_report_res = client.get(f"/research/{research_id}")
        assert get_report_res.status_code == 200
        assert get_report_res.json()["research_id"] == research_id

        # 4. Retrieve report sources
        get_sources_res = client.get(f"/research/{research_id}/sources")
        assert get_sources_res.status_code == 200
        assert len(get_sources_res.json()) == 1

        # 5. Delete report
        del_res = client.delete(f"/research/{research_id}")
        assert del_res.status_code == 200


def test_research_calculator_tool():
    res = client.post(
        "/research",
        json={"query": "what is 2+2?", "options": {"mode": "quick"}},
    )
    assert res.status_code == 200
    data = res.json()
    assert "2+2 = 4" in data["executive_summary"]
    assert "4" in str(data["key_findings"])


def test_research_direct_query_without_sources():
    fake_llm = FakeListChatModel(
        responses=["General research response.\n\nDetailed reasoning.\n\nConclusion."]
    )

    with patch("backend.app.services.youtube_rag_service.youtube_rag_service.get_llm", return_value=fake_llm):
        res = client.post(
            "/research",
            json={"query": "Explain quantum computing fundamentals", "options": {"mode": "quick"}},
        )
        assert res.status_code == 200
        data = res.json()
        assert "General research response" in data["executive_summary"]
        assert len(data["sources"]) == 0


def test_research_streaming_endpoint(sample_transcript_text):
    fake_embeddings = FakeEmbeddings(size=384)
    fake_llm = FakeListChatModel(responses=["Streamed answer regarding RAG."])

    with patch("backend.app.rag.vectorstore.get_embeddings", return_value=fake_embeddings), \
         patch("backend.app.services.youtube_rag_service.youtube_rag_service.get_llm", return_value=fake_llm):
        
        # Ingest directly during streaming request
        payload = {
            "query": "Explain RAG in detail",
            "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "manual_transcript": sample_transcript_text,
        }
        res = client.post("/research/stream", json=payload)
        assert res.status_code == 200
        assert "text/event-stream" in res.headers["content-type"]
        body = res.text
        assert "data: " in body
        assert "tool_call" in body or "status" in body or "report" in body


def test_upload_document_and_delete_endpoint():
    fake_embeddings = FakeEmbeddings(size=384)
    file_bytes = b"This is a technical whitepaper on AI research and Retrieval Augmented Generation."

    with patch("backend.app.rag.vectorstore.get_embeddings", return_value=fake_embeddings):
        # 1. Upload document file
        files = {"file": ("whitepaper.txt", file_bytes, "text/plain")}
        res = client.post("/upload/file", files=files, data={"chunk_size": 200, "k": 2})
        assert res.status_code == 200
        data = res.json()
        assert "whitepaper.txt" in data["message"]
        source_id = data["source"]["source_id"]
        assert data["source"]["source_type"] == "document"

        # 2. Check source in list
        sources_res = client.get("/sources")
        assert sources_res.status_code == 200
        source_ids = [s["source_id"] for s in sources_res.json()]
        assert source_id in source_ids

        # 3. Delete source
        del_res = client.delete(f"/sources/{source_id}")
        assert del_res.status_code == 200
        assert "successfully removed" in del_res.json()["message"]

        # 4. Verify gone
        get_res = client.get(f"/sources/{source_id}")
        assert get_res.status_code == 404
