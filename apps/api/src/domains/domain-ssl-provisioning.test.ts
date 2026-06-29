import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { DomainStatus, PlatformRole } from "@prisma/client";
import { prisma } from "@acme/database";
import { DomainsDnsService } from "./domains-dns.service";
import { DomainsRepository } from "./domains.repository";
import { DomainsService } from "./domains.service";
import { DomainsSslService } from "./domains-ssl.service";

describe("domain ssl provisioning", () => {
  const suffix = Date.now().toString(36);
  const storeSlug = `ssl-check-${suffix}`;
  const errorStoreSlug = `ssl-error-check-${suffix}`;

  let userId = "";
  let errorUserId = "";
  let storeId = "";
  let errorStoreId = "";
  let activeDomainId = "";
  let errorDomainId = "";

  before(async () => {
    const user = await prisma.user.create({
      data: {
        email: `ssl-check-${suffix}@example.com`,
        passwordHash: "test-password-hash",
        platformRole: PlatformRole.CUSTOMER
      }
    });
    userId = user.id;

    const errorUser = await prisma.user.create({
      data: {
        email: `ssl-error-check-${suffix}@example.com`,
        passwordHash: "test-password-hash",
        platformRole: PlatformRole.CUSTOMER
      }
    });
    errorUserId = errorUser.id;

    const store = await prisma.store.create({
      data: {
        name: "SSL Check Store",
        slug: storeSlug,
        defaultSubdomain: storeSlug,
        ownerId: user.id
      }
    });
    storeId = store.id;

    const errorStore = await prisma.store.create({
      data: {
        name: "SSL Error Store",
        slug: errorStoreSlug,
        defaultSubdomain: errorStoreSlug,
        ownerId: errorUser.id
      }
    });
    errorStoreId = errorStore.id;

    const activeDomain = await prisma.storeDomain.create({
      data: {
        host: `www.${storeSlug}.com`,
        storeId: store.id,
        status: DomainStatus.SSL_PENDING,
        dnsTargetValue: `${storeSlug}.lvh.me`
      }
    });
    activeDomainId = activeDomain.id;

    const errorDomain = await prisma.storeDomain.create({
      data: {
        host: `www.ssl-error-${errorStoreSlug}.com`,
        storeId: errorStore.id,
        status: DomainStatus.SSL_PENDING,
        dnsTargetValue: `${errorStoreSlug}.lvh.me`
      }
    });
    errorDomainId = errorDomain.id;
  });

  after(async () => {
    if (errorStoreId) {
      await prisma.store.delete({
        where: { id: errorStoreId }
      });
    }

    if (storeId) {
      await prisma.store.delete({
        where: { id: storeId }
      });
    }

    if (errorUserId) {
      await prisma.user.delete({
        where: { id: errorUserId }
      });
    }

    if (userId) {
      await prisma.user.delete({
        where: { id: userId }
      });
    }
  });

  it("stores provider metadata and keeps the domain in SSL_PENDING after provisioning starts", async () => {
    const service = new DomainsService(
      new DomainsRepository(),
      {
        getOrThrow: (key: string) => {
          if (key === "MARKETPLACE_ROOT_DOMAIN") {
            return "lvh.me";
          }

          if (key === "DOMAIN_PROVIDER") {
            return "CLOUDFLARE";
          }

          if (key === "DOMAINS_ENABLED") {
            return false;
          }

          return "";
        }
      } as never,
      {
        recordEvent: async () => null
      } as never,
      new DomainsDnsService(),
      new DomainsSslService({
        get: (key: string) => {
          if (key === "DOMAINS_ENABLED") {
            return false;
          }

          if (key === "DOMAIN_PROVIDER") {
            return "CLOUDFLARE";
          }

          return undefined;
        }
      } as never)
    );

    await service.processSslProvisioningJob(activeDomainId);

    const updatedDomain = await prisma.storeDomain.findUniqueOrThrow({
      where: { id: activeDomainId }
    });

    assert.equal(updatedDomain.status, DomainStatus.SSL_PENDING);
    assert.match(updatedDomain.sslProvisioningId ?? "", /^local_cloudflare-/);
    assert.match(updatedDomain.sslProvisioningMetadata ?? "", /hostname-accepted/);
    assert.equal(updatedDomain.sslErrorMessage, null);
  });

  it("activates the domain when the provider reports the certificate as active", async () => {
    const service = new DomainsService(
      new DomainsRepository(),
      {
        getOrThrow: () => "lvh.me"
      } as never,
      {
        recordEvent: async () => null
      } as never,
      new DomainsDnsService(),
      new DomainsSslService({
        get: (key: string) => {
          if (key === "DOMAINS_ENABLED") {
            return false;
          }

          if (key === "DOMAIN_PROVIDER") {
            return "CLOUDFLARE";
          }

          return undefined;
        }
      } as never)
    );

    await service.processSslStatusSyncJob(activeDomainId);

    const updatedDomain = await prisma.storeDomain.findUniqueOrThrow({
      where: { id: activeDomainId }
    });

    assert.equal(updatedDomain.status, DomainStatus.ACTIVE);
    assert.ok(updatedDomain.activatedAt instanceof Date);
    assert.ok(updatedDomain.sslIssuedAt instanceof Date);
    assert.match(updatedDomain.sslProvisioningMetadata ?? "", /certificate-active/);
  });

  it("keeps the domain in SSL_PENDING when the provider still reports certificate provisioning in progress", async () => {
    const pendingStoreSlug = `ssl-pending-check-${suffix}`;
    const pendingUser = await prisma.user.create({
      data: {
        email: `ssl-pending-check-${suffix}@example.com`,
        passwordHash: "test-password-hash",
        platformRole: PlatformRole.CUSTOMER
      }
    });

    const pendingStore = await prisma.store.create({
      data: {
        name: "SSL Pending Store",
        slug: pendingStoreSlug,
        defaultSubdomain: pendingStoreSlug,
        ownerId: pendingUser.id
      }
    });

    const pendingDomain = await prisma.storeDomain.create({
      data: {
        host: `www.ssl-pending-${pendingStoreSlug}.com`,
        storeId: pendingStore.id,
        status: DomainStatus.SSL_PENDING,
        dnsTargetValue: `${pendingStoreSlug}.lvh.me`,
        sslProvisioningId: `local_cloudflare-${pendingStore.id}`
      }
    });

    const service = new DomainsService(
      new DomainsRepository(),
      {
        getOrThrow: () => "lvh.me"
      } as never,
      {
        recordEvent: async () => null
      } as never,
      new DomainsDnsService(),
      new DomainsSslService({
        get: (key: string) => {
          if (key === "DOMAINS_ENABLED") {
            return false;
          }

          if (key === "DOMAIN_PROVIDER") {
            return "CLOUDFLARE";
          }

          return undefined;
        }
      } as never)
    );

    await service.processSslStatusSyncJob(pendingDomain.id);

    const updatedDomain = await prisma.storeDomain.findUniqueOrThrow({
      where: { id: pendingDomain.id }
    });

    assert.equal(updatedDomain.status, DomainStatus.SSL_PENDING);
    assert.match(updatedDomain.sslProvisioningMetadata ?? "", /certificate-pending/);
    assert.equal(updatedDomain.activatedAt, null);

    await prisma.store.delete({
      where: { id: pendingStore.id }
    });

    await prisma.user.delete({
      where: { id: pendingUser.id }
    });
  });

  it("marks the domain as ERROR when the provider rejects the host", async () => {
    const service = new DomainsService(
      new DomainsRepository(),
      {
        getOrThrow: () => "lvh.me"
      } as never,
      {
        recordEvent: async () => null
      } as never,
      new DomainsDnsService(),
      new DomainsSslService({
        get: (key: string) => {
          if (key === "DOMAINS_ENABLED") {
            return false;
          }

          if (key === "DOMAIN_PROVIDER") {
            return "CLOUDFLARE";
          }

          return undefined;
        }
      } as never)
    );

    await service.processSslProvisioningJob(errorDomainId);

    const updatedDomain = await prisma.storeDomain.findUniqueOrThrow({
      where: { id: errorDomainId }
    });

    assert.equal(updatedDomain.status, DomainStatus.ERROR);
    assert.match(updatedDomain.sslErrorMessage ?? "", /Provider rejected/);
  });
});
