import { Injectable } from "@nestjs/common";
import { DomainBoundary } from "../platform/domain-boundary";

@Injectable()
export class PaymentsRepository {
  getBoundary(): DomainBoundary {
    return {
      module: "payments",
      description: "Payment providers, intents, webhooks and account mapping.",
      responsibilities: ["payment accounts", "payment intents", "provider payloads", "webhook events"],
      dependsOn: ["database", "queue", "integrations", "stores"]
    };
  }
}
