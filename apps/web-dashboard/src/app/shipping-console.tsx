"use client";

import { FormEvent, useEffect, useState } from "react";
import { env } from "../lib/env";
import {
  DashboardEmptyState,
  DashboardFeedback,
  DashboardLoadingState
} from "../components/dashboard-state";
import {
  formatShippingMethodStatusLabel,
  formatShippingMethodTypeLabel
} from "../lib/enum-labels";

type ApiState = {
  kind: "idle" | "success" | "error";
  message?: string;
};

type ShippingMethod = {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  priceCents: number;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  minimumOrderCents: number | null;
  maximumOrderCents: number | null;
  sortOrder: number;
  isDefault: boolean;
};

type ShippingFormState = {
  id: string | null;
  name: string;
  description: string;
  type: string;
  status: string;
  priceCents: string;
  estimatedDaysMin: string;
  estimatedDaysMax: string;
  minimumOrderCents: string;
  maximumOrderCents: string;
  sortOrder: string;
  isDefault: boolean;
};

type ShippingConsoleProps = {
  token: string;
  storeId: string;
  storeLabel: string;
};

const EMPTY_FORM: ShippingFormState = {
  id: null,
  name: "",
  description: "",
  type: "FIXED_PRICE",
  status: "ACTIVE",
  priceCents: "0",
  estimatedDaysMin: "",
  estimatedDaysMax: "",
  minimumOrderCents: "",
  maximumOrderCents: "",
  sortOrder: "0",
  isDefault: false
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

function formatMoney(valueInCents: number, locale = "pt-BR", currencyCode = "BRL") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode
  }).format(valueInCents / 100);
}

function nullableNumber(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? Number(normalized) : null;
}

