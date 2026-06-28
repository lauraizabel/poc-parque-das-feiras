"use client";

import { FormEvent, useEffect, useState } from "react";
import { env } from "../lib/env";

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

  async function loadMembers() {
    if (!storeId || !canManage) {
      return;
    }

    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/stores/${storeId}/members`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as {
        members?: MemberRecord[];
        invites?: InviteRecord[];
        message?: string;
      };

      if (!response.ok) {
        setState({
          kind: "error",
          message: payload.message ?? "Não foi possível carregar os membros."
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
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/stores/${storeId}/members/invite`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          email,
          role
        })
      });
      const payload = (await response.json()) as { status?: string; message?: string };

      if (!response.ok) {
        setState({
          kind: "error",
          message: payload.message ?? "Não foi possível convidar o membro."
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
            : "Membro adicionado à loja com sucesso."
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
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/stores/${storeId}/members/${memberId}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          role: draftRoles[memberId]
        })
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setState({
          kind: "error",
          message: payload.message ?? "Não foi possível atualizar o papel."
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
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/stores/${storeId}/members/${memberId}`, {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setState({
          kind: "error",
          message: payload.message ?? "Não foi possível remover o membro."
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
      const response = await fetch(
        `${env.NEXT_PUBLIC_API_URL}/stores/${storeId}/member-invites/${inviteId}`,
        {
          method: "DELETE",
          headers: {
            authorization: `Bearer ${token}`
          }
        }
      );
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setState({
          kind: "error",
          message: payload.message ?? "Não foi possível cancelar o convite."
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
      <section className="card">
        <div className="eyebrow">Equipe</div>
        <h2 className="section-title">Gestão de membros</h2>
        <p className="subtitle">
          Apenas o owner da loja pode convidar, alterar papel e remover membros neste MVP.
        </p>
      </section>
    );
  }

  return (
    <section className="card orders-card">
      <div className="domain-head">
        <div>
          <div className="eyebrow">Equipe</div>
          <h2 className="section-title">Membros de {storeLabel}</h2>
        </div>
        <button className="secondary-button" onClick={() => void loadMembers()} type="button">
          Atualizar lista
        </button>
      </div>

      <p className="subtitle">
        Convide managers e support por e-mail. Se a conta já existir, a membership entra ativa; se
        não, o convite fica pendente no MVP.
      </p>

      <form className="domain-form" onSubmit={handleInvite}>
        <div className="field-grid">
          <label className="field">
            <span>E-mail do membro</span>
            <input
              onChange={(event) => setEmail(event.target.value)}
              placeholder="operacao@sualoja.com"
              type="email"
              value={email}
            />
          </label>
          <label className="field">
            <span>Papel</span>
            <select
              className="field-select"
              onChange={(event) => setRole(event.target.value as (typeof roleOptions)[number])}
              value={role}
            >
              <option value="STORE_MANAGER">STORE_MANAGER</option>
              <option value="STORE_SUPPORT">STORE_SUPPORT</option>
            </select>
          </label>
        </div>

        <div className="button-row">
          <button className="primary-button" disabled={isLoading} type="submit">
            {isLoading ? "Salvando..." : "Convidar membro"}
          </button>
        </div>
      </form>

      {state.kind !== "idle" ? (
        <p className={state.kind === "success" ? "feedback ok" : "feedback error"}>
          {state.message}
        </p>
      ) : null}

      <div className="members-stack">
        {members.map((member) => (
          <article className="member-card" key={member.id}>
            <div>
              <strong>{member.fullName ?? member.email}</strong>
              <p className="order-meta">{member.email}</p>
            </div>
            <div className="member-actions">
              {member.role === "STORE_OWNER" ? (
                <div className="host-badge">Owner da loja</div>
              ) : (
                <>
                  <select
                    className="field-select compact-select"
                    onChange={(event) =>
                      setDraftRoles((current) => ({
                        ...current,
                        [member.id]: event.target.value
                      }))
                    }
                    value={draftRoles[member.id] ?? member.role}
                  >
                    <option value="STORE_MANAGER">STORE_MANAGER</option>
                    <option value="STORE_SUPPORT">STORE_SUPPORT</option>
                  </select>
                  <button
                    className="secondary-button"
                    disabled={isLoading}
                    onClick={() => void saveRole(member.id)}
                    type="button"
                  >
                    Salvar papel
                  </button>
                  <button
                    className="secondary-button"
                    disabled={isLoading}
                    onClick={() => void removeMember(member.id)}
                    type="button"
                  >
                    Remover
                  </button>
                </>
              )}
            </div>
          </article>
        ))}

        {invites.map((invite) => (
          <article className="member-card pending" key={invite.id}>
            <div>
              <strong>{invite.email}</strong>
              <p className="order-meta">Convite pendente • {invite.role}</p>
            </div>
            <div className="member-actions">
              <button
                className="secondary-button"
                disabled={isLoading}
                onClick={() => void removeInvite(invite.id)}
                type="button"
              >
                Cancelar convite
              </button>
            </div>
          </article>
        ))}

        {members.length === 0 && invites.length === 0 ? (
          <p className="subtitle">Nenhum membro extra convidado para esta loja ainda.</p>
        ) : null}
      </div>
    </section>
  );
}
