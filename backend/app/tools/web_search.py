import re
import urllib.parse
from typing import Dict, Any, List, Optional
import xml.etree.ElementTree as ET
import requests
import certifi
import lxml.html

from backend.app.core.logging import get_logger

logger = get_logger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

RESEARCH_PAPER_KEYWORDS = {
    "paper", "arxiv", "research", "study", "survey", "conference",
    "journal", "proceedings", "benchmark", "ablation", "dataset",
}


def _clean_url(raw_url: str) -> str:
    """Decodes DuckDuckGo redirect URLs (uddg parameter) to obtain direct destination URLs."""
    if not raw_url:
        return ""
    try:
        parsed = urllib.parse.urlparse(raw_url)
        if "duckduckgo.com" in parsed.netloc:
            qs = urllib.parse.parse_qs(parsed.query)
            if "uddg" in qs:
                return qs["uddg"][0]
        return raw_url
    except Exception:
        return raw_url


def _search_ddg_lite(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """Fetches organic live web search results from DuckDuckGo Lite."""
    results: List[Dict[str, Any]] = []
    try:
        url = "https://lite.duckduckgo.com/lite/"
        resp = requests.post(
            url,
            data={"q": query},
            headers=HEADERS,
            verify=certifi.where(),
            timeout=8,
        )
        if resp.status_code == 200 and resp.text:
            tree = lxml.html.fromstring(resp.text)
            links = tree.xpath("//a[@class='result-link']")
            snippets = tree.xpath("//td[@class='result-snippet']")

            for link, snip in zip(links, snippets):
                raw_href = link.get("href", "").strip()
                clean_link = _clean_url(raw_href)
                title = link.text_content().strip()
                snippet = snip.text_content().strip()

                if not clean_link or not title:
                    continue
                # Skip sponsored ads or internal duckduckgo links
                if "duckduckgo.com" in clean_link or title.lower() in ["more info", "ad", "sponsored"]:
                    continue

                domain = urllib.parse.urlparse(clean_link).netloc.replace("www.", "")
                results.append({
                    "title": title,
                    "url": clean_link,
                    "domain": domain,
                    "snippet": snippet,
                    "source_type": "web",
                })
                if len(results) >= max_results:
                    break
    except Exception as exc:
        logger.warning(f"DuckDuckGo Lite search error for query '{query}': {exc}")

    return results


def _search_arxiv(query: str, max_results: int = 3) -> List[Dict[str, Any]]:
    """Fetches academic research papers matching the query from the official ArXiv API."""
    results: List[Dict[str, Any]] = []
    try:
        clean_q = re.sub(r"[^a-zA-Z0-9\s]", " ", query).strip()
        encoded = urllib.parse.quote(clean_q)
        api_url = f"https://export.arxiv.org/api/query?search_query=all:{encoded}&max_results={max_results}&sortBy=relevance"

        resp = requests.get(
            api_url,
            headers=HEADERS,
            verify=certifi.where(),
            timeout=8,
        )
        if resp.status_code == 200 and resp.text:
            tree = ET.fromstring(resp.text)
            ns = {"atom": "http://www.w3.org/2005/Atom"}
            for entry in tree.findall("atom:entry", ns):
                title_elem = entry.find("atom:title", ns)
                id_elem = entry.find("atom:id", ns)
                summary_elem = entry.find("atom:summary", ns)
                published_elem = entry.find("atom:published", ns)

                title = title_elem.text.strip().replace("\n", " ") if title_elem is not None and title_elem.text else "Research Paper"
                paper_url = id_elem.text.strip() if id_elem is not None and id_elem.text else ""
                summary = summary_elem.text.strip().replace("\n", " ") if summary_elem is not None and summary_elem.text else ""
                published = published_elem.text[:4] if published_elem is not None and published_elem.text else ""

                authors = [a.find("atom:name", ns).text for a in entry.findall("atom:author", ns) if a.find("atom:name", ns) is not None]
                author_str = ", ".join(authors[:2]) + (" et al." if len(authors) > 2 else "") if authors else "Researchers"

                # Keep snippet compact
                snippet_text = f"Authors: {author_str} ({published}). {summary[:300]}..."

                results.append({
                    "title": f"{title} ({author_str}, {published})",
                    "url": paper_url,
                    "domain": "arxiv.org",
                    "snippet": snippet_text,
                    "source_type": "research_paper",
                    "metadata": {
                        "authors": authors,
                        "published_year": published,
                        "arxiv_id": paper_url.split("/")[-1] if paper_url else "",
                    },
                })
    except Exception as exc:
        logger.warning(f"ArXiv research paper search failed: {exc}")

    return results


def _search_wikipedia(query: str, max_results: int = 2) -> List[Dict[str, Any]]:
    """Fetches encyclopedic context from Wikipedia API as a reliable knowledge fallback."""
    results: List[Dict[str, Any]] = []
    try:
        encoded = urllib.parse.quote(query)
        api_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={encoded}&format=json&srlimit={max_results}&utf8="
        resp = requests.get(api_url, headers=HEADERS, verify=certifi.where(), timeout=6)
        if resp.status_code == 200:
            data = resp.json()
            search_items = data.get("query", {}).get("search", [])
            for item in search_items:
                page_title = item.get("title", "")
                raw_snippet = item.get("snippet", "")
                clean_snippet = re.sub(r"<[^>]+>", "", raw_snippet)
                wiki_url = f"https://en.wikipedia.org/wiki/{urllib.parse.quote(page_title.replace(' ', '_'))}"
                results.append({
                    "title": f"{page_title} - Wikipedia",
                    "url": wiki_url,
                    "domain": "wikipedia.org",
                    "snippet": clean_snippet,
                    "source_type": "wikipedia",
                })
    except Exception as exc:
        logger.warning(f"Wikipedia search fallback failed: {exc}")

    return results


def web_search(query: str, max_results: int = 5) -> Dict[str, Any]:
    """
    Executes live multi-engine search across organic web (DuckDuckGo Lite),
    academic research papers (ArXiv API), and encyclopedic sources (Wikipedia).
    Returns structured citations with direct URLs, domain names, and source types.
    """
    logger.info(f"Executing web and intelligence search for query: '{query}'")
    all_results: List[Dict[str, Any]] = []
    seen_urls = set()

    # 1. Organic Web Search (commercial pricing, news, official vendor sites)
    web_res = _search_ddg_lite(query, max_results=max_results)
    for r in web_res:
        if r["url"] not in seen_urls:
            seen_urls.add(r["url"])
            all_results.append(r)

    # 2. Check if user asked about research papers or academic studies
    query_lower = query.lower()
    is_academic_query = any(k in query_lower for k in RESEARCH_PAPER_KEYWORDS)

    if is_academic_query:
        paper_res = _search_arxiv(query, max_results=3)
        for r in paper_res:
            if r["url"] not in seen_urls:
                seen_urls.add(r["url"])
                all_results.append(r)

    # 3. If web search yielded low results, supplement with Wikipedia
    if len(all_results) < 2:
        wiki_res = _search_wikipedia(query, max_results=2)
        for r in wiki_res:
            if r["url"] not in seen_urls:
                seen_urls.add(r["url"])
                all_results.append(r)

    logger.info(f"Search completed: found {len(all_results)} verified web/paper sources.")
    return {
        "tool": "web_search",
        "query": query,
        "results_count": len(all_results),
        "results": all_results[:max_results + (3 if is_academic_query else 0)],
    }

