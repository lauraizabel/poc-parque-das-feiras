import { Injectable } from "@nestjs/common";
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
}
