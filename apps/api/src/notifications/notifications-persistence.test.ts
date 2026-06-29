import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { prisma } from "@acme/database";
import { NotificationChannel, NotificationStatus } from "@prisma/client";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationsService } from "./notifications.service";

describe("notifications persistence", () => {
  const repository = new NotificationsRepository();
  const service = new NotificationsService(repository);
  const cleanupStoreIds = new Set<string>();
  const cleanupUserIds = new Set<string>();
  const cleanupNotificationIds = new Set<string>();

  after(async () => {
    for (const notificationId of cleanupNotificationIds) {
      await prisma.notification.delete({ where: { id: notificationId } }).catch(() => null);
    }

    for (const storeId of cleanupStoreIds) {
      await prisma.store.delete({ where: { id: storeId } }).catch(() => null);
    }

    for (const userId of cleanupUserIds) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => null);
    }
  });

  it("persists notification records and marks them delivered with sanitized payloads", async () => {
    const suffix = Date.now().toString(36);
    const user = await prisma.user.create({
      data: {
        email: `notification-${suffix}@example.com`,
        passwordHash: "hash",
        fullName: "Notification User"
      }
    });
    cleanupUserIds.add(user.id);

    const store = await prisma.store.create({
      data: {
        ownerId: user.id,
        name: "Notification Store",
        slug: `notification-store-${suffix}`,
        defaultSubdomain: `notification-store-${suffix}`
      }
    });
    cleanupStoreIds.add(store.id);

    const notification = await repository.createNotification({
      userId: user.id,
      storeId: store.id,
      channel: NotificationChannel.EMAIL,
      status: NotificationStatus.PENDING,
      recipient: user.email,
      subject: "Pedido aprovado",
      templateKey: "payment-approved-customer",
      payloadSummary: {
        customerEmail: user.email,
        password: "StrongPass123",
        token: "secret-token"
      }
    });
    cleanupNotificationIds.add(notification.id);

    assert.equal(notification.status, NotificationStatus.PENDING);
    assert.match(notification.payloadSummary ?? "", /\[REDACTED\]/);
    assert.doesNotMatch(notification.payloadSummary ?? "", /StrongPass123|secret-token/);

    const delivery = await service.processEmailNotificationJob({
      to: user.email,
      subject: "Pedido aprovado",
      templateKey: "payment-approved-customer",
      variables: {
        orderId: "ord_123"
      },
      metadata: {
        notificationId: notification.id,
        storeId: store.id,
        userId: user.id,
        authorization: "Bearer top-secret"
      }
    });

    assert.equal(delivery.delivered, true);

    const persisted = await prisma.notification.findUnique({
      where: {
        id: notification.id
      }
    });

    assert.ok(persisted);
    assert.equal(persisted?.status, NotificationStatus.DELIVERED);
    assert.equal(persisted?.provider, "console");
    assert.ok(persisted?.deliveredAt);
    assert.match(persisted?.payloadSummary ?? "", /notificationId/);
    assert.match(persisted?.payloadSummary ?? "", /\[REDACTED\]/);
    assert.doesNotMatch(persisted?.payloadSummary ?? "", /top-secret/);
  });
});
