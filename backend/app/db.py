from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from app.ids import make_chunk_uid
from app.schemas import AiIndexRequest, AllowedChunkReference


@dataclass(slots=True)
class StoredChunk:
  uid: str
  namespace: str
  novel_id: int
  novel_name: str
  chapter_id: int
  chapter_name: str
  chapter_position: int
  chapter_page: str
  chunk_index: int
  start_offset: int
  end_offset: int
  start_progress: int
  end_progress: int
  text: str
  checksum: str
  embedding: list[float]


def _utc_now() -> str:
  return datetime.now(UTC).isoformat()


def _row_to_chunk(row: sqlite3.Row) -> StoredChunk:
  return StoredChunk(
    uid=row['uid'],
    namespace=row['namespace'],
    novel_id=row['novel_id'],
    novel_name=row['novel_name'],
    chapter_id=row['chapter_id'],
    chapter_name=row['chapter_name'],
    chapter_position=row['chapter_position'],
    chapter_page=row['chapter_page'],
    chunk_index=row['chunk_index'],
    start_offset=row['start_offset'],
    end_offset=row['end_offset'],
    start_progress=row['start_progress'],
    end_progress=row['end_progress'],
    text=row['text'],
    checksum=row['checksum'],
    embedding=json.loads(row['embedding']),
  )


