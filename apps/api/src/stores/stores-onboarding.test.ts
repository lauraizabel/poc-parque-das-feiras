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

describe("stores onboarding", () => {
  const suffix = Date.now().toString(36);
  const email = `stores-onboarding-${suffix}@example.com`;
  const password = "StrongPass123";

  let app: INestApplication;
  let baseUrl = "";
  let userId = "";
  let token = "";
  let storeId = "";

  before(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = testingModule.createNestApplication();
    await app.listen(0);

    const server = app.getHttpServer() as http.Server;
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const registration = await requestJson<{
      user: { id: string };
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/register",
      body: {
        email,
        password,
        fullName: "Stores Onboarding User"
      }
    });

    userId = registration.body.user.id;
    token = registration.body.tokens.accessToken;
  });

  after(async () => {
    if (storeId) {
      await prisma.store.delete({ where: { id: storeId } }).catch(() => null);
    }

    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => null);
    }

    await app.close();
  });

  it("normalizes and reports slug availability before store creation", async () => {
    const response = await requestJson<{
      normalizedSlug: string;
      defaultSubdomain: string;
      available: boolean;
      reason: string;
    }>({
      method: "GET",
      path: "/stores/slug-availability?slug=Minha%20Loja%20Nova"
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.normalizedSlug, "minha-loja-nova");
    assert.equal(response.body.defaultSubdomain, "minha-loja-nova");
    assert.equal(response.body.available, true);
    assert.equal(response.body.reason, "available");
  });

  it("creates the first store for an authenticated user and then marks the slug as unavailable", async () => {
    const creation = await requestJson<{
      id: string;
      slug: string;
      defaultSubdomain: string;
    }>({
      method: "POST",
      path: "/stores",
      headers: {
        authorization: `Bearer ${token}`
      },
      body: {
        name: "Loja Onboarding",
        slug: `onboarding-${suffix}`,
        supportEmail: `support-${suffix}@example.com`,
        currencyCode: "BRL",
        locale: "pt-BR"
      }
    });

    assert.equal(creation.statusCode, 201);
    storeId = creation.body.id;
    assert.equal(creation.body.slug, `onboarding-${suffix}`);
    assert.equal(creation.body.defaultSubdomain, `onboarding-${suffix}`);

    const availability = await requestJson<{
      available: boolean;
      reason: string;
    }>({
      method: "GET",
      path: `/stores/slug-availability?slug=onboarding-${suffix}`
    });

    assert.equal(availability.statusCode, 200);
    assert.equal(availability.body.available, false);
    assert.equal(availability.body.reason, "in_use");
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
