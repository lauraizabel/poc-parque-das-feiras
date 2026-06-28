"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { env } from "../lib/env";
import { storeDashboardAccessToken } from "../lib/auth-session";

type FormState = {
  kind: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

type AvailabilityState =
  | {
      kind: "idle";
      message?: undefined;
      normalizedSlug?: undefined;
      defaultSubdomain?: undefined;
    }
  | {
      kind: "loading";
      message: string;
      normalizedSlug?: string;
      defaultSubdomain?: string;
    }
  | {
      kind: "success" | "warning" | "error";
      message: string;
      normalizedSlug: string;
      defaultSubdomain: string;
    };

type MerchantOnboardingFormProps = {
  mode: "signup" | "member";
  token?: string;
  onCreated?: () => Promise<void> | void;
};

const passwordPolicyMessage =
  "Use ao menos 8 caracteres com letra maiúscula, minúscula e número.";

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo."),
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z
    .string()
    .min(8, passwordPolicyMessage)
    .regex(/[a-z]/, passwordPolicyMessage)
    .regex(/[A-Z]/, passwordPolicyMessage)
    .regex(/[0-9]/, passwordPolicyMessage),
  storeName: z.string().trim().min(2, "Informe o nome da loja."),
  storeSlug: z.string().trim().min(2, "Informe um slug com ao menos 2 caracteres."),
  supportEmail: z.union([z.string().trim().email("Informe um e-mail válido."), z.literal("")]),
  currencyCode: z.string().trim().length(3, "Use um código de moeda com 3 letras."),
  locale: z.string().trim().min(2, "Informe o locale inicial.")
});

