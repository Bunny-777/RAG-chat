import time
import uuid
import json
import asyncio
from typing import List, Optional, AsyncGenerator

from backend.app.core.config import settings
from backend.app.core.exceptions import ResearchAppException, TranscriptNotFoundError
from backend.app.core.logging import get_logger
from backend.app.models.requests import ResearchRequest
from backend.app.models.responses import ResearchResponse, SourceInfo
from backend.app.services.youtube_rag_service import youtube_rag_service, YouTubeIndexResult
from backend.app.services.source_store import source_store

logger = get_logger(__name__)


class ResearchService:
    """Coordinates research queries, RAG retrieval, synthesis, and streaming."""

    async def execute_research(self, request: ResearchRequest) -> ResearchResponse:
        start_time = time.perf_counter()
        research_id = f"res_{uuid.uuid4().hex[:12]}"
        logger.info(f"Starting research {research_id} for query: '{request.query}'")

        sources_used: List[SourceInfo] = []
        target_indices: List[YouTubeIndexResult] = []

        # 1. Check if direct YouTube URL was provided in the request
        if request.youtube_url:
            logger.info(f"Direct YouTube URL provided: {request.youtube_url}")
            index_res = youtube_rag_service.ingest_and_index_video(
                url=request.youtube_url,
                manual_transcript=request.manual_transcript,
            )
            src_info = source_store.add_youtube_source(index_res)
            sources_used.append(src_info)
            target_indices.append(index_res)

        # 2. Check explicitly provided source_ids
        if request.source_ids:
            for sid in request.source_ids:
                idx = source_store.get_source_index(sid)
                if idx:
                    target_indices.append(idx)
                    info = source_store.get_source_info(sid)
                    if info and info not in sources_used:
                        sources_used.append(info)
                else:
                    logger.warning(f"Source ID '{sid}' not found in store.")

        # 3. If no specific source was provided, use all indexed sources if available
        if not target_indices:
            all_sources = source_store.list_sources()
            for s in all_sources:
                idx = source_store.get_source_index(s.source_id)
                if idx:
                    target_indices.append(idx)
                    sources_used.append(s)

        if not target_indices:
            raise ResearchAppException(
                "No sources available to research against. Please provide a YouTube URL or upload a source first."
            )

        # 4. Perform Retrieval and Answer Synthesis
        primary_index = target_indices[0]
        raw_answer = youtube_rag_service.query(
            retriever=primary_index.retriever,
            question=request.query,
        )

        # Format structured findings and executive summary
        paragraphs = [p.strip() for p in raw_answer.split("\n\n") if p.strip()]
        executive_summary = paragraphs[0] if paragraphs else raw_answer
        findings = paragraphs[1:4] if len(paragraphs) > 1 else [raw_answer]
        analysis_points = paragraphs[1:] if len(paragraphs) > 1 else [raw_answer]
        conclusion = paragraphs[-1] if len(paragraphs) > 2 else "Analysis based strictly on verified source transcript context."

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        response = ResearchResponse(
            research_id=research_id,
            query=request.query,
            title=f"Research Report: {request.query[:60]}",
            executive_summary=executive_summary,
            key_findings=findings,
            analysis=analysis_points,
            conclusion=conclusion,
            sources=sources_used,
            mode=request.options.mode if request.options else "standard",
            latency_ms=elapsed_ms,
        )

        source_store.save_research(response)
        logger.info(f"Completed research {research_id} in {elapsed_ms}ms")
        return response

    async def execute_research_stream(
        self, request: ResearchRequest
    ) -> AsyncGenerator[str, None]:
        """Yields Server-Sent Events (SSE) tracking the research steps and final report."""
        research_id = f"res_{uuid.uuid4().hex[:12]}"

        # Step 1: Status
        yield f"data: {json.dumps({'type': 'status', 'message': 'Understanding research query...'})}\n\n"
        await asyncio.sleep(0.05)

        # Step 2: Source lookup/ingestion
        yield f"data: {json.dumps({'type': 'tool_call', 'tool': 'rag_search', 'message': 'Retrieving relevant transcript chunks...'})}\n\n"
        await asyncio.sleep(0.05)

        try:
            report = await self.execute_research(request)
            for src in report.sources:
                yield f"data: {json.dumps({'type': 'source_found', 'source_id': src.source_id, 'url': src.url})}\n\n"

            # Step 3: Analysis
            yield f"data: {json.dumps({'type': 'analysis', 'message': 'Synthesizing grounded evidence and drafting report...'})}\n\n"
            await asyncio.sleep(0.05)

            # Step 4: Final Report Data
            yield f"data: {json.dumps({'type': 'report', 'data': report.model_dump()})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'research_id': report.research_id})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"


research_service = ResearchService()
