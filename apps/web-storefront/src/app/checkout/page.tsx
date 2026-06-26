import type { Metadata } from "next";
import { CheckoutShell } from "../../components/checkout-shell";
import { getStorefrontContext, getStorefrontHomepage } from "../../lib/storefront-context";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const storefront = await getStorefrontContext();

  return {
    title:
      storefront.kind === "store"
        ? `${storefront.storeSlug} | Checkout`
        : "Checkout | Acme Storefront"
  };
}

export default async function CheckoutPage() {
  const storefront = await getStorefrontContext();

  if (storefront.kind !== "store") {
    return (
      <main className="shell">
        <section className="hero">
          <span className="pill">Checkout indisponivel</span>
          <h1 className="title">Esse host ainda nao resolveu uma loja publica.</h1>
          <p className="subtitle">Assim que a loja estiver ativa, o checkout aparece aqui.</p>
        </section>
      </main>
    );
  }

  const homepage = await getStorefrontHomepage();

  if (!homepage) {
    return (
      <main className="shell">
        <section className="hero">
          <span className="pill">Checkout indisponivel</span>
          <h1 className="title">Nao foi possivel carregar a loja.</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="nav">
        <div>
          <div className="eyebrow">Checkout</div>
          <strong>{homepage.store.name}</strong>
          <div className="host-badge">{homepage.store.matchedHost}</div>
        </div>
        <nav className="nav-links">
          <a href="/">Home</a>
          <a href="/catalog">Catalogo</a>
          <a href="/cart">Carrinho</a>
        </nav>
      </header>
      <CheckoutShell store={homepage.store} />
    </main>
  );
}