export function ShippingConsole({ token, storeId, storeLabel }: ShippingConsoleProps) {
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [form, setForm] = useState<ShippingFormState>(EMPTY_FORM);
  const [state, setState] = useState<ApiState>({ kind: "idle" });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadShippingMethods() {
    if (!storeId) {
      return;
    }

    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/shipping/${storeId}/methods`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as {
        shippingMethods?: ShippingMethod[];
        message?: string;
      };

      if (!response.ok || !payload.shippingMethods) {
        setShippingMethods([]);
        setState({
          kind: "error",
          message: normalizeMessage(payload, "Nao foi possivel carregar os fretes.")
        });
        return;
      }

      setShippingMethods(payload.shippingMethods);
      setState({
        kind: "success",
        message:
          payload.shippingMethods.length > 0
            ? "Configura��es de frete carregadas."
            : "Nenhum m�todo de frete cadastrado ainda."
      });
    } catch {
      setShippingMethods([]);
      setState({
        kind: "error",
        message: "Falha de rede ao carregar os fretes."
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadShippingMethods();
  }, [storeId, token]);

  function startEditing(method: ShippingMethod) {
    setForm({
      id: method.id,
      name: method.name,
      description: method.description ?? "",
      type: method.type,
      status: method.status,
      priceCents: String(method.priceCents),
      estimatedDaysMin: method.estimatedDaysMin === null ? "" : String(method.estimatedDaysMin),
      estimatedDaysMax: method.estimatedDaysMax === null ? "" : String(method.estimatedDaysMax),
      minimumOrderCents: method.minimumOrderCents === null ? "" : String(method.minimumOrderCents),
      maximumOrderCents: method.maximumOrderCents === null ? "" : String(method.maximumOrderCents),
      sortOrder: String(method.sortOrder),
      isDefault: method.isDefault
    });
  }

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setState({ kind: "idle" });

    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_API_URL}/shipping/${form.id ? `methods/${form.id}` : "methods"}`,
        {
          method: form.id ? "PATCH" : "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            storeId,
            name: form.name,
            description: form.description || undefined,
            type: form.type,
            status: form.status,
            priceCents: Number(form.priceCents),
            estimatedDaysMin: nullableNumber(form.estimatedDaysMin),
            estimatedDaysMax: nullableNumber(form.estimatedDaysMax),
            minimumOrderCents: nullableNumber(form.minimumOrderCents),
            maximumOrderCents: nullableNumber(form.maximumOrderCents),
            sortOrder: Number(form.sortOrder),
            isDefault: form.isDefault
          })
        }
      );
      const payload = (await response.json()) as {
        shippingMethod?: ShippingMethod;
        message?: string;
      };

      if (!response.ok || !payload.shippingMethod) {
        setState({
          kind: "error",
          message: normalizeMessage(payload, "Nao foi possivel salvar o frete.")
        });
        return;
      }

      setState({
        kind: "success",
        message: form.id ? "Frete atualizado com sucesso." : "Frete criado com sucesso."
      });
      resetForm();
      await loadShippingMethods();
    } catch {
      setState({
        kind: "error",
        message: "Falha de rede ao salvar o frete."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="card settings-card">
      <div className="domain-head">
        <div>
          <div className="eyebrow">Frete</div>
          <h2 className="section-title">M�todos de entrega de {storeLabel}</h2>
        </div>
        <button className="secondary-button" onClick={loadShippingMethods} type="button">
          {isLoading ? "Atualizando..." : "Atualizar fretes"}
        </button>
      </div>

      <p className="subtitle">
        Cadastre as op��es que a vitrine usa no checkout e mantenha a opera��o log�stica alinhada
        com a loja selecionada.
      </p>

      <form className="domain-form" onSubmit={handleSubmit}>
        <div className="field-grid">
          <label className="field">
            <span>Nome</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              value={form.name}
            />
          </label>
          <label className="field">
            <span>Tipo</span>
            <select
              className="field-select"
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
              value={form.type}
            >
              <option value="FIXED_PRICE">Pre�o fixo</option>
              <option value="LOCAL_PICKUP">Retirada local</option>
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select
              className="field-select"
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value }))
              }
              value={form.status}
            >
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
            </select>
          </label>
          <label className="field">
            <span>Pre�o (centavos)</span>
            <input
              min="0"
              onChange={(event) =>
                setForm((current) => ({ ...current, priceCents: event.target.value }))
              }
              type="number"
              value={form.priceCents}
            />
          </label>
          <label className="field">
            <span>Prazo m�nimo (dias)</span>
            <input
              min="0"
              onChange={(event) =>
                setForm((current) => ({ ...current, estimatedDaysMin: event.target.value }))
              }
              type="number"
              value={form.estimatedDaysMin}
            />
          </label>
          <label className="field">
            <span>Prazo m�ximo (dias)</span>
            <input
              min="0"
              onChange={(event) =>
                setForm((current) => ({ ...current, estimatedDaysMax: event.target.value }))
              }
              type="number"
              value={form.estimatedDaysMax}
            />
          </label>
          <label className="field">
            <span>Pedido m�nimo (centavos)</span>
            <input
              min="0"
              onChange={(event) =>
                setForm((current) => ({ ...current, minimumOrderCents: event.target.value }))
              }
              type="number"
              value={form.minimumOrderCents}
            />
          </label>
          <label className="field">
            <span>Pedido m�ximo (centavos)</span>
            <input
              min="0"
              onChange={(event) =>
                setForm((current) => ({ ...current, maximumOrderCents: event.target.value }))
              }
              type="number"
              value={form.maximumOrderCents}
            />
          </label>
          <label className="field">
            <span>Ordem</span>
            <input
              min="0"
              onChange={(event) =>
                setForm((current) => ({ ...current, sortOrder: event.target.value }))
              }
              type="number"
              value={form.sortOrder}
            />
          </label>
        </div>

        <label className="field">
          <span>Descri��o</span>
          <textarea
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            rows={3}
            value={form.description}
          />
        </label>

        <label className="feature-toggle">
          <input
            checked={form.isDefault}
            onChange={(event) =>
              setForm((current) => ({ ...current, isDefault: event.target.checked }))
            }
            type="checkbox"
          />
          <span>Usar como m�todo padr�o</span>
        </label>

        <div className="button-row">
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Salvando..." : form.id ? "Atualizar frete" : "Criar frete"}
          </button>
          <button className="secondary-button" onClick={resetForm} type="button">
            Limpar formul�rio
          </button>
        </div>
      </form>

      <DashboardFeedback state={state} />

      {isLoading && shippingMethods.length === 0 ? (
        <DashboardLoadingState label="Carregando m�todos de frete" />
      ) : null}

      <div className="shipping-list">
        {shippingMethods.map((method) => (
          <article className="shipping-card" key={method.id}>
            <div className="catalog-item-head">
              <div>
                <div className="eyebrow">{formatShippingMethodTypeLabel(method.type)}</div>
                <h3>{method.name}</h3>
              </div>
              <span className="catalog-status-badge">
                {formatShippingMethodStatusLabel(method.status)} {method.isDefault ? "� padr�o" : ""}
              </span>
            </div>

            <div className="catalog-meta-grid">
              <div>
                <span>Pre�o</span>
                <strong>{formatMoney(method.priceCents)}</strong>
              </div>
              <div>
                <span>Prazo</span>
                <strong>
                  {method.estimatedDaysMin ?? 0} - {method.estimatedDaysMax ?? 0} dias
                </strong>
              </div>
              <div>
                <span>Faixa de pedido</span>
                <strong>
                  {method.minimumOrderCents ?? 0} at� {method.maximumOrderCents ?? "sem teto"}
                </strong>
              </div>
            </div>

            {method.description ? <p className="catalog-description">{method.description}</p> : null}

            <div className="button-row">
              <button className="secondary-button" onClick={() => startEditing(method)} type="button">
                Editar m�todo
              </button>
            </div>
          </article>
        ))}
      </div>

      {!isLoading && shippingMethods.length === 0 ? (
        <DashboardEmptyState
          description="Cadastre pelo menos um m�todo ativo para liberar uma configura��o de entrega no checkout."
          title="Nenhum frete cadastrado"
        />
      ) : null}
    </section>
  );
}

