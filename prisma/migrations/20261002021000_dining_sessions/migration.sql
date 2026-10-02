-- CreateEnum
CREATE TYPE "SessionKind" AS ENUM ('DINE_IN', 'TAKEAWAY');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('OPEN', 'BILL_REQUESTED', 'CLOSED');

-- CreateTable
CREATE TABLE "DiningSession" (
    "id" TEXT NOT NULL,
    "kind" "SessionKind" NOT NULL,
    "tableId" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMPTZ(3),
    "customerName" TEXT,
    "customerPhone" TEXT,

    CONSTRAINT "DiningSession_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DiningSession" ADD CONSTRAINT "DiningSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot express a partial unique index: keep one live session per table,
-- while allowing past CLOSED sessions and multiple table-less takeaways.
CREATE UNIQUE INDEX "DiningSession_one_active_per_table"
ON "DiningSession" ("tableId") WHERE "tableId" IS NOT NULL AND "status" <> 'CLOSED';

-- A dine-in session must always belong to a table, even outside our helpers.
ALTER TABLE "DiningSession" ADD CONSTRAINT "DiningSession_dine_in_has_table"
CHECK (kind = 'TAKEAWAY' OR "tableId" IS NOT NULL);

