"use client";

import { FormEvent, useEffect, useState } from "react";
import { env } from "../lib/env";

type ApiState = {
  kind: "idle" | "success" | "error";
  message?: string;
};

type StoreThemeRecord = {
  storeId: string;
  primaryColor: string;
  accentColor: string;
  surfaceColor: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  announcementText: string | null;
};

type StorefrontThemeConsoleProps = {
  token: string;
  storeId: string;
  storeLabel: string;
};

const DEFAULT_THEME: StoreThemeRecord = {
  storeId: "",
  primaryColor: "#c45c2c",
  accentColor: "#8f3610",
  surfaceColor: "#f5f1e8",
  logoUrl: null,
  bannerUrl: null,
  heroTitle: null,
  heroSubtitle: null,
  announcementText: null
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

export function StorefrontThemeConsole({
  token,
  storeId,
  storeLabel
}: StorefrontThemeConsoleProps) {
  const [theme, setTheme] = useState<StoreThemeRecord>({
    ...DEFAULT_THEME,
    storeId
  });
  const [state, setState] = useState<ApiState>({ kind: "idle" });
  const [isLoading, setIsLoading] = useState(false);

  async function loadTheme() {
    if (!storeId) {
      return;
    }

    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/stores/${storeId}/theme`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as {
        theme?: StoreThemeRecord;
        message?: string;
      };

      if (!response.ok || !payload.theme) {
        setState({
          kind: "error",
          message: normalizeMessage(payload, "Nao foi possivel carregar o tema da loja.")
        });
        return;
      }

      setTheme(payload.theme);
    } catch {
      setState({
        kind: "error",
        message: "Falha de rede ao carregar o tema da loja."
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setTheme({
      ...DEFAULT_THEME,
      storeId
    });
    if (storeId) {
      void loadTheme();
    }
  }, [storeId, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/stores/${storeId}/theme`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          primaryColor: theme.primaryColor,
          accentColor: theme.accentColor,
          surfaceColor: theme.surfaceColor,
          logoUrl: theme.logoUrl ?? "",
          bannerUrl: theme.bannerUrl ?? "",
          heroTitle: theme.heroTitle ?? "",
          heroSubtitle: theme.heroSubtitle ?? "",
          announcementText: theme.announcementText ?? ""
        })
      });
      const payload = (await response.json()) as {
        theme?: StoreThemeRecord;
        message?: string;
      };

      if (!response.ok || !payload.theme) {
        setState({
          kind: "error",
          message: normalizeMessage(payload, "Nao foi possivel salvar o tema da loja.")
        });
        return;
      }

      setTheme(payload.theme);
      setState({
        kind: "success",
        message: "Tema da vitrine atualizado com sucesso."
      });
    } catch {
      setState({
        kind: "error",
        message: "Falha de rede ao salvar o tema da loja."
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="card domain-card">
      <div className="domain-head">
        <div>
          <div className="eyebrow">Storefront theme</div>
          <h2 className="section-title">Visual da vitrine de {storeLabel}</h2>
        </div>
        <button className="secondary-button" onClick={loadTheme} type="button">
          Recarregar tema
        </button>
      </div>

      <p className="subtitle">
        O MVP libera uma personalização enxuta: três cores base, logo, banner e textos principais da home.
      </p>

      <form className="domain-form" onSubmit={handleSubmit}>
        <div className="field-grid">
          <label className="field">
            <span>Cor principal</span>
            <input
              onChange={(event) =>
                setTheme((current) => ({ ...current, primaryColor: event.target.value }))
              }
              type="color"
              value={theme.primaryColor}
            />
          </label>
          <label className="field">
            <span>Cor de destaque</span>
            <input
              onChange={(event) =>
                setTheme((current) => ({ ...current, accentColor: event.target.value }))
              }
              type="color"
              value={theme.accentColor}
            />
          </label>
          <label className="field">
            <span>Cor de fundo</span>
            <input
              onChange={(event) =>
                setTheme((current) => ({ ...current, surfaceColor: event.target.value }))
              }
              type="color"
              value={theme.surfaceColor}
            />
          </label>
        </div>

        <div className="field-grid">
          <label className="field">
            <span>URL do logo</span>
            <input
              onChange={(event) =>
                setTheme((current) => ({
                  ...current,
                  logoUrl: event.target.value || null
                }))
              }
              placeholder="https://cdn.exemplo.com/logo.png"
              value={theme.logoUrl ?? ""}
            />
          </label>
          <label className="field">
            <span>URL do banner</span>
            <input
              onChange={(event) =>
                setTheme((current) => ({
                  ...current,
                  bannerUrl: event.target.value || null
                }))
              }
              placeholder="https://cdn.exemplo.com/banner.jpg"
              value={theme.bannerUrl ?? ""}
            />
          </label>
        </div>

        <label className="field">
          <span>Título principal</span>
          <input
            onChange={(event) =>
              setTheme((current) => ({
                ...current,
                heroTitle: event.target.value || null
              }))
            }
            placeholder="Sua nova coleção chegou"
            value={theme.heroTitle ?? ""}
          />
        </label>

        <label className="field">
          <span>Subtítulo</span>
          <textarea
            onChange={(event) =>
              setTheme((current) => ({
                ...current,
                heroSubtitle: event.target.value || null
              }))
            }
            rows={3}
            value={theme.heroSubtitle ?? ""}
          />
        </label>

        <label className="field">
          <span>Aviso curto da vitrine</span>
          <input
            onChange={(event) =>
              setTheme((current) => ({
                ...current,
                announcementText: event.target.value || null
              }))
            }
            placeholder="Frete gratis acima de R$ 199"
            value={theme.announcementText ?? ""}
          />
        </label>

        <div className="button-row">
          <button className="primary-button" disabled={isLoading} type="submit">
            {isLoading ? "Salvando..." : "Aplicar tema"}
          </button>
        </div>
      </form>

      {state.kind !== "idle" ? (
        <p className={state.kind === "success" ? "feedback ok" : "feedback error"}>
          {state.message}
        </p>
      ) : null}

      <section className="theme-preview-card">
        <div
          className="theme-preview-swatch"
          style={{
            background: `linear-gradient(135deg, ${theme.surfaceColor} 0%, ${theme.primaryColor} 100%)`
          }}
        />
        <div className="theme-preview-copy">
          <div className="eyebrow">Preview</div>
          <h3>{theme.heroTitle ?? storeLabel}</h3>
          <p>{theme.heroSubtitle ?? "A vitrine publica vai refletir essas cores, logo e textos principais."}</p>
          <div className="button-row">
            <span className="theme-chip" style={{ background: theme.primaryColor }} />
            <span className="theme-chip" style={{ background: theme.accentColor }} />
            <span className="theme-chip" style={{ background: theme.surfaceColor }} />
          </div>
        </div>
      </section>
    </section>
  );
}
