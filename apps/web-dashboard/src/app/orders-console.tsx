"use client";

import { useMemo, useState } from "react";
import {
  DashboardEmptyState,
  DashboardFeedback,
  DashboardLoadingState
} from "../components/dashboard-state";
import { authHeaders, dashboardApiJson, normalizeApiMessage } from "../lib/dashboard-api";

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

type OrdersConsoleProps = {
  token: string;
  storeId: string;
  storeLabel: string;
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

const ATTENTION_STATUSES = new Set(["PAYMENT_FAILED", "CANCELED", "REFUNDED"]);
const PENDING_STATUSES = new Set(["PENDING_PAYMENT", "PAYMENT_PENDING", "PROCESSING"]);
const SHIPPED_STATUSES = new Set(["SHIPPED", "DELIVERED"]);

function formatMoney(valueInCents: number, currencyCode: string, locale = "pt-BR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode
  }).format(valueInCents / 100);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Sem data";
  }

  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function getStatusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getOrderTone(order: ManagedOrder) {
  if (ATTENTION_STATUSES.has(order.status)) {
    return "accent";
  }

  if (PENDING_STATUSES.has(order.status)) {
    return "warn";
  }

  return "signal";
}

export function OrdersConsole({ token, storeId, storeLabel }: OrdersConsoleProps) {
  const [activeTab, setActiveTab] = useState("all");
  const [orders, setOrders] = useState<ManagedOrder[]>([]);
  const [state, setState] = useState<ApiState>({ kind: "idle" });
  const [isLoading, setIsLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, OrderDraft>>({});
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    if (activeTab === "attention") {
      return orders.filter((order) => ATTENTION_STATUSES.has(order.status));
    }

    if (activeTab === "pending") {
      return orders.filter((order) => PENDING_STATUSES.has(order.status));
    }

    if (activeTab === "shipped") {
      return orders.filter((order) => SHIPPED_STATUSES.has(order.status));
    }

    return orders;
  }, [activeTab, orders]);

  const selectedOrder =
    filteredOrders.find((order) => order.id === selectedOrderId) ?? filteredOrders[0] ?? null;

  const tabs = [
    { key: "all", label: "Todos", count: orders.length },
    {
      key: "attention",
      label: "Atencao",
      count: orders.filter((order) => ATTENTION_STATUSES.has(order.status)).length
    },
    {
      key: "pending",
      label: "Pendentes",
      count: orders.filter((order) => PENDING_STATUSES.has(order.status)).length
    },
    {
      key: "shipped",
      label: "Enviados",
      count: orders.filter((order) => SHIPPED_STATUSES.has(order.status)).length
    }
  ];

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
      const { payload, response } = await dashboardApiJson<{
        orders?: ManagedOrder[];
        message?: string;
      }>(`/orders/${storeId}/management`, {
        headers: authHeaders(token)
      });

      if (!response.ok || !payload.orders) {
        setOrders([]);
        setState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel carregar os pedidos.")
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
      setSelectedOrderId((current) => current ?? payload.orders?.[0]?.id ?? null);
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
    const draft = drafts[orderId] ?? EMPTY_DRAFT;

    if (!draft.status) {
      setState({
        kind: "error",
        message: "Escolha um proximo status antes de atualizar o pedido."
      });
      return;
    }

    setUpdatingOrderId(orderId);
    setState({ kind: "idle" });

    try {
      const { payload, response } = await dashboardApiJson<{
        order?: { status: string };
        message?: string;
      }>(`/orders/${storeId}/${orderId}/status`, {
        method: "PATCH",
        headers: authHeaders(token, {
          "content-type": "application/json"
        }),
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

      if (!response.ok || !payload.order) {
        setState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel atualizar o pedido.")
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
    <section className="orders-console animate-entrance">
      <header className="orders-console-header">
        <div>
          <div className="eyebrow">Console / Pedidos</div>
          <h2>Operacao de pedidos de {storeLabel}</h2>
          <p>
            {tabs[1].count} pedidos pedem acao / {tabs[2].count} pendentes / {tabs[3].count} enviados
          </p>
        </div>
        <button className="primary-button" disabled={isLoading} onClick={loadOrders} type="button">
          {isLoading ? "Carregando..." : "Consultar pedidos"}
        </button>
      </header>

      <DashboardFeedback state={state} />

      <nav className="orders-tabs" aria-label="Filtros de pedidos">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab.key ? "is-active" : ""}
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setSelectedOrderId(null);
            }}
            type="button"
          >
            {tab.label}
            <span>{tab.count}</span>
          </button>
        ))}
      </nav>

      {isLoading && orders.length === 0 ? (
        <DashboardLoadingState label="Carregando pedidos da loja" />
      ) : null}

      {!isLoading && filteredOrders.length === 0 ? (
        <DashboardEmptyState
          description="Ajuste os filtros ou aguarde os primeiros pedidos para iniciar a operacao por aqui."
          title="Nenhum pedido encontrado"
        />
      ) : null}

      {filteredOrders.length > 0 ? (
        <section className="orders-workbench">
          <div className="orders-list-panel">
            {filteredOrders.map((order) => (
              <button
                className={selectedOrder?.id === order.id ? "orders-row is-active" : "orders-row"}
                key={order.id}
                onClick={() => setSelectedOrderId(order.id)}
                type="button"
              >
                <span className="orders-row-id">{order.id}</span>
                <span className="orders-row-customer">
                  <strong>{order.customerFullName ?? order.customerEmail}</strong>
                  <small>{formatDate(order.createdAt)}</small>
                </span>
                <span>{formatMoney(order.totalCents, order.currencyCode)}</span>
                <span className={`orders-status is-${getOrderTone(order)}`}>
                  {getStatusLabel(order.status)}
                </span>
              </button>
            ))}
          </div>

          {selectedOrder ? (
            <OrderDetail
              draft={drafts[selectedOrder.id] ?? {
                ...EMPTY_DRAFT,
                status: selectedOrder.allowedActions[0] ?? ""
              }}
              isUpdating={updatingOrderId === selectedOrder.id}
              onDraftChange={(patch) => setDraft(selectedOrder.id, patch)}
              onUpdate={() => updateOrder(selectedOrder.id)}
              order={selectedOrder}
            />
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

function OrderDetail({
  draft,
  isUpdating,
  onDraftChange,
  onUpdate,
  order
}: {
  draft: OrderDraft;
  isUpdating: boolean;
  onDraftChange: (patch: Partial<OrderDraft>) => void;
  onUpdate: () => Promise<void>;
  order: ManagedOrder;
}) {
  return (
    <aside className="orders-detail-panel">
      <header>
        <div>
          <div className="eyebrow">Pedido {order.id}</div>
          <h3>{order.customerFullName ?? order.customerEmail}</h3>
        </div>
        <span className={`orders-status is-${getOrderTone(order)}`}>{getStatusLabel(order.status)}</span>
      </header>

      <div className="orders-metric-grid">
        <Metric label="Total" value={formatMoney(order.totalCents, order.currencyCode)} />
        <Metric label="Itens" value={String(order.itemCount)} />
        <Metric label="Pagamento" value={order.payment?.status ?? "Sem pagamento"} />
        <Metric label="Entrega" value={order.shipment?.status ?? "Sem shipment"} />
      </div>

      <div className="orders-item-list">
        {order.items.map((item) => (
          <div className="orders-item-row" key={item.id}>
            <span>
              {item.productName} x{item.quantity}
            </span>
            <strong>{formatMoney(item.totalCents, order.currencyCode)}</strong>
          </div>
        ))}
      </div>

      <section className="orders-update-form">
        <label>
          <span>Proximo status</span>
          <select
            onChange={(event) => onDraftChange({ status: event.target.value })}
            value={draft.status}
          >
            <option value="">Selecione</option>
            {order.allowedActions.map((status) => (
              <option key={status} value={status}>
                {getStatusLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Motivo / contexto</span>
          <input
            onChange={(event) => onDraftChange({ reason: event.target.value })}
            placeholder="Opcional"
            value={draft.reason}
          />
        </label>
        <div className="orders-update-grid">
          <label>
            <span>Transportadora</span>
            <input
              onChange={(event) => onDraftChange({ carrierName: event.target.value })}
              placeholder="Correios"
              value={draft.carrierName}
            />
          </label>
          <label>
            <span>Servico</span>
            <input
              onChange={(event) => onDraftChange({ serviceName: event.target.value })}
              placeholder="PAC / SEDEX"
              value={draft.serviceName}
            />
          </label>
        </div>
        <div className="orders-update-grid">
          <label>
            <span>Codigo de rastreio</span>
            <input
              onChange={(event) => onDraftChange({ trackingCode: event.target.value })}
              placeholder="AA123456789BR"
              value={draft.trackingCode}
            />
          </label>
          <label>
            <span>URL de rastreio</span>
            <input
              onChange={(event) => onDraftChange({ trackingUrl: event.target.value })}
              placeholder="https://..."
              value={draft.trackingUrl}
            />
          </label>
        </div>
        <label>
          <span>Notas operacionais</span>
          <textarea
            onChange={(event) => onDraftChange({ notes: event.target.value })}
            rows={3}
            value={draft.notes}
          />
        </label>
        <button
          className="primary-button"
          disabled={isUpdating || order.allowedActions.length === 0}
          onClick={() => void onUpdate()}
          type="button"
        >
          {isUpdating ? "Atualizando..." : "Atualizar pedido"}
        </button>
      </section>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="orders-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
