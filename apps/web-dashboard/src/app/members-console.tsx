"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  DashboardEmptyState,
  DashboardFeedback,
  DashboardLoadingState
} from "../components/dashboard-state";
import { authHeaders, dashboardApiJson, normalizeApiMessage } from "../lib/dashboard-api";

type MemberRecord = {
  id: string;
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  status: "ACTIVE";
  createdAt: string;
};

type InviteRecord = {
  id: string;
  email: string;
  role: string;
  status: "PENDING";
  createdAt: string;
};

type ApiState = {
  kind: "idle" | "success" | "error";
  message?: string;
};

type MembersConsoleProps = {
  token: string;
  storeId: string;
  storeLabel: string;
  canManage: boolean;
};

const roleOptions = ["STORE_MANAGER", "STORE_SUPPORT"] as const;

function formatRole(role: string) {
  switch (role) {
    case "STORE_OWNER":
      return "Proprietaria";
    case "STORE_MANAGER":
      return "Operador";
    case "STORE_SUPPORT":
      return "Suporte";
    default:
      return role;
  }
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function MembersConsole({
  token,
  storeId,
  storeLabel,
  canManage
}: MembersConsoleProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof roleOptions)[number]>("STORE_MANAGER");
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [draftRoles, setDraftRoles] = useState<Record<string, string>>({});
  const [state, setState] = useState<ApiState>({ kind: "idle" });
  const [isLoading, setIsLoading] = useState(false);

  const roleSummary = useMemo(
    () => [
      {
        role: "STORE_OWNER",
        label: "Proprietaria",
        description: "Acesso total e gestao da loja",
        count: members.filter((member) => member.role === "STORE_OWNER").length
      },
      {
        role: "STORE_MANAGER",
        label: "Operador",
        description: "Gerencia catalogo, pedidos e vitrine",
        count: members.filter((member) => member.role === "STORE_MANAGER").length
      },
      {
        role: "STORE_SUPPORT",
        label: "Suporte",
        description: "Apoio operacional e atendimento",
        count: members.filter((member) => member.role === "STORE_SUPPORT").length
      }
    ],
    [members]
  );

  async function loadMembers() {
    if (!storeId || !canManage) {
      return;
    }

    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const { payload, response } = await dashboardApiJson<{
        members?: MemberRecord[];
        invites?: InviteRecord[];
        message?: string;
      }>(`/stores/${storeId}/members`, {
        headers: authHeaders(token)
      });

      if (!response.ok) {
        setState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel carregar os membros.")
        });
        return;
      }

      const nextMembers = payload.members ?? [];
      setMembers(nextMembers);
      setInvites(payload.invites ?? []);
      setDraftRoles(
        nextMembers.reduce<Record<string, string>>((accumulator, member) => {
          accumulator[member.id] = member.role;
          return accumulator;
        }, {})
      );
    } catch {
      setState({
        kind: "error",
        message: "Falha de rede ao carregar membros."
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadMembers();
  }, [storeId, canManage]);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const { payload, response } = await dashboardApiJson<{
        status?: string;
        message?: string;
      }>(`/stores/${storeId}/members/invite`, {
        method: "POST",
        headers: authHeaders(token, {
          "content-type": "application/json"
        }),
        body: JSON.stringify({
          email,
          role
        })
      });

      if (!response.ok) {
        setState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel convidar o membro.")
        });
        return;
      }

      setEmail("");
      setRole("STORE_MANAGER");
      setState({
        kind: "success",
        message:
          payload.status === "PENDING"
            ? "Convite pendente criado com sucesso."
            : "Membro adicionado a loja com sucesso."
      });
      await loadMembers();
    } catch {
      setState({
        kind: "error",
        message: "Falha de rede ao convidar o membro."
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function saveRole(memberId: string) {
    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const { payload, response } = await dashboardApiJson<{ message?: string }>(
        `/stores/${storeId}/members/${memberId}`,
        {
          method: "PATCH",
          headers: authHeaders(token, {
            "content-type": "application/json"
          }),
          body: JSON.stringify({
            role: draftRoles[memberId]
          })
        }
      );

      if (!response.ok) {
        setState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel atualizar o papel.")
        });
        return;
      }

      setState({
        kind: "success",
        message: "Papel atualizado com sucesso."
      });
      await loadMembers();
    } catch {
      setState({
        kind: "error",
        message: "Falha de rede ao atualizar o papel."
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function removeMember(memberId: string) {
    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const { payload, response } = await dashboardApiJson<{ message?: string }>(
        `/stores/${storeId}/members/${memberId}`,
        {
          method: "DELETE",
          headers: authHeaders(token)
        }
      );

      if (!response.ok) {
        setState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel remover o membro.")
        });
        return;
      }

      setState({
        kind: "success",
        message: "Membro removido com sucesso."
      });
      await loadMembers();
    } catch {
      setState({
        kind: "error",
        message: "Falha de rede ao remover o membro."
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function removeInvite(inviteId: string) {
    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const { payload, response } = await dashboardApiJson<{ message?: string }>(
        `/stores/${storeId}/member-invites/${inviteId}`,
        {
          method: "DELETE",
          headers: authHeaders(token)
        }
      );

      if (!response.ok) {
        setState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel cancelar o convite.")
        });
        return;
      }

      setState({
        kind: "success",
        message: "Convite pendente removido."
      });
      await loadMembers();
    } catch {
      setState({
        kind: "error",
        message: "Falha de rede ao cancelar o convite."
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (!canManage) {
    return (
      <section className="members-console">
        <div className="members-readonly-card">
          <div className="eyebrow">Equipe</div>
          <h2>Gestao de membros</h2>
          <p>Apenas o owner da loja pode convidar, alterar papel e remover membros neste MVP.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="members-console animate-entrance">
      <header className="members-console-header">
        <div>
          <div className="eyebrow">Console / Equipe</div>
          <h2>Operadores e permissoes de {storeLabel}</h2>
          <p>
            {members.length} membros ativos / {invites.length} convites pendentes
          </p>
        </div>
        <button className="secondary-button" onClick={() => void loadMembers()} type="button">
          Atualizar lista
        </button>
      </header>

      <section className="members-role-grid">
        {roleSummary.map((item) => (
          <article className="members-role-card" key={item.role}>
            <div className="eyebrow">{item.label}</div>
            <strong>{item.count}</strong>
            <p>{item.description}</p>
          </article>
        ))}
      </section>

      <DashboardFeedback state={state} />

      <section className="members-workbench">
        <div className="members-list-panel">
          {isLoading && members.length === 0 && invites.length === 0 ? (
            <DashboardLoadingState label="Carregando equipe da loja" />
          ) : null}

          {[...members, ...invites].length > 0 ? (
            <div className="members-table">
              <div className="members-row is-heading">
                <span>Membro</span>
                <span>Papel</span>
                <span>Status</span>
                <span>Acoes</span>
              </div>
              {members.map((member) => (
                <article className="members-row" key={member.id}>
                  <MemberIdentity
                    email={member.email}
                    name={member.fullName ?? member.email}
                  />
                  <div>
                    {member.role === "STORE_OWNER" ? (
                      <span className="members-role-pill">Owner</span>
                    ) : (
                      <select
                        onChange={(event) =>
                          setDraftRoles((current) => ({
                            ...current,
                            [member.id]: event.target.value
                          }))
                        }
                        value={draftRoles[member.id] ?? member.role}
                      >
                        <option value="STORE_MANAGER">Operador</option>
                        <option value="STORE_SUPPORT">Suporte</option>
                      </select>
                    )}
                  </div>
                  <span className="members-status is-active">Ativo</span>
                  <div className="members-actions">
                    {member.role !== "STORE_OWNER" ? (
                      <>
                        <button
                          disabled={isLoading}
                          onClick={() => void saveRole(member.id)}
                          type="button"
                        >
                          Salvar
                        </button>
                        <button
                          disabled={isLoading}
                          onClick={() => void removeMember(member.id)}
                          type="button"
                        >
                          Remover
                        </button>
                      </>
                    ) : (
                      <span className="members-muted">Acesso total</span>
                    )}
                  </div>
                </article>
              ))}

              {invites.map((invite) => (
                <article className="members-row is-pending" key={invite.id}>
                  <MemberIdentity email={invite.email} name={invite.email} />
                  <span>{formatRole(invite.role)}</span>
                  <span className="members-status is-pending">Convite pendente</span>
                  <div className="members-actions">
                    <button
                      disabled={isLoading}
                      onClick={() => void removeInvite(invite.id)}
                      type="button"
                    >
                      Cancelar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {!isLoading && members.length === 0 && invites.length === 0 ? (
            <DashboardEmptyState
              description="Convide managers e suporte quando a operacao da loja comecar a crescer."
              title="Nenhum membro extra convidado"
            />
          ) : null}
        </div>

        <aside className="members-invite-panel">
          <div>
            <div className="eyebrow">Convite</div>
            <h3>Convidar operador</h3>
            <p>Se a conta ja existir, a membership entra ativa. Caso contrario, o convite fica pendente.</p>
          </div>
          <form className="members-invite-form" onSubmit={handleInvite}>
            <label>
              <span>E-mail</span>
              <input
                onChange={(event) => setEmail(event.target.value)}
                placeholder="operacao@sualoja.com"
                required
                type="email"
                value={email}
              />
            </label>
            <label>
              <span>Papel</span>
              <select
                onChange={(event) => setRole(event.target.value as (typeof roleOptions)[number])}
                value={role}
              >
                <option value="STORE_MANAGER">Operador</option>
                <option value="STORE_SUPPORT">Suporte</option>
              </select>
            </label>
            <button className="primary-button" disabled={isLoading} type="submit">
              {isLoading ? "Salvando..." : "Convidar membro"}
            </button>
          </form>
        </aside>
      </section>
    </section>
  );
}

function MemberIdentity({ email, name }: { email: string; name: string }) {
  return (
    <div className="members-identity">
      <div className="members-avatar">{getInitials(name || email)}</div>
      <div>
        <strong>{name}</strong>
        <span>{email}</span>
      </div>
    </div>
  );
}
