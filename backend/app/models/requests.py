from typing import Optional, List
from pydantic import BaseModel, Field


class ResearchOptions(BaseModel):
    """Options to configure research execution."""
    mode: str = Field(
        default="standard",
        description="Research mode: 'quick', 'standard', or 'deep'",
    )
    web_search: bool = Field(
        default=False,
        description="Whether to perform supplementary web search.",
    )


class UploadYouTubeRequest(BaseModel):
    """Payload for uploading and indexing a YouTube video."""
    url: str = Field(..., description="YouTube video URL or video ID.")
    manual_transcript: Optional[str] = Field(
        default=None,
        description="Optional pasted transcript text if YouTube captions cannot be fetched directly.",
    )
    chunk_size: Optional[int] = Field(default=None, description="Document chunk size.")
    chunk_overlap: Optional[int] = Field(default=None, description="Document chunk overlap.")
    k: Optional[int] = Field(default=None, description="Number of top chunks to retrieve per question.")


class ResearchRequest(BaseModel):
    """Payload for initiating a research query."""
    query: str = Field(..., description="The research question or prompt.")
    session_id: Optional[str] = Field(
        default=None,
        description="Optional chat session ID for conversational memory across turns.",
    )
    source_ids: Optional[List[str]] = Field(
        default=None,
        description="List of specific source IDs to research against.",
    )
    youtube_url: Optional[str] = Field(
        default=None,
        description="Optional direct YouTube URL for one-shot upload and research.",
    )
    manual_transcript: Optional[str] = Field(
        default=None,
        description="Optional manual transcript if direct YouTube URL is provided.",
    )
    options: Optional[ResearchOptions] = Field(
        default_factory=ResearchOptions,
        description="Execution mode and search flags.",
    )
