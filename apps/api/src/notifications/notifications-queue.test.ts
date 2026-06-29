import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConsoleEmailProvider } from "./providers/console-email.provider";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationsService } from "./notifications.service";

describe("notifications queue", () => {
  const consoleProvider = new ConsoleEmailProvider();
  const service = new NotificationsService(new NotificationsRepository(), consoleProvider);

  it("exposes queue monitoring details for email notifications", () => {
    const monitoring = service.getQueueMonitoring();

    assert.deepEqual(monitoring, {
      queue: {
        queueName: "notifications-email",
        profile: "notifications-email",
        attempts: 5,
        backoffDelayMs: 10_000,
        removeOnComplete: 200,
        removeOnFail: 1_000,
        timeoutMs: 30_000,
        concurrency: 4
      }
    });
  });

  it("processes a valid email notification job", async () => {
    const result = await service.processEmailNotificationJob({
      to: "customer@example.com",
      subject: "Pedido aprovado",
      templateKey: "order-approved",
      variables: {
        orderId: "ord_123"
      },
      metadata: {
        storeId: "store_123"
      }
    });

    assert.equal(result.delivered, true);
    assert.equal(result.delivery.channel, "email");
    assert.equal(result.delivery.provider, "console");
    assert.equal(result.delivery.to, "customer@example.com");
    assert.equal(result.delivery.templateKey, "order-approved");
    assert.equal(result.delivery.metadata.storeId, "store_123");
  });

  it("rejects invalid email jobs before processing", async () => {
    await assert.rejects(
      () =>
        service.processEmailNotificationJob({
          to: "invalid-email",
          subject: "x",
          templateKey: "x"
        }),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { code?: unknown } }).response?.code === "string" &&
        (error as { response: { code: string } }).response.code === "NOTIFICATION_EMAIL_INVALID"
    );
  });
});
