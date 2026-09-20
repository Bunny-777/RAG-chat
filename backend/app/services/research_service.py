import time
import uuid
import json
import re
import asyncio
from typing import List, Optional, AsyncGenerator, Tuple, Dict, Any

from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

from backend.app.core.config import settings
from backend.app.core.exceptions import ResearchAppException, ModelProviderError
from backend.app.core.logging import get_logger
from backend.app.models.requests import ResearchRequest
from backend.app.models.responses import ResearchResponse, SourceInfo
from backend.app.services.youtube_rag_service import youtube_rag_service, YouTubeIndexResult, FALLBACK_MODELS
from backend.app.services.source_store import source_store, AnyIndexResult
from backend.app.services.session_store import session_store
from backend.app.tools.calculator import safe_calculate, extract_math_expression
from backend.app.tools.web_search import web_search

logger = get_logger(__name__)

QUICK_PROMPT = PromptTemplate(
    template="""You are an ultra-fast, direct AI Assistant.
Answer the user's question directly, clearly, and concisely in 1 to 2 brief paragraphs or 3-4 succinct bullet points maximum.
Do NOT output section headers like 'Executive Summary', 'Key Findings', or 'Conclusion'.
Deliver ONLY the bottom line and core answer immediately.

{context_section}

Question: {question}
Answer:""",
    input_variables=["context_section", "question"],
)

STANDARD_PROMPT = PromptTemplate(
    template="""You are an expert AI Research Analyst.
Answer the user's research question by synthesizing verified information from ALL available sources provided below.
Compare and explicitly cite findings from the sources (e.g. refer to "[Source: <name>]").
Highlight consensus, differences, and specific facts extracted across the sources.

Structure your answer with:
### Executive Summary
A concise overview answering the query based on the sources.

### Key Findings
- Key point 1 with source reference
- Key point 2 with source reference
- Key point 3 with source reference

### Detailed Analysis
In-depth synthesized explanation across all sources.

### Conclusion
Final synthesis and concluding remarks.

{context_section}

Question: {question}
Answer:""",
    input_variables=["context_section", "question"],
)

DEEP_PROMPT = PromptTemplate(
    template="""You are a Principal AI Research Scientist performing an exhaustive, deep comparative research investigation.
Perform a rigorous, multi-perspective, comparative analysis of the question using the available context.

You must:
1. Deep Comparative Analysis: Rigorously compare and contrast viewpoints, methodologies, and claims across different sources or analytical angles.
2. Nuances & Trade-offs: Identify underlying assumptions, critical nuances, trade-offs, and evidence discrepancies.
3. Comparative Evaluation: Evaluate the topic along key critical dimensions.
4. Actionable Strategic Synthesis: Provide strategic conclusions and implications.

Structure your response with the following markdown headers:
### Executive Summary
Detailed executive summary framing the problem and overarching thesis.

### Comparative Analysis & Multi-Source Perspectives
In-depth comparison of perspectives, contrasting viewpoints, and source arguments.

### Key Research Findings & Evidence Evaluation
- Finding 1: Detailed analysis with evidence evaluation
- Finding 2: Detailed analysis with evidence evaluation
- Finding 3: Detailed analysis with evidence evaluation

### Trade-Offs, Discrepancies & Limitations
Critical discussion of edge cases, trade-offs, evidentiary gaps, and caveats.

### Strategic Conclusion & Recommendations
Authoritative, forward-looking strategic conclusion.

{context_section}

Question: {question}
Answer:""",
    input_variables=["context_section", "question"],
)


def parse_report_sections(
    raw_answer: str,
    default_conclusion: str,
    mode: str = "standard",
) -> Tuple[str, List[str], List[str], str]:
    """
    Parses LLM output into executive summary, key findings, detailed analysis points, and conclusion.
    Handles level-wise outputs:
    - quick: pure direct answer in executive_summary, no bloated analysis/findings.
    - standard: balanced brief with key findings and analysis.
    - deep: exhaustive dossier with comparative perspectives and trade-offs.
    """
    # Level 1: Quick Mode - Fast Flash Output
    if mode == "quick":
        clean_text = raw_answer.strip()
        return clean_text, [], [], ""

    header_pattern = re.compile(r"^#{1,3}\s+(.+)$", re.MULTILINE)
    matches = list(header_pattern.finditer(raw_answer))

    if matches:
        sections: Dict[str, str] = {}
        for i, match in enumerate(matches):
            header = match.group(1).strip().lower()
            start_pos = match.end()
            end_pos = matches[i + 1].start() if i + 1 < len(matches) else len(raw_answer)
            section_content = raw_answer[start_pos:end_pos].strip()
            sections[header] = section_content

        exec_summary = ""
        for h, text in sections.items():
            if "executive summary" in h or "summary" in h:
                exec_summary = text
                break

        findings: List[str] = []
        for h, text in sections.items():
            if "finding" in h or "key findings" in h:
                lines = [line.strip().lstrip("-*•0123456789. ") for line in text.split("\n") if line.strip()]
                findings = [line for line in lines if line]
                break

        analysis: List[str] = []
        for h, text in sections.items():
            if any(k in h for k in ["analysis", "comparative", "perspectives", "trade-off", "limitations", "evaluation"]):
                paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
                analysis.extend(paragraphs)

        conclusion = ""
        for h, text in sections.items():
            if "conclusion" in h or "recommendation" in h:
                conclusion = text
                break

        # Fallback if any section was missing
        if not exec_summary:
            exec_summary = list(sections.values())[0] if sections else raw_answer
        if not findings:
            findings = [line for line in exec_summary.split("\n") if line.strip()][:3] or [exec_summary]
        if not analysis:
            analysis = list(sections.values())[1:] or [raw_answer]
        if not conclusion:
            conclusion = default_conclusion

        return exec_summary, findings, analysis, conclusion

    # Plain text paragraph fallback
    paragraphs = [p.strip() for p in raw_answer.split("\n\n") if p.strip()]
    exec_summary = paragraphs[0] if paragraphs else raw_answer
    findings = paragraphs[1:4] if len(paragraphs) > 1 else [raw_answer]
    analysis = paragraphs[1:] if len(paragraphs) > 1 else [raw_answer]
    conclusion = paragraphs[-1] if len(paragraphs) > 2 else default_conclusion

    return exec_summary, findings, analysis, conclusion


