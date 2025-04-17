"""
LLM summarization module using Groq API (free tier).

Implements an abstraction layer (factory pattern) so the LLM provider
can be swapped without modifying pipeline code:
- GroqProvider: uses groq Python package with llama-3.1-8b-instant (free, LPU-accelerated)
- Future: OllamaProvider for local LLM, HuggingFaceProvider for inference API

The summary is generated from aggregated analysis statistics, not raw comments,
to keep the prompt size small and the output focused.
"""

import logging
from typing import Dict, Any, Optional

from app.config import config

logger = logging.getLogger(__name__)


class LLMProvider:
    """Abstract base class for LLM providers (adapter pattern)."""

    def generate_summary(self, prompt: str) -> str:
        """Generate a text summary from a prompt. Must be implemented by subclasses."""
        raise NotImplementedError


class GroqProvider(LLMProvider):
    """
    Groq API provider — uses free tier with LPU-accelerated inference.
    Model: llama-3.1-8b-instant (fast, free, good for summarization).
    """

    def __init__(self):
        from groq import Groq
        self.client = Groq(api_key=config.GROQ_API_KEY)
        self.model = config.LLM_MODEL
        logger.info(f"[LLM] GroqProvider initialized with model: {self.model}")

    def generate_summary(self, prompt: str) -> str:
        """Generate a summary using the Groq API."""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an expert content analyst. Write concise, insightful "
                            "executive summaries of YouTube comment analysis data. "
                            "Highlight key patterns, notable sentiment trends, and actionable "
                            "insights for content creators. Keep it to 3-4 sentences."
                        ),
                    },
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
                max_tokens=300,
                temperature=0.7,
            )
            summary = response.choices[0].message.content.strip()
            logger.info(f"[LLM] Summary generated ({len(summary)} chars)")
            return summary
        except Exception as e:
            logger.error(f"[LLM] Groq API error: {e}")
            raise


# Factory: returns the configured LLM provider
_provider_instance = None


def get_llm_provider() -> Optional[LLMProvider]:
    """
    Factory function that returns the configured LLM provider instance.
    Returns None if no API key is configured (graceful degradation).
    """
    global _provider_instance
    if _provider_instance is None:
        if config.LLM_PROVIDER == "groq":
            if not config.GROQ_API_KEY or config.GROQ_API_KEY == "your_groq_api_key_here":
                logger.warning("[LLM] No Groq API key configured — summarization will be skipped")
                return None
            try:
                _provider_instance = GroqProvider()
            except Exception as e:
                logger.error(f"[LLM] Failed to initialize GroqProvider: {e}")
                return None
        else:
            logger.warning(f"[LLM] Unknown provider: {config.LLM_PROVIDER}")
            return None
    return _provider_instance


def build_summary_prompt(aggregated: Dict[str, Any]) -> str:
    """
    Build a structured prompt from aggregated analysis statistics.

    The prompt includes:
    - Sentiment distribution (positive/negative/neutral counts)
    - Top aspects with sentiment breakdown
    - Intent distribution
    - Top topic clusters with keywords
    - Toxic comment count
    """
    sentiment = aggregated.get('sentimentDistribution', {})
    total = sentiment.get('positive', 0) + sentiment.get('negative', 0) + sentiment.get('neutral', 0)

    # Sentiment section
    pos_pct = (sentiment.get('positive', 0) / total * 100) if total > 0 else 0
    neg_pct = (sentiment.get('negative', 0) / total * 100) if total > 0 else 0
    sentiment_section = (
        f"Sentiment: {pos_pct:.0f}% positive, {neg_pct:.0f}% negative "
        f"({total} total comments)"
    )

    # Aspect section
    aspects = aggregated.get('aspectSentiment', [])
    aspect_lines = []
    for a in aspects[:5]:
        aspect_lines.append(
            f"  - {a['aspect']}: {a.get('positive', 0)} positive, {a.get('negative', 0)} negative"
        )
    aspect_section = "Top aspects:\n" + "\n".join(aspect_lines) if aspect_lines else "No aspect data"

    # Intent section
    intents = aggregated.get('intentBreakdown', [])
    intent_lines = [f"  - {i['intent']}: {i['count']}" for i in intents[:6]]
    intent_section = "Intent distribution:\n" + "\n".join(intent_lines) if intent_lines else "No intent data"

    # Topic section
    topics = aggregated.get('topicClusters', [])
    topic_lines = []
    for t in topics[:3]:
        keywords = ", ".join(t.get('topKeywords', [])[:5])
        topic_lines.append(f"  - Topic {t['topicId']}: {keywords} ({t['commentCount']} comments)")
    topic_section = "Top topics:\n" + "\n".join(topic_lines) if topic_lines else "No topic data"

    # Toxicity section
    toxic_count = len(aggregated.get('toxicComments', []))
    toxic_section = f"Toxic comments: {toxic_count} flagged"

    prompt = f"""Analyze the following YouTube comment analysis data and write a 3-4 sentence executive summary:

{sentiment_section}

{aspect_section}

{intent_section}

{topic_section}

{toxic_section}

Write a concise summary highlighting the key patterns and what they mean for the content creator."""

    return prompt


def generate_summary(aggregated: Dict[str, Any]) -> Optional[str]:
    """
    Generate an LLM executive summary from aggregated analysis results.

    Args:
        aggregated: Dict with sentimentDistribution, aspectSentiment, intentBreakdown,
                    topicClusters, toxicComments

    Returns:
        Summary string, or None if LLM is not configured
    """
    provider = get_llm_provider()
    if provider is None:
        logger.info("[LLM] No provider available, skipping summarization")
        return None

    prompt = build_summary_prompt(aggregated)
    logger.info(f"[LLM] Generating summary from aggregated data ({len(prompt)} char prompt)")

    try:
        summary = provider.generate_summary(prompt)
        return summary
    except Exception as e:
        logger.error(f"[LLM] Summary generation failed: {e}")
        return None
