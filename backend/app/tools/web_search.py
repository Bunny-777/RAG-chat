import os
import re
import urllib.parse
from typing import Dict, Any, List, Optional
import xml.etree.ElementTree as ET
import requests
import certifi
import lxml.html
from dotenv import load_dotenv

from backend.app.core.logging import get_logger

load_dotenv()
logger = get_logger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

RESEARCH_PAPER_KEYWORDS = {
    "paper", "arxiv", "research", "study", "survey", "conference",
    "journal", "proceedings", "benchmark", "ablation", "dataset",
}


def clean_search_query(query: str) -> str:
    """Strips conversational prefixes, filler phrases, and punctuation to optimize search keyword match."""
    cleaned = query.strip()
    patterns = [
        r"^(?:can you|could you|please)?\s*(?:tell me|tell us|find|search(?: for)?|google|show me|look up)\s+(?:what is|what are|who is|who are|how much is|how much does|about)?\s*",
        r"^(?:what is|what are|who is|who are|how much is|how much does)\s+(?:the\s+)?",
    ]
    for p in patterns:
        cleaned = re.sub(p, "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"[\?\.\!]+$", "", cleaned).strip()
    return cleaned or query


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


def _search_google_live(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    Fetches real-time live Google Search results via Google's live search feed.
    Returns latest news, prices, product leaks, official releases, and publisher citations.
    """
    results: List[Dict[str, Any]] = []
    try:
        clean_q = clean_search_query(query)
        encoded = urllib.parse.quote(clean_q)
        url = f"https://news.google.com/rss/search?q={encoded}&hl=en-US&gl=US&ceid=US:en"

        resp = requests.get(url, headers=HEADERS, verify=certifi.where(), timeout=8)
        if resp.status_code == 200 and resp.text:
            tree = ET.fromstring(resp.text)
            items = tree.findall(".//item")

            for it in items[:max_results]:
                title = it.find("title").text if it.find("title") is not None else ""
                link = it.find("link").text if it.find("link") is not None else ""
                src_elem = it.find("source")
                pub_elem = it.find("pubDate")

                publisher = src_elem.text if src_elem is not None and src_elem.text else "Google Search"
                src_url = src_elem.attrib.get("url", link) if src_elem is not None else link
                pub_date = pub_elem.text if pub_elem is not None and pub_elem.text else ""

                domain = urllib.parse.urlparse(src_url).netloc.replace("www.", "") if src_url else "google.com"
                if not domain:
                    domain = "google.com"

                pub_short = pub_date[:16] if pub_date else "Recent"
                snippet = f"{title} — Reported by {publisher} ({pub_short})."

                results.append({
                    "title": title,
                    "url": link,
                    "domain": domain,
                    "snippet": snippet,
                    "source_type": "google_search",
                    "metadata": {
                        "publisher": publisher,
                        "published_date": pub_date,
                        "domain": domain,
                    },
                })
    except Exception as exc:
        logger.warning(f"Google live search error for query '{query}': {exc}")

    return results


def _search_serper(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """Queries Serper Google Search API if SERPER_API_KEY is configured in environment."""
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        return []
    results: List[Dict[str, Any]] = []
    try:
        url = "https://google.serper.dev/search"
        payload = {"q": clean_search_query(query), "num": max_results}
        headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
        resp = requests.post(url, json=payload, headers=headers, timeout=8)
        if resp.status_code == 200:
            data = resp.json()

            # 1. Capture Direct Answer Box if present
            if "answerBox" in data and isinstance(data["answerBox"], dict):
                ab = data["answerBox"]
                ans_text = ab.get("snippet") or ab.get("answer") or ""
                ans_title = ab.get("title") or f"Google Answer: {clean_search_query(query)}"
                ans_link = ab.get("link") or "https://www.google.com"
                domain = urllib.parse.urlparse(ans_link).netloc.replace("www.", "") or "google.com"
                if ans_text:
                    results.append({
                        "title": ans_title,
                        "url": ans_link,
                        "domain": domain,
                        "snippet": ans_text,
                        "source_type": "google_search",
                    })

            # 2. Capture Knowledge Graph if present
            if "knowledgeGraph" in data and isinstance(data["knowledgeGraph"], dict):
                kg = data["knowledgeGraph"]
                kg_desc = kg.get("description") or ""
                kg_title = kg.get("title") or "Google Knowledge Graph"
                kg_link = kg.get("website") or "https://www.google.com"
                domain = urllib.parse.urlparse(kg_link).netloc.replace("www.", "") or "google.com"
                if kg_desc:
                    results.append({
                        "title": kg_title,
                        "url": kg_link,
                        "domain": domain,
                        "snippet": kg_desc,
                        "source_type": "google_search",
                    })

            # 3. Organic Google Search results
            for r in data.get("organic", [])[:max_results]:
                link = r.get("link", "")
                domain = urllib.parse.urlparse(link).netloc.replace("www.", "")
                snippet = r.get("snippet", "")
                date = r.get("date")
                if date and date not in snippet:
                    snippet = f"[{date}] {snippet}"
                results.append({
                    "title": r.get("title", ""),
                    "url": link,
                    "domain": domain,
                    "snippet": snippet,
                    "source_type": "google_search",
                })
    except Exception as exc:
        logger.warning(f"Serper API failed: {exc}")
    return results


def _search_tavily(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """Queries Tavily Search API if TAVILY_API_KEY is configured in environment."""
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return []
    results: List[Dict[str, Any]] = []
    try:
        url = "https://api.tavily.com/search"
        payload = {"query": query, "max_results": max_results, "search_depth": "basic"}
        resp = requests.post(url, json=payload, headers={"Authorization": f"Bearer {api_key}"}, timeout=8)
        if resp.status_code == 200:
            data = resp.json()
            for r in data.get("results", [])[:max_results]:
                domain = urllib.parse.urlparse(r.get("url", "")).netloc.replace("www.", "")
                results.append({
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "domain": domain,
                    "snippet": r.get("content", "")[:300],
                    "source_type": "web",
                })
    except Exception as exc:
        logger.warning(f"Tavily search failed: {exc}")
    return results


def _search_ddg_lite(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """Fetches organic live web search results from DuckDuckGo Lite if accessible."""
    results: List[Dict[str, Any]] = []
    try:
        url = "https://lite.duckduckgo.com/lite/"
        resp = requests.post(
            url,
            data={"q": clean_search_query(query)},
            headers=HEADERS,
            verify=certifi.where(),
            timeout=5,
        )
        if resp.status_code == 200 and resp.text and "<!DOCTYPE" in resp.text and "result-link" in resp.text:
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
        logger.warning(f"DuckDuckGo search error: {exc}")

    return results


def _search_arxiv(query: str, max_results: int = 3) -> List[Dict[str, Any]]:
    """Fetches academic research papers matching the query from the official ArXiv API."""
    results: List[Dict[str, Any]] = []
    try:
        clean_q = clean_search_query(query)
        clean_q = re.sub(r"[^a-zA-Z0-9\s]", " ", clean_q).strip()
        encoded = urllib.parse.quote(clean_q)
        api_url = f"https://export.arxiv.org/api/query?search_query=all:{encoded}&max_results={max_results}&sortBy=relevance"

        resp = requests.get(api_url, headers=HEADERS, verify=certifi.where(), timeout=8)
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
        clean_q = clean_search_query(query)
        encoded = urllib.parse.quote(clean_q)
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
    Executes live multi-engine search prioritizing official Google search (Serper API),
    Tavily API, DuckDuckGo organic search, ArXiv papers, and Wikipedia fallback.
    Returns structured citations with direct URLs, domain names, and source types.
    """
    logger.info(f"Executing Google & intelligence search for query: '{query}'")
    all_results: List[Dict[str, Any]] = []
    seen_urls = set()

    def _add_results(items: List[Dict[str, Any]]):
        for it in items:
            u = it.get("url", "")
            if u and u not in seen_urls:
                seen_urls.add(u)
                all_results.append(it)

    # 1. Primary: Serper (Official Google Search API)
    serper_res = _search_serper(query, max_results=max_results)
    _add_results(serper_res)

    # 2. Secondary: Tavily Search API if Serper is not configured or returned empty
    if len(all_results) < max_results:
        tavily_res = _search_tavily(query, max_results=max_results - len(all_results))
        _add_results(tavily_res)

    # 3. Academic research check (ArXiv)
    query_lower = query.lower()
    is_academic_query = any(k in query_lower for k in RESEARCH_PAPER_KEYWORDS)
    if is_academic_query:
        paper_res = _search_arxiv(query, max_results=3)
        _add_results(paper_res)

    # 4. Organic Web Search (DuckDuckGo Lite) if we need more results
    if len(all_results) < max_results:
        ddg_res = _search_ddg_lite(query, max_results=max_results - len(all_results))
        _add_results(ddg_res)

    # 5. Live Google News RSS feed for breaking news / headlines
    if len(all_results) < max_results:
        google_news_res = _search_google_live(query, max_results=max_results - len(all_results))
        _add_results(google_news_res)

    # 6. Supplementary Wikipedia for encyclopedic fallback
    if len(all_results) < 2:
        wiki_res = _search_wikipedia(query, max_results=2)
        _add_results(wiki_res)

    logger.info(f"Search completed: found {len(all_results)} verified Google/web/paper sources.")
    return {
        "tool": "web_search",
        "query": query,
        "results_count": len(all_results),
        "results": all_results[:max_results + (3 if is_academic_query else 0)],
    }


