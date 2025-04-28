# Important Interview Questions

## Q1: Why include keyword matching alongside semantic search? Isn't semantic search enough?

Semantic search handles meaning-based variations well, but it breaks down in specific cases where **exact matching** matters:

| Scenario | Semantic Search | Keyword Search |
|---|---|---|
| "audio quality is bad" | ✅ Finds "can't hear anything", "volume too low" | ❌ Misses variations |
| "iPhone 15" | ❌ Returns iPhone 14, Samsung, etc. (semantically near-identical) | ✅ Finds exact mentions |
| "3:14" (timestamp) | ❌ No concept of timestamps | ✅ Finds exact reference |
| "OBS Studio" (proper noun) | ❌ Returns generic "recording software" | ✅ Finds exact product |
| "the part where he laughs" | ✅ Finds semantically related comments | ❌ Misses paraphrases |

**Core justification:**

> Semantic search optimizes for **recall** (finding related meaning). Keyword search optimizes for **precision** (finding exact matches). They fail in opposite directions, so you need both. Keyword search acts as a precision booster for entity/number/timestamp queries where semantic embeddings compress away the distinctions.

The weight is asymmetric: `hybrid_score = 0.7 * semantic_score + 0.3 * keyword_score` — semantic dominates, keyword rescues precision.

---

## Q2: How did you decide the weights 0.7 and 0.3? Why is it hardcoded?

### What we do in the project: Adaptive Weighting

Instead of one fixed weight, the weight adapts based on the query itself:

- If the query contains named entities, numbers, or timestamps → boost keyword weight (e.g., 0.5)
- If the query is a long descriptive phrase → boost semantic weight (e.g., 0.2)

Detection methods:
- **Named entities** → spaCy NER
- **Numbers / timestamps** → regex
- **Descriptive phrase** → token length heuristic

This is implemented in the project.

### Alternative to Adaptive Scoring: Learned Ranking (Learning-to-Rank)

This is the ideal upgrade path — frame weight selection as a **machine learning problem** instead of using heuristics:

**Step 1 — Build a training set:**
- Take 100+ queries
- For each query, retrieve top-20 comments using both semantic and keyword search
- Manually label each result as relevant (1) or not relevant (0)

**Step 2 — Train a lightweight ranker:**
- Features: `semantic_score`, `keyword_score`, `query_length`, `has_entity`, `has_number`
- Model: Logistic regression or small gradient-boosted tree (XGBoost / LightGBM)
- Target: relevance label
- The model learns the optimal weight combination — including adaptive weighting — automatically, without hardcoded rules

**Step 3 — Evaluate:**
- Use nDCG (normalized Discounted Cumulative Gain) or MRR (Mean Reciprocal Rank) on a held-out test set
- Compare against the adaptive heuristic approach to quantify improvement

**Why this is better than adaptive heuristics:**
- No manual threshold tuning (e.g., "what token length counts as 'descriptive'?")
- Learns non-linear interactions between features (e.g., entity presence + short query length might matter together)
- Can be retrained as more query data comes in
- Principled evaluation via ranking metrics instead of gut feeling

**Interview framing:**

> *"I started with adaptive heuristics based on query type detection using spaCy NER and regex. The natural next step is to frame this as a learning-to-rank problem — extract features like semantic similarity score, keyword match score, query length, and entity presence, then train a LightGBM ranker on labeled query-comment pairs. The model would learn optimal weight combinations automatically, including non-linear feature interactions that heuristics can't capture. I've designed this upgrade path but scoped it out for the current version."*

---

## Q3: Why did you fine-tune the sentiment model but use pre-trained models for toxicity and intent? Why not fine-tune everything?

Not every task benefits equally from fine-tuning. The decision should be driven by the task's importance, data availability, and whether a pre-trained model already performs well enough.

### Sentiment — Fine-tuned ✅

