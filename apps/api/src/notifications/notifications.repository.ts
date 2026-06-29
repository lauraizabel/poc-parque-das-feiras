import { Injectable } from "@nestjs/common";
import { prisma } from "@acme/database";
import { NotificationChannel, NotificationStatus } from "@prisma/client";
import { DomainBoundary } from "../platform/domain-boundary";
import { toSafePayloadSummary } from "../platform/security/payload-summary";

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

  createNotification(input: {
    userId?: string | null;
    storeId?: string | null;
    channel: NotificationChannel;
    status?: NotificationStatus;
    recipient: string;
    subject?: string | null;
    templateKey?: string | null;
    provider?: string | null;
    queuedAt?: Date | null;
    deliveredAt?: Date | null;
    failedAt?: Date | null;
    failureMessage?: string | null;
    payloadSummary?: unknown;
  }) {
    return prisma.notification.create({
      data: {
        userId: input.userId ?? null,
        storeId: input.storeId ?? null,
        channel: input.channel,
        status: input.status ?? NotificationStatus.PENDING,
        recipient: input.recipient,
        subject: input.subject ?? null,
        templateKey: input.templateKey ?? null,
        provider: input.provider ?? null,
        queuedAt: input.queuedAt ?? null,
        deliveredAt: input.deliveredAt ?? null,
        failedAt: input.failedAt ?? null,
        failureMessage: input.failureMessage ?? null,
        payloadSummary: toSafePayloadSummary(input.payloadSummary)
      }
    });
  }

  updateNotificationStatus(input: {
    notificationId: string;
    status: NotificationStatus;
    provider?: string | null;
    deliveredAt?: Date | null;
    failedAt?: Date | null;
    failureMessage?: string | null;
    payloadSummary?: unknown;
  }) {
    return prisma.notification.update({
      where: {
        id: input.notificationId
      },
      data: {
        status: input.status,
        provider: input.provider ?? undefined,
        deliveredAt: input.deliveredAt ?? undefined,
        failedAt: input.failedAt ?? undefined,
        failureMessage: input.failureMessage ?? undefined,
        payloadSummary:
          input.payloadSummary === undefined
            ? undefined
            : toSafePayloadSummary(input.payloadSummary)
      }
    });
  }
}
