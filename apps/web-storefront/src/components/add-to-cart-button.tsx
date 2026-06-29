"use client";

import { useState, useTransition } from "react";
import { emitCartUpdated, ensureCartSession } from "../lib/cart-session";
import { addCartItem } from "../lib/storefront-api";

type VariantOption = {
  id: string;
  name: string;
  stockQuantity: number;
  priceCents: number | null;
};

type AddToCartButtonProps = {
  storeId: string;
  productId: string;
  productSlug: string;
  disabled?: boolean;
  variants?: VariantOption[];
};

export function AddToCartButton({
  storeId,
  productId,
  productSlug,
  disabled = false,
  variants = []
}: AddToCartButtonProps) {
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasVariants = variants.length > 0;

  function submitCart(addAndRedirect: boolean) {
    startTransition(async () => {
      try {
        setMessage(null);
        const sessionId = ensureCartSession(storeId);

        if (!sessionId) {
          throw new Error("Nao foi possivel preparar o carrinho agora.");
        }

        if (hasVariants && !selectedVariantId) {
          throw new Error("Selecione um tamanho para continuar.");
        }

        await addCartItem({
          sessionId,
          productId,
          variantId: selectedVariantId || undefined,
          quantity: 1
        });
        emitCartUpdated(storeId);

        if (addAndRedirect) {
          window.location.href = "/checkout";
          return;
        }

        setMessage("Produto adicionado a sacola.");
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
  }

  return (
    <div className="purchase-panel">
      {hasVariants ? (
        <div className="size-picker">
          <div className="size-picker-head">
            <span>Tamanho</span>
            <a href="#guia">Guia de tamanhos</a>
          </div>
          <div className="size-chip-list">
            {variants.map((variant) => {
              const soldOut = variant.stockQuantity <= 0;

              return (
                <button
                  className={`size-chip ${selectedVariantId === variant.id ? "size-chip-active" : ""}`}
                  disabled={soldOut || isPending}
                  key={variant.id}
                  onClick={() => setSelectedVariantId(variant.id)}
                  type="button"
                >
                  {variant.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="purchase-actions">
        <button
          className={`button-primary ${disabled || isPending ? "button-disabled" : ""}`}
          disabled={disabled || isPending}
          onClick={() => submitCart(false)}
          type="button"
        >
          {isPending ? "Adicionando..." : "Adicionar a sacola"}
        </button>
        <button
          className={`button-secondary ${disabled || isPending ? "button-disabled" : ""}`}
          disabled={disabled || isPending}
          onClick={() => submitCart(true)}
          type="button"
        >
          Comprar agora
        </button>
      </div>

      <p className={message ? "inline-feedback success" : "helper-copy"}>
        {message ?? `Pagamento rapido e seguro em /catalog/${productSlug}.`}
      </p>
    </div>
  );
}
