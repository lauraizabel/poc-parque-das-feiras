"use client";

import { useEffect, useMemo, useState } from "react";
import {
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
  totalCents: number;
  currencyCode: string;
  itemCount: number;
  createdAt?: string;
  customerEmail?: string;
  customerFullName?: string | null;
  payment: {
    status: string;
  } | null;
};

type CatalogProduct = {
  id: string;
  name?: string;
  sku?: string | null;
  priceCents?: number;
  currencyCode?: string;
  stockQuantity: number;
  status: string;
  category?: {
    name: string;
  } | null;
  images?: Array<{
    imageUrl: string;
    isPrimary: boolean;
    altText: string | null;
  }>;
};

type DomainRecord = {
  host: string;
  status: string;
  dnsErrorMessage?: string | null;
  sslErrorMessage?: string | null;
  activatedAt?: string | null;
};

type OverviewConsoleProps = {
  token: string;
  storeId: string;
  storeLabel: string;
  storeRole: string;
  currencyCode: string;
  defaultSubdomain: string;
};

const REVENUE_STATUSES = new Set([
  "PAYMENT_APPROVED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED"
]);
const ATTENTION_STATUSES = new Set(["PAYMENT_FAILED", "CANCELED", "REFUNDED"]);

function formatMoney(valueInCents: number, currencyCode: string, locale = "pt-BR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode
  }).format(valueInCents / 100);
}

function getDomainStatusLabel(domain: DomainRecord | null) {
  if (!domain) {
    return "Sem dominio proprio";
  }

  switch (domain.status) {
    case "ACTIVE":
      return "Ativo";
    case "SSL_PENDING":
      return "Emitindo SSL";
    case "VERIFYING":
      return "Verificando DNS";
    case "AWAITING_DNS":
      return "Aguardando DNS";
    case "ERROR":
      return "Requer atencao";
    case "REMOVED":
      return "Removido";
    default:
      return domain.status;
  }
}

function getDomainHint(domain: DomainRecord | null) {
  if (!domain) {
    return "Cadastre um dominio quando quiser tirar a loja do subdominio padrao.";
  }

  if (domain.status === "ACTIVE") {
    return domain.activatedAt
      ? `Dominio ativo desde ${new Date(domain.activatedAt).toLocaleDateString("pt-BR")}.`
      : "Dominio ativo e servindo a vitrine publica.";
  }

  if (domain.dnsErrorMessage) {
    return domain.dnsErrorMessage;
  }

  if (domain.sslErrorMessage) {
    return domain.sslErrorMessage;
  }

  return "Continue a ativacao pelo console de dominios para concluir DNS e SSL.";
}

function getToneForProduct(product: CatalogProduct) {
  if (product.status === "OUT_OF_STOCK" || product.stockQuantity <= 0) {
    return "accent";
  }

  if (product.stockQuantity <= 3) {
    return "warn";
  }

  return "signal";
}

function getOrderDayKey(order: ManagedOrder) {
  if (!order.createdAt) {
    return "Sem data";
  }

  return new Date(order.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit"
  });
}

