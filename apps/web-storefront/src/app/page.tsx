import { env } from "../lib/env";
import { getStorefrontContext, getStorefrontHomepage } from "../lib/storefront-context";

const pillars = [
  {
    title: "Tenant-aware storefront",
    body: "Vitrine publica preparada para resolver host, dominio customizado e catalogo por loja."
  },
  {
    title: "Onboarding de lojistas",
    body: "A mesma base suporta fluxos de criacao de loja, subdominio e setup inicial."
  },
  {
    title: "Checkout pronto para crescer",
    body: "O app publico ja conversa com a API modular pensada para carrinho, checkout e pedidos."
  }
];

export const dynamic = "force-dynamic";

function prettyStoreName(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function HomePage() {
  const storefront = await getStorefrontContext();
  const isResolvedStore = storefront.kind === "store";
  const homepage = isResolvedStore ? await getStorefrontHomepage() : null;
  const storeTitle = isResolvedStore
    ? homepage?.store.name ?? prettyStoreName(storefront.storeSlug)
    : "Marketplace";

  return (
    <main className="shell">
      <header className="nav">
        <div>
          <div className="eyebrow">Storefront</div>
          <strong>{storeTitle}</strong>
          <div className="host-badge">{storefront.matchedHost}</div>
        </div>
        <nav className="nav-links">
          {isResolvedStore ? <a href="/catalog">Catalogo</a> : null}
          {isResolvedStore ? <a href="/cart">Carrinho</a> : null}
          <a href={env.NEXT_PUBLIC_API_URL + "/health"}>API Health</a>
          <a href="http://localhost:3002">Dashboard</a>
        </nav>
      </header>

      <section className="hero">
        <span className="pill">
          {isResolvedStore
            ? storefront.source === "custom-domain"
              ? "Dominio proprio ativo"
              : "Subdominio da loja"
            : storefront.kind === "unknown"
              ? "Host sem loja resolvida"
              : "Marketplace root"}
        </span>
        <h1 className="title">
          {isResolvedStore
            ? `${storeTitle} agora responde com homepage publica orientada por host.`
            : "A mesma storefront agora responde lojas diferentes conforme o host."}
        </h1>
        <p className="subtitle">
          {isResolvedStore
            ? `A requisicao foi resolvida para a loja ${storefront.storeSlug}, e a home publica ja mostra identidade, categorias e produtos ativos sem trocar de app.`
            : storefront.kind === "unknown"
              ? "Esse host ainda nao resolveu uma loja publica. Enquanto isso, o shell mostra um estado neutro e seguro para a vitrine."
              : "Esse host representa a raiz da storefront. O shell agora centraliza a leitura do tenant e prepara o caminho para paginas publicas especificas de cada loja."}
        </p>
      </section>

      {isResolvedStore && homepage ? (
        <>
          <section className="section-head">
            <div>
              <div className="eyebrow">Categorias</div>
              <h2 className="section-title">Navegue pela loja</h2>
            </div>
            <a className="button-link" href="/catalog">
              Ver catalogo completo
            </a>
          </section>

          <section className="grid">
            {homepage.categories.length > 0 ? (
              homepage.categories.map((category) => (
                <a className="card category-card" href={`/catalog?category=${category.slug}`} key={category.id}>
                  <h2>{category.name}</h2>
                  <p>{category.description?.trim() || "Colecao publica pronta para filtro."}</p>
                </a>
              ))
            ) : (
              <article className="card">
                <h2>Loja sem categorias</h2>
                <p>O tenant foi resolvido corretamente, mas a loja ainda nao organizou o catalogo.</p>
              </article>
            )}
          </section>

          <section className="section-head">
            <div>
              <div className="eyebrow">Produtos ativos</div>
              <h2 className="section-title">Destaques publicados</h2>
            </div>
          </section>

          {homepage.products.length > 0 ? (
            <section className="product-grid">
              {homepage.products.map((product) => (
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
                      <h3>{product.name}</h3>
                      <p>{product.description?.trim() || "Produto publicado e visivel na vitrine."}</p>
                    </div>
                  </a>
                </article>
              ))}
            </section>
          ) : (
            <section className="card empty-state">
              <h2>Loja sem produtos publicados</h2>
              <p>O tenant ja funciona, e agora o estado vazio da home fica amigavel ate a loja publicar itens.</p>
            </section>
          )}
        </>
      ) : (
        <section className="grid">
          {pillars.map((pillar) => (
            <article className="card" key={pillar.title}>
              <h2>{pillar.title}</h2>
              <p>{pillar.body}</p>
            </article>
          ))}
        </section>
      )}

      <section className="card" style={{ marginBottom: 64 }}>
        <h2>Estado da resolucao</h2>
        {isResolvedStore ? (
          <>
            <p>
              Loja resolvida com sucesso por <strong>{storefront.source}</strong>. A home publica e
              o catalogo ja usam esse contexto para exibir apenas produtos ativos e disponiveis.
            </p>
            <dl className="facts">
              <div>
                <dt>Store ID</dt>
                <dd>{storefront.storeId}</dd>
              </div>
              <div>
                <dt>Slug</dt>
                <dd>{storefront.storeSlug}</dd>
              </div>
              <div>
                <dt>Host</dt>
                <dd>{storefront.matchedHost}</dd>
              </div>
              {homepage ? (
                <div>
                  <dt>Produtos ativos</dt>
                  <dd>{homepage.products.length}</dd>
                </div>
              ) : null}
            </dl>
          </>
        ) : (
          <>
            <p>
              O shell publico ja sabe diferenciar host raiz, host desconhecido e host de loja.
              Isso prepara a renderizacao multi-tenant sem duplicar app publica.
            </p>
            <a href="/">Recarregar shell publico</a>
          </>
        )}
      </section>
    </main>
  );
}
