"use client";

import { useMemo, useState } from "react";
import { env } from "../lib/env";
import {
  DashboardEmptyState,
  DashboardFeedback,
  DashboardLoadingState
} from "../components/dashboard-state";

type ApiState = {
  kind: "idle" | "success" | "error";
  message?: string;
};

type ManagedOrder = {
  id: string;
  status: string;
  customerEmail: string;
  customerFullName: string | null;
  currencyCode: string;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  itemCount: number;
  createdAt: string;
  statusUpdatedAt: string;
  approvedAt: string | null;
  canceledAt: string | null;
  refundedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  payment: {
    id: string;
    status: string;
    amountCents: number;
    paidAt: string | null;
  } | null;
  shipment: {
    id: string;
    status: string;
    shippingMethodName: string;
    carrierName: string | null;
    serviceName: string | null;
    trackingCode: string | null;
    trackingUrl: string | null;
    estimatedDaysMin: number | null;
    estimatedDaysMax: number | null;
    postedAt: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
    canceledAt: string | null;
    notes: string | null;
  } | null;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    totalCents: number;
  }>;
  allowedActions: string[];
};

type OrderDraft = {
  status: string;
  reason: string;
  carrierName: string;
  serviceName: string;
  trackingCode: string;
  trackingUrl: string;
  notes: string;
};

const EMPTY_DRAFT: OrderDraft = {
  status: "",
  reason: "",
  carrierName: "",
  serviceName: "",
  trackingCode: "",
  trackingUrl: "",
  notes: ""
};

function formatMoney(valueInCents: number, currencyCode: string, locale = "pt-BR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode
  }).format(valueInCents / 100);
}

function normalizeMessage(payload: unknown, fallback: string) {
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const value = (payload as { message?: unknown }).message;

    if (typeof value === "string") {
      return value;
    }
  }

  return fallback;
}

type OrdersConsoleProps = {
  token: string;
  storeId: string;
  storeLabel: string;
};

