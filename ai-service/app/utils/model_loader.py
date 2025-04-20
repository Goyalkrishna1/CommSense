"""
Shared model loader for zero-shot classification.

Both aspect-based sentiment and intent classification use the same
zero-shot NLI model. This module ensures the model is loaded only once
and shared between pipelines to avoid duplicate memory usage.
"""

import logging
from transformers import pipeline as hf_pipeline

from app.config import config

logger = logging.getLogger(__name__)

# Singleton instance — shared across all pipelines that need zero-shot classification
_zeroshot_classifier = None


def get_zeroshot_classifier():
    """
    Get or lazily initialize the shared zero-shot classification pipeline.
    Used by both aspect_sentiment and intent modules.
    """
    global _zeroshot_classifier
    if _zeroshot_classifier is None:
        logger.info(f"[ModelLoader] Loading zero-shot model: {config.ZEROSHOT_MODEL_NAME}")
        _zeroshot_classifier = hf_pipeline(
            "zero-shot-classification",
            model=config.ZEROSHOT_MODEL_NAME,
            tokenizer=config.ZEROSHOT_MODEL_NAME,
            device=-1,  # CPU
        )
        logger.info("[ModelLoader] Zero-shot model loaded successfully")
    return _zeroshot_classifier
