import type { Metadata } from "next";
import { AddToCartButton } from "../../../components/add-to-cart-button";
import { getStorefrontContext, getStorefrontProduct } from "../../../lib/storefront-context";
import { buildStorefrontThemeStyle } from "../../../lib/storefront-theme";

type ProductPageProps = {
  params: Promise<{
    productSlug: string;
  }>;
};

function formatMoney(valueInCents: number, currencyCode: string, locale = "pt-BR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode
  }).format(valueInCents / 100);
}

function buildAvailabilityCopy(status: string, stockQuantity: number) {
  if (status === "OUT_OF_STOCK" || stockQuantity <= 0) {
    return {
      badge: "Sem estoque",
      body: "Esse produto continua visivel na vitrine, mas a compra fica bloqueada ate reposicao."
    };
  }

  return {
    badge: "Disponivel agora",
    body:
      stockQuantity === 1
        ? "Ultima unidade disponivel no momento."
        : `${stockQuantity} unidades disponiveis para compra.`
  };
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const storefront = await getStorefrontContext();
  const { productSlug } = await params;

  if (storefront.kind !== "store") {
    return {
      title: "Produto | Acme Storefront"
    };
  }

  const product = await getStorefrontProduct(productSlug);

  if (!product) {
    return {
      title: `${storefront.storeSlug} | Produto indisponivel`
    };
  }

  return {
    title: `${product.product.name} | ${product.store.name}`,
    description:
      product.product.description?.trim() ||
      `Veja detalhes, fotos e disponibilidade de ${product.product.name}.`
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const storefront = await getStorefrontContext();

  if (storefront.kind !== "store") {
    return (
      <main className="shell">
        <section className="hero">
          <span className="pill">Produto indisponivel</span>
          <h1 className="title">Esse host ainda nao resolveu uma loja publica.</h1>
          <p className="subtitle">
            Quando a vitrine desse tenant estiver ativa, os detalhes do produto aparecem aqui.
          </p>
          <a className="button-link" href="/">
            Voltar para a home
          </a>
        </section>
      </main>
    );
  }

  const { productSlug } = await params;
  const payload = await getStorefrontProduct(productSlug);

  if (!payload) {
    return (
      <main className="shell">
        <section className="hero">
          <span className="pill">Produto indisponivel</span>
          <h1 className="title">Nao encontramos esse produto nesta loja.</h1>
          <p className="subtitle">
            O slug e isolado por tenant e a vitrine publica nao exibe produtos privados ou
            removidos.
          </p>
          <a className="button-link" href="/catalog">
            Voltar para o catalogo
          </a>
        </section>
      </main>
    );
  }

  const { product, store, availability } = payload;
  const availabilityCopy = buildAvailabilityCopy(product.status, product.stockQuantity);
  const primaryImage = product.images[0];

  return (
    <main className="shell theme-shell" style={buildStorefrontThemeStyle(store)}>
      <header className="nav">
        <div>
          <div className="eyebrow">Produto</div>
          {store.theme?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={store.name} className="store-logo" src={store.theme.logoUrl} />
          ) : null}
          <strong>{store.name}</strong>
          <div className="host-badge">{store.matchedHost}</div>
        </div>
        <nav className="nav-links">
          <a href="/">Home</a>
          <a href="/catalog">Catalogo</a>
          <a href="/cart">Carrinho</a>
        </nav>
      </header>

      <section className="product-detail">
        <div className="product-detail-media">
          <div className="product-detail-hero card">
            {primaryImage?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={primaryImage.altText ?? product.name}
                className="product-detail-image"
                src={primaryImage.imageUrl}
              />
            ) : (
              <div className="product-detail-placeholder">{product.name.slice(0, 1)}</div>
            )}
          </div>

          {product.images.length > 1 ? (
            <div className="product-thumb-grid">
              {product.images.slice(1).map((image, index) => (
                <div className="product-thumb card" key={`${image.imageUrl}-${index}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={image.altText ?? `${product.name} ${index + 2}`}
                    className="product-thumb-image"
                    src={image.imageUrl}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <article className="product-detail-copy card">
          <span className={`pill ${availability.canAddToCart ? "" : "pill-muted"}`}>
            {availabilityCopy.badge}
          </span>

          <div>
            <div className="product-meta">
              <span>{product.category?.name ?? "Sem categoria"}</span>
              {product.isFeatured ? <span>Destaque</span> : null}
            </div>
            <h1 className="detail-title">{product.name}</h1>
            <p className="subtitle">
              {product.description?.trim() || "Produto publicado na vitrine com detalhes essenciais."}
            </p>
          </div>

          <div className="price-stack">
            <strong>
              {formatMoney(product.priceCents, product.currencyCode, store.locale)}
            </strong>
            {product.compareAtCents ? (
              <span>
                {formatMoney(product.compareAtCents, product.currencyCode, store.locale)}
              </span>
            ) : null}
          </div>

          <dl className="facts">
            <div>
              <dt>Status</dt>
              <dd>{product.status}</dd>
            </div>
            <div>
              <dt>Estoque</dt>
              <dd>{product.stockQuantity}</dd>
            </div>
            <div>
              <dt>Slug</dt>
              <dd>{product.slug}</dd>
            </div>
          </dl>

          <p className="availability-copy">{availabilityCopy.body}</p>

          <div className="product-actions">
            {availability.canAddToCart ? (
              <AddToCartButton productId={product.id} storeId={store.id} />
            ) : (
              <button className="button-link button-button button-link-disabled" disabled type="button">
                Indisponivel para compra
              </button>
            )}
            <span className="helper-copy">
              {availability.canAddToCart
                ? "Carrinho e checkout ja seguem o contexto da loja atual."
                : "A vitrine bloqueia a compra enquanto esse item estiver indisponivel."}
            </span>
          </div>
        </article>
      </section>
    </main>
  );
}
