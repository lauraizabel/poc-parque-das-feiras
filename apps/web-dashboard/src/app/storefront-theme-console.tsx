"use client";

import { FormEvent, type ReactNode, useEffect, useState } from "react";
import { DashboardFeedback, DashboardLoadingState } from "../components/dashboard-state";
import { authHeaders, dashboardApiJson, normalizeApiMessage } from "../lib/dashboard-api";

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

type ThemeSection = "hero" | "brand" | "colors" | "announcement";

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

const SECTIONS: Array<{
  id: ThemeSection;
  label: string;
  description: string;
}> = [
  {
    id: "hero",
    label: "Hero principal",
    description: "Titulo, subtitulo e banner editorial"
  },
  {
    id: "brand",
    label: "Logo e assets",
    description: "Logo publico e imagem de capa"
  },
  {
    id: "colors",
    label: "Tema",
    description: "Cores da marca e superficie"
  },
  {
    id: "announcement",
    label: "Aviso",
    description: "Mensagem curta da vitrine"
  }
];

export function StorefrontThemeConsole({
  token,
  storeId,
  storeLabel
}: StorefrontThemeConsoleProps) {
  const [theme, setTheme] = useState<StoreThemeRecord>({
    ...DEFAULT_THEME,
    storeId
  });
  const [activeSection, setActiveSection] = useState<ThemeSection>("hero");
  const [state, setState] = useState<ApiState>({ kind: "idle" });
  const [isLoading, setIsLoading] = useState(false);

  async function loadTheme() {
    if (!storeId) {
      return;
    }

    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const { payload, response } = await dashboardApiJson<{
        theme?: StoreThemeRecord;
        message?: string;
      }>(`/stores/${storeId}/theme`, {
        headers: authHeaders(token)
      });

      if (!response.ok || !payload.theme) {
        setState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel carregar o tema da loja.")
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
    setActiveSection("hero");

    if (storeId) {
      void loadTheme();
    }
  }, [storeId, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const { payload, response } = await dashboardApiJson<{
        theme?: StoreThemeRecord;
        message?: string;
      }>(`/stores/${storeId}/theme`, {
        method: "PATCH",
        headers: authHeaders(token, {
          "content-type": "application/json"
        }),
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

      if (!response.ok || !payload.theme) {
        setState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel salvar o tema da loja.")
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
    <section className="storefront-console animate-entrance">
      <header className="storefront-console-header">
        <div>
          <div className="eyebrow">Console / Vitrine</div>
          <h2>Editor de storefront de {storeLabel}</h2>
          <p>Personalize cores, banner, logo e textos principais da vitrine publica.</p>
        </div>
        <div className="storefront-actions">
          <button className="secondary-button" onClick={loadTheme} type="button">
            Recarregar
          </button>
          <a className="primary-button" href="http://localhost:3000">
            Pre-visualizar
          </a>
        </div>
      </header>

      <DashboardFeedback state={state} />
      {isLoading && !theme.storeId ? <DashboardLoadingState label="Carregando tema da loja" /> : null}

      <section className="storefront-workbench">
        <div className="storefront-preview-card">
          <div className="storefront-preview-browser">
            <span />
            <strong>{storeLabel}</strong>
            <a href="http://localhost:3000">Abrir</a>
          </div>
          <div
            className="storefront-preview-canvas"
            style={{
              background: theme.surfaceColor,
              color: theme.primaryColor
            }}
          >
            {theme.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="Banner da vitrine" src={theme.bannerUrl} />
            ) : null}
            <div className="storefront-preview-hero">
              {theme.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={`Logo de ${storeLabel}`} src={theme.logoUrl} />
              ) : (
                <div style={{ background: theme.primaryColor }}>{storeLabel.slice(0, 2).toUpperCase()}</div>
              )}
              <span style={{ color: theme.accentColor }}>
                {theme.announcementText ?? "Nova colecao disponivel"}
              </span>
              <h3>{theme.heroTitle ?? storeLabel}</h3>
              <p>{theme.heroSubtitle ?? "A vitrine publica vai refletir essas cores, logo e textos principais."}</p>
              <button style={{ background: theme.accentColor }} type="button">
                Comprar agora
              </button>
            </div>
            <div className="storefront-preview-grid">
              {Array.from({ length: 8 }).map((_, index) => (
                <i key={index} style={{ background: theme.primaryColor }} />
              ))}
            </div>
          </div>
        </div>

        <aside className="storefront-editor-card">
          <div className="storefront-section-list">
            {SECTIONS.map((section) => (
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
          </div>

          <form className="storefront-editor-form" onSubmit={handleSubmit}>
            {activeSection === "hero" ? (
              <>
                <StorefrontField label="Titulo principal">
                  <input
                    onChange={(event) =>
                      setTheme((current) => ({
                        ...current,
                        heroTitle: event.target.value || null
                      }))
                    }
                    placeholder="Sua nova colecao chegou"
                    value={theme.heroTitle ?? ""}
                  />
                </StorefrontField>
                <StorefrontField label="Subtitulo">
                  <textarea
                    onChange={(event) =>
                      setTheme((current) => ({
                        ...current,
                        heroSubtitle: event.target.value || null
                      }))
                    }
                    rows={4}
                    value={theme.heroSubtitle ?? ""}
                  />
                </StorefrontField>
              </>
            ) : null}

            {activeSection === "brand" ? (
              <>
                <StorefrontField label="URL do logo">
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
                </StorefrontField>
                <StorefrontField label="URL do banner">
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
                </StorefrontField>
              </>
            ) : null}

            {activeSection === "colors" ? (
              <div className="storefront-color-grid">
                <StorefrontField label="Cor principal">
                  <input
                    onChange={(event) =>
                      setTheme((current) => ({ ...current, primaryColor: event.target.value }))
                    }
                    type="color"
                    value={theme.primaryColor}
                  />
                </StorefrontField>
                <StorefrontField label="Cor de destaque">
                  <input
                    onChange={(event) =>
                      setTheme((current) => ({ ...current, accentColor: event.target.value }))
                    }
                    type="color"
                    value={theme.accentColor}
                  />
                </StorefrontField>
                <StorefrontField label="Cor de fundo">
                  <input
                    onChange={(event) =>
                      setTheme((current) => ({ ...current, surfaceColor: event.target.value }))
                    }
                    type="color"
                    value={theme.surfaceColor}
                  />
                </StorefrontField>
              </div>
            ) : null}

            {activeSection === "announcement" ? (
              <StorefrontField label="Aviso curto da vitrine">
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
              </StorefrontField>
            ) : null}

            <button className="primary-button" disabled={isLoading} type="submit">
              {isLoading ? "Salvando..." : "Publicar mudancas"}
            </button>
          </form>
        </aside>
      </section>
    </section>
  );
}

function StorefrontField({
  children,
  label
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="storefront-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
