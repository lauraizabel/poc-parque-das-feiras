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

describe("stores theme", () => {
  const suffix = Date.now().toString(36);
  const email = `store-theme-${suffix}@example.com`;
  const password = "StrongPass123";
  const storeSlug = `theme-shop-${suffix}`;
  const storefrontHost = `${storeSlug}.lvh.me`;

  let app: INestApplication;
  let baseUrl = "";
  let userId = "";
  let storeId = "";
  let token = "";

  before(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = testingModule.createNestApplication();
    app.enableCors({
      origin: true,
      credentials: true
    });

    await app.listen(0);

    const server = app.getHttpServer() as http.Server;
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const registration = await requestJson<{
      user: { id: string };
      store: { id: string };
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/register-merchant",
      body: {
        email,
        password,
        fullName: "Theme Merchant",
        storeName: "Theme Shop",
        storeSlug
      }
    });

    userId = registration.body.user.id;
    storeId = registration.body.store.id;
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

  it("returns the default storefront theme for the store", async () => {
    const response = await requestJson<{
      theme: {
        storeId: string;
        primaryColor: string;
        accentColor: string;
        surfaceColor: string;
        logoUrl: string | null;
      };
    }>({
      path: `/stores/${storeId}/theme`,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.theme.storeId, storeId);
    assert.equal(response.body.theme.primaryColor, "#c45c2c");
    assert.equal(response.body.theme.accentColor, "#8f3610");
    assert.equal(response.body.theme.surfaceColor, "#f5f1e8");
    assert.equal(response.body.theme.logoUrl, null);
  });

  it("updates the storefront theme and exposes it on the public storefront payload", async () => {
    const updateResponse = await requestJson<{
      theme: {
        primaryColor: string;
        accentColor: string;
        surfaceColor: string;
        logoUrl: string | null;
        bannerUrl: string | null;
        heroTitle: string | null;
        heroSubtitle: string | null;
        announcementText: string | null;
      };
    }>({
      method: "PATCH",
      path: `/stores/${storeId}/theme`,
      headers: {
        authorization: `Bearer ${token}`
      },
      body: {
        primaryColor: "#0d7a64",
        accentColor: "#084c40",
        surfaceColor: "#f2f8f6",
        logoUrl: "https://cdn.example.com/theme-logo.png",
        bannerUrl: "https://cdn.example.com/theme-banner.jpg",
        heroTitle: "Colecao de inverno pronta para envio",
        heroSubtitle: "Personalizacao minima da vitrine com cores, logo e banner por tenant.",
        announcementText: "Frete gratis acima de R$ 199"
      }
    });

    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.body.theme.primaryColor, "#0d7a64");
    assert.equal(updateResponse.body.theme.heroTitle, "Colecao de inverno pronta para envio");

    const publicHomeResponse = await requestJson<{
      store: {
        id: string;
        slug: string;
        theme: {
          primaryColor: string;
          accentColor: string;
          surfaceColor: string;
          logoUrl: string | null;
          bannerUrl: string | null;
          heroTitle: string | null;
          heroSubtitle: string | null;
          announcementText: string | null;
        } | null;
      };
      categories: unknown[];
      products: unknown[];
    }>({
      path: "/catalog/public/home",
      headers: {
        host: storefrontHost,
        "x-forwarded-host": storefrontHost
      }
    });

    assert.equal(publicHomeResponse.statusCode, 200);
    assert.equal(publicHomeResponse.body.store.id, storeId);
    assert.equal(publicHomeResponse.body.store.slug, storeSlug);
    assert.equal(publicHomeResponse.body.store.theme?.primaryColor, "#0d7a64");
    assert.equal(publicHomeResponse.body.store.theme?.accentColor, "#084c40");
    assert.equal(publicHomeResponse.body.store.theme?.surfaceColor, "#f2f8f6");
    assert.equal(
      publicHomeResponse.body.store.theme?.logoUrl,
      "https://cdn.example.com/theme-logo.png"
    );
    assert.equal(
      publicHomeResponse.body.store.theme?.bannerUrl,
      "https://cdn.example.com/theme-banner.jpg"
    );
    assert.equal(
      publicHomeResponse.body.store.theme?.announcementText,
      "Frete gratis acima de R$ 199"
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
