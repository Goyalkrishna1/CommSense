"""
Test script for Phase 1 NLP pipelines.

Run this script to verify all pipelines work on a hardcoded batch
of sample YouTube comments. This tests the full pipeline without
needing the backend or YouTube API.

Usage:
    cd ai-service
    venv\Scripts\python.exe -m app.test_pipeline
"""

import logging
import json
from app.pipelines.preprocessing import preprocess_comments
from app.pipelines.sentiment import analyze_sentiment
from app.pipelines.aspect_sentiment import analyze_aspects
from app.pipelines.intent import analyze_intents
from app.pipelines.toxicity import analyze_toxicity
from app.pipelines.topic_modeling import analyze_topics
from app.pipelines.timeline import build_timeline
from app.pipelines.summarization import generate_summary
from app.utils.aggregation import aggregate_results

# Configure logging to show timestamps and module names
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S',
)
logger = logging.getLogger(__name__)

# Sample YouTube comments covering various sentiment, intent, and language patterns
SAMPLE_COMMENTS = [
    {"commentId": "c1", "text": "This tutorial is amazing! Best explanation I've seen on this topic.", "author": "user1", "likes": 120, "publishedAt": "2024-01-15"},
    {"commentId": "c2", "text": "The audio quality is terrible, can barely hear you at 3:24", "author": "user2", "likes": 5, "publishedAt": "2024-01-15"},
    {"commentId": "c3", "text": "Could you make a video about deep learning next? 🙏", "author": "user3", "likes": 45, "publishedAt": "2024-01-16"},
    {"commentId": "c4", "text": "This video is trash and you're a fraud 🤡", "author": "user4", "likes": 2, "publishedAt": "2024-01-16"},
    {"commentId": "c5", "text": "Great pacing, not too fast not too slow. Perfect for beginners.", "author": "user5", "likes": 80, "publishedAt": "2024-01-17"},
    {"commentId": "c6", "text": "I've been waiting for this exact topic. Thank you so much!", "author": "user6", "likes": 200, "publishedAt": "2024-01-17"},
    {"commentId": "c7", "text": "The thumbnail is misleading, the video doesn't cover what it promises", "author": "user7", "likes": 15, "publishedAt": "2024-01-18"},
    {"commentId": "c8", "text": "You explain things so clearly, your teaching style is excellent 👏", "author": "user8", "likes": 95, "publishedAt": "2024-01-18"},
    {"commentId": "c9", "text": "What software do you use for the diagrams? Looks really clean", "author": "user9", "likes": 30, "publishedAt": "2024-01-19"},
    {"commentId": "c10", "text": "This is exactly what I needed for my exam prep. Bookmarked!", "author": "user10", "likes": 60, "publishedAt": "2024-01-19"},
    {"commentId": "c11", "text": "bhai this video is mast, loved every second of it", "author": "user11", "likes": 50, "publishedAt": "2024-01-20"},
    {"commentId": "c12", "text": "Too slow in the middle section, almost fell asleep. Otherwise good content.", "author": "user12", "likes": 8, "publishedAt": "2024-01-20"},
    {"commentId": "c13", "text": "First! Great video as always 🔥", "author": "user13", "likes": 3, "publishedAt": "2024-01-21"},
    {"commentId": "c14", "text": "I disagree with your point about gradient descent at 7:30. The math doesn't check out.", "author": "user14", "likes": 25, "publishedAt": "2024-01-21"},
    {"commentId": "c15", "text": "You should add timestamps in the description for easier navigation", "author": "user15", "likes": 40, "publishedAt": "2024-01-22"},
    {"commentId": "c16", "text": "This tutorial is amazing! Best explanation I've seen on this topic.", "author": "user16", "likes": 0, "publishedAt": "2024-01-22"},  # Duplicate of c1
    {"commentId": "c17", "text": "Wow, the production quality has improved so much since your last video!", "author": "user17", "likes": 70, "publishedAt": "2024-01-23"},
    {"commentId": "c18", "text": "Can you share the GitHub repo link for the code?", "author": "user18", "likes": 35, "publishedAt": "2024-01-23"},
    {"commentId": "c19", "text": "Stop making clickbait videos, this was a waste of time", "author": "user19", "likes": 1, "publishedAt": "2024-01-24"},
    {"commentId": "c20", "text": "The way you break down complex concepts is incredible. Subscribed!", "author": "user20", "likes": 150, "publishedAt": "2024-01-24"},
]


