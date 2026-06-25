import { Injectable } from "@nestjs/common";
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
}
