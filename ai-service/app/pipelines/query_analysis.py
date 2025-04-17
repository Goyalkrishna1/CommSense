"""
Query analysis module for adaptive hybrid search weighting.

Analyzes the search query to determine the optimal blend between
semantic and keyword search:
- Entity/number/timestamp detected → keyword_weight = 0.5
- Descriptive phrase (token length > 5) → keyword_weight = 0.2
- Default → keyword_weight = 0.3

Uses regex for timestamp/number detection and spaCy NER for entity detection.
Falls back to regex-only if spaCy model is not installed.
"""

import re
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Regex patterns for query analysis
TIMESTAMP_PATTERN = re.compile(r'\b\d{1,2}:\d{2}\b')
NUMBER_PATTERN = re.compile(r'\b\d+\b')
URL_PATTERN = re.compile(r'https?://\S+|www\.\S+')

# spaCy NLP model (lazy-loaded)
_nlp = None


def _get_nlp():
    """
    Get or lazily initialize the spaCy NLP model for entity recognition.
    Falls back to None if spaCy model is not installed.
    """
    global _nlp
    if _nlp is None:
        try:
            import spacy
            _nlp = spacy.load("en_core_web_sm")
            logger.info("[QueryAnalyzer] spaCy model loaded (en_core_web_sm)")
        except Exception as e:
            logger.warning(f"[QueryAnalyzer] spaCy model not available, using regex-only: {e}")
            _nlp = False  # Mark as attempted but failed
    return _nlp if _nlp is not False else None


def analyze_query(query: str) -> Dict[str, Any]:
    """
    Analyze a search query to determine its characteristics and optimal search weighting.

    Args:
        query: Search query string

    Returns:
        Dict with:
        - hasTimestamp: bool
        - hasNumber: bool
        - hasEntity: bool (from spaCy NER, if available)
        - tokenCount: int
        - keywordWeight: float (0.0-1.0, weight for keyword search)
        - semanticWeight: float (0.0-1.0, weight for semantic search)
        - entities: list of detected entity texts
    """
    # Regex-based detection
    has_timestamp = bool(TIMESTAMP_PATTERN.search(query))
    has_number = bool(NUMBER_PATTERN.search(query)) and not has_timestamp
    has_url = bool(URL_PATTERN.search(query))

    # Token count (simple whitespace split)
    tokens = query.strip().split()
    token_count = len(tokens)

    # Entity detection via spaCy NER
    entities = []
    has_entity = False

    nlp = _get_nlp()
    if nlp:
        doc = nlp(query)
        entities = [ent.text for ent in doc.ents]
        has_entity = len(entities) > 0

    # Determine keyword weight based on query characteristics
    # Entities, numbers, and timestamps are exact-match signals → favor keyword search
    # Long descriptive phrases are semantic signals → favor semantic search
    if has_timestamp or has_number or has_entity or has_url:
        keyword_weight = 0.5
    elif token_count > 5:
        # Descriptive phrase — semantic search captures meaning better
        keyword_weight = 0.2
    else:
        # Default balanced weighting
        keyword_weight = 0.3

    semantic_weight = 1.0 - keyword_weight

    result = {
        "hasTimestamp": has_timestamp,
        "hasNumber": has_number,
        "hasEntity": has_entity,
        "hasUrl": has_url,
        "tokenCount": token_count,
        "keywordWeight": keyword_weight,
        "semanticWeight": semantic_weight,
        "entities": entities,
    }

    logger.info(
        f"[QueryAnalyzer] query='{query[:50]}' → "
        f"keyword_weight={keyword_weight}, semantic_weight={semantic_weight}, "
        f"entities={entities}, timestamp={has_timestamp}, number={has_number}"
    )

    return result
