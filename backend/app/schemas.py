from pydantic import BaseModel, Field


class AiChunkPayload(BaseModel):
  chapter_id: int = Field(alias='chapterId')
  chapter_name: str = Field(alias='chapterName')
  chapter_position: int = Field(alias='chapterPosition')
  chapter_page: str = Field(alias='chapterPage')
  chunk_index: int = Field(alias='chunkIndex')
  start_offset: int = Field(alias='startOffset')
  end_offset: int = Field(alias='endOffset')
  start_progress: int = Field(alias='startProgress')
  end_progress: int = Field(alias='endProgress')
  text: str
  checksum: str


class AiIndexRequest(BaseModel):
  novel_id: int = Field(alias='novelId')
  novel_name: str = Field(alias='novelName')
  namespace: str
  chapter_id: int = Field(alias='chapterId')
  chapter_name: str = Field(alias='chapterName')
  chapter_position: int = Field(alias='chapterPosition')
  chapter_page: str = Field(alias='chapterPage')
  chunks: list[AiChunkPayload]


class AllowedChunkReference(BaseModel):
  chapter_id: int = Field(alias='chapterId')
  chapter_position: int = Field(alias='chapterPosition')
  chunk_index: int = Field(alias='chunkIndex')
  start_progress: int = Field(alias='startProgress')
  end_progress: int = Field(alias='endProgress')
  text_preview: str = Field(alias='textPreview')
  remote_chunk_id: str | None = Field(default=None, alias='remoteChunkId')


class AiAskRequest(BaseModel):
  novel_id: int = Field(alias='novelId')
  novel_name: str = Field(alias='novelName')
  namespace: str
  chapter_id: int = Field(alias='chapterId')
  chapter_name: str = Field(alias='chapterName')
  chapter_position: int = Field(alias='chapterPosition')
  progress: int
  selected_text: str = Field(alias='selectedText')
  question: str
  allowed_chunks: list[AllowedChunkReference] = Field(alias='allowedChunks')


class IndexResponse(BaseModel):
  chunk_ids: list[str] = Field(alias='chunkIds')


class CitationResponse(BaseModel):
  chapter_id: int = Field(alias='chapterId')
  chapter_name: str = Field(alias='chapterName')
  chunk_index: int = Field(alias='chunkIndex')
  excerpt: str


class AskResponse(BaseModel):
  answer: str
  citations: list[CitationResponse] = Field(default_factory=list)


class HealthResponse(BaseModel):
  status: str
  database_path: str = Field(alias='databasePath')
  embedding_model: str = Field(alias='embeddingModel')
  reranker_model: str = Field(alias='rerankerModel')
  openrouter_model: str = Field(alias='openrouterModel')
  embedding_backend: str = Field(alias='embeddingBackend')
  reranker_backend: str = Field(alias='rerankerBackend')
  answer_backend: str = Field(alias='answerBackend')
