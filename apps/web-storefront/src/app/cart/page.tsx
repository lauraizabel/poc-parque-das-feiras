import type { Metadata } from "next";
import { CartShell } from "../../components/cart-shell";
import { StorefrontFooter } from "../../components/storefront-footer";
import { StorefrontHeader } from "../../components/storefront-header";
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
          <span className="pill">Carrinho indisponível</span>
          <h1 className="title">Seu carrinho aparece aqui quando a loja estiver pronta.</h1>
          <p className="subtitle">Assim que a vitrine for publicada, você poderá revisar seus itens nesta página.</p>
        </section>
      </main>
    );
  }

  const homepage = await getStorefrontHomepage();

  if (!homepage) {
    return (
      <main className="shell">
        <section className="hero">
          <span className="pill">Carrinho indisponível</span>
          <h1 className="title">Não foi possível carregar a loja agora.</h1>
        </section>
      </main>
    );
  }

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
        <CartShell store={homepage.store} />
      </div>
      <StorefrontFooter storeTitle={homepage.store.name} />
    </main>
  );
}
