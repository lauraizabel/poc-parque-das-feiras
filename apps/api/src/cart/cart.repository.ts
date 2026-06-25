import { Injectable } from "@nestjs/common";
import { DomainBoundary } from "../platform/domain-boundary";

@Injectable()
export class CartRepository {
  getBoundary(): DomainBoundary {
    return {
      module: "cart",
      description: "Single-store cart state and cart item persistence.",
      responsibilities: ["cart sessions", "cart items", "cart totals", "cart ownership"],
      dependsOn: ["database", "catalog", "stores"]
    };
  }
}
