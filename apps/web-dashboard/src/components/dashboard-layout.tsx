"use client";

import type { ReactNode } from "react";
import { formatStoreRoleLabel } from "../lib/enum-labels";

export type DashboardModuleKey =
  | "overview"
  | "settings"
  | "catalog"
  | "storefront"
  | "orders"
  | "domains"
  | "members";

type DashboardModule = {
  key: DashboardModuleKey;
  label: string;
  description: string;
  marker: string;
  badge?: string;
};

type DashboardStoreOption = {
  storeId: string;
  label: string;
  role: string;
};

type DashboardStoreContext = {
  name: string;
  role: string;
  slug: string;
  defaultSubdomain: string;
  currencyCode: string;
};

type DashboardAction =
  | {
      kind: "anchor";
      href: string;
      label: string;
      emphasis?: "primary";
    }
  | {
      kind: "button";
      label: string;
      onClick: () => void;
      emphasis?: "primary";
    };

type DashboardLayoutProps = {
  activeSection: DashboardModuleKey;
  actions: DashboardAction[];
  children: ReactNode;
  modules: DashboardModule[];
  onSectionChange: (section: DashboardModuleKey) => void;
  onStoreChange: (storeId: string) => void;
  selectedStoreId: string;
  store: DashboardStoreContext;
  storeOptions: DashboardStoreOption[];
  storefrontHref: string;
  userEmail: string;
  userName: string;
};

export function DashboardLayout({
  activeSection,
  actions,
  children,
  modules,
  onSectionChange,
  onStoreChange,
  selectedStoreId,
  store,
  storeOptions,
  storefrontHref,
  userEmail,
  userName
}: DashboardLayoutProps) {
  const activeModule = modules.find((module) => module.key === activeSection) ?? modules[0];

  return (
    <main className="dashboard-app-shell">
      <DashboardSidebar
        activeSection={activeSection}
        modules={modules}
        onSectionChange={onSectionChange}
        selectedStoreId={selectedStoreId}
        store={store}
        storeOptions={storeOptions}
        onStoreChange={onStoreChange}
        userEmail={userEmail}
        userName={userName}
      />

      <section className="dashboard-workspace">
        <DashboardWorkspaceTopbar
          actions={actions}
          activeModuleLabel={activeModule.label}
          storeName={store.name}
        />
        <DashboardContextStrip
          activeDescription={activeModule.description}
          activeLabel={activeModule.label}
          store={store}
          storefrontHref={storefrontHref}
        />
        <section className="dashboard-workspace-body">{children}</section>
      </section>

      <DashboardMobileNav
        activeSection={activeSection}
        modules={modules}
        onSectionChange={onSectionChange}
      />
    </main>
  );
}

function DashboardSidebar({
  activeSection,
  modules,
  onSectionChange,
  onStoreChange,
  selectedStoreId,
  store,
  storeOptions,
  userEmail,
  userName
}: Omit<DashboardLayoutProps, "actions" | "children" | "storefrontHref">) {
  return (
    <aside className="dashboard-rail">
      <div className="dashboard-brand">
        <div className="dashboard-brand-mark">R</div>
        <div>
          <strong>Resumo</strong>
          <span>Console do lojista</span>
        </div>
      </div>

      <label className="dashboard-store-picker">
        <span>Loja atual</span>
        <select
          data-testid="dashboard-store-select"
          onChange={(event) => onStoreChange(event.target.value)}
          value={selectedStoreId}
        >
          {storeOptions.map((option) => (
            <option key={option.storeId} value={option.storeId}>
              {option.label} - {formatStoreRoleLabel(option.role)}
            </option>
          ))}
        </select>
      </label>

      <nav className="dashboard-module-nav" aria-label="Modulos do dashboard">
        {modules.map((module) => (
          <button
            className={
              activeSection === module.key
                ? "dashboard-module-link is-active"
                : "dashboard-module-link"
            }
            data-testid={`dashboard-nav-${module.key}`}
            key={module.key}
            onClick={() => onSectionChange(module.key)}
            type="button"
          >
            <span className="dashboard-module-marker" aria-hidden="true">
              {module.marker}
            </span>
            <span>
              <strong>{module.label}</strong>
              <small>{module.description}</small>
            </span>
            {module.badge ? <em>{module.badge}</em> : null}
          </button>
        ))}
      </nav>

      <div className="dashboard-rail-account">
        <div className="dashboard-account-avatar" aria-hidden="true">
          {getInitials(userName || userEmail)}
        </div>
        <div>
          <strong>{userName}</strong>
          <span>{userEmail}</span>
          <small>
            {formatStoreRoleLabel(store.role)} - {store.currencyCode}
          </small>
        </div>
      </div>
    </aside>
  );
}