class Database:
  def __init__(self, path: Path):
    self.path = path
    self.path.parent.mkdir(parents=True, exist_ok=True)

  def _connect(self) -> sqlite3.Connection:
    connection = sqlite3.connect(self.path, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA journal_mode = WAL')
    connection.execute('PRAGMA synchronous = NORMAL')
    connection.execute('PRAGMA foreign_keys = ON')
    return connection

  def initialize(self) -> None:
    with self._connect() as connection:
      connection.execute(
        '''
        CREATE TABLE IF NOT EXISTS chunks (
          uid TEXT PRIMARY KEY,
          namespace TEXT NOT NULL,
          novel_id INTEGER NOT NULL,
          novel_name TEXT NOT NULL,
          chapter_id INTEGER NOT NULL,
          chapter_name TEXT NOT NULL,
          chapter_position INTEGER NOT NULL,
          chapter_page TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          start_offset INTEGER NOT NULL,
          end_offset INTEGER NOT NULL,
          start_progress INTEGER NOT NULL,
          end_progress INTEGER NOT NULL,
          text TEXT NOT NULL,
          checksum TEXT NOT NULL,
          embedding TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(namespace, chapter_id, chunk_index)
        )
        '''
      )
      connection.execute(
        'CREATE INDEX IF NOT EXISTS idx_chunks_namespace ON chunks(namespace)'
      )
      connection.execute(
        '''
        CREATE INDEX IF NOT EXISTS idx_chunks_chapter
        ON chunks(namespace, chapter_id, chunk_index)
        '''
      )
      connection.execute(
        '''
        CREATE INDEX IF NOT EXISTS idx_chunks_progress
        ON chunks(namespace, chapter_position, end_progress)
        '''
      )
      connection.execute(
        '''
        CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts
        USING fts5(uid UNINDEXED, namespace UNINDEXED, text, tokenize = 'unicode61')
        '''
      )

  def _replace_fts_row(
    self,
    connection: sqlite3.Connection,
    uid: str,
    namespace: str,
    text: str,
  ) -> None:
    connection.execute('DELETE FROM chunks_fts WHERE uid = ?', (uid,))
    connection.execute(
      'INSERT INTO chunks_fts(uid, namespace, text) VALUES (?, ?, ?)',
      (uid, namespace, text),
    )

  def upsert_index_request(
    self,
    payload: AiIndexRequest,
    embeddings_by_uid: dict[str, list[float]],
  ) -> list[str]:
    chunk_ids: list[str] = []
    requested_uids = {
      make_chunk_uid(payload.namespace, chunk.chapter_id, chunk.chunk_index)
      for chunk in payload.chunks
    }
    now = _utc_now()

    with self._connect() as connection:
      existing_rows = connection.execute(
        '''
        SELECT uid, checksum, embedding
        FROM chunks
        WHERE namespace = ? AND chapter_id = ?
        ''',
        (payload.namespace, payload.chapter_id),
      ).fetchall()
      existing_by_uid = {row['uid']: row for row in existing_rows}

      stale_uids = set(existing_by_uid) - requested_uids
      for uid in stale_uids:
        connection.execute('DELETE FROM chunks WHERE uid = ?', (uid,))
        connection.execute('DELETE FROM chunks_fts WHERE uid = ?', (uid,))

      for chunk in payload.chunks:
        uid = make_chunk_uid(payload.namespace, chunk.chapter_id, chunk.chunk_index)
        chunk_ids.append(uid)
        existing_row = existing_by_uid.get(uid)
        embedding = embeddings_by_uid.get(uid)
        if embedding is None and existing_row is not None:
          embedding_json = existing_row['embedding']
        else:
          embedding_json = json.dumps(embedding or [])

        created_at = now
        if existing_row is not None:
          created_at_row = connection.execute(
            'SELECT created_at FROM chunks WHERE uid = ?',
            (uid,),
          ).fetchone()
          if created_at_row is not None:
            created_at = created_at_row['created_at']

        connection.execute(
          '''
          INSERT INTO chunks (
            uid,
            namespace,
            novel_id,
            novel_name,
            chapter_id,
            chapter_name,
            chapter_position,
            chapter_page,
            chunk_index,
            start_offset,
            end_offset,
            start_progress,
            end_progress,
            text,
            checksum,
            embedding,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(uid) DO UPDATE SET
            namespace = excluded.namespace,
            novel_id = excluded.novel_id,
            novel_name = excluded.novel_name,
            chapter_id = excluded.chapter_id,
            chapter_name = excluded.chapter_name,
            chapter_position = excluded.chapter_position,
            chapter_page = excluded.chapter_page,
            chunk_index = excluded.chunk_index,
            start_offset = excluded.start_offset,
            end_offset = excluded.end_offset,
            start_progress = excluded.start_progress,
            end_progress = excluded.end_progress,
            text = excluded.text,
            checksum = excluded.checksum,
            embedding = excluded.embedding,
            updated_at = excluded.updated_at
          ''',
          (
            uid,
            payload.namespace,
            payload.novel_id,
            payload.novel_name,
            chunk.chapter_id,
            chunk.chapter_name,
            chunk.chapter_position,
            chunk.chapter_page,
            chunk.chunk_index,
            chunk.start_offset,
            chunk.end_offset,
            chunk.start_progress,
            chunk.end_progress,
            chunk.text,
            chunk.checksum,
            embedding_json,
            created_at,
            now,
          ),
        )
        self._replace_fts_row(connection, uid, payload.namespace, chunk.text)

    return chunk_ids

  def get_existing_checksums(
    self,
    namespace: str,
    chapter_id: int,
  ) -> dict[str, str]:
    with self._connect() as connection:
      rows = connection.execute(
        '''
        SELECT uid, checksum
        FROM chunks
        WHERE namespace = ? AND chapter_id = ?
        ''',
        (namespace, chapter_id),
      ).fetchall()
    return {row['uid']: row['checksum'] for row in rows}

  def get_chunks_by_allowed_refs(
    self,
    namespace: str,
    allowed_refs: list[AllowedChunkReference],
  ) -> list[StoredChunk]:
    allowed_uids = [
      ref.remote_chunk_id or make_chunk_uid(namespace, ref.chapter_id, ref.chunk_index)
      for ref in allowed_refs
    ]
    if not allowed_uids:
      return []

    batch_size = 800
    rows: list[sqlite3.Row] = []
    with self._connect() as connection:
      for index in range(0, len(allowed_uids), batch_size):
        batch = allowed_uids[index:index + batch_size]
        placeholders = ', '.join('?' for _ in batch)
        rows.extend(
          connection.execute(
            f'''
            SELECT *
            FROM chunks
            WHERE namespace = ? AND uid IN ({placeholders})
            ''',
            (namespace, *batch),
          ).fetchall()
        )
    return [_row_to_chunk(row) for row in rows]

  def search_bm25(
    self,
    namespace: str,
    allowed_uids: list[str],
    query: str,
    limit: int,
  ) -> list[StoredChunk]:
    if not allowed_uids or not query:
      return []

    with self._connect() as connection:
      connection.execute(
        'CREATE TEMP TABLE IF NOT EXISTS allowed_uids (uid TEXT PRIMARY KEY)'
      )
      connection.execute('DELETE FROM allowed_uids')
      connection.executemany(
        'INSERT OR IGNORE INTO allowed_uids(uid) VALUES (?)',
        [(uid,) for uid in allowed_uids],
      )
      rows = connection.execute(
        '''
        SELECT c.*
        FROM chunks_fts f
        JOIN allowed_uids a ON a.uid = f.uid
        JOIN chunks c ON c.uid = f.uid
        WHERE f.namespace = ? AND f.text MATCH ?
        ORDER BY bm25(chunks_fts)
        LIMIT ?
        ''',
        (namespace, query, limit),
      ).fetchall()
      connection.execute('DELETE FROM allowed_uids')
    return [_row_to_chunk(row) for row in rows]
