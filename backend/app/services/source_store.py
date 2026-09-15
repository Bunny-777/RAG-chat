import uuid
from typing import Dict, Optional, List
from backend.app.models.responses import SourceInfo, ResearchResponse
from backend.app.services.youtube_rag_service import YouTubeIndexResult


class SourceStore:
    """In-memory store for indexed sources and research sessions."""

    def __init__(self):
        self._sources: Dict[str, YouTubeIndexResult] = {}
        self._source_infos: Dict[str, SourceInfo] = {}
        self._research_sessions: Dict[str, ResearchResponse] = {}

    def add_youtube_source(self, index_result: YouTubeIndexResult) -> SourceInfo:
        sid = index_result.source_id
        self._sources[sid] = index_result

        info = SourceInfo(
            source_id=sid,
            source_type="youtube",
            url=index_result.url,
            title=f"YouTube Video ({index_result.video_id})",
            language=index_result.language,
            chunk_count=index_result.chunk_count,
            metadata={
                "video_id": index_result.video_id,
                "language": index_result.language,
            },
        )
        self._source_infos[sid] = info
        return info

    def get_source_index(self, source_id: str) -> Optional[YouTubeIndexResult]:
        return self._sources.get(source_id)

    def get_source_info(self, source_id: str) -> Optional[SourceInfo]:
        return self._source_infos.get(source_id)

    def list_sources(self) -> List[SourceInfo]:
        return list(self._source_infos.values())

    def save_research(self, response: ResearchResponse) -> None:
        self._research_sessions[response.research_id] = response

    def get_research(self, research_id: str) -> Optional[ResearchResponse]:
        return self._research_sessions.get(research_id)

    def delete_research(self, research_id: str) -> bool:
        if research_id in self._research_sessions:
            del self._research_sessions[research_id]
            return True
        return False

    def clear(self) -> None:
        self._sources.clear()
        self._source_infos.clear()
        self._research_sessions.clear()


source_store = SourceStore()
