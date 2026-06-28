import { ReactNode } from "react";
import { env } from "../lib/env";

type AuthPageShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  links?: Array<{ href: string; label: string }>;
};

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
