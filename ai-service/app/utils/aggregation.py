"""
Aggregation utilities for combining per-comment analysis results
into summary statistics for the dashboard and LLM summarization.
"""

import logging
from typing import List, Dict, Any
from collections import Counter

logger = logging.getLogger(__name__)


def aggregate_sentiment(comments: List[Dict[str, Any]]) -> Dict[str, int]:
    """Aggregate sentiment distribution across all comments."""
    dist = {'positive': 0, 'negative': 0, 'neutral': 0}
    for c in comments:
        label = c.get('sentiment', 'neutral')
        if label in dist:
            dist[label] += 1
        else:
            dist['neutral'] += 1
    logger.info(f"[Aggregation] Sentiment distribution: {dist}")
    return dist


def aggregate_aspects(comments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Aggregate aspect-based sentiment: count positive/negative/neutral per aspect."""
    aspect_data = {}
    for c in comments:
        aspect = c.get('aspect', 'general')
        sentiment = c.get('aspectSentiment', c.get('sentiment', 'neutral'))

        if aspect not in aspect_data:
            aspect_data[aspect] = {'positive': 0, 'negative': 0, 'neutral': 0}
        if sentiment in aspect_data[aspect]:
            aspect_data[aspect][sentiment] += 1
        else:
            aspect_data[aspect]['neutral'] += 1

    result = [{'aspect': k, **v} for k, v in aspect_data.items()]
    logger.info(f"[Aggregation] Aspect sentiment: {len(result)} aspects")
    return result


def aggregate_intents(comments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Aggregate intent distribution across all comments."""
    intent_counts = Counter(c.get('intent', 'off-topic') for c in comments)
    result = [{'intent': k, 'count': v} for k, v in intent_counts.most_common()]
    logger.info(f"[Aggregation] Intent distribution: {result}")
    return result


def extract_toxic_comments(comments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract toxic comments with their scores for display."""
    toxic = [
        {
            'commentId': c.get('commentId', ''),
            'text': c.get('cleanedText', ''),
            'toxicityScore': c.get('toxicityScore', 0.0),
        }
        for c in comments if c.get('isToxic', False)
    ]
    logger.info(f"[Aggregation] Toxic comments: {len(toxic)}")
    return toxic


def aggregate_results(comments: List[Dict[str, Any]], topic_summaries: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Combine all per-comment analysis into aggregated summary statistics.
    This is the data structure that gets stored in MongoDB and sent to the frontend.
    """
    logger.info(f"[Aggregation] Aggregating results for {len(comments)} comments")

    return {
        'sentimentDistribution': aggregate_sentiment(comments),
        'aspectSentiment': aggregate_aspects(comments),
        'intentBreakdown': aggregate_intents(comments),
        'topicClusters': topic_summaries,
        'toxicComments': extract_toxic_comments(comments),
        'commentCount': len(comments),
    }
