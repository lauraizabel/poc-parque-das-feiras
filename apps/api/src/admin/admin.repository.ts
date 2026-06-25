import { Injectable } from "@nestjs/common";
import { DomainBoundary } from "../platform/domain-boundary";

@Injectable()
export class AdminRepository {
  getBoundary(): DomainBoundary {
    return {
      module: "admin",
      description: "Operational platform administration and cross-tenant oversight.",
      responsibilities: ["platform metrics", "tenant moderation", "manual interventions", "support tooling"],
      dependsOn: ["database", "auth", "stores", "orders"]
    };
  }
}
