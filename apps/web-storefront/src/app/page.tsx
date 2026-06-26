import Link from "next/link";
import { env } from "../lib/env";
import { getStorefrontContext } from "../lib/storefront-context";

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
  const storeTitle = isResolvedStore ? prettyStoreName(storefront.storeSlug) : "Marketplace";

  return (
    <main className="shell">
      <header className="nav">
        <div>
          <div className="eyebrow">Storefront</div>
          <strong>{storeTitle}</strong>
          <div className="host-badge">{storefront.matchedHost}</div>
        </div>
        <nav className="nav-links">
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
            ? `${storeTitle} ja nasce em uma shell publica orientada por host.`
            : "A mesma storefront agora responde lojas diferentes conforme o host."}
        </h1>
        <p className="subtitle">
          {isResolvedStore
            ? `A requisicao foi resolvida para a loja ${storefront.storeSlug}, o que abre caminho para homepage, catalogo, carrinho e checkout sem trocar de app.`
            : storefront.kind === "unknown"
              ? "Esse host ainda nao resolveu uma loja publica. Enquanto isso, o shell mostra um estado neutro e seguro para a vitrine."
              : "Esse host representa a raiz da storefront. O shell agora centraliza a leitura do tenant e prepara o caminho para paginas publicas especificas de cada loja."}
        </p>
      </section>

      <section className="grid">
        {pillars.map((pillar) => (
          <article className="card" key={pillar.title}>
            <h2>{pillar.title}</h2>
            <p>{pillar.body}</p>
          </article>
        ))}
      </section>

      <section className="card" style={{ marginBottom: 64 }}>
        <h2>Estado da resolucao</h2>
        {isResolvedStore ? (
          <>
            <p>
              Loja resolvida com sucesso por <strong>{storefront.source}</strong>. O proximo passo
              natural e plugar homepage, produtos ativos e categorias publicas nesse mesmo shell.
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
            </dl>
          </>
        ) : (
          <>
            <p>
              O shell publico ja sabe diferenciar host raiz, host desconhecido e host de loja.
              Isso prepara a renderizacao multi-tenant sem duplicar app publica.
            </p>
            <Link href="/">Recarregar shell publico</Link>
          </>
        )}
      </section>
    </main>
  );
}
