import { env } from "../lib/env";
import { DomainConsole } from "./domain-console";
import { OrdersConsole } from "./orders-console";

const kpis = [
  { label: "Lojas ativas", value: "18" },
  { label: "MRR", value: "R$ 24k" },
  { label: "Jobs", value: "06" },
  { label: "API", value: "99.98%" }
];

export default function DashboardPage() {
  return (
    <main className="shell" style={{ paddingBottom: 48 }}>
      <header className="nav">
        <div>
          <div className="eyebrow">Dashboard</div>
          <strong>{env.NEXT_PUBLIC_APP_URL}</strong>
        </div>
        <nav className="nav-links">
          <a href="http://localhost:3000">Storefront</a>
          <a href={env.NEXT_PUBLIC_API_URL + "/health"}>API Health</a>
        </nav>
      </header>

      <section className="hero">
        <span className="badge">Operational surface</span>
        <h1 className="title">Painel separado para operar lojas, dominios e integracoes.</h1>
        <p className="subtitle">
          O dashboard agora nasce como app independente da vitrine publica, o que simplifica
          autenticacao, areas protegidas e crescimento do backoffice sem acoplar SEO ou catalogo.
        </p>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Visao rapida</h2>
        <div className="grid">
          {kpis.map((kpi) => (
            <div className="kpi" key={kpi.label}>
              <span>{kpi.label}</span>
              <strong>{kpi.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <DomainConsole />
      <OrdersConsole />
    </main>
  );
}
