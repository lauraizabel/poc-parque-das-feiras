"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  DashboardEmptyState,
  DashboardFeedback,
  DashboardLoadingState
} from "../components/dashboard-state";
import { env } from "../lib/env";

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

type ActivationStep = {
  key: "registered" | "dns" | "ssl" | "active";
  title: string;
  description: string;
  state: "done" | "current" | "pending" | "error";
};

function getStatusLabel(status?: string) {
  switch (status) {
    case "PENDING":
      return "Cadastro recebido";
    case "AWAITING_DNS":
      return "Aguardando DNS correto";
    case "VERIFYING":
      return "Verificando DNS";
    case "SSL_PENDING":
      return "Emitindo SSL";
    case "ACTIVE":
      return "Domínio ativo";
    case "ERROR":
      return "Atenção necessária";
    case "REMOVED":
      return "Domínio removido";
    default:
      return status ?? "n/a";
  }
}

function getDnsGuidance(domain: DomainRecord | null) {
  if (!domain) {
    return null;
  }

  if (domain.dnsErrorMessage?.includes("No CNAME record found")) {
    return "Nenhum CNAME foi encontrado ainda. Crie um registro CNAME para `www` apontando para o destino esperado.";
  }

  if (domain.dnsErrorMessage?.includes("CNAME mismatch")) {
    return "O domínio já tem um CNAME configurado, mas ele ainda aponta para outro destino. Ajuste o valor para o alvo esperado exibido abaixo.";
  }

  if (domain.status === "SSL_PENDING") {
    return "O DNS já está correto. Agora basta aguardar a emissão e propagação do certificado SSL.";
  }

  if (domain.status === "ACTIVE") {
    return "O domínio já está ativo e pronto para servir a vitrine pública da loja.";
  }

  return "Depois de salvar o CNAME no provedor DNS, aguarde a propagação e use o botão de verificação para atualizar o status.";
}

function getActivationSteps(domain: DomainRecord | null): ActivationStep[] {
  const status = domain?.status;

  return [
    {
      key: "registered",
      title: "Cadastro do host",
      description: domain ? `Host ${domain.host} salvo na plataforma.` : "Domínio ainda não cadastrado.",
      state: domain ? "done" : "pending"
    },
    {
      key: "dns",
      title: "Apontamento DNS",
      description: domain?.dnsTargetValue
        ? `Crie o CNAME de www para ${domain.dnsTargetValue}.`
        : "Aguardando definição do destino DNS.",
      state:
        status === "ERROR" && domain?.dnsErrorMessage
          ? "error"
          : status === "SSL_PENDING" || status === "ACTIVE"
            ? "done"
            : status === "VERIFYING" || status === "AWAITING_DNS"
              ? "current"
              : domain
                ? "pending"
                : "pending"
    },
    {
      key: "ssl",
      title: "Emissão de SSL",
      description: "Após o DNS correto, a plataforma solicita e acompanha o certificado.",
      state:
        status === "ERROR" && domain?.sslErrorMessage
          ? "error"
          : status === "ACTIVE"
            ? "done"
            : status === "SSL_PENDING"
              ? "current"
              : domain
                ? "pending"
                : "pending"
    },
    {
      key: "active",
      title: "Domínio ativo",
      description: "Quando ativo, a vitrine responde pelo domínio customizado com SSL válido.",
      state: status === "ACTIVE" ? "done" : status === "ERROR" ? "pending" : "pending"
    }
  ];
}

