"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  DashboardLayout,
  type DashboardModuleKey
} from "../components/dashboard-layout";
import { DashboardTopbar } from "../components/dashboard-topbar";
import { MerchantOnboardingForm } from "../components/merchant-onboarding-form";
import {
  clearDashboardAccessToken,
  readDashboardAccessToken,
  storeDashboardAccessToken
} from "../lib/auth-session";
import { env } from "../lib/env";
import { CatalogConsole } from "./catalog-console";
import { DomainConsole } from "./domain-console";
import { MembersConsole } from "./members-console";
import { OrdersConsole } from "./orders-console";
import { OverviewConsole } from "./overview-console";
import { SettingsConsole } from "./settings-console";
import { StorefrontThemeConsole } from "./storefront-theme-console";

type ApiState = {
  kind: "idle" | "success" | "error";
  message?: string;
};

type DashboardMembership = {
  storeId: string;
  role: string;
  createdAt: string;
  store: {
    id: string;
    name: string;
    slug: string;
    defaultSubdomain: string;
    currencyCode: string;
    locale: string;
    supportEmail: string | null;
  };
};

type DashboardUser = {
  id: string;
  email: string;
  fullName: string | null;
  platformRole: string;
  memberships: DashboardMembership[];
};

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

function normalizeMessage(payload: unknown, fallback: string) {
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const value = (payload as { message?: unknown }).message;

    if (typeof value === "string") {
      return value;
    }
  }

  return fallback;
}

