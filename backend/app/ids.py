def make_chunk_uid(namespace: str, chapter_id: int, chunk_index: int) -> str:
  return f'{namespace}:{chapter_id}:{chunk_index}'
