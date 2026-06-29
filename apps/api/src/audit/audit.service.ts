import { Injectable } from "@nestjs/common";
import { AuditLogChannel } from "@prisma/client";
import { AuditRepository } from "./audit.repository";

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  getBoundary() {
    return this.auditRepository.getBoundary();
  }

  recordEvent(input: {
    action: string;
    channel: AuditLogChannel;
    userId?: string | null;
    storeId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    payloadSummary?: unknown;
  }) {
    return this.auditRepository.createAuditLog(input);
  }

  async listAuditLogs(input?: {
    storeId?: string;
    userId?: string;
    action?: string;
    take?: number;
  }) {
    const logs = await this.auditRepository.listAuditLogs(input);

    return {
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        channel: log.channel,
        entityType: log.entityType,
        entityId: log.entityId,
        payloadSummary: log.payloadSummary,
        createdAt: log.createdAt,
        user: log.user
          ? {
              id: log.user.id,
              email: log.user.email,
              fullName: log.user.fullName,
              platformRole: log.user.platformRole
            }
          : null,
        store: log.store
          ? {
              id: log.store.id,
              name: log.store.name,
              slug: log.store.slug
            }
          : null
      }))
    };
  }
}
