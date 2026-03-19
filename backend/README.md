# LNReader AI Backend

Local single-user backend for LNReader's AI novel indexing and spoiler-safe Q&A.

It does three things:

- indexes chapter chunks from the app via `POST /index`
- performs hybrid retrieval via OpenRouter embeddings + local BM25 via `POST /ask`
- calls OpenRouter for the final answer using your `OPENROUTER_API_KEY`

## Stack

- FastAPI
- SQLite for chunk storage
- SQLite FTS5 for BM25 search
- OpenRouter embeddings API with `BAAI/bge-m3`
- OpenRouter chat/completions for reranking
- OpenRouter chat/completions for `qwen/qwen3-235b-a22b-2507`

## Setup

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set:

```bash
OPENROUTER_API_KEY=...
```

Then install and run:

```bash
uv sync
uv run lnreader-ai-backend
```

The backend listens on `http://0.0.0.0:8001` by default.

## App Configuration

In LNReader, open `Settings > AI` and set:

- `Backend URL`: one of the following
  - Android emulator: `http://10.0.2.2:8001`
  - Real device on same network: `http://YOUR_LAN_IP:8001`
- `API key`: leave blank unless you later add your own backend auth

## Notes

- No local LLM or local embedding model is run by this backend.
- The backend stores chunks and embeddings in `backend/data/`.
- BM25 is local SQLite FTS5 only.
- Dense embeddings, reranking, and answer generation all go through OpenRouter.

## Endpoints

- `GET /health`
- `POST /index`
- `POST /ask`

## Smoke Test

Health:

```bash
curl http://127.0.0.1:8001/health
```

Minimal index call:

```bash
curl -X POST http://127.0.0.1:8001/index \
  -H 'Content-Type: application/json' \
  -d '{
    "novelId": 1,
    "novelName": "Demo Novel",
    "namespace": "novel-1",
    "chapterId": 10,
    "chapterName": "Chapter 10",
    "chapterPosition": 9,
    "chapterPage": "1",
    "chunks": [
      {
        "chapterId": 10,
        "chapterName": "Chapter 10",
        "chapterPosition": 9,
        "chapterPage": "1",
        "chunkIndex": 0,
        "startOffset": 0,
        "endOffset": 180,
        "startProgress": 0,
        "endProgress": 40,
        "text": "The hero enters the city and meets the guard captain.",
        "checksum": "demo-1"
      }
    ]
  }'
```

Minimal ask call:

```bash
curl -X POST http://127.0.0.1:8001/ask \
  -H 'Content-Type: application/json' \
  -d '{
    "novelId": 1,
    "novelName": "Demo Novel",
    "namespace": "novel-1",
    "chapterId": 10,
    "chapterName": "Chapter 10",
    "chapterPosition": 9,
    "progress": 40,
    "selectedText": "meets the guard captain",
    "question": "Who does the hero meet here?",
    "allowedChunks": [
      {
        "chapterId": 10,
        "chapterPosition": 9,
        "chunkIndex": 0,
        "startProgress": 0,
        "endProgress": 40,
        "textPreview": "The hero enters the city and meets the guard captain.",
        "remoteChunkId": "novel-1:10:0"
      }
    ]
  }'
```
