-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "customerId" TEXT,
    "token" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "rating" INTEGER,
    "comment" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_billId_key" ON "Feedback"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_token_key" ON "Feedback"("token");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
