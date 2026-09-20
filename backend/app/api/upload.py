from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form

from backend.app.core.exceptions import ResearchAppException
from backend.app.models.requests import UploadYouTubeRequest
from backend.app.models.responses import UploadResponse, SourceInfo
from backend.app.services.youtube_rag_service import youtube_rag_service
from backend.app.services.document_rag_service import document_rag_service
from backend.app.services.source_store import source_store

router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
async def upload_source(payload: UploadYouTubeRequest):
    """
    Ingests and indexes a YouTube source into the FAISS vector store.
    """
    try:
        index_result = youtube_rag_service.ingest_and_index_video(
            url=payload.url,
            manual_transcript=payload.manual_transcript,
            chunk_size=payload.chunk_size,
            chunk_overlap=payload.chunk_overlap,
            k=payload.k,
        )
        source_info = source_store.add_youtube_source(index_result)
        return UploadResponse(
            message=f"Successfully indexed YouTube video '{index_result.video_id}' with {index_result.chunk_count} chunk(s).",
            source=source_info,
        )
    except ResearchAppException as exc:
        raise HTTPException(status_code=400, detail=exc.message)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during ingestion: {str(exc)}",
        )


@router.post("/upload/file", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    chunk_size: Optional[int] = Form(None),
    chunk_overlap: Optional[int] = Form(None),
    k: Optional[int] = Form(None),
):
    """
    Uploads, parses, chunks, and indexes a document (PDF, Word DOCX, TXT, MD) into FAISS.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail=f"Uploaded file '{file.filename}' is empty.")

        index_result = document_rag_service.ingest_and_index_file(
            content=content,
            filename=file.filename or "uploaded_document",
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            k=k,
        )
        source_info = source_store.add_document_source(index_result)
        return UploadResponse(
            message=f"Successfully indexed document '{index_result.filename}' with {index_result.chunk_count} chunk(s).",
            source=source_info,
        )
    except ResearchAppException as exc:
        raise HTTPException(status_code=400, detail=exc.message)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during document processing: {str(exc)}",
        )


@router.get("/sources", response_model=List[SourceInfo])
async def list_sources():
    """Returns a list of all currently indexed sources."""
    return source_store.list_sources()


@router.get("/sources/{source_id}", response_model=SourceInfo)
async def get_source(source_id: str):
    """Returns details for a specific indexed source ID."""
    info = source_store.get_source_info(source_id)
    if not info:
        raise HTTPException(status_code=404, detail=f"Source '{source_id}' not found.")
    return info


@router.delete("/sources/{source_id}")
async def delete_source(source_id: str):
    """Removes an indexed source by ID."""
    info = source_store.get_source_info(source_id)
    if not info:
        raise HTTPException(status_code=404, detail=f"Source '{source_id}' not found.")
    source_store.delete_source(source_id)
    return {"message": f"Source '{source_id}' successfully removed."}