const memberSchema = signupSchema.omit({
  fullName: true,
  email: true,
  password: true
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

function normalizeSlugPreview(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

export function MerchantOnboardingForm({
  mode,
  token,
  onCreated
}: MerchantOnboardingFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [currencyCode, setCurrencyCode] = useState("BRL");
  const [locale, setLocale] = useState("pt-BR");
  const [isLoading, setIsLoading] = useState(false);
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const [availability, setAvailability] = useState<AvailabilityState>({ kind: "idle" });
  const [hasCustomSlug, setHasCustomSlug] = useState(false);
  const lastRequestedSlug = useRef("");

  useEffect(() => {
    if (hasCustomSlug) {
      return;
    }

    setStoreSlug(normalizeSlugPreview(storeName));
  }, [hasCustomSlug, storeName]);

  useEffect(() => {
    const nextSlug = storeSlug.trim();

    if (nextSlug.length === 0) {
      setAvailability({ kind: "idle" });
      return;
    }

    setAvailability((current) => ({
      kind: "loading",
      message: "Validando slug e subdomínio...",
      normalizedSlug: current.normalizedSlug,
      defaultSubdomain: current.defaultSubdomain
    }));

    const timeoutId = window.setTimeout(async () => {
      lastRequestedSlug.current = nextSlug;

      try {
        const response = await fetch(
          `${env.NEXT_PUBLIC_API_URL}/stores/slug-availability?${new URLSearchParams({
            slug: nextSlug
          }).toString()}`
        );
        const payload = (await response.json()) as {
          available?: boolean;
          message?: string;
          normalizedSlug?: string;
          defaultSubdomain?: string;
        };

        if (lastRequestedSlug.current !== nextSlug) {
          return;
        }

        if (!response.ok) {
          setAvailability({
            kind: "error",
            message: extractMessage(payload, "Não foi possível validar o slug."),
            normalizedSlug: payload.normalizedSlug ?? normalizeSlugPreview(nextSlug),
            defaultSubdomain: payload.defaultSubdomain ?? normalizeSlugPreview(nextSlug)
          });
          return;
        }

        setAvailability({
          kind: payload.available ? "success" : "warning",
          message: extractMessage(
            payload,
            payload.available ? "Slug disponível." : "Esse slug já está em uso."
          ),
          normalizedSlug: payload.normalizedSlug ?? normalizeSlugPreview(nextSlug),
          defaultSubdomain: payload.defaultSubdomain ?? normalizeSlugPreview(nextSlug)
        });
      } catch (error) {
        if (lastRequestedSlug.current !== nextSlug) {
          return;
        }

        setAvailability({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Falha de rede ao validar a disponibilidade.",
          normalizedSlug: normalizeSlugPreview(nextSlug),
          defaultSubdomain: normalizeSlugPreview(nextSlug)
        });
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [storeSlug]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (availability.kind !== "success") {
      setState({
        kind: "error",
        message: "Escolha um slug disponível antes de continuar."
      });
      return;
    }

    setIsLoading(true);
    setState({ kind: "idle" });

    try {
      let response: Response;

      if (mode === "signup") {
        const parsed = signupSchema.safeParse({
          fullName,
          email,
          password,
          storeName,
          storeSlug,
          supportEmail,
          currencyCode,
          locale
        });

        if (!parsed.success) {
          setState({
            kind: "error",
            message: "Revise os campos destacados.",
            fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>
          });
          return;
        }

        response = await fetch(`${env.NEXT_PUBLIC_API_URL}/auth/register-merchant`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            fullName: parsed.data.fullName,
            email: parsed.data.email,
            password: parsed.data.password,
            storeName: parsed.data.storeName,
            storeSlug: parsed.data.storeSlug,
            supportEmail: parsed.data.supportEmail || undefined,
            currencyCode: parsed.data.currencyCode.toUpperCase(),
            locale: parsed.data.locale
          })
        });
      } else {
        const parsed = memberSchema.safeParse({
          storeName,
          storeSlug,
          supportEmail,
          currencyCode,
          locale
        });

        if (!parsed.success) {
          setState({
            kind: "error",
            message: "Revise os campos destacados.",
            fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>
          });
          return;
        }

        response = await fetch(`${env.NEXT_PUBLIC_API_URL}/stores`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            name: parsed.data.storeName,
            slug: parsed.data.storeSlug,
            defaultSubdomain: parsed.data.storeSlug,
            supportEmail: parsed.data.supportEmail || undefined,
            currencyCode: parsed.data.currencyCode.toUpperCase(),
            locale: parsed.data.locale
          })
        });
      }

      const payload = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        setState({
          kind: "error",
          message: extractMessage(payload, "Não foi possível concluir o onboarding."),
          fieldErrors: mapIssues(payload)
        });
        return;
      }

      if (mode === "signup") {
        const accessToken =
          typeof payload.tokens === "object" &&
          payload.tokens !== null &&
          "accessToken" in payload.tokens
            ? String((payload.tokens as { accessToken?: unknown }).accessToken ?? "")
            : "";

        if (accessToken.length > 0) {
          storeDashboardAccessToken(accessToken);
        }
      }

      setState({
        kind: "success",
        message:
          mode === "signup"
            ? "Conta e primeira loja criadas. Redirecionando para o painel..."
            : "Loja criada com sucesso. Atualizando o seu contexto..."
      });

      await Promise.resolve(onCreated?.());
      router.push("/");
      router.refresh();
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Falha de rede ao concluir o onboarding."
      });
    } finally {
      setIsLoading(false);
    }
  }

  const availabilityTone =
    availability.kind === "success"
      ? "feedback ok"
      : availability.kind === "warning" || availability.kind === "error"
        ? "feedback error"
        : "feedback";

  return (
    <form className="domain-form" onSubmit={handleSubmit}>
      {mode === "signup" ? (
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
      ) : null}

      {mode === "signup" ? (
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
      ) : null}

      <div className="field-grid">
        <label className="field">
          <span>Nome da loja</span>
          <input
            onChange={(event) => setStoreName(event.target.value)}
            placeholder="Ex.: Casa Aurora"
            type="text"
            value={storeName}
          />
          <FieldError message={state.fieldErrors?.storeName ?? state.fieldErrors?.name} />
        </label>

        <label className="field">
          <span>Slug desejado</span>
          <input
            onChange={(event) => {
              setHasCustomSlug(true);
              setStoreSlug(event.target.value);
            }}
            placeholder="casa-aurora"
            type="text"
            value={storeSlug}
          />
          <FieldError message={state.fieldErrors?.storeSlug ?? state.fieldErrors?.slug} />
        </label>
      </div>

      {availability.kind !== "idle" ? (
        <div className="slug-preview">
          <p className={availabilityTone}>{availability.message}</p>
          {availability.normalizedSlug ? (
            <div className="domain-result compact-grid">
              <div>
                <span>Slug normalizado</span>
                <strong>{availability.normalizedSlug}</strong>
              </div>
              <div>
                <span>Subdomínio padrão previsto</span>
                <strong>{availability.defaultSubdomain}</strong>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="field-grid">
        <label className="field">
          <span>E-mail de suporte</span>
          <input
            onChange={(event) => setSupportEmail(event.target.value)}
            placeholder="suporte@sualoja.com"
            type="email"
            value={supportEmail}
          />
          <FieldError message={state.fieldErrors?.supportEmail} />
        </label>
        <label className="field">
          <span>Moeda</span>
          <input
            maxLength={3}
            onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())}
            type="text"
            value={currencyCode}
          />
          <FieldError message={state.fieldErrors?.currencyCode} />
        </label>
      </div>

      <label className="field">
        <span>Locale inicial</span>
        <input
          onChange={(event) => setLocale(event.target.value)}
          placeholder="pt-BR"
          type="text"
          value={locale}
        />
        <FieldError message={state.fieldErrors?.locale} />
      </label>

      <div className="button-row">
        <button className="primary-button" disabled={isLoading} type="submit">
          {isLoading
            ? "Salvando..."
            : mode === "signup"
              ? "Criar conta e primeira loja"
              : "Criar minha primeira loja"}
        </button>
        {mode === "signup" ? (
          <a className="secondary-button auth-anchor-button" href="/login">
            Já tenho acesso
          </a>
        ) : null}
      </div>

      <InlineFeedback state={state} />
    </form>
  );
}
