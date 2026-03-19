from __future__ import annotations

from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import Database
from app.ids import make_chunk_uid
from app.openrouter import OpenRouterClient, build_citations
from app.retrieval import RetrievalService
from app.schemas import (
  AiAskRequest,
  AiIndexRequest,
  AskResponse,
  HealthResponse,
  IndexResponse,
)

settings = get_settings()
database = Database(settings.database_path)
openrouter = OpenRouterClient(settings)
retrieval = RetrievalService(settings, database, openrouter)


@asynccontextmanager
async def lifespan(_app: FastAPI):
  database.initialize()
  yield


app = FastAPI(title='LNReader AI Backend', version='0.1.0', lifespan=lifespan)
app.add_middleware(
  CORSMiddleware,
  allow_origins=['*'],
  allow_credentials=True,
  allow_methods=['*'],
  allow_headers=['*'],
)


@app.get('/health', response_model=HealthResponse)
async def health() -> HealthResponse:
  return HealthResponse(
    status='ok',
    databasePath=str(settings.database_path),
    embeddingModel=settings.embedding_model,
    rerankerModel=settings.reranker_model,
    openrouterModel=settings.openrouter_model,
    embeddingBackend='openrouter',
    rerankerBackend='openrouter',
    answerBackend='openrouter',
  )


@app.post('/index', response_model=IndexResponse)
async def index_chapter(payload: AiIndexRequest) -> IndexResponse:
  existing_checksums = database.get_existing_checksums(
    payload.namespace,
    payload.chapter_id,
  )
  changed_chunks = []
  changed_uids = []
  for chunk in payload.chunks:
    uid = make_chunk_uid(payload.namespace, chunk.chapter_id, chunk.chunk_index)
    if existing_checksums.get(uid) != chunk.checksum:
      changed_chunks.append(chunk.text)
      changed_uids.append(uid)
  embeddings = await openrouter.embed_texts(changed_chunks)
  embeddings_by_uid = dict(zip(changed_uids, embeddings, strict=False))
  chunk_ids = database.upsert_index_request(payload, embeddings_by_uid)
  return IndexResponse(chunkIds=chunk_ids)


@app.post('/ask', response_model=AskResponse)
async def ask_question(payload: AiAskRequest) -> AskResponse:
  if not payload.allowed_chunks:
    return AskResponse(
      answer='I do not have enough spoiler-safe context yet to answer that.',
      citations=[],
    )

  context_chunks = await retrieval.retrieve(payload)
  if not context_chunks:
    return AskResponse(
      answer='I do not have enough spoiler-safe context yet to answer that.',
      citations=[],
    )

  try:
    answer = await openrouter.answer(
      novel_name=payload.novel_name,
      chapter_name=payload.chapter_name,
      progress=payload.progress,
      selected_text=payload.selected_text,
      question=payload.question,
      chunks=context_chunks,
    )
  except Exception as error:  # pragma: no cover - network/provider failure path
    raise HTTPException(status_code=502, detail=str(error)) from error

  return AskResponse(
    answer=answer,
    citations=build_citations(context_chunks),
  )


def run() -> None:
  uvicorn.run(
    'app.main:app',
    host=settings.host,
    port=settings.port,
    reload=False,
    factory=False,
  )
