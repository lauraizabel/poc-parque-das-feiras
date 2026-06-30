"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  clearDashboardAccessToken,
  readDashboardAccessToken,
  storeDashboardAccessToken
} from "../lib/auth-session";
import {
  authHeaders,
  dashboardApiJson,
  normalizeApiMessage
} from "../lib/dashboard-api";

export type DashboardApiState = {
  kind: "idle" | "success" | "error";
  message?: string;
};

export type DashboardMembership = {
  storeId: string;
  role: string;
  createdAt: string;
  store: {
    id: string;
    name: string;
    slug: string;
    defaultSubdomain: string;
    currencyCode: string;
    locale: string;
    supportEmail: string | null;
  };
};

export type DashboardUser = {
  id: string;
  email: string;
  fullName: string | null;
  platformRole: string;
  memberships: DashboardMembership[];
};

type DashboardSessionContextValue = {
  handleLogin: (email: string, password: string) => Promise<void>;
  handleLogout: () => Promise<void>;
  isLoading: boolean;
  refreshContext: () => Promise<void>;
  selectedMembership: DashboardMembership | null;
  selectedStoreId: string;
  setSelectedStoreId: (storeId: string) => void;
  state: DashboardApiState;
  token: string;
  user: DashboardUser | null;
};

const DashboardSessionContext = createContext<DashboardSessionContextValue | null>(null);

export function DashboardSessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [state, setState] = useState<DashboardApiState>({ kind: "idle" });
  const [isLoading, setIsLoading] = useState(false);

  const selectedMembership = useMemo(
    () =>
      user?.memberships.find((membership) => membership.storeId === selectedStoreId) ??
      user?.memberships[0] ??
      null,
    [selectedStoreId, user]
  );

  const bootstrapDashboard = useCallback(async (nextToken: string) => {
    const { payload, response } = await dashboardApiJson<DashboardUser | { message?: string }>(
      "/auth/me",
      {
        headers: authHeaders(nextToken)
      }
    );

    if (!response.ok || !("memberships" in payload)) {
      throw new Error(normalizeApiMessage(payload, "Nao foi possivel carregar o contexto do dashboard."));
    }

    setUser(payload);
    setSelectedStoreId(payload.memberships[0]?.storeId ?? "");
    return payload;
  }, []);

  useEffect(() => {
    const storedToken = readDashboardAccessToken();

    if (!storedToken) {
      return;
    }

    setToken(storedToken);
    setIsLoading(true);
    bootstrapDashboard(storedToken)
      .then((me) => {
        setState({
          kind: "success",
          message:
            me.memberships.length > 0
              ? "Sessao restaurada com sucesso."
              : "Login restaurado, mas sem lojas vinculadas."
        });
      })
      .catch((error) => {
        clearDashboardAccessToken();
        setToken("");
        setUser(null);
        setState({
          kind: "error",
          message:
            error instanceof Error ? error.message : "Nao foi possivel restaurar a sessao."
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [bootstrapDashboard]);

  async function handleLogin(email: string, password: string) {
    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const { payload, response } = await dashboardApiJson<{
        tokens?: { accessToken: string };
        message?: string;
      }>("/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      if (!response.ok || !payload.tokens?.accessToken) {
        setState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel autenticar o usuario.")
        });
        return;
      }

      setToken(payload.tokens.accessToken);
      storeDashboardAccessToken(payload.tokens.accessToken);
      const me = await bootstrapDashboard(payload.tokens.accessToken);
      setState({
        kind: "success",
        message:
          me.memberships.length > 0
            ? "Dashboard carregado com suas lojas."
            : "Login concluido, mas este usuario ainda nao participa de nenhuma loja."
      });
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Falha de rede ao autenticar o usuario."
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshContext() {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const me = await bootstrapDashboard(token);
      setState({
        kind: "success",
        message:
          me.memberships.length > 0
            ? "Contexto atualizado com sucesso."
            : "Nenhuma loja vinculada a este usuario."
      });
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Falha ao atualizar o contexto do dashboard."
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    if (!token) {
      return;
    }

    setIsLoading(true);

    try {
      await dashboardApiJson<{ message?: string }>("/auth/logout", {
        method: "POST",
        headers: authHeaders(token)
      });
    } finally {
      clearDashboardAccessToken();
      setToken("");
      setUser(null);
      setSelectedStoreId("");
      setState({
        kind: "success",
        message: "Sessao encerrada com sucesso."
      });
      setIsLoading(false);
    }
  }

  const value = useMemo(
    () => ({
      handleLogin,
      handleLogout,
      isLoading,
      refreshContext,
      selectedMembership,
      selectedStoreId,
      setSelectedStoreId,
      state,
      token,
      user
    }),
    [isLoading, selectedMembership, selectedStoreId, state, token, user]
  );

  return (
    <DashboardSessionContext.Provider value={value}>
      {children}
    </DashboardSessionContext.Provider>
  );
}

export function useDashboardSession() {
  const value = useContext(DashboardSessionContext);

  if (!value) {
    throw new Error("useDashboardSession must be used within DashboardSessionProvider.");
  }

  return value;
}
