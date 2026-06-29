"use client";

import { useEffect, useState } from "react";
import { CART_UPDATED_EVENT, getCartSession } from "../lib/cart-session";
import { createOrLoadCart } from "../lib/storefront-api";

type StorefrontCartCountProps = {
  storeId: string;
};

export function StorefrontCartCount({ storeId }: StorefrontCartCountProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadCount = () => {
      const sessionId = getCartSession(storeId);

      if (!sessionId) {
        setCount(0);
        return;
      }

      createOrLoadCart({ sessionId })
        .then((response) => {
          if (isMounted) {
            setCount(response.cart.summary.itemCount);
          }
        })
        .catch(() => {
          if (isMounted) {
            setCount(0);
          }
        });
    };

    loadCount();

    const handleCartUpdated = (event: Event) => {
      const nextEvent = event as CustomEvent<{ storeId?: string }>;

      if (nextEvent.detail?.storeId === storeId) {
        loadCount();
      }
    };

    window.addEventListener(CART_UPDATED_EVENT, handleCartUpdated);

    return () => {
      isMounted = false;
      window.removeEventListener(CART_UPDATED_EVENT, handleCartUpdated);
    };
  }, [storeId]);

  return <span className="header-cart-count">{count}</span>;
}