class ResearchService:
    """Coordinates research queries, RAG retrieval across multiple sources, calculator tools, web search, and streaming."""

    def _retrieve_multi_source_context(
        self,
        query: str,
        indices: List[AnyIndexResult],
        mode: str,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Retrieves context chunks across all active indices according to research mode:
        - quick: top 1-2 chunks total
        - standard: top 3 chunks per source
        - deep: top 5 chunks per source
        """
        chunks_collected: List[Dict[str, Any]] = []

        top_k_per_source = 2 if mode == "quick" else (3 if mode == "standard" else 5)

        for idx in indices:
            src_title = getattr(idx, "filename", None) or f"Video ({getattr(idx, 'video_id', idx.source_id)})"
            try:
                # Query retriever
                docs = idx.retriever.invoke(query)
                for doc in docs[:top_k_per_source]:
                    chunks_collected.append({
                        "source_title": src_title,
                        "source_id": idx.source_id,
                        "content": doc.page_content.strip(),
                    })
            except Exception as exc:
                logger.warning(f"Error retrieving from source {idx.source_id}: {exc}")

        if mode == "quick" and len(chunks_collected) > 2:
            chunks_collected = chunks_collected[:2]

        formatted_context = "\n\n".join(
            f"[Source: {c['source_title']}]\n{c['content']}" for c in chunks_collected
        )
        return formatted_context, chunks_collected

    async def execute_research(self, request: ResearchRequest) -> ResearchResponse:
        start_time = time.perf_counter()
        research_id = f"res_{uuid.uuid4().hex[:12]}"
        session_id = request.session_id or f"sess_{uuid.uuid4().hex[:10]}"
        mode = request.options.mode if request.options and request.options.mode else "standard"
        logger.info(f"Starting research {research_id} [Session: {session_id}] [Mode: {mode}] for query: '{request.query}'")

        sources_used: List[SourceInfo] = []
        target_indices: List[AnyIndexResult] = []

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
                    session_id=session_id,
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
                session_store.add_turn(session_id=session_id, query=request.query, report=response)
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
                    if s not in sources_used:
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
                snippets = [f"[Source: Web Search - {r.get('title')}]\nURL: {r.get('url')}\n{r.get('snippet')}" for r in web_search_results if r.get("snippet")]
                web_context = "\n\n".join(snippets)

        # 6. Retrieve Multi-Source Context across all target indices
        rag_context = ""
        if target_indices:
            rag_context, _ = self._retrieve_multi_source_context(
                query=request.query,
                indices=target_indices,
                mode=mode,
            )

        # Combine conversational memory, RAG context, and Web context
        history_context = session_store.format_history_for_prompt(session_id)

        combined_context_parts = []
        if rag_context:
            combined_context_parts.append(rag_context)
        if web_context:
            combined_context_parts.append(web_context)

        combined_context = "\n\n---\n\n".join(combined_context_parts)

        context_parts = []
        if history_context:
            context_parts.append(history_context)
        if combined_context.strip():
            context_parts.append(f"Context Sources:\n{combined_context}")

        context_section = "\n\n---\n\n".join(context_parts) if context_parts else "No external source context provided. Rely on foundational knowledge."

        # 7. Select Prompt and Temperature according to Mode
        if mode == "quick":
            selected_prompt = QUICK_PROMPT
            temperature = 0.1
            default_conclusion = ""
        elif mode == "deep":
            selected_prompt = DEEP_PROMPT
            temperature = 0.3
            default_conclusion = "Deep comparative research and cross-source analysis completed."
        else:  # standard
            selected_prompt = STANDARD_PROMPT
            temperature = 0.2
            default_conclusion = "Multi-source research synthesis completed with cited evidence."

        # 8. Execute LLM with model fallback
        raw_answer = None
        last_err = None
        for model_cand in FALLBACK_MODELS:
            try:
                cand_llm = youtube_rag_service.get_llm(model_name=model_cand, temperature=temperature)
                chain = selected_prompt | cand_llm | StrOutputParser()
                logger.info(f"Executing LLM synthesis [Mode: {mode}] with model: {model_cand}")
                raw_answer = chain.invoke({
                    "context_section": context_section,
                    "question": request.query,
                })
                break
            except Exception as exc:
                err_str = str(exc)
                if "model_not_found" in err_str or "does not exist" in err_str or "404" in err_str:
                    logger.warning(f"Model {model_cand} unavailable: {exc}. Trying fallback...")
                    last_err = exc
                    continue
                raise exc

        if not raw_answer:
            raise ModelProviderError(f"All attempted Groq models failed: {last_err}")

        # 9. Parse structured findings level-wise
        executive_summary, findings, analysis_points, conclusion = parse_report_sections(
            raw_answer=raw_answer,
            default_conclusion=default_conclusion,
            mode=mode,
        )

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        response = ResearchResponse(
            research_id=research_id,
            session_id=session_id,
            query=request.query,
            title=f"Research Report: {request.query[:60]}",
            executive_summary=executive_summary,
            key_findings=findings,
            analysis=analysis_points,
            conclusion=conclusion,
            sources=sources_used,
            mode=mode,
            latency_ms=elapsed_ms,
        )

        source_store.save_research(response)
        session_store.add_turn(session_id=session_id, query=request.query, report=response)
        logger.info(f"Completed research {research_id} in {elapsed_ms}ms [Mode: {mode}, Session: {session_id}]")
        return response

    async def execute_research_stream(
        self, request: ResearchRequest
    ) -> AsyncGenerator[str, None]:
        """Yields Server-Sent Events (SSE) tracking research mode, progressive thinking steps, and final report."""
        session_id = request.session_id or f"sess_{uuid.uuid4().hex[:10]}"
        request.session_id = session_id
        mode = request.options.mode if request.options and request.options.mode else "standard"

        # Step 1: Initial Status Event with session_id
        if mode == "quick":
            yield f"data: {json.dumps({'type': 'status', 'message': '⚡ Quick Mode: High-speed flash response...', 'session_id': session_id})}\n\n"
        elif mode == "deep":
            yield f"data: {json.dumps({'type': 'status', 'message': '🧠 Deep Research Mode: Initializing multi-perspective reasoning...', 'session_id': session_id})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'status', 'message': '📚 Standard Mode: Initializing multi-source investigation...', 'session_id': session_id})}\n\n"
        await asyncio.sleep(0.04)

        # Step 2: Tool Detection & Source Identification
        math_expr = extract_math_expression(request.query)
        if math_expr:
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': 'calculator', 'message': f'Evaluating mathematical calculation: {math_expr}'})}\n\n"
        elif request.options and request.options.web_search:
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': 'web_search', 'message': 'Searching live web for supplementary citations...'})}\n\n"

        if request.youtube_url or request.source_ids or source_store.list_sources():
            active_sources = source_store.list_sources()
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': 'multi_rag', 'message': f'Querying vector indices across {len(active_sources) or 1} active source(s)...'})}\n\n"

        await asyncio.sleep(0.04)

        # Step 3: Deep Mode Progressive Thinking Traces
        if mode == "deep":
            yield f"data: {json.dumps({'type': 'thinking', 'thought': 'Deconstructing research query and identifying core dimensions for comparative analysis...'})}\n\n"
            await asyncio.sleep(0.06)
            yield f"data: {json.dumps({'type': 'thinking', 'thought': 'Cross-referencing evidence across sources and identifying consensus vs divergent claims...'})}\n\n"
            await asyncio.sleep(0.06)
            yield f"data: {json.dumps({'type': 'thinking', 'thought': 'Evaluating underlying assumptions, trade-offs, and evidentiary boundaries...'})}\n\n"
            await asyncio.sleep(0.06)
            yield f"data: {json.dumps({'type': 'thinking', 'thought': 'Synthesizing comparative matrix and formulating strategic conclusions...'})}\n\n"
            await asyncio.sleep(0.04)

        try:
            report = await self.execute_research(request)
            for src in report.sources:
                yield f"data: {json.dumps({'type': 'source_found', 'source_id': src.source_id, 'url': src.url, 'title': src.title})}\n\n"

            # Step 4: Analysis Step
            if mode == "quick":
                yield f"data: {json.dumps({'type': 'analysis', 'message': 'Finalizing quick flash response...'})}\n\n"
            elif mode == "deep":
                yield f"data: {json.dumps({'type': 'analysis', 'message': 'Structuring comprehensive comparative report & findings...'})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'analysis', 'message': 'Synthesizing evidence and cross-source citations...'})}\n\n"
            await asyncio.sleep(0.04)

            # Step 5: Final Report Data & Done Event with session_id
            yield f"data: {json.dumps({'type': 'report', 'data': report.model_dump(), 'session_id': session_id})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'research_id': report.research_id, 'session_id': session_id})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"


research_service = ResearchService()
