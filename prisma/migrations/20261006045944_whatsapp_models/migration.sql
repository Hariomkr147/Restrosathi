-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'RECEIVED');

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "phone" TEXT NOT NULL,
    "kind" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "params" JSONB NOT NULL DEFAULT '{}',
    "body" TEXT,
    "status" "MessageStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerId" TEXT,
    "externalId" TEXT,
    "lastError" TEXT,
    "aiHandled" BOOLEAN NOT NULL DEFAULT false,
    "needsHuman" BOOLEAN NOT NULL DEFAULT false,
    "nextAttemptAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreadState" (
    "phone" TEXT NOT NULL,
    "aiPausedUntil" TIMESTAMPTZ(3),

    CONSTRAINT "ThreadState_pkey" PRIMARY KEY ("phone")
);

-- CreateTable
CREATE TABLE "OptOut" (
    "phone" TEXT NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OptOut_pkey" PRIMARY KEY ("phone")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageLog_externalId_key" ON "MessageLog"("externalId");

-- CreateIndex
CREATE INDEX "MessageLog_status_nextAttemptAt_idx" ON "MessageLog"("status", "nextAttemptAt");
