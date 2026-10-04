-- CreateTable
CREATE TABLE "AiUsage" (
    "month" TEXT NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "warned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("month")
);

-- CreateTable
CREATE TABLE "AiDeviceUsage" (
    "deviceId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AiDeviceUsage_pkey" PRIMARY KEY ("deviceId","day")
);
