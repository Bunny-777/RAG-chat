import re
from typing import Dict, Any, List, Optional
from backend.app.tools.calculator import extract_math_expression
from backend.app.core.logging import get_logger

logger = get_logger(__name__)

# Patterns for YouTube URLs
YOUTUBE_REGEX = re.compile(
    r"(?:https?://)?(?:www\.)?(?:youtube\.com/(?:watch\?v=|embed/|v/|shorts/)|youtu\.be/)([a-zA-Z0-9_-]{11})",
    re.IGNORECASE,
)

# Patterns for general HTTP/HTTPS URLs (excluding youtube)
GENERIC_URL_REGEX = re.compile(
    r"https?://(?!www\.youtube\.com|youtube\.com|youtu\.be)[^\s<>\"]+",
    re.IGNORECASE,
)

DATETIME_KEYWORDS = {
    "what time is it", "current time", "what date is today", "what is today's date",
    "today's date", "what day is today", "what day is it", "current year",
    "what month is it", "is it leap year", "time in utc", "current date",
    "today date", "current day", "tomorrow's date", "yesterday's date",
}

SEARCH_KEYWORDS = {
    "latest", "news", "price", "cost", "current", "recent", "who won", "score",
    "specs", "stock", "market", "weather", "today", "yesterday", "2024", "2025",
    "2026", "release date", "election", "update", "newest", "trending", "leak",
    "announced", "launch", "rumors", "ceo of", "founder of",
}

ENCYCLOPEDIC_KEYWORDS = {
    "who was", "history of", "biography of", "origin of", "what is the capital of",
    "define", "meaning of", "discovery of", "invented", "invention of",
    "wikipedia", "overview of",
}

CODE_EXEC_KEYWORDS = [
    r"run (?:this|the) (?:code|python|script)",
    r"execute (?:this|the) (?:code|python|script)",
    r"```(?:python)?\s*[\s\S]+?```",
    r"calculate using python",
    r"write and run (?:a )?python",
]


def classify_request(
    query: str,
    source_ids: Optional[List[str]] = None,
    youtube_url: Optional[str] = None,
    web_search_forced: bool = False,
    has_attachments: bool = False,
    **kwargs: Any,
) -> Dict[str, Any]:
    """
    Intelligent Request Classifier:
    Analyzes the user request to determine whether it should be resolved using:
    - AI Tools (Calculator, Code Interpreter, Datetime, YouTube Transcriber, URL Reader, Document RAG)
    - Web Search (Google / Serper / DuckDuckGo)
    - Direct LLM Reasoning

    Returns a structured classification dict with prioritized tools to execute.
    """
    query_clean = query.strip()
    query_lower = query_clean.lower()

    tools_to_run: List[str] = []
    reasoning_steps: List[str] = []

    # 1. Detect YouTube links (in query or explicit parameter)
    yt_matches = YOUTUBE_REGEX.findall(query_clean)
    all_yt_urls = []
    if youtube_url:
        all_yt_urls.append(youtube_url)
    for vid in yt_matches:
        full_url = f"https://www.youtube.com/watch?v={vid}"
        if full_url not in all_yt_urls:
            all_yt_urls.append(full_url)

    if all_yt_urls:
        tools_to_run.append("youtube")
        reasoning_steps.append(f"YouTube video link detected ({len(all_yt_urls)} url(s)); will extract transcript.")

    # 2. Detect Generic Web URLs in query
    direct_urls = GENERIC_URL_REGEX.findall(query_clean)
    if direct_urls:
        tools_to_run.append("url_reader")
        reasoning_steps.append(f"Direct web URL detected ({direct_urls[0][:40]}...); will fetch page text.")

    # 3. Detect Document RAG need (if source_ids provided or attached files exist)
    if (source_ids and len(source_ids) > 0) or has_attachments:
        tools_to_run.append("rag_search")
        reasoning_steps.append(f"Document attachment(s) present; querying vector indices.")

    # 4. Detect Datetime / Clock / Calendar questions
    if any(k in query_lower for k in DATETIME_KEYWORDS):
        tools_to_run.append("datetime")
        reasoning_steps.append("Real-time temporal query detected; fetching accurate local and UTC datetime.")

    # 5. Detect Math / Arithmetic / Formulas
    math_expr = extract_math_expression(query_clean)
    if math_expr and len(math_expr) > 2 and any(op in math_expr for op in ["+", "-", "*", "/", "^", "%", "sqrt"]):
        tools_to_run.append("calculator")
        reasoning_steps.append(f"Mathematical calculation detected: '{math_expr}'; executing safe AST calculator.")

    # 6. Detect Python code execution request
    is_code_exec = any(re.search(pat, query_clean, re.IGNORECASE) for pat in CODE_EXEC_KEYWORDS)
    extracted_code = None
    code_match = re.search(r"```(?:python)?\s*([\s\S]+?)```", query_clean)
    if code_match:
        extracted_code = code_match.group(1).strip()
    if is_code_exec and extracted_code:
        tools_to_run.append("code_interpreter")
        reasoning_steps.append("Python code snippet detected for sandboxed execution.")

    # 7. Detect Web Search Intent (real-time facts, current news, latest prices, or forced)
    needs_search = web_search_forced
    if not needs_search:
        search_match = any(k in query_lower for k in SEARCH_KEYWORDS)
        if search_match:
            needs_search = True

    if needs_search and "web_search" not in tools_to_run:
        tools_to_run.append("web_search")
        reasoning_steps.append("Real-time web search classified for up-to-date facts and verified citations.")

    # 8. Detect Encyclopedic / Wikipedia query
    if any(k in query_lower for k in ENCYCLOPEDIC_KEYWORDS) and "web_search" not in tools_to_run:
        tools_to_run.append("wikipedia")
        reasoning_steps.append("Encyclopedic lookup classified for historical/definition context.")

    # 9. If no specific external tool needed, direct LLM reasoning
    if not tools_to_run:
        tools_to_run.append("direct_llm")
        reasoning_steps.append("General conceptual/creative query; resolving directly with foundational LLM intelligence.")

    primary_intent = tools_to_run[0] if tools_to_run else "direct_llm"
    classification_summary = "; ".join(reasoning_steps)
    logger.info(f"Classified query '{query_clean[:40]}...': Primary={primary_intent}, Tools={tools_to_run}")

    return {
        "primary_intent": primary_intent,
        "tools": tools_to_run,
        "tools_to_run": tools_to_run,
        "confidence": 0.95,
        "reasoning": classification_summary,
        "extracted": {
            "math_expression": math_expr,
            "youtube_urls": all_yt_urls,
            "direct_urls": direct_urls,
            "code_snippet": extracted_code,
        },
        "extracted_youtube_urls": all_yt_urls,
        "extracted_web_urls": direct_urls,
        "extracted_math": math_expr,
        "extracted_code": extracted_code,
        "requires_web": "web_search" in tools_to_run,
    }
