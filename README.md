# YouTube Comments Analyzer

A full-stack AI-powered YouTube comment analysis platform that fetches comments via the YouTube Data API, runs them through a multi-task NLP pipeline (sentiment, aspect-based sentiment, intent, toxicity, topic modeling), generates an LLM-powered executive summary, and displays everything on an interactive dashboard with semantic search.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  Port 3001 · Vite + TailwindCSS + Recharts + Framer Motion       │
│  Dashboard with charts, comment explorer, semantic search        │
└──────────────┬──────────────────────────────────┬───────────────┘
               │ REST API (axios)                  │
               ▼                                  │
┌──────────────────────────────────┐               │
│     Backend (Node.js + Express)   │               │
│  Port 5001 · Mongoose + Bull      │               │
│  YouTube API · Job Queue · Cache  │               │
└──────┬───────────────┬───────────┘               │
       │               │                            │
       ▼               ▼                            │
┌──────────┐   ┌──────────────────┐                │
│ MongoDB  │   │  AI Service       │               │
│ Port     │   │  (Python FastAPI) │               │
│ 27017    │   │  Port 8000        │               │
│          │   │                   │               │
│ Video    │   │  NLP Pipelines:   │               │
│ Analysis │   │  · Sentiment      │               │
│ Search   │   │  · Aspect         │               │
│ Index    │   │  · Intent         │               │
│          │   │  · Toxicity       │               │
│          │   │  · Topic Modeling │               │
│          │   │  · Timeline       │               │
│          │   │  · LLM Summary    │               │
│          │   │  · FAISS Search   │               │
└──────────┘   └──────────────────┘                │
                        │                           │
                        ▼                           │
                 ┌────────────┐                     │
                 │   Redis     │                     │
                 │  Port 6379  │                     │
                 │  (Job Queue)│                     │
                 └────────────┘                     │
```

## Tech Stack

| Layer | Technology | Justification |
|---|---|---|
| **Frontend** | React + Vite | Fast dev server, modern JSX, rich ecosystem |
| **Styling** | TailwindCSS | Utility-first, dark theme, rapid prototyping |
| **Charts** | Recharts | Declarative React charting, donut/bar/treemap |
| **Animations** | Framer Motion | Smooth transitions between loading → results |
| **Backend** | Node.js + Express | Lightweight API gateway, async I/O |
| **Database** | MongoDB + Mongoose | Flexible schema for nested comment data |
| **Queue** | Redis + Bull | Async job processing for long-running analysis |
| **AI Service** | Python + FastAPI | Native HuggingFace support, async endpoints |
| **Sentiment** | DistilBERT (SST-2) | Fast, lightweight, config-driven model swap |
| **Aspect/Intent** | Zero-shot NLI (DistilBERT-MNLI) | No labeled data needed, transfer learning |
| **Toxicity** | unitary/toxic-bert | Pre-trained on Jigsaw dataset, universal patterns |
| **Topic Modeling** | BERTopic | Unsupervised, dynamic topic discovery |
| **Embeddings** | all-MiniLM-L6-v2 | Compact sentence transformer for FAISS index |
| **Vector Search** | FAISS + spaCy NER | Semantic + keyword hybrid with adaptive weighting |
| **LLM Summary** | Groq API (Llama 3.1) | Free tier, LPU-accelerated, adapter pattern |
| **YouTube API** | Direct axios calls | Replaced googleapis SDK to fix connection issues |

## NLP Pipeline

The AI service runs 7 pipelines in parallelized sequence:

```
Raw Comments
    │
    ▼
1. Preprocessing ─── Text cleaning, emoji demojize, language detection, dedup
    │
    ▼
2. Sentiment ─────── DistilBERT batch inference (positive/negative)
    │
    ├─────────────────┬──────────────────────────────┐
    ▼                 ▼                              │
3a. Aspect ────► 3b. Intent    3c. Toxicity           │
    (zero-shot      (zero-shot    (toxic-bert)         │
     NLI)            NLI)                              │
    │                 │                 │              │
    └────────┬────────┘                 │              │
             ▼                           │              │
