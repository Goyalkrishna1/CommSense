import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Centralized configuration for the AI service.
# All model names and settings are read here so they can be
# changed in one place without modifying pipeline code.
class Config:
    # --- Server ---
    PORT = int(os.getenv('AI_SERVICE_PORT', '8000'))

    # --- LLM (Groq free tier) ---
    LLM_PROVIDER = os.getenv('LLM_PROVIDER', 'groq')
    LLM_MODEL = os.getenv('LLM_MODEL', 'llama-3.1-8b-instant')
    GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')

    # --- Sentiment Model (configurable: DistilBERT or RoBERTa) ---
    SENTIMENT_MODEL_NAME = os.getenv(
        'SENTIMENT_MODEL_NAME',
        'distilbert-base-uncased-finetuned-sst-2-english'
    )

    # --- Zero-shot Classification (aspect-based sentiment + intent) ---
    # Using distilled MNLI model (~260MB) instead of bart-large-mnli (1.63GB)
    # to avoid memory issues on machines with limited paging file size.
    # Trade-off: slight accuracy decrease, but much smaller memory footprint.
    ZEROSHOT_MODEL_NAME = os.getenv('ZEROSHOT_MODEL_NAME', 'typeform/distilbert-base-uncased-mnli')

    # --- Toxicity Detection (pre-trained) ---
    TOXICITY_MODEL_NAME = os.getenv('TOXICITY_MODEL_NAME', 'unitary/toxic-bert')

    # --- Embedding Model (sentence transformer for FAISS + BERTopic) ---
    EMBEDDING_MODEL_NAME = os.getenv('EMBEDDING_MODEL_NAME', 'all-MiniLM-L6-v2')

    # --- FAISS ---
    FAISS_INDEX_DIR = os.getenv('FAISS_INDEX_DIR', './data/faiss')

    # --- Aspect labels for zero-shot aspect-based sentiment ---
    ASPECT_LABELS = [
        "content quality",
        "audio/video quality",
        "pacing",
        "thumbnail/title relevance",
        "creator personality",
        "topic relevance",
    ]

    # --- Intent labels for zero-shot intent classification ---
    INTENT_LABELS = [
        "question",
        "feedback",
        "complaint",
        "praise",
        "suggestion",
        "off-topic",
    ]

    # --- Toxicity threshold ---
    TOXICITY_THRESHOLD = 0.5


config = Config()