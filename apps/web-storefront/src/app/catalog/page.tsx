import type { Metadata } from "next";
import { StorefrontFooter } from "../../components/storefront-footer";
import { StorefrontHeader } from "../../components/storefront-header";
import { getStorefrontCatalog, getStorefrontContext } from "../../lib/storefront-context";
import { buildStorefrontThemeStyle } from "../../lib/storefront-theme";

type CatalogPageProps = {
  searchParams?: Promise<{
    category?: string | string[];
    collection?: "new" | "sale" | Array<"new" | "sale">;
    page?: string | string[];
    search?: string | string[];
    size?: string | string[];
    sort?: "relevancia" | "menor" | "maior" | "recentes" | Array<"relevancia" | "menor" | "maior" | "recentes">;
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

function buildCatalogHref(input: {
  category?: string | null;
  collection?: "new" | "sale" | null;
  search?: string | null;
  size?: string | null;
  sort?: "relevancia" | "menor" | "maior" | "recentes";
  page?: number;
}) {
  const params = new URLSearchParams();

  if (input.category) {
    params.set("category", input.category);
  }

  if (input.collection) {
    params.set("collection", input.collection);
  }

  if (input.search) {
    params.set("search", input.search);
  }

  if (input.size) {
    params.set("size", input.size);
  }

  if (input.sort && input.sort !== "relevancia") {
    params.set("sort", input.sort);
  }

  if (input.page && input.page > 1) {
    params.set("page", input.page.toString());
  }

  const query = params.toString();
  return query ? `/catalog?${query}` : "/catalog";
}

export async function generateMetadata({ searchParams }: CatalogPageProps): Promise<Metadata> {
  const storefront = await getStorefrontContext();
  const params = (await searchParams) ?? {};
  const category = asSingleValue(params.category);

  if (storefront.kind !== "store") {
    return {
      title: "Catalogo | Acme Storefront"
    };
  }

  return {
    title: `${storefront.storeSlug}${category ? ` | ${category}` : ""} | Catalogo`,
    description: `Catalogo publico da loja ${storefront.storeSlug}.`
  };
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const storefront = await getStorefrontContext();

  if (storefront.kind !== "store") {
    return (
      <main className="shell">
        <section className="empty-block">
          <h1>Catalogo indisponivel</h1>
          <p>Esta vitrine ainda esta sendo preparada.</p>
          <a className="button-primary button-link-inline" href="/">
            Voltar para a loja
          </a>
        </section>
      </main>
    );
  }

  const params = (await searchParams) ?? {};
  const category = asSingleValue(params.category) ?? null;
  const collection = asSingleValue(params.collection) as "new" | "sale" | undefined;
  const search = asSingleValue(params.search) ?? null;
  const size = asSingleValue(params.size) ?? null;
  const sort = (asSingleValue(params.sort) as "relevancia" | "menor" | "maior" | "recentes" | undefined) ?? "relevancia";
  const page = parsePage(asSingleValue(params.page));
  const catalog = await getStorefrontCatalog({
    category,
    collection: collection ?? null,
    search,
    size,
    sort,
    page,
    pageSize: 12
  });

  if (!catalog) {
    return (
      <main className="shell">
        <section className="empty-block">
          <h1>Catalogo indisponivel</h1>
          <p>Nao conseguimos mostrar os produtos agora.</p>
        </section>
      </main>
    );
  }

  const title = catalog.selectedCollection === "sale"
    ? "Sale"
    : catalog.selectedCollection === "new"
      ? "Novidades"
      : catalog.categories.find((item) => item.slug === catalog.selectedCategorySlug)?.name ?? "Catalogo";
  const sizeOptions = Array.from(
    new Set(
      catalog.products.flatMap((product) => product.variants.map((variant) => variant.name))
    )
  );

  return (
    <main className="storefront-page" style={buildStorefrontThemeStyle(catalog.store)}>
      <StorefrontHeader
        announcementText={catalog.store.theme?.announcementText}
        logoUrl={catalog.store.theme?.logoUrl}
        navigation={[
          { href: "/catalog?collection=new", label: "Novidades" },
          { href: "/catalog", label: "Roupas" },
          { href: "/catalog", label: "Acessorios" },
          { href: "/catalog?collection=sale", label: "Sale", emphasis: "primary" }
        ]}
        searchValue={catalog.search}
        storeId={catalog.store.id}
        storeTitle={catalog.store.name}
      />

      <div className="shell storefront-main">
        <section className="catalog-hero">
          <div className="catalog-breadcrumbs">
            <a href="/">Inicio</a>
            <span>/</span>
            <span>{title}</span>
          </div>
          <div className="catalog-heading-row">
            <div>
              <h1>{title}</h1>
              <p>
                {catalog.pagination.totalItems} produtos
                {catalog.search ? ` para "${catalog.search}"` : ""}
              </p>
            </div>
            <form action="/catalog" className="catalog-sort-form">
              {catalog.selectedCategorySlug ? <input name="category" type="hidden" value={catalog.selectedCategorySlug} /> : null}
              {catalog.selectedCollection ? <input name="collection" type="hidden" value={catalog.selectedCollection} /> : null}
              {catalog.search ? <input name="search" type="hidden" value={catalog.search} /> : null}
              {catalog.selectedSize ? <input name="size" type="hidden" value={catalog.selectedSize} /> : null}
              <select defaultValue={catalog.sort} name="sort">
                <option value="relevancia">Relevancia</option>
                <option value="menor">Menor preco</option>
                <option value="maior">Maior preco</option>
                <option value="recentes">Mais recentes</option>
              </select>
              <button className="button-secondary button-button" type="submit">
                Aplicar
              </button>
            </form>
          </div>
        </section>

        <section className="catalog-layout">
          <aside className="catalog-sidebar">
            <div className="catalog-sidebar-group">
              <div className="catalog-sidebar-label">Colecoes</div>
              <a
                className={!catalog.selectedCategorySlug && !catalog.selectedCollection ? "catalog-chip catalog-chip-active" : "catalog-chip"}
                href="/catalog"
              >
                Tudo
              </a>
              <a
                className={catalog.selectedCollection === "new" ? "catalog-chip catalog-chip-active" : "catalog-chip"}
                href={buildCatalogHref({ collection: "new", search: catalog.search, sort: catalog.sort })}
              >
                Novidades
              </a>
              <a
                className={catalog.selectedCollection === "sale" ? "catalog-chip catalog-chip-active" : "catalog-chip"}
                href={buildCatalogHref({ collection: "sale", search: catalog.search, sort: catalog.sort })}
              >
                Sale
              </a>
              {catalog.categories.map((item) => (
                <a
                  className={catalog.selectedCategorySlug === item.slug ? "catalog-chip catalog-chip-active" : "catalog-chip"}
                  href={buildCatalogHref({ category: item.slug, search: catalog.search, sort: catalog.sort })}
                  key={item.id}
                >
                  {item.name}
                </a>
              ))}
            </div>

            {sizeOptions.length > 0 ? (
              <div className="catalog-sidebar-group">
                <div className="catalog-sidebar-label">Tamanho</div>
                <div className="size-filter-list">
                  {sizeOptions.map((option) => (
                    <a
                      className={catalog.selectedSize === option ? "catalog-size-chip catalog-size-chip-active" : "catalog-size-chip"}
                      href={buildCatalogHref({
                        category: catalog.selectedCategorySlug,
                        collection: catalog.selectedCollection,
                        search: catalog.search,
                        sort: catalog.sort,
                        size: catalog.selectedSize === option ? null : option
                      })}
                      key={option}
                    >
                      {option}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>

          <div>
            {catalog.products.length > 0 ? (
              <section className="product-grid">
                {catalog.products.map((product) => (
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
                      <h2>{product.name}</h2>
                      <div className="product-card-price">
                        <strong>{formatMoney(product.priceCents, product.currencyCode, catalog.store.locale)}</strong>
                        {product.compareAtCents ? (
                          <span>{formatMoney(product.compareAtCents, product.currencyCode, catalog.store.locale)}</span>
                        ) : null}
                      </div>
                    </a>
                  </article>
                ))}
              </section>
            ) : (
              <section className="empty-block">
                <h2>Nenhum produto encontrado</h2>
                <p>Refine os filtros ou volte para toda a colecao.</p>
                <a className="button-primary button-link-inline" href="/catalog">
                  Ver todos os produtos
                </a>
              </section>
            )}

            {catalog.pagination.totalPages > 1 ? (
              <nav className="catalog-pagination">
                <a
                  className="button-secondary button-link-inline"
                  href={buildCatalogHref({
                    category: catalog.selectedCategorySlug,
                    collection: catalog.selectedCollection,
                    search: catalog.search,
                    size: catalog.selectedSize,
                    sort: catalog.sort,
                    page: Math.max(1, catalog.pagination.page - 1)
                  })}
                >
                  Pagina anterior
                </a>
                <span>{`Pagina ${catalog.pagination.page} de ${catalog.pagination.totalPages}`}</span>
                <a
                  className="button-secondary button-link-inline"
                  href={buildCatalogHref({
                    category: catalog.selectedCategorySlug,
                    collection: catalog.selectedCollection,
                    search: catalog.search,
                    size: catalog.selectedSize,
                    sort: catalog.sort,
                    page: Math.min(catalog.pagination.totalPages, catalog.pagination.page + 1)
                  })}
                >
                  Proxima pagina
                </a>
              </nav>
            ) : null}
          </div>
        </section>
      </div>

      <StorefrontFooter storeTitle={catalog.store.name} />
    </main>
  );
}
