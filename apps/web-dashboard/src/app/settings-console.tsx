"use client";

import { FormEvent, type ReactNode, useEffect, useState } from "react";
import {
  DashboardEmptyState,
  DashboardFeedback,
  DashboardLoadingState
} from "../components/dashboard-state";
import { authHeaders, dashboardApiJson, normalizeApiMessage } from "../lib/dashboard-api";
import { DomainConsole } from "./domain-console";
import { ShippingConsole } from "./shipping-console";
import { StorefrontThemeConsole } from "./storefront-theme-console";

type ApiState = {
  kind: "idle" | "success" | "error";
  message?: string;
};

type StoreSettings = {
  id: string;
  name: string;
  slug: string;
  defaultSubdomain: string;
  supportEmail: string | null;
  currencyCode: string;
  locale: string;
  owner: {
    id: string;
    email: string;
    fullName: string | null;
  };
};

type NotificationSettings = {
  ownerEmail: string | null;
  supportEmail: string | null;
  recipientEmails: string[];
  queue: {
    queueName: string;
    profile: string;
  };
  paymentTemplates: string[];
};

type SettingsConsoleProps = {
  token: string;
  storeId: string;
  storeLabel: string;
  storeRole: string;
};

type ProfileFormState = {
  name: string;
  supportEmail: string;
  currencyCode: string;
  locale: string;
};

type SettingsSection =
  | "store"
  | "shipping"
  | "storefront"
  | "domains"
  | "notifications"
  | "taxes"
  | "payments"
  | "integrations"
  | "region"
  | "api";

const EMPTY_FORM: ProfileFormState = {
  name: "",
  supportEmail: "",
  currencyCode: "BRL",
  locale: "pt-BR"
};

const SETTINGS_SECTIONS: Array<{
  id: SettingsSection;
  label: string;
  description: string;
}> = [
  { id: "store", label: "Identidade da loja", description: "Nome, suporte e owner" },
  { id: "shipping", label: "Frete e logistica", description: "Metodos usados no checkout" },
  { id: "storefront", label: "Vitrine", description: "Tema, banner e textos" },
  { id: "domains", label: "Dominios", description: "DNS e SSL do dominio proprio" },
  { id: "notifications", label: "Notificacoes", description: "Destinatarios e filas" },
  { id: "taxes", label: "Fiscal", description: "Modulo em producao" },
  { id: "payments", label: "Pagamentos", description: "Modulo em producao" },
  { id: "integrations", label: "Integracoes", description: "Modulo em producao" },
  { id: "region", label: "Regiao e idiomas", description: "Moeda e locale" },
  { id: "api", label: "API e webhooks", description: "Modulo em producao" }
];

