-- CreateTable
CREATE TABLE "StoreTheme" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#c45c2c',
    "accentColor" TEXT NOT NULL DEFAULT '#8f3610',
    "surfaceColor" TEXT NOT NULL DEFAULT '#f5f1e8',
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "heroTitle" TEXT,
    "heroSubtitle" TEXT,
    "announcementText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreTheme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreTheme_storeId_key" ON "StoreTheme"("storeId");

-- CreateIndex
CREATE INDEX "StoreTheme_storeId_idx" ON "StoreTheme"("storeId");

-- AddForeignKey
ALTER TABLE "StoreTheme" ADD CONSTRAINT "StoreTheme_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
