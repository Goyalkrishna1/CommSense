"""
Aspect-based sentiment analysis module using zero-shot NLI classification.

Uses a distilled MNLI model (typeform/distilbert-base-uncased-mnli) to classify
each comment against predefined aspect labels (content quality, audio/video
quality, pacing, etc.), then classifies sentiment for the top-matched aspect.

This is a transfer learning approach — the model is trained on NLI tasks
and applied to aspect classification without task-specific training.
"""

import logging
from typing import List, Dict, Any

from app.config import config
from app.utils.model_loader import get_zeroshot_classifier

logger = logging.getLogger(__name__)


def classify_aspect(text: str, classifier) -> tuple[str, float]:
    """
    Classify a single comment against aspect labels.
    
    Returns:
        tuple: (top_aspect, confidence_score)
    """
    result = classifier(text, config.ASPECT_LABELS, multi_label=False)
    top_aspect = result['labels'][0]
    confidence = float(result['scores'][0])
    return top_aspect, confidence


def analyze_aspects(comments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Run aspect-based sentiment analysis on all comments.
    
    For each comment:
    1. Classify which aspect the comment is about (zero-shot)
    2. Use the existing sentiment label from the sentiment pipeline
       to determine sentiment toward that aspect
    
    Args:
        comments: List of comment dicts with 'cleanedText' and 'sentiment' fields
    
    Returns:
        Comments with added fields: 'aspect', 'aspectConfidence', 'aspectSentiment'
    """
    if not comments:
        return comments

    logger.info(f"[Aspect] Analyzing aspects for {len(comments)} comments")

    classifier = get_zeroshot_classifier()

    for comment in comments:
        text = comment['cleanedText']

        # Skip very short comments — aspect classification is unreliable
        if len(text.split()) < 3:
            comment['aspect'] = 'general'
            comment['aspectConfidence'] = 0.0
            comment['aspectSentiment'] = comment.get('sentiment', 'neutral')
            continue

        try:
            aspect, confidence = classify_aspect(text, classifier)
            comment['aspect'] = aspect
            comment['aspectConfidence'] = confidence
            # Reuse the sentiment label from the sentiment pipeline
            comment['aspectSentiment'] = comment.get('sentiment', 'neutral')
        except Exception as e:
            logger.warning(f"[Aspect] Failed to classify comment {comment.get('commentId')}: {e}")
            comment['aspect'] = 'general'
            comment['aspectConfidence'] = 0.0
            comment['aspectSentiment'] = comment.get('sentiment', 'neutral')

    # Log aspect distribution
    aspect_counts = {}
    for c in comments:
        aspect_counts[c['aspect']] = aspect_counts.get(c['aspect'], 0) + 1
    logger.info(f"[Aspect] Done: distribution = {aspect_counts}")

    return comments
