-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'ABANDONED');

-- CreateIndex
CREATE UNIQUE INDEX "Product_id_storeId_key" ON "Product"("id", "storeId");

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "customerEmail" TEXT,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "currencyCode" TEXT NOT NULL DEFAULT 'BRL',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "productName" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "compareAtCents" INTEGER,
    "currencyCode" TEXT NOT NULL DEFAULT 'BRL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cart_id_storeId_key" ON "Cart"("id", "storeId");

-- CreateIndex
CREATE INDEX "Cart_storeId_status_idx" ON "Cart"("storeId", "status");

-- CreateIndex
CREATE INDEX "Cart_storeId_sessionId_status_idx" ON "Cart"("storeId", "sessionId", "status");

-- CreateIndex
CREATE INDEX "Cart_storeId_userId_status_idx" ON "Cart"("storeId", "userId", "status");

-- CreateIndex
CREATE INDEX "Cart_storeId_customerEmail_status_idx" ON "Cart"("storeId", "customerEmail", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON "CartItem"("cartId", "productId");

-- CreateIndex
CREATE INDEX "CartItem_cartId_storeId_idx" ON "CartItem"("cartId", "storeId");

-- CreateIndex
CREATE INDEX "CartItem_storeId_productId_idx" ON "CartItem"("storeId", "productId");

-- AddCheckConstraint
ALTER TABLE "Cart"
ADD CONSTRAINT "Cart_identity_check"
CHECK ("sessionId" IS NOT NULL OR "userId" IS NOT NULL OR "customerEmail" IS NOT NULL);

-- AddCheckConstraint
ALTER TABLE "CartItem"
ADD CONSTRAINT "CartItem_quantity_check"
CHECK ("quantity" > 0);

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_storeId_fkey" FOREIGN KEY ("cartId", "storeId") REFERENCES "Cart"("id", "storeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_storeId_fkey" FOREIGN KEY ("productId", "storeId") REFERENCES "Product"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;
