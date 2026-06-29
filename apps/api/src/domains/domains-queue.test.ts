import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getDomainQueuePolicySnapshots,
  getDomainQueueMonitoring,
  DOMAIN_DNS_VERIFICATION_QUEUE,
  DOMAIN_SSL_PROVISIONING_QUEUE,
  DOMAIN_SSL_STATUS_QUEUE
} from "./domains.queue";

describe("domains queue", () => {
  it("exposes policy snapshots for all domain queues", () => {
    const snapshots = getDomainQueuePolicySnapshots();

    assert.equal(snapshots.length, 3);

    const dns = snapshots[0];
    assert.equal(dns.queueName, DOMAIN_DNS_VERIFICATION_QUEUE);
    assert.equal(dns.profile, "domain-dns-verification");
    assert.equal(dns.attempts, 5);
    assert.equal(dns.backoffDelayMs, 10_000);
    assert.equal(dns.timeoutMs, 60_000);
    assert.equal(dns.concurrency, 2);

    const sslProvisioning = snapshots[1];
    assert.equal(sslProvisioning.queueName, DOMAIN_SSL_PROVISIONING_QUEUE);
    assert.equal(sslProvisioning.profile, "domain-ssl-provisioning");
    assert.equal(sslProvisioning.attempts, 8);
    assert.equal(sslProvisioning.backoffDelayMs, 15_000);
    assert.equal(sslProvisioning.timeoutMs, 120_000);
    assert.equal(sslProvisioning.concurrency, 1);

    const sslStatus = snapshots[2];
    assert.equal(sslStatus.queueName, DOMAIN_SSL_STATUS_QUEUE);
    assert.equal(sslStatus.profile, "domain-ssl-status");
    assert.equal(sslStatus.attempts, 10);
    assert.equal(sslStatus.backoffDelayMs, 30_000);
    assert.equal(sslStatus.timeoutMs, 60_000);
    assert.equal(sslStatus.concurrency, 1);
  });

  it("includes queue counts from live monitoring (null when redis is unreachable)", async () => {
    const monitoring = await getDomainQueueMonitoring();

    assert.equal(monitoring.length, 3);

    for (const snapshot of monitoring) {
      // The policy fields are always present
      assert.ok(snapshot.queueName);
      assert.ok(snapshot.profile);
      assert.equal(typeof snapshot.attempts, "number");
      assert.equal(typeof snapshot.timeoutMs, "number");
      assert.equal(typeof snapshot.concurrency, "number");
      // counts may be null if redis is unreachable, but the field exists
      assert.ok(snapshot.counts === null || typeof snapshot.counts === "object");
    }
  });

  it("has distinct queue names for each domain job type", () => {
    const snapshots = getDomainQueuePolicySnapshots();
    const names = snapshots.map((s) => s.queueName);
    const uniqueNames = [...new Set(names)];

    assert.equal(uniqueNames.length, 3);
    assert.ok(names.includes("domain-dns-verification"));
    assert.ok(names.includes("domain-ssl-provisioning"));
    assert.ok(names.includes("domain-ssl-status"));
  });
});