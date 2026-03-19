import * as cheerio from 'cheerio';
import { ChapterInfo, NovelInfo } from '@database/types';
import { AiChunkPayload } from './types';

const BLOCK_SELECTORS = [
  'p',
  'blockquote',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'pre',
].join(',');

const MAX_CHUNK_LENGTH = 1400;

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

const checksum = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
};

export const extractAiChunks = ({
  html,
  chapter,
}: {
  html: string;
  novel: NovelInfo;
  chapter: ChapterInfo;
}): AiChunkPayload[] => {
  const $ = cheerio.load(html);
  const blocks = $(BLOCK_SELECTORS)
    .toArray()
    .map(node => normalizeText($(node).text()))
    .filter(Boolean);

  const rawBlocks = blocks.length
    ? blocks
    : normalizeText($.text())
        .split(/\n+/)
        .map(normalizeText)
        .filter(Boolean);

  const totalLength = rawBlocks.reduce((sum, block) => sum + block.length, 0) || 1;
  const chunks: AiChunkPayload[] = [];
  let currentText = '';
  let currentStartOffset = 0;
  let runningOffset = 0;
  let chunkIndex = 0;

  const pushChunk = (text: string, startOffset: number, endOffset: number) => {
    const safeEndOffset = Math.max(startOffset, endOffset);
    chunks.push({
      chapterId: chapter.id,
      chapterName: chapter.name,
      chapterPosition: chapter.position ?? 0,
      chapterPage: chapter.page ?? '1',
      chunkIndex,
      startOffset,
      endOffset: safeEndOffset,
      startProgress: Math.floor((startOffset / totalLength) * 100),
      endProgress: Math.ceil((safeEndOffset / totalLength) * 100),
      text,
      checksum: checksum(text),
    });
    chunkIndex += 1;
  };

  rawBlocks.forEach(block => {
    const nextText = currentText ? `${currentText}\n\n${block}` : block;
    if (nextText.length > MAX_CHUNK_LENGTH && currentText) {
      pushChunk(currentText, currentStartOffset, runningOffset);
      currentText = block;
      currentStartOffset = runningOffset;
    } else {
      currentText = nextText;
    }
    runningOffset += block.length;
  });

  if (currentText) {
    pushChunk(currentText, currentStartOffset, runningOffset);
  }

  return chunks;
};
