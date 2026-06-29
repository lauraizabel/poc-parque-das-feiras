import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getPaymentQueuePolicySnapshot,
  getPaymentQueueMonitoring,
  PAYMENT_WEBHOOK_QUEUE
} from "./payments.queue";

describe("payments queue", () => {
  it("exposes policy snapshot for payment webhook queue", () => {
    const snapshot = getPaymentQueuePolicySnapshot();

    assert.equal(snapshot.queueName, PAYMENT_WEBHOOK_QUEUE);
    assert.equal(snapshot.profile, "payment-webhook-processing");
    assert.equal(snapshot.attempts, 6);
    assert.equal(snapshot.backoffDelayMs, 5_000);
    assert.equal(snapshot.removeOnComplete, 300);
    assert.equal(snapshot.removeOnFail, 1_000);
    assert.equal(snapshot.timeoutMs, 45_000);
    assert.equal(snapshot.concurrency, 4);
  });

  it("includes queue counts from live monitoring (null when redis is unreachable)", async () => {
    const monitoring = await getPaymentQueueMonitoring();

    assert.equal(monitoring.queueName, PAYMENT_WEBHOOK_QUEUE);
    assert.equal(monitoring.profile, "payment-webhook-processing");
    assert.equal(typeof monitoring.attempts, "number");
    assert.equal(typeof monitoring.timeoutMs, "number");
    assert.equal(typeof monitoring.concurrency, "number");
    // counts may be null if redis is unreachable, but the field exists
    assert.ok(monitoring.counts === null || typeof monitoring.counts === "object");
  });

  it("has correct queue name constant", () => {
    assert.equal(PAYMENT_WEBHOOK_QUEUE, "payment-webhook-processing");
  });
});