import type { Metadata } from "next";
import { getStorefrontContext, getStorefrontHomepage, getStorefrontPublicOrder } from "../../../lib/storefront-context";

export const dynamic = "force-dynamic";

function formatMoney(valueInCents: number, currencyCode: string, locale = "pt-BR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode
  }).format(valueInCents / 100);
}

type OrderPageProps = {
  params: Promise<{
    orderId: string;
  }>;
  searchParams: Promise<{
    token?: string;
  }>;
};

export async function generateMetadata({ params }: OrderPageProps): Promise<Metadata> {
  const storefront = await getStorefrontContext();
  const { orderId } = await params;

  return {
    title:
      storefront.kind === "store"
        ? `${storefront.storeSlug} | Pedido ${orderId}`
        : `Pedido ${orderId} | Acme Storefront`
  };
}

export default async function OrderPage({ params, searchParams }: OrderPageProps) {
  const storefront = await getStorefrontContext();
  const { orderId } = await params;
  const { token } = await searchParams;

  if (storefront.kind !== "store") {
    return (
      <main className="shell">
        <section className="hero">
          <span className="pill">Pedido indisponivel</span>
          <h1 className="title">Esse host ainda nao resolveu uma loja publica.</h1>
        </section>
      </main>
    );
  }

  const homepage = await getStorefrontHomepage();

  if (!homepage) {
    return (
      <main className="shell">
        <section className="hero">
          <span className="pill">Pedido indisponivel</span>
          <h1 className="title">Nao foi possivel carregar a loja.</h1>
        </section>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="shell">
        <header className="nav">
          <div>
            <div className="eyebrow">Acompanhar pedido</div>
            <strong>{homepage.store.name}</strong>
            <div className="host-badge">{homepage.store.matchedHost}</div>
          </div>
        </header>
        <section className="card empty-state">
          <h1 className="section-title">Link incompleto</h1>
          <p className="subtitle">Esse pedido precisa do token publico gerado no checkout.</p>
        </section>
      </main>
    );
  }

  const orderPayload = await getStorefrontPublicOrder(orderId, token);

  if (!orderPayload) {
    return (
      <main className="shell">
        <header className="nav">
          <div>
            <div className="eyebrow">Acompanhar pedido</div>
            <strong>{homepage.store.name}</strong>
            <div className="host-badge">{homepage.store.matchedHost}</div>
          </div>
        </header>
        <section className="card empty-state">
          <h1 className="section-title">Pedido nao encontrado</h1>
          <p className="subtitle">Verifique se o link de acompanhamento esta completo e atualizado.</p>
        </section>
      </main>
    );
  }

  const order = orderPayload.order;

  return (
    <main className="shell">
      <header className="nav">
        <div>
          <div className="eyebrow">Acompanhar pedido</div>
          <strong>{homepage.store.name}</strong>
          <div className="host-badge">{homepage.store.matchedHost}</div>
        </div>
        <nav className="nav-links">
          <a href="/">Home</a>
          <a href="/catalog">Catalogo</a>
          <a href="/cart">Carrinho</a>
        </nav>
      </header>

      <section className="checkout-layout">
        <div className="checkout-main">
          <article className="card">
            <div className="eyebrow">Pedido {order.id}</div>
            <h1 className="section-title">Status atual: {order.status}</h1>
            <p className="subtitle">
              {order.customerFullName ?? order.customerEmail} pode acompanhar aqui o pagamento,
              o envio e o resumo da compra sem precisar entrar no painel.
            </p>

            <div className="summary-list">
              {order.items.map((item) => (
                <div className="summary-row" key={item.id}>
                  <span>
                    {item.productName} x{item.quantity}
                  </span>
                  <strong>
                    {formatMoney(item.totalCents, order.currencyCode, homepage.store.locale)}
                  </strong>
                </div>
              ))}
            </div>

            <div className="card inset-card">
              <div className="summary-row">
                <span>Pagamento</span>
                <strong>{order.payment?.status ?? "Aguardando"}</strong>
              </div>
              <div className="summary-row">
                <span>Entrega</span>
                <strong>{order.shipment?.status ?? "PENDENTE"}</strong>
              </div>
              <div className="summary-row">
                <span>Metodo de frete</span>
                <strong>{order.shipment?.shippingMethodName ?? order.shippingMethod?.name ?? "Nao definido"}</strong>
              </div>
              {order.shipment?.trackingCode ? (
                <div className="summary-row">
                  <span>Rastreio</span>
                  <strong>{order.shipment.trackingCode}</strong>
                </div>
              ) : null}
              {order.shipment?.trackingUrl ? (
                <p>
                  <a className="button-link" href={order.shipment.trackingUrl}>
                    Acompanhar rastreio
                  </a>
                </p>
              ) : null}
            </div>
          </article>
        </div>

        <aside className="checkout-side">
          <article className="card summary-card">
            <div className="eyebrow">Resumo</div>
            <div className="summary-row">
              <span>Subtotal</span>
              <strong>{formatMoney(order.subtotalCents, order.currencyCode, homepage.store.locale)}</strong>
            </div>
            <div className="summary-row">
              <span>Frete</span>
              <strong>{formatMoney(order.shippingCents, order.currencyCode, homepage.store.locale)}</strong>
            </div>
            <div className="summary-row">
              <span>Desconto</span>
              <strong>{formatMoney(order.discountCents, order.currencyCode, homepage.store.locale)}</strong>
            </div>
            <div className="summary-row">
              <span>Total</span>
              <strong>{formatMoney(order.totalCents, order.currencyCode, homepage.store.locale)}</strong>
            </div>

            <div className="card inset-card">
              <div className="eyebrow">Endereco de entrega</div>
              <p>
                {order.shippingAddress.recipientName}
                <br />
                {order.shippingAddress.street}, {order.shippingAddress.number}
                {order.shippingAddress.complement ? ` - ${order.shippingAddress.complement}` : ""}
                <br />
                {order.shippingAddress.district} - {order.shippingAddress.city}/{order.shippingAddress.state}
                <br />
                CEP {order.shippingAddress.postalCode}
              </p>
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