function DashboardWorkspaceTopbar({
  actions,
  activeModuleLabel,
  storeName
}: {
  actions: DashboardAction[];
  activeModuleLabel: string;
  storeName: string;
}) {
  return (
    <header className="dashboard-workspace-topbar">
      <div>
        <span>Status operacional</span>
        <strong>
          {storeName} / {activeModuleLabel}
        </strong>
      </div>

      <nav className="dashboard-action-row" aria-label="Acoes do dashboard">
        {actions.map((action) =>
          action.kind === "anchor" ? (
            <a
              className={
                action.emphasis === "primary"
                  ? "dashboard-action is-primary"
                  : "dashboard-action"
              }
              href={action.href}
              key={`${action.kind}-${action.href}-${action.label}`}
            >
              {action.label}
            </a>
          ) : (
            <button
              className={
                action.emphasis === "primary"
                  ? "dashboard-action is-primary"
                  : "dashboard-action"
              }
              key={`${action.kind}-${action.label}`}
              onClick={action.onClick}
              type="button"
            >
              {action.label}
            </button>
          )
        )}
      </nav>
    </header>
  );
}

function DashboardContextStrip({
  activeDescription,
  activeLabel,
  store,
  storefrontHref
}: {
  activeDescription: string;
  activeLabel: string;
  store: DashboardStoreContext;
  storefrontHref: string;
}) {
  return (
    <section className="dashboard-context-strip">
      <div className="dashboard-context-copy">
        <div className="eyebrow">Loja selecionada</div>
        <h1 data-testid="dashboard-selected-store">{store.name}</h1>
        <p>
          {activeLabel}: {activeDescription}. Produtos, pedidos, dominios e configuracoes seguem
          a loja selecionada.
        </p>
      </div>

      <div className="dashboard-context-metrics">
        <Metric label="Papel atual" value={formatStoreRoleLabel(store.role)} />
        <Metric label="Slug" value={store.slug} />
        <Metric label="Subdominio" value={store.defaultSubdomain} />
        <Metric label="Moeda" value={store.currencyCode} />
      </div>

      <a className="dashboard-storefront-link" href={storefrontHref}>
        Ver vitrine
      </a>
    </section>
  );
}

function DashboardMobileNav({
  activeSection,
  modules,
  onSectionChange
}: {
  activeSection: DashboardModuleKey;
  modules: DashboardModule[];
  onSectionChange: (section: DashboardModuleKey) => void;
}) {
  return (
    <nav className="dashboard-mobile-nav" aria-label="Navegacao mobile do dashboard">
      {modules.map((module) => (
        <button
          aria-label={module.label}
          className={activeSection === module.key ? "is-active" : ""}
          key={module.key}
          onClick={() => onSectionChange(module.key)}
          type="button"
        >
          <span aria-hidden="true">{module.marker}</span>
          <small>{module.label}</small>
        </button>
      ))}
    </nav>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="dashboard-context-metric">
      <span>{label}</span>
      <strong>{value || "n/a"}</strong>
    </div>
  );
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
