import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const aiChunk = sqliteTable(
  'AiChunk',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    novelId: integer('novelId').notNull(),
    chapterId: integer('chapterId').notNull(),
    chapterPosition: integer('chapterPosition').notNull().default(0),
    chapterPage: text('chapterPage').default('1'),
    chunkIndex: integer('chunkIndex').notNull(),
    startOffset: integer('startOffset').notNull().default(0),
    endOffset: integer('endOffset').notNull().default(0),
    startProgress: integer('startProgress').notNull().default(0),
    endProgress: integer('endProgress').notNull().default(0),
    textPreview: text('textPreview').notNull(),
    checksum: text('checksum').notNull(),
    remoteChunkId: text('remoteChunkId'),
  },
  table => [
    uniqueIndex('ai_chunk_unique').on(table.chapterId, table.chunkIndex),
    index('ai_chunk_novel_progress_idx').on(
      table.novelId,
      table.chapterPosition,
      table.endProgress,
    ),
  ],
);

export type AiChunkRow = typeof aiChunk.$inferSelect;
export type AiChunkInsert = typeof aiChunk.$inferInsert;