export function OverviewConsole({
  token,
  storeId,
  storeLabel,
  storeRole,
  currencyCode,
  defaultSubdomain
}: OverviewConsoleProps) {
  const [orders, setOrders] = useState<ManagedOrder[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [domain, setDomain] = useState<DomainRecord | null>(null);
  const [state, setState] = useState<ApiState>({ kind: "idle" });
  const [isLoading, setIsLoading] = useState(false);

  const canViewOverview = storeRole === "STORE_OWNER" || storeRole === "STORE_MANAGER";

  const metrics = useMemo(() => {
    const revenueOrders = orders.filter((order) => REVENUE_STATUSES.has(order.status));
    const attentionOrders = orders.filter((order) => ATTENTION_STATUSES.has(order.status));
    const activeProducts = products.filter((product) => product.status === "ACTIVE").length;
    const outOfStockProducts = products.filter(
      (product) => product.status === "OUT_OF_STOCK" || product.stockQuantity <= 0
    ).length;
    const lowStockProducts = products.filter(
      (product) =>
        product.status !== "ARCHIVED" &&
        product.status !== "DRAFT" &&
        product.stockQuantity > 0 &&
        product.stockQuantity <= 3
    ).length;

    return {
      totalOrders: orders.length,
      revenueCents: revenueOrders.reduce((sum, order) => sum + order.totalCents, 0),
      paidOrders: revenueOrders.length,
      attentionOrders: attentionOrders.length,
      totalProducts: products.length,
      activeProducts,
      lowStockProducts,
      outOfStockProducts
    };
  }, [orders, products]);

  const orderFlow = useMemo(() => {
    const grouped = new Map<string, number>();

    for (const order of orders) {
      const key = getOrderDayKey(order);
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }

    const rows = Array.from(grouped.entries()).slice(-14);

    if (rows.length === 0) {
      return [{ label: "Hoje", value: 0 }];
    }

    return rows.map(([label, value]) => ({ label, value }));
  }, [orders]);

  const recentProducts = useMemo(() => products.slice(0, 5), [products]);

  async function loadOverview() {
    if (!canViewOverview) {
      setOrders([]);
      setProducts([]);
      setDomain(null);
      setState({
        kind: "error",
        message: "O resumo inicial fica disponivel apenas para owner e manager da loja."
      });
      return;
    }

    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const [ordersResult, productsResult, domainResult] = await Promise.all([
        dashboardApiJson<{ orders?: ManagedOrder[]; message?: string }>(
          `/orders/${storeId}/management`,
          {
            headers: authHeaders(token)
          }
        ),
        dashboardApiJson<{ products?: CatalogProduct[]; message?: string }>(
          `/catalog/${storeId}/products`,
          {
            headers: authHeaders(token)
          }
        ),
        dashboardApiJson<{ domain?: DomainRecord | null; message?: string }>(
          `/domains/${storeId}`,
          {
            headers: authHeaders(token)
          }
        )
      ]);

      if (!ordersResult.response.ok || !ordersResult.payload.orders) {
        throw new Error(
          normalizeApiMessage(ordersResult.payload, "Nao foi possivel carregar os pedidos.")
        );
      }

      if (!productsResult.response.ok || !productsResult.payload.products) {
        throw new Error(
          normalizeApiMessage(productsResult.payload, "Nao foi possivel carregar os produtos.")
        );
      }

      if (!domainResult.response.ok) {
        throw new Error(
          normalizeApiMessage(domainResult.payload, "Nao foi possivel carregar o dominio.")
        );
      }

      setOrders(ordersResult.payload.orders);
      setProducts(productsResult.payload.products);
      setDomain(domainResult.payload.domain ?? null);
      setState({
        kind: "success",
        message: "Resumo operacional atualizado com sucesso."
      });
    } catch (error) {
      setOrders([]);
      setProducts([]);
      setDomain(null);
      setState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Falha de rede ao carregar o resumo."
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!storeId) {
      return;
    }

    void loadOverview();
  }, [storeId, storeRole, token]);

  return (
    <section className="overview-console animate-entrance">
      <section className="overview-kpi-grid">
        <OverviewKpi
          delta={`${metrics.paidOrders} contam no faturamento`}
          label="Pedidos totais"
          tone="signal"
          value={String(metrics.totalOrders)}
        />
        <OverviewKpi
          delta="Pedidos aprovados, em processamento, enviados ou entregues"
          label="Faturamento"
          prefix={currencyCode}
          tone="signal"
          value={formatMoney(metrics.revenueCents, currencyCode)}
        />
        <OverviewKpi
          accent
          delta="Falhas, cancelamentos e reembolsos"
          label="Atencao necessaria"
          tone="accent"
          value={String(metrics.attentionOrders)}
        />
        <OverviewKpi
          delta={`${metrics.outOfStockProducts} sem estoque`}
          label="Baixo estoque"
          tone="warn"
          value={String(metrics.lowStockProducts)}
        />
      </section>

      <DashboardFeedback state={state} />

      {isLoading && orders.length === 0 && products.length === 0 ? (
        <DashboardLoadingState label="Montando resumo operacional da loja" />
      ) : null}

      <section className="overview-operational-grid">
        <article className="overview-panel overview-flow-panel">
          <header className="overview-panel-header">
            <div>
              <div className="eyebrow">Pedidos / ultimos movimentos</div>
              <h2>Fluxo operacional</h2>
            </div>
            <button className="secondary-button" onClick={loadOverview} type="button">
              {isLoading ? "Atualizando..." : "Atualizar"}
            </button>
          </header>
          <SparkBars data={orderFlow} />
        </article>

        <aside className="overview-side-stack">
          <article className="overview-panel">
            <div className="eyebrow">Saude do dominio</div>
            <div className="overview-domain-status">{getDomainStatusLabel(domain)}</div>
            <div className="overview-domain-host">
              {domain?.host ?? `${defaultSubdomain}.lvh.me`}
            </div>
            <p>{getDomainHint(domain)}</p>
          </article>

          <article className="overview-storefront-card">
            <div className="eyebrow">Storefront</div>
            <strong>{domain?.host ?? `${defaultSubdomain}.lvh.me`}</strong>
            <span>{storeLabel}</span>
            <a href="http://localhost:3000">Abrir loja</a>
          </article>
        </aside>
      </section>

      <section className="overview-panel">
        <header className="overview-panel-header">
          <div>
            <div className="eyebrow">Catalogo recente</div>
            <h2>Produtos publicados e estoque</h2>
          </div>
          <span className="overview-total-pill">{metrics.totalProducts} produtos</span>
        </header>

        <div className="overview-product-list">
          {recentProducts.length > 0 ? (
            recentProducts.map((product) => (
              <ProductRow
                currencyCode={currencyCode}
                key={product.id}
                product={product}
              />
            ))
          ) : (
            <div className="overview-empty-row">
              Nenhum produto encontrado para montar o catalogo recente.
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

function OverviewKpi({
  accent,
  delta,
  label,
  prefix,
  tone,
  value
}: {
  accent?: boolean;
  delta: string;
  label: string;
  prefix?: string;
  tone: "signal" | "warn" | "accent";
  value: string;
}) {
  return (
    <article className="overview-kpi-card">
      <div className="eyebrow">{label}</div>
      <div className={accent ? "overview-kpi-value is-accent" : "overview-kpi-value"}>
        {prefix ? <span>{prefix}</span> : null}
        <strong>{value}</strong>
      </div>
      <p className={`overview-kpi-delta is-${tone}`}>{delta}</p>
    </article>
  );
}

function SparkBars({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="overview-spark">
      <div className="overview-spark-bars">
        {data.map((item, index) => (
          <div className="overview-spark-item" key={`${item.label}-${index}`}>
            <span
              className={index === data.length - 1 ? "is-current" : ""}
              style={{ height: `${Math.max((item.value / max) * 100, item.value > 0 ? 10 : 4)}%` }}
              title={`${item.label}: ${item.value}`}
            />
          </div>
        ))}
      </div>
      <div className="overview-spark-labels">
        <span>{data[0]?.label ?? "Inicio"}</span>
        <strong>{data.reduce((sum, item) => sum + item.value, 0)} pedidos</strong>
        <span>{data[data.length - 1]?.label ?? "Hoje"}</span>
      </div>
    </div>
  );
}

function ProductRow({
  currencyCode,
  product
}: {
  currencyCode: string;
  product: CatalogProduct;
}) {
  const primaryImage = product.images?.find((image) => image.isPrimary) ?? product.images?.[0];
  const tone = getToneForProduct(product);
  const stockPercent = Math.max(0, Math.min(product.stockQuantity * 10, 100));

  return (
    <article className="overview-product-row">
      <div className="overview-product-thumb">
        {primaryImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={primaryImage.altText ?? product.name ?? "Produto"} src={primaryImage.imageUrl} />
        ) : (
          <span>IMG</span>
        )}
      </div>
      <div className="overview-product-main">
        <strong>{product.name ?? product.id}</strong>
        <span>
          {product.category?.name ?? "Sem categoria"} / {product.sku ?? "sem SKU"}
        </span>
      </div>
      <div className="overview-product-price">
        {formatMoney(product.priceCents ?? 0, product.currencyCode ?? currencyCode)}
      </div>
      <div className="overview-stock-meter">
        <span>
          <i className={`is-${tone}`} style={{ width: `${stockPercent}%` }} />
        </span>
        <strong>{product.stockQuantity}</strong>
      </div>
    </article>
  );
}
