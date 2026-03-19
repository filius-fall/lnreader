import { getAiChunksForAsk, getAiNovel } from '@database/queries/AiQueries';
import { getChapter } from '@database/queries/ChapterQueries';
import { getNovelById } from '@database/queries/NovelQueries';
import { askAiQuestion } from './backend';
import { getString } from '@strings/translations';

export const askReaderAiQuestion = async ({
  novelId,
  chapterId,
  progress,
  selectedText,
  question,
}: {
  novelId: number;
  chapterId: number;
  progress: number;
  selectedText: string;
  question: string;
}) => {
  const [novel, chapter, aiNovel] = await Promise.all([
    getNovelById(novelId),
    getChapter(chapterId),
    getAiNovel(novelId),
  ]);

  if (!novel || !chapter) {
    throw new Error(getString('ai.errors.novelNotFound'));
  }
  if (!aiNovel?.enabled || aiNovel.status !== 'ready') {
    throw new Error(getString('ai.errors.notReady'));
  }

  const allowedChunks = await getAiChunksForAsk({
    novelId,
    currentChapterId: chapter.id,
    currentChapterPosition: chapter.position ?? 0,
    progress,
  });

  if (!allowedChunks.length) {
    throw new Error(getString('ai.errors.noContext'));
  }

  return askAiQuestion({
    novelId,
    novelName: novel.name,
    namespace: aiNovel.backendNamespace || `novel-${novel.id}`,
    chapterId: chapter.id,
    chapterName: chapter.name,
    chapterPosition: chapter.position ?? 0,
    progress,
    selectedText,
    question,
    allowedChunks: allowedChunks.map(chunk => ({
      chapterId: chunk.chapterId,
      chapterPosition: chunk.chapterPosition,
      chunkIndex: chunk.chunkIndex,
      startProgress: chunk.startProgress,
      endProgress: chunk.endProgress,
      textPreview: chunk.textPreview,
      remoteChunkId: chunk.remoteChunkId,
    })),
  });
};
