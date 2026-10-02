CREATE TABLE "RestaurantTable" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RestaurantTable_label_key" ON "RestaurantTable"("label");
CREATE UNIQUE INDEX "RestaurantTable_code_key" ON "RestaurantTable"("code");
