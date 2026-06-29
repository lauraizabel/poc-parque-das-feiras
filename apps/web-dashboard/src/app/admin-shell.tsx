"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DashboardTopbar } from "../components/dashboard-topbar";
import { DashboardEmptyState, DashboardFeedback, DashboardLoadingState } from "../components/dashboard-state";
import { clearDashboardAccessToken, readDashboardAccessToken, storeDashboardAccessToken } from "../lib/auth-session";
import { env } from "../lib/env";

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

type AdminSectionKey =
  | "overview"
  | "stores"
  | "users"
  | "orders"
  | "payments"
  | "domains";

type AdminOverview = {
  totals: {
    users: number;
    stores: number;
    orders: number;
    domains: number;
    payments: number;
  };
  storesByStatus: Array<{ status: string; count: number }>;
  ordersByStatus: Array<{ status: string; count: number }>;
  domainsByStatus: Array<{ status: string; count: number }>;
};

type AdminStore = {
  id: string;
  name: string;
  slug: string;
  defaultSubdomain: string;
  status: string;
  currencyCode: string;
  locale: string;
  supportEmail: string | null;
  owner: {
    id: string;
    email: string;
    fullName: string | null;
  };
  activeDomain: {
    id: string;
    host: string;
    status: string;
  } | null;
  membersCount: number;
  ordersCount: number;
  createdAt: string;
};

type AdminStoreDetail = {
  id: string;
  name: string;
  slug: string;
  defaultSubdomain: string;
  status: string;
  supportEmail: string | null;
  currencyCode: string;
  locale: string;
  owner: {
    id: string;
    email: string;
    fullName: string | null;
  };
  counts: {
    members: number;
    pendingInvites: number;
    orders: number;
    payments: number;
    products: number;
  };
  domains: Array<{
    id: string;
    host: string;
    status: string;
    dnsTargetValue: string | null;
    dnsLastCheckedAt: string | null;
    activatedAt: string | null;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

type AdminUserListItem = {
  id: string;
  email: string;
  fullName: string | null;
  platformRole: string;
  ownedStoresCount: number;
  membershipsCount: number;
  memberships: Array<{
    storeId: string;
    role: string;
    store: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
  createdAt: string;
};

type AdminUserDetail = {
  id: string;
  email: string;
  fullName: string | null;
  platformRole: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  memberships: Array<{
    storeId: string;
    role: string;
    createdAt: string;
    store: {
      id: string;
      name: string;
      slug: string;
      status: string;
    };
  }>;
  ownedStores: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    defaultSubdomain: string;
    activeDomain: {
      id: string;
      host: string;
      status: string;
    } | null;
  }>;
};

type AdminOrder = {
  id: string;
  store: { id: string; name: string; slug: string };
  status: string;
  customerEmail: string;
  customerFullName: string | null;
  totalCents: number;
  currencyCode: string;
  shipment: {
    id: string;
    status: string;
    trackingCode: string | null;
  } | null;
  payment: {
    id: string;
    status: string;
    amountCents: number;
    paidAt: string | null;
  } | null;
  itemsCount: number;
  createdAt: string;
};

type AdminOrderDetail = {
  id: string;
  status: string;
  currencyCode: string;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  customerEmail: string;
  customerFullName: string | null;
  customerPhoneNumber: string | null;
  store: { id: string; name: string; slug: string };
  payment: {
    id: string;
    provider: string;
    status: string;
    amountCents: number;
    paidAt: string | null;
  } | null;
  shippingMethod: { id: string; name: string; type: string } | null;
  shipment: {
    id: string;
    status: string;
    carrierName: string | null;
    serviceName: string | null;
    trackingCode: string | null;
    trackingUrl: string | null;
  } | null;
  items: Array<{
    id: string;
    productName: string;
    productSlug: string;
    quantity: number;
    totalCents: number;
  }>;
  createdAt: string;
};

type AdminPayment = {
  id: string;
  store: { id: string; name: string; slug: string };
  customer: { id: string; email: string; fullName: string | null } | null;
  provider: string;
  status: string;
  amountCents: number;
  currencyCode: string;
  attemptCount: number;
  externalPaymentId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  orders: Array<{
    id: string;
    status: string;
    customerEmail: string;
  }>;
  transactionsCount: number;
  createdAt: string;
};

type AdminPaymentDetail = {
  id: string;
  provider: string;
  status: string;
  currencyCode: string;
  amountCents: number;
  attemptCount: number;
  externalPaymentId: string | null;
  externalReference: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  store: { id: string; name: string; slug: string };
  customer: { id: string; email: string; fullName: string | null } | null;
  cart: { id: string; sessionId: string | null; customerEmail: string | null; itemsCount: number } | null;
  orders: Array<{
    id: string;
    status: string;
    customerEmail: string;
    totalCents: number;
    shipment: { id: string; status: string } | null;
  }>;
  transactions: Array<{
    id: string;
    kind: string;
    status: string;
    externalTransactionId: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    occurredAt: string | null;
    createdAt: string;
  }>;
  createdAt: string;
};

type AdminDomain = {
  id: string;
  host: string;
  status: string;
  dnsTargetValue: string | null;
  activatedAt: string | null;
  store: { id: string; name: string; slug: string };
  createdAt: string;
};

function normalizeMessage(payload: unknown, fallback: string) {
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const value = (payload as { message?: unknown }).message;

    if (typeof value === "string") {
      return value;
    }
  }

  return fallback;
}

function formatMoney(valueInCents: number, currencyCode: string, locale = "pt-BR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode
  }).format(valueInCents / 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "n/a";
  }

  return new Date(value).toLocaleString("pt-BR");
}

