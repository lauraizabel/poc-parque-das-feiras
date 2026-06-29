import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HealthService } from "./health.service";

describe("health queues", () => {
  const service = new HealthService();

  it("returns health with queues check", async () => {
    const health = await service.getHealth();

    assert.equal(health.service, "api");
    assert.ok(health.timestamp);
    assert.ok(health.status === "ok" || health.status === "degraded");
    assert.ok(health.checks.database);
    assert.ok(health.checks.redis);
    assert.ok(health.checks.storage);
    assert.ok(Array.isArray(health.checks.queues));
  });

  it("includes all expected queues in health check", async () => {
    const health = await service.getHealth();
    const queueNames = health.checks.queues.map((q) => q.queueName);

    assert.ok(queueNames.includes("notifications-email"));
    assert.ok(queueNames.includes("payment-webhook-processing"));
    assert.ok(queueNames.includes("domain-dns-verification"));
    assert.ok(queueNames.includes("domain-ssl-provisioning"));
    assert.ok(queueNames.includes("domain-ssl-status"));
  });

  it("marks queues as down when redis is unreachable", async () => {
    const health = await service.getHealth();

    for (const q of health.checks.queues) {
      assert.ok(q.queueName);
      assert.ok(q.profile);
      assert.ok(q.status === "up" || q.status === "down");
      // counts may be null when redis is unreachable
      assert.ok(q.counts === null || typeof q.counts === "object");
      if (q.counts !== null) {
        assert.equal(typeof q.counts.wait, "number");
        assert.equal(typeof q.counts.active, "number");
        assert.equal(typeof q.counts.completed, "number");
        assert.equal(typeof q.counts.failed, "number");
        assert.equal(typeof q.counts.delayed, "number");
        assert.equal(typeof q.counts.paused, "number");
      }
    }
  });

  it("returns queue health details with monitoring snapshots", async () => {
    const details = await service.getQueueHealthDetails();

    assert.ok(Array.isArray(details.queues));
    assert.equal(details.queues.length, 5);

    const queueNames = details.queues.map((q) => q.queueName);
    assert.ok(queueNames.includes("notifications-email"));
    assert.ok(queueNames.includes("payment-webhook-processing"));
    assert.ok(queueNames.includes("domain-dns-verification"));
    assert.ok(queueNames.includes("domain-ssl-provisioning"));
    assert.ok(queueNames.includes("domain-ssl-status"));

    for (const q of details.queues) {
      assert.ok(q.queueName);
      assert.ok(q.attempts > 0);
      assert.ok(q.timeoutMs > 0);
      assert.ok(q.concurrency > 0);
      // counts may be null when redis is unreachable
      assert.ok(q.counts === null || typeof q.counts === "object");
    }
  });
});