export function OrdersConsole({ token, storeId, storeLabel }: OrdersConsoleProps) {
  const [statusFilter, setStatusFilter] = useState("");
  const [orders, setOrders] = useState<ManagedOrder[]>([]);
  const [state, setState] = useState<ApiState>({ kind: "idle" });
  const [isLoading, setIsLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, OrderDraft>>({});
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const ordersById = useMemo(
    () =>
      new Map(
        orders.map((order) => [
          order.id,
          drafts[order.id] ?? {
            ...EMPTY_DRAFT,
            status: order.allowedActions[0] ?? ""
          }
        ])
      ),
    [drafts, orders]
  );

  async function loadOrders() {
    if (!token || !storeId) {
      setState({
        kind: "error",
        message: "Selecione uma loja valida para consultar os pedidos."
      });
      return;
    }

    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const search = new URLSearchParams();

      if (statusFilter) {
        search.set("status", statusFilter);
      }

      const response = await fetch(
        `${env.NEXT_PUBLIC_API_URL}/orders/${storeId}/management${search.size > 0 ? `?${search}` : ""}`,
        {
          headers: {
            authorization: `Bearer ${token}`
          }
        }
      );
      const payload = (await response.json()) as {
        orders?: ManagedOrder[];
        message?: string;
      };

      if (!response.ok || !payload.orders) {
        setOrders([]);
        setState({
          kind: "error",
          message: normalizeMessage(payload, "Nao foi possivel carregar os pedidos.")
        });
        return;
      }

      setOrders(payload.orders);
      setDrafts((current) => {
        const next = { ...current };

        for (const order of payload.orders ?? []) {
          next[order.id] = current[order.id] ?? {
            ...EMPTY_DRAFT,
            status: order.allowedActions[0] ?? ""
          };
        }

        return next;
      });
      setState({
        kind: "success",
        message:
          payload.orders.length > 0
            ? "Pedidos carregados com sucesso."
            : "Nenhum pedido encontrado para o filtro atual."
      });
    } catch {
      setState({
        kind: "error",
        message: "Falha de rede ao carregar os pedidos."
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function updateOrder(orderId: string) {
    const draft = ordersById.get(orderId);

    if (!draft?.status) {
      setState({
        kind: "error",
        message: "Escolha um proximo status antes de atualizar o pedido."
      });
      return;
    }

    setUpdatingOrderId(orderId);
    setState({ kind: "idle" });

    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/orders/${storeId}/${orderId}/status`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          storeId,
          status: draft.status,
          reason: draft.reason || undefined,
          carrierName: draft.carrierName || undefined,
          serviceName: draft.serviceName || undefined,
          trackingCode: draft.trackingCode || undefined,
          trackingUrl: draft.trackingUrl || undefined,
          notes: draft.notes || undefined
        })
      });
      const payload = (await response.json()) as {
        order?: { status: string };
        message?: string;
      };

      if (!response.ok || !payload.order) {
        setState({
          kind: "error",
          message: normalizeMessage(payload, "Nao foi possivel atualizar o pedido.")
        });
        return;
      }

      setState({
        kind: "success",
        message: `Pedido ${orderId} atualizado para ${payload.order.status}.`
      });
      await loadOrders();
    } catch {
      setState({
        kind: "error",
        message: "Falha de rede ao atualizar o pedido."
      });
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function setDraft(orderId: string, patch: Partial<OrderDraft>) {
    setDrafts((current) => ({
      ...current,
      [orderId]: {
        ...(current[orderId] ?? EMPTY_DRAFT),
        ...patch
      }
    }));
  }

  return (
    <section className="card orders-card">
      <div className="domain-head">
        <div>
          <div className="eyebrow">Orders ops</div>
          <h2 className="section-title">Gestao operacional de pedidos de {storeLabel}</h2>
        </div>
        <button className="secondary-button" onClick={loadOrders} type="button">
          Atualizar lista
        </button>
      </div>

      <p className="subtitle">
        Os pedidos abaixo respeitam a loja selecionada no shell e so usam o token do usuario
        autenticado no dashboard.
      </p>

      <div className="field-grid">
        <div className="orders-filter-stack">
          <label className="field">
            <span>Store ID</span>
            <input
              disabled
              placeholder="cm..."
              value={storeId}
            />
          </label>
          <label className="field">
            <span>Filtro de status</span>
            <select
              className="field-select"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="">Todos</option>
              <option value="PAYMENT_APPROVED">PAYMENT_APPROVED</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="SHIPPED">SHIPPED</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="CANCELED">CANCELED</option>
            </select>
          </label>
        </div>
      </div>

      <div className="button-row">
        <button className="primary-button" disabled={isLoading} onClick={loadOrders} type="button">
          {isLoading ? "Carregando..." : "Consultar pedidos"}
        </button>
      </div>

      <DashboardFeedback state={state} />

      {isLoading && orders.length === 0 ? (
        <DashboardLoadingState label="Carregando pedidos da loja" />
      ) : null}

      {!isLoading && orders.length === 0 ? (
        <DashboardEmptyState
          description="Ajuste o filtro ou aguarde os primeiros pedidos para iniciar a operação por aqui."
          title="Nenhum pedido encontrado"
        />
      ) : null}

      <div className="orders-list">
        {orders.map((order) => {
          const draft = ordersById.get(order.id) ?? {
            ...EMPTY_DRAFT,
            status: order.allowedActions[0] ?? ""
          };

          return (
            <article className="order-card" key={order.id}>
              <div className="order-head">
                <div>
                  <div className="eyebrow">Pedido {order.id}</div>
                  <h3>{order.customerFullName ?? order.customerEmail}</h3>
                </div>
                <div className="order-status-badge">{order.status}</div>
              </div>

              <div className="order-grid">
                <div>
                  <span className="order-label">Resumo</span>
                  <strong>{formatMoney(order.totalCents, order.currencyCode)}</strong>
                  <p className="order-meta">
                    {order.itemCount} item(ns) • frete {formatMoney(order.shippingCents, order.currencyCode)}
                  </p>
                </div>
                <div>
                  <span className="order-label">Pagamento</span>
                  <strong>{order.payment?.status ?? "Sem pagamento"}</strong>
                  <p className="order-meta">{order.payment?.paidAt ?? "Aguardando conciliacao"}</p>
                </div>
                <div>
                  <span className="order-label">Entrega</span>
                  <strong>{order.shipment?.status ?? "Sem shipment"}</strong>
                  <p className="order-meta">
                    {order.shipment?.carrierName ?? order.shipment?.shippingMethodName ?? "Fluxo interno"}
                  </p>
                </div>
              </div>

              <div className="order-items">
                {order.items.map((item) => (
                  <div className="order-item-row" key={item.id}>
                    <span>
                      {item.productName} x{item.quantity}
                    </span>
                    <strong>{formatMoney(item.totalCents, order.currencyCode)}</strong>
                  </div>
                ))}
              </div>

              <div className="field-grid compact-grid">
                <label className="field">
                  <span>Proximo status</span>
                  <select
                    className="field-select"
                    onChange={(event) => setDraft(order.id, { status: event.target.value })}
                    value={draft.status}
                  >
                    <option value="">Selecione</option>
                    {order.allowedActions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Motivo / contexto</span>
                  <input
                    onChange={(event) => setDraft(order.id, { reason: event.target.value })}
                    placeholder="Opcional"
                    value={draft.reason}
                  />
                </label>
                <label className="field">
                  <span>Transportadora</span>
                  <input
                    onChange={(event) => setDraft(order.id, { carrierName: event.target.value })}
                    placeholder="Correios"
                    value={draft.carrierName}
                  />
                </label>
                <label className="field">
                  <span>Servico</span>
                  <input
                    onChange={(event) => setDraft(order.id, { serviceName: event.target.value })}
                    placeholder="PAC / SEDEX"
                    value={draft.serviceName}
                  />
                </label>
                <label className="field">
                  <span>Codigo de rastreio</span>
                  <input
                    onChange={(event) => setDraft(order.id, { trackingCode: event.target.value })}
                    placeholder="AA123456789BR"
                    value={draft.trackingCode}
                  />
                </label>
                <label className="field">
                  <span>URL de rastreio</span>
                  <input
                    onChange={(event) => setDraft(order.id, { trackingUrl: event.target.value })}
                    placeholder="https://..."
                    value={draft.trackingUrl}
                  />
                </label>
              </div>

              <label className="field">
                <span>Notas operacionais</span>
                <textarea
                  onChange={(event) => setDraft(order.id, { notes: event.target.value })}
                  rows={2}
                  value={draft.notes}
                />
              </label>

              <div className="button-row">
                <button
                  className="primary-button"
                  disabled={updatingOrderId === order.id || order.allowedActions.length === 0}
                  onClick={() => updateOrder(order.id)}
                  type="button"
                >
                  {updatingOrderId === order.id ? "Atualizando..." : "Atualizar pedido"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
