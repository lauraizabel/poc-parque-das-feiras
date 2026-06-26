import assert from "node:assert/strict";
import * as http from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PaymentStatus } from "@prisma/client";
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

describe("payments api", () => {
  const suffix = Date.now().toString(36);
  const merchantEmail = `payments-merchant-${suffix}@example.com`;
  const password = "StrongPass123";
  const storeSlug = `payments-store-${suffix}`;
  const sessionId = `payments-session-${suffix}`;

  let app: INestApplication;
  let baseUrl = "";
  let userId = "";
  let storeId = "";
  let token = "";
  let productId = "";
  let orderId = "";

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
        email: merchantEmail,
        password,
        fullName: "Payments Merchant",
        storeName: "Payments Store",
        storeSlug
      }
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
      body: {
        storeId,
        name: "Chaleira Matte",
        slug: "chaleira-matte",
        priceCents: 15990,
        stockQuantity: 2,
        status: "ACTIVE"
      }
    });
    productId = productResponse.body.product.id;

    await requestJson({
      method: "POST",
      path: "/cart/public/current/items",
      headers: {
        host: `${storeSlug}.lvh.me`
      },
      body: {
        sessionId,
        customerEmail: `buyer-${suffix}@example.com`,
        productId,
        quantity: 1
      }
    });

    const orderResponse = await requestJson<{
      order: { id: string };
    }>({
      method: "POST",
      path: "/checkout/public/current/order",
      headers: {
        host: `${storeSlug}.lvh.me`
      },
      body: {
        sessionId,
        customerEmail: `buyer-${suffix}@example.com`,
        customerFullName: "Buyer Example",
        shippingRecipientName: "Buyer Example",
        shippingPostalCode: "50000-000",
        shippingState: "PE",
        shippingCity: "Recife",
        shippingDistrict: "Boa Viagem",
        shippingStreet: "Rua do Mar",
        shippingNumber: "42"
      }
    });

    orderId = orderResponse.body.order.id;
  });

  after(async () => {
    if (storeId) {
      await prisma.store.delete({ where: { id: storeId } });
    }

    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }

    await app.close();
  });

  it("creates a payment intent through the adapter and returns frontend payment data", async () => {
    const response = await requestJson<{
      order: { status: string; paymentId: string | null };
      payment: { id: string; status: string; attemptCount: number; externalPaymentId: string | null };
      intent: { provider: string; clientSecret: string; providerPaymentId: string; status: string };
    }>({
      method: "POST",
      path: `/payments/public/orders/${orderId}/intent`,
      headers: {
        host: `${storeSlug}.lvh.me`
      },
      body: {
        sessionId,
        customerEmail: `buyer-${suffix}@example.com`
      }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.order.status, "WAITING_PAYMENT");
    assert.equal(response.body.payment.status, "PENDING");
    assert.equal(response.body.payment.attemptCount, 1);
    assert.equal(response.body.intent.provider, "STRIPE_CONNECT");
    assert.match(response.body.intent.clientSecret, /^pi_/);
    assert.equal(response.body.payment.externalPaymentId, response.body.intent.providerPaymentId);

    const storedPayment = await prisma.payment.findUnique({
      where: {
        id: response.body.payment.id
      },
      include: {
        transactions: true
      }
    });

    assert.equal(storedPayment?.status, PaymentStatus.PENDING);
    assert.equal(storedPayment?.transactions.length, 1);
    assert.equal(storedPayment?.transactions[0]?.kind, "INTENT");
  });

  it("retries the payment intent and increments attempts after a failed payment", async () => {
    const currentOrder = await prisma.order.findUnique({
      where: { id: orderId }
    });
    assert.ok(currentOrder?.paymentId);

    await prisma.payment.update({
      where: {
        id: currentOrder.paymentId!
      },
      data: {
        status: "FAILED",
        attemptCount: 1
      }
    });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "PAYMENT_FAILED"
      }
    });

    const retryResponse = await requestJson<{
      order: { status: string; paymentId: string | null };
      payment: { id: string; status: string; attemptCount: number };
      intent: { providerPaymentId: string };
    }>({
      method: "POST",
      path: `/payments/public/orders/${orderId}/intent`,
      headers: {
        host: `${storeSlug}.lvh.me`
      },
      body: {
        sessionId,
        customerEmail: `buyer-${suffix}@example.com`
      }
    });

    assert.equal(retryResponse.statusCode, 201);
    assert.equal(retryResponse.body.order.status, "WAITING_PAYMENT");
    assert.equal(retryResponse.body.payment.status, "PENDING");
    assert.equal(retryResponse.body.payment.attemptCount, 2);

    const storedPayment = await prisma.payment.findUnique({
      where: {
        id: retryResponse.body.payment.id
      },
      include: {
        transactions: true
      }
    });

    assert.equal(storedPayment?.transactions.length, 2);
  });

  async function requestJson<T>(options: RequestOptions): Promise<JsonResponse<T>> {
    const payload = options.body ? JSON.stringify(options.body) : undefined;

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