export function SettingsConsole({
  token,
  storeId,
  storeLabel,
  storeRole
}: SettingsConsoleProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("store");
  const [store, setStore] = useState<StoreSettings | null>(null);
  const [notifications, setNotifications] = useState<NotificationSettings | null>(null);
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [profileState, setProfileState] = useState<ApiState>({ kind: "idle" });
  const [notificationState, setNotificationState] = useState<ApiState>({ kind: "idle" });
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const canManageCriticalSettings =
    storeRole === "STORE_OWNER" || storeRole === "STORE_MANAGER";

  async function loadStoreSettings() {
    if (!canManageCriticalSettings) {
      setStore(null);
      setProfileState({
        kind: "error",
        message: "Apenas owner e manager podem configurar a loja."
      });
      return;
    }

    setIsLoadingProfile(true);
    setProfileState({ kind: "idle" });

    try {
      const { payload, response } = await dashboardApiJson<{
        store?: StoreSettings;
        message?: string;
      }>(`/stores/${storeId}/settings`, {
        headers: authHeaders(token)
      });

      if (!response.ok || !payload.store) {
        setStore(null);
        setProfileState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel carregar a loja.")
        });
        return;
      }

      setStore(payload.store);
      setForm({
        name: payload.store.name,
        supportEmail: payload.store.supportEmail ?? "",
        currencyCode: payload.store.currencyCode,
        locale: payload.store.locale
      });
      setProfileState({
        kind: "success",
        message: "Dados principais da loja carregados."
      });
    } catch {
      setStore(null);
      setProfileState({
        kind: "error",
        message: "Falha de rede ao carregar a configuracao da loja."
      });
    } finally {
      setIsLoadingProfile(false);
    }
  }

  async function loadNotificationSettings() {
    if (!canManageCriticalSettings) {
      setNotifications(null);
      setNotificationState({
        kind: "error",
        message: "Apenas owner e manager podem consultar notificacoes da loja."
      });
      return;
    }

    setIsLoadingNotifications(true);
    setNotificationState({ kind: "idle" });

    try {
      const { payload, response } = await dashboardApiJson<{
        notifications?: NotificationSettings;
        message?: string;
      }>(`/notifications/${storeId}/settings`, {
        headers: authHeaders(token)
      });

      if (!response.ok || !payload.notifications) {
        setNotifications(null);
        setNotificationState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel carregar as notificacoes.")
        });
        return;
      }

      setNotifications(payload.notifications);
      setNotificationState({
        kind: "success",
        message: "Destinatarios e fila de notificacoes carregados."
      });
    } catch {
      setNotifications(null);
      setNotificationState({
        kind: "error",
        message: "Falha de rede ao carregar as notificacoes."
      });
    } finally {
      setIsLoadingNotifications(false);
    }
  }

  useEffect(() => {
    void loadStoreSettings();
    void loadNotificationSettings();
  }, [storeId, storeRole, token]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingProfile(true);
    setProfileState({ kind: "idle" });

    try {
      const { payload, response } = await dashboardApiJson<{
        store?: StoreSettings;
        message?: string;
      }>(`/stores/${storeId}/settings`, {
        method: "PATCH",
        headers: authHeaders(token, {
          "content-type": "application/json"
        }),
        body: JSON.stringify({
          name: form.name,
          supportEmail: form.supportEmail,
          currencyCode: form.currencyCode,
          locale: form.locale
        })
      });

      if (!response.ok || !payload.store) {
        setProfileState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel salvar a loja.")
        });
        return;
      }

      setStore(payload.store);
      setForm({
        name: payload.store.name,
        supportEmail: payload.store.supportEmail ?? "",
        currencyCode: payload.store.currencyCode,
        locale: payload.store.locale
      });
      setProfileState({
        kind: "success",
        message: "Dados principais da loja salvos com sucesso."
      });
      await loadNotificationSettings();
    } catch {
      setProfileState({
        kind: "error",
        message: "Falha de rede ao salvar a configuracao da loja."
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  return (
    <section className="settings-console animate-entrance">
      <header className="settings-console-header">
        <div>
          <div className="eyebrow">Console / Configuracoes</div>
          <h2>Ajustes operacionais de {storeLabel}</h2>
          <p>Identidade, frete, notificacoes, vitrine, dominios e modulos futuros.</p>
        </div>
        <div className="settings-actions">
          <button className="secondary-button" onClick={loadStoreSettings} type="button">
            {isLoadingProfile ? "Atualizando..." : "Atualizar loja"}
          </button>
          <button className="secondary-button" onClick={loadNotificationSettings} type="button">
            Atualizar notificacoes
          </button>
        </div>
      </header>

      <section className="settings-workbench">
        <nav className="settings-section-nav" aria-label="Secoes de configuracao">
          {SETTINGS_SECTIONS.map((section) => (
            <button
              className={activeSection === section.id ? "is-active" : ""}
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              type="button"
            >
              <strong>{section.label}</strong>
              <span>{section.description}</span>
            </button>
          ))}
        </nav>

        <div className="settings-section-panel">
          {activeSection === "store" || activeSection === "region" ? (
            <StoreProfilePanel
              form={form}
              isLoadingProfile={isLoadingProfile}
              isSavingProfile={isSavingProfile}
              onChange={setForm}
              onSubmit={handleProfileSubmit}
              profileState={profileState}
              store={store}
            />
          ) : null}

          {activeSection === "notifications" ? (
            <NotificationsPanel
              isLoading={isLoadingNotifications}
              notifications={notifications}
              state={notificationState}
            />
          ) : null}

          {activeSection === "shipping" ? (
            <ShippingConsole storeId={storeId} storeLabel={storeLabel} token={token} />
          ) : null}

          {activeSection === "storefront" ? (
            <StorefrontThemeConsole storeId={storeId} storeLabel={storeLabel} token={token} />
          ) : null}

          {activeSection === "domains" ? (
            <DomainConsole storeId={storeId} storeLabel={storeLabel} token={token} />
          ) : null}

          {["taxes", "payments", "integrations", "api"].includes(activeSection) ? (
            <PendingSettingsPanel section={activeSection} />
          ) : null}
        </div>
      </section>
    </section>
  );
}

function StoreProfilePanel({
  form,
  isLoadingProfile,
  isSavingProfile,
  onChange,
  onSubmit,
  profileState,
  store
}: {
  form: ProfileFormState;
  isLoadingProfile: boolean;
  isSavingProfile: boolean;
  onChange: (form: ProfileFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  profileState: ApiState;
  store: StoreSettings | null;
}) {
  return (
    <section className="settings-card-panel">
      <div>
        <div className="eyebrow">Dados da loja</div>
        <h3>Perfil operacional</h3>
      </div>

      {isLoadingProfile && !store ? (
        <DashboardLoadingState label="Carregando configuracoes da loja" />
      ) : null}

      <form className="settings-form" onSubmit={onSubmit}>
        <div className="settings-form-grid">
          <SettingsField label="Nome da loja">
            <input
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              value={form.name}
            />
          </SettingsField>
          <SettingsField label="E-mail de suporte">
            <input
              onChange={(event) => onChange({ ...form, supportEmail: event.target.value })}
              type="email"
              value={form.supportEmail}
            />
          </SettingsField>
          <SettingsField label="Moeda">
            <input
              maxLength={3}
              onChange={(event) =>
                onChange({ ...form, currencyCode: event.target.value.toUpperCase() })
              }
              value={form.currencyCode}
            />
          </SettingsField>
          <SettingsField label="Locale">
            <input
              onChange={(event) => onChange({ ...form, locale: event.target.value })}
              value={form.locale}
            />
          </SettingsField>
          <SettingsField label="Slug">
            <input disabled value={store?.slug ?? ""} />
          </SettingsField>
          <SettingsField label="Subdominio padrao">
            <input disabled value={store?.defaultSubdomain ?? ""} />
          </SettingsField>
        </div>

        <div className="settings-summary-grid">
          <Metric label="Owner atual" value={store?.owner.fullName ?? store?.owner.email ?? "n/a"} />
          <Metric label="E-mail do owner" value={store?.owner.email ?? "n/a"} />
        </div>

        <button className="primary-button" disabled={isSavingProfile} type="submit">
          {isSavingProfile ? "Salvando..." : "Salvar dados da loja"}
        </button>
      </form>

      <DashboardFeedback state={profileState} />
    </section>
  );
}

function NotificationsPanel({
  isLoading,
  notifications,
  state
}: {
  isLoading: boolean;
  notifications: NotificationSettings | null;
  state: ApiState;
}) {
  return (
    <section className="settings-card-panel">
      <div>
        <div className="eyebrow">Notificacoes</div>
        <h3>Destinatarios e fila essencial</h3>
      </div>

      {isLoading && !notifications ? (
        <DashboardLoadingState label="Carregando notificacoes da loja" />
      ) : null}

      <div className="settings-summary-grid">
        <Metric label="E-mail do owner" value={notifications?.ownerEmail ?? "n/a"} />
        <Metric label="E-mail de suporte" value={notifications?.supportEmail ?? "nao configurado"} />
        <Metric label="Fila" value={notifications?.queue.queueName ?? "n/a"} />
        <Metric label="Perfil" value={notifications?.queue.profile ?? "n/a"} />
      </div>

      {notifications?.recipientEmails.length ? (
        <div className="settings-recipient-list">
          {notifications.recipientEmails.map((recipient) => (
            <span className="settings-recipient-chip" key={recipient}>
              {recipient}
            </span>
          ))}
        </div>
      ) : null}

      {notifications && notifications.recipientEmails.length === 0 ? (
        <DashboardEmptyState
          description="Defina um e-mail de suporte na loja para ampliar os destinatarios operacionais alem do owner."
          title="Nenhum destinatario extra configurado"
        />
      ) : null}

      <DashboardFeedback state={state} />
    </section>
  );
}

function PendingSettingsPanel({ section }: { section: SettingsSection }) {
  const label = SETTINGS_SECTIONS.find((item) => item.id === section)?.label ?? "Modulo";

  return (
    <section className="settings-card-panel">
      <div>
        <div className="eyebrow">Em producao</div>
        <h3>{label}</h3>
      </div>
      <p className="settings-muted">
        Este modulo ainda nao possui contrato completo de backend no MVP. Ele fica visivel na
        navegacao para manter a arquitetura do dashboard preparada para a proxima etapa.
      </p>
    </section>
  );
}

function SettingsField({
  children,
  label
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
