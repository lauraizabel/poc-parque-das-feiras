"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  DashboardEmptyState,
  DashboardFeedback,
  DashboardLoadingState
} from "../components/dashboard-state";
import { authHeaders, dashboardApiJson, normalizeApiMessage } from "../lib/dashboard-api";

type DomainRecord = {
  id?: string;
  host: string;
  storeId: string;
  status?: string;
  dnsTargetValue?: string | null;
  dnsErrorMessage?: string | null;
  sslErrorMessage?: string | null;
  sslLastCheckedAt?: string | null;
  activatedAt?: string | null;
};

type ApiState = {
  kind: "idle" | "success" | "error";
  message?: string;
};

type DomainConsoleProps = {
  token: string;
  storeId: string;
  storeLabel: string;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Cadastro recebido",
  AWAITING_DNS: "Aguardando DNS",
  VERIFYING: "Verificando DNS",
  SSL_PENDING: "Emitindo SSL",
  ACTIVE: "Ativo",
  ERROR: "Requer atencao",
  REMOVED: "Removido"
};

function getStatusLabel(status?: string) {
  return status ? STATUS_LABELS[status] ?? status : "n/a";
}

function getStatusTone(status?: string) {
  if (status === "ACTIVE") {
    return "signal";
  }

  if (status === "ERROR" || status === "REMOVED") {
    return "accent";
  }

  return "warn";
}

function getDnsGuidance(domain: DomainRecord | null) {
  if (!domain) {
    return "Cadastre um host www para gerar os registros esperados.";
  }

  if (domain.dnsErrorMessage?.includes("No CNAME record found")) {
    return "Nenhum CNAME foi encontrado. Crie um registro CNAME para www apontando para o destino esperado.";
  }

  if (domain.dnsErrorMessage?.includes("CNAME mismatch")) {
    return "O CNAME atual aponta para outro destino. Ajuste o valor para o alvo esperado exibido abaixo.";
  }

  if (domain.status === "SSL_PENDING") {
    return "O DNS esta correto. Aguarde a emissao e propagacao do certificado SSL.";
  }

  if (domain.status === "ACTIVE") {
    return "Dominio ativo e pronto para servir a vitrine publica da loja.";
  }

  return "Depois de salvar o CNAME no provedor DNS, aguarde a propagacao e use Verificar DNS.";
}

