import "server-only";

import { headers } from "next/headers";
import { env } from "./env";

export type StorefrontContext =
  | {
      kind: "store";
      matchedHost: string;
      storeId: string;
      storeSlug: string;
      source: "subdomain" | "custom-domain";
    }
  | {
      kind: "root";
      matchedHost: string;
    }
  | {
      kind: "unknown";
      matchedHost: string;
    };

export type PublicStorefrontStore = {
  id: string;
  name: string;
  slug: string;
  currencyCode: string;
  locale: string;
  source: "subdomain" | "custom-domain";
  matchedHost: string;
};

export type PublicStorefrontCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
};

export type PublicStorefrontProduct = {
  id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "ACTIVE" | "OUT_OF_STOCK" | "INACTIVE" | "ARCHIVED";
  description: string | null;
  priceCents: number;
  compareAtCents: number | null;
  currencyCode: string;
  stockQuantity: number;
  isFeatured: boolean;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  images: Array<{
    imageUrl: string;
    altText: string | null;
  }>;
};

export type StorefrontHomepageData = {
  store: PublicStorefrontStore;
  categories: PublicStorefrontCategory[];
  products: PublicStorefrontProduct[];
};

export type StorefrontCatalogData = {
  store: PublicStorefrontStore;
  categories: PublicStorefrontCategory[];
  selectedCategorySlug: string | null;
  products: PublicStorefrontProduct[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export type StorefrontProductData = {
  store: PublicStorefrontStore;
  product: PublicStorefrontProduct;
  availability: {
    canAddToCart: boolean;
    isInStock: boolean;
    status: PublicStorefrontProduct["status"];
  };
};

export type StorefrontPublicOrderData = {
  order: {
    id: string;
    status: string;
    customerEmail: string;
    customerFullName: string | null;
    subtotalCents: number;
    shippingCents: number;
    discountCents: number;
    totalCents: number;
    currencyCode: string;
    payment: {
      status: string;
      amountCents: number;
      paidAt: string | null;
    } | null;
    shippingMethod: {
      id: string;
      name: string;
      type: string;
    } | null;
    shipment: {
      status: string;
      shippingMethodName: string;
      carrierName: string | null;
      serviceName: string | null;
      trackingCode: string | null;
      trackingUrl: string | null;
      estimatedDaysMin: number | null;
      estimatedDaysMax: number | null;
    } | null;
    items: Array<{
      id: string;
      productName: string;
      quantity: number;
      unitPriceCents: number;
      totalCents: number;
    }>;
    shippingAddress: {
      recipientName: string | null;
      postalCode: string | null;
      state: string | null;
      city: string | null;
      district: string | null;
      street: string | null;
      number: string | null;
      complement: string | null;
    };
  };
};

async function getMatchedHost() {
  const requestHeaders = await headers();

  return (
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    new URL(env.NEXT_PUBLIC_APP_URL).host
  );
}

async function fetchStorefrontApi<T>(path: string): Promise<T | null> {
  const matchedHost = await getMatchedHost();
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    headers: {
      "x-forwarded-host": matchedHost
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}

export async function getStorefrontContext(): Promise<StorefrontContext> {
  const matchedHost = await getMatchedHost();
  const payload = await fetchStorefrontApi<{
    store?: {
      storeId: string;
      storeSlug: string;
      source: "subdomain" | "custom-domain";
      matchedHost: string;
    } | null;
  }>("/stores/public/current");

  if (!payload) {
    return {
      kind: "unknown",
      matchedHost
    };
  }

  if (!payload.store) {
    return {
      kind: "root",
      matchedHost
    };
  }

  return {
    kind: "store",
    matchedHost: payload.store.matchedHost,
    storeId: payload.store.storeId,
    storeSlug: payload.store.storeSlug,
    source: payload.store.source
  };
}

export async function getStorefrontHomepage() {
  return fetchStorefrontApi<StorefrontHomepageData>("/catalog/public/home");
}

export async function getStorefrontCatalog(input: {
  category?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const search = new URLSearchParams();

  if (input.category) {
    search.set("category", input.category);
  }

  if (input.page && input.page > 1) {
    search.set("page", input.page.toString());
  }

  if (input.pageSize) {
    search.set("pageSize", input.pageSize.toString());
  }

  const query = search.toString();
  return fetchStorefrontApi<StorefrontCatalogData>(
    `/catalog/public/products${query ? `?${query}` : ""}`
  );
}

export async function getStorefrontProduct(productSlug: string) {
  return fetchStorefrontApi<StorefrontProductData>(
    `/catalog/public/products/${encodeURIComponent(productSlug)}`
  );
}

export async function getStorefrontPublicOrder(orderId: string, token: string) {
  return fetchStorefrontApi<StorefrontPublicOrderData>(
    `/orders/public/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`
  );
}
