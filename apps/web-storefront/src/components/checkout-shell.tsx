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
  CustomerOrderAccess,
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
  const [success, setSuccess] = useState<{ customerAccess: CustomerOrderAccess; order: ClientOrder } | null>(null);
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
          setError("Nao foi possivel carregar o checkout.");
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
    return <section className="empty-block"><p>Carregando checkout...</p></section>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <section className="empty-block">
        <h1>Nada para finalizar</h1>
        <p>Adicione produtos ao carrinho antes de avancar para a finalizacao.</p>
        <a className="button-primary button-link-inline" href="/catalog">
          Voltar ao catalogo
        </a>
      </section>
    );
  }

  const selectedShippingOption =
    shippingOptions.find((option) => option.id === selectedShippingMethodId) ?? null;
  const totalCents = cart.summary.subtotalCents + (selectedShippingOption?.priceCents ?? 0);

  return (
    <section className="commerce-layout">
      <div className="commerce-main">
        <div className="section-copy">
          <h1>Finalizar compra</h1>
          <p>Contato, entrega, frete e confirmacao no mesmo fluxo.</p>
        </div>

        <form
          className="checkout-form-card"
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

                await createPaymentIntent(orderResponse.order.id, {
                  sessionId,
                  customerEmail: form.customerEmail
                });

                setSuccess({
                  customerAccess: orderResponse.customerAccess,
                  order: orderResponse.order
                });
              } catch (caughtError) {
                setError(
                  typeof caughtError === "object" &&
                    caughtError !== null &&
                    "message" in caughtError &&
                    typeof (caughtError as { message?: unknown }).message === "string"
                    ? (caughtError as { message: string }).message
                    : "Nao foi possivel concluir o checkout."
                );
              }
            });
          }}
        >
          <div className="checkout-section-grid">
            <label className="checkout-field">
              <span>E-mail</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, customerEmail: event.target.value }))}
                required
                type="email"
                value={form.customerEmail}
              />
            </label>
            <label className="checkout-field">
              <span>Nome completo</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, customerFullName: event.target.value }))}
                required
                value={form.customerFullName}
              />
            </label>
            <label className="checkout-field">
              <span>Celular</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, customerPhoneNumber: event.target.value }))}
                value={form.customerPhoneNumber}
              />
            </label>
            <label className="checkout-field">
              <span>Destinatario</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, shippingRecipientName: event.target.value }))}
                required
                value={form.shippingRecipientName}
              />
            </label>
            <label className="checkout-field">
              <span>Telefone de entrega</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, shippingPhoneNumber: event.target.value }))}
                value={form.shippingPhoneNumber}
              />
            </label>
            <label className="checkout-field">
              <span>CEP</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, shippingPostalCode: event.target.value }))}
                required
                value={form.shippingPostalCode}
              />
            </label>
            <label className="checkout-field">
              <span>Estado</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, shippingState: event.target.value }))}
                required
                value={form.shippingState}
              />
            </label>
            <label className="checkout-field">
              <span>Cidade</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, shippingCity: event.target.value }))}
                required
                value={form.shippingCity}
              />
            </label>
            <label className="checkout-field">
              <span>Bairro</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, shippingDistrict: event.target.value }))}
                required
                value={form.shippingDistrict}
              />
            </label>
            <label className="checkout-field">
              <span>Rua</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, shippingStreet: event.target.value }))}
                required
                value={form.shippingStreet}
              />
            </label>
            <label className="checkout-field">
              <span>Numero</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, shippingNumber: event.target.value }))}
                required
                value={form.shippingNumber}
              />
            </label>
            <label className="checkout-field">
              <span>Complemento</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, shippingComplement: event.target.value }))}
                value={form.shippingComplement}
              />
            </label>
          </div>

          <div className="shipping-box">
            <div className="summary-row">
              <strong>Frete</strong>
              <button
                className={`button-secondary button-button ${isShippingPending ? "button-disabled" : ""}`}
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
                      setSelectedShippingMethodId(
                        response.shippingOptions.find((option) => option.isDefault)?.id ??
                          response.shippingOptions[0]?.id ??
                          ""
                      );
                    } catch (caughtError) {
                      setError(
                        typeof caughtError === "object" &&
                          caughtError !== null &&
                          "message" in caughtError &&
                          typeof (caughtError as { message?: unknown }).message === "string"
                          ? (caughtError as { message: string }).message
                          : "Nao foi possivel calcular o frete."
                      );
                    }
                  });
                }}
                type="button"
              >
                {isShippingPending ? "Calculando..." : "Calcular frete"}
              </button>
            </div>

            {shippingOptions.length > 0 ? (
              <label className="checkout-field">
                <span>Opcao de entrega</span>
                <select
                  onChange={(event) => setSelectedShippingMethodId(event.target.value)}
                  required
                  value={selectedShippingMethodId}
                >
                  <option value="">Selecione uma opcao</option>
                  {shippingOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {`${option.name} - ${formatMoney(option.priceCents, cart.currencyCode, store.locale)}`}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="helper-copy">Preencha o endereco principal para liberar as opcoes de frete.</p>
            )}
          </div>

          <button
            className={`button-primary button-button ${isPending ? "button-disabled" : ""}`}
            disabled={isPending || !selectedShippingMethodId}
            type="submit"
          >
            {isPending ? "Processando..." : "Confirmar pedido"}
          </button>

          {error ? <p className="inline-feedback error">{error}</p> : null}
        </form>
      </div>

      <aside className="commerce-side">
        <div className="summary-card">
          <h2>Resumo do pedido</h2>
          <div className="summary-list">
            {cart.items.map((item) => (
              <div className="summary-row" key={item.id}>
                <span>
                  {item.productName}
                  {item.variantName ? ` · ${item.variantName}` : ""} x{item.quantity}
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
          <div className="summary-row summary-row-total">
            <span>Total</span>
            <strong>{formatMoney(totalCents, cart.currencyCode, store.locale)}</strong>
          </div>

          {success ? (
            <div className="success-card">
              <h3>Pedido confirmado</h3>
              <p>Seu pedido foi criado com sucesso e ja pode ser acompanhado pela pagina publica.</p>
              <a className="button-primary button-link-inline" href={success.customerAccess.path}>
                Acompanhar pedido
              </a>
              <p className="helper-copy">Numero do pedido: {success.order.id}</p>
            </div>
          ) : null}
        </div>
      </aside>
    </section>
  );
}
