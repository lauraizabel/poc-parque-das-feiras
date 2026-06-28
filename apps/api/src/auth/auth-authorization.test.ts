import assert from "node:assert/strict";
import * as http from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PlatformRole } from "@prisma/client";
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

describe("auth authorization", () => {
  const suffix = Date.now().toString(36);
  const password = "StrongPass123";
  const merchantEmail = `authz-merchant-${suffix}@example.com`;
  const platformAdminEmail = `authz-admin-${suffix}@example.com`;
  const outsiderEmail = `authz-outsider-${suffix}@example.com`;

  let app: INestApplication;
  let baseUrl = "";
  let merchantUserId = "";
  let platformAdminUserId = "";
  let outsiderUserId = "";
  let merchantToken = "";
  let platformAdminToken = "";
  let outsiderToken = "";
  let ownerStoreId = "";
  let supportStoreId = "";
  let managerStoreId = "";

  before(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = testingModule.createNestApplication();
    await app.listen(0);

    const server = app.getHttpServer() as http.Server;
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const merchantRegistration = await requestJson<{
      user: { id: string };
      store: { id: string };
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/register-merchant",
      body: {
        email: merchantEmail,
        password,
        fullName: "Authorization Merchant",
        storeName: "Authorization Owner Store",
        storeSlug: `authz-owner-${suffix}`
      }
    });

    merchantUserId = merchantRegistration.body.user.id;
    ownerStoreId = merchantRegistration.body.store.id;
    merchantToken = merchantRegistration.body.tokens.accessToken;

    const supportFixture = await requestJson<{
      store: { id: string };
    }>({
      method: "POST",
      path: "/stores/fixtures",
      headers: {
        authorization: `Bearer ${merchantToken}`
      },
      body: {
        role: "STORE_SUPPORT",
        name: "Authorization Support Store",
        slug: `authz-support-${suffix}`
      }
    });
    supportStoreId = supportFixture.body.store.id;

    const managerFixture = await requestJson<{
      store: { id: string };
    }>({
      method: "POST",
      path: "/stores/fixtures",
      headers: {
        authorization: `Bearer ${merchantToken}`
      },
      body: {
        role: "STORE_MANAGER",
        name: "Authorization Manager Store",
        slug: `authz-manager-${suffix}`
      }
    });
    managerStoreId = managerFixture.body.store.id;

    const platformAdminRegistration = await requestJson<{
      user: { id: string };
    }>({
      method: "POST",
      path: "/auth/register",
      body: {
        email: platformAdminEmail,
        password,
        fullName: "Authorization Admin"
      }
    });
    platformAdminUserId = platformAdminRegistration.body.user.id;

    await prisma.user.update({
      where: {
        id: platformAdminUserId
      },
      data: {
        platformRole: PlatformRole.PLATFORM_ADMIN
      }
    });

    const platformAdminLogin = await requestJson<{
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/login",
      body: {
        email: platformAdminEmail,
        password
      }
    });
    platformAdminToken = platformAdminLogin.body.tokens.accessToken;

    const outsiderRegistration = await requestJson<{
      user: { id: string };
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/register",
      body: {
        email: outsiderEmail,
        password,
        fullName: "Authorization Outsider"
      }
    });
    outsiderUserId = outsiderRegistration.body.user.id;
    outsiderToken = outsiderRegistration.body.tokens.accessToken;
  });

  after(async () => {
    for (const storeId of [managerStoreId, supportStoreId, ownerStoreId]) {
      if (storeId) {
        await prisma.store.delete({ where: { id: storeId } }).catch(() => null);
      }
    }

    for (const userId of [outsiderUserId, platformAdminUserId, merchantUserId]) {
      if (userId) {
        await prisma.user.delete({ where: { id: userId } }).catch(() => null);
      }
    }

    await app.close();
  });

  it("rejects missing bearer tokens on protected routes", async () => {
    const response = await requestJson<{
      message: string;
    }>({
      method: "GET",
      path: `/stores/${ownerStoreId}/support`
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.body.message, "Missing bearer token");
  });

  it("grants platform routes only to platform admins", async () => {
    const forbiddenResponse = await requestJson<{
      code: string;
    }>({
      method: "GET",
      path: "/stores/platform",
      headers: {
        authorization: `Bearer ${merchantToken}`
      }
    });

    assert.equal(forbiddenResponse.statusCode, 403);
    assert.equal(forbiddenResponse.body.code, "AUTH_PLATFORM_ROLE_FORBIDDEN");

    const successResponse = await requestJson<{
      scope: string;
      access: string;
    }>({
      method: "GET",
      path: "/stores/platform",
      headers: {
        authorization: `Bearer ${platformAdminToken}`
      }
    });

    assert.equal(successResponse.statusCode, 200);
    assert.equal(successResponse.body.scope, "platform");
    assert.equal(successResponse.body.access, "granted");
  });

  it("enforces store role checks while allowing broader store access routes", async () => {
    const managementResponse = await requestJson<{
      code: string;
    }>({
      method: "GET",
      path: `/stores/${supportStoreId}/management`,
      headers: {
        authorization: `Bearer ${merchantToken}`
      }
    });

    assert.equal(managementResponse.statusCode, 403);
    assert.equal(managementResponse.body.code, "AUTH_STORE_ROLE_FORBIDDEN");

    const supportResponse = await requestJson<{
      scope: string;
      access: string;
      storeContext: {
        storeId: string;
        membershipRole: string;
      };
    }>({
      method: "GET",
      path: `/stores/${supportStoreId}/support`,
      headers: {
        authorization: `Bearer ${merchantToken}`
      }
    });

    assert.equal(supportResponse.statusCode, 200);
    assert.equal(supportResponse.body.scope, "store");
    assert.equal(supportResponse.body.access, "granted");
    assert.equal(supportResponse.body.storeContext.storeId, supportStoreId);
    assert.equal(supportResponse.body.storeContext.membershipRole, "STORE_SUPPORT");
  });

  it("rejects users that do not belong to the target store", async () => {
    const response = await requestJson<{
      code: string;
    }>({
      method: "GET",
      path: `/stores/${ownerStoreId}/support`,
      headers: {
        authorization: `Bearer ${outsiderToken}`
      }
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.body.code, "AUTH_STORE_MEMBERSHIP_REQUIRED");
  });

  it("rejects conflicting store ids from body and headers", async () => {
    const response = await requestJson<{
      code: string;
      providedStoreIds: Array<{
        source: string;
        value: string;
      }>;
    }>({
      method: "POST",
      path: "/domains",
      headers: {
        authorization: `Bearer ${merchantToken}`,
        "x-store-id": ownerStoreId
      },
      body: {
        storeId: managerStoreId,
        host: `www.authz-${suffix}.example.com`
      }
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.body.code, "AUTH_STORE_CONTEXT_CONFLICT");
    assert.deepEqual(
      response.body.providedStoreIds.map((candidate) => candidate.source).sort(),
      ["body", "headers"]
    );
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
