-- CreateEnum
CREATE TYPE "StoreDomainType" AS ENUM ('CUSTOM_DOMAIN');

-- Evolve existing domain status enum to the lifecycle required by custom domain onboarding.
ALTER TYPE "DomainStatus" RENAME TO "DomainStatus_old";

CREATE TYPE "DomainStatus" AS ENUM (
    'PENDING',
    'AWAITING_DNS',
    'VERIFYING',
    'SSL_PENDING',
    'ACTIVE',
    'ERROR',
    'REMOVED'
);

-- Rename the canonical host column and add the lifecycle metadata required by the MVP.
ALTER TABLE "Domain" RENAME COLUMN "hostname" TO "host";

ALTER TABLE "Domain"
    ADD COLUMN "type" "StoreDomainType" NOT NULL DEFAULT 'CUSTOM_DOMAIN',
    ADD COLUMN "dnsTargetValue" TEXT,
    ADD COLUMN "dnsConfiguredValue" TEXT,
    ADD COLUMN "dnsLastCheckedAt" TIMESTAMP(3),
    ADD COLUMN "dnsVerifiedAt" TIMESTAMP(3),
    ADD COLUMN "dnsErrorMessage" TEXT,
    ADD COLUMN "sslProvisioningId" TEXT,
    ADD COLUMN "sslLastCheckedAt" TIMESTAMP(3),
    ADD COLUMN "sslIssuedAt" TIMESTAMP(3),
    ADD COLUMN "sslErrorMessage" TEXT,
    ADD COLUMN "activatedAt" TIMESTAMP(3),
    ADD COLUMN "removedAt" TIMESTAMP(3);

ALTER TABLE "Domain"
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "DomainStatus"
    USING (
        CASE
            WHEN "status"::text = 'VERIFIED' THEN 'ACTIVE'::"DomainStatus"
            WHEN "status"::text = 'FAILED' THEN 'ERROR'::"DomainStatus"
            ELSE 'PENDING'::"DomainStatus"
        END
    ),
    ALTER COLUMN "status" SET DEFAULT 'PENDING';

UPDATE "Domain"
SET
    "activatedAt" = "verifiedAt",
    "dnsVerifiedAt" = COALESCE("dnsVerifiedAt", "verifiedAt"),
    "sslIssuedAt" = COALESCE("sslIssuedAt", "verifiedAt")
WHERE "verifiedAt" IS NOT NULL;

ALTER TABLE "Domain" DROP COLUMN "verifiedAt";

DROP TYPE "DomainStatus_old";

DROP INDEX IF EXISTS "Domain_hostname_key";

CREATE UNIQUE INDEX "Domain_host_key" ON "Domain"("host");
CREATE UNIQUE INDEX "Domain_storeId_type_key" ON "Domain"("storeId", "type");
CREATE INDEX "Domain_status_idx" ON "Domain"("status");
