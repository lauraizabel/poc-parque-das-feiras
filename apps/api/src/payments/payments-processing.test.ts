import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import * as http from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@acme/database";
import { AppModule } from "../app.module";
import { PaymentsService } from "./payments.service";

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

describe("payments webhook processing", () => {
  const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const webhookSecret = "whsec_processing_secret";
  const suffix = Date.now().toString(36);
  const merchantEmail = `payments-processing-${suffix}@example.com`;
  const password = "StrongPass123";
  const storeSlug = `payments-processing-${suffix}`;

  let app: INestApplication;
  let paymentsService: PaymentsService;
  let baseUrl = "";
  let userId = "";
  let storeId = "";
  let token = "";
  let productId = "";

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
    paymentsService = app.get(PaymentsService);

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
        fullName: "Payments Processing Merchant",
        storeName: "Payments Processing Store",
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
        name: "Balança Brew",
        slug: "balanca-brew",
        priceCents: 12990,
        stockQuantity: 20,
        status: "ACTIVE"
      })
    });
    productId = productResponse.body.product.id;
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

  it("processes approved payments asynchronously", async () => {
    const checkout = await createOrderAndPayment("approved");
    const webhook = await deliverWebhook({
      id: `evt_approved_${suffix}`,
      type: "payment_intent.succeeded",
      paymentId: checkout.paymentId,
      orderId: checkout.orderId
    });

    await paymentsService.processPaymentWebhookJob(webhook.body.event.id);

    const payment = await prisma.payment.findUnique({ where: { id: checkout.paymentId } });
    const order = await prisma.order.findUnique({ where: { id: checkout.orderId } });
    const event = await prisma.paymentWebhookEvent.findUnique({ where: { id: webhook.body.event.id } });

    assert.equal(payment?.status, PaymentStatus.APPROVED);
    assert.ok(payment?.paidAt);
    assert.equal(order?.status, "PAYMENT_APPROVED");
    assert.equal(event?.status, "PROCESSED");
  });

  it("keeps checkout-created orders reproducible before webhook reconciliation", async () => {
    const orderOnly = await createOrderOnly("created");

    const createdOrder = await prisma.order.findUnique({
      where: { id: orderOnly.orderId }
    });

    assert.equal(createdOrder?.status, "CREATED");
    assert.equal(createdOrder?.paymentId, null);

    const paymentStart = await startPaymentForOrder({
      label: "created",
      orderId: orderOnly.orderId,
      sessionId: orderOnly.sessionId,
      customerEmail: orderOnly.customerEmail
    });

    const payableOrder = await prisma.order.findUnique({
      where: { id: orderOnly.orderId }
    });
    const pendingPayment = await prisma.payment.findUnique({
      where: { id: paymentStart.paymentId }
    });

    assert.equal(payableOrder?.status, "WAITING_PAYMENT");
    assert.equal(payableOrder?.paymentId, paymentStart.paymentId);
    assert.equal(pendingPayment?.status, PaymentStatus.PENDING);
  });

  it("processes failed payments asynchronously", async () => {
    const checkout = await createOrderAndPayment("failed");
    const webhook = await deliverWebhook({
      id: `evt_failed_${suffix}`,
      type: "payment_intent.payment_failed",
      paymentId: checkout.paymentId,
      orderId: checkout.orderId,
      extras: {
        last_payment_error: {
          code: "card_declined",
          message: "Card was declined"
        }
      }
    });

    await paymentsService.processPaymentWebhookJob(webhook.body.event.id);

    const payment = await prisma.payment.findUnique({ where: { id: checkout.paymentId } });
    const order = await prisma.order.findUnique({ where: { id: checkout.orderId } });

    assert.equal(payment?.status, PaymentStatus.FAILED);
    assert.equal(payment?.failureCode, "card_declined");
    assert.equal(order?.status, "PAYMENT_FAILED");
  });

  it("processes expired payments asynchronously", async () => {
    const checkout = await createOrderAndPayment("expired");
    const webhook = await deliverWebhook({
      id: `evt_expired_${suffix}`,
      type: "payment_intent.canceled",
      paymentId: checkout.paymentId,
      orderId: checkout.orderId,
      extras: {
        cancellation_reason: "abandoned"
      }
    });

    await paymentsService.processPaymentWebhookJob(webhook.body.event.id);

    const payment = await prisma.payment.findUnique({ where: { id: checkout.paymentId } });
    const order = await prisma.order.findUnique({ where: { id: checkout.orderId } });

    assert.equal(payment?.status, PaymentStatus.EXPIRED);
    assert.equal(order?.status, "PAYMENT_FAILED");
  });

  it("processes refunded payments asynchronously", async () => {
    const checkout = await createOrderAndPayment("refunded");

    await prisma.payment.update({
      where: { id: checkout.paymentId },
      data: {
        status: PaymentStatus.APPROVED,
        paidAt: new Date()
      }
    });

    await prisma.order.update({
      where: { id: checkout.orderId },
      data: {
        status: "PAYMENT_APPROVED"
      }
    });

    const webhook = await deliverWebhook({
      id: `evt_refunded_${suffix}`,
      type: "charge.refunded",
      paymentId: checkout.paymentId,
      orderId: checkout.orderId
    });

    await paymentsService.processPaymentWebhookJob(webhook.body.event.id);

    const payment = await prisma.payment.findUnique({ where: { id: checkout.paymentId } });
    const order = await prisma.order.findUnique({ where: { id: checkout.orderId } });

    assert.equal(payment?.status, PaymentStatus.REFUNDED);
    assert.equal(order?.status, "REFUNDED");
  });

  it("keeps webhook reconciliation idempotent when the same job is retried", async () => {
    const checkout = await createOrderAndPayment("idempotent");
    const webhook = await deliverWebhook({
      id: `evt_idempotent_${suffix}`,
      type: "payment_intent.succeeded",
      paymentId: checkout.paymentId,
      orderId: checkout.orderId
    });

    const firstRun = await paymentsService.processPaymentWebhookJob(webhook.body.event.id);
    const secondRun = await paymentsService.processPaymentWebhookJob(webhook.body.event.id);

    const webhookTransactions = await prisma.paymentTransaction.findMany({
      where: {
        paymentId: checkout.paymentId,
        kind: "WEBHOOK"
      }
    });
    const payment = await prisma.payment.findUnique({
      where: { id: checkout.paymentId }
    });
    const order = await prisma.order.findUnique({
      where: { id: checkout.orderId }
    });

    assert.equal(firstRun?.processed, true);
    assert.equal(secondRun?.skipped, true);
    assert.equal(webhookTransactions.length, 1);
    assert.equal(payment?.status, PaymentStatus.APPROVED);
    assert.equal(order?.status, "PAYMENT_APPROVED");
  });

  async function createOrderAndPayment(label: string) {
    const orderOnly = await createOrderOnly(label);
    const paymentStart = await startPaymentForOrder({
      label,
      orderId: orderOnly.orderId,
      sessionId: orderOnly.sessionId,
      customerEmail: orderOnly.customerEmail
    });

    return {
      orderId: orderOnly.orderId,
      paymentId: paymentStart.paymentId
    };
  }

  async function createOrderOnly(label: string) {
    const sessionId = `payments-processing-session-${label}-${suffix}`;
    const customerEmail = `buyer-${label}-${suffix}@example.com`;

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
        customerFullName: `Buyer ${label}`,
        shippingRecipientName: `Buyer ${label}`,
        shippingPostalCode: "50000-000",
        shippingState: "PE",
        shippingCity: "Recife",
        shippingDistrict: "Boa Viagem",
        shippingStreet: "Rua do Sol",
        shippingNumber: "100"
      })
    });

    const orderId = orderResponse.body.order.id;

    return {
      orderId,
      sessionId,
      customerEmail
    };
  }

  async function startPaymentForOrder(input: {
    label: string;
    orderId: string;
    sessionId: string;
    customerEmail: string;
  }) {
    const paymentIntentResponse = await requestJson<{
      payment: { id: string };
    }>({
      method: "POST",
      path: `/payments/public/orders/${input.orderId}/intent`,
      headers: {
        host: `${storeSlug}.lvh.me`
      },
      body: JSON.stringify({
        sessionId: input.sessionId,
        customerEmail: input.customerEmail
      })
    });

    return {
      paymentId: paymentIntentResponse.body.payment.id
    };
  }

  async function deliverWebhook(input: {
    id: string;
    type: string;
    paymentId: string;
    orderId: string;
    extras?: Record<string, unknown>;
  }) {
    const payload = JSON.stringify({
      id: input.id,
      type: input.type,
      livemode: false,
      request: {
        idempotency_key: `idem_${input.id}`
      },
      data: {
        object: {
          id: `pi_${input.id}`,
          object: "payment_intent",
          metadata: {
            paymentId: input.paymentId,
            orderId: input.orderId,
            storeId
          },
          ...(input.extras ?? {})
        }
      }
    });

    return requestJson<{
      event: { id: string };
      queued: { queued: boolean; jobId: string };
    }>({
      method: "POST",
      path: "/payments/webhooks/stripe",
      headers: {
        "stripe-signature": createStripeSignature(payload, webhookSecret)
      },
      body: payload
    });
  }

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
