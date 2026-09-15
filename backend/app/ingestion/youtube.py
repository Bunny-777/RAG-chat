import re
from typing import Optional, Tuple, List
from urllib.parse import urlparse, parse_qs

from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled
try:
    from youtube_transcript_api.proxies import GenericProxyConfig, WebshareProxyConfig
except ImportError:
    GenericProxyConfig = None
    WebshareProxyConfig = None

from langchain_core.documents import Document

from backend.app.core.config import settings
from backend.app.core.exceptions import (
    InvalidYouTubeURLError,
    TranscriptsDisabledError,
    TranscriptNotFoundError,
)
from backend.app.core.logging import get_logger

logger = get_logger(__name__)


def extract_video_id(url: str) -> str:
    """
    Extracts the 11-character YouTube video ID from various URL formats:
    - https://www.youtube.com/watch?v=VIDEO_ID
    - https://youtu.be/VIDEO_ID
    - https://m.youtube.com/watch?v=VIDEO_ID
    - https://www.youtube.com/embed/VIDEO_ID
    - https://www.youtube.com/shorts/VIDEO_ID
    - VIDEO_ID (raw ID)
    """
    if not url or not isinstance(url, str):
        raise InvalidYouTubeURLError("A valid YouTube URL or video ID string must be provided.")

    cleaned_url = url.strip()

    # Direct 11-char ID check (e.g., dQw4w9WgXcQ)
    if re.fullmatch(r"[a-zA-Z0-9_-]{11}", cleaned_url):
        return cleaned_url

    parsed = urlparse(cleaned_url)
    hostname = (parsed.hostname or "").lower()

    if hostname in ("www.youtube.com", "youtube.com", "m.youtube.com"):
        if parsed.path == "/watch":
            qs = parse_qs(parsed.query)
            v = qs.get("v")
            if v and len(v[0]) > 0:
                return v[0]
        elif parsed.path.startswith(("/embed/", "/shorts/", "/v/")):
            parts = parsed.path.strip("/").split("/")
            if len(parts) >= 2 and len(parts[1]) > 0:
                return parts[1]

    if hostname == "youtu.be":
        path_id = parsed.path.lstrip("/")
        if path_id:
            # Handle query parameters attached to youtu.be/ID?t=10
            return path_id.split("?")[0].split("&")[0]

    # Regex fallback for any embedded YouTube pattern
    regex_match = re.search(r"(?:v=|\/embed\/|\/shorts\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})", cleaned_url)
    if regex_match:
        return regex_match.group(1)

    raise InvalidYouTubeURLError(
        f"Could not extract a valid YouTube video ID from the provided URL: '{url}'"
    )


def configure_youtube_api() -> YouTubeTranscriptApi:
    """Configures and returns a YouTubeTranscriptApi instance with optional proxy settings."""
    if (
        settings.WEBSHARE_PROXY_USERNAME
        and settings.WEBSHARE_PROXY_PASSWORD
        and WebshareProxyConfig
    ):
        logger.info("Configuring YouTubeTranscriptApi with Webshare residential proxy.")
        proxy_config = WebshareProxyConfig(
            proxy_username=settings.WEBSHARE_PROXY_USERNAME,
            proxy_password=settings.WEBSHARE_PROXY_PASSWORD,
            filter_ip_locations=settings.WEBSHARE_LOCATIONS or None,
        )
        return YouTubeTranscriptApi(proxy_config=proxy_config)

    if (settings.PROXY_HTTP_URL or settings.PROXY_HTTPS_URL) and GenericProxyConfig:
        logger.info("Configuring YouTubeTranscriptApi with generic HTTP/HTTPS proxy.")
        proxy_config = GenericProxyConfig(
            http_url=settings.PROXY_HTTP_URL,
            https_url=settings.PROXY_HTTPS_URL,
        )
        return YouTubeTranscriptApi(proxy_config=proxy_config)

    return YouTubeTranscriptApi()


def fetch_youtube_transcript(video_id: str) -> Tuple[str, str]:
    """
    Fetches the transcript for a YouTube video ID.
    Returns a tuple of (transcript_text, language_code).
    """
    ytt_api = configure_youtube_api()
    logger.info(f"Fetching transcript for video ID: {video_id}")

    # 1. First attempt: Direct fetch for en or hi
    try:
        fetched = ytt_api.fetch(video_id, languages=["en", "hi"])
        transcript_text = " ".join(item.text for item in fetched)
        return transcript_text, "en/hi"
    except TranscriptsDisabled:
        raise TranscriptsDisabledError(
            f"Transcripts/captions are disabled for YouTube video ID '{video_id}'."
        )
    except Exception as exc:
        logger.debug(f"Direct fetch failed: {exc}. Trying transcript list fallback.")

    # 2. Second attempt: List transcripts and find best match or auto-translate
    try:
        transcript_list = ytt_api.list(video_id)
    except TranscriptsDisabled:
        raise TranscriptsDisabledError(
            f"Transcripts/captions are disabled for YouTube video ID '{video_id}'."
        )
    except Exception as exc:
        raise TranscriptNotFoundError(
            f"Could not retrieve transcript list for video ID '{video_id}': {exc}"
        )

    try:
        transcript = transcript_list.find_transcript(["en", "hi"])
    except Exception:
        transcript = next(iter(transcript_list), None)

    if transcript is None:
        raise TranscriptNotFoundError(f"No transcripts found for video ID '{video_id}'.")

    # If transcript is not English but translatable, translate to English
    if getattr(transcript, "language_code", None) != "en" and getattr(transcript, "is_translatable", False):
        try:
            transcript = transcript.translate("en")
            logger.info("Translated non-English transcript to English.")
        except Exception as exc:
            logger.warning(f"Failed to auto-translate transcript: {exc}")

    try:
        fetched_items = transcript.fetch()
        transcript_text = " ".join(item.text for item in fetched_items)
        language_code = getattr(transcript, "language_code", "available")
        return transcript_text, language_code
    except Exception as exc:
        raise TranscriptNotFoundError(
            f"Failed to fetch transcript items for video ID '{video_id}': {exc}"
        )


def create_youtube_documents(
    url: str,
    manual_transcript: Optional[str] = None,
    source_id: Optional[str] = None,
) -> Tuple[List[Document], dict]:
    """
    Ingests a YouTube URL or manual transcript and creates normalized LangChain Documents with rich metadata.
    Returns (documents_list, metadata_dict).
    """
    video_id = extract_video_id(url)
    sid = source_id or f"yt_{video_id}"

    if manual_transcript is not None:
        if not manual_transcript.strip():
            raise TranscriptNotFoundError(
                f"Manual transcript provided for video ID '{video_id}' was empty."
            )
        transcript_text = manual_transcript.strip()
        language = "manual_pasted"
        logger.info(f"Using provided manual transcript for video ID: {video_id}")
    else:
        transcript_text, language = fetch_youtube_transcript(video_id)

    if not transcript_text or not transcript_text.strip():
        raise TranscriptNotFoundError(
            f"Transcript for YouTube video ID '{video_id}' was empty."
        )

    metadata = {
        "source_id": sid,
        "source_type": "youtube",
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "video_id": video_id,
        "language": language,
    }

    doc = Document(page_content=transcript_text, metadata=metadata)
    return [doc], metadata
