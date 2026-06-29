import type { Metadata } from "next";
import { StorefrontFooter } from "../../../components/storefront-footer";
import { StorefrontHeader } from "../../../components/storefront-header";
import { getStorefrontContext, getStorefrontHomepage, getStorefrontPublicOrder } from "../../../lib/storefront-context";
import { buildStorefrontThemeStyle } from "../../../lib/storefront-theme";

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
        <section className="empty-block">
          <h1>Pedido indisponivel</h1>
        </section>
      </main>
    );
  }

  const homepage = await getStorefrontHomepage();

  if (!homepage) {
    return (
      <main className="shell">
        <section className="empty-block">
          <h1>Nao foi possivel carregar a loja agora.</h1>
        </section>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="shell">
        <StorefrontHeader
          navigation={[{ href: "/", label: "Inicio" }, { href: "/catalog", label: "Catalogo" }]}
          storeId={homepage.store.id}
          storeTitle={homepage.store.name}
        />
        <section className="empty-block">
          <h1>Link incompleto</h1>
          <p>Abra o link de acompanhamento completo enviado apos a compra para ver seu pedido.</p>
        </section>
      </main>
    );
  }

  const orderPayload = await getStorefrontPublicOrder(orderId, token);

  if (!orderPayload) {
    return (
      <main className="shell">
        <StorefrontHeader
          navigation={[{ href: "/", label: "Inicio" }, { href: "/catalog", label: "Catalogo" }]}
          storeId={homepage.store.id}
          storeTitle={homepage.store.name}
        />
        <section className="empty-block">
          <h1>Pedido nao encontrado</h1>
          <p>Verifique se o link de acompanhamento esta completo e atualizado.</p>
        </section>
      </main>
    );
  }

  const order = orderPayload.order;

  return (
    <main className="storefront-page" style={buildStorefrontThemeStyle(homepage.store)}>
      <StorefrontHeader
        announcementText={homepage.store.theme?.announcementText}
        logoUrl={homepage.store.theme?.logoUrl}
        navigation={[
          { href: "/catalog?collection=new", label: "Novidades" },
          { href: "/catalog", label: "Roupas" },
          { href: "/catalog", label: "Acessorios" },
          { href: "/catalog?collection=sale", label: "Sale", emphasis: "primary" }
        ]}
        storeId={homepage.store.id}
        storeTitle={homepage.store.name}
      />

      <div className="shell storefront-main">
        <section className="commerce-layout">
          <div className="commerce-main">
            <div className="section-copy">
              <h1>{`Pedido ${order.id}`}</h1>
              <p>{`${order.customerFullName ?? order.customerEmail} pode acompanhar aqui pagamento e entrega.`}</p>
            </div>

            <div className="summary-card">
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
              <div className="summary-row">
                <span>Pagamento</span>
                <strong>{order.payment?.status ?? "Aguardando"}</strong>
              </div>
              <div className="summary-row">
                <span>Entrega</span>
                <strong>{order.shipment?.status ?? "PENDENTE"}</strong>
              </div>
              <div className="summary-row">
                <span>Método de frete</span>
                <strong>{order.shipment?.shippingMethodName ?? order.shippingMethod?.name ?? "A definir"}</strong>
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
          </div>

          <aside className="commerce-side">
            <div className="summary-card">
              <h2>Resumo</h2>
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

              <div className="shipping-box">
                <strong>Endereco de entrega</strong>
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
            </div>
          </aside>
        </section>
      </div>
      <StorefrontFooter storeTitle={homepage.store.name} />
    </main>
  );
}
