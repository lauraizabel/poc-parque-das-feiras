import { Injectable } from "@nestjs/common";
import { DomainBoundary } from "../platform/domain-boundary";

@Injectable()
export class NotificationsRepository {
  getBoundary(): DomainBoundary {
    return {
      module: "notifications",
      description: "Outbound notifications and template dispatch records.",
      responsibilities: ["email notifications", "template selection", "delivery records", "retry metadata"],
      dependsOn: ["database", "integrations", "queue"]
    };
  }
}
