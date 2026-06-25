import { Injectable } from "@nestjs/common";
import { AuditRepository } from "./audit.repository";

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  getBoundary() {
    return this.auditRepository.getBoundary();
  }
}