def main():
    logger.info("=" * 60)
    logger.info("Phase 1 Pipeline Test — Sample YouTube Comments")
    logger.info("=" * 60)

    # Step 1: Preprocessing
    logger.info("\n--- Step 1: Preprocessing ---")
    comments = preprocess_comments(SAMPLE_COMMENTS)
    logger.info(f"Preprocessed: {len(comments)} comments")
    for c in comments[:3]:
        logger.info(f"  [{c['commentId']}] cleaned='{c['cleanedText'][:60]}...' "
                     f"lang={c['language']} dup={c['isDuplicate']} emojis='{c['originalEmojis']}'")

    # Step 2: Sentiment analysis
    logger.info("\n--- Step 2: Sentiment Analysis ---")
    comments = analyze_sentiment(comments)
    for c in comments[:5]:
        logger.info(f"  [{c['commentId']}] sentiment={c['sentiment']} score={c['sentimentScore']:.3f}")

    # Step 3: Aspect-based sentiment
    logger.info("\n--- Step 3: Aspect-Based Sentiment ---")
    comments = analyze_aspects(comments)
    for c in comments[:5]:
        logger.info(f"  [{c['commentId']}] aspect={c['aspect']} conf={c['aspectConfidence']:.3f} "
                     f"sentiment={c['aspectSentiment']}")

    # Step 4: Intent classification
    logger.info("\n--- Step 4: Intent Classification ---")
    comments = analyze_intents(comments)
    for c in comments[:5]:
        logger.info(f"  [{c['commentId']}] intent={c['intent']} conf={c['intentConfidence']:.3f}")

    # Step 5: Toxicity detection
    logger.info("\n--- Step 5: Toxicity Detection ---")
    comments = analyze_toxicity(comments)
    toxic = [c for c in comments if c['isToxic']]
    logger.info(f"Toxic comments found: {len(toxic)}")
    for c in toxic:
        logger.info(f"  [{c['commentId']}] score={c['toxicityScore']:.3f} text='{c['cleanedText'][:60]}...'")

    # Step 6: Topic modeling
    logger.info("\n--- Step 6: Topic Modeling ---")
    comments, topic_summaries = analyze_topics(comments)
    for ts in topic_summaries:
        logger.info(f"  Topic {ts['topicId']}: keywords={ts['topKeywords'][:5]} ({ts['commentCount']} comments)")

    # Step 7: Timeline mapping
    logger.info("\n--- Step 7: Timeline Mapping ---")
    timeline_data = build_timeline(comments)
    logger.info(f"Timeline buckets: {len(timeline_data)}")
    for bucket in timeline_data[:5]:
        logger.info(f"  {bucket['timeStart']}–{bucket['timeEnd']}: {bucket['dominantSentiment']} (score={bucket['sentimentScore']}, {bucket['commentCount']} comments)")

    # Aggregate
    logger.info("\n--- Aggregation ---")
    results = aggregate_results(comments, topic_summaries)
    results['timelineData'] = timeline_data
    logger.info(f"Sentiment distribution: {results['sentimentDistribution']}")
    logger.info(f"Intent breakdown: {results['intentBreakdown']}")
    logger.info(f"Toxic comments: {len(results['toxicComments'])}")
    logger.info(f"Topics discovered: {len(results['topicClusters'])}")
    logger.info(f"Timeline buckets: {len(timeline_data)}")

    # Step 8: LLM Summarization (optional — requires Groq API key)
    logger.info("\n--- Step 8: LLM Summarization ---")
    llm_summary = generate_summary(results)
    if llm_summary:
        results['llmSummary'] = llm_summary
        logger.info(f"Summary: {llm_summary}")
    else:
        logger.info("LLM summarization skipped (no Groq API key configured)")

    logger.info("\n" + "=" * 60)
    logger.info("Pipeline test complete!")
    logger.info("=" * 60)

    # Print full JSON for inspection
    print("\nFull results JSON:")
    print(json.dumps(results, indent=2, default=str))


if __name__ == "__main__":
    main()
