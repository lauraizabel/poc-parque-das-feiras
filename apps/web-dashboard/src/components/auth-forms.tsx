"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { z } from "zod";
import {
  clearDashboardAccessToken,
  storeDashboardAccessToken
} from "../lib/auth-session";
import { env } from "../lib/env";

type FormState = {
  kind: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail valido."),
  password: z.string().min(1, "Informe sua senha.")
});

function extractMessage(payload: unknown, fallback: string) {
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const message = (payload as { message?: unknown }).message;

    if (typeof message === "string") {
      return message;
    }
  }

  return fallback;
}

function FieldError({ message }: { message?: string }) {
  return message ? <span className="field-error">{message}</span> : null;
}

function InlineFeedback({ state }: { state: FormState }) {
  if (state.kind === "idle") {
    return null;
  }

  return (
    <p className={state.kind === "success" ? "feedback ok" : "feedback error"}>{state.message}</p>
  );
}

async function postJson(path: string, body: unknown) {
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = (await response.json()) as Record<string, unknown>;

  return {
    response,
    payload
  };
}

export function LoginForm(props: { initialMessage?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [state, setState] = useState<FormState>(() => {
    if (props.initialMessage) {
      return {
        kind: "success",
        message: props.initialMessage
      };
    }

    return { kind: "idle" };
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = loginSchema.safeParse({
      email,
      password
    });

    if (!parsed.success) {
      setState({
        kind: "error",
        message: "Revise os campos destacados.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>
      });
      return;
    }

    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const { response, payload } = await postJson("/auth/login", parsed.data);

      const accessToken =
        typeof payload.tokens === "object" &&
        payload.tokens !== null &&
        "accessToken" in payload.tokens
          ? String((payload.tokens as { accessToken?: unknown }).accessToken ?? "")
          : "";

      if (!response.ok || accessToken.length === 0) {
        clearDashboardAccessToken();
        setState({
          kind: "error",
          message: extractMessage(payload, "Nao foi possivel autenticar o usuario.")
        });
        return;
      }

      storeDashboardAccessToken(accessToken);
      setState({
        kind: "success",
        message: "Login concluido. Redirecionando para o painel..."
      });

      router.push("/");
      router.refresh();
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha de rede ao autenticar o usuario."
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="auth-modern-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>E-mail</span>
        <input
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@loja.com.br"
          type="email"
          value={email}
        />
        <FieldError message={state.fieldErrors?.email} />
      </label>

      <label className="field">
        <span>Senha</span>
        <input
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="********"
          type="password"
          value={password}
        />
        <FieldError message={state.fieldErrors?.password} />
      </label>

      <div className="auth-action-row">
        <button className="auth-submit-button" disabled={isLoading} type="submit">
          {isLoading ? "Entrando..." : "Entrar no cockpit"}
          <span aria-hidden="true">-&gt;</span>
        </button>
      </div>

      <InlineFeedback state={state} />
    </form>
  );
}
