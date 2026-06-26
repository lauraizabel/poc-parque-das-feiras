"use client";

import { FormEvent, useState } from "react";
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

export function DomainConsole() {
  const [token, setToken] = useState("");
  const [storeId, setStoreId] = useState("");
  const [host, setHost] = useState("www.sualoja.com");
  const [domain, setDomain] = useState<DomainRecord | null>(null);
  const [state, setState] = useState<ApiState>({ kind: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadCurrentDomain() {
    if (!token || !storeId) {
      setState({
        kind: "error",
        message: "Preencha access token e storeId para consultar o dominio atual."
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

  return (
    <section className="card domain-card">
      <div className="domain-head">
        <div>
          <div className="eyebrow">Custom domain</div>
          <h2 className="section-title">Cadastro inicial de dominio proprio</h2>
        </div>
        <button className="secondary-button" onClick={loadCurrentDomain} type="button">
          Consultar atual
        </button>
      </div>

      <p className="subtitle">
        O fluxo oficial do MVP aceita apenas hosts `www`. Exemplo: `www.sualoja.com`.
      </p>

      <form className="domain-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Access token</span>
          <textarea
            rows={4}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Bearer token retornado pelo login do lojista"
          />
        </label>

        <div className="field-grid">
          <label className="field">
            <span>Store ID</span>
            <input
              value={storeId}
              onChange={(event) => setStoreId(event.target.value)}
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

      {state.kind !== "idle" ? (
        <p className={state.kind === "success" ? "feedback ok" : "feedback error"}>
          {state.message}
        </p>
      ) : null}

      {domain ? (
        <div className="domain-result">
          <div>
            <span>Host</span>
            <strong>{domain.host}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{domain.status ?? "n/a"}</strong>
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
