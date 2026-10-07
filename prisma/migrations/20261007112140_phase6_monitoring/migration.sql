-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "where" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "digest" TEXT NOT NULL,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertState" (
    "key" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,
    "lastSentAt" TIMESTAMPTZ(3),

    CONSTRAINT "AlertState_pkey" PRIMARY KEY ("key")
);