export function DashboardShell() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [state, setState] = useState<ApiState>({ kind: "idle" });
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");
  const [isLoading, setIsLoading] = useState(false);

  const selectedMembership = useMemo(
    () =>
      user?.memberships.find((membership) => membership.storeId === selectedStoreId) ??
      user?.memberships[0] ??
      null,
    [selectedStoreId, user]
  );

  async function bootstrapDashboard(nextToken: string) {
    const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: {
        authorization: `Bearer ${nextToken}`
      }
    });
    const payload = (await response.json()) as DashboardUser | { message?: string };

    if (!response.ok || !("memberships" in payload)) {
      throw new Error(normalizeMessage(payload, "Nao foi possivel carregar o contexto do dashboard."));
    }

    setUser(payload);
    setSelectedStoreId(payload.memberships[0]?.storeId ?? "");
    setActiveSection(payload.memberships.length > 0 ? "overview" : "orders");
    return payload;
  }

  useEffect(() => {
    const storedToken = readDashboardAccessToken();

    if (!storedToken) {
      return;
    }

    setToken(storedToken);
    setIsLoading(true);
    bootstrapDashboard(storedToken)
      .then((me) => {
        setState({
          kind: "success",
          message:
            me.memberships.length > 0
              ? "Sessao restaurada com sucesso."
              : "Login restaurado, mas sem lojas vinculadas."
        });
      })
      .catch((error) => {
        clearDashboardAccessToken();
        setToken("");
        setUser(null);
        setState({
          kind: "error",
          message:
            error instanceof Error ? error.message : "Nao foi possivel restaurar a sessao."
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          email,
          password
        })
      });
      const payload = (await response.json()) as {
        tokens?: { accessToken: string };
        message?: string;
      };

      if (!response.ok || !payload.tokens?.accessToken) {
        setState({
          kind: "error",
          message: normalizeMessage(payload, "Nao foi possivel autenticar o usuario.")
        });
        return;
      }

      setToken(payload.tokens.accessToken);
      storeDashboardAccessToken(payload.tokens.accessToken);
      const me = await bootstrapDashboard(payload.tokens.accessToken);
      setState({
        kind: "success",
        message:
          me.memberships.length > 0
            ? "Dashboard carregado com suas lojas."
            : "Login concluido, mas este usuario ainda nao participa de nenhuma loja."
      });
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Falha de rede ao autenticar o usuario."
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshContext() {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const me = await bootstrapDashboard(token);
      setState({
        kind: "success",
        message:
          me.memberships.length > 0
            ? "Contexto atualizado com sucesso."
            : "Nenhuma loja vinculada a este usuario."
      });
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Falha ao atualizar o contexto do dashboard."
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    if (!token) {
      return;
    }

    setIsLoading(true);

    try {
      await fetch(`${env.NEXT_PUBLIC_API_URL}/auth/logout`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`
        }
      });
    } finally {
      clearDashboardAccessToken();
      setToken("");
      setUser(null);
      setSelectedStoreId("");
      setState({
        kind: "success",
        message: "Sessao encerrada com sucesso."
      });
      setIsLoading(false);
    }
  }

  if (!user || !token) {
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
            O dashboard autentica o usuario, descobre memberships e abre a operacao apenas para
            lojas permitidas, agora com uma estrutura visual mais orientada a execucao.
          </p>
        </section>

        <section className="card auth-card">
          <div className="domain-head">
            <div>
              <div className="eyebrow">Entrar</div>
              <h2 className="section-title">Acesse o painel do lojista</h2>
            </div>
          </div>

          <form className="domain-form" onSubmit={handleLogin}>
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
              <a className="secondary-button auth-anchor-button" href="/register">
                Criar conta
              </a>
              <a className="secondary-button auth-anchor-button" href="/forgot-password">
                Esqueci minha senha
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

  if (user.memberships.length === 0) {
    return (
      <main className="shell dashboard-shell">
        <DashboardTopbar
          eyebrow="Dashboard"
          links={[
            { kind: "anchor", href: "http://localhost:3000", label: "Storefront" },
            { kind: "anchor", href: env.NEXT_PUBLIC_API_URL + "/health", label: "API Health" },
            { kind: "button", label: "Sair", onClick: handleLogout }
          ]}
          meta={user.email}
          title="Onboarding da primeira loja"
        />

        <section className="hero">
          <span className="badge">Primeira operacao</span>
          <h1 className="title">Crie sua primeira loja antes de entrar na operacao.</h1>
          <p className="subtitle">
            Sua conta ja esta autenticada, mas ainda nao possui memberships. Defina o nome da loja,
            valide o slug em tempo real e configure os primeiros dados operacionais para liberar o
            painel.
          </p>
        </section>

        <section className="card auth-card onboarding-card">
          <div>
            <div className="eyebrow">Nova loja</div>
            <h2 className="section-title">Onboarding inicial do lojista</h2>
          </div>
          <MerchantOnboardingForm mode="member" onCreated={() => refreshContext()} token={token} />
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
      selectedStoreId={selectedMembership?.storeId ?? ""}
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

      {activeSection === "overview" ? (
        <OverviewConsole
          currencyCode={selectedMembership?.store.currencyCode ?? "BRL"}
          defaultSubdomain={selectedMembership?.store.defaultSubdomain ?? "loja"}
          storeId={selectedMembership?.storeId ?? ""}
          storeLabel={selectedMembership?.store.name ?? "Sem loja"}
          storeRole={selectedMembership?.role ?? ""}
          token={token}
        />
      ) : null}

      {selectedMembership && activeSection === "settings" ? (
        <SettingsConsole
          storeId={selectedMembership.storeId}
          storeLabel={selectedMembership.store.name}
          storeRole={selectedMembership.role}
          token={token}
        />
      ) : null}

      {selectedMembership && activeSection === "catalog" ? (
        <CatalogConsole
          storeId={selectedMembership.storeId}
          storeLabel={selectedMembership.store.name}
          token={token}
        />
      ) : null}

      {selectedMembership && activeSection === "storefront" ? (
        <StorefrontThemeConsole
          storeId={selectedMembership.storeId}
          storeLabel={selectedMembership.store.name}
          token={token}
        />
      ) : null}

      {selectedMembership && activeSection === "orders" ? (
        <OrdersConsole
          storeId={selectedMembership.storeId}
          storeLabel={selectedMembership.store.name}
          token={token}
        />
      ) : null}

      {selectedMembership && activeSection === "domains" ? (
        <DomainConsole
          storeId={selectedMembership.storeId}
          storeLabel={selectedMembership.store.name}
          token={token}
        />
      ) : null}

      {selectedMembership && activeSection === "members" ? (
        <MembersConsole
          canManage={selectedMembership.role === "STORE_OWNER"}
          storeId={selectedMembership.storeId}
          storeLabel={selectedMembership.store.name}
          token={token}
        />
      ) : null}
    </DashboardLayout>
  );
}
