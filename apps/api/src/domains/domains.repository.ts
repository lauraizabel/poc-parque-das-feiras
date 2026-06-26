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
}
