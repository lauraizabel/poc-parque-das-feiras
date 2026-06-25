import Link from "next/link";
import { env } from "../lib/env";

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

export default function HomePage() {
  return (
    <main className="shell">
      <header className="nav">
        <div>
          <div className="eyebrow">Storefront</div>
          <strong>{env.NEXT_PUBLIC_APP_URL}</strong>
        </div>
        <nav className="nav-links">
          <a href={env.NEXT_PUBLIC_API_URL + "/health"}>API Health</a>
          <a href="http://localhost:3002">Dashboard</a>
        </nav>
      </header>

      <section className="hero">
        <span className="pill">Public commerce surface</span>
        <h1 className="title">Vitrine publica pronta para tenants, dominios e conversao.</h1>
        <p className="subtitle">
          Essa frente separada do dashboard deixa o caminho aberto para middlewares por host,
          SEO da loja, catalogo publico e experiencias de compra sem misturar concerns internos.
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
        <h2>Proximo fluxo natural</h2>
        <p>
          Separar a vitrine do painel nos permite evoluir onboarding, host resolution e dominio
          proprio sem travar a experiencia do lojista.
        </p>
        <Link href="/">Explorar base publica</Link>
      </section>
    </main>
  );
}
