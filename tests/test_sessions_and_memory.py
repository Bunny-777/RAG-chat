import pytest
import asyncio
from unittest.mock import patch
from fastapi.testclient import TestClient
from langchain_community.chat_models.fake import FakeListChatModel

from backend.app.main import app
from backend.app.models.requests import ResearchRequest, ResearchOptions
from backend.app.services.session_store import session_store
from backend.app.services.research_service import research_service

client = TestClient(app)


def test_session_store_turn_and_history():
    session_store.clear()
    session = session_store.get_or_create_session(title="Quantum Chat")
    assert session.title == "Quantum Chat"
    assert len(session.turns) == 0

    # Test formatting empty
    assert session_store.format_history_for_prompt(session.session_id) == ""

    # Add mock turn
    from backend.app.models.responses import ResearchResponse
    mock_report = ResearchResponse(
        research_id="res_test",
        session_id=session.session_id,
        query="What is quantum entanglement?",
        title="Report",
        executive_summary="Quantum entanglement is a physical phenomenon where particles remain connected.",
        conclusion="Conclusion",
    )
    session_store.add_turn(session.session_id, "What is quantum entanglement?", mock_report)
    session = session_store.get_session(session.session_id)
    assert len(session.turns) == 2  # 1 user + 1 assistant

    history_str = session_store.format_history_for_prompt(session.session_id)
    assert "User: What is quantum entanglement?" in history_str
    assert "Assistant: Quantum entanglement is a physical phenomenon" in history_str


def test_conversational_memory_in_research_service():
    async def _run():
        session_store.clear()
        sess = session_store.get_or_create_session(session_id="sess_123")

        fake_resp_1 = "Quantum computing relies on qubits which leverage superposition."
        fake_resp_2 = "Qubits can represent 0 and 1 simultaneously."
        dummy_llm = FakeListChatModel(responses=[fake_resp_1, fake_resp_2])

        with patch("backend.app.services.youtube_rag_service.youtube_rag_service.get_llm", return_value=dummy_llm):
            # Turn 1
            req1 = ResearchRequest(
                session_id=sess.session_id,
                query="What are qubits?",
                options=ResearchOptions(mode="quick"),
            )
            res1 = await research_service.execute_research(req1)
            assert res1.session_id == sess.session_id
            assert res1.mode == "quick"
            # Quick mode level-wise format check:
            assert res1.executive_summary == fake_resp_1
            assert len(res1.key_findings) == 0  # level-wise: no bloated findings
            assert len(res1.analysis) == 0

            # Turn 2: Follow-up question relying on memory
            req2 = ResearchRequest(
                session_id=sess.session_id,
                query="How do they differ from classical bits?",
                options=ResearchOptions(mode="quick"),
            )
            res2 = await research_service.execute_research(req2)
            assert res2.session_id == sess.session_id

            # Verify session has 4 turns (2 user, 2 assistant)
            updated_sess = session_store.get_session(sess.session_id)
            assert len(updated_sess.turns) == 4

    asyncio.run(_run())


def test_session_api_endpoints():
    session_store.clear()

    # 1. Create session
    create_res = client.post("/sessions", json={"title": "Test Topic"})
    assert create_res.status_code == 200
    sess_id = create_res.json()["session_id"]
    assert create_res.json()["title"] == "Test Topic"

    # 2. List sessions
    list_res = client.get("/sessions")
    assert list_res.status_code == 200
    ids = [s["session_id"] for s in list_res.json()]
    assert sess_id in ids

    # 3. Get session detail
    get_res = client.get(f"/sessions/{sess_id}")
    assert get_res.status_code == 200
    assert get_res.json()["session_id"] == sess_id

    # 4. Delete session
    del_res = client.delete(f"/sessions/{sess_id}")
    assert del_res.status_code == 200
    assert "successfully deleted" in del_res.json()["message"]

    # 5. Verify deleted
    get_res_404 = client.get(f"/sessions/{sess_id}")
    assert get_res_404.status_code == 404


def test_empty_source_ids_does_not_attach_indexed_documents():
    async def _run():
        from backend.app.services.source_store import source_store
        from backend.app.models.responses import SourceInfo

        # Simulate an existing indexed PDF in the store
        mock_doc = SourceInfo(
            source_id="doc_old_pdf_123",
            source_type="document",
            title="old_contract.pdf",
            chunk_count=5,
        )
        source_store._source_infos["doc_old_pdf_123"] = mock_doc

        fake_llm = FakeListChatModel(responses=["iPhone 16 base model starts at $799."])

        with patch("backend.app.services.youtube_rag_service.youtube_rag_service.get_llm", return_value=fake_llm):
            req = ResearchRequest(
                query="price of new iphone",
                source_ids=[],  # Explicitly empty: no documents selected
                options=ResearchOptions(mode="quick", web_search=True),
            )
            res = await research_service.execute_research(req)
            # Verify the old PDF was NOT attached to sources
            source_ids_used = [s.source_id for s in res.sources]
            assert "doc_old_pdf_123" not in source_ids_used

    asyncio.run(_run())

