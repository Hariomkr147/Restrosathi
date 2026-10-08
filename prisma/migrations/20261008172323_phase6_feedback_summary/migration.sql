-- CreateTable
CREATE TABLE "FeedbackSummary" (
    "id" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "themes" JSONB NOT NULL,
    "positive" JSONB NOT NULL,
    "reply" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackSummary_pkey" PRIMARY KEY ("id")
);
