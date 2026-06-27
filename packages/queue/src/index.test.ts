import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildQueueDefaultJobOptions,
  buildWorkerOptions,
  getQueueMonitoringSnapshot,
  getQueuePolicy
} from "./index";

describe("queue policies", () => {
  it("defines retries and timeout for notification email jobs", () => {
    const policy = getQueuePolicy("notifications-email");
    const options = buildQueueDefaultJobOptions("notifications-email");
    const snapshot = getQueueMonitoringSnapshot("notifications-email", "notifications-email");

    assert.equal(policy.attempts, 5);
    assert.equal(policy.timeoutMs, 30_000);
    assert.equal(options.attempts, 5);
    assert.equal(snapshot.timeoutMs, 30_000);
    assert.deepEqual(options.backoff, {
      type: "exponential",
      delay: 10_000
    });
  });

  it("defines stronger retry policy for domain ssl status monitoring", () => {
    const policy = getQueuePolicy("domain-ssl-status");
    const workerOptions = buildWorkerOptions("domain-ssl-status");
    const snapshot = getQueueMonitoringSnapshot("domain-ssl-status", "domain-ssl-status");

    assert.equal(policy.attempts, 10);
    assert.equal(policy.timeoutMs, 60_000);
    assert.equal(workerOptions.concurrency, 1);
    assert.equal(snapshot.profile, "domain-ssl-status");
    assert.equal(snapshot.backoffDelayMs, 30_000);
  });

  it("exposes monitoring snapshot for payment webhook processing", () => {
    const snapshot = getQueueMonitoringSnapshot(
      "payment-webhook-processing",
      "payment-webhook-processing"
    );

    assert.deepEqual(snapshot, {
      queueName: "payment-webhook-processing",
      profile: "payment-webhook-processing",
      attempts: 6,
      backoffDelayMs: 5_000,
      removeOnComplete: 300,
      removeOnFail: 1_000,
      timeoutMs: 45_000,
      concurrency: 4
    });
  });
});
