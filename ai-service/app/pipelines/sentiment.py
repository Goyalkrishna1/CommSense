"""
Sentiment analysis module using HuggingFace transformers pipeline.

Uses a configurable model (default: DistilBERT fine-tuned on SST-2).
After Phase 5 fine-tuning, the model path in config.py is swapped to
the fine-tuned checkpoint for domain-specific YouTube comment sentiment.

Output: {label, score} per comment where label is POSITIVE/NEGATIVE.
"""

import logging
from typing import List, Dict, Any

from transformers import pipeline as hf_pipeline

from app.config import config

logger = logging.getLogger(__name__)

# Lazy-loaded model instance — loaded on first use to avoid loading at import time
_sentiment_pipeline = None


def get_sentiment_pipeline():
    """
    Get or lazily initialize the HuggingFace sentiment pipeline.
    Model name is configurable via config.SENTIMENT_MODEL_NAME.
    """
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        logger.info(f"[Sentiment] Loading model: {config.SENTIMENT_MODEL_NAME}")
        _sentiment_pipeline = hf_pipeline(
            "sentiment-analysis",
            model=config.SENTIMENT_MODEL_NAME,
            tokenizer=config.SENTIMENT_MODEL_NAME,
            device=-1,  # CPU; change to 0 for GPU
        )
        logger.info("[Sentiment] Model loaded successfully")
    return _sentiment_pipeline


def analyze_sentiment(comments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Run sentiment analysis on a batch of preprocessed comments.
    
    Args:
        comments: List of comment dicts with 'cleanedText' field
    
    Returns:
        Comments with added fields: 'sentiment', 'sentimentScore'
    """
    if not comments:
        return comments

    logger.info(f"[Sentiment] Analyzing {len(comments)} comments")

    # Filter out duplicates — they'll get the same sentiment as their original
    unique_comments = [c for c in comments if not c.get('isDuplicate', False)]
    texts = [c['cleanedText'] for c in unique_comments]

    pipe = get_sentiment_pipeline()

    # Batch inference — HuggingFace pipeline handles batching internally
    results = pipe(texts, truncation=True, max_length=512)

    # Map results back to unique comments
    sentiment_map = {}  # textHash -> (label, score)
    for comment, result in zip(unique_comments, results):
        label = result['label'].lower()  # 'POSITIVE' -> 'positive'
        score = float(result['score'])
        sentiment_map[comment['textHash']] = (label, score)

    # Assign sentiment to all comments (duplicates get same sentiment as original)
    for comment in comments:
        hash_key = comment['textHash']
        if hash_key in sentiment_map:
            comment['sentiment'], comment['sentimentScore'] = sentiment_map[hash_key]
        else:
            # Fallback for any edge case
            comment['sentiment'] = 'neutral'
            comment['sentimentScore'] = 0.0

    pos = sum(1 for c in comments if c['sentiment'] == 'positive')
    neg = sum(1 for c in comments if c['sentiment'] == 'negative')
    logger.info(f"[Sentiment] Done: {pos} positive, {neg} negative, {len(comments) - pos - neg} other")

    return comments
