"use client";

import { useEffect, useState, useTransition } from "react";
import { ensureCartSession, getCartSession } from "../lib/cart-session";
import {
  clearCart,
  ClientCart,
  ClientStore,
  createOrLoadCart,
  removeCartItem,
  updateCartItem
} from "../lib/storefront-api";

type CartShellProps = {
  store: ClientStore;
};

function formatMoney(valueInCents: number, currencyCode: string, locale = "pt-BR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode
  }).format(valueInCents / 100);
}

export function CartShell({ store }: CartShellProps) {
  const [cart, setCart] = useState<ClientCart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;
    const sessionId = getCartSession(store.id);

    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    createOrLoadCart({ sessionId })
      .then((response) => {
        if (isMounted) {
          setCart(response.cart);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError("Nao foi possivel carregar o carrinho desta loja.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [store.id]);

  if (isLoading) {
    return <section className="card empty-state"><p>Carregando carrinho...</p></section>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <section className="card empty-state">
        <h2>Carrinho vazio</h2>
        <p>Adicione produtos na vitrine para revisar os itens antes do checkout.</p>
        <a className="button-link" href="/catalog">
          Voltar ao catalogo
        </a>
      </section>
    );
  }

  return (
    <section className="checkout-layout">
      <div className="checkout-main">
        <article className="card">
          <div className="section-head">
            <div>
              <div className="eyebrow">Carrinho</div>
              <h1 className="section-title">Revise seus itens</h1>
            </div>
            <button
              className={`button-link button-button ${isPending ? "button-link-disabled" : ""}`}
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    const sessionId = ensureCartSession(store.id);
                    if (!sessionId) {
                      return;
                    }
                    const response = await clearCart({ sessionId });
                    setCart(response.cart);
                    setError(null);
                  } catch {
                    setError("Nao foi possivel limpar o carrinho.");
                  }
                });
              }}
              type="button"
            >
              Limpar carrinho
            </button>
          </div>

          <div className="cart-list">
            {cart.items.map((item) => (
              <article className="cart-item" key={item.id}>
                <div>
                  <h2>{item.productName}</h2>
                  <p>{item.productSlug}</p>
                </div>
                <div className="cart-item-controls">
                  <label className="field-label" htmlFor={`qty-${item.id}`}>
                    Quantidade
                  </label>
                  <input
                    className="field-input field-input-small"
                    defaultValue={item.quantity}
                    id={`qty-${item.id}`}
                    min={1}
                    onBlur={(event) => {
                      const nextQuantity = Number(event.currentTarget.value);

                      if (!Number.isInteger(nextQuantity) || nextQuantity < 1) {
                        event.currentTarget.value = item.quantity.toString();
                        return;
                      }

                      startTransition(async () => {
                        try {
                          const sessionId = ensureCartSession(store.id);
                          if (!sessionId) {
                            return;
                          }
                          const response = await updateCartItem(item.id, {
                            sessionId,
                            quantity: nextQuantity
                          });
                          setCart(response.cart);
                          setError(null);
                        } catch (caughtError) {
                          const nextMessage =
                            typeof caughtError === "object" &&
                            caughtError !== null &&
                            "message" in caughtError &&
                            typeof (caughtError as { message?: unknown }).message === "string"
                              ? (caughtError as { message: string }).message
                              : "Nao foi possivel atualizar o item.";
                          setError(nextMessage);
                        }
                      });
                    }}
                    type="number"
                  />
                </div>
                <div className="cart-item-price">
                  <strong>
                    {formatMoney(item.unitPriceCents * item.quantity, item.currencyCode, store.locale)}
                  </strong>
                  <span>
                    {formatMoney(item.unitPriceCents, item.currencyCode, store.locale)} por unidade
                  </span>
                </div>
                <button
                  className="text-action"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        const sessionId = ensureCartSession(store.id);
                        if (!sessionId) {
                          return;
                        }
                        const response = await removeCartItem(item.id, { sessionId });
                        setCart(response.cart);
                        setError(null);
                      } catch {
                        setError("Nao foi possivel remover o item.");
                      }
                    });
                  }}
                  type="button"
                >
                  Remover
                </button>
              </article>
            ))}
          </div>
        </article>
      </div>

      <aside className="checkout-side">
        <article className="card summary-card">
          <div className="eyebrow">Resumo</div>
          <h2>Total parcial</h2>
          <strong className="summary-total">
            {formatMoney(cart.summary.subtotalCents, cart.currencyCode, store.locale)}
          </strong>
          <p className="helper-copy">
            {cart.summary.itemCount} item{cart.summary.itemCount === 1 ? "" : "s"} no carrinho da
            loja atual.
          </p>
          <a className="button-link" href="/checkout">
            Ir para checkout
          </a>
          {error ? <p className="error-copy">{error}</p> : null}
        </article>
      </aside>
    </section>
  );
}
