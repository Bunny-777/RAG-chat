import pytest
from unittest.mock import patch, MagicMock
from langchain_core.messages import AIMessage

from backend.app.models.requests import ResearchRequest, ResearchOptions
from backend.app.models.responses import SourceInfo
from backend.app.services.research_service import research_service, parse_report_sections
from backend.app.services.source_store import source_store


from langchain_community.chat_models.fake import FakeListChatModel


def test_parse_report_sections_markdown():
    markdown_text = """### Executive Summary
This is the executive summary answering the question directly.

### Key Findings
- Finding 1: Scalability is improved by 40%
- Finding 2: Latency is reduced to sub-10ms

### Comparative Analysis & Multi-Source Perspectives
Comparing Source A and Source B shows distinct architectural differences.

### Strategic Conclusion & Recommendations
The optimal architecture is a hybrid vector search approach.
"""
    summary, findings, analysis, conclusion = parse_report_sections(markdown_text, "Default conclusion")
    assert "executive summary" in summary
    assert len(findings) == 2
    assert "Finding 1: Scalability" in findings[0]
    assert any("Comparing Source A" in a for a in analysis)
    assert "optimal architecture" in conclusion


def test_parse_report_sections_plain_paragraphs():
    plain_text = "First paragraph summary.\n\nSecond paragraph finding.\n\nThird paragraph conclusion."
    summary, findings, analysis, conclusion = parse_report_sections(plain_text, "Default")
    assert summary == "First paragraph summary."
    assert "Second paragraph finding." in findings
    assert conclusion == "Third paragraph conclusion."


import asyncio


def test_quick_mode_execution():
    async def _run():
        fake_response = "Quick response: Quantum computing uses qubits.\n\nKey finding: Superposition allows parallel state representation."
        dummy_llm = FakeListChatModel(responses=[fake_response, fake_response])

        with patch("backend.app.services.youtube_rag_service.youtube_rag_service.get_llm", return_value=dummy_llm):
            req = ResearchRequest(
                query="What is quantum superposition?",
                options=ResearchOptions(mode="quick", web_search=False),
            )
            report = await research_service.execute_research(req)
            assert report.mode == "quick"
            assert "Quantum computing" in report.executive_summary
            assert report.latency_ms is not None

    asyncio.run(_run())


def test_deep_mode_execution_and_streaming():
    async def _run():
        fake_response = """### Executive Summary
Deep comparative synthesis of Transformer vs RNN architectures.

### Comparative Analysis & Multi-Source Perspectives
Transformers scale efficiently via self-attention whereas RNNs suffer from sequential bottlenecks.

### Key Research Findings & Evidence Evaluation
- Finding 1: Transformer training time is significantly reduced
- Finding 2: Memory footprint during inference scales quadratically with sequence length

### Strategic Conclusion & Recommendations
For high-throughput long-context retrieval, hybrid state-space models and transformers dominate.
"""
        dummy_llm = FakeListChatModel(responses=[fake_response, fake_response])

        with patch("backend.app.services.youtube_rag_service.youtube_rag_service.get_llm", return_value=dummy_llm):
            req = ResearchRequest(
                query="Compare Transformer and RNN architectures in depth",
                options=ResearchOptions(mode="deep", web_search=False),
            )
            report = await research_service.execute_research(req)
            assert report.mode == "deep"
            assert len(report.key_findings) >= 2
            assert any("Transformers scale efficiently" in a for a in report.analysis)

            # Test streaming emits thinking events in deep mode
            stream_events = []
            async for chunk in research_service.execute_research_stream(req):
                stream_events.append(chunk)

            full_stream = "".join(stream_events)
            assert "thinking" in full_stream
            assert "Deep Research Mode" in full_stream
            assert "done" in full_stream

    asyncio.run(_run())


def test_multi_source_retrieval_in_standard_mode():
    async def _run():
        mock_retriever1 = MagicMock()
        mock_retriever1.invoke.return_value = [
            MagicMock(page_content="Document 1 discusses vector databases and embeddings.")
        ]
        mock_retriever2 = MagicMock()
        mock_retriever2.invoke.return_value = [
            MagicMock(page_content="Document 2 discusses FAISS indexing and HNSW graphs.")
        ]

        mock_index1 = MagicMock(source_id="src_1", filename="doc1.pdf", retriever=mock_retriever1)
        mock_index2 = MagicMock(source_id="src_2", filename="doc2.docx", retriever=mock_retriever2)

        source_store.clear()
        source_store._sources["src_1"] = mock_index1
        source_store._sources["src_2"] = mock_index2
        source_store._source_infos["src_1"] = SourceInfo(source_id="src_1", title="doc1.pdf")
        source_store._source_infos["src_2"] = SourceInfo(source_id="src_2", title="doc2.docx")

        fake_response = "Multi-source synthesis combining vector databases and FAISS indexing."
        dummy_llm = FakeListChatModel(responses=[fake_response, fake_response])

        with patch("backend.app.services.youtube_rag_service.youtube_rag_service.get_llm", return_value=dummy_llm):
            req = ResearchRequest(
                query="Compare vector search methods",
                source_ids=["src_1", "src_2"],
                options=ResearchOptions(mode="standard", web_search=False),
            )
            report = await research_service.execute_research(req)
            assert report.mode == "standard"
            assert len(report.sources) == 2
            mock_retriever1.invoke.assert_called_once()
            mock_retriever2.invoke.assert_called_once()

    asyncio.run(_run())
