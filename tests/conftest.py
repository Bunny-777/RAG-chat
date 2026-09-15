import sys
from pathlib import Path
import pytest

# Ensure repository root is on sys.path
repo_root = Path(__file__).parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))


@pytest.fixture
def sample_transcript_text():
    return (
        "Welcome to this lecture on artificial intelligence and retrieval augmented generation. "
        "Retrieval Augmented Generation combines vector search with large language models. "
        "Vector search finds relevant document chunks using embedding cosine similarity. "
        "Then the context is passed to the LLM to generate a factual, grounded response. "
        "In this talk we compare FAISS with other vector stores."
    )


@pytest.fixture
def sample_youtube_url():
    return "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