4. Topic Modeling (BERTopic) ◄──────────┘              │
    │                                                  │
    ▼                                                  │
5. Timeline Mapping ◄─────────────────────────────────┘
    │
    ▼
6. Aggregation ─── Sentiment dist, aspect breakdown, intent dist, topics, toxic
    │
    ▼
7. LLM Summarization ── Groq API generates 3-4 sentence executive summary
```

**Parallelism:** Steps 3a+3b (shared zero-shot classifier) run concurrently with 3c (toxicity) via `asyncio.gather` + `asyncio.to_thread`. PyTorch releases the GIL during inference, giving real parallelism between the two model branches.

## Semantic Search

The search system combines FAISS vector search with keyword matching using **adaptive hybrid ranking**:

| Query Type | Detection Method | Keyword Weight | Semantic Weight |
|---|---|---|---|
| Entity/number/timestamp | spaCy NER + regex | 0.5 | 0.5 |
| Descriptive phrase (>5 tokens) | Token length heuristic | 0.2 | 0.8 |
| Default | — | 0.3 | 0.7 |

Final score: `hybrid_score = semantic_weight * semantic_score + keyword_weight * keyword_score`

## Setup

### Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- **MongoDB** (running on `localhost:27017`)
- **Redis** (running on `localhost:6379`)
- **YouTube Data API v3 key** — Create at [Google Cloud Console](https://console.cloud.google.com/), enable YouTube Data API v3, generate an API key. Free quota: 10,000 units/day.
- **Groq API key** (free) — Sign up at [groq.com](https://groq.com), generate a key. Used for LLM summarization with Llama 3.1.

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:
```env
MONGODB_URI=mongodb://127.0.0.1:27017/yt-comments-analyzer
REDIS_HOST=localhost
REDIS_PORT=6379
YOUTUBE_API_KEY=your_youtube_api_key_here
AI_SERVICE_URL=http://localhost:8000
```

> Port 5001 is hard-coded in `src/config/index.js`. If port 5001 is busy, the backend will error instead of silently switching ports.

Start:
```bash
npm run dev
```

### 2. AI Service

```bash
cd ai-service
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

Create `ai-service/.env`:
```env
GROQ_API_KEY=your_groq_api_key_here
LLM_PROVIDER=groq
LLM_MODEL=llama-3.1-8b-instant
AI_SERVICE_PORT=8000
SENTIMENT_MODEL_NAME=distilbert-base-uncased-finetuned-sst-2-english
ZEROSHOT_MODEL_NAME=typeform/distilbert-base-uncased-mnli
TOXICITY_MODEL_NAME=unitary/toxic-bert
EMBEDDING_MODEL_NAME=all-MiniLM-L6-v2
```

Start:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:5001/api
```

> Port 3001 is hard-coded with `strictPort: true` in `vite.config.js`. If port 3001 is busy, Vite will error.

Start:
```bash
npm run dev
```

### 4. Start MongoDB and Redis

**MongoDB** (Windows):
```bash
# As a service (admin PowerShell):
net start MongoDB

# Or manually:
& "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe" --dbpath "C:\data\db"
```

**Redis**:
```bash
redis-server
```

## API Documentation

### Backend API (port 5001)

#### `POST /api/analyze`
Submit a YouTube URL for analysis.

```json
// Request
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "maxComments": 500
}

// Response (202 — new job)
{
  "jobId": "1",
  "videoId": "VIDEO_ID",
  "status": "queued",
  "message": "Analysis job created. Poll GET /api/analyze/status/1 for updates."
}

