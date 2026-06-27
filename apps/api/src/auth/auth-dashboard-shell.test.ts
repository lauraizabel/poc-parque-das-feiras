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

describe("auth dashboard shell", () => {
  const suffix = Date.now().toString(36);
  const merchantEmail = `dashboard-shell-${suffix}@example.com`;
  const outsiderEmail = `dashboard-shell-outsider-${suffix}@example.com`;
  const password = "StrongPass123";
  const firstSlug = `dashboard-shell-a-${suffix}`;
  const secondSlug = `dashboard-shell-b-${suffix}`;

  let app: INestApplication;
  let baseUrl = "";
  let merchantUserId = "";
  let outsiderUserId = "";
  let token = "";
  let outsiderToken = "";
  let firstStoreId = "";
  let secondStoreId = "";

  before(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = testingModule.createNestApplication();
    await app.listen(0);

    const server = app.getHttpServer() as http.Server;
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const merchant = await requestJson<{
      user: { id: string };
      store: { id: string };
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/register-merchant",
      body: {
        email: merchantEmail,
        password,
        fullName: "Dashboard Shell Merchant",
        storeName: "Dashboard Shell Store A",
        storeSlug: firstSlug
      }
    });

    merchantUserId = merchant.body.user.id;
    firstStoreId = merchant.body.store.id;
    token = merchant.body.tokens.accessToken;

    const secondStore = await requestJson<{
      store: { id: string };
    }>({
      method: "POST",
      path: "/stores/fixtures",
      headers: {
        authorization: `Bearer ${token}`
      },
      body: {
        name: "Dashboard Shell Store B",
        slug: secondSlug,
        role: "STORE_MANAGER"
      }
    });
    secondStoreId = secondStore.body.store.id;

    const outsider = await requestJson<{
      user: { id: string };
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/register",
      body: {
        email: outsiderEmail,
        password,
        fullName: "Dashboard Shell Outsider"
      }
    });
    outsiderUserId = outsider.body.user.id;
    outsiderToken = outsider.body.tokens.accessToken;
  });

  after(async () => {
    if (secondStoreId) {
      await prisma.store.delete({ where: { id: secondStoreId } }).catch(() => null);
    }

    if (firstStoreId) {
      await prisma.store.delete({ where: { id: firstStoreId } }).catch(() => null);
    }

    if (outsiderUserId) {
      await prisma.user.delete({ where: { id: outsiderUserId } });
    }

    if (merchantUserId) {
      await prisma.user.delete({ where: { id: merchantUserId } });
    }

    await app.close();
  });

  it("returns only the memberships of the authenticated user for dashboard bootstrap", async () => {
    const response = await requestJson<{
      id: string;
      email: string;
      memberships: Array<{
        storeId: string;
        role: string;
        store: { name: string; slug: string };
      }>;
    }>({
      method: "GET",
      path: "/auth/me",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.id, merchantUserId);
    assert.equal(response.body.memberships.length, 2);
    assert.deepEqual(
      response.body.memberships.map((membership) => ({
        storeId: membership.storeId,
        role: membership.role,
        slug: membership.store.slug
      })),
      [
        {
          storeId: firstStoreId,
          role: "STORE_OWNER",
          slug: firstSlug
        },
        {
          storeId: secondStoreId,
          role: "STORE_MANAGER",
          slug: secondSlug
        }
      ]
    );
  });

  it("does not leak stores to users without memberships", async () => {
    const response = await requestJson<{
      memberships: Array<unknown>;
    }>({
      method: "GET",
      path: "/auth/me",
      headers: {
        authorization: `Bearer ${outsiderToken}`
      }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.memberships, []);
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
