"""
Preprocessing module for YouTube comment cleaning and normalization.

Pipeline steps:
1. Text cleaning — remove URLs, HTML entities, excessive whitespace
2. Emoji handling — demojize to text tokens (preserves sentiment signal)
3. Language detection — flag non-English comments
4. Deduplication — hash-based exact match detection

Input: list of raw comment dicts
Output: list of cleaned comment dicts with preprocessing metadata
"""

import re
import hashlib
import logging
from typing import List, Dict, Any

import emoji
from langdetect import detect, LangDetectException

logger = logging.getLogger(__name__)


def clean_text(text: str) -> str:
    """
    Clean raw comment text by removing URLs, HTML entities, and excessive whitespace.
    Preserves punctuation and case (important for sentiment analysis).
    """
    # Remove URLs (http/https and www.)
    text = re.sub(r'https?://\S+|www\.\S+', '', text)

    # Remove HTML entities (e.g., &amp;, &lt;, &quot;)
    text = re.sub(r'&[a-zA-Z]+;', ' ', text)

    # Remove HTML tags if any (e.g., <br>, <a>)
    text = re.sub(r'<[^>]+>', '', text)

    # Normalize whitespace — collapse multiple spaces/newlines into single space
    text = re.sub(r'\s+', ' ', text).strip()

    return text


def handle_emojis(text: str) -> tuple[str, str]:
    """
    Convert emojis to text tokens using emoji.demojize().
    This preserves emoji sentiment signal for the model (e.g., 🤡 → :clown_face:).
    
    Returns:
        tuple: (demojized_text for model input, original_emojis string for display)
    """
    # Extract original emojis for frontend display
    original_emojis = ''.join(c for c in text if c in emoji.EMOJI_DATA)

    # Convert emojis to text tokens (e.g., 🤡 → :clown_face:)
    demojized_text = emoji.demojize(text, delimiters=(' ', ' '))

    # Clean up any double spaces introduced by demojize
    demojized_text = re.sub(r'\s+', ' ', demojized_text).strip()

    return demojized_text, original_emojis


def detect_language(text: str) -> str:
    """
    Detect the language of a comment using langdetect.
    Returns ISO 639-1 language code (e.g., 'en', 'hi', 'es').
    Falls back to 'unknown' for very short or undetectable text.
    """
    # langdetect needs at least a few words to work reliably
    if len(text.split()) < 3:
        return 'unknown'

    try:
        return detect(text)
    except LangDetectException:
        logger.debug(f"[Preprocessing] Could not detect language for text: {text[:50]}...")
        return 'unknown'


def compute_hash(text: str) -> str:
    """Compute SHA-256 hash of text for deduplication."""
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def preprocess_comments(comments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Full preprocessing pipeline for a batch of comments.
    
    Args:
        comments: List of raw comment dicts with keys: commentId, text, author, likes, publishedAt
    
    Returns:
        List of cleaned comment dicts with additional preprocessing fields:
        - cleanedText: text after cleaning + demojize
        - originalEmojis: extracted emojis for display
        - language: detected language code
        - textHash: SHA-256 hash for dedup
        - isDuplicate: bool flag
    """
    logger.info(f"[Preprocessing] Processing {len(comments)} comments")

    seen_hashes = set()
    processed = []

    for comment in comments:
        raw_text = comment.get('text', '')

        # Step 1: Clean text (remove URLs, HTML, whitespace)
        cleaned = clean_text(raw_text)

        # Skip empty comments after cleaning
        if not cleaned:
            logger.debug(f"[Preprocessing] Skipping empty comment: {comment.get('commentId')}")
            continue

        # Step 2: Handle emojis — demojize for model, preserve originals for display
        demojized_text, original_emojis = handle_emojis(cleaned)

        # Step 3: Language detection
        language = detect_language(demojized_text)

        # Step 4: Deduplication — hash-based exact match
        text_hash = compute_hash(demojized_text.lower())
        is_duplicate = text_hash in seen_hashes
        if not is_duplicate:
            seen_hashes.add(text_hash)

        processed_comment = {
            **comment,
            'cleanedText': demojized_text,
            'originalEmojis': original_emojis,
            'language': language,
            'textHash': text_hash,
            'isDuplicate': is_duplicate,
        }
        processed.append(processed_comment)

    duplicate_count = sum(1 for c in processed if c['isDuplicate'])
    non_english_count = sum(1 for c in processed if c['language'] != 'en' and c['language'] != 'unknown')
    logger.info(
        f"[Preprocessing] Done: {len(processed)} comments, "
        f"{duplicate_count} duplicates, {non_english_count} non-English"
    )

    return processed