// Response (200 — cache hit, already analyzed)
{
  "jobId": null,
  "videoId": "VIDEO_ID",
  "status": "completed",
  "message": "Analysis already exists for this video"
}
```

#### `GET /api/analyze/status/:jobId`
Poll job status.

```json
{
  "jobId": "1",
  "status": "active",
  "progress": 50,
  "videoId": "VIDEO_ID"
}
```

Status values: `waiting` → `active` → `completed` / `failed`

#### `GET /api/results/:videoId`
Get full analysis results.

```json
{
  "video": {
    "videoId": "...",
    "title": "...",
    "thumbnailUrl": "...",
    "channelName": "...",
    "publishedAt": "...",
    "commentCount": 146,
    "analyzedAt": "..."
  },
  "analysis": {
    "sentimentDistribution": { "positive": 89, "negative": 32, "neutral": 25 },
    "aspectSentiment": [
      { "aspect": "content quality", "positive": 30, "negative": 5, "neutral": 10 }
    ],
    "intentBreakdown": [
      { "intent": "praise", "count": 45 },
      { "intent": "question", "count": 20 }
    ],
    "topicClusters": [
      {
        "topicId": 0,
        "topKeywords": ["tutorial", "helpful", "great"],
        "representativeComments": ["..."],
        "commentCount": 42
      }
    ],
    "timelineData": [
      {
        "timeStart": "3:00",
        "timeEnd": "4:00",
        "sentimentScore": 0.8,
        "commentCount": 12,
        "dominantSentiment": "positive"
      }
    ],
    "llmSummary": "The audience response is overwhelmingly positive...",
    "toxicComments": [
      { "commentId": "...", "text": "...", "toxicityScore": 0.92 }
    ],
    "comments": [
      {
        "commentId": "...",
        "text": "...",
        "author": "...",
        "likes": 42,
        "sentiment": "positive",
        "sentimentScore": 0.99,
        "aspect": "content quality",
        "aspectSentiment": "positive",
        "intent": "praise",
        "intentConfidence": 0.85,
        "toxicityScore": 0.01,
        "isToxic": false,
        "topicId": 0,
        "language": "en"
      }
    ]
  }
}
```

#### `GET /api/search/:videoId?query=...&mode=semantic|keyword|hybrid&topK=20`
Search comments by semantic meaning, keyword match, or hybrid.

```json
{
  "query": "audio quality",
  "mode": "hybrid",
  "results": [
    {
      "commentId": "...",
      "text": "the sound is terrible in this video",
      "sentiment": "negative",
      "semanticScore": 0.87,
      "keywordScore": 0.60,
      "hybridScore": 0.78
    }
  ]
}
```

#### `GET /api/health`
```json
{ "status": "ok", "message": "Backend service is running" }
```

### AI Service API (port 8000)

#### `POST /analyze`
Run all NLP pipelines on a batch of comments.

```json
// Request
{
  "comments": [
    { "commentId": "1", "text": "Great video!", "author": "user1", "likes": 5 }
  ]
}

