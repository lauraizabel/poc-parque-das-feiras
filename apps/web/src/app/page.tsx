import Link from "next/link";

const pillars = [
  {
    title: "Frontend publico",
    body: "Landing pages, onboarding e fluxos de conversao com App Router e rotas por tenant."
  },
  {
    title: "Painel operacional",
    body: "Um dashboard pronto para crescer com billing, usuarios, dominios e automacoes."
  },
  {
    title: "Backend modular",
    body: "NestJS separado para API, webhooks, jobs, integracoes e escalabilidade previsivel."
  }
];

export default function HomePage() {
  return (
    <main className="shell">
      <header className="nav">
        <div>
          <div className="eyebrow">Acme Monorepo</div>
          <strong>Next.js + NestJS + Prisma</strong>
        </div>
        <nav className="nav-links">
          <Link href="/panel">Painel</Link>
          <a href="http://localhost:3001/health">API Health</a>
        </nav>
      </header>

      <section className="hero">
        <span className="pill">Multi-tenant ready</span>
        <h1 className="title">Base SaaS pronta para publico, painel e operacao.</h1>
        <p className="subtitle">
          Essa homepage ja nasce acoplada a uma arquitetura pensada para tenants,
          billing, jobs assincromos, dominios customizados e integracoes externas.
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
    </main>
  );
}
