import { expect, test } from "@playwright/test";

type MerchantRegistration = {
  user: { id: string; email: string };
  store: { id: string; slug: string; defaultSubdomain: string };
  tokens: { accessToken: string };
};

const suffix = Date.now().toString(36);
const merchantEmail = `dashboard-smoke-${suffix}@example.com`;
const password = "StrongPass123";
const primaryStoreSlug = `dashboard-smoke-a-${suffix}`;
const secondaryStoreSlug = `dashboard-smoke-b-${suffix}`;
const customerEmail = `dashboard-customer-${suffix}@example.com`;
const sessionId = `dashboard-session-${suffix}`;
const customDomainHost = `www.dashboard-smoke-${suffix}.example.com`;

test("covers login, store switch, catalog, orders and custom domain navigation", async ({
  page,
  request
}) => {
  const api = "http://127.0.0.1:3101";
  const storefrontHost = `${primaryStoreSlug}.lvh.me`;

  const registrationResponse = await request.post(`${api}/auth/register-merchant`, {
    data: {
      email: merchantEmail,
      password,
      fullName: "Dashboard Smoke Merchant",
      storeName: "Dashboard Smoke Store A",
      storeSlug: primaryStoreSlug
    }
  });
  expect(registrationResponse.ok()).toBeTruthy();
  const registration = (await registrationResponse.json()) as MerchantRegistration;

  const primaryStoreId = registration.store.id;
  const ownerToken = registration.tokens.accessToken;

  const secondStoreResponse = await request.post(`${api}/stores/fixtures`, {
    headers: {
      authorization: `Bearer ${ownerToken}`
    },
    data: {
      name: "Dashboard Smoke Store B",
      slug: secondaryStoreSlug,
      role: "STORE_MANAGER"
    }
  });
  expect(secondStoreResponse.ok()).toBeTruthy();
  const secondStorePayload = (await secondStoreResponse.json()) as {
    store: { id: string; name: string };
  };
  const secondaryStoreId = secondStorePayload.store.id;

  const categoryResponse = await request.post(`${api}/catalog/categories`, {
    headers: {
      authorization: `Bearer ${ownerToken}`
    },
    data: {
      storeId: primaryStoreId,
      name: "Cafes do Dashboard",
      slug: "cafes-dashboard"
    }
  });
  expect(categoryResponse.ok()).toBeTruthy();
  const categoryPayload = (await categoryResponse.json()) as {
    category: { id: string };
  };

  const productResponse = await request.post(`${api}/catalog/products`, {
    headers: {
      authorization: `Bearer ${ownerToken}`
    },
    data: {
      storeId: primaryStoreId,
      categoryId: categoryPayload.category.id,
      name: "Moedor Dashboard",
      slug: "moedor-dashboard",
      sku: "dash-001",
      priceCents: 21990,
      stockQuantity: 4,
      status: "DRAFT"
    }
  });
  expect(productResponse.ok()).toBeTruthy();
  const productPayload = (await productResponse.json()) as {
    product: { id: string };
  };

  const publishResponse = await request.post(
    `${api}/catalog/${primaryStoreId}/products/${productPayload.product.id}/publish`,
    {
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    }
  );
  expect(publishResponse.ok()).toBeTruthy();

  const shippingResponse = await request.post(`${api}/shipping/methods`, {
    headers: {
      authorization: `Bearer ${ownerToken}`
    },
    data: {
      storeId: primaryStoreId,
      name: "Entrega Dashboard",
      type: "FIXED_PRICE",
      priceCents: 1900,
      estimatedDaysMin: 2,
      estimatedDaysMax: 4,
      minimumOrderCents: 0,
      maximumOrderCents: 100000,
      sortOrder: 1,
      isDefault: true
    }
  });
  const shippingPayload = (await shippingResponse.json()) as {
    message?: string;
    code?: string;
    shippingMethod: { id: string };
  };
  expect(
    shippingResponse.ok(),
    `shipping create failed: ${JSON.stringify(shippingPayload)}`
  ).toBeTruthy();

  const domainResponse = await request.post(`${api}/domains`, {
    headers: {
      authorization: `Bearer ${ownerToken}`
    },
    data: {
      storeId: primaryStoreId,
      host: customDomainHost
    }
  });
  expect(domainResponse.ok()).toBeTruthy();

  const cartResponse = await request.post(`${api}/cart/public/current/items`, {
    headers: {
      host: storefrontHost,
      "x-forwarded-host": storefrontHost
    },
    data: {
      sessionId,
      customerEmail,
      productId: productPayload.product.id,
      quantity: 1
    }
  });
  expect(cartResponse.ok()).toBeTruthy();

  const checkoutResponse = await request.post(`${api}/checkout/public/current/order`, {
    headers: {
      host: storefrontHost,
      "x-forwarded-host": storefrontHost
    },
    data: {
      sessionId,
      customerEmail,
      customerFullName: "Cliente Dashboard",
      customerPhoneNumber: "+55 81 99999-1111",
      shippingMethodId: shippingPayload.shippingMethod.id,
      shippingRecipientName: "Cliente Dashboard",
      shippingPhoneNumber: "+55 81 99999-1111",
      shippingPostalCode: "50000-000",
      shippingState: "PE",
      shippingCity: "Recife",
      shippingDistrict: "Boa Vista",
      shippingStreet: "Rua do Bom Jesus",
      shippingNumber: "50"
    }
  });
  expect(checkoutResponse.ok()).toBeTruthy();

  await page.goto("/");

  await expect(page).toHaveTitle(/dashboard/i);
  await expect(
    page.getByRole("heading", { name: /operacao multi-store com mais clareza/i })
  ).toBeVisible();

  await page.getByLabel("E-mail").fill(merchantEmail);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: /entrar no dashboard/i }).click();

  await expect(page.getByTestId("dashboard-selected-store")).toHaveText(
    "Dashboard Smoke Store A"
  );
  await expect(page.getByRole("heading", { name: /dashboard smoke store a/i }).first()).toBeVisible();

  await page.getByTestId("dashboard-nav-catalog").click();
  await expect(
    page.getByRole("heading", { name: /produtos de dashboard smoke store a/i })
  ).toBeVisible();
  await expect(page.getByText("Moedor Dashboard")).toBeVisible();

  await page.getByTestId("dashboard-nav-orders").click();
  await expect(
    page.getByRole("heading", {
      name: /operacao de pedidos de dashboard smoke store a/i
    })
  ).toBeVisible();
  await page.getByRole("button", { name: /consultar pedidos/i }).click();
  await expect(page.getByText("Cliente Dashboard")).toBeVisible();

  await page.getByTestId("dashboard-nav-domains").click();
  await expect(
    page.getByRole("heading", {
      name: /dominios conectados de dashboard smoke store a/i
    })
  ).toBeVisible();
  await expect(page.getByText(customDomainHost, { exact: true }).first()).toBeVisible();

  await page.getByTestId("dashboard-store-select").selectOption(secondaryStoreId);
  await expect(page.getByTestId("dashboard-selected-store")).toHaveText(
    "Dashboard Smoke Store B"
  );
  await expect(page.getByText("STORE_MANAGER", { exact: true }).first()).toBeVisible();

  await page.getByTestId("dashboard-nav-catalog").click();
  await expect(
    page.getByRole("heading", { name: /produtos de dashboard smoke store b/i })
  ).toBeVisible();
  await expect(
    page.getByText("Ajuste os filtros ou cadastre o primeiro produto para comecar a operar o catalogo.")
  ).toBeVisible();
});
