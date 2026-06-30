-- CreateEnum
CREATE TYPE "BaselinkerSyncDirection" AS ENUM ('EXPORT', 'IMPORT');

-- CreateTable
CREATE TABLE "StoreBaselinkerConfig" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "apiToken" TEXT NOT NULL,
    "inventoryId" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "statusMappings" JSONB,
    "lastOrderImportAt" TIMESTAMP(3),
    "lastCatalogSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreBaselinkerConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselinkerOrderSync" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "orderId" TEXT,
    "baselinkerOrderId" INTEGER NOT NULL,
    "direction" "BaselinkerSyncDirection" NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastStatus" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "BaselinkerOrderSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreBaselinkerConfig_storeId_key" ON "StoreBaselinkerConfig"("storeId");

-- CreateIndex
CREATE INDEX "StoreBaselinkerConfig_storeId_idx" ON "StoreBaselinkerConfig"("storeId");

-- CreateIndex
CREATE INDEX "BaselinkerOrderSync_storeId_direction_idx" ON "BaselinkerOrderSync"("storeId", "direction");

-- CreateIndex
CREATE INDEX "BaselinkerOrderSync_orderId_idx" ON "BaselinkerOrderSync"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "BaselinkerOrderSync_storeId_baselinkerOrderId_key" ON "BaselinkerOrderSync"("storeId", "baselinkerOrderId");

-- AddForeignKey
ALTER TABLE "StoreBaselinkerConfig" ADD CONSTRAINT "StoreBaselinkerConfig_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselinkerOrderSync" ADD CONSTRAINT "BaselinkerOrderSync_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselinkerOrderSync" ADD CONSTRAINT "BaselinkerOrderSync_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
