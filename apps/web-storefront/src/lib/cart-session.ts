"use client";

const SESSION_KEY_PREFIX = "acme-storefront-cart-session:";

export function getCartSession(storeId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(`${SESSION_KEY_PREFIX}${storeId}`);
}

export function ensureCartSession(storeId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const key = `${SESSION_KEY_PREFIX}${storeId}`;
  const existing = window.localStorage.getItem(key);

  if (existing) {
    return existing;
  }

  const nextValue = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  window.localStorage.setItem(key, nextValue);
  return nextValue;
}
