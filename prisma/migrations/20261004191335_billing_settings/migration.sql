-- CreateEnum
CREATE TYPE "TaxMode" AS ENUM ('NONE', 'COMPOSITION', 'REGULAR');

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "fssai" TEXT,
ADD COLUMN     "gstRatePercent" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "staffCanDiscount" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxMode" "TaxMode" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "taxModeConfirmedAt" TIMESTAMPTZ(3);
