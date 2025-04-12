from fastapi import FastAPI
from app.routes import analyze, search, health, embed

# FastAPI application for the YouTube Comments Analyzer AI service.
# This microservice handles all NLP pipeline operations:
# - Sentiment analysis (fine-tuned transformer)
# - Aspect-based sentiment (zero-shot NLI)
# - Intent classification (zero-shot NLI)
# - Toxicity detection (pre-trained)
# - Topic modeling (BERTopic)
# - Timeline sentiment mapping
# - LLM-powered executive summary (Groq API)
# - Semantic search (FAISS + sentence embeddings)
app = FastAPI(
    title="YouTube Comments Analyzer — AI Service",
    description="NLP microservice for comment analysis pipelines",
    version="0.1.0",
)

# Mount route handlers
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(analyze.router, prefix="/api", tags=["analyze"])
app.include_router(embed.router, prefix="/api", tags=["embed"])
app.include_router(search.router, prefix="/api", tags=["search"])