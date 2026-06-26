"use client";

import { useState, useTransition } from "react";
import { ensureCartSession } from "../lib/cart-session";
import { addCartItem } from "../lib/storefront-api";

type AddToCartButtonProps = {
  storeId: string;
  productId: string;
  disabled?: boolean;
};

export function AddToCartButton({
  storeId,
  productId,
  disabled = false
}: AddToCartButtonProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="product-actions">
      <button
        className={`button-link button-button ${
          disabled || isPending ? "button-link-disabled" : ""
        }`}
        disabled={disabled || isPending}
        onClick={() => {
          startTransition(async () => {
            try {
              setMessage(null);
              const sessionId = ensureCartSession(storeId);

              if (!sessionId) {
                throw new Error("Nao foi possivel iniciar a sessao do carrinho.");
              }

              await addCartItem({
                sessionId,
                productId,
                quantity: 1
              });

              setMessage("Produto adicionado ao carrinho.");
            } catch (error) {
              const nextMessage =
                typeof error === "object" &&
                error !== null &&
                "message" in error &&
                typeof (error as { message?: unknown }).message === "string"
                  ? (error as { message: string }).message
                  : "Nao foi possivel adicionar o produto ao carrinho.";

              setMessage(nextMessage);
            }
          });
        }}
        type="button"
      >
        {isPending ? "Adicionando..." : "Adicionar ao carrinho"}
      </button>
      <span className="helper-copy">
        {message ?? "Produto vai para um carrinho isolado por loja na sessao atual."}
      </span>
    </div>
  );
}
