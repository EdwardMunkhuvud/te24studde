-- CreateTable
CREATE TABLE IF NOT EXISTS "StudyExam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL DEFAULT '',
    "endTime" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "sourceKey" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StudyMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "url" TEXT,
    "storageKey" TEXT,
    "storage" TEXT NOT NULL DEFAULT 'LOCAL',
    "fileName" TEXT NOT NULL DEFAULT '',
    "contentType" TEXT NOT NULL DEFAULT '',
    "byteSize" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudyMaterial_examId_fkey" FOREIGN KEY ("examId") REFERENCES "StudyExam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StudyNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "quote" TEXT NOT NULL DEFAULT '',
    "section" TEXT NOT NULL DEFAULT '',
    "page" INTEGER,
    "x" REAL,
    "y" REAL,
    "seconds" INTEGER,
    "highlights" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudyNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudyNote_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "StudyMaterial" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StudyProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudyProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudyProgress_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "StudyMaterial" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StudyExam_sourceKey_key" ON "StudyExam"("sourceKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StudyExam_date_archived_idx" ON "StudyExam"("date", "archived");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StudyMaterial_storageKey_key" ON "StudyMaterial"("storageKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StudyMaterial_examId_archived_sortOrder_idx" ON "StudyMaterial"("examId", "archived", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StudyNote_userId_materialId_idx" ON "StudyNote"("userId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StudyProgress_userId_materialId_key" ON "StudyProgress"("userId", "materialId");
