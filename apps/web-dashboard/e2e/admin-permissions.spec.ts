import { expect, test } from "@playwright/test";
import { prisma } from "@acme/database";

const suffix = Date.now().toString(36);
const password = "StrongPass123";
const merchantEmail = `admin-ui-merchant-${suffix}@example.com`;
const platformAdminEmail = `admin-ui-platform-${suffix}@example.com`;
const merchantStoreSlug = `admin-ui-store-${suffix}`;

let merchantUserId = "";
let merchantStoreId = "";
let platformAdminUserId = "";

test.afterAll(async () => {
  if (merchantStoreId) {
    await prisma.store.delete({ where: { id: merchantStoreId } }).catch(() => null);
  }

  if (merchantUserId) {
    await prisma.user.delete({ where: { id: merchantUserId } }).catch(() => null);
  }

  if (platformAdminUserId) {
    await prisma.user.delete({ where: { id: platformAdminUserId } }).catch(() => null);
  }
});

test("blocks store roles from the global admin area", async ({ page, request }) => {
  const api = "http://127.0.0.1:3101";

  const merchantRegistration = await request.post(`${api}/auth/register-merchant`, {
    data: {
      email: merchantEmail,
      password,
      fullName: "Admin UI Merchant",
      storeName: "Admin UI Store",
      storeSlug: merchantStoreSlug
    }
  });
  expect(merchantRegistration.ok()).toBeTruthy();

  const merchantPayload = (await merchantRegistration.json()) as {
    user: { id: string; email: string };
    store: { id: string };
  };
  merchantUserId = merchantPayload.user.id;
  merchantStoreId = merchantPayload.store.id;

  await page.goto("/admin");

  await page.getByLabel("E-mail").fill(merchantEmail);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: /entrar no admin/i }).click();

  await expect(
    page.getByRole("heading", { name: /sua conta não possui acesso ao admin global/i })
  ).toBeVisible();
  await expect(page.getByText("PLATFORM_ADMIN", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /ir para o dashboard/i })).toBeVisible();
  await expect(page.getByTestId("admin-nav-overview")).toHaveCount(0);
});

test("allows platform admins into the global admin area", async ({ page, request }) => {
  const api = "http://127.0.0.1:3101";

  const adminRegistration = await request.post(`${api}/auth/register`, {
    data: {
      email: platformAdminEmail,
      password,
      fullName: "Admin UI Platform"
    }
  });
  expect(adminRegistration.ok()).toBeTruthy();

  const adminPayload = (await adminRegistration.json()) as {
    user: { id: string };
  };
  platformAdminUserId = adminPayload.user.id;

  await prisma.user.update({
    where: { id: platformAdminUserId },
    data: {
      platformRole: "PLATFORM_ADMIN"
    }
  });

  await page.goto("/admin");

  await page.getByLabel("E-mail").fill(platformAdminEmail);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: /entrar no admin/i }).click();

  await expect(page.getByRole("heading", { name: /painel administrativo/i })).toBeVisible();
  await expect(page.getByText("PLATFORM_ADMIN", { exact: true })).toBeVisible();
  await expect(page.getByTestId("admin-nav-overview")).toBeVisible();
  await expect(page.getByRole("heading", { name: /visão global da plataforma/i })).toBeVisible();
});
