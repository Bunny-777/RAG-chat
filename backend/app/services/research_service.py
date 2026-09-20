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
    template="""You are an ultra-fast, direct AI Assistant with live web search, academic papers, and multi-source context.
Answer the user's question directly, clearly, and concisely in 1 to 2 brief paragraphs or 3-4 succinct bullet points maximum.
If the question asks about prices, products, models, specifications, or real-time facts, state the exact numbers, models, and prices directly.
Always attribute where the information came from (e.g., "According to Apple (apple.com)..." or "Per [Website/Paper]...").
Do NOT output section headers like 'Executive Summary', 'Key Findings', or 'Conclusion'.
Deliver ONLY the bottom line and core answer immediately.

{context_section}

Question: {question}
Answer:""",
    input_variables=["context_section", "question"],
)

STANDARD_PROMPT = PromptTemplate(
    template="""You are an expert AI Research Analyst.
Answer the user's research question by synthesizing verified information from ALL available sources provided below (including live web search results, research papers, documents, and transcripts).
Compare and explicitly cite findings from the sources (e.g. refer to "[Source: <Website/Domain/Document/Paper>]").

Citation and Fact Guidelines:
- If the query asks for pricing, specs, or products, state exact prices, storage tiers, models, and numbers directly.
- For web search sources, cite the website name/domain (e.g. "[Source: Apple.com]", "[Source: Best Buy]", "[Source: Amazon]").
- For academic papers, cite the paper title, authors, or arXiv ID (e.g. "[Source: Paper - Attention Is All You Need (arXiv:1706.03762)]").
- For uploaded documents, cite the document name (e.g. "[Source: Document - report.pdf]").
- For YouTube videos, cite the video title.
- Highlight consensus, differences, and specific facts extracted across the sources.

Structure your answer with:
### Executive Summary
A concise overview directly answering the query with key numbers, prices, or takeaways based on the sources.

### Key Findings
- Key point 1 with specific facts and explicit source reference
- Key point 2 with specific facts and explicit source reference
- Key point 3 with specific facts and explicit source reference

### Detailed Analysis
In-depth synthesized explanation across all sources with concrete data, pricing, or methodology breakdown.

### Conclusion
Final synthesis and concluding remarks.

{context_section}

Question: {question}
Answer:""",
    input_variables=["context_section", "question"],
)

