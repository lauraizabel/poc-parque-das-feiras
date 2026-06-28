"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { env } from "../lib/env";
import {
  clearDashboardAccessToken,
  readDashboardAccessToken,
  storeDashboardAccessToken
} from "../lib/auth-session";
import { MerchantOnboardingForm } from "../components/merchant-onboarding-form";
import { DomainConsole } from "./domain-console";
import { MembersConsole } from "./members-console";
import { OrdersConsole } from "./orders-console";

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

type SectionKey = "overview" | "orders" | "domains" | "members";

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
              ? "Sessão restaurada com sucesso."
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
            error instanceof Error ? error.message : "Não foi possível restaurar a sessão."
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
          error instanceof Error
            ? error.message
            : "Falha de rede ao autenticar o usuario."
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
          error instanceof Error
            ? error.message
            : "Falha ao atualizar o contexto do dashboard."
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
        message: "Sessão encerrada com sucesso."
      });
      setIsLoading(false);
    }
  }

  const navItems: Array<{ key: SectionKey; label: string; description: string }> = [
    {
      key: "overview",
      label: "Resumo",
      description: "Visao geral da loja atual"
    },
    {
      key: "orders",
      label: "Pedidos",
      description: "Operacao e acompanhamento"
    },
    {
      key: "domains",
      label: "Dominios",
      description: "Dominio proprio e DNS"
    },
    {
      key: "members",
      label: "Equipe",
      description: "Membros e convites da loja"
    }
  ];

  if (!user || !token) {
    return (
      <main className="shell dashboard-shell">
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
          <span className="badge">Merchant control</span>
          <h1 className="title">Shell multi-store para operar suas lojas com contexto protegido.</h1>
          <p className="subtitle">
            O dashboard agora autentica o usuario, descobre suas memberships e abre a operacao
            apenas para lojas permitidas.
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
        <header className="nav">
          <div>
            <div className="eyebrow">Dashboard</div>
            <strong>Onboarding da primeira loja</strong>
            <div className="host-badge">{user.email}</div>
          </div>
          <nav className="nav-links">
            <a href="http://localhost:3000">Storefront</a>
            <a href={env.NEXT_PUBLIC_API_URL + "/health"}>API Health</a>
            <button className="link-button" onClick={handleLogout} type="button">
              Sair
            </button>
          </nav>
        </header>

        <section className="hero">
          <span className="badge">Primeira operação</span>
          <h1 className="title">Crie sua primeira loja antes de entrar na operação.</h1>
          <p className="subtitle">
            Sua conta já está autenticada, mas ainda não possui memberships. Defina o nome da
            loja, valide o slug em tempo real e configure os primeiros dados operacionais para
            liberar o painel.
          </p>
        </section>

        <section className="card auth-card onboarding-card">
          <div>
            <div className="eyebrow">Nova loja</div>
            <h2 className="section-title">Onboarding inicial do lojista</h2>
          </div>
          <MerchantOnboardingForm
            mode="member"
            onCreated={() => refreshContext()}
            token={token}
          />
        </section>
      </main>
    );
  }

  return (
    <main className="shell dashboard-shell">
      <header className="nav">
        <div>
          <div className="eyebrow">Dashboard</div>
          <strong>{selectedMembership?.store.name ?? "Sem loja selecionada"}</strong>
          <div className="host-badge">{user.email}</div>
        </div>
        <nav className="nav-links">
          <a href="http://localhost:3000">Storefront</a>
          <a href={env.NEXT_PUBLIC_API_URL + "/health"}>API Health</a>
          <button className="link-button" onClick={refreshContext} type="button">
            Atualizar contexto
          </button>
          <button className="link-button" onClick={handleLogout} type="button">
            Sair
          </button>
        </nav>
      </header>

      <section className="dashboard-frame">
        <aside className="dashboard-sidebar card">
          <div>
            <div className="eyebrow">Conta</div>
            <h2 className="section-title">Painel do lojista</h2>
            <p className="subtitle">
              {user.fullName ?? user.email} acessa apenas as lojas vinculadas nas memberships.
            </p>
          </div>

          <label className="field">
            <span>Loja atual</span>
            <select
              className="field-select"
              onChange={(event) => setSelectedStoreId(event.target.value)}
              value={selectedMembership?.storeId ?? ""}
            >
              {user.memberships.map((membership) => (
                <option key={membership.storeId} value={membership.storeId}>
                  {membership.store.name} • {membership.role}
                </option>
              ))}
            </select>
          </label>

          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <button
                className={activeSection === item.key ? "sidebar-link active" : "sidebar-link"}
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                type="button"
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="dashboard-main">
          <section className="card">
            <div className="eyebrow">Loja selecionada</div>
            <h1 className="section-title">{selectedMembership?.store.name ?? "Sem loja"}</h1>
            <div className="grid">
              <div className="kpi">
                <span>Role atual</span>
                <strong>{selectedMembership?.role ?? "n/a"}</strong>
              </div>
              <div className="kpi">
                <span>Slug</span>
                <strong>{selectedMembership?.store.slug ?? "n/a"}</strong>
              </div>
              <div className="kpi">
                <span>Subdominio</span>
                <strong>{selectedMembership?.store.defaultSubdomain ?? "n/a"}</strong>
              </div>
              <div className="kpi">
                <span>Moeda</span>
                <strong>{selectedMembership?.store.currencyCode ?? "n/a"}</strong>
              </div>
            </div>
          </section>

          {state.kind !== "idle" ? (
            <p className={state.kind === "success" ? "feedback ok" : "feedback error"}>
              {state.message}
            </p>
          ) : null}

          {activeSection === "overview" ? (
            <section className="card">
              <div className="eyebrow">Resumo</div>
              <h2 className="section-title">Base do shell multi-store pronta</h2>
              <p className="subtitle">
                O contexto de loja agora sai das memberships do usuario autenticado, em vez de
                `storeId` manual. Isso prepara troca de loja, protecao de rotas e modulos do
                backoffice sobre a mesma fundacao.
              </p>
            </section>
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
        </section>
      </section>
    </main>
  );
}
