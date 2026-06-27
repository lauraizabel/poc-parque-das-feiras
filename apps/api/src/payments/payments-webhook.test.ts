import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import * as http from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PaymentProvider } from "@prisma/client";
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
  body?: string;
};

describe("payments webhook api", () => {
  const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const webhookSecret = "whsec_test_secret";
  const suffix = Date.now().toString(36);
  const merchantEmail = `payments-webhook-${suffix}@example.com`;
  const password = "StrongPass123";
  const storeSlug = `payments-webhook-${suffix}`;
  const sessionId = `payments-webhook-session-${suffix}`;
  const customerEmail = `buyer-webhook-${suffix}@example.com`;

  let app: INestApplication;
  let baseUrl = "";
  let userId = "";
  let storeId = "";
  let token = "";
  let productId = "";
  let orderId = "";
  let paymentId = "";
  let shippingMethodId = "";

  before(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;

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
      body: JSON.stringify({
        email: merchantEmail,
        password,
        fullName: "Payments Webhook Merchant",
        storeName: "Payments Webhook Store",
        storeSlug
      })
    });

    userId = registration.body.user.id;
    storeId = registration.body.store.id;
    token = registration.body.tokens.accessToken;

    const productResponse = await requestJson<{
      product: { id: string };
    }>({
      method: "POST",
      path: "/catalog/products",
      headers: {
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        storeId,
        name: "Moedor Precision",
        slug: "moedor-precision",
        priceCents: 18990,
        stockQuantity: 3,
        status: "ACTIVE"
      })
    });
    productId = productResponse.body.product.id;

    const shippingMethodResponse = await requestJson<{
      shippingMethod: { id: string };
    }>({
      method: "POST",
      path: "/shipping/methods",
      headers: {
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        storeId,
        name: "Entrega padrão",
        type: "FIXED_PRICE",
        priceCents: 1200,
        estimatedDaysMin: 2,
        estimatedDaysMax: 5,
        minimumOrderCents: 0,
        maximumOrderCents: 50000,
        sortOrder: 1,
        isDefault: true
      })
    });
    shippingMethodId = shippingMethodResponse.body.shippingMethod.id;

    await requestJson({
      method: "POST",
      path: "/cart/public/current/items",
      headers: {
        host: `${storeSlug}.lvh.me`
      },
      body: JSON.stringify({
        sessionId,
        customerEmail,
        productId,
        quantity: 1
      })
    });

    const orderResponse = await requestJson<{
      order: { id: string };
    }>({
      method: "POST",
      path: "/checkout/public/current/order",
      headers: {
        host: `${storeSlug}.lvh.me`
      },
      body: JSON.stringify({
        sessionId,
        customerEmail,
        customerFullName: "Buyer Webhook",
        shippingRecipientName: "Buyer Webhook",
        shippingPostalCode: "50000-000",
        shippingState: "PE",
        shippingCity: "Recife",
        shippingDistrict: "Boa Viagem",
        shippingStreet: "Rua do Farol",
        shippingNumber: "99",
        shippingMethodId
      })
    });

    orderId = orderResponse.body.order.id;

    const paymentIntentResponse = await requestJson<{
      payment: { id: string };
      intent: { providerPaymentId: string };
    }>({
      method: "POST",
      path: `/payments/public/orders/${orderId}/intent`,
      headers: {
        host: `${storeSlug}.lvh.me`
      },
      body: JSON.stringify({
        sessionId,
        customerEmail
      })
    });

    paymentId = paymentIntentResponse.body.payment.id;
  });

  after(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = previousSecret;

    if (storeId) {
      await prisma.store.delete({ where: { id: storeId } });
    }

    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }

    await app.close();
  });

  it("accepts a signed Stripe webhook and persists the raw event", async () => {
    const payload = JSON.stringify({
      id: `evt_${suffix}`,
      type: "payment_intent.succeeded",
      livemode: false,
      request: {
        idempotency_key: `idem_${suffix}`
      },
      data: {
        object: {
          id: `pi_${suffix}`,
          object: "payment_intent",
          metadata: {
            paymentId,
            orderId,
            storeId
          }
        }
      }
    });

    const response = await requestJson<{
      received: boolean;
      duplicate: boolean;
      event: { externalEventId: string; storeId: string | null; paymentId: string | null };
    }>({
      method: "POST",
      path: "/payments/webhooks/stripe",
      headers: {
        "stripe-signature": createStripeSignature(payload, webhookSecret),
        "user-agent": "Stripe/1.0 (+https://stripe.com/docs/webhooks)"
      },
      body: payload
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.received, true);
    assert.equal(response.body.duplicate, false);
    assert.equal(response.body.event.externalEventId, `evt_${suffix}`);
    assert.equal(response.body.event.paymentId, paymentId);
    assert.equal(response.body.event.storeId, storeId);

    const storedEvent = await prisma.paymentWebhookEvent.findUnique({
      where: {
        provider_externalEventId: {
          provider: PaymentProvider.STRIPE_CONNECT,
          externalEventId: `evt_${suffix}`
        }
      }
    });

    assert.ok(storedEvent);
    assert.equal(storedEvent.status, "RECEIVED");
    assert.equal(storedEvent.orderId, orderId);
    assert.equal(storedEvent.paymentId, paymentId);
    assert.equal(storedEvent.storeId, storeId);
    assert.equal(storedEvent.payload, payload);
  });

  it("treats repeated webhook deliveries as idempotent duplicates", async () => {
    const payload = JSON.stringify({
      id: `evt_${suffix}`,
      type: "payment_intent.succeeded",
      livemode: false,
      request: {
        idempotency_key: `idem_${suffix}`
      },
      data: {
        object: {
          id: `pi_${suffix}`,
          object: "payment_intent",
          metadata: {
            paymentId,
            orderId,
            storeId
          }
        }
      }
    });

    const response = await requestJson<{
      received: boolean;
      duplicate: boolean;
      event: { externalEventId: string };
    }>({
      method: "POST",
      path: "/payments/webhooks/stripe",
      headers: {
        "stripe-signature": createStripeSignature(payload, webhookSecret)
      },
      body: payload
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.received, true);
    assert.equal(response.body.duplicate, true);

    const eventCount = await prisma.paymentWebhookEvent.count({
      where: {
        provider: PaymentProvider.STRIPE_CONNECT,
        externalEventId: `evt_${suffix}`
      }
    });

    assert.equal(eventCount, 1);
  });

  it("rejects invalid Stripe signatures", async () => {
    const payload = JSON.stringify({
      id: `evt_invalid_${suffix}`,
      type: "payment_intent.payment_failed",
      data: {
        object: {
          metadata: {
            paymentId,
            orderId,
            storeId
          }
        }
      }
    });

    const response = await requestJson<{
      message: string;
      code: string;
    }>({
      method: "POST",
      path: "/payments/webhooks/stripe",
      headers: {
        "stripe-signature": createStripeSignature(payload, "whsec_wrong_secret")
      },
      body: payload
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.body.code, "STRIPE_SIGNATURE_INVALID");
  });

  it("rejects webhook bodies with blank event identifiers after sanitization", async () => {
    const payload = JSON.stringify({
      id: " \n\t ",
      type: "payment_intent.succeeded",
      data: {
        object: {
          metadata: {
            paymentId,
            orderId,
            storeId
          }
        }
      }
    });

    const response = await requestJson<{
      message: string;
      code: string;
    }>({
      method: "POST",
      path: "/payments/webhooks/stripe",
      headers: {
        "stripe-signature": createStripeSignature(payload, webhookSecret)
      },
      body: payload
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, "STRIPE_WEBHOOK_EVENT_ID_REQUIRED");
  });

  async function requestJson<T>(options: RequestOptions): Promise<JsonResponse<T>> {
    const payload = options.body;

    return new Promise((resolve, reject) => {
      const request = http.request(
        `${baseUrl}${options.path}`,
        {
          method: options.method ?? "GET",
          headers: {
            "content-type": "application/json",
            ...(payload ? { "content-length": Buffer.byteLength(payload).toString() } : {}),
            ...(options.headers ?? {})
          }
        },
        (response) => {
          const chunks: Buffer[] = [];

          response.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
          });

          response.on("end", () => {
            const rawBody = Buffer.concat(chunks).toString("utf8");
            const body = rawBody.length > 0 ? (JSON.parse(rawBody) as T) : ({} as T);

            resolve({
              statusCode: response.statusCode ?? 0,
              body
            });
          });
        }
      );

      request.on("error", reject);

      if (payload) {
        request.write(payload);
      }

      request.end();
    });
  }
});

function createStripeSignature(payload: string, secret: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const digest = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  return `t=${timestamp},v1=${digest}`;
}
