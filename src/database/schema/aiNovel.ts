import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const aiNovel = sqliteTable(
  'AiNovel',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    novelId: integer('novelId').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).default(false),
    status: text('status').notNull().default('idle'),
    backendNamespace: text('backendNamespace'),
    lastIndexedAt: text('lastIndexedAt'),
    lastError: text('lastError'),
    indexedChapterCount: integer('indexedChapterCount').default(0),
    indexedChunkCount: integer('indexedChunkCount').default(0),
    lastIndexedRevision: text('lastIndexedRevision'),
  },
  table => [
    uniqueIndex('ai_novel_unique').on(table.novelId),
    index('ai_novel_status_idx').on(table.status, table.enabled),
  ],
);

export type AiNovelRow = typeof aiNovel.$inferSelect;
export type AiNovelInsert = typeof aiNovel.$inferInsert;
