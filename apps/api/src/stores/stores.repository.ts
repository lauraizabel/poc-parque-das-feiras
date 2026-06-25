import { Injectable } from "@nestjs/common";
import { StoreMemberRole } from "@prisma/client";
import { prisma } from "@acme/database";
import { DomainBoundary } from "../platform/domain-boundary";

@Injectable()
export class StoresRepository {
  getBoundary(): DomainBoundary {
    return {
      module: "stores",
      description: "Store lifecycle, settings and merchant memberships.",
      responsibilities: ["store profiles", "store settings", "store members", "merchant onboarding"],
      dependsOn: ["database", "auth"]
    };
  }

  createStore(input: { name: string; slug: string }) {
    return prisma.store.create({
      data: {
        name: input.name,
        slug: input.slug
      }
    });
  }

  addMember(input: {
    storeId: string;
    userId: string;
    role: StoreMemberRole;
  }) {
    return prisma.storeMember.create({
      data: input
    });
  }
}
