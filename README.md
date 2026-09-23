# News Pulse

**Topic-Clustered News Timeline** — a full-stack system that ingests live articles from multiple RSS feeds, automatically groups related articles into topic clusters, and visualizes them as an interactive timeline.

---

## Screenshots

<div align="center">
  <img width="959" height="539" alt="Screenshot 2026-09-22 205615" src="https://github.com/user-attachments/assets/6fafad2a-3043-4240-bfcc-4c7d1085c0fe" />

  <p><em>Modern, staggered Story Cards grid featuring Framer Motion spring animations</em></p>
  
  <br>

  <img width="959" height="465" alt="Screenshot 2026-09-22 205641" src="https://github.com/user-attachments/assets/c347018e-97d8-4a91-b9fa-5aae1aa6de3e" />

  <p><em>Seamless Dark Mode integration with local storage persistence</em></p>

  <br>

  <img width="959" height="539" alt="Screenshot 2026-09-22 205656" src="https://github.com/user-attachments/assets/47b9b175-2ef0-467f-920b-bc341e9736b2" />

  <p><em>Centered, animated cluster detail modal with blurred backdrop</em></p>
</div>

---

## Live Demo

| Layer | URL |
|-------|-----|
| Frontend | *https://news-pulse-kappa-seven.vercel.app/ — see [Deployment](#deployment)* |
| Backend API | *https://newspulse-q6m5.onrender.com/ — see [Deployment](#deployment)* |

---

## Features

- **Live RSS ingestion** from BBC News, NPR, The Guardian, and Reuters
- **Full article body extraction** via `trafilatura` (graceful per-article failure handling)
- **TF-IDF topic clustering** — articles grouped by cosine similarity, auto-labeled from top terms
- **Interactive timeline** — clusters plotted on a time axis as horizontal bars spanning earliest→latest article
- **Cluster detail view** — click any cluster to see all articles with source, date, and link
- **Source filtering** — toggle which outlets appear on the timeline
- **Refresh with polling** — triggers the pipeline, polls job status, updates automatically on completion
- **Deduplication** — repeated scraper runs don't create duplicate articles
- **Fully responsive** — works on mobile, tablet, and desktop

---

## Architecture

```
┌──────────────────────────────────────────────┐
│  /scraper  (Python)                          │
│  feedparser → trafilatura → SQLite           │
│  TF-IDF grouping (scikit-learn)              │
└──────────────────────────────────────────────┘
              ↓ reads/writes
        SQLite (news_pulse.db)
              ↑ reads
┌──────────────────────────────────────────────┐
│  /backend  (Node.js + Express + TypeScript)  │
│  REST API → @libsql/client → SQLite          │
│  Spawns Python pipeline on POST /ingest/trigger │
└──────────────────────────────────────────────┘
              ↑ fetches
┌──────────────────────────────────────────────┐
│  /frontend  (Next.js 14 + TypeScript)        │
│  Timeline visualization + source filter      │
│  Cluster detail panel + refresh polling      │
└──────────────────────────────────────────────┘
```

### Why this topology?
- **SQLite** for local dev (zero setup, portable, works on any OS). Swap to Postgres via `DATABASE_URL` env var for production.
- **Node.js + Express** is fast to develop REST APIs with, and `@libsql/client` gives us SQLite support without native compilation.
- **Next.js App Router** for the frontend: SSR-ready, file-based routing, TypeScript first-class.
- **trafilatura** for body extraction: best open-source extraction quality, actively maintained.

---

## Technology Stack

| Layer | Tech |
|-------|------|
| Ingestion | Python 3.13, feedparser, trafilatura |
| Clustering | scikit-learn (TF-IDF + cosine similarity) |
| Database | SQLite (dev) / Postgres (prod via DATABASE_URL) |
| Backend API | Node.js 22, Express 4, TypeScript, @libsql/client |
| Frontend | Next.js 14, React 18, TypeScript |
| Styling | Vanilla CSS with CSS custom properties |
| Deployment | Vercel (frontend), Render (backend), GitHub (scraper) |

