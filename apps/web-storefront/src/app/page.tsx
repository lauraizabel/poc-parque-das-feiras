import { StorefrontFooter } from "../components/storefront-footer";
import { StorefrontHeader } from "../components/storefront-header";
import { getStorefrontContext, getStorefrontHomepage } from "../lib/storefront-context";
import { buildStorefrontThemeStyle } from "../lib/storefront-theme";

export const dynamic = "force-dynamic";

function formatMoney(valueInCents: number, currencyCode: string, locale = "pt-BR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode
  }).format(valueInCents / 100);
}

function prettyStoreName(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const defaultBenefits = [
  { title: "Frete inteligente", description: "Calculo simples e checkout sem surpresa." },
  { title: "Compra segura", description: "Pedido, pagamento e acompanhamento integrados." },
  { title: "Curadoria clara", description: "Colecoes, destaques e oferta bem organizados." },
  { title: "Troca facil", description: "Mensagem comercial pronta para inspirar confianca." }
];

export default async function HomePage() {
  const storefront = await getStorefrontContext();
  const isResolvedStore = storefront.kind === "store";
  const homepage = isResolvedStore ? await getStorefrontHomepage() : null;
  const storeTitle = isResolvedStore
    ? homepage?.store.name ?? prettyStoreName(storefront.storeSlug)
    : "Atelie";
  const categories = homepage?.categories.slice(0, 5) ?? [];
  const featuredProducts = homepage?.products.slice(0, 4) ?? [];
  const newArrivals = homepage?.newArrivals.slice(0, 4) ?? [];
  const saleHighlights = homepage?.saleHighlights.slice(0, 1) ?? [];
  const storeId = storefront.kind === "store" ? storefront.storeId : "root";

  return (
    <main className="storefront-page" style={buildStorefrontThemeStyle(homepage?.store)}>
      <StorefrontHeader
        announcementText={homepage?.store.theme?.announcementText}
        logoUrl={homepage?.store.theme?.logoUrl}
        navigation={[
          { href: "/catalog?collection=new", label: "Novidades" },
          { href: "/catalog", label: "Roupas" },
          { href: "/catalog", label: "Acessorios" },
          { href: "/catalog?collection=sale", label: "Sale", emphasis: "primary" }
        ]}
        storeId={homepage?.store.id ?? storeId}
        storeTitle={storeTitle}
      />

      <div className="shell storefront-main">
        <section className="hero-split">
          <div className="hero-copy-card">
            <div className="hero-kicker">Colecao da temporada</div>
            <h1>
              {homepage?.store.theme?.heroTitle ?? "Texturas e pecas-chave para uma vitrine com cara de marca."}
            </h1>
            <p>
              {homepage?.store.theme?.heroSubtitle ??
                "Use a home publica como uma entrada editorial: categorias, destaques, sale e uma rota clara ate a compra."}
            </p>
            <div className="hero-buttons">
              <a className="button-primary button-link-inline" href="/catalog">
                Comprar agora
              </a>
              <a className="button-secondary button-link-inline" href="/catalog?collection=new">
                Ver novidades
              </a>
            </div>
          </div>

          <div className="hero-visual-card">
            {homepage?.store.theme?.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={`Banner da loja ${storeTitle}`}
                className="hero-visual-image"
                src={homepage.store.theme.bannerUrl}
              />
            ) : (
              <div className="hero-placeholder">
                <span>imagem de campanha</span>
              </div>
            )}
          </div>
        </section>

        <section className="section-heading">
          <div>
            <h2>Compre por categoria</h2>
            <p>Rotas diretas para as areas principais do catalogo.</p>
          </div>
          <a href="/catalog">Ver tudo</a>
        </section>

        <section className="category-grid">
          {categories.map((category) => (
            <a className="category-card" href={`/catalog?category=${category.slug}`} key={category.id}>
              <div className="category-card-media" />
              <strong>{category.name}</strong>
              <span>{category.productCount} produtos</span>
            </a>
          ))}
        </section>

        <section className="section-heading">
          <div>
            <h2>Destaques da semana</h2>
            <p>Produtos em foco com preco e CTA na primeira dobra.</p>
          </div>
          <a href="/catalog">Ver catalogo</a>
        </section>

        <section className="product-grid">
          {featuredProducts.map((product) => (
            <article className="product-card" key={product.id}>
              <a href={`/catalog/${product.slug}`}>
                <div className="product-card-image">
                  {product.images[0]?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={product.images[0].altText ?? product.name} src={product.images[0].imageUrl} />
                  ) : (
                    <div className="product-card-placeholder">{product.name.slice(0, 1)}</div>
                  )}
                </div>
                <div className="product-card-meta">{product.category?.name ?? "Colecao"}</div>
                <h3>{product.name}</h3>
                <div className="product-card-price">
                  <strong>
                    {formatMoney(product.priceCents, product.currencyCode, homepage?.store.locale ?? "pt-BR")}
                  </strong>
                  {product.compareAtCents ? (
                    <span>
                      {formatMoney(
                        product.compareAtCents,
                        product.currencyCode,
                        homepage?.store.locale ?? "pt-BR"
                      )}
                    </span>
                  ) : null}
                </div>
              </a>
            </article>
          ))}
        </section>

        {saleHighlights[0] ? (
          <section className="sale-banner">
            <div>
              <span className="sale-banner-kicker">Liquida da estacao</span>
              <h2>Ate ofertas especiais em pecas selecionadas</h2>
              <p>Use os produtos com compare-at para abastecer essa area automaticamente.</p>
            </div>
            <a className="button-secondary button-link-inline" href="/catalog?collection=sale">
              Comprar sale
            </a>
          </section>
        ) : null}

        <section className="section-heading">
          <div>
            <h2>Novidades</h2>
            <p>Uma prateleira pronta para descoberta recorrente.</p>
          </div>
          <a href="/catalog?collection=new">Ver novidades</a>
        </section>

        <section className="product-grid">
          {newArrivals.map((product) => (
            <article className="product-card" key={product.id}>
              <a href={`/catalog/${product.slug}`}>
                <div className="product-card-image">
                  {product.images[0]?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={product.images[0].altText ?? product.name} src={product.images[0].imageUrl} />
                  ) : (
                    <div className="product-card-placeholder">{product.name.slice(0, 1)}</div>
                  )}
                </div>
                <div className="product-card-meta">Novo</div>
                <h3>{product.name}</h3>
                <div className="product-card-price">
                  <strong>
                    {formatMoney(product.priceCents, product.currencyCode, homepage?.store.locale ?? "pt-BR")}
                  </strong>
                </div>
              </a>
            </article>
          ))}
        </section>

        <section className="benefits-grid">
          {defaultBenefits.map((benefit) => (
            <article className="benefit-card" key={benefit.title}>
              <h3>{benefit.title}</h3>
              <p>{benefit.description}</p>
            </article>
          ))}
        </section>
      </div>

      <StorefrontFooter storeTitle={storeTitle} />
    </main>
  );
}
