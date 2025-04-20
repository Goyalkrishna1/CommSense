"""
Embed route — builds and persists FAISS index for a video's comments.

Called by the backend after analysis completes to enable semantic search.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any
import logging

from app.pipelines.embeddings import build_and_save_index

logger = logging.getLogger(__name__)
router = APIRouter()


class EmbedRequest(BaseModel):
    """Schema for the /api/embed request body."""
    videoId: str
    comments: List[Dict[str, Any]]


class EmbedResponse(BaseModel):
    """Schema for the /api/embed response."""
    videoId: str
    indexSize: int
    mapping: List[Dict[str, Any]]


@router.post("/embed")
async def embed_comments(request: EmbedRequest):
    """
    Build a FAISS index for a video's comments and save it to disk.

    The backend calls this after analysis completes to enable semantic search.
    Returns the position→commentId mapping for MongoDB storage.
    """
    logger.info(f"[Embed] Building FAISS index for video {request.videoId} ({len(request.comments)} comments)")

    mapping = build_and_save_index(request.videoId, request.comments)

    logger.info(f"[Embed] Index built successfully: {len(mapping)} vectors")

    return {
        "videoId": request.videoId,
        "indexSize": len(mapping),
        "mapping": mapping,
    }
