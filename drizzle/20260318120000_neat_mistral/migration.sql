CREATE TABLE IF NOT EXISTS `AiNovel` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`novelId` integer NOT NULL,
	`enabled` integer DEFAULT false,
	`status` text DEFAULT 'idle' NOT NULL,
	`backendNamespace` text,
	`lastIndexedAt` text,
	`lastError` text,
	`indexedChapterCount` integer DEFAULT 0,
	`indexedChunkCount` integer DEFAULT 0,
	`lastIndexedRevision` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ai_novel_unique` ON `AiNovel` (`novelId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ai_novel_status_idx` ON `AiNovel` (`status`,`enabled`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `AiChunk` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`novelId` integer NOT NULL,
	`chapterId` integer NOT NULL,
	`chapterPosition` integer DEFAULT 0 NOT NULL,
	`chapterPage` text DEFAULT '1',
	`chunkIndex` integer NOT NULL,
	`startOffset` integer DEFAULT 0 NOT NULL,
	`endOffset` integer DEFAULT 0 NOT NULL,
	`startProgress` integer DEFAULT 0 NOT NULL,
	`endProgress` integer DEFAULT 0 NOT NULL,
	`textPreview` text NOT NULL,
	`checksum` text NOT NULL,
	`remoteChunkId` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ai_chunk_unique` ON `AiChunk` (`chapterId`,`chunkIndex`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ai_chunk_novel_progress_idx` ON `AiChunk` (`novelId`,`chapterPosition`,`endProgress`);
