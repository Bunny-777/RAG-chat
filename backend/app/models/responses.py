from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response schema."""
    status: str = "ok"
    version: str = "1.0.0"
    app_name: str = "AI Research Analyst"
    llm_model: str
    embedding_model: str


class SourceInfo(BaseModel):
    """Normalized source information returned by the API."""
    source_id: str
    source_type: str = "youtube"
    url: Optional[str] = None
    title: Optional[str] = None
    language: Optional[str] = None
    chunk_count: int = 0
    metadata: Dict[str, Any] = Field(default_factory=dict)


class UploadResponse(BaseModel):
    """Response returned after a source has been indexed."""
    message: str = "Source successfully processed and indexed."
    source: SourceInfo


class ResearchResponse(BaseModel):
    """Structured research report response."""
    research_id: str
    session_id: Optional[str] = None
    query: str
    title: str
    executive_summary: str
    key_findings: List[str] = Field(default_factory=list)
    analysis: List[str] = Field(default_factory=list)
    conclusion: str
    sources: List[SourceInfo] = Field(default_factory=list)
    mode: str = "standard"
    latency_ms: Optional[float] = None
    classification: Optional[Dict[str, Any]] = None


class ChatSessionSummaryResponse(BaseModel):
    """Summary of a chat session for list endpoints."""
    session_id: str
    title: str
    created_at: float
    updated_at: float
    turn_count: int


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str
    detail: Optional[str] = None
