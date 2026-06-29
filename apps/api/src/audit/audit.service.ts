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
}
