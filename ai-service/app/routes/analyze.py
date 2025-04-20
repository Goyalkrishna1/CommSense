"""
Analyze route — main NLP pipeline endpoint.

Receives a batch of YouTube comments from the backend, runs all NLP
pipelines, and returns aggregated analysis results.

Pipeline execution plan (optimized for parallelism):
1. Preprocessing (sync, fast — cleaning, emoji demojize, language detection, dedup)
2. Sentiment analysis (DistilBERT) — must run before aspect (aspect reuses sentiment label)
3. PARALLEL:
   a. Aspect-based sentiment → Intent classification (sequential — share zero-shot classifier)
   b. Toxicity detection (independent — uses separate toxic-bert model)
4. Topic modeling (BERTopic — independent, uses sentence transformer)
5. Timeline mapping (sync, fast — timestamp extraction + sentiment per bucket)
6. Aggregation into summary statistics
7. LLM summarization (Groq API — optional, requires API key)

Steps 3a and 3b run concurrently via asyncio.to_thread + asyncio.gather.
PyTorch releases the GIL during inference, so threading gives real parallelism
between the toxicity model and the zero-shot classifier.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
import asyncio
import logging
import time

from app.pipelines.preprocessing import preprocess_comments
from app.pipelines.sentiment import analyze_sentiment
from app.pipelines.aspect_sentiment import analyze_aspects
from app.pipelines.intent import analyze_intents
from app.pipelines.toxicity import analyze_toxicity
from app.pipelines.topic_modeling import analyze_topics
from app.pipelines.timeline import build_timeline
from app.pipelines.summarization import generate_summary
from app.utils.aggregation import aggregate_results

logger = logging.getLogger(__name__)
router = APIRouter()


class CommentInput(BaseModel):
    """Schema for a single raw comment received from the backend."""
    commentId: str
    text: str
    author: str = ""
    likes: int = 0
    publishedAt: str = ""


class AnalyzeRequest(BaseModel):
    """Schema for the /api/analyze request body."""
    comments: List[CommentInput]


@router.post("/analyze")
async def analyze_comments(request: AnalyzeRequest):
    """
    Run all NLP pipelines on a batch of comments.

    Returns aggregated analysis results including:
    - Sentiment distribution (positive/negative/neutral counts)
    - Aspect-based sentiment breakdown
    - Intent classification distribution
    - Topic clusters with keywords and representative comments
    - Toxic comment flags
    - Per-comment classifications
    """
    start_time = time.time()
    logger.info(f"[Analyze] Received {len(request.comments)} comments for analysis")

    # Convert Pydantic models to dicts for pipeline processing
    raw_comments = [c.model_dump() for c in request.comments]

    # Step 1: Preprocessing (sync, fast)
    logger.info("[Analyze] Step 1/6: Preprocessing")
    comments = preprocess_comments(raw_comments)

    # Step 2: Sentiment analysis (must run before aspect — aspect reuses sentiment label)
    logger.info("[Analyze] Step 2/6: Sentiment analysis")
    comments = await asyncio.to_thread(analyze_sentiment, comments)

    # Step 3: PARALLEL — toxicity (independent model) runs concurrently with
    # aspect→intent (shared zero-shot classifier, must be sequential)
    logger.info("[Analyze] Step 3/6: Parallel — aspect+intent | toxicity")

    async def run_aspect_and_intent(c):
        """Aspect then intent — sequential because they share the zero-shot classifier."""
        c = await asyncio.to_thread(analyze_aspects, c)
        c = await asyncio.to_thread(analyze_intents, c)
        return c

    # Run both branches concurrently — PyTorch releases GIL during inference
    # so threads give real parallelism between toxic-bert and the zero-shot model
    comments, _ = await asyncio.gather(
        run_aspect_and_intent(comments),
        asyncio.to_thread(analyze_toxicity, comments),
    )

    # Step 4: Topic modeling (sync, independent — uses BERTopic + sentence transformer)
    logger.info("[Analyze] Step 4/6: Topic modeling")
    comments, topic_summaries = await asyncio.to_thread(analyze_topics, comments)

    # Step 5: Timeline mapping (sync, fast — timestamp extraction + sentiment per bucket)
    logger.info("[Analyze] Step 5/6: Timeline mapping")
    timeline_data = build_timeline(comments)

    # Aggregate all results into summary statistics
    aggregated = aggregate_results(comments, topic_summaries)
    aggregated['timelineData'] = timeline_data

    # Step 6: LLM summarization (optional — requires Groq API key)
    logger.info("[Analyze] Step 6/6: LLM summarization")
    llm_summary = generate_summary(aggregated)
    if llm_summary:
        aggregated['llmSummary'] = llm_summary
        logger.info("[Analyze] LLM summary generated successfully")
    else:
        logger.info("[Analyze] LLM summarization skipped (no API key configured)")

    elapsed = time.time() - start_time
    logger.info(f"[Analyze] Pipeline complete in {elapsed:.1f}s — {len(comments)} comments processed")

    return {
        **aggregated,
        'comments': [
            {
                'commentId': c.get('commentId', ''),
                'text': c.get('cleanedText', ''),
                'author': c.get('author', ''),
                'likes': c.get('likes', 0),
                'publishedAt': c.get('publishedAt', ''),
                'sentiment': c.get('sentiment', 'neutral'),
                'sentimentScore': c.get('sentimentScore', 0.0),
                'aspect': c.get('aspect', 'general'),
                'aspectSentiment': c.get('aspectSentiment', 'neutral'),
                'intent': c.get('intent', 'off-topic'),
                'intentConfidence': c.get('intentConfidence', 0.0),
                'toxicityScore': c.get('toxicityScore', 0.0),
                'isToxic': c.get('isToxic', False),
                'topicId': c.get('topicId', -1),
                'language': c.get('language', 'unknown'),
            }
            for c in comments
        ],
        'processingTime': round(elapsed, 2),
    }
