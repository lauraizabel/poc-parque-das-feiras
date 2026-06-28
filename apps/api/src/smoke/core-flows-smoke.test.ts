import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import * as http from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { prisma } from "@acme/database";
import { AppModule } from "../app.module";
import { PaymentsService } from "../payments/payments.service";

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

describe("core flows smoke e2e", () => {
  const previousWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const webhookSecret = "whsec_smoke_core_flows";
  const suffix = Date.now().toString(36);
  const merchantEmail = `smoke-merchant-${suffix}@example.com`;
  const password = "StrongPass123";
  const storeSlug = `smoke-store-${suffix}`;
  const customerEmail = `smoke-customer-${suffix}@example.com`;
  const sessionId = `smoke-session-${suffix}`;
  const storefrontHost = `${storeSlug}.lvh.me`;

  let app: INestApplication;
  let paymentsService: PaymentsService;
  let baseUrl = "";
  let userId = "";
  let storeId = "";
  let token = "";

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
  });

  after(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = previousWebhookSecret;

    if (storeId) {
      await prisma.store.delete({ where: { id: storeId } }).catch(() => null);
    }

    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => null);
    }

    await app.close();
  });

  it("covers onboarding, product setup, checkout, payment approval and fulfillment updates", async () => {
    const registration = await requestJson<{
      user: { id: string; email: string };
      store: { id: string; slug: string; defaultSubdomain: string };
      membership: { role: string };
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/register-merchant",
      body: {
        email: merchantEmail,
        password,
        fullName: "Smoke Merchant",
        storeName: "Smoke Store",
        storeSlug
      }
    });

    assert.equal(registration.statusCode, 201);
    userId = registration.body.user.id;
    storeId = registration.body.store.id;
    token = registration.body.tokens.accessToken;
    assert.equal(registration.body.user.email, merchantEmail);
    assert.equal(registration.body.membership.role, "STORE_OWNER");
    assert.equal(registration.body.store.slug, storeSlug);

    const meResponse = await requestJson<{
      memberships: Array<{ storeId: string; role: string; store: { slug: string } }>;
    }>({
      method: "GET",
      path: "/auth/me",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(meResponse.statusCode, 200);
    assert.equal(meResponse.body.memberships.length, 1);
    assert.equal(meResponse.body.memberships[0]?.storeId, storeId);
    assert.equal(meResponse.body.memberships[0]?.role, "STORE_OWNER");
    assert.equal(meResponse.body.memberships[0]?.store.slug, storeSlug);

    const categoryResponse = await requestJson<{
      category: { id: string; slug: string };
    }>({
      method: "POST",
      path: "/catalog/categories",
      headers: {
        authorization: `Bearer ${token}`
      },
      body: {
        storeId,
        name: "Cafe Especial",
        slug: "cafe-especial"
      }
    });

    assert.equal(categoryResponse.statusCode, 201);

    const productResponse = await requestJson<{
      product: { id: string; status: string; slug: string; sku: string | null };
    }>({
      method: "POST",
      path: "/catalog/products",
      headers: {
        authorization: `Bearer ${token}`
      },
      body: {
        storeId,
        categoryId: categoryResponse.body.category.id,
        name: "Moedor Premium",
        slug: "Moedor Premium",
        sku: "mp-001",
        priceCents: 18990,
        stockQuantity: 5,
        status: "DRAFT"
      }
    });

    assert.equal(productResponse.statusCode, 201);
    assert.equal(productResponse.body.product.status, "DRAFT");
    assert.equal(productResponse.body.product.slug, "moedor-premium");
    assert.equal(productResponse.body.product.sku, "MP-001");

    const publishResponse = await requestJson<{
      product: { id: string; status: string };
    }>({
      method: "POST",
      path: `/catalog/${storeId}/products/${productResponse.body.product.id}/publish`,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(publishResponse.statusCode, 201);
    assert.equal(publishResponse.body.product.status, "ACTIVE");

    const shippingResponse = await requestJson<{
      shippingMethod: { id: string; priceCents: number };
    }>({
      method: "POST",
      path: "/shipping/methods",
      headers: {
        authorization: `Bearer ${token}`
      },
      body: {
        storeId,
        name: "Entrega Expressa",
        type: "FIXED_PRICE",
        priceCents: 2400,
        estimatedDaysMin: 1,
        estimatedDaysMax: 3,
        minimumOrderCents: 0,
        maximumOrderCents: 100000,
        sortOrder: 1,
        isDefault: true
      }
    });

    assert.equal(shippingResponse.statusCode, 201);

    const catalogContextResponse = await requestJson<{
      store: { storeId: string; slug: string; host: string };
    }>({
      method: "GET",
      path: "/catalog/public/context",
      headers: {
        "x-forwarded-host": storefrontHost
      }
    });

    assert.equal(catalogContextResponse.statusCode, 200);
    assert.equal(catalogContextResponse.body.store.storeId, storeId);
    assert.equal(catalogContextResponse.body.store.slug, storeSlug);
    assert.equal(catalogContextResponse.body.store.host, storefrontHost);

    const homepageResponse = await requestJson<{
      store: { slug: string };
      categories: Array<{ id: string; slug: string }>;
      products: Array<{ id: string; slug: string; status: string }>;
    }>({
      method: "GET",
      path: "/catalog/public/home",
      headers: {
        "x-forwarded-host": storefrontHost
      }
    });

    assert.equal(homepageResponse.statusCode, 200);
    assert.equal(homepageResponse.body.store.slug, storeSlug);
    assert.equal(homepageResponse.body.categories.length, 1);
    assert.equal(homepageResponse.body.categories[0]?.slug, "cafe-especial");
    assert.equal(homepageResponse.body.products.length, 1);
    assert.equal(homepageResponse.body.products[0]?.id, productResponse.body.product.id);
    assert.equal(homepageResponse.body.products[0]?.status, "ACTIVE");

    const publicProductsResponse = await requestJson<{
      selectedCategorySlug: string | null;
      products: Array<{ id: string; slug: string; priceCents: number }>;
      pagination: { totalItems: number; totalPages: number; page: number };
    }>({
      method: "GET",
      path: "/catalog/public/products",
      headers: {
        "x-forwarded-host": storefrontHost
      }
    });

    assert.equal(publicProductsResponse.statusCode, 200);
    assert.equal(publicProductsResponse.body.selectedCategorySlug, null);
    assert.equal(publicProductsResponse.body.pagination.totalItems, 1);
    assert.equal(publicProductsResponse.body.pagination.totalPages, 1);
    assert.equal(publicProductsResponse.body.pagination.page, 1);
    assert.equal(publicProductsResponse.body.products[0]?.id, productResponse.body.product.id);
    assert.equal(publicProductsResponse.body.products[0]?.slug, "moedor-premium");
    assert.equal(publicProductsResponse.body.products[0]?.priceCents, 18990);

    const publicProductResponse = await requestJson<{
      store: { slug: string };
      product: { id: string; slug: string; status: string };
      availability: { canAddToCart: boolean; isInStock: boolean; status: string };
    }>({
      method: "GET",
      path: "/catalog/public/products/moedor-premium",
      headers: {
        "x-forwarded-host": storefrontHost
      }
    });

    assert.equal(publicProductResponse.statusCode, 200);
    assert.equal(publicProductResponse.body.store.slug, storeSlug);
    assert.equal(publicProductResponse.body.product.id, productResponse.body.product.id);
    assert.equal(publicProductResponse.body.product.slug, "moedor-premium");
    assert.equal(publicProductResponse.body.product.status, "ACTIVE");
    assert.equal(publicProductResponse.body.availability.canAddToCart, true);
    assert.equal(publicProductResponse.body.availability.isInStock, true);
    assert.equal(publicProductResponse.body.availability.status, "ACTIVE");

    const addToCartResponse = await requestJson<{
      cart: { items: Array<{ productId: string; quantity: number }> };
    }>({
      method: "POST",
      path: "/cart/public/current/items",
      headers: {
        "x-forwarded-host": storefrontHost
      },
      body: {
        sessionId,
        customerEmail,
        productId: productResponse.body.product.id,
        quantity: 1
      }
    });

    assert.equal(addToCartResponse.statusCode, 201);
    assert.equal(addToCartResponse.body.cart.items.length, 1);
    assert.equal(addToCartResponse.body.cart.items[0]?.productId, productResponse.body.product.id);
    assert.equal(addToCartResponse.body.cart.items[0]?.quantity, 1);

    const cartContextResponse = await requestJson<{
      store: { slug: string };
      cart: {
        summary: { itemCount: number; subtotalCents: number };
        items: Array<{ productId: string; quantity: number; unitPriceCents: number }>;
      } | null;
    }>({
      method: "GET",
      path: "/cart/public/context",
      headers: {
        "x-forwarded-host": storefrontHost
      },
      body: {
        sessionId,
        customerEmail
      }
    });

    assert.equal(cartContextResponse.statusCode, 200);
    assert.equal(cartContextResponse.body.store.slug, storeSlug);
    assert.equal(cartContextResponse.body.cart?.summary.itemCount, 1);
    assert.equal(cartContextResponse.body.cart?.summary.subtotalCents, 18990);
    assert.equal(cartContextResponse.body.cart?.items[0]?.productId, productResponse.body.product.id);
    assert.equal(cartContextResponse.body.cart?.items[0]?.quantity, 1);
    assert.equal(cartContextResponse.body.cart?.items[0]?.unitPriceCents, 18990);

    const shippingOptionsResponse = await requestJson<{
      store: { slug: string };
      cart: { subtotalCents: number };
      shippingOptions: Array<{
        id: string;
        priceCents: number;
        totalCents: number;
        isDefault: boolean;
      }>;
    }>({
      method: "POST",
      path: "/checkout/public/current/shipping-options",
      headers: {
        "x-forwarded-host": storefrontHost
      },
      body: {
        sessionId,
        customerEmail
      }
    });

    assert.equal(shippingOptionsResponse.statusCode, 201);
    assert.equal(shippingOptionsResponse.body.store.slug, storeSlug);
    assert.equal(shippingOptionsResponse.body.cart.subtotalCents, 18990);
    assert.equal(shippingOptionsResponse.body.shippingOptions.length, 1);
    assert.equal(
      shippingOptionsResponse.body.shippingOptions[0]?.id,
      shippingResponse.body.shippingMethod.id
    );
    assert.equal(shippingOptionsResponse.body.shippingOptions[0]?.priceCents, 2400);
    assert.equal(shippingOptionsResponse.body.shippingOptions[0]?.totalCents, 21390);
    assert.equal(shippingOptionsResponse.body.shippingOptions[0]?.isDefault, true);

    const checkoutResponse = await requestJson<{
      customerAccess: { token: string };
      order: { id: string; status: string; totalCents: number; shippingMethodId: string | null };
    }>({
      method: "POST",
      path: "/checkout/public/current/order",
      headers: {
        "x-forwarded-host": storefrontHost
      },
      body: {
        sessionId,
        customerEmail,
        customerFullName: "Cliente Smoke",
        customerPhoneNumber: "+55 81 99999-1234",
        shippingMethodId: shippingResponse.body.shippingMethod.id,
        shippingRecipientName: "Cliente Smoke",
        shippingPhoneNumber: "+55 81 99999-1234",
        shippingPostalCode: "50000-000",
        shippingState: "PE",
        shippingCity: "Recife",
        shippingDistrict: "Boa Vista",
        shippingStreet: "Rua do Sol",
        shippingNumber: "100",
        shippingComplement: "Casa 2",
        notes: "Entregar em horario comercial"
      }
    });

    assert.equal(checkoutResponse.statusCode, 201);
    assert.equal(checkoutResponse.body.order.status, "CREATED");
    assert.equal(
      checkoutResponse.body.order.totalCents,
      18990 + shippingResponse.body.shippingMethod.priceCents
    );
    assert.equal(
      checkoutResponse.body.order.shippingMethodId,
      shippingResponse.body.shippingMethod.id
    );

    const paymentIntentResponse = await requestJson<{
      order: { id: string; status: string };
      payment: { id: string; status: string };
      intent: { providerPaymentId: string; clientSecret: string };
    }>({
      method: "POST",
      path: `/payments/public/orders/${checkoutResponse.body.order.id}/intent`,
      headers: {
        "x-forwarded-host": storefrontHost
      },
      body: {
        sessionId,
        customerEmail
      }
    });

    assert.equal(paymentIntentResponse.statusCode, 201);
    assert.equal(paymentIntentResponse.body.order.status, "WAITING_PAYMENT");
    assert.equal(paymentIntentResponse.body.payment.status, "PENDING");
    assert.match(paymentIntentResponse.body.intent.clientSecret, /^pi_/);

    const webhookPayload = JSON.stringify({
      id: `evt_smoke_${suffix}`,
      type: "payment_intent.succeeded",
      livemode: false,
      request: {
        idempotency_key: `idem_smoke_${suffix}`
      },
      data: {
        object: {
          id: `pi_smoke_${suffix}`,
          object: "payment_intent",
          metadata: {
            paymentId: paymentIntentResponse.body.payment.id,
            orderId: checkoutResponse.body.order.id,
            storeId
          }
        }
      }
    });

    const webhookResponse = await requestJson<{
      received: boolean;
      duplicate: boolean;
      event: { id: string };
    }>({
      method: "POST",
      path: "/payments/webhooks/stripe",
      headers: {
        "stripe-signature": createStripeSignature(webhookPayload, webhookSecret)
      },
      body: webhookPayload
    });

    assert.equal(webhookResponse.statusCode, 201);
    assert.equal(webhookResponse.body.received, true);
    assert.equal(webhookResponse.body.duplicate, false);

    const processingResult = await paymentsService.processPaymentWebhookJob(
      webhookResponse.body.event.id
    );
    assert.equal(processingResult.processed, true);

    const approvedOrder = await prisma.order.findUnique({
      where: { id: checkoutResponse.body.order.id },
      include: {
        payment: true
      }
    });

    assert.equal(approvedOrder?.status, "PAYMENT_APPROVED");
    assert.equal(approvedOrder?.payment?.status, "APPROVED");

    const processingUpdate = await requestJson<{
      order: { status: string; shipment: { status: string } | null };
    }>({
      method: "PATCH",
      path: `/orders/${storeId}/${checkoutResponse.body.order.id}/status`,
      headers: {
        authorization: `Bearer ${token}`
      },
      body: {
        storeId,
        status: "PROCESSING",
        reason: "Separando para envio",
        notes: "Pedido conferido"
      }
    });

    assert.equal(processingUpdate.statusCode, 200);
    assert.equal(processingUpdate.body.order.status, "PROCESSING");
    assert.equal(processingUpdate.body.order.shipment?.status, "READY_TO_SHIP");

    const shippedUpdate = await requestJson<{
      order: {
        status: string;
        shipment: {
          status: string;
          carrierName: string | null;
          serviceName: string | null;
          trackingCode: string | null;
        } | null;
      };
    }>({
      method: "PATCH",
      path: `/orders/${storeId}/${checkoutResponse.body.order.id}/status`,
      headers: {
        authorization: `Bearer ${token}`
      },
      body: {
        storeId,
        status: "SHIPPED",
        reason: "Postado na transportadora",
        carrierName: "Correios",
        serviceName: "SEDEX",
        trackingCode: "SMOKE123BR",
        trackingUrl: "https://rastreamento.example.com/SMOKE123BR"
      }
    });

    assert.equal(shippedUpdate.statusCode, 200);
    assert.equal(shippedUpdate.body.order.status, "SHIPPED");
    assert.equal(shippedUpdate.body.order.shipment?.status, "SHIPPED");
    assert.equal(shippedUpdate.body.order.shipment?.carrierName, "Correios");
    assert.equal(shippedUpdate.body.order.shipment?.serviceName, "SEDEX");
    assert.equal(shippedUpdate.body.order.shipment?.trackingCode, "SMOKE123BR");

    const publicOrderResponse = await requestJson<{
      order: {
        id: string;
        status: string;
        customerEmail: string;
        payment: { status: string } | null;
        shipment: {
          status: string;
          trackingCode: string | null;
          carrierName: string | null;
        } | null;
      };
    }>({
      method: "GET",
      path: `/orders/public/${checkoutResponse.body.order.id}?token=${checkoutResponse.body.customerAccess.token}`
    });

    assert.equal(publicOrderResponse.statusCode, 200);
    assert.equal(publicOrderResponse.body.order.id, checkoutResponse.body.order.id);
    assert.equal(publicOrderResponse.body.order.status, "SHIPPED");
    assert.equal(publicOrderResponse.body.order.customerEmail, customerEmail);
    assert.equal(publicOrderResponse.body.order.payment?.status, "APPROVED");
    assert.equal(publicOrderResponse.body.order.shipment?.status, "SHIPPED");
    assert.equal(publicOrderResponse.body.order.shipment?.carrierName, "Correios");
    assert.equal(publicOrderResponse.body.order.shipment?.trackingCode, "SMOKE123BR");
  });

  async function requestJson<T>(options: RequestOptions): Promise<JsonResponse<T>> {
    const payload =
      typeof options.body === "string"
        ? options.body
        : options.body === undefined
          ? undefined
          : JSON.stringify(options.body);

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