// Response — same structure as backend /api/results analysis object
```

#### `GET /health`
```json
{ "status": "healthy" }
```

#### `POST /search`
Semantic/keyword/hybrid search with adaptive weighting.

#### `POST /embed`
Generate sentence embeddings for FAISS index building.

## Dashboard Components

| Component | Chart Type | Description |
|---|---|---|
| Header Card | — | Video title, thumbnail, channel, comment count, overall sentiment |
| Summary Card | — | LLM-generated executive summary (Groq/Llama 3.1) |
| Sentiment Distribution | Donut chart | Positive/negative/neutral percentages |
| Aspect-Based Sentiment | Horizontal bar chart | Per-aspect sentiment with color gradient |
| Intent Breakdown | Treemap | Proportion of each intent type |
| Timeline Sentiment | Bar chart | Sentiment intensity across video timestamps |
| Topic Clusters | Card grid | Topic keywords + representative comments |
| Toxic Comments | Collapsible list | Flagged comments with toxicity scores |
| Comment Explorer | Sortable table | All comments with per-comment classifications |
| Search Bar | — | Semantic/keyword/hybrid search with debounce |

## Key Design Decisions

### Why direct axios calls instead of googleapis?
The `googleapis` npm package produced "Premature close" connection errors in certain network environments. Direct `axios` HTTP calls with `keepAlive` agents are simpler, more predictable, and easier to debug.

### Why zero-shot NLI for aspect and intent?
No labeled YouTube-specific dataset exists for these tasks. Zero-shot classification with NLI models (trained on entailment) transfers well to general-purpose categories without task-specific training.

### Why pre-trained toxic-bert instead of fine-tuning?
Toxicity patterns are more universal than sentiment — hate speech transfers across domains. The mature engineering decision is to evaluate the pre-trained model first; fine-tuning adds effort for marginal gain on a secondary task.

### Why adaptive hybrid search instead of fixed weights?
Semantic search optimizes for recall (meaning-based matches). Keyword search optimizes for precision (exact matches). They fail in opposite directions. Adaptive weighting based on query type (entity detection via spaCy NER, timestamp regex, token length) gives the best of both.

### Why Groq for LLM summarization?
Free API tier with LPU-accelerated inference — extremely fast (sub-second) and no cost. The adapter pattern (`LLMProvider` base class) allows swapping to Ollama or HuggingFace without changing pipeline code.

## Interview Talking Points

- **Multi-task NLP pipeline** with parallelized model inference (`asyncio.gather` + `asyncio.to_thread`)
- **Zero-shot NLI classification** for aspect-based sentiment and intent — no labeled data needed
- **BERTopic** for unsupervised topic discovery with sentence transformer embeddings
- **Microservice architecture** with async task queue (Bull + Redis)
- **FAISS + adaptive hybrid search** with query-type detection (spaCy NER + regex)
- **LLM abstraction layer** with adapter pattern — Groq API with LPU-accelerated Llama 3.1
- **Prompt engineering** for aggregating multi-dimensional analysis into executive summary
- **Fine-tuning decision framework** — evaluate per-task whether fine-tuning is worth the cost

See `Important Interview Qs.md` for detailed Q&A on design decisions.

## Project Structure

```
yt-comments/
├── frontend/              # React + Vite + TailwindCSS + Recharts
│   ├── src/
│   │   ├── components/    # Dashboard, charts, search, comment explorer
│   │   ├── api/           # Axios API client
│   │   └── App.jsx
│   ├── vite.config.js     # Port 3001, strictPort
│   └── package.json
│
├── backend/               # Node.js + Express + MongoDB + Redis
│   ├── src/
│   │   ├── routes/        # analyze, results, search
│   │   ├── models/        # Video, AnalysisResult, SearchIndex
│   │   ├── services/      # YouTube API, AI client, search service
│   │   ├── queue/         # Bull job queue with retry logic
│   │   └── config/        # Hard-coded port 5001
│   └── package.json
│
├── ai-service/            # Python FastAPI NLP microservice
│   ├── app/
│   │   ├── routes/        # analyze, search, embed, health
│   │   ├── pipelines/     # sentiment, aspect, intent, toxicity, topic, timeline, summarization
│   │   ├── utils/         # model loader, aggregation, FAISS, preprocessing
│   │   ├── config.py      # Model names, LLM provider, thresholds
│   │   └── main.py        # FastAPI app
│   ├── requirements.txt
│   └── .env
│
├── .gitignore
└── README.md
```

## Ports

| Service | Port | Hard-coded |
|---|---|---|
| Frontend (Vite) | 3001 | Yes (`strictPort: true`) |
| Backend (Express) | 5001 | Yes (in `config/index.js`) |
| AI Service (FastAPI) | 8000 | Yes (in `.env`) |
| MongoDB | 27017 | Default |
| Redis | 6379 | Default |

If any port is busy, the service will error and ask you to close the conflicting process — no silent port shifting.

## Future Work

- **Fine-tune sentiment model** on `AmaanP314/youtube-comment-sentiment` (1M+ labeled YouTube comments) for domain-specific accuracy
- **Multilingual + Hinglish support** — LLM-based translation for Hindi written in English script
- **Emoji sentiment lexicon** — weighted emoji scoring beyond `demojize()`
- **Learning-to-rank** for search weight optimization (replace heuristic adaptive weighting with trained ranker)
- **Export results** — download analysis as PDF/JSON
