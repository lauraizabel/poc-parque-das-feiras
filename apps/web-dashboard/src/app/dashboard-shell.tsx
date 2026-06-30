"use client";

import { FormEvent, useState } from "react";
import {
  DashboardLayout,
  type DashboardModuleKey
} from "../components/dashboard-layout";
import {
  DashboardSessionProvider,
  useDashboardSession
} from "../components/dashboard-session";
import { DashboardTopbar } from "../components/dashboard-topbar";
import { MerchantOnboardingForm } from "../components/merchant-onboarding-form";
import { env } from "../lib/env";
import { CatalogConsole } from "./catalog-console";
import { DomainConsole } from "./domain-console";
import { MembersConsole } from "./members-console";
import { OrdersConsole } from "./orders-console";
import { OverviewConsole } from "./overview-console";
import { SettingsConsole } from "./settings-console";
import { StorefrontThemeConsole } from "./storefront-theme-console";

type SectionKey = DashboardModuleKey;

const DASHBOARD_MODULES: Array<{
  key: SectionKey;
  label: string;
  description: string;
  marker: string;
}> = [
  {
    key: "overview",
    label: "Resumo",
    description: "Visao geral da loja atual",
    marker: "RS"
  },
  {
    key: "catalog",
    label: "Catalogo",
    description: "Produtos, categorias e operacao",
    marker: "CT"
  },
  {
    key: "orders",
    label: "Pedidos",
    description: "Operacao e acompanhamento",
    marker: "PD"
  },
  {
    key: "storefront",
    label: "Vitrine",
    description: "Tema, banner e textos",
    marker: "VT"
  },
  {
    key: "domains",
    label: "Dominios",
    description: "Dominio proprio e DNS",
    marker: "DN"
  },
  {
    key: "members",
    label: "Equipe",
    description: "Membros e convites da loja",
    marker: "EQ"
  },
  {
    key: "settings",
    label: "Configuracoes",
    description: "Perfil, frete, dominio e notificacoes",
    marker: "CF"
  }
];

export function DashboardShell() {
  return (
    <DashboardSessionProvider>
      <DashboardExperience />
    </DashboardSessionProvider>
  );
}

function DashboardExperience() {
  const {
    handleLogin,
    handleLogout,
    isLoading,
    refreshContext,
    selectedMembership,
    selectedStoreId,
    setSelectedStoreId,
    state,
    token,
    user
  } = useDashboardSession();
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");

  if (!user || !token) {
    return (
      <LoginDashboard
        isLoading={isLoading}
        onLogin={handleLogin}
        state={state}
      />
    );
  }

  if (user.memberships.length === 0) {
    return (
      <main className="onboarding-setup-shell">
        <header className="onboarding-setup-topbar">
          <div className="dashboard-brand">
            <div className="dashboard-brand-mark">R</div>
            <div>
              <strong>Resumo</strong>
              <span>Setup inicial</span>
            </div>
          </div>
          <nav className="dashboard-action-row">
            <a className="dashboard-action" href={env.NEXT_PUBLIC_API_URL + "/health"}>
              API Health
            </a>
            <button className="dashboard-action" onClick={handleLogout} type="button">
              Sair
            </button>
          </nav>
        </header>

        <section className="onboarding-setup-grid">
          <aside className="onboarding-progress-card">
            <div className="eyebrow">Progresso</div>
            {[
              ["01", "Conta", "done"],
              ["02", "Identidade", "active"],
              ["03", "Operacao", "pending"],
              ["04", "Dominio", "pending"]
            ].map(([step, label, status]) => (
              <div className={`onboarding-step is-${status}`} key={step}>
                <span>{step}</span>
                <strong>{label}</strong>
              </div>
            ))}
          </aside>

          <section className="onboarding-form-panel">
            <div>
              <div className="eyebrow">Primeira operacao</div>
              <h1>Configure sua primeira loja</h1>
              <p>
                Sua conta ja esta autenticada como {user.email}. Crie a primeira loja para liberar
                o dashboard, a vitrine e os modulos operacionais.
              </p>
            </div>
            <MerchantOnboardingForm mode="member" onCreated={() => refreshContext()} token={token} />
          </section>
        </section>
      </main>
    );
  }

  const storefrontHref = "http://localhost:3000";

  return (
    <DashboardLayout
      activeSection={activeSection}
      actions={[
        { kind: "anchor", href: storefrontHref, label: "Storefront" },
        ...(user.platformRole === "PLATFORM_ADMIN"
          ? [{ kind: "anchor" as const, href: "/admin", label: "Admin global" }]
          : []),
        { kind: "anchor", href: env.NEXT_PUBLIC_API_URL + "/health", label: "API Health" },
        { kind: "button", label: "Atualizar", onClick: refreshContext },
        { kind: "button", label: "Sair", onClick: handleLogout }
      ]}
      modules={DASHBOARD_MODULES}
      onSectionChange={setActiveSection}
      onStoreChange={setSelectedStoreId}
      selectedStoreId={selectedStoreId}
      store={{
        name: selectedMembership?.store.name ?? "Sem loja",
        role: selectedMembership?.role ?? "n/a",
        slug: selectedMembership?.store.slug ?? "n/a",
        defaultSubdomain: selectedMembership?.store.defaultSubdomain ?? "n/a",
        currencyCode: selectedMembership?.store.currencyCode ?? "n/a"
      }}
      storeOptions={user.memberships.map((membership) => ({
        storeId: membership.storeId,
        label: membership.store.name,
        role: membership.role
      }))}
      storefrontHref={storefrontHref}
      userEmail={user.email}
      userName={user.fullName ?? user.email}
    >
      {state.kind !== "idle" ? (
        <p className={state.kind === "success" ? "feedback ok" : "feedback error"}>
          {state.message}
        </p>
      ) : null}

      <DashboardSection
        activeSection={activeSection}
        selectedMembership={selectedMembership}
        token={token}
      />
    </DashboardLayout>
  );
}

