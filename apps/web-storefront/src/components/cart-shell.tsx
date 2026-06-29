"use client";

import { useEffect, useState, useTransition } from "react";
import { emitCartUpdated, ensureCartSession, getCartSession } from "../lib/cart-session";
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
          setError("Nao foi possivel carregar a sacola desta loja.");
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
    return <section className="empty-block"><p>Carregando sacola...</p></section>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <section className="empty-block">
        <h1>Sua sacola esta vazia</h1>
        <p>Que tal voltar para o catalogo e descobrir novas pecas da colecao?</p>
        <a className="button-primary button-link-inline" href="/catalog">
          Explorar a loja
        </a>
      </section>
    );
  }

  const shippingEstimateCents = cart.summary.subtotalCents >= 19900 ? 0 : 1990;
  const totalCents = cart.summary.subtotalCents + shippingEstimateCents;

  return (
    <section className="commerce-layout">
      <div className="commerce-main">
        <div className="section-copy">
          <h1>Sua sacola</h1>
          <p>{cart.summary.itemCount} itens em uma revisao clara antes do checkout.</p>
        </div>

        <div className="cart-lines">
          {cart.items.map((item) => (
            <article className="cart-line" key={item.id}>
              <div className="cart-line-media">{item.productName.slice(0, 1)}</div>
              <div className="cart-line-copy">
                <div className="cart-line-meta">Produto</div>
                <h2>{item.productName}</h2>
                <p>
                  {item.variantName ? `Tamanho ${item.variantName}` : "Sem variante selecionada"}
                </p>
                <div className="cart-line-actions">
                  <label htmlFor={`qty-${item.id}`}>Qtd.</label>
                  <input
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
                          emitCartUpdated(store.id);
                          setError(null);
                        } catch (caughtError) {
                          setError(
                            typeof caughtError === "object" &&
                              caughtError !== null &&
                              "message" in caughtError &&
                              typeof (caughtError as { message?: unknown }).message === "string"
                              ? (caughtError as { message: string }).message
                              : "Nao foi possivel atualizar o item."
                          );
                        }
                      });
                    }}
                    type="number"
                  />
                  <button
                    className="text-link-button"
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          const sessionId = ensureCartSession(store.id);

                          if (!sessionId) {
                            return;
                          }

                          const response = await removeCartItem(item.id, { sessionId });
                          setCart(response.cart);
                          emitCartUpdated(store.id);
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
                </div>
              </div>
              <div className="cart-line-price">
                {formatMoney(item.unitPriceCents * item.quantity, item.currencyCode, store.locale)}
              </div>
            </article>
          ))}
        </div>
      </div>

      <aside className="commerce-side">
        <div className="summary-card">
          <h2>Resumo</h2>
          <div className="summary-row">
            <span>Subtotal</span>
            <strong>{formatMoney(cart.summary.subtotalCents, cart.currencyCode, store.locale)}</strong>
          </div>
          <div className="summary-row">
            <span>Frete</span>
            <strong>
              {shippingEstimateCents === 0
                ? "Gratis"
                : formatMoney(shippingEstimateCents, cart.currencyCode, store.locale)}
            </strong>
          </div>
          <div className="summary-row summary-row-total">
            <span>Total</span>
            <strong>{formatMoney(totalCents, cart.currencyCode, store.locale)}</strong>
          </div>
          <a className="button-primary button-link-inline" href="/checkout">
            Finalizar compra
          </a>
          <button
            className={`button-secondary button-button ${isPending ? "button-disabled" : ""}`}
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
                  emitCartUpdated(store.id);
                  setError(null);
                } catch {
                  setError("Nao foi possivel limpar a sacola.");
                }
              });
            }}
            type="button"
          >
            Limpar sacola
          </button>
          {error ? <p className="inline-feedback error">{error}</p> : null}
        </div>
      </aside>
    </section>
  );
}
