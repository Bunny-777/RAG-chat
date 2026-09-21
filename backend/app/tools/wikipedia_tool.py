import re
import urllib.parse
from typing import Dict, Any, List
import requests
import certifi
from backend.app.core.logging import get_logger

logger = get_logger(__name__)

HEADERS = {
    "User-Agent": "AIResearchAnalyst/1.0 (https://github.com/Bunny-777/RAG-chat)",
}


def search_wikipedia_encyclopedia(query: str, max_results: int = 3) -> Dict[str, Any]:
    """
    Wikipedia Tool: Fetches authoritative encyclopedic summaries, background context,
    historical overviews, and definitions from Wikipedia.
    """
    clean_q = re.sub(r"[^a-zA-Z0-9\s]", " ", query).strip()
    logger.info(f"Searching Wikipedia for: '{clean_q}'")
    articles: List[Dict[str, Any]] = []

    try:
        encoded = urllib.parse.quote(clean_q)
        search_url = (
            f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={encoded}"
            f"&format=json&srlimit={max_results}&utf8="
        )
        resp = requests.get(search_url, headers=HEADERS, verify=certifi.where(), timeout=6)
        if resp.status_code == 200:
            data = resp.json()
            search_items = data.get("query", {}).get("search", [])

            for item in search_items:
                title = item.get("title", "")
                page_id = item.get("pageid")
                raw_snippet = item.get("snippet", "")
                clean_snippet = re.sub(r"<[^>]+>", "", raw_snippet)
                wiki_url = f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}"

                # Fetch full intro extract if available
                extract = clean_snippet
                try:
                    summary_url = (
                        f"https://en.wikipedia.org/w/api.php?action=query&prop=extracts"
                        f"&exintro=true&explaintext=true&titles={urllib.parse.quote(title)}&format=json"
                    )
                    sum_resp = requests.get(summary_url, headers=HEADERS, verify=certifi.where(), timeout=4)
                    if sum_resp.status_code == 200:
                        pages = sum_resp.json().get("query", {}).get("pages", {})
                        for _, pdata in pages.items():
                            ext = pdata.get("extract")
                            if ext:
                                extract = ext[:600]
                                break
                except Exception:
                    pass

                articles.append({
                    "title": title,
                    "url": wiki_url,
                    "domain": "en.wikipedia.org",
                    "snippet": extract,
                    "source_type": "wikipedia",
                })
    except Exception as exc:
        logger.warning(f"Wikipedia search tool error: {exc}")

    return {
        "tool": "wikipedia",
        "query": query,
        "results_count": len(articles),
        "articles": articles,
    }