function LoginDashboard({
  isLoading,
  onLogin,
  state
}: {
  isLoading: boolean;
  onLogin: (email: string, password: string) => Promise<void>;
  state: { kind: "idle" | "success" | "error"; message?: string };
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onLogin(email, password);
  }

  return (
    <main className="shell dashboard-shell">
      <DashboardTopbar
        eyebrow="Dashboard"
        links={[
          { kind: "anchor", href: "http://localhost:3000", label: "Storefront" },
          { kind: "anchor", href: env.NEXT_PUBLIC_API_URL + "/health", label: "API Health" }
        ]}
        meta="Acesso operacional protegido"
        title={env.NEXT_PUBLIC_APP_URL}
      />

      <section className="hero">
        <span className="badge">Merchant control</span>
        <h1 className="title">Operacao multi-store com mais clareza, contexto e seguranca.</h1>
        <p className="subtitle">
          O dashboard autentica o usuario, descobre memberships e abre a operacao apenas para lojas
          permitidas, agora com uma estrutura visual mais orientada a execucao.
        </p>
      </section>

      <section className="card auth-card">
        <div className="domain-head">
          <div>
            <div className="eyebrow">Entrar</div>
            <h2 className="section-title">Acesse o painel do lojista</h2>
          </div>
        </div>

        <form className="domain-form" onSubmit={handleSubmit}>
          <div className="field-grid">
            <label className="field">
              <span>E-mail</span>
              <input
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </label>
            <label className="field">
              <span>Senha</span>
              <input
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
          </div>

          <div className="button-row">
            <button className="primary-button" disabled={isLoading} type="submit">
              {isLoading ? "Entrando..." : "Entrar no dashboard"}
            </button>
            <a className="secondary-button auth-anchor-button" href="/register-merchant">
              Abrir minha loja
            </a>
          </div>
        </form>

        {state.kind !== "idle" ? (
          <p className={state.kind === "success" ? "feedback ok" : "feedback error"}>
            {state.message}
          </p>
        ) : null}
      </section>
    </main>
  );
}

function DashboardSection({
  activeSection,
  selectedMembership,
  token
}: {
  activeSection: SectionKey;
  selectedMembership: ReturnType<typeof useDashboardSession>["selectedMembership"];
  token: string;
}) {
  if (!selectedMembership) {
    return null;
  }

  if (activeSection === "overview") {
    return (
      <OverviewConsole
        currencyCode={selectedMembership.store.currencyCode}
        defaultSubdomain={selectedMembership.store.defaultSubdomain}
        storeId={selectedMembership.storeId}
        storeLabel={selectedMembership.store.name}
        storeRole={selectedMembership.role}
        token={token}
      />
    );
  }

  if (activeSection === "settings") {
    return (
      <SettingsConsole
        storeId={selectedMembership.storeId}
        storeLabel={selectedMembership.store.name}
        storeRole={selectedMembership.role}
        token={token}
      />
    );
  }

  if (activeSection === "catalog") {
    return (
      <CatalogConsole
        storeId={selectedMembership.storeId}
        storeLabel={selectedMembership.store.name}
        token={token}
      />
    );
  }

  if (activeSection === "storefront") {
    return (
      <StorefrontThemeConsole
        storeId={selectedMembership.storeId}
        storeLabel={selectedMembership.store.name}
        token={token}
      />
    );
  }

  if (activeSection === "orders") {
    return (
      <OrdersConsole
        storeId={selectedMembership.storeId}
        storeLabel={selectedMembership.store.name}
        token={token}
      />
    );
  }

  if (activeSection === "domains") {
    return (
      <DomainConsole
        storeId={selectedMembership.storeId}
        storeLabel={selectedMembership.store.name}
        token={token}
      />
    );
  }

  return (
    <MembersConsole
      canManage={selectedMembership.role === "STORE_OWNER"}
      storeId={selectedMembership.storeId}
      storeLabel={selectedMembership.store.name}
      token={token}
    />
  );
}
