ALTER TABLE "Store"
ADD COLUMN "defaultSubdomain" TEXT,
ADD COLUMN "ownerId" TEXT,
ADD COLUMN "supportEmail" TEXT,
ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'BRL',
ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'pt-BR';

UPDATE "Store" s
SET "defaultSubdomain" = s."slug"
WHERE "defaultSubdomain" IS NULL;

UPDATE "Store" s
SET "ownerId" = COALESCE(
  (
    SELECT sm."userId"
    FROM "StoreMember" sm
    WHERE sm."storeId" = s."id" AND sm."role" = 'STORE_OWNER'
    ORDER BY sm."createdAt" ASC
    LIMIT 1
  ),
  (
    SELECT sm."userId"
    FROM "StoreMember" sm
    WHERE sm."storeId" = s."id"
    ORDER BY sm."createdAt" ASC
    LIMIT 1
  )
)
WHERE "ownerId" IS NULL;

ALTER TABLE "Store"
ALTER COLUMN "defaultSubdomain" SET NOT NULL,
ALTER COLUMN "ownerId" SET NOT NULL;

CREATE UNIQUE INDEX "Store_defaultSubdomain_key" ON "Store"("defaultSubdomain");
CREATE INDEX "Store_ownerId_idx" ON "Store"("ownerId");

ALTER TABLE "Store"
ADD CONSTRAINT "Store_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
