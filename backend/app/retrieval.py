from __future__ import annotations

import re
from typing import Iterable

from app.config import Settings
from app.db import Database, StoredChunk
from app.ids import make_chunk_uid
from app.openrouter import OpenRouterClient
from app.schemas import AiAskRequest

TOKEN_RE = re.compile(r'[a-zA-Z0-9]{2,}')
RRF_K = 60


def build_query_text(selected_text: str, question: str) -> str:
  selected = selected_text.strip()
  prompt = question.strip()
  if selected:
    return f'Selected passage:\n{selected}\n\nQuestion:\n{prompt}'
  return prompt


def build_bm25_query(text: str) -> str:
  tokens = []
  seen: set[str] = set()
  for match in TOKEN_RE.finditer(text.lower()):
    token = match.group(0)
    if token not in seen:
      seen.add(token)
      tokens.append(token)
  return ' OR '.join(tokens)


def reciprocal_rank_fusion(rankings: Iterable[list[str]]) -> list[str]:
  scores: dict[str, float] = {}
  for ranking in rankings:
    for position, uid in enumerate(ranking, start=1):
      scores[uid] = scores.get(uid, 0.0) + 1.0 / (RRF_K + position)
  return [uid for uid, _score in sorted(scores.items(), key=lambda item: item[1], reverse=True)]


class RetrievalService:
  def __init__(
    self,
    settings: Settings,
    database: Database,
    openrouter: OpenRouterClient,
  ):
    self.settings = settings
    self.database = database
    self.openrouter = openrouter

  def _vector_candidates(
    self,
    query_embedding: list[float],
    chunks: list[StoredChunk],
  ) -> list[StoredChunk]:
    if not chunks:
      return []
    scored: list[tuple[float, StoredChunk]] = []
    for chunk in chunks:
      if not chunk.embedding:
        continue
      similarity = cosine_similarity(query_embedding, chunk.embedding)
      scored.append((similarity, chunk))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [chunk for _score, chunk in scored[:self.settings.top_k_vector]]

  async def retrieve(self, payload: AiAskRequest) -> list[StoredChunk]:
    allowed_chunks = self.database.get_chunks_by_allowed_refs(
      payload.namespace,
      payload.allowed_chunks,
    )
    if not allowed_chunks:
      return []

    allowed_uids = [
      ref.remote_chunk_id or make_chunk_uid(payload.namespace, ref.chapter_id, ref.chunk_index)
      for ref in payload.allowed_chunks
    ]
    query_text = build_query_text(payload.selected_text, payload.question)
    query_embedding = (await self.openrouter.embed_texts([query_text]))[0]
    vector_results = self._vector_candidates(query_embedding, allowed_chunks)
    bm25_query = build_bm25_query(query_text)
    bm25_results = self.database.search_bm25(
      payload.namespace,
      allowed_uids,
      bm25_query,
      self.settings.top_k_bm25,
    )

    chunk_by_uid = {chunk.uid: chunk for chunk in allowed_chunks}
    fused_uids = reciprocal_rank_fusion([
      [chunk.uid for chunk in vector_results],
      [chunk.uid for chunk in bm25_results],
    ])
    fused_chunks = [
      chunk_by_uid[uid]
      for uid in fused_uids[:self.settings.top_k_rerank]
      if uid in chunk_by_uid
    ]
    if not fused_chunks:
      return []

    reranked = await self.openrouter.rerank(
      question=payload.question,
      selected_text=payload.selected_text,
      chunks=fused_chunks,
    )
    return [
      chunk for chunk in reranked[:self.settings.max_context_chunks]
    ]


def cosine_similarity(left: list[float], right: list[float]) -> float:
  if not left or not right or len(left) != len(right):
    return 0.0
  dot_product = sum(l * r for l, r in zip(left, right, strict=False))
  left_norm = sum(l * l for l in left) ** 0.5
  right_norm = sum(r * r for r in right) ** 0.5
  if left_norm == 0 or right_norm == 0:
    return 0.0
  return dot_product / (left_norm * right_norm)
