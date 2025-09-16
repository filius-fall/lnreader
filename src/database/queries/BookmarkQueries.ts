import { db } from '../db';
import { Bookmark } from '../types';

const getBookmarksForChapter = (chapterId: number): Bookmark[] => {
  return db.getAllSync<Bookmark>(
    'SELECT * FROM Bookmark WHERE chapterId = ?',
    chapterId,
  );
};

const getBookmarksForNovel = (novelId: number): Bookmark[] => {
  return db.getAllSync<Bookmark>(
    'SELECT * FROM Bookmark WHERE novelId = ?',
    novelId,
  );
};

const insertBookmark = (
  novelId: number,
  chapterId: number,
  text: string,
  position: string,
) => {
  db.runSync(
    'INSERT INTO Bookmark (novelId, chapterId, text, position) VALUES (?, ?, ?, ?)',
    novelId,
    chapterId,
    text,
    position,
  );
};

const deleteBookmark = (id: number) => {
  db.runSync('DELETE FROM Bookmark WHERE id = ?', id);
};

export {
  getBookmarksForChapter,
  getBookmarksForNovel,
  insertBookmark,
  deleteBookmark,
};
