"""
Topic modeling module using BERTopic.

BERTopic performs unsupervised topic discovery on comments:
1. Embeds comments using sentence-transformers (all-MiniLM-L6-v2)
2. Reduces dimensionality with UMAP
3. Clusters with HDBSCAN
4. Extracts topic keywords with c-TF-IDF

Output: topic assignments per comment + topic keyword summaries.
"""

import logging
from typing import List, Dict, Any

from bertopic import BERTopic
from sentence_transformers import SentenceTransformer
from hdbscan import HDBSCAN
from umap import UMAP

from app.config import config

logger = logging.getLogger(__name__)

# Lazy-loaded embedding model (shared with search module in Phase 4)
_embedding_model = None
_topic_model = None


def get_embedding_model():
    """Get or lazily initialize the sentence transformer for embeddings."""
    global _embedding_model
    if _embedding_model is None:
        logger.info(f"[TopicModel] Loading embedding model: {config.EMBEDDING_MODEL_NAME}")
        _embedding_model = SentenceTransformer(config.EMBEDDING_MODEL_NAME)
        logger.info("[TopicModel] Embedding model loaded successfully")
    return _embedding_model


def analyze_topics(comments: List[Dict[str, Any]]) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Run BERTopic topic modeling on all comments.
    
    Args:
        comments: List of comment dicts with 'cleanedText' field
    
    Returns:
        tuple: (comments with 'topicId' field, list of topic summaries)
    """
    if not comments or len(comments) < 5:
        logger.info("[TopicModel] Too few comments for topic modeling, skipping")
        for c in comments:
            c['topicId'] = -1
        return comments, []

    logger.info(f"[TopicModel] Modeling topics for {len(comments)} comments")

    # Get texts for topic modeling
    texts = [c['cleanedText'] for c in comments]

    # Initialize BERTopic with the sentence transformer embedding model
    # Tune HDBSCAN and UMAP for small datasets (YouTube comments batches can be small)
    embedding_model = get_embedding_model()

    # HDBSCAN: min_cluster_size=2 allows topics with as few as 2 comments
    # This is necessary because comment batches may be small and diverse
    hdbscan_model = HDBSCAN(min_cluster_size=2, min_samples=1, prediction_data=True)

    # UMAP: n_neighbors should be less than n_samples for small datasets
    n_neighbors = min(15, len(texts) - 1)
    umap_model = UMAP(n_neighbors=n_neighbors, n_components=5, metric='cosine', random_state=42)

    topic_model = BERTopic(
        embedding_model=embedding_model,
        umap_model=umap_model,
        hdbscan_model=hdbscan_model,
        language='english',
        calculate_probabilities=False,
        verbose=True,
    )

    # Fit and transform — returns topic assignments and probabilities
    topics, _ = topic_model.fit_transform(texts)

    # Assign topic IDs back to comments
    for comment, topic_id in zip(comments, topics):
        comment['topicId'] = int(topic_id)

    # Extract topic summaries for the response
    topic_info = topic_model.get_topic_info()
    topic_summaries = []

    for _, row in topic_info.iterrows():
        if row['Topic'] == -1:
            # Topic -1 is the "outlier" cluster (comments that didn't fit any topic)
            continue

        topic_id = int(row['Topic'])
        topic_words = topic_model.get_topic(topic_id)
        top_keywords = [word for word, _ in topic_words[:10]]

        # Find representative comments for this topic
        topic_comments = [c for c in comments if c['topicId'] == topic_id]
        representative = [c['cleanedText'][:200] for c in topic_comments[:3]]

        topic_summaries.append({
            'topicId': topic_id,
            'topKeywords': top_keywords,
            'representativeComments': representative,
            'commentCount': len(topic_comments),
        })

    # Sort by comment count (most common topics first)
    topic_summaries.sort(key=lambda x: x['commentCount'], reverse=True)

    logger.info(f"[TopicModel] Done: {len(topic_summaries)} topics discovered")
    for ts in topic_summaries:
        logger.info(f"  Topic {ts['topicId']}: {ts['topKeywords'][:5]} ({ts['commentCount']} comments)")

    return comments, topic_summaries