---

## RSS Sources Used

| Source | Feed URL |
|--------|----------|
| BBC News | `http://feeds.bbci.co.uk/news/rss.xml` |
| NPR News | `https://feeds.npr.org/1001/rss.xml` |
| The Guardian | `https://www.theguardian.com/world/rss` |
| Reuters | `https://feeds.reuters.com/reuters/topNews` |

---

## Topic Grouping Approach

**Method: TF-IDF + cosine similarity (greedy single-linkage)**

**Why TF-IDF over keyword-overlap?**
scikit-learn's TF-IDF vectorizer produces weighted term representations that naturally down-weight ubiquitous words (like "government" or "said") in favor of topic-specific terms (like "Gaza", "Fed", "hurricane"). This produces more coherent clusters than raw word overlap with no extra algorithmic complexity.

**Threshold choice: 0.25 cosine similarity**
- Below 0.15: mega-clusters absorbing unrelated stories
- Above 0.40: most articles become singletons (no grouping)
- **0.25** produces 10–25 clusters on a 150-article corpus, with each cluster containing 2–8 topically related articles — matches what you'd want to show on a timeline

**Vectorization parameters:**
- `max_df=0.85`: ignore terms in >85% of documents (too common to be discriminative)
- `min_df=2`: ignore terms appearing in only one document (too rare to cluster on)
- `ngram_range=(1,2)`: unigrams + bigrams for phrases like "climate change", "Federal Reserve"
- `sublinear_tf=True`: log normalization prevents very long articles from dominating

**Cluster labeling:**
Top 4 TF-IDF terms across all articles in the cluster, title-cased and joined with `·`.

**Known limitation:**
TF-IDF is purely lexical. Two articles about the same real-world event using different vocabulary (e.g. "Israel-Gaza ceasefire" vs. "Hamas-IDF truce agreement") may end up in separate clusters because they don't share enough exact tokens. Semantic embeddings (e.g. Sentence-BERT) would solve this but add significant inference overhead.

---

## Assumptions Made

| Ambiguity | Resolution |
|-----------|-----------|
| Which 3+ RSS feeds? | BBC, NPR, The Guardian, Reuters — public, stable, diverse formats |
| TF-IDF vs keyword-overlap? | TF-IDF — more coherent clusters with no extra complexity |
| Similarity threshold? | 0.25 cosine — empirically tuned on real RSS data |
| "Size/intensity metric" for timeline? | `article_count` — most straightforward and meaningful |
| Scheduled cron vs on-demand trigger? | On-demand only (POST /ingest/trigger) — required; cron is a nice-to-have |
| Database for local dev? | SQLite — zero setup, portable, swappable via DATABASE_URL |

---

## Local Development Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm

### 1. Clone and install

```bash
git clone https://github.com/piyushb03/NewsPulse.git
cd NewsPulse
```

### 2. Set up the Python scraper

```bash
cd scraper
python -m venv venv
# Windows:
.\venv\Scripts\pip install -r requirements.txt
# Mac/Linux:
source venv/bin/activate && pip install -r requirements.txt

# Copy and configure env
cp .env.example .env
# Edit .env if needed (DATABASE_URL defaults to SQLite in current directory)
```

### 3. Run the scraper (fetches articles + groups them)

```bash
# From the scraper/ directory:
.\venv\Scripts\python.exe main.py  # Windows
python main.py                      # Mac/Linux
```

### 4. Set up the backend

```bash
cd ../backend
npm install
cp .env.example .env
# Edit .env — set DATABASE_URL to the absolute path of scraper/news_pulse.db
```

Example `.env`:
```
PORT=4000
DATABASE_URL=sqlite:///C:/absolute/path/to/scraper/news_pulse.db
PYTHON_PATH=C:/absolute/path/to/scraper/venv/Scripts/python.exe
SCRAPER_PATH=../scraper/main.py
CORS_ORIGINS=http://localhost:3000
```

