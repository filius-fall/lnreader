export type AiNovelStatus = 'idle' | 'indexing' | 'ready' | 'error';

export interface AiChunkPayload {
  chapterId: number;
  chapterName: string;
  chapterPosition: number;
  chapterPage: string;
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
  startProgress: number;
  endProgress: number;
  text: string;
  checksum: string;
}

export interface AiIndexRequest {
  novelId: number;
  novelName: string;
  namespace: string;
  chapterId: number;
  chapterName: string;
  chapterPosition: number;
  chapterPage: string;
  chunks: AiChunkPayload[];
}

export interface AiAskRequest {
  novelId: number;
  novelName: string;
  namespace: string;
  chapterId: number;
  chapterName: string;
  chapterPosition: number;
  progress: number;
  selectedText: string;
  question: string;
  allowedChunks: Array<{
    chapterId: number;
    chapterPosition: number;
    chunkIndex: number;
    startProgress: number;
    endProgress: number;
    textPreview: string;
    remoteChunkId: string | null;
  }>;
}

export interface AiAnswerCitation {
  chapterId: number;
  chapterName: string;
  chunkIndex: number;
  excerpt: string;
}

export interface AiAskResponse {
  answer: string;
  citations?: AiAnswerCitation[];
}
