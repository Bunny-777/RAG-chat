import os
from dataclasses import dataclass, field
from typing import Optional, List
from dotenv import load_dotenv

load_dotenv()


@dataclass
class Settings:
    """Application settings and environment configuration."""

    # LLM Settings
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY")
    LLM_MODEL_NAME: str = os.getenv("LLM_MODEL_NAME", "openai/gpt-oss-120b")
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.0"))

    # Embeddings Settings
    EMBEDDING_MODEL_NAME: str = os.getenv(
        "EMBEDDING_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2"
    )
    HF_TOKEN: Optional[str] = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACEHUB_API_TOKEN")

    # Chunking Defaults
    DEFAULT_CHUNK_SIZE: int = int(os.getenv("DEFAULT_CHUNK_SIZE", "1000"))
    DEFAULT_CHUNK_OVERLAP: int = int(os.getenv("DEFAULT_CHUNK_OVERLAP", "200"))

    # Retrieval Defaults
    DEFAULT_TOP_K: int = int(os.getenv("DEFAULT_TOP_K", "4"))

    # Proxy Settings for YouTube transcript fetching
    WEBSHARE_PROXY_USERNAME: Optional[str] = os.getenv("WEBSHARE_PROXY_USERNAME")
    WEBSHARE_PROXY_PASSWORD: Optional[str] = os.getenv("WEBSHARE_PROXY_PASSWORD")
    PROXY_HTTP_URL: Optional[str] = os.getenv("PROXY_HTTP_URL")
    PROXY_HTTPS_URL: Optional[str] = os.getenv("PROXY_HTTPS_URL")
    WEBSHARE_LOCATIONS: List[str] = field(
        default_factory=lambda: [
            loc.strip()
            for loc in os.getenv("WEBSHARE_LOCATIONS", "").split(",")
            if loc.strip()
        ]
    )


settings = Settings()
