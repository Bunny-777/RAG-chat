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
from backend.app.tools.datetime_tool import get_current_datetime_info
from backend.app.tools.code_interpreter import execute_python_code
from backend.app.tools.wikipedia_tool import search_wikipedia_encyclopedia
from backend.app.tools.url_reader import read_url_content
from backend.app.tools.classifier import classify_request

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
        tool_contexts: List[str] = []

        # 1. Intelligent Request Classification
        has_attachments = bool(request.source_ids or request.youtube_url)
        classification = classify_request(
            query=request.query,
            source_ids=request.source_ids,
            youtube_url=request.youtube_url,
            web_search_forced=bool(request.options and request.options.web_search),
            has_attachments=has_attachments,
        )
        tools = classification.get("tools", [])
        primary_intent = classification.get("primary_intent", "direct_llm")
        extracted = classification.get("extracted", {})
        logger.info(f"Request classification: intent={primary_intent}, tools={tools}, confidence={classification.get('confidence')}")

        # 2. Standalone Mathematical Calculation (Deterministic, no LLM hallucination)
        math_expr = extracted.get("math_expression") or extract_math_expression(request.query)
        if math_expr and ("calculator" in tools or primary_intent == "calculator"):
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
                    classification=classification,
                )
                source_store.save_research(response)
                session_store.add_turn(session_id=session_id, query=request.query, report=response)
                return response
            elif "calculator" in tools:
                # Add calculation attempt to tool context if part of broader query
                tool_contexts.append(f"[Source: Calculator Tool]\nAttempted expression: {math_expr}\nResult: {calc_result.get('formatted', '')}")

        # 3. Auto-detect and ingest YouTube URLs (from prompt or explicit parameter)
        yt_urls = extracted.get("youtube_urls", [])
        active_yt_url = request.youtube_url or (yt_urls[0] if yt_urls else None)
        if active_yt_url:
            logger.info(f"Ingesting YouTube URL: {active_yt_url}")
            try:
                index_res = youtube_rag_service.ingest_and_index_video(
                    url=active_yt_url,
                    manual_transcript=request.manual_transcript,
                )
                source_store.add_youtube_source(index_res)
                target_indices.append(index_res)
            except Exception as yt_exc:
                logger.warning(f"Error auto-ingesting YouTube URL {active_yt_url}: {yt_exc}")

        # 4. Direct URL Reader Tool (if user pasted direct web links)
        if "url_reader" in tools and extracted.get("direct_urls"):
            for durl in extracted["direct_urls"][:2]:
                try:
                    logger.info(f"Fetching direct URL content: {durl}")
                    page_data = read_url_content(durl)
                    if page_data.get("success"):
                        content_snip = page_data.get("content", "")[:3000]
                        tool_contexts.append(
                            f"[Source: Direct Web Link - {page_data.get('title', 'Webpage')} ({durl})]\n"
                            f"URL: {durl}\n"
                            f"Content: {content_snip}"
                        )
                        sources_used.append(
                            SourceInfo(
                                source_id=f"url_{uuid.uuid4().hex[:6]}",
                                source_type="web",
                                url=durl,
                                title=page_data.get("title") or "Web Page",
                                metadata={"snippet": content_snip[:200]},
                            )
                        )
                except Exception as url_exc:
                    logger.warning(f"Failed to read direct URL {durl}: {url_exc}")

        # 5. Real-Time Date and Time Tool
        if "datetime" in tools:
            try:
                dt_info = get_current_datetime_info()
                logger.info(f"Gathered real-time datetime: {dt_info['human']}")
                tool_contexts.append(
                    f"[Source: System Real-Time Clock]\n"
                    f"Current Date & Time: {dt_info['human']}\n"
                    f"ISO Format: {dt_info['local_iso']}\n"
                    f"UTC Timestamp: {dt_info['utc_iso']}\n"
                    f"Timezone: {dt_info['timezone']}"
                )
                sources_used.append(
                    SourceInfo(
                        source_id="tool_datetime",
                        source_type="tool",
                        title="System Real-Time Clock",
                        metadata={"info": dt_info["human"], "tool": "datetime"},
                    )
                )
            except Exception as dt_exc:
                logger.warning(f"Error getting datetime info: {dt_exc}")

        # 6. Python Code Interpreter Tool (Sandboxed execution)
        if "code_interpreter" in tools:
            code_to_exec = extracted.get("code_snippet")
            if not code_to_exec:
                code_match = re.search(r"```(?:python)?\s*(.*?)\s*```", request.query, re.DOTALL)
                if code_match:
                    code_to_exec = code_match.group(1).strip()
            if code_to_exec:
                try:
                    logger.info(f"Executing sandboxed Python snippet: {code_to_exec[:80]}...")
                    exec_res = execute_python_code(code_to_exec)
                    out_text = exec_res.get("output", "") or "(No printed output)"
                    status_str = "Success" if exec_res.get("success") else f"Failed ({exec_res.get('error')})"
                    tool_contexts.append(
                        f"[Source: Python Code Sandbox Execution]\n"
                        f"Execution Status: {status_str}\n"
                        f"Code:\n```python\n{code_to_exec}\n```\n"
                        f"Output:\n```\n{out_text}\n```"
                    )
                    sources_used.append(
                        SourceInfo(
                            source_id="tool_python",
                            source_type="tool",
                            title="Python Sandbox Execution",
                            metadata={"code": code_to_exec[:120], "output": out_text[:200]},
                        )
                    )
                except Exception as py_exc:
                    logger.warning(f"Error in code interpreter tool: {py_exc}")

        # 7. Wikipedia Encyclopedia Search Tool
        if "wikipedia" in tools:
            try:
                wiki_res = search_wikipedia_encyclopedia(request.query)
                if wiki_res.get("found"):
                    logger.info(f"Wikipedia entry found: {wiki_res['title']}")
                    tool_contexts.append(
                        f"[Source: Wikipedia Encyclopedia - {wiki_res['title']}]\n"
                        f"Article URL: {wiki_res.get('url')}\n"
                        f"Summary: {wiki_res.get('extract')}"
                    )
                    sources_used.append(
                        SourceInfo(
                            source_id=f"wiki_{uuid.uuid4().hex[:6]}",
                            source_type="wikipedia",
                            url=wiki_res.get("url"),
                            title=f"Wikipedia: {wiki_res['title']}",
                            metadata={"snippet": wiki_res.get("extract", "")[:200]},
                        )
                    )
            except Exception as wiki_exc:
                logger.warning(f"Error executing Wikipedia tool: {wiki_exc}")

        # 8. Handle document source_ids strictly
        if request.source_ids is not None:
            for sid in request.source_ids:
                idx = source_store.get_source_index(sid)
                if idx:
                    target_indices.append(idx)
                else:
                    logger.warning(f"Source ID '{sid}' not found in store.")
        elif not active_yt_url and not (request.options and request.options.web_search):
            all_sources = source_store.list_sources()
            for s in all_sources:
                idx = source_store.get_source_index(s.source_id)
                if idx:
                    target_indices.append(idx)

        # 9. Retrieve Multi-Source RAG Context across target indices
        rag_context = ""
        if target_indices:
            rag_context, chunks_collected = self._retrieve_multi_source_context(
                query=request.query,
                indices=target_indices,
                mode=mode,
            )
            used_sids = {c["source_id"] for c in chunks_collected}
            for sid in used_sids:
                info = source_store.get_source_info(sid)
                if info and info not in sources_used:
                    sources_used.append(info)

        # 10. Web & Academic Paper Search Tool
        # Runs if: explicitly requested OR classified as "web_search"
        should_web_search = bool(request.options and request.options.web_search) or ("web_search" in tools)

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

        # 11. Combine Conversational Memory, Tool Contexts, RAG Context, and Web Search Context
        history_context = session_store.format_history_for_prompt(session_id)

        combined_context_parts = []
        if tool_contexts:
            combined_context_parts.append("\n\n".join(tool_contexts))
        if rag_context:
            combined_context_parts.append(rag_context)
        if web_context:
            combined_context_parts.append(web_context)

        combined_context = "\n\n---\n\n".join(combined_context_parts)

        context_parts = []
        if history_context:
            context_parts.append(history_context)
        if combined_context.strip():
            context_parts.append(f"Verified Evidence & Sources:\n{combined_context}")

        context_section = "\n\n---\n\n".join(context_parts) if context_parts else "No external source context provided. Rely on foundational knowledge."

        # 12. Select Prompt and Temperature according to Mode
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

        # 13. Execute LLM with model fallback
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

        # 14. Parse structured findings level-wise
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
            classification=classification,
        )

        source_store.save_research(response)
        session_store.add_turn(session_id=session_id, query=request.query, report=response)
        logger.info(f"Completed research {research_id} in {elapsed_ms}ms [Mode: {mode}, Session: {session_id}]")
        return response

    async def execute_research_stream(
        self, request: ResearchRequest
    ) -> AsyncGenerator[str, None]:
        """Yields Server-Sent Events (SSE) tracking request classification, active tools, progressive thinking steps, and final report."""
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

        # Step 2: Query Classification & Tool Routing
        has_attachments = bool(request.source_ids or request.youtube_url)
        classification = classify_request(
            query=request.query,
            source_ids=request.source_ids,
            youtube_url=request.youtube_url,
            web_search_forced=bool(request.options and request.options.web_search),
            has_attachments=has_attachments,
        )
        tools = classification.get("tools", [])
        primary_intent = classification.get("primary_intent", "direct_llm")
        reasoning = classification.get("reasoning", "")

        intent_display = primary_intent.replace("_", " ").title()
        yield f"data: {json.dumps({'type': 'status', 'message': f'🎯 Classified Intent: {intent_display} ({reasoning})', 'session_id': session_id})}\n\n"
        await asyncio.sleep(0.03)

        # Step 3: Announce classified tools
        tool_descriptions = {
            "calculator": "Evaluating mathematical calculation deterministically",
            "datetime": "Accessing system real-time clock & calendar",
            "code_interpreter": "Preparing sandboxed Python code execution environment",
            "wikipedia": "Querying Wikipedia encyclopedic knowledge base",
            "url_reader": "Extracting web page content from direct URL link",
            "youtube": "Transcribing and indexing YouTube video audio",
            "web_search": "Querying live web & academic search indexes",
            "rag_search": "Retrieving context across attached document indices",
        }

        for tool_name in tools:
            desc = tool_descriptions.get(tool_name, f"Executing tool: {tool_name}")
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': tool_name, 'message': desc})}\n\n"
            await asyncio.sleep(0.02)

        # Step 4: Deep Mode Progressive Thinking Traces
        if mode == "deep":
            yield f"data: {json.dumps({'type': 'thinking', 'thought': 'Deconstructing research query and identifying core analytical dimensions...'})}\n\n"
            await asyncio.sleep(0.05)
            yield f"data: {json.dumps({'type': 'thinking', 'thought': 'Cross-referencing evidence across sources and identifying consensus vs divergent claims...'})}\n\n"
            await asyncio.sleep(0.05)
            yield f"data: {json.dumps({'type': 'thinking', 'thought': 'Synthesizing comparative matrix and formulating strategic conclusions...'})}\n\n"
            await asyncio.sleep(0.04)

        try:
            report = await self.execute_research(request)
            for src in report.sources:
                yield f"data: {json.dumps({'type': 'source_found', 'source_id': src.source_id, 'url': src.url, 'title': src.title})}\n\n"

            # Step 5: Analysis Step
            if mode == "quick":
                yield f"data: {json.dumps({'type': 'analysis', 'message': 'Finalizing quick response...'})}\n\n"
            elif mode == "deep":
                yield f"data: {json.dumps({'type': 'analysis', 'message': 'Structuring comprehensive comparative report & findings...'})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'analysis', 'message': 'Synthesizing evidence and cross-source citations...'})}\n\n"
            await asyncio.sleep(0.04)

            # Step 6: Final Report Data & Done Event with session_id
            yield f"data: {json.dumps({'type': 'report', 'data': report.model_dump(), 'session_id': session_id})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'research_id': report.research_id, 'session_id': session_id})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"


research_service = ResearchService()

