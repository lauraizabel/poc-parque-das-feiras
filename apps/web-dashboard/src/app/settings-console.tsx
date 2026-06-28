"use client";

import { FormEvent, useEffect, useState } from "react";
import { env } from "../lib/env";
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

const EMPTY_FORM: ProfileFormState = {
  name: "",
  supportEmail: "",
  currencyCode: "BRL",
  locale: "pt-BR"
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

export function SettingsConsole({
  token,
  storeId,
  storeLabel,
  storeRole
}: SettingsConsoleProps) {
  const [store, setStore] = useState<StoreSettings | null>(null);
  const [notifications, setNotifications] = useState<NotificationSettings | null>(null);
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [profileState, setProfileState] = useState<ApiState>({ kind: "idle" });
  const [notificationState, setNotificationState] = useState<ApiState>({ kind: "idle" });
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
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
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/stores/${storeId}/settings`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as {
        store?: StoreSettings;
        message?: string;
      };

      if (!response.ok || !payload.store) {
        setStore(null);
        setProfileState({
          kind: "error",
          message: normalizeMessage(payload, "Nao foi possivel carregar a loja.")
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
        message: "Falha de rede ao carregar a configuração da loja."
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
        message: "Apenas owner e manager podem consultar notificações da loja."
      });
      return;
    }

    setNotificationState({ kind: "idle" });

    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/notifications/${storeId}/settings`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as {
        notifications?: NotificationSettings;
        message?: string;
      };

      if (!response.ok || !payload.notifications) {
        setNotifications(null);
        setNotificationState({
          kind: "error",
          message: normalizeMessage(payload, "Nao foi possivel carregar as notificações.")
        });
        return;
      }

      setNotifications(payload.notifications);
      setNotificationState({
        kind: "success",
        message: "Destinatários e fila de notificações carregados."
      });
    } catch {
      setNotifications(null);
      setNotificationState({
        kind: "error",
        message: "Falha de rede ao carregar as notificações."
      });
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
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/stores/${storeId}/settings`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: form.name,
          supportEmail: form.supportEmail,
          currencyCode: form.currencyCode,
          locale: form.locale
        })
      });
      const payload = (await response.json()) as {
        store?: StoreSettings;
        message?: string;
      };

      if (!response.ok || !payload.store) {
        setProfileState({
          kind: "error",
          message: normalizeMessage(payload, "Nao foi possivel salvar a loja.")
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
        message: "Falha de rede ao salvar a configuração da loja."
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  return (
    <section className="settings-stack">
      <section className="card settings-card">
        <div className="domain-head">
          <div>
            <div className="eyebrow">Configurações</div>
            <h2 className="section-title">Centro de configuração de {storeLabel}</h2>
          </div>
          <div className="button-row">
            <button className="secondary-button" onClick={loadStoreSettings} type="button">
              {isLoadingProfile ? "Atualizando..." : "Atualizar dados"}
            </button>
            <button className="secondary-button" onClick={loadNotificationSettings} type="button">
              Atualizar notificações
            </button>
          </div>
        </div>

        <p className="subtitle">
          Reúna aqui os ajustes críticos da loja: dados base, destinatários operacionais, frete,
          vitrine e domínio customizado.
        </p>
      </section>

      <section className="card settings-card">
        <div className="eyebrow">Dados da loja</div>
        <h3 className="section-title">Perfil operacional</h3>

        <form className="domain-form" onSubmit={handleProfileSubmit}>
          <div className="field-grid">
            <label className="field">
              <span>Nome da loja</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                value={form.name}
              />
            </label>
            <label className="field">
              <span>E-mail de suporte / operação</span>
              <input
                onChange={(event) =>
                  setForm((current) => ({ ...current, supportEmail: event.target.value }))
                }
                type="email"
                value={form.supportEmail}
              />
            </label>
            <label className="field">
              <span>Moeda</span>
              <input
                maxLength={3}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    currencyCode: event.target.value.toUpperCase()
                  }))
                }
                value={form.currencyCode}
              />
            </label>
            <label className="field">
              <span>Locale</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, locale: event.target.value }))}
                value={form.locale}
              />
            </label>
            <label className="field">
              <span>Slug</span>
              <input disabled value={store?.slug ?? ""} />
            </label>
            <label className="field">
              <span>Subdomínio padrão</span>
              <input disabled value={store?.defaultSubdomain ?? ""} />
            </label>
          </div>

          <div className="settings-meta-grid">
            <div className="overview-domain-box">
              <span>Owner atual</span>
              <strong>{store?.owner.fullName ?? store?.owner.email ?? "n/a"}</strong>
            </div>
            <div className="overview-domain-box">
              <span>E-mail do owner</span>
              <strong>{store?.owner.email ?? "n/a"}</strong>
            </div>
          </div>

          <div className="button-row">
            <button className="primary-button" disabled={isSavingProfile} type="submit">
              {isSavingProfile ? "Salvando..." : "Salvar dados da loja"}
            </button>
          </div>
        </form>

        {profileState.kind !== "idle" ? (
          <p className={profileState.kind === "success" ? "feedback ok" : "feedback error"}>
            {profileState.message}
          </p>
        ) : null}
      </section>

      <section className="card settings-card">
        <div className="eyebrow">Notificações</div>
        <h3 className="section-title">Destinatários e fila essencial</h3>

        <div className="settings-meta-grid">
          <div className="overview-domain-box">
            <span>E-mail do owner</span>
            <strong>{notifications?.ownerEmail ?? "n/a"}</strong>
          </div>
          <div className="overview-domain-box">
            <span>E-mail de suporte</span>
            <strong>{notifications?.supportEmail ?? "não configurado"}</strong>
          </div>
          <div className="overview-domain-box">
            <span>Fila</span>
            <strong>{notifications?.queue.queueName ?? "n/a"}</strong>
          </div>
          <div className="overview-domain-box">
            <span>Perfil</span>
            <strong>{notifications?.queue.profile ?? "n/a"}</strong>
          </div>
        </div>

        <div className="settings-recipient-list">
          {(notifications?.recipientEmails ?? []).map((recipient) => (
            <span className="settings-recipient-chip" key={recipient}>
              {recipient}
            </span>
          ))}
        </div>

        <p className="overview-note">
          Os templates essenciais de pagamento já estão prontos. Para trocar o destino operacional,
          ajuste o e-mail de suporte acima.
        </p>

        {notificationState.kind !== "idle" ? (
          <p className={notificationState.kind === "success" ? "feedback ok" : "feedback error"}>
            {notificationState.message}
          </p>
        ) : null}
      </section>

      <ShippingConsole storeId={storeId} storeLabel={storeLabel} token={token} />
      <StorefrontThemeConsole storeId={storeId} storeLabel={storeLabel} token={token} />
      <DomainConsole storeId={storeId} storeLabel={storeLabel} token={token} />
    </section>
  );
}
