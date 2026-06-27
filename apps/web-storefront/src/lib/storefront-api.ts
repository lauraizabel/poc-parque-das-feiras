"use client";

export type ClientStore = {
  id: string;
  name: string;
  slug: string;
  currencyCode: string;
  locale: string;
  source: "subdomain" | "custom-domain";
  matchedHost: string;
};

export type ClientCartItem = {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  quantity: number;
  unitPriceCents: number;
  compareAtCents: number | null;
  currencyCode: string;
};

export type ClientCart = {
  id: string;
  storeId: string;
  sessionId: string | null;
  customerEmail: string | null;
  status: string;
  currencyCode: string;
  items: ClientCartItem[];
  summary: {
    itemCount: number;
    subtotalCents: number;
  };
};

export type ClientOrder = {
  id: string;
  storeId: string;
  paymentId: string | null;
  shippingMethodId: string | null;
  status: string;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  customerEmail: string;
  customerFullName: string | null;
  items: Array<{
    id: string;
    productId: string | null;
    productName: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
  }>;
};

export type CustomerOrderAccess = {
  orderId: string;
  token: string;
  path: string;
};

export type ShippingOption = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  priceCents: number;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  isDefault: boolean;
  totalCents: number;
  note: string;
};

export type PaymentIntentResult = {
  provider: string;
  providerPaymentId: string;
  externalReference: string;
  clientSecret: string;
  checkoutUrl: string | null;
  status: string;
};

async function apiRequest<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`/api/storefront/${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {})
    }
  });

  const text = await response.text();
  const payload = text.length > 0 ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    throw payload;
  }

  return payload;
}

export async function createOrLoadCart(input: {
  sessionId: string;
  customerEmail?: string;
}) {
  return apiRequest<{
    store: ClientStore;
    cart: ClientCart;
  }>("cart/public/current", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function addCartItem(input: {
  sessionId: string;
  customerEmail?: string;
  productId: string;
  quantity: number;
}) {
  return apiRequest<{
    store: ClientStore;
    cart: ClientCart;
  }>("cart/public/current/items", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateCartItem(
  cartItemId: string,
  input: {
    sessionId: string;
    customerEmail?: string;
    quantity: number;
  }
) {
  return apiRequest<{
    store: ClientStore;
    cart: ClientCart;
  }>(`cart/public/current/items/${cartItemId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function removeCartItem(
  cartItemId: string,
  input: {
    sessionId: string;
    customerEmail?: string;
  }
) {
  return apiRequest<{
    store: ClientStore;
    cart: ClientCart;
  }>(`cart/public/current/items/${cartItemId}`, {
    method: "DELETE",
    body: JSON.stringify(input)
  });
}

export async function clearCart(input: {
  sessionId: string;
  customerEmail?: string;
}) {
  return apiRequest<{
    store: ClientStore;
    cart: ClientCart;
  }>("cart/public/current/clear", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function createOrderFromCart(input: {
  sessionId?: string;
  customerEmail: string;
  customerFullName: string;
  customerPhoneNumber?: string;
  shippingRecipientName: string;
  shippingPhoneNumber?: string;
  shippingPostalCode: string;
  shippingState: string;
  shippingCity: string;
  shippingDistrict: string;
  shippingStreet: string;
  shippingNumber: string;
  shippingComplement?: string;
  billingRecipientName?: string;
  billingPhoneNumber?: string;
  billingPostalCode?: string;
  billingState?: string;
  billingCity?: string;
  billingDistrict?: string;
  billingStreet?: string;
  billingNumber?: string;
  billingComplement?: string;
  shippingMethodId: string;
  discountCents?: number;
  notes?: string;
}) {
  return apiRequest<{
    store: ClientStore;
    customerAccess: CustomerOrderAccess;
    order: ClientOrder;
  }>("checkout/public/current/order", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function calculateShippingOptions(input: {
  sessionId?: string;
  customerEmail: string;
  shippingPostalCode: string;
  shippingState: string;
  shippingCity: string;
  shippingDistrict?: string;
}) {
  return apiRequest<{
    store: ClientStore;
    cart: {
      id: string;
      currencyCode: string;
      subtotalCents: number;
    };
    shippingOptions: ShippingOption[];
  }>("checkout/public/current/shipping-options", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function createPaymentIntent(
  orderId: string,
  input: {
    sessionId?: string;
    customerEmail: string;
  }
) {
  return apiRequest<{
    store: ClientStore;
    order: ClientOrder;
    payment: {
      id: string;
      status: string;
      attemptCount: number;
    };
    intent: PaymentIntentResult;
  }>(`payments/public/orders/${orderId}/intent`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}
