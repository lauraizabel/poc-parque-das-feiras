const kpis = [
  { label: "MRR", value: "R$ 24k" },
  { label: "Tenants", value: "18" },
  { label: "Filas ativas", value: "06" },
  { label: "Webhooks", value: "99.98%" }
];

export default function PanelPage() {
  return (
    <main className="shell" style={{ paddingBottom: 48 }}>
      <header className="hero">
        <div className="eyebrow">Painel</div>
        <h1 className="title" style={{ maxWidth: "10ch", fontSize: "clamp(2.4rem, 5vw, 4.5rem)" }}>
          Operacao central do seu produto.
        </h1>
        <p className="subtitle">
          O painel e um ponto de partida para billing, tenants, usuarios, dominios,
          storage, jobs e suporte operacional.
        </p>
      </header>

      <section className="card">
        <h2>Visao rapida</h2>
        <div className="kpis">
          {kpis.map((kpi) => (
            <div className="kpi" key={kpi.label}>
              <span>{kpi.label}</span>
              <strong>{kpi.value}</strong>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