export function DomainConsole({ token, storeId, storeLabel }: DomainConsoleProps) {
  const [host, setHost] = useState("www.sualoja.com");
  const [domain, setDomain] = useState<DomainRecord | null>(null);
  const [state, setState] = useState<ApiState>({ kind: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<"host" | "target" | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const dnsRecords = useMemo(
    () => [
      {
        type: "CNAME",
        name: "www",
        value: domain?.dnsTargetValue ?? "Aguardando destino",
        ttl: "3600"
      }
    ],
    [domain]
  );

  async function loadCurrentDomain() {
    if (!storeId) {
      setState({
        kind: "error",
        message: "Selecione uma loja para consultar o dominio atual."
      });
      return;
    }

    setIsSubmitting(true);
    setState({ kind: "idle" });

    try {
      const { payload, response } = await dashboardApiJson<{
        domain?: DomainRecord | null;
        message?: string;
      }>(`/domains/${storeId}`, {
        headers: authHeaders(token)
      });

      if (!response.ok) {
        setDomain(null);
        setState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel consultar o dominio.")
        });
        return;
      }

      setDomain(payload.domain ?? null);
      setState({
        kind: "success",
        message: payload.domain
          ? "Dominio carregado com sucesso."
          : "Nenhum dominio proprio cadastrado para esta loja ainda."
      });
    } catch {
      setState({
        kind: "error",
        message: "Falha de rede ao consultar o dominio."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (storeId) {
      void loadCurrentDomain();
    }
  }, [storeId]);

  useEffect(() => {
    if (!autoRefresh || !domain) {
      return;
    }

    if (domain.status === "ACTIVE" || domain.status === "REMOVED") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadCurrentDomain();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoRefresh, domain, storeId]);

  async function copyValue(kind: "host" | "target", value: string | null | undefined) {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(kind);
      window.setTimeout(() => setCopiedField((current) => (current === kind ? null : current)), 1200);
    } catch {
      setState({
        kind: "error",
        message: "Nao foi possivel copiar o valor automaticamente."
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setState({ kind: "idle" });

    try {
      const { payload, response } = await dashboardApiJson<{
        domain?: DomainRecord;
        message?: string;
      }>("/domains", {
        method: "POST",
        headers: authHeaders(token, {
          "content-type": "application/json"
        }),
        body: JSON.stringify({
          storeId,
          host
        })
      });

      if (!response.ok || !payload.domain) {
        setState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel cadastrar o dominio.")
        });
        return;
      }

      setDomain(payload.domain);
      setState({
        kind: "success",
        message: "Dominio cadastrado com sucesso."
      });
    } catch {
      setState({
        kind: "error",
        message: "Falha de rede ao cadastrar o dominio."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function queueDomainAction(action: "verify-dns" | "sync-ssl" | "remove") {
    setIsSubmitting(true);
    setState({ kind: "idle" });

    try {
      const path = action === "remove" ? `/domains/${storeId}` : `/domains/${storeId}/${action}`;
      const { payload, response } = await dashboardApiJson<{
        queued?: boolean;
        removed?: boolean;
        message?: string;
      }>(path, {
        method: action === "remove" ? "DELETE" : "POST",
        headers: authHeaders(token)
      });

      if (!response.ok) {
        setState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel executar a acao solicitada.")
        });
        return;
      }

      if (action === "remove") {
        setDomain(null);
        setState({
          kind: "success",
          message: "Dominio removido com sucesso."
        });
        return;
      }

      setState({
        kind: "success",
        message:
          action === "verify-dns"
            ? "Verificacao de DNS agendada com sucesso."
            : "Atualizacao de SSL agendada com sucesso."
      });
      await loadCurrentDomain();
    } catch {
      setState({
        kind: "error",
        message: "Falha de rede ao executar a acao solicitada."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="domains-console animate-entrance">
      <header className="domains-console-header">
        <div>
          <div className="eyebrow">Console / Dominios</div>
          <h2>Dominios conectados de {storeLabel}</h2>
          <p>SSL gerenciado automaticamente e DNS monitorado pelo console.</p>
        </div>
        <div className="domains-actions">
          <button className="secondary-button" onClick={loadCurrentDomain} type="button">
            Consultar atual
          </button>
          <button
            className="primary-button"
            disabled={!domain || isSubmitting}
            onClick={() => void queueDomainAction("verify-dns")}
            type="button"
          >
            Verificar DNS
          </button>
        </div>
      </header>

      <DashboardFeedback state={state} />

      <section className="domains-workbench">
        <div className="domains-main-panel">
          <form className="domains-register-form" onSubmit={handleSubmit}>
            <label>
              <span>Host oficial</span>
              <input
                onChange={(event) => setHost(event.target.value)}
                placeholder="www.sualoja.com"
                value={host}
              />
            </label>
            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Salvando..." : "Adicionar dominio"}
            </button>
          </form>

          {isSubmitting && !domain ? (
            <DashboardLoadingState label="Carregando status do dominio" />
          ) : null}

          {!isSubmitting && !domain ? (
            <DashboardEmptyState
              description="Cadastre um host proprio quando quiser operar a vitrine fora do subdominio padrao."
              title="Nenhum dominio proprio cadastrado"
            />
          ) : null}

          {domain ? (
            <div className="domains-table">
              <div className="domains-table-row is-heading">
                <span>Host</span>
                <span>Funcao</span>
                <span>SSL</span>
                <span>DNS</span>
                <span>Acoes</span>
              </div>
              <article className="domains-table-row">
                <div>
                  <strong>{domain.host}</strong>
                  <span>https://{domain.host}</span>
                </div>
                <span>Primario</span>
                <span className={`domains-status is-${getStatusTone(domain.status)}`}>
                  {domain.status === "ACTIVE" ? "Ativo" : getStatusLabel(domain.status)}
                </span>
                <span className={`domains-status is-${getStatusTone(domain.status)}`}>
                  {getStatusLabel(domain.status)}
                </span>
                <div className="domains-row-actions">
                  <button onClick={() => void queueDomainAction("sync-ssl")} type="button">
                    Atualizar SSL
                  </button>
                  <button onClick={() => void queueDomainAction("remove")} type="button">
                    Remover
                  </button>
                </div>
              </article>
            </div>
          ) : null}
        </div>

        <aside className="domains-side-panel">
          <label className="domains-autorefresh">
            <input
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
              type="checkbox"
            />
            <span>Atualizar a cada 15s</span>
          </label>

          <div className="domains-dns-card">
            <div className="eyebrow">Registros necessarios</div>
            <h3>DNS / {domain?.host ?? "novo dominio"}</h3>
            <p>{getDnsGuidance(domain)}</p>
            <div className="domains-records">
              {dnsRecords.map((record) => (
                <div className="domains-record-row" key={`${record.type}-${record.name}`}>
                  <span>{record.type}</span>
                  <strong>{record.name}</strong>
                  <code>{record.value}</code>
                  <em>{record.ttl}</em>
                  <button
                    onClick={() => void copyValue("target", record.value)}
                    type="button"
                  >
                    {copiedField === "target" ? "Copiado" : "Copiar"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {domain?.dnsErrorMessage || domain?.sslErrorMessage ? (
            <p className="feedback error">{domain.sslErrorMessage ?? domain.dnsErrorMessage}</p>
          ) : null}
        </aside>
      </section>
    </section>
  );
}
