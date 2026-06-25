import { Injectable } from "@nestjs/common";
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
}
