import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { prisma } from "@acme/database";
import { AuditLogChannel } from "@prisma/client";
import { AuditService } from "./audit.service";
import { AuditRepository } from "./audit.repository";

describe("audit persistence", () => {
  const service = new AuditService(new AuditRepository());
  const cleanupStoreIds = new Set<string>();
  const cleanupUserIds = new Set<string>();

  after(async () => {
    for (const storeId of cleanupStoreIds) {
      await prisma.store.delete({ where: { id: storeId } }).catch(() => null);
    }

    for (const userId of cleanupUserIds) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => null);
    }
  });

  it("persists audit logs with redacted payload summaries", async () => {
    const suffix = Date.now().toString(36);
    const user = await prisma.user.create({
      data: {
        email: `audit-${suffix}@example.com`,
        passwordHash: "hash",
        fullName: "Audit User"
      }
    });
    cleanupUserIds.add(user.id);

    const store = await prisma.store.create({
      data: {
        ownerId: user.id,
        name: "Audit Store",
        slug: `audit-store-${suffix}`,
        defaultSubdomain: `audit-store-${suffix}`
      }
    });
    cleanupStoreIds.add(store.id);

    const audit = await service.recordEvent({
      action: "auth.login",
      channel: AuditLogChannel.HTTP_API,
      userId: user.id,
      storeId: store.id,
      entityType: "SESSION",
      entityId: "session_123",
      payloadSummary: {
        email: user.email,
        password: "StrongPass123",
        refreshToken: "refresh-secret",
        nested: {
          authorization: "Bearer secret-token",
          keep: "ok"
        }
      }
    });

    assert.equal(audit.action, "auth.login");
    assert.equal(audit.channel, AuditLogChannel.HTTP_API);
    assert.equal(audit.userId, user.id);
    assert.equal(audit.storeId, store.id);
    assert.match(audit.payloadSummary ?? "", /"email":"audit-/);
    assert.match(audit.payloadSummary ?? "", /\[REDACTED\]/);
    assert.doesNotMatch(audit.payloadSummary ?? "", /StrongPass123|refresh-secret|secret-token/);
  });
});
