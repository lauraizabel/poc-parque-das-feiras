import { ReactNode } from "react";
import { env } from "../lib/env";

type AuthMetric = {
  value: string;
  label: string;
};

type AuthPageShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  links?: Array<{ href: string; label: string }>;
};

type AuthMarketingPanelProps = {
  align?: "left" | "right";
  eyebrow?: string;
  title?: ReactNode;
  subtitle?: string;
  metrics?: AuthMetric[];
  perks?: string[];
};

type AuthFormLayoutProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  subtitle: string;
  marketing?: AuthMarketingPanelProps;
  reverse?: boolean;
};

const defaultMetrics = [
  { value: "+12%", label: "pedidos / mês" },
  { value: "1.2d", label: "fulfillment médio" },
  { value: "99.9%", label: "uptime" }
];

export function AuthMarketingPanel({
  align = "left",
  eyebrow = "v2.0 · 2026",
  title = (
    <>
      A central de operação
      <br />
      da sua loja digital.
    </>
  ),
  subtitle = "Catálogo, pedidos, domínio, vitrine e equipe em um cockpit pensado para quem opera marca de verdade.",
  metrics = defaultMetrics,
  perks
}: AuthMarketingPanelProps) {
  return (
    <aside className={`auth-marketing-panel auth-marketing-panel-${align}`}>
      <div className="auth-brand">
        <div className="auth-brand-mark">R</div>
        <div>RESUMO / ops console</div>
      </div>

      <div className="auth-marketing-copy">
        <div className="eyebrow auth-muted">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      {perks ? (
        <div className="auth-perk-list">
          {perks.map((perk) => (
            <div className="auth-perk" key={perk}>
              <span aria-hidden="true">✓</span>
              <p>{perk}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="auth-metric-grid">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </div>
        ))}
      </div>

      <div className="auth-system-status">status: all systems operational</div>
    </aside>
  );
}

export function AuthFormLayout({
  children,
  eyebrow,
  title,
  subtitle,
  marketing,
  reverse = false
}: AuthFormLayoutProps) {
  return (
    <main className={`auth-split-shell${reverse ? " is-reverse" : ""}`}>
      <AuthMarketingPanel {...marketing} align={reverse ? "right" : "left"} />
      <section className="auth-form-pane">
        <div className="auth-form-card">
          <div className="auth-mobile-brand">
            <div className="auth-brand-mark">R</div>
            <div>RESUMO / ops console</div>
          </div>
          <div className="auth-form-heading">
            <div className="eyebrow">{eyebrow}</div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}

export function AuthPageShell({
  eyebrow,
  title,
  subtitle,
  children,
  links = []
}: AuthPageShellProps) {
  return (
    <main className="shell dashboard-shell auth-shell">
      <header className="nav">
        <div>
          <div className="eyebrow">Dashboard</div>
          <strong>{env.NEXT_PUBLIC_APP_URL}</strong>
        </div>
        <nav className="nav-links">
          <a href="/">Painel</a>
          <a href={env.NEXT_PUBLIC_API_URL + "/health"}>API Health</a>
          <a href="http://localhost:3000">Storefront</a>
        </nav>
      </header>

      <section className="hero auth-hero">
        <span className="badge">{eyebrow}</span>
        <h1 className="title">{title}</h1>
        <p className="subtitle">{subtitle}</p>
      </section>

      <section className="card auth-card auth-page-card">
        {children}

        {links.length > 0 ? (
          <nav className="auth-link-row">
            {links.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
