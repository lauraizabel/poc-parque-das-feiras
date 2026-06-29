ALTER TABLE "CartItem"
ADD COLUMN IF NOT EXISTS "variantId" TEXT,
ADD COLUMN IF NOT EXISTS "variantName" TEXT,
ADD COLUMN IF NOT EXISTS "variantSku" TEXT;

ALTER TABLE "OrderItem"
ADD COLUMN IF NOT EXISTS "variantId" TEXT,
ADD COLUMN IF NOT EXISTS "variantName" TEXT,
ADD COLUMN IF NOT EXISTS "variantSku" TEXT;

CREATE TABLE IF NOT EXISTS "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "priceCents" INTEGER,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

DROP INDEX IF EXISTS "CartItem_cartId_productId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "CartItem_cartId_productId_variantId_key" ON "CartItem"("cartId", "productId", "variantId");
CREATE INDEX IF NOT EXISTS "CartItem_variantId_idx" ON "CartItem"("variantId");
CREATE INDEX IF NOT EXISTS "OrderItem_variantId_idx" ON "OrderItem"("variantId");

CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_productId_sku_key" ON "ProductVariant"("productId", "sku");
CREATE INDEX IF NOT EXISTS "ProductVariant_productId_sortOrder_idx" ON "ProductVariant"("productId", "sortOrder");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'CartItem_variantId_fkey'
    ) THEN
        ALTER TABLE "CartItem"
        ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'OrderItem_variantId_fkey'
    ) THEN
        ALTER TABLE "OrderItem"
        ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'ProductVariant_productId_fkey'
    ) THEN
        ALTER TABLE "ProductVariant"
        ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
