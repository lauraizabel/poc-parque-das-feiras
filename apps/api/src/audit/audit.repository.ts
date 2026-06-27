import { Injectable } from "@nestjs/common";
import { prisma } from "@acme/database";
import { StatusTransitionEntityType } from "@prisma/client";
import { DomainBoundary } from "../platform/domain-boundary";

@Injectable()
export class AuditRepository {
  getBoundary(): DomainBoundary {
    return {
      module: "audit",
      description: "Operational audit trail and security-sensitive event records.",
      responsibilities: ["actor logs", "security events", "domain audit entries", "compliance exports"],
      dependsOn: ["database", "auth"]
    };
  }

  createStatusTransitionAudit(input: {
    entityType: StatusTransitionEntityType;
    entityId: string;
    storeId?: string | null;
    fromStatus?: string | null;
    toStatus: string;
    allowed: boolean;
    reason?: string | null;
    source: string;
    actorType?: string | null;
    actorId?: string | null;
    metadata?: string | null;
  }) {
    return prisma.statusTransitionAudit.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        storeId: input.storeId ?? null,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus,
        allowed: input.allowed,
        reason: input.reason ?? null,
        source: input.source,
        actorType: input.actorType ?? null,
        actorId: input.actorId ?? null,
        metadata: input.metadata ?? null
      }
    });
  }
}
