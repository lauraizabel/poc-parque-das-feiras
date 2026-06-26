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

export async function getStorefrontContext(): Promise<StorefrontContext> {
  const requestHeaders = await headers();
  const matchedHost =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    new URL(env.NEXT_PUBLIC_APP_URL).host;

  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/stores/public/current`, {
    headers: {
      "x-forwarded-host": matchedHost
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return {
      kind: "unknown",
      matchedHost
    };
  }

  const payload = (await response.json()) as {
    store?: {
      storeId: string;
      storeSlug: string;
      source: "subdomain" | "custom-domain";
      matchedHost: string;
    } | null;
  };

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
