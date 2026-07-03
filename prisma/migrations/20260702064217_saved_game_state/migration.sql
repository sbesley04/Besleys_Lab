-- CreateTable
CREATE TABLE "GameSave" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'autosave',
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GameSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Roster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Roster_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SimulationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "roster" TEXT NOT NULL,
    "winner" TEXT,
    "turns" INTEGER NOT NULL,
    "players" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SimulationRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GameSave_userId_updatedAt_idx" ON "GameSave"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameSave_userId_game_name_key" ON "GameSave"("userId", "game", "name");

-- CreateIndex
CREATE INDEX "Roster_userId_updatedAt_idx" ON "Roster"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Roster_userId_name_key" ON "Roster"("userId", "name");

-- CreateIndex
CREATE INDEX "SimulationRun_userId_createdAt_idx" ON "SimulationRun"("userId", "createdAt");
