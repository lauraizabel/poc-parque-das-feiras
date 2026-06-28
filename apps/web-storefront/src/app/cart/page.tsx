import type { Metadata } from "next";
import { CartShell } from "../../components/cart-shell";
import { getStorefrontContext, getStorefrontHomepage } from "../../lib/storefront-context";
import { buildStorefrontThemeStyle } from "../../lib/storefront-theme";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const storefront = await getStorefrontContext();

  return {
    title:
      storefront.kind === "store"
        ? `${storefront.storeSlug} | Carrinho`
        : "Carrinho | Acme Storefront"
  };
}

export default async function CartPage() {
  const storefront = await getStorefrontContext();

  if (storefront.kind !== "store") {
    return (
      <main className="shell">
        <section className="hero">
          <span className="pill">Carrinho indisponivel</span>
          <h1 className="title">Esse host ainda nao resolveu uma loja publica.</h1>
          <p className="subtitle">Assim que a loja estiver ativa, o carrinho aparece aqui.</p>
        </section>
      </main>
    );
  }

  const homepage = await getStorefrontHomepage();

  if (!homepage) {
    return (
      <main className="shell">
        <section className="hero">
          <span className="pill">Carrinho indisponivel</span>
          <h1 className="title">Nao foi possivel carregar a loja.</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="shell theme-shell" style={buildStorefrontThemeStyle(homepage.store)}>
      <header className="nav">
        <div>
          <div className="eyebrow">Carrinho</div>
          {homepage.store.theme?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={homepage.store.name} className="store-logo" src={homepage.store.theme.logoUrl} />
          ) : null}
          <strong>{homepage.store.name}</strong>
          <div className="host-badge">{homepage.store.matchedHost}</div>
        </div>
        <nav className="nav-links">
          <a href="/">Home</a>
          <a href="/catalog">Catalogo</a>
          <a href="/checkout">Checkout</a>
        </nav>
      </header>
      <CartShell store={homepage.store} />
    </main>
  );
}
