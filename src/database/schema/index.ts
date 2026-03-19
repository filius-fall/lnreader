export {
  category as categorySchema,
  type CategoryRow,
  type CategoryInsert,
} from './category';
export { novel as novelSchema, type NovelRow, type NovelInsert } from './novel';
export {
  chapter as chapterSchema,
  type ChapterRow,
  type ChapterInsert,
} from './chapter';
export {
  novelCategory as novelCategorySchema,
  type NovelCategoryRow,
  type NovelCategoryInsert,
} from './novelCategory';
export {
  repository as repositorySchema,
  type RepositoryRow,
  type RepositoryInsert,
} from './repository';
export {
  aiNovel as aiNovelSchema,
  type AiNovelRow,
  type AiNovelInsert,
} from './aiNovel';
export {
  aiChunk as aiChunkSchema,
  type AiChunkRow,
  type AiChunkInsert,
} from './aiChunk';

import { category } from './category';
import { novel } from './novel';
import { chapter } from './chapter';
import { novelCategory } from './novelCategory';
import { repository } from './repository';
import { aiNovel } from './aiNovel';
import { aiChunk } from './aiChunk';

/**
 * Unified schema object containing all database tables
 * Use this with Drizzle ORM for type-safe database operations
 */
export const schema = {
  category,
  novel,
  chapter,
  novelCategory,
  repository,
  aiNovel,
  aiChunk,
} as const;

export type Schema = typeof schema;
