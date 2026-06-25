import { Injectable } from "@nestjs/common";
import { DomainBoundary } from "../platform/domain-boundary";

@Injectable()
export class OrdersRepository {
  getBoundary(): DomainBoundary {
    return {
      module: "orders",
      description: "Order persistence, status transitions and fulfillment-facing state.",
      responsibilities: ["orders", "line items", "status history", "fulfillment metadata"],
      dependsOn: ["database", "checkout", "payments"]
    };
  }
}