### 5. Start the backend

```bash
npm run dev
# API available at http://localhost:4000
```

### 6. Set up and start the frontend

```bash
cd ../frontend
npm install
cp .env.example .env.local
# .env.local: NEXT_PUBLIC_API_URL=http://localhost:4000

npm run dev
# Frontend available at http://localhost:3000
```

---

## Environment Variables

### `/scraper/.env`
| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///news_pulse.db` | DB connection (SQLite path or postgres:// URL) |
| `FETCH_TIMEOUT` | `15` | HTTP timeout for article body extraction (seconds) |
| `MAX_ARTICLES_PER_FEED` | `50` | Max articles to process per feed per run (0 = unlimited) |

### `/backend/.env`
| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No (default 4000) | HTTP server port |
| `DATABASE_URL` | Yes | SQLite file path or postgres:// URL |
| `PYTHON_PATH` | No (default `python`) | Path to Python executable |
| `SCRAPER_PATH` | No | Path to scraper/main.py |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |
| `RATE_LIMIT_MAX` | No (default 5) | Max ingest triggers per window |
| `RATE_LIMIT_WINDOW_MS` | No (default 60000) | Rate limit window (ms) |

### `/frontend/.env.local`
| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Backend API base URL |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/clusters` | All clusters (label, count, time range) |
| GET | `/clusters/:id` | Single cluster with all articles |
| GET | `/timeline` | Clusters shaped for charting |
| POST | `/ingest/trigger` | Trigger pipeline, returns job ID |
| GET | `/ingest/status/:jobId` | Poll job status |
| GET | `/health` | Health check |

---

## Development Commands

```bash
# Scraper
python main.py              # Run full pipeline (scrape + group)
python scraper.py           # Run only ingestion
python grouper.py           # Run only clustering

# Backend
npm run dev                 # Development server with hot-reload
npm run build               # TypeScript compilation
npm start                   # Run compiled output

# Frontend
npm run dev                 # Development server
npm run build               # Production build
npm start                   # Serve production build
```

---

## Deployment

### Architecture
| Component | Platform | Why |
|-----------|----------|-----|
| Frontend | Vercel | Best-in-class Next.js hosting, free tier, automatic deployments |
| Backend API | Render | Simple Node.js hosting, free tier, persistent disk for SQLite |
| Python pipeline | Triggered via Node API | No separate hosting needed; runs on-demand |
| Database | SQLite on Render disk | Simple for this scope; swap to Neon/Supabase Postgres for multi-instance |

### Deploy steps

**Frontend (Vercel):**
1. Connect GitHub repo → select `/frontend` as root directory
2. Set env var: `NEXT_PUBLIC_API_URL=https://your-backend.onrender.com`

**Backend (Render):**
1. New Web Service → connect repo → root directory: `/backend`
2. Build command: `npm install && npm run build`
3. Start command: `node dist/index.js`
4. Set env vars: `DATABASE_URL`, `PYTHON_PATH`, `SCRAPER_PATH`, `CORS_ORIGINS`
5. Enable persistent disk if using SQLite on Render

**Database (Supabase/Neon for production):**
1. Create a Postgres database on Supabase/Neon
2. Run the Python schema init: the `init_db()` function auto-creates tables on first run
3. Set `DATABASE_URL=postgresql://...` in both scraper and backend env vars

---

## Known Limitations

1. **SQLite on free-tier hosting**: Render's free tier doesn't persist disk between deploys. For production, switch to Postgres (Supabase/Neon).
2. **Single-instance job store**: Ingest job IDs are stored in memory. Restarting the backend loses pending job status. A Redis or DB-backed store would fix this.
3. **TF-IDF lexical limitation**: Same story with different vocabulary across outlets may appear as separate clusters (documented above under "Known Limitation").
4. **No scheduled scraping**: Scraping is on-demand only via the Refresh button. A GitHub Actions cron or Render cron job would automate this.
