-- CreateTable
CREATE TABLE "StoreMemberInvite" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "role" "StoreMemberRole" NOT NULL DEFAULT 'STORE_SUPPORT',
    "invitedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreMemberInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreMemberInvite_storeId_invitedEmail_key" ON "StoreMemberInvite"("storeId", "invitedEmail");

-- CreateIndex
CREATE INDEX "StoreMemberInvite_invitedByUserId_idx" ON "StoreMemberInvite"("invitedByUserId");

-- AddForeignKey
ALTER TABLE "StoreMemberInvite" ADD CONSTRAINT "StoreMemberInvite_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreMemberInvite" ADD CONSTRAINT "StoreMemberInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
