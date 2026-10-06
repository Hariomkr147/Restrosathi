-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('BIRTHDAY', 'CORPORATE', 'OTHER');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'QUOTED', 'CONFIRMED', 'LOST');

-- CreateTable
CREATE TABLE "EventPackage" (
    "id" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB NOT NULL,
    "pricePerPlatePaise" INTEGER NOT NULL,
    "minGuests" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventEnquiry" (
    "id" TEXT NOT NULL,
    "packageId" TEXT,
    "eventType" "EventType" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "guests" INTEGER NOT NULL,
    "eventDate" DATE NOT NULL,
    "message" TEXT,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "quotedPaise" INTEGER,
    "notes" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledById" TEXT,

    CONSTRAINT "EventEnquiry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EventEnquiry" ADD CONSTRAINT "EventEnquiry_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "EventPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventEnquiry" ADD CONSTRAINT "EventEnquiry_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
