export const createBookmarkTableQuery = `
CREATE TABLE IF NOT EXISTS Bookmark (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    novelId INTEGER NOT NULL,
    chapterId INTEGER NOT NULL,
    text TEXT NOT NULL,
    position TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'utc')),
    FOREIGN KEY (novelId) REFERENCES Novel(id) ON DELETE CASCADE,
    FOREIGN KEY (chapterId) REFERENCES Chapter(id) ON DELETE CASCADE
);
`;