export function DomainConsole({ token, storeId, storeLabel }: DomainConsoleProps) {
  const [host, setHost] = useState("www.sualoja.com");
  const [domain, setDomain] = useState<DomainRecord | null>(null);
  const [state, setState] = useState<ApiState>({ kind: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<"host" | "target" | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

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
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/domains/${storeId}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as {
        domain?: DomainRecord | null;
        message?: string;
      };

      if (!response.ok) {
        setDomain(null);
        setState({
          kind: "error",
          message: payload.message ?? "Nao foi possivel consultar o dominio."
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
        message: "Não foi possível copiar o valor automaticamente."
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setState({ kind: "idle" });

    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/domains`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          storeId,
          host
        })
      });
      const payload = (await response.json()) as {
        domain?: DomainRecord;
        message?: string;
      };

      if (!response.ok || !payload.domain) {
        setState({
          kind: "error",
          message: payload.message ?? "Nao foi possivel cadastrar o dominio."
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

  const activationSteps = getActivationSteps(domain);

  return (
    <section className="card domain-card">
      <div className="domain-head">
        <div>
          <div className="eyebrow">Custom domain</div>
          <h2 className="section-title">Dominio proprio de {storeLabel}</h2>
        </div>
        <button className="secondary-button" onClick={loadCurrentDomain} type="button">
          Consultar atual
        </button>
      </div>

      <p className="subtitle">
        O fluxo oficial do MVP aceita apenas hosts `www`. Exemplo: `www.sualoja.com`.
      </p>

      <form className="domain-form" onSubmit={handleSubmit}>
        <div className="field-grid">
          <label className="field">
            <span>Store ID</span>
            <input
              disabled
              value={storeId}
              placeholder="cm..."
            />
          </label>

          <label className="field">
            <span>Host oficial</span>
            <input
              value={host}
              onChange={(event) => setHost(event.target.value)}
              placeholder="www.sualoja.com"
            />
          </label>
        </div>

        <div className="button-row">
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Salvando..." : "Cadastrar dominio"}
          </button>
        </div>
      </form>

      <DashboardFeedback state={state} />

      {isSubmitting && !domain ? (
        <DashboardLoadingState label="Carregando status do domínio" />
      ) : null}

      {!isSubmitting && !domain ? (
        <DashboardEmptyState
          description="Cadastre um host próprio quando quiser operar a vitrine fora do subdomínio padrão do marketplace."
          title="Nenhum domínio próprio cadastrado"
        />
      ) : null}

      {domain ? (
        <div className="domain-result">
          <div>
            <span>Host</span>
            <strong>{domain.host}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{getStatusLabel(domain.status)}</strong>
          </div>
          <div>
            <span>CNAME esperado</span>
            <strong>{domain.dnsTargetValue ?? "n/a"}</strong>
          </div>
          <div>
            <span>Ultima checagem SSL</span>
            <strong>{domain.sslLastCheckedAt ?? "n/a"}</strong>
          </div>
        </div>
      ) : null}

      {domain ? (
        <section className="activation-timeline">
          <div className="domain-head">
            <div>
              <div className="eyebrow">Ativação</div>
              <h3 className="section-title dns-guide-title">Timeline do domínio</h3>
            </div>
            <label className="timeline-toggle">
              <input
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
                type="checkbox"
              />
              <span>Atualizar a cada 15s</span>
            </label>
          </div>

          <div className="timeline-list">
            {activationSteps.map((step) => (
              <article className={`timeline-step ${step.state}`} key={step.key}>
                <div className="timeline-marker" />
                <div>
                  <strong>{step.title}</strong>
                  <p className="order-meta">{step.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {domain ? (
        <section className="dns-guide">
          <div className="domain-head">
            <div>
              <div className="eyebrow">Instruções DNS</div>
              <h3 className="section-title dns-guide-title">Configure o CNAME no seu provedor</h3>
            </div>
          </div>

          <div className="dns-guide-grid">
            <div className="dns-guide-card">
              <span>Tipo</span>
              <strong>CNAME</strong>
            </div>
            <div className="dns-guide-card">
              <span>Nome / Host</span>
              <strong>www</strong>
              <button
                className="secondary-button"
                onClick={() => void copyValue("host", "www")}
                type="button"
              >
                {copiedField === "host" ? "Copiado" : "Copiar host"}
              </button>
            </div>
            <div className="dns-guide-card dns-guide-card-wide">
              <span>Destino esperado</span>
              <strong>{domain.dnsTargetValue ?? "n/a"}</strong>
              <button
                className="secondary-button"
                onClick={() => void copyValue("target", domain.dnsTargetValue)}
                type="button"
              >
                {copiedField === "target" ? "Copiado" : "Copiar destino"}
              </button>
            </div>
          </div>

          <p className="subtitle">{getDnsGuidance(domain)}</p>
        </section>
      ) : null}

      {domain ? (
        <p className="subtitle">
          Enquanto o status nao virar `ACTIVE`, a loja continua disponivel pelo subdominio
          padrao e o dominio proprio ainda nao participa da resolucao publica.
        </p>
      ) : null}

      {domain?.dnsErrorMessage || domain?.sslErrorMessage ? (
        <p className="feedback error">
          {domain.sslErrorMessage ?? domain.dnsErrorMessage}
        </p>
      ) : null}

      {domain ? (
        <div className="button-row">
          <button
            className="secondary-button"
            disabled={isSubmitting}
            onClick={async () => {
              setIsSubmitting(true);
              setState({ kind: "idle" });

              try {
                const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/domains/${storeId}`, {
                  method: "DELETE",
                  headers: {
                    authorization: `Bearer ${token}`
                  }
                });
                const payload = (await response.json()) as {
                  removed?: boolean;
                  message?: string;
                };

                if (!response.ok) {
                  setState({
                    kind: "error",
                    message: payload.message ?? "Nao foi possivel remover o dominio."
                  });
                  return;
                }

                setDomain(null);
                setState({
                  kind: "success",
                  message:
                    "Dominio removido com sucesso. Agora voce pode cadastrar um novo host para substituir o anterior."
                });
              } catch {
                setState({
                  kind: "error",
                  message: "Falha de rede ao remover o dominio."
                });
              } finally {
                setIsSubmitting(false);
              }
            }}
            type="button"
          >
            Remover dominio
          </button>
          <button
            className="secondary-button"
            disabled={isSubmitting}
            onClick={async () => {
              setIsSubmitting(true);
              setState({ kind: "idle" });

              try {
                const response = await fetch(
                  `${env.NEXT_PUBLIC_API_URL}/domains/${storeId}/verify-dns`,
                  {
                    method: "POST",
                    headers: {
                      authorization: `Bearer ${token}`
                    }
                  }
                );
                const payload = (await response.json()) as {
                  queued?: boolean;
                  message?: string;
                };

                if (!response.ok) {
                  setState({
                    kind: "error",
                    message: payload.message ?? "Nao foi possivel agendar a verificacao."
                  });
                  return;
                }

                setState({
                  kind: "success",
                  message: "Verificacao de DNS agendada com sucesso."
                });
                await loadCurrentDomain();
              } catch {
                setState({
                  kind: "error",
                  message: "Falha de rede ao agendar a verificacao."
                });
              } finally {
                setIsSubmitting(false);
              }
            }}
            type="button"
          >
            Verificar DNS
          </button>
          <button
            className="secondary-button"
            disabled={isSubmitting}
            onClick={async () => {
              setIsSubmitting(true);
              setState({ kind: "idle" });

              try {
                const response = await fetch(
                  `${env.NEXT_PUBLIC_API_URL}/domains/${storeId}/sync-ssl`,
                  {
                    method: "POST",
                    headers: {
                      authorization: `Bearer ${token}`
                    }
                  }
                );
                const payload = (await response.json()) as {
                  queued?: boolean;
                  message?: string;
                };

                if (!response.ok) {
                  setState({
                    kind: "error",
                    message: payload.message ?? "Nao foi possivel atualizar o status do SSL."
                  });
                  return;
                }

                setState({
                  kind: "success",
                  message: "Atualizacao de SSL agendada com sucesso."
                });
                await loadCurrentDomain();
              } catch {
                setState({
                  kind: "error",
                  message: "Falha de rede ao atualizar o SSL."
                });
              } finally {
                setIsSubmitting(false);
              }
            }}
            type="button"
          >
            Atualizar SSL
          </button>
        </div>
      ) : null}
    </section>
  );
}
