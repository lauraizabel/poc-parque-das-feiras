import assert from "node:assert/strict";
import * as http from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  DomainStatus,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  PlatformRole,
  StoreStatus
} from "@prisma/client";
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

describe("admin api", () => {
  const suffix = Date.now().toString(36);
  const password = "StrongPass123";
  const merchantEmail = `admin-merchant-${suffix}@example.com`;
  const platformAdminEmail = `admin-platform-${suffix}@example.com`;
  const storeSlug = `admin-store-${suffix}`;
  const activeStoreSlug = `admin-active-store-${suffix}`;
  const customerEmail = `admin-customer-${suffix}@example.com`;
  const domainHost = `www.admin-${suffix}.example.com`;
  const activeDomainHost = `www.admin-active-${suffix}.example.com`;

  let app: INestApplication;
  let baseUrl = "";
  let merchantUserId = "";
  let merchantToken = "";
  let platformAdminUserId = "";
  let platformAdminToken = "";
  let storeId = "";
  let activeStoreId = "";
  let orderId = "";
  let paymentId = "";
  let domainId = "";
  let activeDomainId = "";

  before(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = testingModule.createNestApplication();
    await app.listen(0);

    const server = app.getHttpServer() as http.Server;
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const merchantRegistration = await requestJson<{
      user: { id: string };
      store: { id: string };
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/register-merchant",
      body: {
        email: merchantEmail,
        password,
        fullName: "Admin Merchant",
        storeName: "Admin Merchant Store",
        storeSlug
      }
    });

    merchantUserId = merchantRegistration.body.user.id;
    storeId = merchantRegistration.body.store.id;
    merchantToken = merchantRegistration.body.tokens.accessToken;

    const activeStoreFixture = await requestJson<{
      store: { id: string };
    }>({
      method: "POST",
      path: "/stores/fixtures",
      headers: {
        authorization: `Bearer ${merchantToken}`
      },
      body: {
        role: "STORE_OWNER",
        name: "Admin Active Store",
        slug: activeStoreSlug
      }
    });
    activeStoreId = activeStoreFixture.body.store.id;

    const adminRegistration = await requestJson<{
      user: { id: string };
    }>({
      method: "POST",
      path: "/auth/register",
      body: {
        email: platformAdminEmail,
        password,
        fullName: "Admin Platform Operator"
      }
    });
    platformAdminUserId = adminRegistration.body.user.id;

    await prisma.user.update({
      where: { id: platformAdminUserId },
      data: {
        platformRole: PlatformRole.PLATFORM_ADMIN
      }
    });

    const adminLogin = await requestJson<{
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/login",
      body: {
        email: platformAdminEmail,
        password
      }
    });
    platformAdminToken = adminLogin.body.tokens.accessToken;

    const domain = await prisma.storeDomain.create({
      data: {
        host: domainHost,
        status: DomainStatus.PENDING,
        dnsTargetValue: `${storeSlug}.lvh.me`,
        storeId
      }
    });
    domainId = domain.id;

    const activeDomain = await prisma.storeDomain.create({
      data: {
        host: activeDomainHost,
        status: DomainStatus.ACTIVE,
        dnsTargetValue: `${activeStoreSlug}.lvh.me`,
        activatedAt: new Date("2026-06-29T13:00:00.000Z"),
        storeId: activeStoreId
      }
    });
    activeDomainId = activeDomain.id;

    const cart = await prisma.cart.create({
      data: {
        storeId,
        sessionId: `admin-cart-${suffix}`,
        customerEmail,
        currencyCode: "BRL"
      }
    });

    const payment = await prisma.payment.create({
      data: {
        storeId,
        cartId: cart.id,
        provider: PaymentProvider.STRIPE_CONNECT,
        status: PaymentStatus.APPROVED,
        currencyCode: "BRL",
        amountCents: 25990,
        paidAt: new Date("2026-06-29T12:00:00.000Z")
      }
    });
    paymentId = payment.id;

    const order = await prisma.order.create({
      data: {
        storeId,
        cartId: cart.id,
        paymentId: payment.id,
        status: OrderStatus.PAYMENT_APPROVED,
        currencyCode: "BRL",
        subtotalCents: 24000,
        shippingCents: 1990,
        totalCents: 25990,
        customerEmail,
        customerFullName: "Admin Customer",
        statusUpdatedAt: new Date("2026-06-29T12:00:00.000Z"),
        approvedAt: new Date("2026-06-29T12:00:00.000Z"),
        items: {
          create: [
            {
              productName: "Admin seeded product",
              productSlug: "admin-seeded-product",
              quantity: 1,
              unitPriceCents: 24000,
              totalCents: 24000,
              currencyCode: "BRL"
            }
          ]
        }
      }
    });
    orderId = order.id;
  });

  after(async () => {
    for (const currentStoreId of [activeStoreId, storeId]) {
      if (currentStoreId) {
        await prisma.store.delete({ where: { id: currentStoreId } }).catch(() => null);
      }
    }

    for (const userId of [platformAdminUserId, merchantUserId]) {
      if (userId) {
        await prisma.user.delete({ where: { id: userId } }).catch(() => null);
      }
    }

    await app.close();
  });

  it("exposes overview and filtered global resources to platform admins", async () => {
    const overviewResponse = await requestJson<{
      totals: {
        users: number;
        stores: number;
        orders: number;
        domains: number;
        payments: number;
      };
      storesByStatus: Array<{ status: string; count: number }>;
      ordersByStatus: Array<{ status: string; count: number }>;
      domainsByStatus: Array<{ status: string; count: number }>;
    }>({
      path: "/admin/overview",
      headers: {
        authorization: `Bearer ${platformAdminToken}`
      }
    });

    assert.equal(overviewResponse.statusCode, 200);
    assert.ok(overviewResponse.body.totals.users >= 2);
    assert.ok(overviewResponse.body.totals.stores >= 1);
    assert.ok(overviewResponse.body.totals.orders >= 1);
    assert.ok(overviewResponse.body.totals.domains >= 1);
    assert.ok(overviewResponse.body.totals.payments >= 1);
    assert.ok(
      overviewResponse.body.ordersByStatus.some(
        (entry) => entry.status === OrderStatus.PAYMENT_APPROVED && entry.count >= 1
      )
    );
    assert.ok(
      overviewResponse.body.domainsByStatus.some(
        (entry) => entry.status === DomainStatus.PENDING && entry.count >= 1
      )
    );

    const storesResponse = await requestJson<{
      stores: Array<{
        id: string;
        slug: string;
        owner: { email: string };
        activeDomain: { host: string; status: string } | null;
        ordersCount: number;
      }>;
    }>({
      path: `/admin/stores?search=${storeSlug}`,
      headers: {
        authorization: `Bearer ${platformAdminToken}`
      }
    });

    assert.equal(storesResponse.statusCode, 200);
    assert.equal(storesResponse.body.stores.length, 1);
    assert.equal(storesResponse.body.stores[0]?.id, storeId);
    assert.equal(storesResponse.body.stores[0]?.slug, storeSlug);
    assert.equal(storesResponse.body.stores[0]?.owner.email, merchantEmail);
    assert.equal(storesResponse.body.stores[0]?.activeDomain?.host, domainHost);
    assert.ok((storesResponse.body.stores[0]?.ordersCount ?? 0) >= 1);

    const activeStoreDetail = await requestJson<{
      store: {
        id: string;
        slug: string;
        status: string;
        domains: Array<{ id: string; host: string; status: string }>;
        counts: {
          members: number;
          orders: number;
          payments: number;
          products: number;
        };
      };
    }>({
      path: `/admin/stores/${activeStoreId}`,
      headers: {
        authorization: `Bearer ${platformAdminToken}`
      }
    });

    assert.equal(activeStoreDetail.statusCode, 200);
    assert.equal(activeStoreDetail.body.store.id, activeStoreId);
    assert.equal(activeStoreDetail.body.store.slug, activeStoreSlug);
    assert.equal(activeStoreDetail.body.store.status, StoreStatus.TRIALING);
    assert.equal(activeStoreDetail.body.store.domains.length, 1);
    assert.equal(activeStoreDetail.body.store.domains[0]?.id, activeDomainId);
    assert.equal(activeStoreDetail.body.store.domains[0]?.host, activeDomainHost);
    assert.equal(activeStoreDetail.body.store.domains[0]?.status, DomainStatus.ACTIVE);
    assert.equal(activeStoreDetail.body.store.counts.members, 1);
    assert.equal(activeStoreDetail.body.store.counts.orders, 0);

    const updatedStoreResponse = await requestJson<{
      store: {
        id: string;
        status: string;
      };
    }>({
      method: "PATCH",
      path: `/admin/stores/${activeStoreId}/status`,
      headers: {
        authorization: `Bearer ${platformAdminToken}`
      },
      body: {
        status: StoreStatus.ACTIVE
      }
    });

    assert.equal(updatedStoreResponse.statusCode, 200);
    assert.equal(updatedStoreResponse.body.store.id, activeStoreId);
    assert.equal(updatedStoreResponse.body.store.status, StoreStatus.ACTIVE);

    const createdFrom = new Date(Date.now() - 60_000).toISOString();
    const createdTo = new Date(Date.now() + 60_000).toISOString();
    const filteredActiveStoresResponse = await requestJson<{
      stores: Array<{
        id: string;
        slug: string;
        status: string;
        activeDomain: { host: string; status: string } | null;
      }>;
    }>({
      path:
        `/admin/stores?status=${StoreStatus.ACTIVE}` +
        `&search=${activeStoreSlug}` +
        `&hasActiveDomain=true&createdFrom=${encodeURIComponent(createdFrom)}` +
        `&createdTo=${encodeURIComponent(createdTo)}`,
      headers: {
        authorization: `Bearer ${platformAdminToken}`
      }
    });

    assert.equal(filteredActiveStoresResponse.statusCode, 200);
    assert.equal(filteredActiveStoresResponse.body.stores.length, 1);
    assert.equal(filteredActiveStoresResponse.body.stores[0]?.id, activeStoreId);
    assert.equal(filteredActiveStoresResponse.body.stores[0]?.slug, activeStoreSlug);
    assert.equal(filteredActiveStoresResponse.body.stores[0]?.status, StoreStatus.ACTIVE);
    assert.equal(
      filteredActiveStoresResponse.body.stores[0]?.activeDomain?.host,
      activeDomainHost
    );
    assert.equal(
      filteredActiveStoresResponse.body.stores[0]?.activeDomain?.status,
      DomainStatus.ACTIVE
    );

    const usersResponse = await requestJson<{
      users: Array<{
        id: string;
        email: string;
        platformRole: string;
        ownedStoresCount: number;
        membershipsCount: number;
      }>;
    }>({
      path: `/admin/users?search=${encodeURIComponent(merchantEmail)}`,
      headers: {
        authorization: `Bearer ${platformAdminToken}`
      }
    });

    assert.equal(usersResponse.statusCode, 200);
    assert.equal(usersResponse.body.users.length, 1);
    assert.equal(usersResponse.body.users[0]?.id, merchantUserId);
    assert.equal(usersResponse.body.users[0]?.email, merchantEmail);
    assert.equal(usersResponse.body.users[0]?.platformRole, PlatformRole.CUSTOMER);
    assert.equal(usersResponse.body.users[0]?.ownedStoresCount, 2);
    assert.equal(usersResponse.body.users[0]?.membershipsCount, 2);

    const ordersResponse = await requestJson<{
      orders: Array<{
        id: string;
        customerEmail: string;
        status: string;
        payment: { id: string; status: string } | null;
        store: { id: string; slug: string };
        itemsCount: number;
      }>;
    }>({
      path: `/admin/orders?storeId=${storeId}&status=${OrderStatus.PAYMENT_APPROVED}`,
      headers: {
        authorization: `Bearer ${platformAdminToken}`
      }
    });

    assert.equal(ordersResponse.statusCode, 200);
    assert.equal(ordersResponse.body.orders.length, 1);
    assert.equal(ordersResponse.body.orders[0]?.id, orderId);
    assert.equal(ordersResponse.body.orders[0]?.customerEmail, customerEmail);
    assert.equal(ordersResponse.body.orders[0]?.status, OrderStatus.PAYMENT_APPROVED);
    assert.equal(ordersResponse.body.orders[0]?.payment?.id, paymentId);
    assert.equal(ordersResponse.body.orders[0]?.payment?.status, PaymentStatus.APPROVED);
    assert.equal(ordersResponse.body.orders[0]?.store.id, storeId);
    assert.equal(ordersResponse.body.orders[0]?.store.slug, storeSlug);
    assert.equal(ordersResponse.body.orders[0]?.itemsCount, 1);

    const domainsResponse = await requestJson<{
      domains: Array<{
        id: string;
        host: string;
        status: string;
        store: { id: string; slug: string };
      }>;
    }>({
      path: `/admin/domains?storeId=${storeId}&status=${DomainStatus.PENDING}`,
      headers: {
        authorization: `Bearer ${platformAdminToken}`
      }
    });

    assert.equal(domainsResponse.statusCode, 200);
    assert.equal(domainsResponse.body.domains.length, 1);
    assert.equal(domainsResponse.body.domains[0]?.id, domainId);
    assert.equal(domainsResponse.body.domains[0]?.host, domainHost);
    assert.equal(domainsResponse.body.domains[0]?.status, DomainStatus.PENDING);
    assert.equal(domainsResponse.body.domains[0]?.store.id, storeId);
    assert.equal(domainsResponse.body.domains[0]?.store.slug, storeSlug);
  });

  it("blocks merchant users from the global admin endpoints", async () => {
    const response = await requestJson<{
      code: string;
    }>({
      path: "/admin/overview",
      headers: {
        authorization: `Bearer ${merchantToken}`
      }
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.body.code, "AUTH_PLATFORM_ROLE_FORBIDDEN");
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
