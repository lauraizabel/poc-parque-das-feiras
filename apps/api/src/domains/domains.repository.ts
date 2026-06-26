import { Injectable } from "@nestjs/common";
import { DomainStatus } from "@prisma/client";
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

  findVerifiedDomain(hostname: string) {
    return prisma.domain.findFirst({
      where: {
        hostname,
        status: DomainStatus.VERIFIED
      },
      include: {
        store: true
      }
    });
  }
}