Sentiment is the **core task** of this project — it drives the sentiment distribution chart, aspect-based sentiment, timeline heatmap, and feeds into the LLM summary. It needs to be as accurate as possible on YouTube comment data specifically.

- YouTube comments have unique linguistic patterns: slang, emojis, sarcasm, abbreviations
- General-purpose sentiment models (trained on movie reviews, product reviews) miss these domain-specific patterns
- A large, domain-specific dataset is available: HuggingFace `AmaanP314/youtube-comment-sentiment` (1M+ labeled YouTube comments)
- Fine-tuning on this data adapts the model to the domain → measurably better performance
- This is the strongest, most defensible model in the pipeline

### Toxicity — Pre-trained (`unitary/toxic-bert`) ✅

Toxicity is a **secondary task** — it flags comments but doesn't drive the core analysis. Using a well-established pre-trained model is a pragmatic engineering decision:

- `unitary/toxic-bert` is already trained on large-scale toxicity datasets (Jigsaw/Google)
- Toxicity patterns are more universal than sentiment — hate speech and toxic language patterns transfer well across domains
- Fine-tuning would require a labeled toxicity dataset specific to YouTube comments, which adds effort for marginal gain
- **The mature engineering decision is to evaluate the pre-trained model on your data first.** If it performs well (high precision/recall on a sample), fine-tuning is unnecessary. This shows more judgment than blindly fine-tuning everything — real AI engineers evaluate before deciding to fine-tune.

### Intent Classification — Zero-shot (`facebook/bart-large-mnli`) ✅

Intent classification uses **zero-shot NLI (Natural Language Inference)** — no fine-tuning needed:

- Intent categories (question, feedback, complaint, praise, suggestion, off-topic) are general-purpose, not domain-specific
- `bart-large-mnli` is pre-trained on NLI tasks and performs well on zero-shot classification across domains
- No labeled YouTube intent dataset is readily available — creating one would be a significant annotation effort
- Zero-shot is defensible as a **transfer learning approach** — leveraging a model trained on one task (NLI) for another (intent classification) without task-specific training
- If intent accuracy is insufficient, the upgrade path is clear: collect labeled data and fine-tune. But zero-shot is the right starting point.

### Summary

| Task | Approach | Why |
|---|---|---|
| Sentiment | Fine-tuned | Core task, domain-specific data available, measurable improvement |
| Toxicity | Pre-trained | Secondary task, pre-trained model already strong, universal toxicity patterns |
| Intent | Zero-shot | No labeled data available, general-purpose categories, transfer learning is sufficient |

**Interview framing:**

> *"I made the fine-tuning decision per-task, not globally. Sentiment is the core task driving most of the dashboard, and YouTube comments have domain-specific language patterns that general models miss — so I fine-tuned on a 1M+ YouTube comment dataset. For toxicity, I evaluated the pre-trained unitary/toxic-bert on sample data and found it performed well — toxicity patterns are more universal than sentiment, so fine-tuning would add effort for marginal gain. For intent classification, I used zero-shot NLI with bart-large-mnli because no labeled YouTube intent dataset exists, and the categories are general-purpose enough that transfer learning works well. The key principle is: evaluate first, then decide whether fine-tuning is worth the cost — don't fine-tune everything just because you can."*

---

## Q4: Is adding multilingual support as simple as adding a translation API call? What about Hinglish (Hindi written in English script)? How are emojis handled?

It is **not** as simple as just adding a translation API call. Each case has real challenges.

### Case 1: Standard Multilingual Comments (Hindi in Devanagari, Spanish, Arabic, etc.)

This is the "easy" case, but still has real challenges.

**What seems simple:**
- Detect language → translate to English → run through existing NLP pipeline

**What's actually complex:**

**1. Translation quality degrades NLP accuracy**
- Translation introduces noise. A sarcastic comment in Hindi might translate literally to English, losing the sarcasm. Your sentiment model now analyzes a *worse version* of the original text.
- Idioms don't translate: "हाथ मलना" (rubbing hands) literally translates to "rubbing hands" but means "to regret" — sentiment is completely different.

