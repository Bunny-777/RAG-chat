from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.embeddings import FakeEmbeddings
from unittest.mock import patch

from backend.app.services.youtube_rag_service import YouTubeRAGService


def test_youtube_rag_service_orchestration(sample_transcript_text):
    fake_embeddings = FakeEmbeddings(size=384)
    fake_llm = FakeListChatModel(responses=["Retrieval Augmented Generation combines vector search with LLMs."])

    service = YouTubeRAGService()

    with patch("backend.app.rag.vectorstore.get_embeddings", return_value=fake_embeddings):
        result = service.ingest_and_index_video(
            url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            manual_transcript=sample_transcript_text,
            chunk_size=150,
            chunk_overlap=30,
            k=2,
        )

        assert result.video_id == "dQw4w9WgXcQ"
        assert result.source_id == "yt_dQw4w9WgXcQ"
        assert result.chunk_count > 1
        assert result.vector_store is not None
        assert result.retriever is not None

        answer = service.query(
            retriever=result.retriever,
            question="What does RAG combine?",
            llm=fake_llm,
        )

        assert "Retrieval Augmented Generation" in answer
