"use client";

import { useEffect, useMemo, useState } from "react";
import { env } from "../lib/env";

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
  payment: {
    status: string;
  } | null;
};

type CatalogProduct = {
  id: string;
  stockQuantity: number;
  status: string;
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

function getDomainStatusLabel(domain: DomainRecord | null) {
  if (!domain) {
    return "Sem domínio próprio";
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
      return "Requer atenção";
    case "REMOVED":
      return "Removido";
    default:
      return domain.status;
  }
}

function getDomainHint(domain: DomainRecord | null) {
  if (!domain) {
    return "Cadastre um domínio quando quiser tirar a loja do subdomínio padrão.";
  }

  if (domain.status === "ACTIVE") {
    return domain.activatedAt
      ? `Domínio ativo desde ${new Date(domain.activatedAt).toLocaleDateString("pt-BR")}.`
      : "Domínio ativo e servindo a vitrine pública.";
  }

  if (domain.dnsErrorMessage) {
    return domain.dnsErrorMessage;
  }

  if (domain.sslErrorMessage) {
    return domain.sslErrorMessage;
  }

  return "Continue a ativação pelo console de domínios para concluir DNS e SSL.";
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
    const revenueStatuses = new Set([
      "PAYMENT_APPROVED",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED"
    ]);
    const attentionStatuses = new Set(["PAYMENT_FAILED", "CANCELED", "REFUNDED"]);

    const revenueOrders = orders.filter((order) => revenueStatuses.has(order.status));
    const attentionOrders = orders.filter((order) => attentionStatuses.has(order.status));
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

  async function loadOverview() {
    if (!canViewOverview) {
      setOrders([]);
      setProducts([]);
      setDomain(null);
      setState({
        kind: "error",
        message: "O resumo inicial fica disponível apenas para owner e manager da loja."
      });
      return;
    }

    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const [ordersResponse, productsResponse, domainResponse] = await Promise.all([
        fetch(`${env.NEXT_PUBLIC_API_URL}/orders/${storeId}/management`, {
          headers: {
            authorization: `Bearer ${token}`
          }
        }),
        fetch(`${env.NEXT_PUBLIC_API_URL}/catalog/${storeId}/products`, {
          headers: {
            authorization: `Bearer ${token}`
          }
        }),
        fetch(`${env.NEXT_PUBLIC_API_URL}/domains/${storeId}`, {
          headers: {
            authorization: `Bearer ${token}`
          }
        })
      ]);

      const ordersPayload = (await ordersResponse.json()) as {
        orders?: ManagedOrder[];
        message?: string;
      };
      const productsPayload = (await productsResponse.json()) as {
        products?: CatalogProduct[];
        message?: string;
      };
      const domainPayload = (await domainResponse.json()) as {
        domain?: DomainRecord | null;
        message?: string;
      };

      if (!ordersResponse.ok || !ordersPayload.orders) {
        throw new Error(normalizeMessage(ordersPayload, "Nao foi possivel carregar os pedidos."));
      }

      if (!productsResponse.ok || !productsPayload.products) {
        throw new Error(
          normalizeMessage(productsPayload, "Nao foi possivel carregar os produtos.")
        );
      }

      if (!domainResponse.ok) {
        throw new Error(normalizeMessage(domainPayload, "Nao foi possivel carregar o dominio."));
      }

      setOrders(ordersPayload.orders);
      setProducts(productsPayload.products);
      setDomain(domainPayload.domain ?? null);
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
    <section className="overview-stack">
      <section className="card overview-card">
        <div className="domain-head">
          <div>
            <div className="eyebrow">Resumo operacional</div>
            <h2 className="section-title">Pulso inicial de {storeLabel}</h2>
          </div>
          <button className="secondary-button" onClick={loadOverview} type="button">
            {isLoading ? "Atualizando..." : "Atualizar resumo"}
          </button>
        </div>

        <p className="subtitle">
          Este resumo usa consultas simples do MVP para dar visibilidade rápida de pedidos,
          faturamento, catálogo e domínio sem depender de BI avançado.
        </p>

        <div className="overview-grid">
          <article className="overview-stat">
            <span>Pedidos totais</span>
            <strong>{metrics.totalOrders}</strong>
            <p>{metrics.paidOrders} pedidos contam no faturamento básico.</p>
          </article>
          <article className="overview-stat">
            <span>Faturamento básico</span>
            <strong>{formatMoney(metrics.revenueCents, currencyCode)}</strong>
            <p>Soma de pedidos aprovados, em processamento, enviados ou entregues.</p>
          </article>
          <article className="overview-stat">
            <span>Produtos publicados</span>
            <strong>{metrics.activeProducts}</strong>
            <p>{metrics.totalProducts} produtos cadastrados no total.</p>
          </article>
          <article className="overview-stat">
            <span>Pedidos com atenção</span>
            <strong>{metrics.attentionOrders}</strong>
            <p>Falhas, cancelamentos e reembolsos aparecem aqui.</p>
          </article>
        </div>
      </section>

      {state.kind !== "idle" ? (
        <p className={state.kind === "success" ? "feedback ok" : "feedback error"}>
          {state.message}
        </p>
      ) : null}

      <section className="overview-detail-grid">
        <article className="card overview-detail-card">
          <div className="eyebrow">Catálogo</div>
          <h3>Saúde do estoque</h3>
          <div className="overview-mini-grid">
            <div className="kpi">
              <span>Baixo estoque</span>
              <strong>{metrics.lowStockProducts}</strong>
            </div>
            <div className="kpi">
              <span>Sem estoque</span>
              <strong>{metrics.outOfStockProducts}</strong>
            </div>
          </div>
          <p className="overview-note">
            Produtos com até 3 unidades entram em baixo estoque para destacar reposição rápida.
          </p>
        </article>

        <article className="card overview-detail-card">
          <div className="eyebrow">Domínio</div>
          <h3>{getDomainStatusLabel(domain)}</h3>
          <div className="overview-domain-box">
            <span>Host atual</span>
            <strong>{domain?.host ?? `${defaultSubdomain}.lvh.me`}</strong>
          </div>
          <p className="overview-note">{getDomainHint(domain)}</p>
        </article>
      </section>
    </section>
  );
}
