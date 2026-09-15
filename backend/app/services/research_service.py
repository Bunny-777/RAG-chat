import time
import uuid
import json
import asyncio
from typing import List, Optional, AsyncGenerator

from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

from backend.app.core.config import settings
from backend.app.core.exceptions import ResearchAppException, ModelProviderError
from backend.app.core.logging import get_logger
from backend.app.models.requests import ResearchRequest
from backend.app.models.responses import ResearchResponse, SourceInfo
from backend.app.services.youtube_rag_service import youtube_rag_service, YouTubeIndexResult, FALLBACK_MODELS
from backend.app.services.source_store import source_store
from backend.app.tools.calculator import safe_calculate, extract_math_expression
from backend.app.tools.web_search import web_search

logger = get_logger(__name__)

DIRECT_QA_PROMPT = PromptTemplate(
    template="""You are an expert AI Research Analyst.
Answer the following user research question, calculation, or prompt accurately, clearly, and concisely.
If calculations, steps, or analytical reasoning are needed, provide clear structured logic.

Question: {question}
Answer:""",
    input_variables=["question"],
)


class ResearchService:
    """Coordinates research queries, RAG retrieval, calculator tools, web search, and streaming."""

    async def execute_research(self, request: ResearchRequest) -> ResearchResponse:
        start_time = time.perf_counter()
        research_id = f"res_{uuid.uuid4().hex[:12]}"
        logger.info(f"Starting research {research_id} for query: '{request.query}'")

        sources_used: List[SourceInfo] = []
        target_indices: List[YouTubeIndexResult] = []

        # 1. Direct Mathematical Calculation Tool request (ALWAYS tool-first, no LLM required)
        math_expr = extract_math_expression(request.query)
        if math_expr:
            calc_result = safe_calculate(math_expr)
            if calc_result.get("success"):
                logger.info(f"Executing deterministic Calculator Tool for expression: '{math_expr}' -> {calc_result['result']}")
                res_val = calc_result["result"]
                executive_summary = f"Calculation Result: {calc_result['formatted']}"
                findings = [
                    f"Expression evaluated: `{math_expr}`",
                    f"Calculated value: **{res_val}**",
                    "Computed using the safe AST Mathematical Calculation Engine (no LLM hallucination).",
                ]
                analysis_points = [
                    f"The mathematical expression '{math_expr}' was evaluated deterministically.",
                    f"Result: {res_val}",
                ]
                conclusion = f"Verified arithmetic result: {res_val}"

                elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
                response = ResearchResponse(
                    research_id=research_id,
                    query=request.query,
                    title=f"Calculation: {math_expr} = {res_val}",
                    executive_summary=executive_summary,
                    key_findings=findings,
                    analysis=analysis_points,
                    conclusion=conclusion,
                    sources=[],
                    mode="quick",
                    latency_ms=elapsed_ms,
                )
                source_store.save_research(response)
                return response

        # 2. Check if direct YouTube URL was provided in the request
        if request.youtube_url:
            logger.info(f"Direct YouTube URL provided: {request.youtube_url}")
            index_res = youtube_rag_service.ingest_and_index_video(
                url=request.youtube_url,
                manual_transcript=request.manual_transcript,
            )
            src_info = source_store.add_youtube_source(index_res)
            sources_used.append(src_info)
            target_indices.append(index_res)

        # 3. Check explicitly provided source_ids
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

        # 4. If no specific source was provided, use all indexed sources if available
        if not target_indices and not request.source_ids:
            all_sources = source_store.list_sources()
            for s in all_sources:
                idx = source_store.get_source_index(s.source_id)
                if idx:
                    target_indices.append(idx)
                    sources_used.append(s)

        # 5. Check if Web Search Tool is requested
        web_search_results = []
        web_context = ""
        if request.options and request.options.web_search:
            logger.info(f"Executing Web Search Tool for query: '{request.query}'")
            search_out = web_search(request.query)
            web_search_results = search_out.get("results", [])
            for r in web_search_results:
                sources_used.append(
                    SourceInfo(
                        source_id=f"web_{uuid.uuid4().hex[:6]}",
                        source_type="web",
                        url=r.get("url"),
                        title=r.get("title") or "Web Search Result",
                        language="en",
                        chunk_count=1,
                    )
                )
            if web_search_results:
                snippets = [f"Title: {r.get('title')}\nURL: {r.get('url')}\nContent: {r.get('snippet')}" for r in web_search_results if r.get("snippet")]
                web_context = "\n\n".join(snippets)

        # 6. Perform Retrieval over RAG or Direct AI Analysis with fallback models
        if target_indices:
            logger.info(f"Executing RAG retrieval across {len(target_indices)} source(s).")
            primary_index = target_indices[0]
            raw_answer = youtube_rag_service.query(
                retriever=primary_index.retriever,
                question=request.query,
            )
            default_conclusion = "Analysis based strictly on verified source context."
        elif web_context:
            logger.info("Executing AI synthesis over Web Search evidence.")
            qa_input = f"Web Search Evidence:\n{web_context}\n\nQuestion: {request.query}"
            raw_answer = None
            last_err = None
            for model_cand in FALLBACK_MODELS:
                try:
                    cand_llm = youtube_rag_service.get_llm(model_name=model_cand)
                    chain = DIRECT_QA_PROMPT | cand_llm | StrOutputParser()
                    raw_answer = chain.invoke({"question": qa_input})
                    break
                except Exception as exc:
                    err_str = str(exc)
                    if "model_not_found" in err_str or "does not exist" in err_str or "404" in err_str:
                        last_err = exc
                        continue
                    raise exc
            if not raw_answer:
                raise ModelProviderError(f"All attempted Groq models failed: {last_err}")
            default_conclusion = "Analysis synthesized from live web search results."
        else:
            logger.info("Executing direct AI reasoning with model fallback.")
            raw_answer = None
            last_err = None
            for model_cand in FALLBACK_MODELS:
                try:
                    cand_llm = youtube_rag_service.get_llm(model_name=model_cand)
                    chain = DIRECT_QA_PROMPT | cand_llm | StrOutputParser()
                    raw_answer = chain.invoke({"question": request.query})
                    break
                except Exception as exc:
                    err_str = str(exc)
                    if "model_not_found" in err_str or "does not exist" in err_str or "404" in err_str:
                        last_err = exc
                        continue
                    raise exc

            if not raw_answer:
                raise ModelProviderError(f"All attempted Groq models failed: {last_err}")
            default_conclusion = "Direct analytical response generated by AI Research Analyst."

        # Format structured findings and executive summary
        paragraphs = [p.strip() for p in raw_answer.split("\n\n") if p.strip()]
        executive_summary = paragraphs[0] if paragraphs else raw_answer
        findings = paragraphs[1:4] if len(paragraphs) > 1 else [raw_answer]
        analysis_points = paragraphs[1:] if len(paragraphs) > 1 else [raw_answer]
        conclusion = paragraphs[-1] if len(paragraphs) > 2 else default_conclusion

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
        # Step 1: Status
        yield f"data: {json.dumps({'type': 'status', 'message': 'Understanding research query...'})}\n\n"
        await asyncio.sleep(0.05)

        # Step 2: Tool Detection & Execution Event
        math_expr = extract_math_expression(request.query)
        if math_expr:
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': 'calculator', 'message': f'Evaluating mathematical calculation: {math_expr}'})}\n\n"
        elif request.options and request.options.web_search:
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': 'web_search', 'message': 'Searching the live web for verified evidence...'})}\n\n"
        elif request.youtube_url or request.source_ids or source_store.list_sources():
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': 'rag_search', 'message': 'Retrieving relevant source transcript chunks...'})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': 'direct_llm', 'message': 'Analyzing query with AI reasoning engine...'})}\n\n"
        await asyncio.sleep(0.05)

        try:
            report = await self.execute_research(request)
            for src in report.sources:
                yield f"data: {json.dumps({'type': 'source_found', 'source_id': src.source_id, 'url': src.url})}\n\n"

            # Step 3: Analysis
            yield f"data: {json.dumps({'type': 'analysis', 'message': 'Synthesizing evidence and formatting research report...'})}\n\n"
            await asyncio.sleep(0.05)

            # Step 4: Final Report Data
            yield f"data: {json.dumps({'type': 'report', 'data': report.model_dump()})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'research_id': report.research_id})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"


research_service = ResearchService()
