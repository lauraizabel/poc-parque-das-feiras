import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import * as http from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { prisma } from "@acme/database";
import { AppModule } from "../../app.module";

type JsonResponse<T> = {
  statusCode: number;
  body: T;
  headers: Headers;
};

type RequestOptions = {
  method?: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
};

describe("api security", () => {
  const previousAuthRateLimitMax = process.env.AUTH_RATE_LIMIT_MAX;
  const previousAuthRateLimitWindowMs = process.env.AUTH_RATE_LIMIT_WINDOW_MS;
  const previousWebhookRateLimitMax = process.env.WEBHOOK_RATE_LIMIT_MAX;
  const previousWebhookRateLimitWindowMs = process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS;
  const previousWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const suffix = Date.now().toString(36);
  const email = `security-${suffix}@example.com`;
  const password = "StrongPass123";

  let app: INestApplication;
  let baseUrl = "";
  let userId = "";

  before(async () => {
    process.env.AUTH_RATE_LIMIT_MAX = "2";
    process.env.AUTH_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.WEBHOOK_RATE_LIMIT_MAX = "1";
    process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_security_test";

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
    process.env.AUTH_RATE_LIMIT_MAX = previousAuthRateLimitMax;
    process.env.AUTH_RATE_LIMIT_WINDOW_MS = previousAuthRateLimitWindowMs;
    process.env.WEBHOOK_RATE_LIMIT_MAX = previousWebhookRateLimitMax;
    process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS = previousWebhookRateLimitWindowMs;
    process.env.STRIPE_WEBHOOK_SECRET = previousWebhookSecret;

    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => null);
    }

    await app.close();
  });

  it("sets baseline security headers and no-store caching on auth responses", async () => {
    const response = await requestJson<{
      user: { id: string };
    }>({
      method: "POST",
      path: "/auth/register",
      body: {
        email,
        password,
        fullName: "Security User"
      }
    });

    assert.equal(response.statusCode, 201);
    userId = response.body.user.id;
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("x-dns-prefetch-control"), "off");
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
    assert.match(response.headers.get("permissions-policy") ?? "", /camera=\(\)/);
  });

  it("rejects cookie-based session flows to keep auth stateless and resistant to csrf", async () => {
    const response = await requestJson<{
      message: string;
      code: string;
    }>({
      method: "POST",
      path: "/auth/refresh",
      headers: {
        cookie: "refreshToken=session-cookie"
      },
      body: {
        refreshToken: "opaque-refresh-token"
      }
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, "AUTH_COOKIE_SESSION_NOT_SUPPORTED");
  });

  it("rate limits repeated authentication attempts", async () => {
    const attempts = [];

    attempts.push(
      await requestJson<{ message: string; code?: string }>({
        method: "POST",
        path: "/auth/login",
        headers: {
          "x-forwarded-for": "198.51.100.10"
        },
        body: {
          email,
          password: "WrongPass123"
        }
      })
    );
    attempts.push(
      await requestJson<{ message: string; code?: string }>({
        method: "POST",
        path: "/auth/login",
        headers: {
          "x-forwarded-for": "198.51.100.10"
        },
        body: {
          email,
          password: "WrongPass123"
        }
      })
    );
    attempts.push(
      await requestJson<{ message: string; code?: string; retryAfterSeconds?: number }>({
        method: "POST",
        path: "/auth/login",
        headers: {
          "x-forwarded-for": "198.51.100.10"
        },
        body: {
          email,
          password: "WrongPass123"
        }
      })
    );

    assert.equal(attempts[0].statusCode, 401);
    assert.equal(attempts[1].statusCode, 401);
    assert.equal(attempts[2].statusCode, 429);
    assert.equal(attempts[2].body.code, "AUTH_RATE_LIMIT_EXCEEDED");
    assert.ok(Number(attempts[2].headers.get("retry-after")) >= 1);
  });

  it("rate limits repeated webhook deliveries from the same source", async () => {
    const payload = JSON.stringify({
      id: `evt_security_${suffix}`,
      type: "unsupported.event",
      data: {
        object: {}
      }
    });
    const signature = createStripeSignature(payload, process.env.STRIPE_WEBHOOK_SECRET!);

    const first = await requestJson<{ code: string }>({
      method: "POST",
      path: "/payments/webhooks/stripe",
      headers: {
        "stripe-signature": signature,
        "x-forwarded-for": "203.0.113.44"
      },
      body: payload
    });

    const second = await requestJson<{ code: string }>({
      method: "POST",
      path: "/payments/webhooks/stripe",
      headers: {
        "stripe-signature": signature,
        "x-forwarded-for": "203.0.113.44"
      },
      body: payload
    });

    assert.equal(first.statusCode, 201);
    assert.equal(second.statusCode, 429);
    assert.equal(second.body.code, "WEBHOOK_RATE_LIMIT_EXCEEDED");
    assert.ok(Number(second.headers.get("retry-after")) >= 1);
  });

  async function requestJson<T>(options: RequestOptions): Promise<JsonResponse<T>> {
    const body =
      typeof options.body === "string" ? options.body : options.body === undefined ? undefined : JSON.stringify(options.body);

    const response = await fetch(`${baseUrl}${options.path}`, {
      method: options.method ?? "GET",
      headers: {
        "content-type": "application/json",
        ...(options.headers ?? {})
      },
      body
    });

    return {
      statusCode: response.status,
      headers: response.headers,
      body: (await response.json()) as T
    };
  }
});

function createStripeSignature(payload: string, secret: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const digest = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  return `t=${timestamp},v1=${digest}`;
}
