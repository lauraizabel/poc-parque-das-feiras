import type { Metadata } from "next";
import { getStorefrontCatalog, getStorefrontContext } from "../../lib/storefront-context";
import { buildStorefrontThemeStyle } from "../../lib/storefront-theme";

type CatalogPageProps = {
  searchParams?: Promise<{
    category?: string | string[];
    page?: string | string[];
  }>;
};

function asSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function formatMoney(valueInCents: number, currencyCode: string, locale = "pt-BR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode
  }).format(valueInCents / 100);
}

function buildCatalogHref(category: string | null, page: number) {
  const search = new URLSearchParams();

  if (category) {
    search.set("category", category);
  }

  if (page > 1) {
    search.set("page", page.toString());
  }

  const query = search.toString();
  return query ? `/catalog?${query}` : "/catalog";
}

export async function generateMetadata({
  searchParams
}: CatalogPageProps): Promise<Metadata> {
  const storefront = await getStorefrontContext();
  const params = (await searchParams) ?? {};
  const category = asSingleValue(params.category);

  if (storefront.kind !== "store") {
    return {
      title: "Catalogo | Acme Storefront"
    };
  }

  const suffix = category ? ` | ${category}` : "";

  return {
    title: `${storefront.storeSlug}${suffix} | Catalogo`,
    description: `Catalogo publico da loja ${storefront.storeSlug}.`
  };
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const storefront = await getStorefrontContext();

  if (storefront.kind !== "store") {
    return (
      <main className="shell">
        <section className="hero">
          <span className="pill">Catalogo indisponivel</span>
          <h1 className="title">Esse host ainda nao resolveu uma loja publica.</h1>
          <p className="subtitle">
            Assim que a resolucao do tenant estiver ativa para esse host, o catalogo publico
            aparece aqui com filtros por categoria.
          </p>
          <a className="button-link" href="/">
            Voltar para a home
          </a>
        </section>
      </main>
    );
  }

  const params = (await searchParams) ?? {};
  const category = asSingleValue(params.category) ?? null;
  const page = parsePage(asSingleValue(params.page));
  const catalog = await getStorefrontCatalog({
    category,
    page,
    pageSize: 12
  });

  if (!catalog) {
    return (
      <main className="shell">
        <section className="hero">
          <span className="pill">Catalogo indisponivel</span>
          <h1 className="title">Nao foi possivel carregar os produtos desta loja.</h1>
          <p className="subtitle">
            A resolucao do tenant funcionou, mas a leitura do catalogo falhou nesta requisicao.
          </p>
        </section>
      </main>
    );
  }

  const hasProducts = catalog.products.length > 0;
  const currentCategory = catalog.categories.find(
    (item) => item.slug === catalog.selectedCategorySlug
  );

  return (
    <main className="shell theme-shell" style={buildStorefrontThemeStyle(catalog.store)}>
      <header className="nav">
        <div>
          <div className="eyebrow">Catalogo</div>
          {catalog.store.theme?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={catalog.store.name} className="store-logo" src={catalog.store.theme.logoUrl} />
          ) : null}
          <strong>{catalog.store.name}</strong>
          <div className="host-badge">{catalog.store.matchedHost}</div>
        </div>
        <nav className="nav-links">
          <a href="/">Home</a>
          <a href="/catalog">Todos os produtos</a>
          <a href="/cart">Carrinho</a>
        </nav>
      </header>

      <section className="hero hero-compact">
        <span className="pill">
          {catalog.pagination.totalItems} produto{catalog.pagination.totalItems === 1 ? "" : "s"}{" "}
          disponiveis
        </span>
        <h1 className="title title-small">
          {currentCategory
            ? `Colecao ${currentCategory.name}`
            : `Catalogo da ${catalog.store.name}`}
        </h1>
        <p className="subtitle">
          Filtros simples por categoria, tenant isolado por host e apenas produtos ativos com
          estoque aparecem publicamente.
        </p>
      </section>

      <section className="filters">
        <a
          className={`filter-chip ${catalog.selectedCategorySlug ? "" : "filter-chip-active"}`}
          href="/catalog"
        >
          Todos
        </a>
        {catalog.categories.map((item) => (
          <a
            className={`filter-chip ${
              catalog.selectedCategorySlug === item.slug ? "filter-chip-active" : ""
            }`}
            href={buildCatalogHref(item.slug, 1)}
            key={item.id}
          >
            {item.name}
          </a>
        ))}
      </section>

      {hasProducts ? (
        <section className="product-grid">
          {catalog.products.map((product) => (
            <article className="product-card" key={product.id}>
              <a className="product-card-link" href={`/catalog/${product.slug}`}>
                <div className="product-image">
                  {product.images[0]?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={product.images[0]?.altText ?? product.name}
                      className="product-image-tag"
                      src={product.images[0].imageUrl}
                    />
                  ) : (
                    <div className="product-image-placeholder">{product.name.slice(0, 1)}</div>
                  )}
                </div>
                <div className="product-copy">
                  <div className="product-meta">
                    <span>{product.category?.name ?? "Sem categoria"}</span>
                    {product.isFeatured ? <span>Destaque</span> : null}
                  </div>
                  <h2>{product.name}</h2>
                  <p>{product.description?.trim() || "Produto publicado e pronto para compra."}</p>
                  <div className="price-row">
                    <strong>
                      {formatMoney(
                        product.priceCents,
                        product.currencyCode,
                        catalog.store.locale
                      )}
                    </strong>
                    {product.compareAtCents ? (
                      <span>
                        {formatMoney(
                          product.compareAtCents,
                          product.currencyCode,
                          catalog.store.locale
                        )}
                      </span>
                    ) : null}
                  </div>
                </div>
              </a>
            </article>
          ))}
        </section>
      ) : (
        <section className="empty-state card">
          <h2>Nenhum produto encontrado</h2>
          <p>
            {catalog.selectedCategorySlug
              ? "Essa categoria ainda nao tem produtos ativos com estoque."
              : "A loja ainda nao publicou produtos para essa vitrine."}
          </p>
        </section>
      )}

      {catalog.pagination.totalPages > 1 ? (
        <nav className="pagination">
          <a
            aria-disabled={catalog.pagination.page <= 1}
            className={`button-link ${catalog.pagination.page <= 1 ? "button-link-disabled" : ""}`}
            href={buildCatalogHref(
              catalog.selectedCategorySlug,
              Math.max(1, catalog.pagination.page - 1)
            )}
          >
            Pagina anterior
          </a>
          <span className="pagination-copy">
            Pagina {catalog.pagination.page} de {catalog.pagination.totalPages}
          </span>
          <a
            aria-disabled={catalog.pagination.page >= catalog.pagination.totalPages}
            className={`button-link ${
              catalog.pagination.page >= catalog.pagination.totalPages
                ? "button-link-disabled"
                : ""
            }`}
            href={buildCatalogHref(
              catalog.selectedCategorySlug,
              Math.min(catalog.pagination.totalPages, catalog.pagination.page + 1)
            )}
          >
            Proxima pagina
          </a>
        </nav>
      ) : null}
    </main>
  );
}
