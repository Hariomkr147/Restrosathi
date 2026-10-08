-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "ownerReportLocale" TEXT NOT NULL DEFAULT 'en';

-- CreateTable
CREATE TABLE "WeeklyReportLog" (
    "weekStart" DATE NOT NULL,
    "generatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" JSONB NOT NULL,

    CONSTRAINT "WeeklyReportLog_pkey" PRIMARY KEY ("weekStart")
);
