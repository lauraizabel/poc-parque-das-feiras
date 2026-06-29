import assert from "node:assert/strict";
import * as http from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { OrderStatus, PlatformRole } from "@prisma/client";
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

describe("audit trail api", () => {
  const suffix = Date.now().toString(36);
  const password = "StrongPass123";
  const merchantEmail = `audit-merchant-${suffix}@example.com`;
  const supportEmail = `audit-support-${suffix}@example.com`;
  const adminEmail = `audit-admin-${suffix}@example.com`;
  const domainHost = `www.audit-${suffix}.example.com`;
  const storeSlug = `audit-store-${suffix}`;

  let app: INestApplication;
  let baseUrl = "";
  let merchantUserId = "";
  let merchantToken = "";
  let supportUserId = "";
  let adminUserId = "";
  let adminToken = "";
  let storeId = "";
  let memberId = "";
  let categoryId = "";
  let productId = "";
  let orderId = "";

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
        fullName: "Audit Merchant",
        storeName: "Audit Store",
        storeSlug
      }
    });

    merchantUserId = merchantRegistration.body.user.id;
    storeId = merchantRegistration.body.store.id;
    merchantToken = merchantRegistration.body.tokens.accessToken;

    const merchantLogin = await requestJson<{
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/login",
      body: {
        email: merchantEmail,
        password
      }
    });
    merchantToken = merchantLogin.body.tokens.accessToken;

    const supportRegistration = await requestJson<{
      user: { id: string };
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/register",
      body: {
        email: supportEmail,
        password,
        fullName: "Audit Support"
      }
    });
    supportUserId = supportRegistration.body.user.id;

    const activeMembership = await requestJson<{
      status: "ACTIVE";
      member: { id: string };
    }>({
      method: "POST",
      path: `/stores/${storeId}/members/invite`,
      headers: {
        authorization: `Bearer ${merchantToken}`
      },
      body: {
        email: supportEmail,
        role: "STORE_MANAGER"
      }
    });
    memberId = activeMembership.body.member.id;

    await requestJson<{
      member: { role: string };
    }>({
      method: "PATCH",
      path: `/stores/${storeId}/members/${memberId}`,
      headers: {
        authorization: `Bearer ${merchantToken}`
      },
      body: {
        role: "STORE_SUPPORT"
      }
    });

    const categoryResponse = await requestJson<{
      category: { id: string };
    }>({
      method: "POST",
      path: "/catalog/categories",
      headers: {
        authorization: `Bearer ${merchantToken}`
      },
      body: {
        storeId,
        name: "Audit Category",
        slug: "audit-category"
      }
    });
    categoryId = categoryResponse.body.category.id;

    const productResponse = await requestJson<{
      product: { id: string };
    }>({
      method: "POST",
      path: "/catalog/products",
      headers: {
        authorization: `Bearer ${merchantToken}`
      },
      body: {
        storeId,
        categoryId,
        name: "Audit Product",
        slug: "audit-product",
        sku: "AUD-001",
        priceCents: 12990,
        stockQuantity: 3,
        status: "DRAFT"
      }
    });
    productId = productResponse.body.product.id;

    await requestJson<{
      product: { status: string };
    }>({
      method: "POST",
      path: `/catalog/${storeId}/products/${productId}/publish`,
      headers: {
        authorization: `Bearer ${merchantToken}`
      }
    });

    await requestJson<{
      domain: { id: string };
    }>({
      method: "POST",
      path: "/domains",
      headers: {
        authorization: `Bearer ${merchantToken}`
      },
      body: {
        storeId,
        host: domainHost
      }
    });

    const order = await prisma.order.create({
      data: {
        storeId,
        status: OrderStatus.PAYMENT_APPROVED,
        currencyCode: "BRL",
        subtotalCents: 12990,
        totalCents: 12990,
        customerEmail: `audit-customer-${suffix}@example.com`,
        customerFullName: "Audit Customer",
        items: {
          create: [
            {
              productId,
              productName: "Audit Product",
              productSlug: "audit-product",
              quantity: 1,
              unitPriceCents: 12990,
              totalCents: 12990,
              currencyCode: "BRL"
            }
          ]
        }
      }
    });
    orderId = order.id;

    const orderUpdateResponse = await requestJson<{
      order: { status: string };
    }>({
      method: "PATCH",
      path: `/orders/${storeId}/${orderId}/status`,
      headers: {
        authorization: `Bearer ${merchantToken}`
      },
      body: {
        storeId,
        status: "PROCESSING",
        reason: "Preparing shipment"
      }
    });
    assert.equal(orderUpdateResponse.statusCode, 200);

    const adminRegistration = await requestJson<{
      user: { id: string };
    }>({
      method: "POST",
      path: "/auth/register",
      body: {
        email: adminEmail,
        password,
        fullName: "Audit Admin"
      }
    });
    adminUserId = adminRegistration.body.user.id;

    await prisma.user.update({
      where: { id: adminUserId },
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
        email: adminEmail,
        password
      }
    });
    adminToken = adminLogin.body.tokens.accessToken;
  });

  after(async () => {
    if (storeId) {
      await prisma.auditLog.deleteMany({ where: { storeId } }).catch(() => null);
      await prisma.notification.deleteMany({ where: { storeId } }).catch(() => null);
      await prisma.store.delete({ where: { id: storeId } }).catch(() => null);
    }

    if (adminUserId || merchantUserId || supportUserId) {
      await prisma.auditLog.deleteMany({
        where: {
          userId: {
            in: [adminUserId, merchantUserId, supportUserId].filter(Boolean)
          }
        }
      }).catch(() => null);
      await prisma.notification.deleteMany({
        where: {
          userId: {
            in: [adminUserId, merchantUserId, supportUserId].filter(Boolean)
          }
        }
      }).catch(() => null);
    }

    if (adminUserId) {
      await prisma.user.delete({ where: { id: adminUserId } }).catch(() => null);
    }

    if (supportUserId) {
      await prisma.user.delete({ where: { id: supportUserId } }).catch(() => null);
    }

    if (merchantUserId) {
      await prisma.user.delete({ where: { id: merchantUserId } }).catch(() => null);
    }

    await app.close();
  });

  it("records critical actions and exposes them to platform admins", async () => {
    const storeLogs = await requestJson<{
      logs: Array<{
        action: string;
        createdAt: string;
        user: null | { email: string };
        store: null | { id: string };
      }>;
    }>({
      path: `/audit/logs?storeId=${storeId}&take=20`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    assert.equal(storeLogs.statusCode, 200);
    assert.ok(
      storeLogs.body.logs.some((log) => log.action === "store.created" && log.store?.id === storeId),
      JSON.stringify(storeLogs.body.logs, null, 2)
    );
    assert.ok(
      storeLogs.body.logs.some(
        (log) => log.action === "domain.updated" && log.user?.email === merchantEmail
      ),
      JSON.stringify(storeLogs.body.logs, null, 2)
    );
    assert.ok(
      storeLogs.body.logs.some(
        (log) => log.action === "store.member_role_changed" && log.user?.email === merchantEmail
      ),
      JSON.stringify(storeLogs.body.logs, null, 2)
    );
    assert.ok(
      storeLogs.body.logs.some(
        (log) => log.action === "catalog.product_created" && log.user?.email === merchantEmail
      ),
      JSON.stringify(storeLogs.body.logs, null, 2)
    );
    assert.ok(
      storeLogs.body.logs.some(
        (log) => log.action === "catalog.product_published" && log.user?.email === merchantEmail
      ),
      JSON.stringify(storeLogs.body.logs, null, 2)
    );
    assert.ok(
      storeLogs.body.logs.some(
        (log) => log.action === "orders.status_updated" && log.user?.email === merchantEmail
      ),
      JSON.stringify(storeLogs.body.logs, null, 2)
    );
    assert.ok(storeLogs.body.logs.every((log) => typeof log.createdAt === "string"));

    const loginLogs = await requestJson<{
      logs: Array<{
        action: string;
        user: null | { email: string };
      }>;
    }>({
      path: `/audit/logs?action=auth.login&userId=${merchantUserId}&take=5`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    assert.equal(loginLogs.statusCode, 200);
    assert.ok(
      loginLogs.body.logs.some(
        (log) => log.action === "auth.login" && log.user?.email === merchantEmail
      )
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
