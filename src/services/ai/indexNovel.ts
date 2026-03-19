import { BackgroundTaskMetadata } from '@services/ServiceManager';
import { getNovelById } from '@database/queries/NovelQueries';
import {
  getAllUndownloadedChapters,
  getNovelChapters,
} from '@database/queries/ChapterQueries';
import { downloadChapter } from '@services/download/downloadChapter';
import NativeFile from '@specs/NativeFile';
import { NOVEL_STORAGE } from '@utils/Storages';
import { extractAiChunks } from './extractChunks';
import { sendAiChunks } from './backend';
import {
  replaceAiChunksForChapter,
  upsertAiNovel,
} from '@database/queries/AiQueries';
import { getString } from '@strings/translations';

const makeNamespace = (novelId: number) => `novel-${novelId}`;

export const indexNovelAi = async (
  {
    novelId,
  }: {
    novelId: number;
  },
  setMeta: (
    transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
  ) => void,
) => {
  const noopMetaSetter = (
    _transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
  ) => undefined;
  const novel = await getNovelById(novelId);
  if (!novel) {
    throw new Error(getString('ai.errors.novelNotFound'));
  }

  const missingDownloads = await getAllUndownloadedChapters(novelId);
  const totalSteps = Math.max(missingDownloads.length + 1, 1);
  let completedSteps = 0;
  const namespace = makeNamespace(novelId);

  await upsertAiNovel(novelId, {
    enabled: true,
    status: 'indexing',
    backendNamespace: namespace,
    lastError: null,
  });

  for (const chapter of missingDownloads) {
    setMeta(meta => ({
      ...meta,
      isRunning: true,
      progress: completedSteps / totalSteps,
      progressText: getString('ai.indexing.downloadingChapter', {
        chapter: chapter.name,
      }),
    }));
    await downloadChapter(
      {
        chapterId: chapter.id,
      },
      noopMetaSetter,
    );
    completedSteps += 1;
  }

  const chapters = (await getNovelChapters(novelId)).sort(
    (left, right) => (left.position ?? 0) - (right.position ?? 0),
  );
  let totalChunkCount = 0;

  for (let index = 0; index < chapters.length; index += 1) {
    const chapter = chapters[index];
    const filePath = `${NOVEL_STORAGE}/${novel.pluginId}/${novel.id}/${chapter.id}/index.html`;
    if (!NativeFile.exists(filePath)) {
      continue;
    }
    setMeta(meta => ({
      ...meta,
      isRunning: true,
      progress:
        chapters.length === 0
          ? 1
          : (completedSteps + index / chapters.length) / totalSteps,
      progressText: getString('ai.indexing.processingChapter', {
        chapter: chapter.name,
      }),
    }));
    const html = NativeFile.readFile(filePath);
    const chunks = extractAiChunks({
      html,
      novel,
      chapter,
    });
    totalChunkCount += chunks.length;
    const response = await sendAiChunks({
      novelId: novel.id,
      novelName: novel.name,
      namespace,
      chapterId: chapter.id,
      chapterName: chapter.name,
      chapterPosition: chapter.position ?? 0,
      chapterPage: chapter.page ?? '1',
      chunks,
    });
    await replaceAiChunksForChapter(
      chapter.id,
      novel.id,
      chunks.map((chunk, chunkIndex) => ({
        novelId: novel.id,
        chapterId: chapter.id,
        chapterPosition: chunk.chapterPosition,
        chapterPage: chunk.chapterPage,
        chunkIndex: chunk.chunkIndex,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        startProgress: chunk.startProgress,
        endProgress: chunk.endProgress,
        textPreview: chunk.text.slice(0, 280),
        checksum: chunk.checksum,
        remoteChunkId: response.chunkIds?.[chunkIndex] ?? null,
      })),
    );
  }

  await upsertAiNovel(novel.id, {
    enabled: true,
    status: 'ready',
    backendNamespace: namespace,
    lastIndexedAt: new Date().toISOString(),
    lastError: null,
    indexedChapterCount: chapters.length,
    indexedChunkCount: totalChunkCount,
    lastIndexedRevision: `${chapters.length}:${totalChunkCount}`,
  });

  setMeta(meta => ({
    ...meta,
    isRunning: false,
    progress: 1,
    progressText: getString('ai.indexing.ready'),
  }));
};
