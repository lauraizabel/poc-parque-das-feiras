"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { ensureCartSession, getCartSession } from "../lib/cart-session";
import {
  calculateShippingOptions,
  ClientCart,
  ClientOrder,
  ClientStore,
  createOrLoadCart,
  createOrderFromCart,
  createPaymentIntent,
  PaymentIntentResult,
  ShippingOption
} from "../lib/storefront-api";

type CheckoutShellProps = {
  store: ClientStore;
};

type CheckoutFormState = {
  customerEmail: string;
  customerFullName: string;
  customerPhoneNumber: string;
  shippingRecipientName: string;
  shippingPhoneNumber: string;
  shippingPostalCode: string;
  shippingState: string;
  shippingCity: string;
  shippingDistrict: string;
  shippingStreet: string;
  shippingNumber: string;
  shippingComplement: string;
};

function formatMoney(valueInCents: number, currencyCode: string, locale = "pt-BR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode
  }).format(valueInCents / 100);
}

export function CheckoutShell({ store }: CheckoutShellProps) {
  const [cart, setCart] = useState<ClientCart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    order: ClientOrder;
    intent: PaymentIntentResult;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isShippingPending, startShippingTransition] = useTransition();
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShippingMethodId, setSelectedShippingMethodId] = useState("");
  const [form, setForm] = useState<CheckoutFormState>({
    customerEmail: "",
    customerFullName: "",
    customerPhoneNumber: "",
    shippingRecipientName: "",
    shippingPhoneNumber: "",
    shippingPostalCode: "",
    shippingState: "",
    shippingCity: "",
    shippingDistrict: "",
    shippingStreet: "",
    shippingNumber: "",
    shippingComplement: ""
  });

  useEffect(() => {
    let isMounted = true;
    const sessionId = getCartSession(store.id);

    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    createOrLoadCart({ sessionId })
      .then((response) => {
        if (!isMounted) {
          return;
        }

        setCart(response.cart);
        setForm((current) => ({
          ...current,
          customerEmail: response.cart.customerEmail ?? current.customerEmail
        }));
      })
      .catch(() => {
        if (isMounted) {
          setError("Nao foi possivel carregar o carrinho para checkout.");
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
    return <section className="card empty-state"><p>Carregando checkout...</p></section>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <section className="card empty-state">
        <h2>Nada para finalizar</h2>
        <p>Seu checkout aparece aqui quando houver itens no carrinho da loja atual.</p>
        <a className="button-link" href="/catalog">
          Voltar ao catalogo
        </a>
      </section>
    );
  }

  const selectedShippingOption =
    shippingOptions.find((option) => option.id === selectedShippingMethodId) ?? null;
  const checkoutTotalCents =
    cart.summary.subtotalCents + (selectedShippingOption?.priceCents ?? 0);

  return (
    <section className="checkout-layout">
      <div className="checkout-main">
        <article className="card">
          <div className="eyebrow">Checkout</div>
          <h1 className="section-title">Dados do cliente e entrega</h1>
          <p className="subtitle">
            Finalize o pedido sem sair do contexto da loja. Ao concluir, a vitrine inicia a
            intencao de pagamento e retorna os dados do provider.
          </p>

          <form
            className="checkout-form"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();

              startTransition(async () => {
                try {
                  setError(null);
                  const sessionId = ensureCartSession(store.id) ?? undefined;
                  const orderResponse = await createOrderFromCart({
                    sessionId,
                    customerEmail: form.customerEmail,
                    customerFullName: form.customerFullName,
                    customerPhoneNumber: form.customerPhoneNumber || undefined,
                    shippingMethodId: selectedShippingMethodId,
                    shippingRecipientName: form.shippingRecipientName,
                    shippingPhoneNumber: form.shippingPhoneNumber || undefined,
                    shippingPostalCode: form.shippingPostalCode,
                    shippingState: form.shippingState,
                    shippingCity: form.shippingCity,
                    shippingDistrict: form.shippingDistrict,
                    shippingStreet: form.shippingStreet,
                    shippingNumber: form.shippingNumber,
                    shippingComplement: form.shippingComplement || undefined
                  });

                  const intentResponse = await createPaymentIntent(orderResponse.order.id, {
                    sessionId,
                    customerEmail: form.customerEmail
                  });

                  setSuccess({
                    order: orderResponse.order,
                    intent: intentResponse.intent
                  });
                } catch (caughtError) {
                  const nextMessage =
                    typeof caughtError === "object" &&
                    caughtError !== null &&
                    "message" in caughtError &&
                    typeof (caughtError as { message?: unknown }).message === "string"
                      ? (caughtError as { message: string }).message
                      : "Nao foi possivel concluir o checkout.";
                  setError(nextMessage);
                }
              });
            }}
          >
            <div className="field-grid">
              <label className="field">
                <span className="field-label">E-mail</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, customerEmail: event.target.value }))
                  }
                  required
                  type="email"
                  value={form.customerEmail}
                />
              </label>
              <label className="field">
                <span className="field-label">Nome completo</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, customerFullName: event.target.value }))
                  }
                  required
                  value={form.customerFullName}
                />
              </label>
              <label className="field">
                <span className="field-label">Telefone</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, customerPhoneNumber: event.target.value }))
                  }
                  value={form.customerPhoneNumber}
                />
              </label>
              <label className="field">
                <span className="field-label">Destinatario</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      shippingRecipientName: event.target.value
                    }))
                  }
                  required
                  value={form.shippingRecipientName}
                />
              </label>
              <label className="field">
                <span className="field-label">Telefone de entrega</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      shippingPhoneNumber: event.target.value
                    }))
                  }
                  value={form.shippingPhoneNumber}
                />
              </label>
              <label className="field">
                <span className="field-label">CEP</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, shippingPostalCode: event.target.value }))
                  }
                  required
                  value={form.shippingPostalCode}
                />
              </label>
              <label className="field">
                <span className="field-label">Estado</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, shippingState: event.target.value }))
                  }
                  required
                  value={form.shippingState}
                />
              </label>
              <label className="field">
                <span className="field-label">Cidade</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, shippingCity: event.target.value }))
                  }
                  required
                  value={form.shippingCity}
                />
              </label>
              <label className="field">
                <span className="field-label">Bairro</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, shippingDistrict: event.target.value }))
                  }
                  required
                  value={form.shippingDistrict}
                />
              </label>
              <label className="field">
                <span className="field-label">Rua</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, shippingStreet: event.target.value }))
                  }
                  required
                  value={form.shippingStreet}
                />
              </label>
              <label className="field">
                <span className="field-label">Numero</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, shippingNumber: event.target.value }))
                  }
                  required
                  value={form.shippingNumber}
                />
              </label>
              <label className="field">
                <span className="field-label">Complemento</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      shippingComplement: event.target.value
                    }))
                  }
                  value={form.shippingComplement}
                />
              </label>
            </div>

            <div className="card inset-card">
              <div className="summary-row">
                <strong>Frete</strong>
                <button
                  className={`button-link button-button ${isShippingPending ? "button-link-disabled" : ""}`}
                  disabled={
                    isShippingPending ||
                    !form.customerEmail ||
                    !form.shippingPostalCode ||
                    !form.shippingState ||
                    !form.shippingCity
                  }
                  onClick={() => {
                    startShippingTransition(async () => {
                      try {
                        setError(null);
                        const sessionId = ensureCartSession(store.id) ?? undefined;
                        const response = await calculateShippingOptions({
                          sessionId,
                          customerEmail: form.customerEmail,
                          shippingPostalCode: form.shippingPostalCode,
                          shippingState: form.shippingState,
                          shippingCity: form.shippingCity,
                          shippingDistrict: form.shippingDistrict || undefined
                        });
                        setShippingOptions(response.shippingOptions);

                        const defaultOption =
                          response.shippingOptions.find((option) => option.isDefault) ??
                          response.shippingOptions[0] ??
                          null;

                        setSelectedShippingMethodId(defaultOption?.id ?? "");
                      } catch (caughtError) {
                        const nextMessage =
                          typeof caughtError === "object" &&
                          caughtError !== null &&
                          "message" in caughtError &&
                          typeof (caughtError as { message?: unknown }).message === "string"
                            ? (caughtError as { message: string }).message
                            : "Nao foi possivel calcular o frete.";
                        setError(nextMessage);
                      }
                    });
                  }}
                  type="button"
                >
                  {isShippingPending ? "Calculando..." : "Calcular frete"}
                </button>
              </div>

              {shippingOptions.length > 0 ? (
                <div className="field">
                  <span className="field-label">Opcao de entrega</span>
                  <select
                    className="field-input"
                    onChange={(event) => setSelectedShippingMethodId(event.target.value)}
                    required
                    value={selectedShippingMethodId}
                  >
                    <option value="">Selecione uma opcao</option>
                    {shippingOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name} - {formatMoney(option.priceCents, cart.currencyCode, store.locale)}
                      </option>
                    ))}
                  </select>
                  {selectedShippingOption ? (
                    <p className="subtitle">
                      {selectedShippingOption.note} Prazo estimado:{" "}
                      {selectedShippingOption.estimatedDaysMin ?? 0} a{" "}
                      {selectedShippingOption.estimatedDaysMax ?? 0} dias.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="subtitle">
                  Informe o endereco basico e calcule o frete antes de concluir o pedido.
                </p>
              )}
            </div>

            <button
              className={`button-link button-button ${isPending ? "button-link-disabled" : ""}`}
              disabled={isPending || !selectedShippingMethodId}
              type="submit"
            >
              {isPending ? "Processando..." : "Concluir pedido e iniciar pagamento"}
            </button>

            {error ? <p className="error-copy">{error}</p> : null}
          </form>
        </article>
      </div>

      <aside className="checkout-side">
        <article className="card summary-card">
          <div className="eyebrow">Resumo do pedido</div>
          <div className="summary-list">
            {cart.items.map((item) => (
              <div className="summary-row" key={item.id}>
                <span>
                  {item.productName} x{item.quantity}
                </span>
                <strong>
                  {formatMoney(item.unitPriceCents * item.quantity, item.currencyCode, store.locale)}
                </strong>
              </div>
            ))}
          </div>
          <div className="summary-row">
            <span>Subtotal</span>
            <strong>{formatMoney(cart.summary.subtotalCents, cart.currencyCode, store.locale)}</strong>
          </div>
          <div className="summary-row">
            <span>Frete</span>
            <strong>
              {selectedShippingOption
                ? formatMoney(selectedShippingOption.priceCents, cart.currencyCode, store.locale)
                : "Calcule para ver"}
            </strong>
          </div>
          <div className="summary-row">
            <span>Total estimado</span>
            <strong>{formatMoney(checkoutTotalCents, cart.currencyCode, store.locale)}</strong>
          </div>
          {success ? (
            <div className="success-card">
              <h3>Pagamento iniciado</h3>
              <p>Pedido `{success.order.id}` criado e intent pronta no provider.</p>
              <dl className="facts">
                <div>
                  <dt>Provider</dt>
                  <dd>{success.intent.provider}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{success.intent.status}</dd>
                </div>
                <div>
                  <dt>Client secret</dt>
                  <dd>{success.intent.clientSecret}</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </article>
      </aside>
    </section>
  );
}
