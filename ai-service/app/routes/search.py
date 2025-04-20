"""
Search route — semantic, keyword, and hybrid comment search.

Flow:
1. Analyze query (detect entities, timestamps, numbers) → determine weighting
2. Semantic search: embed query → FAISS top-K
3. Keyword search: simple text matching on comment texts
4. Hybrid: merge results with adaptive weighting (α * semantic + (1-α) * keyword)

Returns ranked list of {commentId, semanticScore, keywordScore, hybridScore, text, classifications}
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import re

from app.pipelines.embeddings import search_index, embed_texts
from app.pipelines.query_analysis import analyze_query

logger = logging.getLogger(__name__)
router = APIRouter()


class SearchRequest(BaseModel):
    """Schema for the /api/search request body."""
    query: str
    videoId: str
    mode: str = "semantic"  # "semantic", "keyword", or "hybrid"
    topK: int = 20
    # Optional: pass comments directly (backend sends them for keyword matching)
    comments: Optional[List[Dict[str, Any]]] = None


class SearchResult(BaseModel):
    """Schema for a single search result."""
    commentId: str
    text: str
    semanticScore: float = 0.0
    keywordScore: float = 0.0
    hybridScore: float = 0.0
    sentiment: str = ""
    intent: str = ""
    aspect: str = ""


def keyword_search(query: str, comments: List[Dict[str, Any]], top_k: int = 50) -> List[Dict[str, Any]]:
    """
    Simple keyword search — case-insensitive substring matching.
    Returns results sorted by number of query term matches (descending).

    In production, this is handled by MongoDB text search on the backend.
    This fallback allows the AI service to do keyword search independently.
    """
    query_terms = query.lower().split()
    results = []

    for comment in comments:
        text = comment.get('text', comment.get('cleanedText', '')).lower()
        if not text:
            continue

        # Count how many query terms appear in the comment
        matches = sum(1 for term in query_terms if term in text)
        if matches > 0:
            # Score: fraction of query terms found
            score = matches / len(query_terms)
            results.append({
                'commentId': comment.get('commentId', ''),
                'text': comment.get('text', comment.get('cleanedText', '')),
                'keywordScore': score,
                'sentiment': comment.get('sentiment', ''),
                'intent': comment.get('intent', ''),
                'aspect': comment.get('aspect', ''),
            })

    # Sort by keyword score descending
    results.sort(key=lambda x: x['keywordScore'], reverse=True)
    return results[:top_k]


@router.post("/search")
async def search_comments(request: SearchRequest):
    """
    Semantic/keyword/hybrid search across comments.

    - Semantic: embed query → FAISS top-K
    - Keyword: text matching on comment content
    - Hybrid: adaptive weighting based on query analysis
    """
    logger.info(f"[Search] query=\"{request.query}\", mode={request.mode}, videoId={request.videoId}")

    query_analysis = analyze_query(request.query)
    comments = request.comments or []

    if request.mode == "semantic":
        # Pure semantic search via FAISS
        faiss_results = search_index(request.videoId, request.query, top_k=request.topK)

        # Map FAISS positions to comment IDs
        results = []
        for r in faiss_results:
            pos = r['position']
            if pos < len(comments):
                comment = comments[pos]
                results.append({
                    'commentId': comment.get('commentId', ''),
                    'text': comment.get('text', comment.get('cleanedText', '')),
                    'semanticScore': r['semanticScore'],
                    'keywordScore': 0.0,
                    'hybridScore': r['semanticScore'],
                    'sentiment': comment.get('sentiment', ''),
                    'intent': comment.get('intent', ''),
                    'aspect': comment.get('aspect', ''),
                })

        return {
            'mode': 'semantic',
            'query': request.query,
            'queryAnalysis': query_analysis,
            'results': results,
        }

    elif request.mode == "keyword":
        # Pure keyword search
        kw_results = keyword_search(request.query, comments, top_k=request.topK)

        return {
            'mode': 'keyword',
            'query': request.query,
            'queryAnalysis': query_analysis,
            'results': kw_results,
        }

    else:
        # Hybrid search — merge semantic + keyword with adaptive weighting
        alpha = query_analysis['keywordWeight']  # keyword weight
        beta = query_analysis['semanticWeight']   # semantic weight

        logger.info(f"[Search] Hybrid mode: keyword_weight={alpha}, semantic_weight={beta}")

        # Get semantic results
        faiss_results = search_index(request.videoId, request.query, top_k=request.topK * 2)
        semantic_map = {}
        for r in faiss_results:
            pos = r['position']
            if pos < len(comments):
                comment = comments[pos]
                cid = comment.get('commentId', str(pos))
                semantic_map[cid] = {
                    'commentId': cid,
                    'text': comment.get('text', comment.get('cleanedText', '')),
                    'semanticScore': r['semanticScore'],
                    'sentiment': comment.get('sentiment', ''),
                    'intent': comment.get('intent', ''),
                    'aspect': comment.get('aspect', ''),
                }

        # Get keyword results
        kw_results = keyword_search(request.query, comments, top_k=request.topK * 2)
        keyword_map = {}
        for r in kw_results:
            cid = r['commentId']
            keyword_map[cid] = r

        # Merge: union of semantic and keyword results
        all_comment_ids = set(semantic_map.keys()) | set(keyword_map.keys())

        merged = []
        for cid in all_comment_ids:
            sem = semantic_map.get(cid, {})
            kw = keyword_map.get(cid, {})

            sem_score = sem.get('semanticScore', 0.0)
            kw_score = kw.get('keywordScore', 0.0)

            # Hybrid score: weighted combination
            hybrid_score = (beta * sem_score) + (alpha * kw_score)

            merged.append({
                'commentId': cid,
                'text': sem.get('text', kw.get('text', '')),
                'semanticScore': sem_score,
                'keywordScore': kw_score,
                'hybridScore': hybrid_score,
                'sentiment': sem.get('sentiment', kw.get('sentiment', '')),
                'intent': sem.get('intent', kw.get('intent', '')),
                'aspect': sem.get('aspect', kw.get('aspect', '')),
            })

        # Sort by hybrid score descending
        merged.sort(key=lambda x: x['hybridScore'], reverse=True)

        return {
            'mode': 'hybrid',
            'query': request.query,
            'queryAnalysis': query_analysis,
            'weights': {'keyword': alpha, 'semantic': beta},
            'results': merged[:request.topK],
        }