function formatCompactDate(value: string | null | undefined) {
  if (!value) {
    return "n/a";
  }

  return new Date(value).toLocaleDateString("pt-BR");
}

export function AdminShell() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [state, setState] = useState<ApiState>({ kind: "idle" });
  const [isLoading, setIsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<AdminSectionKey>("overview");

  async function bootstrap(nextToken: string) {
    const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: {
        authorization: `Bearer ${nextToken}`
      }
    });
    const payload = (await response.json()) as DashboardUser | { message?: string };

    if (!response.ok || !("memberships" in payload)) {
      throw new Error(normalizeMessage(payload, "Nao foi possivel carregar o contexto do admin."));
    }

    setUser(payload);
    return payload;
  }

  useEffect(() => {
    const storedToken = readDashboardAccessToken();

    if (!storedToken) {
      return;
    }

    setToken(storedToken);
    setIsLoading(true);
    bootstrap(storedToken)
      .then(() => {
        setState({
          kind: "success",
          message: "Sessão administrativa restaurada com sucesso."
        });
      })
      .catch((error) => {
        clearDashboardAccessToken();
        setToken("");
        setUser(null);
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "Não foi possível restaurar a sessão."
        });
      })
      .finally(() => setIsLoading(false));
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
          message: normalizeMessage(payload, "Nao foi possivel autenticar a conta admin.")
        });
        return;
      }

      setToken(payload.tokens.accessToken);
      storeDashboardAccessToken(payload.tokens.accessToken);
      const me = await bootstrap(payload.tokens.accessToken);
      setState({
        kind: "success",
        message:
          me.platformRole === "PLATFORM_ADMIN"
            ? "Área administrativa carregada."
            : "Sessão válida, mas sem permissão de admin global."
      });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha de rede ao autenticar."
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
      const me = await bootstrap(token);
      setState({
        kind: "success",
        message:
          me.platformRole === "PLATFORM_ADMIN"
            ? "Contexto administrativo atualizado."
            : "A conta autenticada não possui acesso admin."
      });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha ao atualizar o contexto admin."
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    if (token) {
      try {
        await fetch(`${env.NEXT_PUBLIC_API_URL}/auth/logout`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`
          }
        });
      } catch {}
    }

    clearDashboardAccessToken();
    setToken("");
    setUser(null);
    setState({
      kind: "success",
      message: "Sessão encerrada com sucesso."
    });
  }

  const navItems: Array<{ key: AdminSectionKey; label: string; description: string }> = [
    { key: "overview", label: "Pulso", description: "Totais e sinais da plataforma" },
    { key: "stores", label: "Lojas", description: "Estado operacional das lojas" },
    { key: "users", label: "Usuários", description: "Vínculos, roles e ownership" },
    { key: "orders", label: "Pedidos", description: "Investigação cross-tenant" },
    { key: "payments", label: "Pagamentos", description: "Falhas, attempts e captura" },
    { key: "domains", label: "Domínios", description: "Hosts, DNS e ativação" }
  ];

  if (!user || !token) {
    return (
      <main className="shell dashboard-shell">
        <DashboardTopbar
          eyebrow="Admin Global"
          links={[
            { kind: "anchor", href: "/", label: "Dashboard" },
            { kind: "anchor", href: env.NEXT_PUBLIC_API_URL + "/health", label: "API Health" }
          ]}
          meta="Área restrita da plataforma"
          title={env.NEXT_PUBLIC_APP_URL}
        />

        <section className="hero">
          <span className="badge">Platform ops</span>
          <h1 className="title">Console operacional da plataforma em uma área separada.</h1>
          <p className="subtitle">
            Use esta rota para acompanhar lojas, usuários, pedidos, pagamentos e domínios sem
            misturar o contexto global com a operação de cada lojista.
          </p>
        </section>

        <section className="card auth-card">
          <div className="domain-head">
            <div>
              <div className="eyebrow">Entrar</div>
              <h2 className="section-title">Acesse o admin global</h2>
            </div>
          </div>

          <form className="domain-form" onSubmit={handleLogin}>
            <div className="field-grid">
              <label className="field">
                <span>E-mail</span>
                <input onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
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
                {isLoading ? "Entrando..." : "Entrar no admin"}
              </button>
              <a className="secondary-button auth-anchor-button" href="/">
                Voltar ao dashboard
              </a>
            </div>
          </form>

          <DashboardFeedback state={state} />
        </section>
      </main>
    );
  }

  if (user.platformRole !== "PLATFORM_ADMIN") {
    return (
      <main className="shell dashboard-shell">
        <DashboardTopbar
          eyebrow="Admin Global"
          links={[
            { kind: "anchor", href: "/", label: "Dashboard" },
            { kind: "button", label: "Sair", onClick: handleLogout }
          ]}
          meta={user.email}
          title="Acesso restrito"
        />

        <section className="card">
          <div className="eyebrow">Permissão</div>
          <h1 className="section-title">Sua conta não possui acesso ao admin global.</h1>
          <p className="subtitle">
            A área administrativa da plataforma é exclusiva para usuários com role
            <strong> PLATFORM_ADMIN</strong>. Continue pelo painel do lojista ou encerre a sessão.
          </p>
          <div className="button-row">
            <a className="primary-button auth-anchor-button" href="/">
              Ir para o dashboard
            </a>
            <button className="secondary-button" onClick={handleLogout} type="button">
              Sair
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell dashboard-shell">
      <DashboardTopbar
        eyebrow="Admin Global"
        links={[
          { kind: "anchor", href: "/", label: "Dashboard" },
          { kind: "anchor", href: env.NEXT_PUBLIC_API_URL + "/health", label: "API Health" },
          { kind: "button", label: "Atualizar contexto", onClick: refreshContext },
          { kind: "button", label: "Sair", onClick: handleLogout }
        ]}
        meta={user.fullName ?? user.email}
        title="Operação da plataforma"
      />

      <section className="dashboard-frame">
        <aside className="dashboard-sidebar card">
          <div>
            <div className="eyebrow">Controle global</div>
            <h2 className="section-title">Painel administrativo</h2>
            <p className="subtitle">
              Acompanhe tenants, usuários e sinais operacionais sem sair do dashboard web.
            </p>
          </div>

          <div className="admin-context-grid">
            <div className="kpi">
              <span>Role</span>
              <strong>{user.platformRole}</strong>
            </div>
            <div className="kpi">
              <span>Memberships</span>
              <strong>{user.memberships.length}</strong>
            </div>
          </div>

          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <button
                className={activeSection === item.key ? "sidebar-link active" : "sidebar-link"}
                data-testid={`admin-nav-${item.key}`}
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
          {state.kind !== "idle" ? <DashboardFeedback state={state} /> : null}

          {activeSection === "overview" ? <AdminOverviewConsole token={token} /> : null}
          {activeSection === "stores" ? <AdminStoresConsole token={token} /> : null}
          {activeSection === "users" ? <AdminUsersConsole token={token} /> : null}
          {activeSection === "orders" ? <AdminOrdersConsole token={token} /> : null}
          {activeSection === "payments" ? <AdminPaymentsConsole token={token} /> : null}
          {activeSection === "domains" ? <AdminDomainsConsole token={token} /> : null}
        </section>
      </section>
    </main>
  );
}

function AdminOverviewConsole({ token }: { token: string }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [state, setState] = useState<ApiState>({ kind: "idle" });
  const [isLoading, setIsLoading] = useState(false);

  async function loadOverview() {
    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/admin/overview`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as AdminOverview | { message?: string };

      if (!response.ok || !("totals" in payload)) {
        throw new Error(normalizeMessage(payload, "Nao foi possivel carregar o pulso da plataforma."));
      }

      setOverview(payload);
      setState({
        kind: "success",
        message: "Pulso global atualizado com sucesso."
      });
    } catch (error) {
      setOverview(null);
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha de rede ao carregar o overview."
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, [token]);

  if (isLoading && !overview) {
    return <DashboardLoadingState label="Sincronizando visão global da plataforma" />;
  }

  if (!overview) {
    return (
      <section className="card">
        <div className="eyebrow">Pulso</div>
        <h2 className="section-title">Visão global da plataforma</h2>
        <DashboardFeedback state={state} />
      </section>
    );
  }

  return (
    <section className="admin-stack">
      <section className="card">
        <div className="domain-head">
          <div>
            <div className="eyebrow">Pulso</div>
            <h2 className="section-title">Visão global da plataforma</h2>
          </div>
          <button className="secondary-button" onClick={loadOverview} type="button">
            {isLoading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        <div className="grid">
          <div className="kpi">
            <span>Usuários</span>
            <strong>{overview.totals.users}</strong>
          </div>
          <div className="kpi">
            <span>Lojas</span>
            <strong>{overview.totals.stores}</strong>
          </div>
          <div className="kpi">
            <span>Pedidos</span>
            <strong>{overview.totals.orders}</strong>
          </div>
          <div className="kpi">
            <span>Pagamentos</span>
            <strong>{overview.totals.payments}</strong>
          </div>
          <div className="kpi">
            <span>Domínios</span>
            <strong>{overview.totals.domains}</strong>
          </div>
        </div>

        <DashboardFeedback state={state} />
      </section>

      <section className="grid admin-grid-3">
        <AdminStatusCard title="Lojas por status" items={overview.storesByStatus} />
        <AdminStatusCard title="Pedidos por status" items={overview.ordersByStatus} />
        <AdminStatusCard title="Domínios por status" items={overview.domainsByStatus} />
      </section>
    </section>
  );
}

function AdminStatusCard({
  title,
  items
}: {
  title: string;
  items: Array<{ status: string; count: number }>;
}) {
  return (
    <section className="card admin-status-card">
      <div className="eyebrow">Distribuição</div>
      <h3>{title}</h3>
      <div className="admin-list">
        {items.map((item) => (
          <div className="admin-list-row" key={item.status}>
            <span>{item.status}</span>
            <strong>{item.count}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function AdminStoresConsole({ token }: { token: string }) {
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [selectedStore, setSelectedStore] = useState<AdminStoreDetail | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeDomainFilter, setActiveDomainFilter] = useState("");
  const [state, setState] = useState<ApiState>({ kind: "idle" });
  const [isLoading, setIsLoading] = useState(false);

  async function loadStores() {
    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (activeDomainFilter) params.set("hasActiveDomain", activeDomainFilter);

      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/admin/stores?${params.toString()}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as { stores?: AdminStore[]; message?: string };

      if (!response.ok || !payload.stores) {
        throw new Error(normalizeMessage(payload, "Nao foi possivel carregar as lojas."));
      }

      setStores(payload.stores);
      setState({
        kind: "success",
        message:
          payload.stores.length > 0
            ? "Lojas carregadas com sucesso."
            : "Nenhuma loja encontrada para o filtro atual."
      });
    } catch (error) {
      setStores([]);
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha de rede ao consultar as lojas."
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadStoreDetail(storeId: string) {
    setState({ kind: "idle" });

    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/admin/stores/${storeId}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as { store?: AdminStoreDetail; message?: string };

      if (!response.ok || !payload.store) {
        throw new Error(normalizeMessage(payload, "Nao foi possivel carregar os detalhes da loja."));
      }

      setSelectedStore(payload.store);
      setState({
        kind: "success",
        message: `Detalhes de ${payload.store.name} carregados.`
      });
    } catch (error) {
      setSelectedStore(null);
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha ao abrir detalhes da loja."
      });
    }
  }

  useEffect(() => {
    void loadStores();
  }, [token]);

  return (
    <section className="admin-stack">
      <section className="card">
        <div className="domain-head">
          <div>
            <div className="eyebrow">Lojas</div>
            <h2 className="section-title">Estado operacional das lojas</h2>
          </div>
          <button className="secondary-button" onClick={loadStores} type="button">
            {isLoading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        <form
          className="domain-form"
          onSubmit={(event) => {
            event.preventDefault();
            void loadStores();
          }}
        >
          <div className="field-grid">
            <label className="field">
              <span>Busca</span>
              <input
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome, slug, domínio ou owner"
                value={search}
              />
            </label>
            <label className="field">
              <span>Status</span>
              <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                <option value="">Todos</option>
                <option value="TRIALING">TRIALING</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="PAST_DUE">PAST_DUE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </label>
            <label className="field">
              <span>Domínio ativo</span>
              <select
                onChange={(event) => setActiveDomainFilter(event.target.value)}
                value={activeDomainFilter}
              >
                <option value="">Qualquer</option>
                <option value="true">Com domínio ativo</option>
                <option value="false">Sem domínio ativo</option>
              </select>
            </label>
          </div>
          <div className="button-row">
            <button className="primary-button" type="submit">
              Aplicar filtros
            </button>
          </div>
        </form>

        <DashboardFeedback state={state} />

        {isLoading && stores.length === 0 ? (
          <DashboardLoadingState label="Carregando lojas da plataforma" />
        ) : stores.length === 0 ? (
          <DashboardEmptyState
            description="Ajuste os filtros ou aguarde novas lojas entrarem em operação."
            title="Nenhuma loja encontrada"
          />
        ) : (
          <div className="admin-table-card">
            <div className="admin-table">
              {stores.map((store) => (
                <button
                  className="admin-table-row admin-table-row-button"
                  key={store.id}
                  onClick={() => void loadStoreDetail(store.id)}
                  type="button"
                >
                  <span>
                    <strong>{store.name}</strong>
                    <small>{store.slug}</small>
                  </span>
                  <span>{store.status}</span>
                  <span>{store.owner.email}</span>
                  <span>{store.activeDomain?.host ?? "Sem domínio ativo"}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {selectedStore ? (
        <section className="card">
          <div className="eyebrow">Detalhe</div>
          <h3>{selectedStore.name}</h3>
          <div className="grid">
            <div className="kpi">
              <span>Status</span>
              <strong>{selectedStore.status}</strong>
            </div>
            <div className="kpi">
              <span>Owner</span>
              <strong>{selectedStore.owner.email}</strong>
            </div>
            <div className="kpi">
              <span>Pedidos</span>
              <strong>{selectedStore.counts.orders}</strong>
            </div>
            <div className="kpi">
              <span>Pagamentos</span>
              <strong>{selectedStore.counts.payments}</strong>
            </div>
          </div>

          <div className="admin-detail-grid">
            <section className="admin-subcard">
              <div className="eyebrow">Contexto</div>
              <p>Slug: {selectedStore.slug}</p>
              <p>Subdomínio: {selectedStore.defaultSubdomain}</p>
              <p>Moeda: {selectedStore.currencyCode}</p>
              <p>Locale: {selectedStore.locale}</p>
              <p>Criada em: {formatDate(selectedStore.createdAt)}</p>
            </section>

            <section className="admin-subcard">
              <div className="eyebrow">Domínios</div>
              {selectedStore.domains.length === 0 ? (
                <p>Sem domínios cadastrados.</p>
              ) : (
                selectedStore.domains.map((domain) => (
                  <div className="admin-inline-item" key={domain.id}>
                    <strong>{domain.host}</strong>
                    <span>{domain.status}</span>
                  </div>
                ))
              )}
            </section>
          </div>
        </section>
      ) : null}
    </section>
  );
}

function AdminUsersConsole({ token }: { token: string }) {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [state, setState] = useState<ApiState>({ kind: "idle" });
  const [isLoading, setIsLoading] = useState(false);

  async function loadUsers() {
    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (roleFilter) params.set("platformRole", roleFilter);

      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/admin/users?${params.toString()}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as { users?: AdminUserListItem[]; message?: string };

      if (!response.ok || !payload.users) {
        throw new Error(normalizeMessage(payload, "Nao foi possivel carregar os usuários."));
      }

      setUsers(payload.users);
      setState({
        kind: "success",
        message:
          payload.users.length > 0
            ? "Usuários carregados com sucesso."
            : "Nenhum usuário encontrado para o filtro atual."
      });
    } catch (error) {
      setUsers([]);
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha ao consultar os usuários."
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadUserDetail(userId: string) {
    setState({ kind: "idle" });

    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/admin/users/${userId}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as { user?: AdminUserDetail; message?: string };

      if (!response.ok || !payload.user) {
        throw new Error(normalizeMessage(payload, "Nao foi possivel carregar o detalhe do usuário."));
      }

      setSelectedUser(payload.user);
      setState({
        kind: "success",
        message: `Detalhes de ${payload.user.email} carregados.`
      });
    } catch (error) {
      setSelectedUser(null);
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha ao abrir o detalhe do usuário."
      });
    }
  }

  useEffect(() => {
    void loadUsers();
  }, [token]);

  return (
    <section className="admin-stack">
      <section className="card">
        <div className="domain-head">
          <div>
            <div className="eyebrow">Usuários</div>
            <h2 className="section-title">Vínculos, ownership e memberships</h2>
          </div>
          <button className="secondary-button" onClick={loadUsers} type="button">
            {isLoading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        <form
          className="domain-form"
          onSubmit={(event) => {
            event.preventDefault();
            void loadUsers();
          }}
        >
          <div className="field-grid">
            <label className="field">
              <span>Busca</span>
              <input
                onChange={(event) => setSearch(event.target.value)}
                placeholder="E-mail ou nome"
                value={search}
              />
            </label>
            <label className="field">
              <span>Role global</span>
              <select onChange={(event) => setRoleFilter(event.target.value)} value={roleFilter}>
                <option value="">Todas</option>
                <option value="PLATFORM_ADMIN">PLATFORM_ADMIN</option>
                <option value="CUSTOMER">CUSTOMER</option>
              </select>
            </label>
          </div>
          <div className="button-row">
            <button className="primary-button" type="submit">
              Aplicar filtros
            </button>
          </div>
        </form>

        <DashboardFeedback state={state} />

        {isLoading && users.length === 0 ? (
          <DashboardLoadingState label="Carregando usuários da plataforma" />
        ) : users.length === 0 ? (
          <DashboardEmptyState
            description="Ajuste os filtros ou aguarde novos usuários entrarem na plataforma."
            title="Nenhum usuário encontrado"
          />
        ) : (
          <div className="admin-table-card">
            <div className="admin-table">
              {users.map((user) => (
                <button
                  className="admin-table-row admin-table-row-button"
                  key={user.id}
                  onClick={() => void loadUserDetail(user.id)}
                  type="button"
                >
                  <span>
                    <strong>{user.fullName ?? user.email}</strong>
                    <small>{user.email}</small>
                  </span>
                  <span>{user.platformRole}</span>
                  <span>{user.ownedStoresCount} lojas</span>
                  <span>{user.membershipsCount} memberships</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {selectedUser ? (
        <section className="card">
          <div className="eyebrow">Detalhe</div>
          <h3>{selectedUser.fullName ?? selectedUser.email}</h3>
          <div className="grid">
            <div className="kpi">
              <span>Role global</span>
              <strong>{selectedUser.platformRole}</strong>
            </div>
            <div className="kpi">
              <span>Memberships</span>
              <strong>{selectedUser.memberships.length}</strong>
            </div>
            <div className="kpi">
              <span>Lojas próprias</span>
              <strong>{selectedUser.ownedStores.length}</strong>
            </div>
          </div>

          <div className="admin-detail-grid">
            <section className="admin-subcard">
              <div className="eyebrow">Memberships</div>
              {selectedUser.memberships.map((membership) => (
                <div className="admin-inline-item" key={`${membership.storeId}-${membership.role}`}>
                  <strong>{membership.store.slug}</strong>
                  <span>{membership.role}</span>
                </div>
              ))}
            </section>
            <section className="admin-subcard">
              <div className="eyebrow">Lojas próprias</div>
              {selectedUser.ownedStores.map((store) => (
                <div className="admin-inline-item" key={store.id}>
                  <strong>{store.slug}</strong>
                  <span>{store.status}</span>
                </div>
              ))}
            </section>
          </div>
        </section>
      ) : null}
    </section>
  );
}

function AdminOrdersConsole({ token }: { token: string }) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [state, setState] = useState<ApiState>({ kind: "idle" });
  const [isLoading, setIsLoading] = useState(false);

  async function loadOrders() {
    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (customerEmail.trim()) params.set("customerEmail", customerEmail.trim());

      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/admin/orders?${params.toString()}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as { orders?: AdminOrder[]; message?: string };

      if (!response.ok || !payload.orders) {
        throw new Error(normalizeMessage(payload, "Nao foi possivel carregar os pedidos."));
      }

      setOrders(payload.orders);
      setState({
        kind: "success",
        message:
          payload.orders.length > 0
            ? "Pedidos globais carregados com sucesso."
            : "Nenhum pedido encontrado para o filtro atual."
      });
    } catch (error) {
      setOrders([]);
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha ao consultar os pedidos."
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadOrderDetail(orderId: string) {
    setState({ kind: "idle" });

    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/admin/orders/${orderId}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as { order?: AdminOrderDetail; message?: string };

      if (!response.ok || !payload.order) {
        throw new Error(normalizeMessage(payload, "Nao foi possivel carregar o detalhe do pedido."));
      }

      setSelectedOrder(payload.order);
      setState({
        kind: "success",
        message: `Detalhes do pedido ${payload.order.id} carregados.`
      });
    } catch (error) {
      setSelectedOrder(null);
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha ao abrir o pedido."
      });
    }
  }

  useEffect(() => {
    void loadOrders();
  }, [token]);

  return (
    <section className="admin-stack">
      <section className="card">
        <div className="domain-head">
          <div>
            <div className="eyebrow">Pedidos</div>
            <h2 className="section-title">Investigação global de pedidos</h2>
          </div>
          <button className="secondary-button" onClick={loadOrders} type="button">
            {isLoading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        <form
          className="domain-form"
          onSubmit={(event) => {
            event.preventDefault();
            void loadOrders();
          }}
        >
          <div className="field-grid">
            <label className="field">
              <span>Status</span>
              <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                <option value="">Todos</option>
                <option value="CREATED">CREATED</option>
                <option value="PAYMENT_APPROVED">PAYMENT_APPROVED</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="SHIPPED">SHIPPED</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELED">CANCELED</option>
                <option value="REFUNDED">REFUNDED</option>
              </select>
            </label>
            <label className="field">
              <span>Cliente</span>
              <input
                onChange={(event) => setCustomerEmail(event.target.value)}
                placeholder="cliente@dominio.com"
                value={customerEmail}
              />
            </label>
          </div>
          <div className="button-row">
            <button className="primary-button" type="submit">
              Aplicar filtros
            </button>
          </div>
        </form>

        <DashboardFeedback state={state} />

        {isLoading && orders.length === 0 ? (
          <DashboardLoadingState label="Carregando pedidos globais" />
        ) : orders.length === 0 ? (
          <DashboardEmptyState
            description="Ajuste os filtros ou aguarde novos pedidos entrarem na operação."
            title="Nenhum pedido encontrado"
          />
        ) : (
          <div className="admin-table-card">
            <div className="admin-table">
              {orders.map((order) => (
                <button
                  className="admin-table-row admin-table-row-button"
                  key={order.id}
                  onClick={() => void loadOrderDetail(order.id)}
                  type="button"
                >
                  <span>
                    <strong>{order.id.slice(0, 12)}</strong>
                    <small>{order.customerEmail}</small>
                  </span>
                  <span>{order.status}</span>
                  <span>{order.store.slug}</span>
                  <span>{formatMoney(order.totalCents, order.currencyCode)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {selectedOrder ? (
        <section className="card">
          <div className="eyebrow">Detalhe</div>
          <h3>Pedido {selectedOrder.id}</h3>
          <div className="grid">
            <div className="kpi">
              <span>Status</span>
              <strong>{selectedOrder.status}</strong>
            </div>
            <div className="kpi">
              <span>Total</span>
              <strong>{formatMoney(selectedOrder.totalCents, selectedOrder.currencyCode)}</strong>
            </div>
            <div className="kpi">
              <span>Pagamento</span>
              <strong>{selectedOrder.payment?.status ?? "Sem pagamento"}</strong>
            </div>
          </div>
          <div className="admin-detail-grid">
            <section className="admin-subcard">
              <div className="eyebrow">Cliente</div>
              <p>{selectedOrder.customerFullName ?? selectedOrder.customerEmail}</p>
              <p>{selectedOrder.customerEmail}</p>
              <p>{selectedOrder.customerPhoneNumber ?? "Sem telefone"}</p>
            </section>
            <section className="admin-subcard">
              <div className="eyebrow">Itens</div>
              {selectedOrder.items.map((item) => (
                <div className="admin-inline-item" key={item.id}>
                  <strong>{item.productName}</strong>
                  <span>
                    {item.quantity}x • {formatMoney(item.totalCents, selectedOrder.currencyCode)}
                  </span>
                </div>
              ))}
            </section>
          </div>
        </section>
      ) : null}
    </section>
  );
}

function AdminPaymentsConsole({ token }: { token: string }) {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<AdminPaymentDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [state, setState] = useState<ApiState>({ kind: "idle" });
  const [isLoading, setIsLoading] = useState(false);

  async function loadPayments() {
    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (providerFilter) params.set("provider", providerFilter);
      if (customerEmail.trim()) params.set("customerEmail", customerEmail.trim());

      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/admin/payments?${params.toString()}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as { payments?: AdminPayment[]; message?: string };

      if (!response.ok || !payload.payments) {
        throw new Error(normalizeMessage(payload, "Nao foi possivel carregar os pagamentos."));
      }

      setPayments(payload.payments);
      setState({
        kind: "success",
        message:
          payload.payments.length > 0
            ? "Pagamentos carregados com sucesso."
            : "Nenhum pagamento encontrado para o filtro atual."
      });
    } catch (error) {
      setPayments([]);
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha ao consultar os pagamentos."
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPaymentDetail(paymentId: string) {
    setState({ kind: "idle" });

    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/admin/payments/${paymentId}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as { payment?: AdminPaymentDetail; message?: string };

      if (!response.ok || !payload.payment) {
        throw new Error(normalizeMessage(payload, "Nao foi possivel carregar o detalhe do pagamento."));
      }

      setSelectedPayment(payload.payment);
      setState({
        kind: "success",
        message: `Detalhes do pagamento ${payload.payment.id} carregados.`
      });
    } catch (error) {
      setSelectedPayment(null);
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha ao abrir o pagamento."
      });
    }
  }

  useEffect(() => {
    void loadPayments();
  }, [token]);

  return (
    <section className="admin-stack">
      <section className="card">
        <div className="domain-head">
          <div>
            <div className="eyebrow">Pagamentos</div>
            <h2 className="section-title">Falhas, attempts e captura</h2>
          </div>
          <button className="secondary-button" onClick={loadPayments} type="button">
            {isLoading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        <form
          className="domain-form"
          onSubmit={(event) => {
            event.preventDefault();
            void loadPayments();
          }}
        >
          <div className="field-grid">
            <label className="field">
              <span>Status</span>
              <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                <option value="">Todos</option>
                <option value="CREATED">CREATED</option>
                <option value="PENDING">PENDING</option>
                <option value="AUTHORIZED">AUTHORIZED</option>
                <option value="APPROVED">APPROVED</option>
                <option value="FAILED">FAILED</option>
                <option value="CANCELED">CANCELED</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="REFUNDED">REFUNDED</option>
              </select>
            </label>
            <label className="field">
              <span>Provider</span>
              <select
                onChange={(event) => setProviderFilter(event.target.value)}
                value={providerFilter}
              >
                <option value="">Todos</option>
                <option value="STRIPE_CONNECT">STRIPE_CONNECT</option>
                <option value="PAGARME">PAGARME</option>
                <option value="MERCADO_PAGO">MERCADO_PAGO</option>
                <option value="ASAAS">ASAAS</option>
              </select>
            </label>
            <label className="field">
              <span>Cliente</span>
              <input
                onChange={(event) => setCustomerEmail(event.target.value)}
                placeholder="cliente@dominio.com"
                value={customerEmail}
              />
            </label>
          </div>
          <div className="button-row">
            <button className="primary-button" type="submit">
              Aplicar filtros
            </button>
          </div>
        </form>

        <DashboardFeedback state={state} />

        {isLoading && payments.length === 0 ? (
          <DashboardLoadingState label="Carregando pagamentos globais" />
        ) : payments.length === 0 ? (
          <DashboardEmptyState
            description="Ajuste os filtros ou aguarde novas tentativas de pagamento."
            title="Nenhum pagamento encontrado"
          />
        ) : (
          <div className="admin-table-card">
            <div className="admin-table">
              {payments.map((payment) => (
                <button
                  className="admin-table-row admin-table-row-button"
                  key={payment.id}
                  onClick={() => void loadPaymentDetail(payment.id)}
                  type="button"
                >
                  <span>
                    <strong>{payment.id.slice(0, 12)}</strong>
                    <small>{payment.customer?.email ?? "Sem cliente"}</small>
                  </span>
                  <span>{payment.provider}</span>
                  <span>{payment.status}</span>
                  <span>{formatMoney(payment.amountCents, payment.currencyCode)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {selectedPayment ? (
        <section className="card">
          <div className="eyebrow">Detalhe</div>
          <h3>Pagamento {selectedPayment.id}</h3>
          <div className="grid">
            <div className="kpi">
              <span>Status</span>
              <strong>{selectedPayment.status}</strong>
            </div>
            <div className="kpi">
              <span>Provider</span>
              <strong>{selectedPayment.provider}</strong>
            </div>
            <div className="kpi">
              <span>Valor</span>
              <strong>{formatMoney(selectedPayment.amountCents, selectedPayment.currencyCode)}</strong>
            </div>
          </div>
          <div className="admin-detail-grid">
            <section className="admin-subcard">
              <div className="eyebrow">Contexto</div>
              <p>Cliente: {selectedPayment.customer?.email ?? "Sem cliente"}</p>
              <p>External payment: {selectedPayment.externalPaymentId ?? "n/a"}</p>
              <p>Attempts: {selectedPayment.attemptCount}</p>
              <p>Pago em: {formatDate(selectedPayment.paidAt)}</p>
            </section>
            <section className="admin-subcard">
              <div className="eyebrow">Transações</div>
              {selectedPayment.transactions.length === 0 ? (
                <p>Sem transações registradas.</p>
              ) : (
                selectedPayment.transactions.map((transaction) => (
                  <div className="admin-inline-item" key={transaction.id}>
                    <strong>{transaction.kind}</strong>
                    <span>{transaction.status}</span>
                  </div>
                ))
              )}
            </section>
          </div>
        </section>
      ) : null}
    </section>
  );
}

function AdminDomainsConsole({ token }: { token: string }) {
  const [domains, setDomains] = useState<AdminDomain[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [state, setState] = useState<ApiState>({ kind: "idle" });
  const [isLoading, setIsLoading] = useState(false);

  async function loadDomains() {
    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());

      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/admin/domains?${params.toString()}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as { domains?: AdminDomain[]; message?: string };

      if (!response.ok || !payload.domains) {
        throw new Error(normalizeMessage(payload, "Nao foi possivel carregar os domínios."));
      }

      setDomains(payload.domains);
      setState({
        kind: "success",
        message:
          payload.domains.length > 0
            ? "Domínios carregados com sucesso."
            : "Nenhum domínio encontrado para o filtro atual."
      });
    } catch (error) {
      setDomains([]);
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha ao consultar os domínios."
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDomains();
  }, [token]);

  return (
    <section className="card">
      <div className="domain-head">
        <div>
          <div className="eyebrow">Domínios</div>
          <h2 className="section-title">Hosts, DNS e ativação</h2>
        </div>
        <button className="secondary-button" onClick={loadDomains} type="button">
          {isLoading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      <form
        className="domain-form"
        onSubmit={(event) => {
          event.preventDefault();
          void loadDomains();
        }}
      >
        <div className="field-grid">
          <label className="field">
            <span>Busca</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Host, loja ou slug"
              value={search}
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="">Todos</option>
              <option value="PENDING">PENDING</option>
              <option value="AWAITING_DNS">AWAITING_DNS</option>
              <option value="VERIFYING">VERIFYING</option>
              <option value="SSL_PENDING">SSL_PENDING</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ERROR">ERROR</option>
              <option value="REMOVED">REMOVED</option>
            </select>
          </label>
        </div>
        <div className="button-row">
          <button className="primary-button" type="submit">
            Aplicar filtros
          </button>
        </div>
      </form>

      <DashboardFeedback state={state} />

      {isLoading && domains.length === 0 ? (
        <DashboardLoadingState label="Carregando domínios da plataforma" />
      ) : domains.length === 0 ? (
        <DashboardEmptyState
          description="Ajuste os filtros ou aguarde novos domínios serem cadastrados."
          title="Nenhum domínio encontrado"
        />
      ) : (
        <div className="admin-table-card">
          <div className="admin-table">
            {domains.map((domain) => (
              <div className="admin-table-row" key={domain.id}>
                <span>
                  <strong>{domain.host}</strong>
                  <small>{domain.store.slug}</small>
                </span>
                <span>{domain.status}</span>
                <span>{domain.dnsTargetValue ?? "Sem alvo DNS"}</span>
                <span>{formatCompactDate(domain.activatedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
