import { Injectable } from "@nestjs/common";
import { DomainStatus, StoreDomainType } from "@prisma/client";
import { prisma } from "@acme/database";
import { DomainBoundary } from "../platform/domain-boundary";

@Injectable()
export class DomainsRepository {
  getBoundary(): DomainBoundary {
    return {
      module: "domains",
      description: "Custom domains, DNS validation and SSL lifecycle.",
      responsibilities: ["domain registration", "DNS checks", "SSL status", "host routing metadata"],
      dependsOn: ["database", "queue", "config"]
    };
  }

  findStoreByDefaultSubdomain(defaultSubdomain: string) {
    return prisma.store.findUnique({
      where: { defaultSubdomain }
    });
  }

  findStoreById(storeId: string) {
    return prisma.store.findUnique({
      where: { id: storeId }
    });
  }

  findCustomDomainByStoreId(storeId: string) {
    return prisma.storeDomain.findUnique({
      where: {
        storeId_type: {
          storeId,
          type: StoreDomainType.CUSTOM_DOMAIN
        }
      }
    });
  }

  findDomainByHost(host: string) {
    return prisma.storeDomain.findUnique({
      where: { host }
    });
  }

  findDomainById(domainId: string) {
    return prisma.storeDomain.findUnique({
      where: { id: domainId }
    });
  }

  findActiveDomain(hostname: string) {
    return prisma.storeDomain.findFirst({
      where: {
        host: hostname,
        status: DomainStatus.ACTIVE
      },
      include: {
        store: true
      }
    });
  }

  createCustomDomain(input: {
    host: string;
    storeId: string;
    dnsTargetValue: string;
  }) {
    return prisma.storeDomain.create({
      data: {
        host: input.host,
        type: StoreDomainType.CUSTOM_DOMAIN,
        status: DomainStatus.AWAITING_DNS,
        dnsTargetValue: input.dnsTargetValue,
        storeId: input.storeId
      }
    });
  }

  reactivateCustomDomain(input: {
    domainId: string;
    host: string;
    dnsTargetValue: string;
  }) {
    return prisma.storeDomain.update({
      where: { id: input.domainId },
      data: {
        host: input.host,
        status: DomainStatus.AWAITING_DNS,
        dnsTargetValue: input.dnsTargetValue,
        dnsConfiguredValue: null,
        dnsLastCheckedAt: null,
        dnsVerifiedAt: null,
        dnsErrorMessage: null,
        sslProvisioningId: null,
        sslProvisioningMetadata: null,
        sslLastCheckedAt: null,
        sslIssuedAt: null,
        sslErrorMessage: null,
        activatedAt: null,
        removedAt: null
      }
    });
  }

  updateDomainDnsStatus(
    domainId: string,
    input: {
      status: DomainStatus;
      dnsConfiguredValue?: string | null;
      dnsLastCheckedAt?: Date;
      dnsVerifiedAt?: Date | null;
      dnsErrorMessage?: string | null;
    }
  ) {
    return prisma.storeDomain.update({
      where: { id: domainId },
      data: {
        status: input.status,
        dnsConfiguredValue: input.dnsConfiguredValue,
        dnsLastCheckedAt: input.dnsLastCheckedAt,
        dnsVerifiedAt: input.dnsVerifiedAt,
        dnsErrorMessage: input.dnsErrorMessage
      }
    });
  }

  updateDomainSslStatus(
    domainId: string,
    input: {
      status: DomainStatus;
      sslProvisioningId?: string | null;
      sslProvisioningMetadata?: string | null;
      sslLastCheckedAt?: Date;
      sslIssuedAt?: Date | null;
      sslErrorMessage?: string | null;
      activatedAt?: Date | null;
    }
  ) {
    return prisma.storeDomain.update({
      where: { id: domainId },
      data: {
        status: input.status,
        sslProvisioningId: input.sslProvisioningId,
        sslProvisioningMetadata: input.sslProvisioningMetadata,
        sslLastCheckedAt: input.sslLastCheckedAt,
        sslIssuedAt: input.sslIssuedAt,
        sslErrorMessage: input.sslErrorMessage,
        activatedAt: input.activatedAt
      }
    });
  }

  markDomainRemoved(
    domainId: string,
    input: {
      sslErrorMessage?: string | null;
      dnsErrorMessage?: string | null;
    } = {}
  ) {
    return prisma.storeDomain.update({
      where: { id: domainId },
      data: {
        status: DomainStatus.REMOVED,
        removedAt: new Date(),
        activatedAt: null,
        sslIssuedAt: null,
        sslLastCheckedAt: new Date(),
        dnsLastCheckedAt: new Date(),
        sslProvisioningId: null,
        sslProvisioningMetadata: null,
        sslErrorMessage: input.sslErrorMessage ?? null,
        dnsErrorMessage: input.dnsErrorMessage ?? null
      }
    });
  }
}
