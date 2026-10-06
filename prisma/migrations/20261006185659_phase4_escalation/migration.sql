-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "escalatedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "ownerAlertPhone" TEXT;
