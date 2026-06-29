import type { Metadata } from "next";
import { AddToCartButton } from "../../../components/add-to-cart-button";
import { StorefrontFooter } from "../../../components/storefront-footer";
import { StorefrontHeader } from "../../../components/storefront-header";
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
    return "Este produto segue visivel na vitrine, mas esta indisponivel no momento.";
  }

  return stockQuantity === 1
    ? "Ultima unidade disponivel no momento."
    : `${stockQuantity} unidades disponiveis para compra.`;
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
        <section className="empty-block">
          <h1>Produto indisponivel</h1>
          <p>Esta pagina publica aparece assim que a vitrine for publicada.</p>
          <a className="button-primary button-link-inline" href="/">
            Voltar para a loja
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
        <section className="empty-block">
          <h1>Nao encontramos esse produto</h1>
          <p>Ele pode ter saído de linha ou mudado de colecao.</p>
          <a className="button-primary button-link-inline" href="/catalog">
            Voltar ao catalogo
          </a>
        </section>
      </main>
    );
  }

  const { product, store, availability, relatedProducts } = payload;
  const primaryImage = product.images[0];

  return (
    <main className="storefront-page" style={buildStorefrontThemeStyle(store)}>
      <StorefrontHeader
        announcementText={store.theme?.announcementText}
        logoUrl={store.theme?.logoUrl}
        navigation={[
          { href: "/catalog?collection=new", label: "Novidades" },
          { href: "/catalog", label: "Roupas" },
          { href: "/catalog", label: "Acessorios" },
          { href: "/catalog?collection=sale", label: "Sale", emphasis: "primary" }
        ]}
        storeId={store.id}
        storeTitle={store.name}
      />

      <div className="shell storefront-main">
        <section className="product-breadcrumbs">
          <a href="/">Inicio</a>
          <span>/</span>
          <a href="/catalog">{product.category?.name ?? "Catalogo"}</a>
          <span>/</span>
          <span>{product.name}</span>
        </section>

        <section className="product-detail-layout">
          <div className="product-gallery">
            <div className="product-thumb-column">
              {product.images.slice(0, 3).map((image, index) => (
                <div className="product-thumb" key={`${image.imageUrl}-${index}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={image.altText ?? `${product.name} ${index + 1}`} src={image.imageUrl} />
                </div>
              ))}
            </div>
            <div className="product-hero-image">
              {primaryImage?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={primaryImage.altText ?? product.name} src={primaryImage.imageUrl} />
              ) : (
                <div className="product-card-placeholder">{product.name.slice(0, 1)}</div>
              )}
            </div>
          </div>

          <article className="product-summary-card">
            <div className="product-card-meta">{product.category?.name ?? "Colecao"}</div>
            <h1>{product.name}</h1>
            <div className="product-price-large">
              <strong>{formatMoney(product.priceCents, product.currencyCode, store.locale)}</strong>
              {product.compareAtCents ? (
                <span>{formatMoney(product.compareAtCents, product.currencyCode, store.locale)}</span>
              ) : null}
            </div>
            <p className="product-availability">
              {availability.canAddToCart ? "Disponivel agora" : "Sem estoque"} ·{" "}
              {buildAvailabilityCopy(product.status, product.stockQuantity)}
            </p>
            <p className="product-description">
              {product.description?.trim() ??
                "Modelagem pronta para uma pagina de produto com imagem forte, oferta clara e CTA direto."}
            </p>

            <AddToCartButton
              disabled={!availability.canAddToCart}
              productId={product.id}
              productSlug={product.slug}
              storeId={store.id}
              variants={product.variants.map((variant) => ({
                id: variant.id,
                name: variant.name,
                stockQuantity: variant.stockQuantity,
                priceCents: variant.priceCents
              }))}
            />

            <div className="detail-facts">
              <div>
                <span>Composicao</span>
                <strong>Peca configuravel pela descricao do produto</strong>
              </div>
              <div>
                <span>Entrega</span>
                <strong>Frete calculado no checkout</strong>
              </div>
              <div>
                <span>Trocas</span>
                <strong>Mensagem comercial pronta para politica da loja</strong>
              </div>
            </div>
          </article>
        </section>

        {relatedProducts.length > 0 ? (
          <>
            <section className="section-heading">
              <div>
                <h2>Voce tambem pode gostar</h2>
                <p>Relacionados da mesma colecao para continuar a descoberta.</p>
              </div>
            </section>
            <section className="product-grid">
              {relatedProducts.map((related) => (
                <article className="product-card" key={related.id}>
                  <a href={`/catalog/${related.slug}`}>
                    <div className="product-card-image">
                      {related.images[0]?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt={related.images[0].altText ?? related.name} src={related.images[0].imageUrl} />
                      ) : (
                        <div className="product-card-placeholder">{related.name.slice(0, 1)}</div>
                      )}
                    </div>
                    <div className="product-card-meta">{related.category?.name ?? "Colecao"}</div>
                    <h3>{related.name}</h3>
                    <div className="product-card-price">
                      <strong>{formatMoney(related.priceCents, related.currencyCode, store.locale)}</strong>
                    </div>
                  </a>
                </article>
              ))}
            </section>
          </>
        ) : null}
      </div>

      <StorefrontFooter storeTitle={store.name} />
    </main>
  );
}