DEEP_PROMPT = PromptTemplate(
    template="""You are a Principal AI Research Scientist performing an exhaustive, deep comparative research investigation.
Perform a rigorous, multi-perspective, comparative analysis of the question using the available context (web intelligence, academic papers, documents, and transcripts).

You must:
1. Deep Comparative Analysis: Rigorously compare and contrast viewpoints, pricing/spec tiers, methodologies, and claims across different sources or analytical angles.
2. Explicit Source Attribution: Explicitly state the source for every data point, price, or finding:
   - For web data: name the website and domain (e.g. "[Source: Apple (apple.com)]", "[Source: GSM Arena]").
   - For research papers: cite paper title, primary authors, and arXiv ID (e.g. "[Source: Paper - Attention Is All You Need, Vaswani et al.]").
   - For uploaded documents: cite the document filename.
3. Nuances & Trade-offs: Identify underlying assumptions, critical nuances, trade-offs, and evidence discrepancies.
4. Actionable Strategic Synthesis: Provide strategic conclusions, recommendations, and implications.

Structure your response with the following markdown headers:
### Executive Summary
Detailed executive summary framing the problem, core findings, key numbers/prices, and overarching thesis.

### Comparative Analysis & Multi-Source Perspectives
In-depth comparison of perspectives, contrasting viewpoints, price tiers, or source arguments with explicit citations.

### Key Research Findings & Evidence Evaluation
- Finding 1: Detailed analysis with evidence evaluation and source citation
- Finding 2: Detailed analysis with evidence evaluation and source citation
- Finding 3: Detailed analysis with evidence evaluation and source citation

### Trade-Offs, Discrepancies & Limitations
Critical discussion of edge cases, trade-offs, price-to-performance, evidentiary gaps, and caveats.

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
            source_store.add_youtube_source(index_res)
            target_indices.append(index_res)

        # 3. Handle source_ids strictly:
        # If user explicitly passed an empty list [], do NOT load any old uploaded documents.
        # If user passed specific IDs, load only those IDs.
        # If source_ids is None and no direct YouTube URL is given, only fallback to indexed sources
        # if web search is not explicitly forced.
        if request.source_ids is not None:
            for sid in request.source_ids:
                idx = source_store.get_source_index(sid)
                if idx:
                    target_indices.append(idx)
                else:
                    logger.warning(f"Source ID '{sid}' not found in store.")
        elif not request.youtube_url and not (request.options and request.options.web_search):
            all_sources = source_store.list_sources()
            for s in all_sources:
                idx = source_store.get_source_index(s.source_id)
                if idx:
                    target_indices.append(idx)

        # 4. Retrieve Multi-Source Context across active target indices
        rag_context = ""
        if target_indices:
            rag_context, chunks_collected = self._retrieve_multi_source_context(
                query=request.query,
                indices=target_indices,
                mode=mode,
            )
            # Strictly add ONLY sources whose chunks were actually matched and retrieved!
            used_sids = {c["source_id"] for c in chunks_collected}
            for sid in used_sids:
                info = source_store.get_source_info(sid)
                if info and info not in sources_used:
                    sources_used.append(info)

        # 5. Determine whether Web Search Tool should run:
        # Runs if explicitly enabled (options.web_search=True) OR if the query is an open real-world/pricing/academic question without document indices
        should_web_search = bool(request.options and request.options.web_search)
        if not should_web_search and not target_indices and not request.youtube_url:
            query_lower = request.query.lower()
            intent_keywords = [
                "search internet", "search web", "google", "online", "search the web",
                "price of", "cost of", "how much is", "how much does", "specs of",
                "latest", "release date", "research paper", "paper", "arxiv",
            ]
            if any(k in query_lower for k in intent_keywords):
                should_web_search = True

        web_search_results = []
        web_context = ""
        if should_web_search:
            logger.info(f"Executing Web & Paper Search Tool for query: '{request.query}'")
            search_out = web_search(request.query)
            web_search_results = search_out.get("results", [])
            for r in web_search_results:
                src_type = r.get("source_type", "web")
                domain = r.get("domain") or ("arxiv.org" if src_type == "research_paper" else "web")
                meta = r.get("metadata", {})
                meta["domain"] = domain
                meta["snippet"] = r.get("snippet", "")
                sources_used.append(
                    SourceInfo(
                        source_id=f"{src_type}_{uuid.uuid4().hex[:6]}",
                        source_type=src_type,
                        url=r.get("url"),
                        title=r.get("title") or ("Research Paper" if src_type == "research_paper" else "Web Source"),
                        language="en",
                        chunk_count=1,
                        metadata=meta,
                    )
                )
            if web_search_results:
                snippets = []
                for r in web_search_results:
                    stype = "Academic Research Paper" if r.get("source_type") == "research_paper" else "Live Web Source"
                    domain = r.get("domain", "web")
                    snippets.append(
                        f"[Source: {stype} - {r.get('title')} ({domain})]\n"
                        f"URL: {r.get('url')}\n"
                        f"Information: {r.get('snippet')}"
                    )
                web_context = "\n\n".join(snippets)

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

        has_explicit_docs = bool(request.source_ids or request.youtube_url)
        has_fallback_docs = request.source_ids is None and bool(source_store.list_sources()) and not (request.options and request.options.web_search)
        has_active_docs = has_explicit_docs or has_fallback_docs

        should_search_web = bool(request.options and request.options.web_search) or not has_active_docs
        if should_search_web:
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': 'web_search', 'message': f'Searching live web and academic sources for: {request.query[:50]}...'})}\n\n"

        if has_active_docs:
            count = len(request.source_ids) if request.source_ids is not None else len(source_store.list_sources())
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': 'multi_rag', 'message': f'Querying vector indices across {count or 1} selected document source(s)...'})}\n\n"

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
