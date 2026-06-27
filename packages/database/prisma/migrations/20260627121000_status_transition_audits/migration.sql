-- CreateEnum
CREATE TYPE "StatusTransitionEntityType" AS ENUM ('PAYMENT', 'ORDER');

-- CreateTable
CREATE TABLE "StatusTransitionAudit" (
    "id" TEXT NOT NULL,
    "entityType" "StatusTransitionEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "storeId" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "source" TEXT NOT NULL,
    "actorType" TEXT,
    "actorId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusTransitionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatusTransitionAudit_entityType_entityId_createdAt_idx" ON "StatusTransitionAudit"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "StatusTransitionAudit_storeId_createdAt_idx" ON "StatusTransitionAudit"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "StatusTransitionAudit_allowed_createdAt_idx" ON "StatusTransitionAudit"("allowed", "createdAt");

-- AddForeignKey
ALTER TABLE "StatusTransitionAudit" ADD CONSTRAINT "StatusTransitionAudit_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
