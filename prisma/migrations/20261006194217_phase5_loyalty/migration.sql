-- CreateEnum
CREATE TYPE "LoyaltyKind" AS ENUM ('EARN', 'REDEEM', 'ADJUST', 'REVERSE');

-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "loyaltyDiscountPaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyPointsRedeemed" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "DiningSession" ADD COLUMN     "customerPhoneVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "loyaltyEarnPer100Rupees" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loyaltyRedeemUnitPoints" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "loyaltyRedeemUnitValuePaise" INTEGER NOT NULL DEFAULT 5000;

-- CreateTable
CREATE TABLE "LoyaltyTxn" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" "LoyaltyKind" NOT NULL,
    "points" INTEGER NOT NULL,
    "billId" TEXT,
    "reversesId" TEXT,
    "note" TEXT,
    "actorId" TEXT,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTxn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyTxn_reversesId_key" ON "LoyaltyTxn"("reversesId");

-- CreateIndex
CREATE INDEX "LoyaltyTxn_customerId_at_idx" ON "LoyaltyTxn"("customerId", "at");

-- CreateIndex
CREATE INDEX "LoyaltyTxn_billId_idx" ON "LoyaltyTxn"("billId");

-- AddForeignKey
ALTER TABLE "LoyaltyTxn" ADD CONSTRAINT "LoyaltyTxn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTxn" ADD CONSTRAINT "LoyaltyTxn_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTxn" ADD CONSTRAINT "LoyaltyTxn_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "LoyaltyTxn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add partial unique indexes for EARN and REDEEM
CREATE UNIQUE INDEX "LoyaltyTxn_billId_EARN_key" ON "LoyaltyTxn"("billId") WHERE "kind" = 'EARN';
CREATE UNIQUE INDEX "LoyaltyTxn_billId_REDEEM_key" ON "LoyaltyTxn"("billId") WHERE "kind" = 'REDEEM';

-- Add check constraint for points <> 0
ALTER TABLE "LoyaltyTxn" ADD CONSTRAINT "LoyaltyTxn_points_check" CHECK ("points" <> 0);
