-- CreateTable
CREATE TABLE "Bookcase" (
    "idx" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ShelfDecorItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "bookcase" INTEGER NOT NULL DEFAULT 0,
    "shelf" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "review" TEXT NOT NULL DEFAULT '',
    "rating" INTEGER,
    "color" TEXT NOT NULL DEFAULT '#7a6a52',
    "height" INTEGER NOT NULL DEFAULT 200,
    "thickness" INTEGER NOT NULL DEFAULT 40,
    "design" TEXT NOT NULL DEFAULT 'plain',
    "bookcase" INTEGER NOT NULL DEFAULT 0,
    "shelf" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Book" ("author", "color", "createdAt", "design", "height", "id", "position", "published", "rating", "review", "shelf", "slug", "thickness", "title", "updatedAt") SELECT "author", "color", "createdAt", "design", "height", "id", "position", "published", "rating", "review", "shelf", "slug", "thickness", "title", "updatedAt" FROM "Book";
DROP TABLE "Book";
ALTER TABLE "new_Book" RENAME TO "Book";
CREATE UNIQUE INDEX "Book_slug_key" ON "Book"("slug");
CREATE INDEX "Book_published_bookcase_shelf_position_idx" ON "Book"("published", "bookcase", "shelf", "position");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ShelfDecorItem_bookcase_shelf_position_idx" ON "ShelfDecorItem"("bookcase", "shelf", "position");
