"""
Toxicity detection module using a pre-trained model (unitary/toxic-bert).

Decision rationale (documented for interview Q3):
- Toxicity is a secondary task — it flags comments but doesn't drive core analysis
- unitary/toxic-bert is already trained on large-scale toxicity datasets (Jigsaw/Google)
- Toxicity patterns are more universal than sentiment — they transfer well across domains
- Fine-tuning would require a labeled YouTube-specific toxicity dataset for marginal gain
- The mature engineering decision is to evaluate the pre-trained model on sample data first

The model outputs a toxicity score (0-1). Comments above the threshold
(config.TOXICITY_THRESHOLD) are flagged as toxic.
"""

import logging
from typing import List, Dict, Any

from transformers import pipeline as hf_pipeline

from app.config import config

logger = logging.getLogger(__name__)

# Lazy-loaded toxicity model
_toxicity_pipeline = None


def get_toxicity_pipeline():
    """
    Get or lazily initialize the toxicity detection pipeline.
    Uses unitary/toxic-bert (pre-trained, no fine-tuning).
    """
    global _toxicity_pipeline
    if _toxicity_pipeline is None:
        logger.info(f"[Toxicity] Loading model: {config.TOXICITY_MODEL_NAME}")
        _toxicity_pipeline = hf_pipeline(
            "text-classification",
            model=config.TOXICITY_MODEL_NAME,
            tokenizer=config.TOXICITY_MODEL_NAME,
            device=-1,
            top_k=None,  # Return all scores (toxic + non-toxic)
        )
        logger.info("[Toxicity] Model loaded successfully")
    return _toxicity_pipeline


def analyze_toxicity(comments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Run toxicity detection on all comments.
    
    Args:
        comments: List of comment dicts with 'cleanedText' field
    
    Returns:
        Comments with added fields: 'toxicityScore', 'isToxic'
    """
    if not comments:
        return comments

    logger.info(f"[Toxicity] Analyzing {len(comments)} comments")

    # Filter duplicates
    unique_comments = [c for c in comments if not c.get('isDuplicate', False)]
    texts = [c['cleanedText'] for c in unique_comments]

    pipe = get_toxicity_pipeline()

    # Batch inference
    results = pipe(texts, truncation=True, max_length=512)

    # Map toxicity scores back via textHash
    toxicity_map = {}
    for comment, result in zip(unique_comments, results):
        # result is a list of dicts: [{'label': 'toxic', 'score': 0.95}, {'label': 'not toxic', 'score': 0.05}]
        # Find the 'toxic' score
        toxic_score = 0.0
        for item in result:
            if 'toxic' in item['label'].lower() and 'not' not in item['label'].lower():
                toxic_score = float(item['score'])
                break
        toxicity_map[comment['textHash']] = toxic_score

    # Assign to all comments
    for comment in comments:
        hash_key = comment['textHash']
        score = toxicity_map.get(hash_key, 0.0)
        comment['toxicityScore'] = score
        comment['isToxic'] = score >= config.TOXICITY_THRESHOLD

    toxic_count = sum(1 for c in comments if c['isToxic'])
    logger.info(f"[Toxicity] Done: {toxic_count} toxic comments (threshold={config.TOXICITY_THRESHOLD})")

    return comments
