import assert from "node:assert/strict";
import * as http from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { prisma } from "@acme/database";
import { AppModule } from "../app.module";

type JsonResponse<T> = {
  statusCode: number;
  body: T;
};

type RequestOptions = {
  method?: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
};

describe("store members api", () => {
  const suffix = Date.now().toString(36);
  const ownerEmail = `store-owner-${suffix}@example.com`;
  const existingEmail = `store-existing-${suffix}@example.com`;
  const outsiderEmail = `store-outsider-${suffix}@example.com`;
  const password = "StrongPass123";

  let app: INestApplication;
  let baseUrl = "";
  let ownerUserId = "";
  let existingUserId = "";
  let outsiderUserId = "";
  let storeId = "";
  let ownerToken = "";
  let outsiderToken = "";
  let existingMemberId = "";
  let pendingInviteId = "";

  before(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = testingModule.createNestApplication();
    await app.listen(0);

    const server = app.getHttpServer() as http.Server;
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const ownerRegistration = await requestJson<{
      user: { id: string };
      store: { id: string };
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/register-merchant",
      body: {
        email: ownerEmail,
        password,
        fullName: "Store Owner",
        storeName: "Equipe Central",
        storeSlug: `equipe-central-${suffix}`
      }
    });

    ownerUserId = ownerRegistration.body.user.id;
    storeId = ownerRegistration.body.store.id;
    ownerToken = ownerRegistration.body.tokens.accessToken;

    const existingRegistration = await requestJson<{
      user: { id: string };
    }>({
      method: "POST",
      path: "/auth/register",
      body: {
        email: existingEmail,
        password,
        fullName: "Existing Member"
      }
    });
    existingUserId = existingRegistration.body.user.id;

    const outsiderRegistration = await requestJson<{
      user: { id: string };
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/register",
      body: {
        email: outsiderEmail,
        password,
        fullName: "Outsider User"
      }
    });
    outsiderUserId = outsiderRegistration.body.user.id;
    outsiderToken = outsiderRegistration.body.tokens.accessToken;
  });

  after(async () => {
    if (storeId) {
      await prisma.store.delete({ where: { id: storeId } }).catch(() => null);
    }

    for (const userId of [outsiderUserId, existingUserId, ownerUserId]) {
      if (userId) {
        await prisma.user.delete({ where: { id: userId } }).catch(() => null);
      }
    }

    await app.close();
  });

  it("lets the owner invite existing users and pending emails, then manage roles and removals", async () => {
    const activeInvite = await requestJson<{
      status: string;
      member: { id: string; email: string; role: string };
    }>({
      method: "POST",
      path: `/stores/${storeId}/members/invite`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      body: {
        email: existingEmail,
        role: "STORE_SUPPORT"
      }
    });

    assert.equal(activeInvite.statusCode, 201);
    assert.equal(activeInvite.body.status, "ACTIVE");
    existingMemberId = activeInvite.body.member.id;
    assert.equal(activeInvite.body.member.email, existingEmail);
    assert.equal(activeInvite.body.member.role, "STORE_SUPPORT");

    const pendingInvite = await requestJson<{
      status: string;
      invite: { id: string; email: string; role: string };
    }>({
      method: "POST",
      path: `/stores/${storeId}/members/invite`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      body: {
        email: `pending-${suffix}@example.com`,
        role: "STORE_MANAGER"
      }
    });

    assert.equal(pendingInvite.statusCode, 201);
    assert.equal(pendingInvite.body.status, "PENDING");
    pendingInviteId = pendingInvite.body.invite.id;

    const listing = await requestJson<{
      members: Array<{ email: string; role: string }>;
      invites: Array<{ id: string; email: string; role: string }>;
    }>({
      method: "GET",
      path: `/stores/${storeId}/members`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });

    assert.equal(listing.statusCode, 200);
    assert.ok(listing.body.members.some((member) => member.email === ownerEmail && member.role === "STORE_OWNER"));
    assert.ok(listing.body.members.some((member) => member.email === existingEmail && member.role === "STORE_SUPPORT"));
    assert.ok(listing.body.invites.some((invite) => invite.id === pendingInviteId && invite.role === "STORE_MANAGER"));

    const updated = await requestJson<{
      member: { id: string; role: string };
    }>({
      method: "PATCH",
      path: `/stores/${storeId}/members/${existingMemberId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      body: {
        role: "STORE_MANAGER"
      }
    });

    assert.equal(updated.statusCode, 200);
    assert.equal(updated.body.member.role, "STORE_MANAGER");

    const removedInvite = await requestJson<{
      removed: boolean;
    }>({
      method: "DELETE",
      path: `/stores/${storeId}/member-invites/${pendingInviteId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });

    assert.equal(removedInvite.statusCode, 200);
    assert.equal(removedInvite.body.removed, true);

    const removedMember = await requestJson<{
      removed: boolean;
    }>({
      method: "DELETE",
      path: `/stores/${storeId}/members/${existingMemberId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });

    assert.equal(removedMember.statusCode, 200);
    assert.equal(removedMember.body.removed, true);
  });

  it("blocks non-owners from administering store members", async () => {
    const response = await requestJson<{
      code: string;
    }>({
      method: "GET",
      path: `/stores/${storeId}/members`,
      headers: {
        authorization: `Bearer ${outsiderToken}`
      }
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.body.code, "AUTH_STORE_MEMBERSHIP_REQUIRED");
  });

  async function requestJson<T>(options: RequestOptions): Promise<JsonResponse<T>> {
    const response = await fetch(`${baseUrl}${options.path}`, {
      method: options.method ?? "GET",
      headers: {
        "content-type": "application/json",
        ...(options.headers ?? {})
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    return {
      statusCode: response.status,
      body: (await response.json()) as T
    };
  }
});
