-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "review" TEXT NOT NULL DEFAULT '',
    "rating" INTEGER,
    "color" TEXT NOT NULL DEFAULT '#7a6a52',
    "height" INTEGER NOT NULL DEFAULT 180,
    "thickness" INTEGER NOT NULL DEFAULT 40,
    "design" TEXT NOT NULL DEFAULT 'plain',
    "shelf" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BookReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "rating" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BookReview_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FieldNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "image" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "tilt" REAL NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Book_slug_key" ON "Book"("slug");

-- CreateIndex
CREATE INDEX "Book_published_shelf_position_idx" ON "Book"("published", "shelf", "position");

-- CreateIndex
CREATE INDEX "BookReview_bookId_createdAt_idx" ON "BookReview"("bookId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BookReview_bookId_userId_key" ON "BookReview"("bookId", "userId");

-- CreateIndex
CREATE INDEX "FieldNote_position_idx" ON "FieldNote"("position");
