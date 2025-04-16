"""
Embedding + FAISS index management module.

Handles:
1. Embedding comments using sentence-transformers (all-MiniLM-L6-v2)
2. Building FAISS IndexFlatIP (inner product = cosine similarity after normalization)
3. Persisting index to disk: data/faiss/{videoId}.index
4. Loading index from disk for search queries
5. Mapping FAISS index positions to comment IDs

The FAISS index is built after analysis completes and stored on disk.
The backend stores the position→commentId mapping in MongoDB SearchIndex.
"""

import os
import logging
import numpy as np
from typing import List, Dict, Any, Tuple

import faiss
from sentence_transformers import SentenceTransformer

from app.config import config

logger = logging.getLogger(__name__)

# Shared embedding model instance (reused from topic_modeling if available)
_embedding_model = None


def get_embedding_model() -> SentenceTransformer:
    """Get or lazily initialize the sentence transformer for embeddings."""
    global _embedding_model
    if _embedding_model is None:
        logger.info(f"[FAISS] Loading embedding model: {config.EMBEDDING_MODEL_NAME}")
        _embedding_model = SentenceTransformer(config.EMBEDDING_MODEL_NAME)
        logger.info("[FAISS] Embedding model loaded successfully")
    return _embedding_model


def _ensure_index_dir():
    """Ensure the FAISS index directory exists on disk."""
    os.makedirs(config.FAISS_INDEX_DIR, exist_ok=True)


def _get_index_path(video_id: str) -> str:
    """Get the file path for a video's FAISS index."""
    return os.path.join(config.FAISS_INDEX_DIR, f"{video_id}.index")


def embed_texts(texts: List[str]) -> np.ndarray:
    """
    Embed a list of texts using the sentence transformer.
    Returns normalized embeddings (unit vectors) for cosine similarity via inner product.

    Args:
        texts: List of text strings to embed

    Returns:
        np.ndarray of shape (n, dim) with L2-normalized rows
    """
    model = get_embedding_model()
    embeddings = model.encode(
        texts,
        normalize_embeddings=True,  # L2 normalization for cosine similarity
        show_progress_bar=False,
    )
    return np.array(embeddings, dtype=np.float32)


def build_and_save_index(video_id: str, comments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Build a FAISS index for a video's comments and save it to disk.

    Args:
        video_id: YouTube video ID
        comments: List of comment dicts with 'cleanedText' and 'commentId' fields

    Returns:
        List of mapping dicts: [{position, commentId}] for MongoDB storage
    """
    if not comments:
        logger.warning(f"[FAISS] No comments to index for video {video_id}")
        return []

    logger.info(f"[FAISS] Building index for {len(comments)} comments (video: {video_id})")

    # Extract texts and comment IDs
    texts = [c.get('cleanedText', c.get('text', '')) for c in comments]
    comment_ids = [c.get('commentId', str(i)) for i, c in enumerate(comments)]

    # Embed all comments
    embeddings = embed_texts(texts)
    dim = embeddings.shape[1]

    # Build FAISS IndexFlatIP (inner product = cosine similarity with normalized vectors)
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)

    # Save index to disk
    _ensure_index_dir()
    index_path = _get_index_path(video_id)
    faiss.write_index(index, index_path)
    logger.info(f"[FAISS] Index saved to {index_path} ({index.ntotal} vectors, dim={dim})")

    # Build position→commentId mapping for the backend to store in MongoDB
    mapping = [
        {"position": i, "commentId": comment_ids[i]}
        for i in range(len(comments))
    ]

    return mapping


def search_index(video_id: str, query: str, top_k: int = 50) -> List[Dict[str, Any]]:
    """
    Search a video's FAISS index for comments semantically similar to the query.

    Args:
        video_id: YouTube video ID
        query: Search query string
        top_k: Number of top results to return

    Returns:
        List of {position, semanticScore} sorted by descending similarity
    """
    index_path = _get_index_path(video_id)

    if not os.path.exists(index_path):
        logger.warning(f"[FAISS] Index not found for video {video_id}")
        return []

    # Load index from disk
    index = faiss.read_index(index_path)
    logger.info(f"[FAISS] Loaded index for video {video_id} ({index.ntotal} vectors)")

    # Embed the query
    query_embedding = embed_texts([query])

    # Search — returns distances (inner product scores) and indices
    scores, positions = index.search(query_embedding, min(top_k, index.ntotal))

    results = []
    for score, position in zip(scores[0], positions[0]):
        if position >= 0:  # FAISS returns -1 for no result
            results.append({
                "position": int(position),
                "semanticScore": float(score),
            })

    logger.info(f"[FAISS] Search returned {len(results)} results for query: '{query[:50]}...'")
    return results
