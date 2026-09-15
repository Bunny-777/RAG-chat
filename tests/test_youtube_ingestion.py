import pytest
from backend.app.ingestion.youtube import (
    extract_video_id,
    create_youtube_documents,
)
from backend.app.core.exceptions import (
    InvalidYouTubeURLError,
    TranscriptNotFoundError,
)


def test_extract_video_id_standard_url():
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    assert extract_video_id(url) == "dQw4w9WgXcQ"


def test_extract_video_id_with_extra_params():
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&feature=shared"
    assert extract_video_id(url) == "dQw4w9WgXcQ"


def test_extract_video_id_short_url():
    url = "https://youtu.be/dQw4w9WgXcQ?t=10"
    assert extract_video_id(url) == "dQw4w9WgXcQ"


def test_extract_video_id_embed_and_shorts():
    embed_url = "https://www.youtube.com/embed/dQw4w9WgXcQ"
    shorts_url = "https://www.youtube.com/shorts/dQw4w9WgXcQ"
    assert extract_video_id(embed_url) == "dQw4w9WgXcQ"
    assert extract_video_id(shorts_url) == "dQw4w9WgXcQ"


def test_extract_video_id_raw():
    raw_id = "dQw4w9WgXcQ"
    assert extract_video_id(raw_id) == "dQw4w9WgXcQ"


def test_extract_video_id_invalid():
    with pytest.raises(InvalidYouTubeURLError):
        extract_video_id("https://google.com/search?q=test")


def test_create_youtube_documents_manual(sample_transcript_text):
    docs, meta = create_youtube_documents(
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        manual_transcript=sample_transcript_text,
    )
    assert len(docs) == 1
    assert docs[0].page_content == sample_transcript_text
    assert meta["video_id"] == "dQw4w9WgXcQ"
    assert meta["source_type"] == "youtube"
    assert docs[0].metadata["source_id"] == "yt_dQw4w9WgXcQ"


def test_create_youtube_documents_empty_manual():
    with pytest.raises(TranscriptNotFoundError):
        create_youtube_documents(
            url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            manual_transcript="   ",
        )
