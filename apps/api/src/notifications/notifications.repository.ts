import { Injectable } from "@nestjs/common";
import { prisma } from "@acme/database";
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

  async getStoreNotificationRecipients(storeId: string) {
    const store = await prisma.store.findUnique({
      where: {
        id: storeId
      },
      include: {
        owner: true
      }
    });

    if (!store) {
      return null;
    }

    return {
      storeId: store.id,
      storeName: store.name,
      storeSlug: store.slug,
      ownerEmail: store.owner.email,
      supportEmail: store.supportEmail
    };
  }
}
