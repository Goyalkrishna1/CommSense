"""
Intent classification module using zero-shot NLI classification.

Uses a distilled MNLI model (typeform/distilbert-base-uncased-mnli) to classify
each comment into intent categories: question, feedback, complaint, praise,
suggestion, off-topic.

This is a transfer learning approach — no fine-tuning needed because
intent categories are general-purpose, not domain-specific.
"""

import logging
from typing import List, Dict, Any

from app.config import config
from app.utils.model_loader import get_zeroshot_classifier

logger = logging.getLogger(__name__)


def classify_intent(text: str, classifier) -> tuple[str, float]:
    """
    Classify a single comment against intent labels.
    
    Returns:
        tuple: (top_intent, confidence_score)
    """
    result = classifier(text, config.INTENT_LABELS, multi_label=False)
    top_intent = result['labels'][0]
    confidence = float(result['scores'][0])
    return top_intent, confidence


def analyze_intents(comments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Run intent classification on all comments.
    
    Args:
        comments: List of comment dicts with 'cleanedText' field
    
    Returns:
        Comments with added fields: 'intent', 'intentConfidence'
    """
    if not comments:
        return comments

    logger.info(f"[Intent] Classifying intents for {len(comments)} comments")

    classifier = get_zeroshot_classifier()

    for comment in comments:
        text = comment['cleanedText']

        # Skip very short comments
        if len(text.split()) < 2:
            comment['intent'] = 'off-topic'
            comment['intentConfidence'] = 0.0
            continue

        try:
            intent, confidence = classify_intent(text, classifier)
            comment['intent'] = intent
            comment['intentConfidence'] = confidence
        except Exception as e:
            logger.warning(f"[Intent] Failed to classify comment {comment.get('commentId')}: {e}")
            comment['intent'] = 'off-topic'
            comment['intentConfidence'] = 0.0

    # Log intent distribution
    intent_counts = {}
    for c in comments:
        intent_counts[c['intent']] = intent_counts.get(c['intent'], 0) + 1
    logger.info(f"[Intent] Done: distribution = {intent_counts}")

    return comments