**2. Sentiment is language-specific**
- "मस्त वीडियो" (mast video) → "mast" translates to "fun/great" but also to "intoxicated" depending on context. A translation API might pick the wrong meaning.
- Pre-trained sentiment models trained on English don't understand cultural sentiment expressions. A fine-tuned model on English YouTube comments won't work well on translated text because the translation doesn't preserve the colloquial tone.

**3. Two valid approaches — with different trade-offs:**

| Approach | How | Pros | Cons |
|---|---|---|---|
| **Translate-then-analyze** | Detect language → translate to English → run English NLP models | Simple, reuses existing pipeline | Translation noise, lost cultural context, idiom errors |
| **Language-specific models** | Detect language → route to language-specific NLP model (e.g., a Hindi BERT) | Preserves original text, better accuracy | Need separate models per language, more compute, more maintenance |

**4. Language detection itself isn't perfect**
- Short comments ("nice", "good", "👍") are hard to classify — is "nice" English or is the commenter just using a common English word in a non-English context?
- Mixed-language comments: "This video is बहुत bad" — what language is this? Most detectors pick one, losing half the content.

### Case 2: Hinglish (Hindi written in English script) — The Hard Case

This is where it gets genuinely difficult. Hinglish is **not** a standardized language — it's a colloquial mix with no official grammar or spelling rules.

**Why Hinglish breaks standard approaches:**

