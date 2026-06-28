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

describe("stores settings", () => {
  const suffix = Date.now().toString(36);
  const ownerEmail = `store-settings-owner-${suffix}@example.com`;
  const managerEmail = `store-settings-manager-${suffix}@example.com`;
  const supportEmail = `store-settings-support-${suffix}@example.com`;
  const password = "StrongPass123";
  const storeSlug = `store-settings-${suffix}`;

  let app: INestApplication;
  let baseUrl = "";
  let ownerUserId = "";
  let managerUserId = "";
  let supportUserId = "";
  let storeId = "";
  let ownerToken = "";
  let managerToken = "";
  let supportToken = "";

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
        fullName: "Store Settings Owner",
        storeName: "Store Settings Shop",
        storeSlug
      }
    });

    ownerUserId = ownerRegistration.body.user.id;
    storeId = ownerRegistration.body.store.id;
    ownerToken = ownerRegistration.body.tokens.accessToken;

    const managerRegistration = await requestJson<{
      user: { id: string };
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/register",
      body: {
        email: managerEmail,
        password,
        fullName: "Store Settings Manager"
      }
    });
    managerUserId = managerRegistration.body.user.id;
    managerToken = managerRegistration.body.tokens.accessToken;

    const supportRegistration = await requestJson<{
      user: { id: string };
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/register",
      body: {
        email: supportEmail,
        password,
        fullName: "Store Settings Support"
      }
    });
    supportUserId = supportRegistration.body.user.id;
    supportToken = supportRegistration.body.tokens.accessToken;

    const managerInvite = await requestJson<{
      status: string;
      member: { userId: string; role: string };
    }>({
      method: "POST",
      path: `/stores/${storeId}/members/invite`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      body: {
        email: managerEmail,
        role: "STORE_MANAGER"
      }
    });
    assert.equal(managerInvite.statusCode, 201);
    assert.equal(managerInvite.body.status, "ACTIVE");
    assert.equal(managerInvite.body.member.userId, managerUserId);

    const supportInvite = await requestJson<{
      status: string;
      member: { userId: string; role: string };
    }>({
      method: "POST",
      path: `/stores/${storeId}/members/invite`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      body: {
        email: supportEmail,
        role: "STORE_SUPPORT"
      }
    });
    assert.equal(supportInvite.statusCode, 201);
    assert.equal(supportInvite.body.status, "ACTIVE");
    assert.equal(supportInvite.body.member.userId, supportUserId);
  });

  after(async () => {
    if (storeId) {
      await prisma.store.delete({ where: { id: storeId } }).catch(() => null);
    }

    for (const userId of [supportUserId, managerUserId, ownerUserId]) {
      if (userId) {
        await prisma.user.delete({ where: { id: userId } }).catch(() => null);
      }
    }

    await app.close();
  });

  it("lets owner and manager read and update core store settings", async () => {
    const initialResponse = await requestJson<{
      store: {
        id: string;
        name: string;
        slug: string;
        defaultSubdomain: string;
        supportEmail: string | null;
        currencyCode: string;
        locale: string;
        owner: { email: string };
      };
    }>({
      path: `/stores/${storeId}/settings`,
      headers: {
        authorization: `Bearer ${managerToken}`
      }
    });

    assert.equal(initialResponse.statusCode, 200);
    assert.equal(initialResponse.body.store.id, storeId);
    assert.equal(initialResponse.body.store.slug, storeSlug);
    assert.equal(initialResponse.body.store.defaultSubdomain, storeSlug);
    assert.equal(initialResponse.body.store.owner.email, ownerEmail);
    assert.equal(initialResponse.body.store.supportEmail, null);

    const updateResponse = await requestJson<{
      store: {
        name: string;
        supportEmail: string | null;
        currencyCode: string;
        locale: string;
      };
    }>({
      method: "PATCH",
      path: `/stores/${storeId}/settings`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      body: {
        name: "Loja Configurada",
        supportEmail: "SUPPORT+SETTINGS@example.com",
        currencyCode: "usd",
        locale: "en-US"
      }
    });

    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.body.store.name, "Loja Configurada");
    assert.equal(updateResponse.body.store.supportEmail, "support+settings@example.com");
    assert.equal(updateResponse.body.store.currencyCode, "USD");
    assert.equal(updateResponse.body.store.locale, "en-US");
  });

  it("exposes notification recipients and queue monitoring for owner and manager", async () => {
    const response = await requestJson<{
      notifications: {
        ownerEmail: string | null;
        supportEmail: string | null;
        recipientEmails: string[];
        queue: {
          queueName: string;
        };
        paymentTemplates: string[];
      };
    }>({
      path: `/notifications/${storeId}/settings`,
      headers: {
        authorization: `Bearer ${managerToken}`
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.notifications.ownerEmail, ownerEmail);
    assert.equal(response.body.notifications.supportEmail, "support+settings@example.com");
    assert.deepEqual(response.body.notifications.recipientEmails.sort(), [
      ownerEmail,
      "support+settings@example.com"
    ]);
    assert.equal(response.body.notifications.queue.queueName, "notifications-email");
    assert.ok(response.body.notifications.paymentTemplates.includes("payment-approved-store"));
  });

  it("blocks support members from editing store settings and notifications", async () => {
    const storeResponse = await requestJson<{
      code: string;
    }>({
      method: "PATCH",
      path: `/stores/${storeId}/settings`,
      headers: {
        authorization: `Bearer ${supportToken}`
      },
      body: {
        name: "Nao Pode",
        supportEmail: "",
        currencyCode: "BRL",
        locale: "pt-BR"
      }
    });

    assert.equal(storeResponse.statusCode, 403);
    assert.equal(storeResponse.body.code, "AUTH_STORE_ROLE_FORBIDDEN");

    const notificationsResponse = await requestJson<{
      code: string;
    }>({
      path: `/notifications/${storeId}/settings`,
      headers: {
        authorization: `Bearer ${supportToken}`
      }
    });

    assert.equal(notificationsResponse.statusCode, 403);
    assert.equal(notificationsResponse.body.code, "AUTH_STORE_ROLE_FORBIDDEN");
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
