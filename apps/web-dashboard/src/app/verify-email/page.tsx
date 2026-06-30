import { AuthFormLayout } from "../../components/auth-page-shell";
import { VerifyEmailForm } from "../../components/auth-forms";

export default async function VerifyEmailPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const token = typeof searchParams.token === "string" ? searchParams.token : null;

  return (
    <AuthFormLayout
      eyebrow="Confirmação"
      title="Confirme seu e-mail"
      subtitle="Abra esta página a partir do link recebido por e-mail ou cole o token manualmente para ativar a conta."
    >
      <VerifyEmailForm initialToken={token} />
      <a className="auth-next-link" href="/login">
        <span>
          <strong>Ir para login</strong>
          Entre no painel assim que a confirmação for concluída.
        </span>
        <em aria-hidden="true">→</em>
      </a>
    </AuthFormLayout>
  );
}
