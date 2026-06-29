import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { DomainStatus, PlatformRole } from "@prisma/client";
import { prisma } from "@acme/database";
import { DomainsRepository } from "./domains.repository";
import { DomainsService } from "./domains.service";

describe("domain dns verification", () => {
  const suffix = Date.now().toString(36);
  const storeSlug = `dns-check-${suffix}`;
  const host = `www.${storeSlug}.com`;
  const dnsTarget = `${storeSlug}.lvh.me`;

  let userId = "";
  let storeId = "";
  let domainId = "";

  before(async () => {
    const user = await prisma.user.create({
      data: {
        email: `dns-check-${suffix}@example.com`,
        passwordHash: "test-password-hash",
        platformRole: PlatformRole.CUSTOMER
      }
    });
    userId = user.id;

    const store = await prisma.store.create({
      data: {
        name: "DNS Check Store",
        slug: storeSlug,
        defaultSubdomain: storeSlug,
        ownerId: user.id
      }
    });
    storeId = store.id;

    const domain = await prisma.storeDomain.create({
      data: {
        host,
        storeId: store.id,
        status: DomainStatus.AWAITING_DNS,
        dnsTargetValue: dnsTarget
      }
    });
    domainId = domain.id;
  });

  after(async () => {
    if (storeId) {
      await prisma.store.delete({
        where: { id: storeId }
      });
    }

    if (userId) {
      await prisma.user.delete({
        where: { id: userId }
      });
    }
  });

  it("moves the domain to SSL_PENDING when the CNAME matches the expected target", async () => {
    const service = new DomainsService(
      new DomainsRepository(),
      {
        getOrThrow: () => "lvh.me"
      } as never,
      {
        recordEvent: async () => null
      } as never,
      {
        resolveCname: async () => ({
          configuredTarget: `${dnsTarget}.`
        })
      } as never,
      {
        provisionDomain: async () => ({
          externalId: `mock-${domainId}`,
          status: "pending",
          payload: {}
        }),
        getProvisioningStatus: async () => ({
          status: "active",
          payload: {}
        })
      } as never
    );

    await service.processDnsVerificationJob(domainId);

    const updatedDomain = await prisma.storeDomain.findUniqueOrThrow({
      where: { id: domainId }
    });

    assert.equal(updatedDomain.status, DomainStatus.SSL_PENDING);
    assert.equal(updatedDomain.dnsConfiguredValue, dnsTarget);
    assert.equal(updatedDomain.dnsErrorMessage, null);
    assert.ok(updatedDomain.dnsVerifiedAt instanceof Date);
  });

  it("moves the domain back to AWAITING_DNS when the CNAME target is incorrect", async () => {
    await prisma.storeDomain.update({
      where: { id: domainId },
      data: {
        status: DomainStatus.VERIFYING,
        dnsConfiguredValue: null,
        dnsVerifiedAt: null,
        dnsErrorMessage: null
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
      {
        resolveCname: async () => ({
          configuredTarget: "wrong-target.example.com"
        })
      } as never,
      {
        provisionDomain: async () => ({
          externalId: `mock-${domainId}`,
          status: "pending",
          payload: {}
        }),
        getProvisioningStatus: async () => ({
          status: "active",
          payload: {}
        })
      } as never
    );

    await service.processDnsVerificationJob(domainId);

    const updatedDomain = await prisma.storeDomain.findUniqueOrThrow({
      where: { id: domainId }
    });

    assert.equal(updatedDomain.status, DomainStatus.AWAITING_DNS);
    assert.equal(updatedDomain.dnsConfiguredValue, "wrong-target.example.com");
    assert.match(updatedDomain.dnsErrorMessage ?? "", /CNAME mismatch/);
  });

  it("marks the domain as ERROR when DNS lookup throws", async () => {
    await prisma.storeDomain.update({
      where: { id: domainId },
      data: {
        status: DomainStatus.VERIFYING,
        dnsConfiguredValue: null,
        dnsVerifiedAt: null,
        dnsErrorMessage: null
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
      {
        resolveCname: async () => {
          throw new Error("queryA ENOTFOUND");
        }
      } as never,
      {
        provisionDomain: async () => ({
          externalId: `mock-${domainId}`,
          status: "pending",
          payload: {}
        }),
        getProvisioningStatus: async () => ({
          status: "active",
          payload: {}
        })
      } as never
    );

    await assert.rejects(() => service.processDnsVerificationJob(domainId), /ENOTFOUND/);

    const updatedDomain = await prisma.storeDomain.findUniqueOrThrow({
      where: { id: domainId }
    });

    assert.equal(updatedDomain.status, DomainStatus.ERROR);
    assert.equal(updatedDomain.dnsConfiguredValue, null);
    assert.match(updatedDomain.dnsErrorMessage ?? "", /ENOTFOUND/);
  });
});
