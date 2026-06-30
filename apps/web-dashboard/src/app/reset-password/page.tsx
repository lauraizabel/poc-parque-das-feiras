import { AuthFormLayout } from "../../components/auth-page-shell";
import { ResetPasswordForm } from "../../components/auth-forms";

export default async function ResetPasswordPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const token = typeof searchParams.token === "string" ? searchParams.token : null;

  return (
    <AuthFormLayout
      eyebrow="Nova senha"
      title="Redefina sua senha"
      subtitle="Cole o token se necessário e escolha uma senha forte para encerrar o fluxo de recuperação."
    >
      <ResetPasswordForm initialToken={token} />
      <a className="auth-next-link" href="/forgot-password">
        <span>
          <strong>Solicitar outro link</strong>
          Gere um novo token se o anterior expirou.
        </span>
        <em aria-hidden="true">→</em>
      </a>
    </AuthFormLayout>
  );
}
