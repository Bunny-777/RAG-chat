import re
import requests
from typing import Dict, Any
from backend.app.core.logging import get_logger

logger = get_logger(__name__)


def read_url_content(url: str) -> Dict[str, Any]:
    """
    URL Reader Tool: Fetches web page content, strips HTML tags, and extracts text.
    """
    logger.info(f"Reading URL content from: {url}")
    try:
        resp = requests.get(url, timeout=10, headers={"User-Agent": "AIResearchAnalyst/1.0"})
        resp.raise_for_status()

        html_text = resp.text
        # Simple regex HTML stripping
        cleaned = re.sub(r"<script.*?</script>", "", html_text, flags=re.DOTALL | re.IGNORECASE)
        cleaned = re.sub(r"<style.*?</style>", "", cleaned, flags=re.DOTALL | re.IGNORECASE)
        cleaned = re.sub(r"<[^>]+>", " ", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()

        return {
            "tool": "url_reader",
            "url": url,
            "success": True,
            "content": cleaned[:8000],  # Limit content size
        }
    except Exception as exc:
        logger.warning(f"Failed to read URL {url}: {exc}")
        return {
            "tool": "url_reader",
            "url": url,
            "success": False,
            "error": str(exc),
        }
