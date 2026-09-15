"""Custom exceptions for the Research Analyst application."""


class ResearchAppException(Exception):
    """Base exception for all research application errors."""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class InvalidYouTubeURLError(ResearchAppException):
    """Raised when a provided YouTube URL cannot be parsed or lacks a video ID."""
    pass


class TranscriptsDisabledError(ResearchAppException):
    """Raised when captions/transcripts are disabled for a YouTube video."""
    pass


class TranscriptNotFoundError(ResearchAppException):
    """Raised when no suitable transcript is found for a YouTube video."""
    pass


class IngestionError(ResearchAppException):
    """Raised when document/source ingestion fails."""
    pass


class ModelProviderError(ResearchAppException):
    """Raised when an external LLM or Embedding provider fails."""
    pass
