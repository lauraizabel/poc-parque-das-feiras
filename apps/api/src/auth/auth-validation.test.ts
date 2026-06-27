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
  body?: unknown;
};

describe("auth validation", () => {
  const suffix = Date.now().toString(36);
  const email = `sanitize-${suffix}@example.com`;
  const merchantEmail = `merchant-sanitize-${suffix}@example.com`;
  const password = "StrongPass123";

  let app: INestApplication;
  let baseUrl = "";
  let userIds: string[] = [];
  let storeIds: string[] = [];

  before(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = testingModule.createNestApplication();
    await app.listen(0);

    const server = app.getHttpServer() as http.Server;
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    for (const storeId of storeIds) {
      await prisma.store.delete({ where: { id: storeId } }).catch(() => null);
    }

    for (const userId of userIds) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => null);
    }

    await app.close();
  });

  it("sanitizes and normalizes auth payload fields", async () => {
    const response = await requestJson<{
      user: { id: string; email: string; fullName: string | null };
    }>({
      method: "POST",
      path: "/auth/register",
      body: {
        email: `  ${email.toUpperCase()}  `,
        password,
        fullName: "  Laura\t\nSilva  "
      }
    });

    assert.equal(response.statusCode, 201);
    userIds.push(response.body.user.id);
    assert.equal(response.body.user.email, email);
    assert.equal(response.body.user.fullName, "Laura Silva");
  });

  it("rejects unexpected fields in auth payloads", async () => {
    const response = await requestJson<{
      message: string;
    }>({
      method: "POST",
      path: "/auth/register",
      body: {
        email: `another-${suffix}@example.com`,
        password,
        unexpected: true
      }
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.message, "Invalid request body");
  });

  it("sanitizes merchant onboarding input before creating the store", async () => {
    const response = await requestJson<{
      user: { id: string };
      store: { id: string; supportEmail: string | null };
    }>({
      method: "POST",
      path: "/auth/register-merchant",
      body: {
        email: ` ${merchantEmail.toUpperCase()} `,
        password,
        fullName: "  Merchant \u0007 Name ",
        storeName: "  Minha\t Loja   ",
        storeSlug: " Minha Loja ",
        supportEmail: `  SUPPORT-${suffix}@EXAMPLE.COM `
      }
    });

    assert.equal(response.statusCode, 201);
    userIds.push(response.body.user.id);
    storeIds.push(response.body.store.id);
    assert.equal(response.body.store.supportEmail, `support-${suffix}@example.com`);
  });

  async function requestJson<T>(options: RequestOptions): Promise<JsonResponse<T>> {
    const response = await fetch(`${baseUrl}${options.path}`, {
      method: options.method ?? "GET",
      headers: {
        "content-type": "application/json"
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    return {
      statusCode: response.status,
      body: (await response.json()) as T
    };
  }
});
