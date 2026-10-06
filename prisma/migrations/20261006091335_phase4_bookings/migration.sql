-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'DECLINED', 'ARRIVED', 'NO_SHOW', 'CANCELLED');

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "bookingCapacityPerSlot" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "bookingCutoffMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "maxPartySize" INTEGER NOT NULL DEFAULT 12;

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "partySize" INTEGER NOT NULL,
    "slotStart" TIMESTAMPTZ(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "cancelToken" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMPTZ(3),
    "decidedById" TEXT,
    "declineReason" TEXT,
    "reminderSentAt" TIMESTAMPTZ(3),

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedDate" (
    "date" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "BlockedDate_pkey" PRIMARY KEY ("date")
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_cancelToken_key" ON "Booking"("cancelToken");

-- CreateIndex
CREATE INDEX "Booking_slotStart_status_idx" ON "Booking"("slotStart", "status");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
