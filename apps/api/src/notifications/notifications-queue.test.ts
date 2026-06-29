import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConsoleEmailProvider } from "./providers/console-email.provider";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationsService } from "./notifications.service";
import { getEmailNotificationQueueMonitoring, getEmailNotificationQueuePolicySnapshot } from "./notifications.queue";

describe("notifications queue", () => {
  const consoleProvider = new ConsoleEmailProvider();
  const service = new NotificationsService(new NotificationsRepository(), consoleProvider);

  it("exposes queue policy snapshot for email notifications", () => {
    const snapshot = getEmailNotificationQueuePolicySnapshot();

    assert.deepEqual(snapshot, {
      queueName: "notifications-email",
      profile: "notifications-email",
      attempts: 5,
      backoffDelayMs: 10_000,
      removeOnComplete: 200,
      removeOnFail: 1_000,
      timeoutMs: 30_000,
      concurrency: 4
    });
  });

  it("includes live queue counts in monitoring (null when redis is unreachable)", async () => {
    const monitoring = await getEmailNotificationQueueMonitoring();

    assert.equal(monitoring.queueName, "notifications-email");
    assert.equal(monitoring.profile, "notifications-email");
    assert.equal(typeof monitoring.attempts, "number");
    assert.equal(typeof monitoring.timeoutMs, "number");
    // counts may be null if redis is unreachable, but the field exists
    assert.ok(monitoring.counts === null || typeof monitoring.counts === "object");
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
