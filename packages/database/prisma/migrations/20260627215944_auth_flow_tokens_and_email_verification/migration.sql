-- CreateEnum
CREATE TYPE "AuthFlowTokenPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "AuthFlowAuditAction" AS ENUM ('EMAIL_VERIFICATION_REQUESTED', 'EMAIL_VERIFICATION_CONFIRMED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AuthFlowToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "AuthFlowTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthFlowToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthFlowAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenId" TEXT,
    "action" "AuthFlowAuditAction" NOT NULL,
    "purpose" "AuthFlowTokenPurpose" NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthFlowAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthFlowToken_tokenHash_key" ON "AuthFlowToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthFlowToken_userId_purpose_createdAt_idx" ON "AuthFlowToken"("userId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "AuthFlowToken_purpose_expiresAt_idx" ON "AuthFlowToken"("purpose", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthFlowAudit_userId_action_createdAt_idx" ON "AuthFlowAudit"("userId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "AuthFlowAudit_purpose_createdAt_idx" ON "AuthFlowAudit"("purpose", "createdAt");

-- AddForeignKey
ALTER TABLE "AuthFlowToken" ADD CONSTRAINT "AuthFlowToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthFlowAudit" ADD CONSTRAINT "AuthFlowAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthFlowAudit" ADD CONSTRAINT "AuthFlowAudit_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "AuthFlowToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;
