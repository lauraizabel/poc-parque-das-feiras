import { Injectable } from "@nestjs/common";
import { prisma } from "@acme/database";
import { AuditLogChannel, StatusTransitionEntityType } from "@prisma/client";
import { DomainBoundary } from "../platform/domain-boundary";
import { toSafePayloadSummary } from "../platform/security/payload-summary";

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

  createAuditLog(input: {
    action: string;
    channel: AuditLogChannel;
    userId?: string | null;
    storeId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    payloadSummary?: unknown;
  }) {
    return prisma.auditLog.create({
      data: {
        action: input.action,
        channel: input.channel,
        userId: input.userId ?? null,
        storeId: input.storeId ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        payloadSummary: toSafePayloadSummary(input.payloadSummary)
      }
    });
  }

  listAuditLogs(input?: {
    storeId?: string;
    userId?: string;
    action?: string;
    take?: number;
  }) {
    return prisma.auditLog.findMany({
      where: {
        ...(input?.storeId ? { storeId: input.storeId } : {}),
        ...(input?.userId ? { userId: input.userId } : {}),
        ...(input?.action ? { action: input.action } : {})
      },
      include: {
        user: true,
        store: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: input?.take ?? 100
    });
  }
}
