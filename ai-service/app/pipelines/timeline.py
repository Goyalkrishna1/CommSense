"""
Timeline mapping module — maps comments to video timestamps and
computes sentiment intensity per time bucket.

Approach:
1. Parse comments for timestamp references (regex: MM:SS or H:MM:SS patterns)
2. Bucket comments into time intervals (default: 60-second buckets)
3. For each bucket: compute sentiment distribution → dominant sentiment + intensity
4. Output: [{time_start, time_end, sentiment_score, comment_count, dominant_sentiment}]

This creates a timeline view showing how audience sentiment varies
across different parts of the video.
"""

import re
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# Regex patterns for timestamp extraction from comment text
# Matches: 3:24, 12:05, 1:23:45, 0:45
TIMESTAMP_PATTERN = re.compile(r'\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b')

# Default bucket size in seconds (1 minute)
DEFAULT_BUCKET_SIZE = 60


def parse_timestamp_seconds(match) -> int:
    """
    Convert a regex timestamp match to total seconds.

    Handles both MM:SS and H:MM:SS formats.
    """
    groups = match.groups()
    if groups[2] is not None:
        # H:MM:SS format
        hours = int(groups[0])
        minutes = int(groups[1])
        seconds = int(groups[2])
        return hours * 3600 + minutes * 60 + seconds
    else:
        # MM:SS format
        minutes = int(groups[0])
        seconds = int(groups[1])
        return minutes * 60 + seconds


def extract_timestamps(text: str) -> List[int]:
    """
    Extract all timestamp references from a comment text.
    Returns a list of timestamps in seconds.
    """
    timestamps = []
    for match in TIMESTAMP_PATTERN.finditer(text):
        seconds = parse_timestamp_seconds(match)
        # Sanity check: timestamp should be within a reasonable video length (< 24 hours)
        if 0 <= seconds < 86400:
            timestamps.append(seconds)
    return timestamps


def build_timeline(comments: List[Dict[str, Any]], bucket_size: int = DEFAULT_BUCKET_SIZE) -> List[Dict[str, Any]]:
    """
    Build timeline sentiment data from comments.

    For each comment that references a video timestamp:
    1. Assign it to a time bucket based on the referenced timestamp
    2. Track sentiment (positive/negative) for each bucket
    3. Compute dominant sentiment and intensity (sentiment score) per bucket

    Args:
        comments: List of comment dicts with 'cleanedText' and 'sentiment' fields
        bucket_size: Time bucket size in seconds (default: 60)

    Returns:
        List of timeline buckets: [{time_start, time_end, sentiment_score, comment_count, dominant_sentiment}]
    """
    if not comments:
        logger.info("[Timeline] No comments to process")
        return []

    logger.info(f"[Timeline] Building timeline from {len(comments)} comments (bucket_size={bucket_size}s)")

    # Collect all timestamp-referenced comments into buckets
    buckets = {}  # bucket_start -> {positive, negative, neutral, total}

    for comment in comments:
        text = comment.get('cleanedText', comment.get('text', ''))
        sentiment = comment.get('sentiment', 'neutral')

        timestamps = extract_timestamps(text)
        if not timestamps:
            continue

        # Use the first timestamp found in the comment
        ts = timestamps[0]
        bucket_start = (ts // bucket_size) * bucket_size

        if bucket_start not in buckets:
            buckets[bucket_start] = {
                'positive': 0,
                'negative': 0,
                'neutral': 0,
                'total': 0,
            }

        buckets[bucket_start][sentiment] = buckets[bucket_start].get(sentiment, 0) + 1
        buckets[bucket_start]['total'] += 1

    if not buckets:
        logger.info("[Timeline] No timestamp references found in comments")
        return []

    # Convert buckets to sorted timeline data
    timeline = []
    for bucket_start in sorted(buckets.keys()):
        data = buckets[bucket_start]
        total = data['total']
        pos = data.get('positive', 0)
        neg = data.get('negative', 0)
        neu = data.get('neutral', 0)

        # Sentiment score: (positive - negative) / total, range [-1, 1]
        sentiment_score = (pos - neg) / total if total > 0 else 0

        # Dominant sentiment
        if pos > neg and pos > neu:
            dominant = 'positive'
        elif neg > pos and neg > neu:
            dominant = 'negative'
        else:
            dominant = 'neutral'

        # Format time as MM:SS
        def format_time(seconds):
            m, s = divmod(seconds, 60)
            return f"{m}:{s:02d}"

        timeline.append({
            'timeStart': format_time(bucket_start),
            'timeEnd': format_time(bucket_start + bucket_size),
            'sentimentScore': round(sentiment_score, 3),
            'commentCount': total,
            'dominantSentiment': dominant,
        })

    logger.info(f"[Timeline] Built {len(timeline)} timeline buckets")
    return timeline
