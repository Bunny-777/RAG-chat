from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import StreamingResponse

from backend.app.core.exceptions import ResearchAppException
from backend.app.models.requests import ResearchRequest
from backend.app.models.responses import ResearchResponse, SourceInfo, ChatSessionSummaryResponse
from backend.app.services.research_service import research_service
from backend.app.services.source_store import source_store
from backend.app.services.session_store import session_store

router = APIRouter()


@router.post("/research", response_model=ResearchResponse)
async def perform_research(payload: ResearchRequest):
    """
    Executes a research query against indexed sources or a newly provided YouTube URL.
    Returns a structured research report.
    """
    try:
        response = await research_service.execute_research(payload)
        return response
    except ResearchAppException as exc:
        raise HTTPException(status_code=400, detail=exc.message)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred during research execution: {str(exc)}",
        )


@router.post("/research/stream")
async def perform_research_stream(payload: ResearchRequest):
    """
    Executes a research query and streams real-time status and report events via SSE.
    """
    generator = research_service.execute_research_stream(payload)
    return StreamingResponse(generator, media_type="text/event-stream")


@router.get("/research/{research_id}", response_model=ResearchResponse)
async def get_research_report(research_id: str):
    """
    Retrieves a past research report by research ID.
    """
    report = source_store.get_research(research_id)
    if not report:
        raise HTTPException(
            status_code=404,
            detail=f"Research report with ID '{research_id}' not found.",
        )
    return report


@router.get("/research/{research_id}/sources", response_model=List[SourceInfo])
async def get_research_sources(research_id: str):
    """
    Retrieves the list of sources cited in a specific research report.
    """
    report = source_store.get_research(research_id)
    if not report:
        raise HTTPException(
            status_code=404,
            detail=f"Research report with ID '{research_id}' not found.",
        )
    return report.sources


@router.delete("/research/{research_id}")
async def delete_research_report(research_id: str):
    """
    Deletes a research report session by research ID.
    """
    deleted = source_store.delete_research(research_id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=f"Research report with ID '{research_id}' not found.",
        )
    return {"message": f"Research session '{research_id}' successfully deleted."}


@router.get("/sessions", response_model=List[ChatSessionSummaryResponse])
async def list_chat_sessions():
    """Returns a list of all active chat sessions with summary metadata."""
    sessions = session_store.list_sessions()
    return [
        ChatSessionSummaryResponse(
            session_id=s.session_id,
            title=s.title,
            created_at=s.created_at,
            updated_at=s.updated_at,
            turn_count=len(s.turns),
        )
        for s in sessions
    ]


@router.get("/sessions/{session_id}")
async def get_chat_session(session_id: str):
    """Returns the full history of a chat session including all turns and reports."""
    session = session_store.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail=f"Chat session '{session_id}' not found.",
        )
    return session


@router.post("/sessions")
async def create_chat_session(payload: Optional[Dict[str, Any]] = Body(default=None)):
    """Explicitly initializes a new blank chat session."""
    title = payload.get("title") if payload else None
    session = session_store.get_or_create_session(title=title)
    return session


@router.delete("/sessions/{session_id}")
async def delete_chat_session(session_id: str):
    """Deletes a chat session and its full conversational history."""
    deleted = session_store.delete_session(session_id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=f"Chat session '{session_id}' not found.",
        )
    return {"message": f"Chat session '{session_id}' successfully deleted."}
