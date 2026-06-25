import { Injectable } from "@nestjs/common";
import { DomainBoundary } from "../platform/domain-boundary";

@Injectable()
export class CheckoutRepository {
  getBoundary(): DomainBoundary {
    return {
      module: "checkout",
      description: "Checkout orchestration before payment authorization.",
      responsibilities: ["checkout sessions", "addresses", "shipping selection", "order draft creation"],
      dependsOn: ["database", "cart", "catalog", "payments"]
    };
  }
}
