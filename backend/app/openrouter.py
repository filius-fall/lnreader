from __future__ import annotations

import httpx
import json

from app.config import Settings
from app.db import StoredChunk
from app.schemas import CitationResponse

OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
OPENROUTER_EMBEDDINGS_URL = 'https://openrouter.ai/api/v1/embeddings'


class OpenRouterClient:
  def __init__(self, settings: Settings):
    self.settings = settings
    self.embedding_batch_size = 1

  def _headers(self) -> dict[str, str]:
    return {
      'Authorization': f'Bearer {self.settings.openrouter_api_key}',
      'Content-Type': 'application/json',
      'X-Title': 'LNReader AI Backend',
    }

  async def embed_texts(self, texts: list[str]) -> list[list[float]]:
    if not texts:
      return []
    embeddings: list[list[float]] = []
    async with httpx.AsyncClient(
      timeout=self.settings.openrouter_timeout_seconds,
    ) as client:
      for start in range(0, len(texts), self.embedding_batch_size):
        batch = texts[start:start + self.embedding_batch_size]
        response = await client.post(
          OPENROUTER_EMBEDDINGS_URL,
          headers=self._headers(),
          json={
            'model': self.settings.embedding_model,
            'input': batch[0] if len(batch) == 1 else batch,
            'encoding_format': 'float',
          },
        )
        try:
          response.raise_for_status()
        except httpx.HTTPStatusError as error:
          detail = response.text.strip()
          if len(detail) > 1000:
            detail = f'{detail[:1000]}...'
          raise RuntimeError(
            f'Embedding request failed with {response.status_code}: {detail}',
          ) from error
        payload = response.json()
        embeddings.extend(item['embedding'] for item in payload['data'])
    return embeddings

  async def rerank(
    self,
    *,
    question: str,
    selected_text: str,
    chunks: list[StoredChunk],
  ) -> list[StoredChunk]:
    if len(chunks) <= 1:
      return chunks

    candidate_lines = []
    for index, chunk in enumerate(chunks, start=1):
      candidate_lines.append(
        '\n'.join(
          [
            f'ID: {index}',
            f'Chapter: {chunk.chapter_name}',
            f'ChunkIndex: {chunk.chunk_index}',
            f'Text: {chunk.text[:1800]}',
          ]
        )
      )

    async with httpx.AsyncClient(
      timeout=self.settings.openrouter_timeout_seconds,
    ) as client:
      response = await client.post(
        OPENROUTER_URL,
        headers=self._headers(),
        json={
          'model': self.settings.reranker_model,
          'temperature': 0,
          'max_tokens': 300,
          'response_format': {
            'type': 'json_schema',
            'json_schema': {
              'name': 'rerank_result',
              'strict': True,
              'schema': {
                'type': 'object',
                'properties': {
                  'ordered_ids': {
                    'type': 'array',
                    'items': {'type': 'integer'},
                  },
                },
                'required': ['ordered_ids'],
                'additionalProperties': False,
              },
            },
          },
          'messages': [
            {
              'role': 'system',
              'content': (
                'Rank the candidate passages by how useful they are for answering the question. '
                'Return only JSON.'
              ),
            },
            {
              'role': 'user',
              'content': '\n\n'.join(
                [
                  f'Selected text:\n{selected_text}',
                  f'Question:\n{question}',
                  'Candidates:',
                  '\n\n'.join(candidate_lines),
                ]
              ),
            },
          ],
        },
      )
      response.raise_for_status()
      payload = response.json()

    content = payload['choices'][0]['message']['content']
    if isinstance(content, list):
      content = ''.join(
        item.get('text', '')
        for item in content
        if isinstance(item, dict)
      )
    try:
      ordered_ids = json.loads(str(content))['ordered_ids']
    except Exception:
      return chunks

    by_index = {index: chunk for index, chunk in enumerate(chunks, start=1)}
    reranked = [by_index[idx] for idx in ordered_ids if idx in by_index]
    seen = {chunk.uid for chunk in reranked}
    reranked.extend(chunk for chunk in chunks if chunk.uid not in seen)
    return reranked

  def _build_context(self, chunks: list[StoredChunk]) -> str:
    parts = []
    for index, chunk in enumerate(chunks, start=1):
      parts.append(
        '\n'.join(
          [
            f'[C{index}] {chunk.chapter_name}',
            f'Chunk {chunk.chunk_index}',
            chunk.text,
          ]
        )
      )
    return '\n\n'.join(parts)

  async def answer(
    self,
    *,
    novel_name: str,
    chapter_name: str,
    progress: int,
    selected_text: str,
    question: str,
    chunks: list[StoredChunk],
  ) -> str:
    context = self._build_context(chunks)
    messages = [
      {
        'role': 'system',
        'content': (
          'You are answering questions about a light novel. '
          'Use only the supplied context. '
          'Do not infer events beyond the available context. '
          'If the context is insufficient, say that you do not have enough spoiler-safe context yet.'
        ),
      },
      {
        'role': 'user',
        'content': '\n\n'.join(
          [
            f'Novel: {novel_name}',
            f'Current chapter: {chapter_name}',
            f'Reading progress boundary: {progress}%',
            f'Selected text:\n{selected_text}',
            f'Question:\n{question}',
            f'Context:\n{context}',
          ]
        ),
      },
    ]
    async with httpx.AsyncClient(timeout=self.settings.openrouter_timeout_seconds) as client:
      response = await client.post(
        OPENROUTER_URL,
        headers=self._headers(),
        json={
          'model': self.settings.openrouter_model,
          'messages': messages,
          'temperature': 0.2,
          'max_tokens': self.settings.openrouter_max_tokens,
        },
      )
      response.raise_for_status()
      payload = response.json()
    message = payload['choices'][0]['message']['content']
    if isinstance(message, list):
      return ''.join(
        part.get('text', '')
        for part in message
        if isinstance(part, dict)
      ).strip()
    return str(message).strip()


def build_citations(chunks: list[StoredChunk]) -> list[CitationResponse]:
  return [
    CitationResponse(
      chapterId=chunk.chapter_id,
      chapterName=chunk.chapter_name,
      chunkIndex=chunk.chunk_index,
      excerpt=chunk.text[:240].strip(),
    )
    for chunk in chunks
  ]