**1. Language detection fails**
- "bhai this video is mast" — language detectors classify this as **English** (because it's written in Latin script). It won't be routed to Hindi translation or Hindi models.
- So your translate-then-analyze pipeline **never even triggers** for Hinglish — it goes straight to your English sentiment model, which doesn't understand "mast", "bhai", "kya", "matlab", etc.

**2. Translation APIs don't handle Hinglish well**
- Google Translate, NLLB, etc. are trained on standard languages (English, Hindi in Devanagari). Hinglish isn't a "language" in their training data.
- "bhai ye video kaisa hai" → Google Translate might output "brother how is this video" — literal, awkward, loses conversational tone.
- Some modern LLMs (GPT-4, Llama 3) handle Hinglish better because they've seen it in training data, but it's inconsistent.

**3. No standard spelling**
- "kya" / "kia" / "kiya" — same word, three spellings
- "acha" / "accha" / "achha" — same word, three spellings
- "matlab" / "matlub" — same word, different spellings
- You can't build a simple dictionary mapping. You'd need fuzzy matching or a model that handles the variation.

**4. Code-switching within a single comment**
- "this tutorial is good but thoda slow hai" — English + Hinglish in one sentence
- "bhai next video mein deep learning cover karna" — mostly Hinglish with English technical terms
- Your NLP model needs to handle **intra-sentence code-switching**, not just per-comment language routing.

**Realistic approaches for Hinglish:**

| Approach | Feasibility | Accuracy | Effort |
|---|---|---|---|
| **Romanized Hindi → Devanagari transliteration, then translate** | Use a transliteration model (e.g., AI4Bharat's IndicXlit) to convert "bhai" → "भाई", then translate to English | Medium — transliteration is imperfect for informal spellings | High |
| **Fine-tune a multilingual model on Hinglish data** | Use a model like XLM-RoBERTa or MuRIL, fine-tune on labeled Hinglish YouTube comments | High — if you have labeled Hinglish data | Very high — need to collect and label Hinglish dataset |
| **LLM-based translation** | Use Groq/Llama 3 to translate Hinglish → English (LLMs handle Hinglish better than traditional MT) | Medium-high — LLMs have seen Hinglish in training | Low — just a prompt change |
| **Hinglish-aware sentiment lexicon** | Build a custom dictionary of common Hinglish sentiment words ("mast" = positive, "bakwas" = negative, "faltu" = negative) | Low — can't cover all variations | Medium |

**Most practical for this project:** LLM-based translation (using Groq/Llama 3 you already have). Add a Hinglish detection step (heuristic: Latin script + presence of common Hinglish tokens), then use the LLM to translate before analysis. Not perfect, but defensible and implementable.

### Case 3: Emoji Handling

Emojis are surprisingly important in YouTube comments — they carry significant sentiment signal.

**The challenge:**

**1. Emojis carry sentiment independently of text**
- "great video 🤡" — text says positive, but 🤡 (clown) often means "you're a joke" in modern usage. The actual sentiment is **negative/sarcastic**.
- "nice 👏" — 👏 amplifies the positive sentiment
- "ok 🙏" — 🙏 in Indian context often means "please" or "respect", not just "praying"

**2. Current plan's approach (strip emojis for model input)**
- The plan says: "Emoji extraction (preserve for display, strip for model input)"
- This is the **simplest** approach but **loses sentiment signal** — "great video 🤡" and "great video ❤️" would get the same sentiment score

**3. Better approaches:**

| Approach | How | Trade-off |
|---|---|---|
| **Strip emojis (current plan)** | Remove emojis before model inference | Simple, but loses emoji sentiment signal |
| **Convert emojis to text** | Replace 🤡 with "clown", ❤️ with "heart" using `emoji` Python library → `emoji.demojize()` | Model sees "great video :clown_face:" — better than nothing, but model doesn't know "clown_face" is negative |
| **Emoji sentiment lexicon** | Map each emoji to a sentiment score using a pre-built emoji sentiment lexicon (e.g., Emoji Sentiment Ranking dataset). Combine with text sentiment: `final_score = α * text_sentiment + β * emoji_sentiment` | More accurate, but needs a separate emoji scoring step |
| **Use a model trained with emojis** | Some models (e.g., `cardiffnlp/twitter-roberta-base-sentiment`) are trained on social media text that includes emojis | Best accuracy, but limits model choice |

**4. Sarcasm + emoji interaction**
- This is an unsolved problem in NLP generally. No simple solution. Worth mentioning as a known limitation in interviews rather than trying to solve it.

**Recommendation for the project:**

Use **`emoji.demojize()`** to convert emojis to text tokens before model input. This is a one-line change that preserves emoji information without needing a separate emoji sentiment model. Then in the README/interview, mention that a dedicated emoji sentiment lexicon would be the next step.

### Summary: Is Multilingual "Just an API Call"?

| Case | Complexity | Honest Answer |
|---|---|---|
| Standard multilingual (Devanagari Hindi, Spanish, etc.) | Medium | Not just an API call — translation introduces noise, you lose cultural context, and you need to decide between translate-then-analyze vs language-specific models |
| Hinglish (Hindi in English script) | High | Hardest case. Language detection fails, translation APIs don't handle it well, no standard spelling, code-switching within sentences. LLM-based translation is the most practical approach. |
| Emoji handling | Medium | Stripping loses signal. `demojize()` is a good middle ground. Emoji sentiment lexicon is the upgrade. Sarcasm+emoji is an open problem. |

**Interview framing:**

> *"Multilingual support is not just plugging in a translation API. Translation introduces noise — idioms break, cultural sentiment expressions get lost, and sarcasm doesn't survive translation. For standard languages, there's a trade-off between translate-then-analyze (simple but lossy) and language-specific models (accurate but expensive to maintain). Hinglish is the hardest case — language detectors classify it as English because it's in Latin script, so the translation pipeline never triggers. Translation APIs don't handle it well because it's not a standardized language. The most practical approach is LLM-based translation, since LLMs have seen Hinglish in training data. For emojis, stripping them loses sentiment signal — 'great video 🤡' is sarcastic, not positive. I'd use emoji.demojize() to convert emojis to text tokens as a middle ground, with an emoji sentiment lexicon as the upgrade path."*
