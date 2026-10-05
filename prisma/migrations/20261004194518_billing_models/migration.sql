-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('BILL', 'BILL_OF_SUPPLY', 'TAX_INVOICE');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('OPEN', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('FLAT', 'PERCENT');

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "docType" "DocType" NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'OPEN',
    "number" TEXT,
    "taxMode" "TaxMode" NOT NULL,
    "gstRatePercent" INTEGER NOT NULL,
    "pricesIncludeTax" BOOLEAN NOT NULL,
    "header" JSONB NOT NULL,
    "subtotalPaise" INTEGER NOT NULL,
    "discountType" "DiscountType",
    "discountValue" INTEGER,
    "discountPaise" INTEGER NOT NULL,
    "discountReason" TEXT,
    "taxableValuePaise" INTEGER NOT NULL,
    "cgstPaise" INTEGER NOT NULL,
    "sgstPaise" INTEGER NOT NULL,
    "roundOffPaise" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "generatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT NOT NULL,
    "settledAt" TIMESTAMPTZ(3),
    "settledById" TEXT,
    "cancelledAt" TIMESTAMPTZ(3),
    "cancelledById" TEXT,
    "cancelReason" TEXT,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillLine" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "variant" JSONB,
    "modifiers" JSONB NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPricePaise" INTEGER NOT NULL,
    "linePaise" INTEGER NOT NULL,

    CONSTRAINT "BillLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bill_sessionId_key" ON "Bill"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_number_key" ON "Bill"("number");

-- CreateIndex
CREATE INDEX "BillLine_billId_idx" ON "BillLine"("billId");

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiningSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillLine" ADD CONSTRAINT "BillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
