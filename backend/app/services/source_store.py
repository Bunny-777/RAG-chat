from typing import Dict, Optional, List, Union, Any
from backend.app.models.responses import SourceInfo, ResearchResponse
from backend.app.services.youtube_rag_service import YouTubeIndexResult
from backend.app.services.document_rag_service import DocumentIndexResult

AnyIndexResult = Union[YouTubeIndexResult, DocumentIndexResult]


class SourceStore:
    """In-memory store for indexed sources (YouTube, Documents) and research sessions."""

    def __init__(self):
        self._sources: Dict[str, AnyIndexResult] = {}
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

    def add_document_source(self, index_result: DocumentIndexResult) -> SourceInfo:
        sid = index_result.source_id
        self._sources[sid] = index_result

        info = SourceInfo(
            source_id=sid,
            source_type="document",
            url=None,
            title=index_result.filename,
            language="en",
            chunk_count=index_result.chunk_count,
            metadata={
                "filename": index_result.filename,
                "file_type": index_result.file_type,
            },
        )
        self._source_infos[sid] = info
        return info

    def get_source_index(self, source_id: str) -> Optional[AnyIndexResult]:
        return self._sources.get(source_id)

    def get_source_info(self, source_id: str) -> Optional[SourceInfo]:
        return self._source_infos.get(source_id)

    def list_sources(self) -> List[SourceInfo]:
        return list(self._source_infos.values())

    def delete_source(self, source_id: str) -> bool:
        existed = False
        if source_id in self._sources:
            del self._sources[source_id]
            existed = True
        if source_id in self._source_infos:
            del self._source_infos[source_id]
            existed = True
        return existed


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
