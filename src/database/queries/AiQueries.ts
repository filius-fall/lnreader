import { dbManager } from '@database/db';
import { aiChunkSchema, aiNovelSchema } from '@database/schema';
import { eq, inArray } from 'drizzle-orm';
import { AiChunkInfo, AiNovelInfo } from '@database/types';

export const getAiNovel = async (
  novelId: number,
): Promise<AiNovelInfo | undefined> =>
  dbManager
    .select()
    .from(aiNovelSchema)
    .where(eq(aiNovelSchema.novelId, novelId))
    .get();

export const upsertAiNovel = async (
  novelId: number,
  values: Partial<AiNovelInfo>,
) => {
  await dbManager.write(async tx => {
    tx.insert(aiNovelSchema)
      .values({
        novelId,
        ...values,
      })
      .onConflictDoUpdate({
        target: aiNovelSchema.novelId,
        set: values,
      })
      .run();
  });
};

export const replaceAiChunksForChapter = async (
  chapterId: number,
  novelId: number,
  chunks: Omit<AiChunkInfo, 'id'>[],
) => {
  await dbManager.write(async tx => {
    tx.delete(aiChunkSchema).where(eq(aiChunkSchema.chapterId, chapterId)).run();
    if (!chunks.length) {
      return;
    }
    tx.insert(aiChunkSchema).values(chunks).run();
  });
};

export const getAiChunksForNovel = async (
  novelId: number,
): Promise<AiChunkInfo[]> =>
  dbManager
    .select()
    .from(aiChunkSchema)
    .where(eq(aiChunkSchema.novelId, novelId))
    .all();

export const clearAiChunksForNovel = async (novelId: number) => {
  await dbManager.write(async tx => {
    tx.delete(aiChunkSchema).where(eq(aiChunkSchema.novelId, novelId)).run();
  });
};

export const getAiChunksForAsk = async ({
  novelId,
  currentChapterId,
  currentChapterPosition,
  progress,
}: {
  novelId: number;
  currentChapterId: number;
  currentChapterPosition: number;
  progress: number;
}): Promise<AiChunkInfo[]> => {
  const allChunks = await dbManager
    .select()
    .from(aiChunkSchema)
    .where(eq(aiChunkSchema.novelId, novelId))
    .all();

  return allChunks.filter(chunk => {
    if (chunk.chapterPosition < currentChapterPosition) {
      return true;
    }
    if (chunk.chapterPosition > currentChapterPosition) {
      return false;
    }
    if (chunk.chapterId !== currentChapterId) {
      return false;
    }
    return chunk.endProgress <= progress;
  });
};

export const deleteAiChunksByChapterIds = async (chapterIds: number[]) => {
  if (!chapterIds.length) {
    return;
  }
  await dbManager.write(async tx => {
    tx.delete(aiChunkSchema).where(inArray(aiChunkSchema.chapterId, chapterIds)).run();
  });
};

export const resetAiNovelError = async (novelId: number) =>
  upsertAiNovel(novelId, { lastError: null, status: 'idle' });
