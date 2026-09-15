import json
import urllib.parse
from typing import Dict, Any, List
import requests

from backend.app.core.logging import get_logger

logger = get_logger(__name__)


def web_search(query: str, max_results: int = 5) -> Dict[str, Any]:
    """
    Performs a web search using DuckDuckGo Instant Answer / HTML search.
    Returns structured results with title, URL, snippet, and source.
    """
    logger.info(f"Executing web search for query: '{query}'")
    results: List[Dict[str, str]] = []

    try:
        # 1. DuckDuckGo Instant Answer API
        encoded_query = urllib.parse.quote(query)
        api_url = f"https://api.duckduckgo.com/?q={encoded_query}&format=json&no_html=1&skip_disambig=1"
        resp = requests.get(api_url, timeout=5, headers={"User-Agent": "AIResearchAnalyst/1.0"})
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("AbstractText")
            source_url = data.get("AbstractURL")
            heading = data.get("Heading")
            if abstract:
                results.append({
                    "title": heading or query,
                    "url": source_url or "https://duckduckgo.com",
                    "snippet": abstract,
                    "source": "duckduckgo_instant_answer",
                })

            for topic in data.get("RelatedTopics", [])[:max_results]:
                if isinstance(topic, dict) and "Text" in topic:
                    results.append({
                        "title": topic.get("Text", "")[:60],
                        "url": topic.get("FirstURL", ""),
                        "snippet": topic.get("Text", ""),
                        "source": "duckduckgo_related",
                    })

    except Exception as exc:
        logger.warning(f"DuckDuckGo API search failed: {exc}")

    return {
        "tool": "web_search",
        "query": query,
        "results_count": len(results),
        "results": results,
    }
