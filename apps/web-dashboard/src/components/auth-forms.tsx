"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { z } from "zod";
import { env } from "../lib/env";
import {
  clearDashboardAccessToken,
  storeDashboardAccessToken
} from "../lib/auth-session";

type FormState = {
  kind: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

const passwordPolicyMessage =
  "Use ao menos 8 caracteres com letra maiúscula, minúscula e número.";

const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha.")
});

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo."),
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z
    .string()
    .min(8, passwordPolicyMessage)
    .regex(/[a-z]/, passwordPolicyMessage)
    .regex(/[A-Z]/, passwordPolicyMessage)
    .regex(/[0-9]/, passwordPolicyMessage)
});

const emailOnlySchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido.")
});

const resetSchema = z.object({
  token: z.string().trim().min(16, "Token inválido."),
  password: z
    .string()
    .min(8, passwordPolicyMessage)
    .regex(/[a-z]/, passwordPolicyMessage)
    .regex(/[A-Z]/, passwordPolicyMessage)
    .regex(/[0-9]/, passwordPolicyMessage)
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

function mapIssues(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "issues" in payload &&
    Array.isArray((payload as { issues?: unknown[] }).issues)
  ) {
    const issues = (payload as { issues: Array<{ path?: string; message?: string }> }).issues;

    return issues.reduce<Record<string, string>>((accumulator, issue) => {
      if (issue.path && issue.message) {
        accumulator[issue.path] = issue.message;
      }

      return accumulator;
    }, {});
  }

  return {};
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
          message: extractMessage(payload, "Não foi possível autenticar o usuário.")
        });
        return;
      }

      storeDashboardAccessToken(accessToken);
      setState({
        kind: "success",
        message: "Login concluído. Redirecionando para o painel..."
      });

      router.push("/");
      router.refresh();
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha de rede ao autenticar o usuário."
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
          <span aria-hidden="true">→</span>
        </button>
        <a className="auth-text-link" href="/forgot-password">
          Recuperar senha
        </a>
      </div>

      <InlineFeedback state={state} />
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [state, setState] = useState<FormState>({ kind: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = registerSchema.safeParse({
      fullName,
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
      const { response, payload } = await postJson("/auth/register", parsed.data);

      if (!response.ok) {
        setState({
          kind: "error",
          message: extractMessage(payload, "Não foi possível concluir o cadastro."),
          fieldErrors: mapIssues(payload)
        });
        return;
      }

      clearDashboardAccessToken();
      setState({
        kind: "success",
        message: "Cadastro concluído. Enviamos um link de confirmação para o seu e-mail."
      });

      window.setTimeout(() => {
        window.location.assign("/login?registered=1");
      }, 600);
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha de rede ao criar a conta."
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="domain-form" onSubmit={handleSubmit}>
      <div className="field-grid">
        <label className="field">
          <span>Nome completo</span>
          <input
            autoComplete="name"
            onChange={(event) => setFullName(event.target.value)}
            type="text"
            value={fullName}
          />
          <FieldError message={state.fieldErrors?.fullName} />
        </label>
        <label className="field">
          <span>E-mail</span>
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
          <FieldError message={state.fieldErrors?.email} />
        </label>
      </div>

      <label className="field">
        <span>Senha</span>
        <input
          autoComplete="new-password"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
        <FieldError message={state.fieldErrors?.password} />
      </label>

      <div className="button-row">
        <button className="primary-button" disabled={isLoading} type="submit">
          {isLoading ? "Criando conta..." : "Criar conta"}
        </button>
        <a className="secondary-button auth-anchor-button" href="/login">
          Já tenho acesso
        </a>
      </div>

      <InlineFeedback state={state} />
    </form>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [state, setState] = useState<FormState>({ kind: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = emailOnlySchema.safeParse({
      email
    });

    if (!parsed.success) {
      setState({
        kind: "error",
        message: "Informe um e-mail válido.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>
      });
      return;
    }

    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      const { response, payload } = await postJson("/auth/request-password-reset", parsed.data);

      if (!response.ok) {
        setState({
          kind: "error",
          message: extractMessage(payload, "Não foi possível solicitar a redefinição.")
        });
        return;
      }

      setState({
        kind: "success",
        message: "Se o e-mail existir na plataforma, enviaremos um link para redefinir a senha."
      });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha de rede ao solicitar a redefinição."
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="domain-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>E-mail</span>
        <input
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          value={email}
        />
        <FieldError message={state.fieldErrors?.email} />
      </label>

      <div className="button-row">
        <button className="primary-button" disabled={isLoading} type="submit">
          {isLoading ? "Enviando..." : "Enviar link"}
        </button>
        <a className="secondary-button auth-anchor-button" href="/login">
          Voltar ao login
        </a>
      </div>

      <InlineFeedback state={state} />
    </form>
  );
}

export function ResetPasswordForm(props: { initialToken?: string | null }) {
  const initialToken = props.initialToken ?? "";
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [state, setState] = useState<FormState>(
    initialToken
      ? { kind: "idle" }
      : { kind: "error", message: "Abra esta página a partir do link enviado por e-mail." }
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = resetSchema.safeParse({
      token,
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
      const { response, payload } = await postJson("/auth/reset-password", parsed.data);

      if (!response.ok) {
        setState({
          kind: "error",
          message: extractMessage(payload, "Não foi possível redefinir a senha."),
          fieldErrors: mapIssues(payload)
        });
        return;
      }

      clearDashboardAccessToken();
      setState({
        kind: "success",
        message: "Senha redefinida com sucesso. Redirecionando para o login..."
      });

      window.setTimeout(() => {
        window.location.assign("/login?reset=1");
      }, 600);
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha de rede ao redefinir a senha."
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="domain-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Token do link</span>
        <input onChange={(event) => setToken(event.target.value)} type="text" value={token} />
        <FieldError message={state.fieldErrors?.token} />
      </label>

      <label className="field">
        <span>Nova senha</span>
        <input
          autoComplete="new-password"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
        <FieldError message={state.fieldErrors?.password} />
      </label>

      <div className="button-row">
        <button className="primary-button" disabled={isLoading} type="submit">
          {isLoading ? "Redefinindo..." : "Salvar nova senha"}
        </button>
        <a className="secondary-button auth-anchor-button" href="/forgot-password">
          Solicitar outro link
        </a>
      </div>

      <InlineFeedback state={state} />
    </form>
  );
}

export function VerifyEmailForm(props: { initialToken?: string | null }) {
  const initialToken = props.initialToken ?? "";
  const [token, setToken] = useState(initialToken);
  const [isLoading, setIsLoading] = useState(false);
  const [state, setState] = useState<FormState>(
    initialToken
      ? { kind: "idle" }
      : { kind: "error", message: "Abra esta página a partir do link enviado por e-mail." }
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = z
      .object({
        token: z.string().trim().min(16, "Token inválido.")
      })
      .safeParse({ token });

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
      const { response, payload } = await postJson("/auth/verify-email", parsed.data);

      if (!response.ok) {
        setState({
          kind: "error",
          message: extractMessage(payload, "Não foi possível confirmar o e-mail.")
        });
        return;
      }

      setState({
        kind: "success",
        message: "E-mail confirmado com sucesso. Você já pode entrar no painel."
      });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha de rede ao confirmar o e-mail."
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="domain-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Token de confirmação</span>
        <input onChange={(event) => setToken(event.target.value)} type="text" value={token} />
        <FieldError message={state.fieldErrors?.token} />
      </label>

      <div className="button-row">
        <button className="primary-button" disabled={isLoading} type="submit">
          {isLoading ? "Confirmando..." : "Confirmar e-mail"}
        </button>
        <a className="secondary-button auth-anchor-button" href="/login">
          Ir para login
        </a>
      </div>

      <InlineFeedback state={state} />
    </form>
  );
}
