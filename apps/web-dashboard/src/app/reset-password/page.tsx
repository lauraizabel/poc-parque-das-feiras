import { AuthPageShell } from "../../components/auth-page-shell";
import { ResetPasswordForm } from "../../components/auth-forms";

export default async function ResetPasswordPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const token = typeof searchParams.token === "string" ? searchParams.token : null;

  return (
    <AuthPageShell
      eyebrow="Nova senha"
      title="Defina uma nova senha a partir do token enviado por e-mail."
      subtitle="Cole o token se necessário e escolha uma senha forte para encerrar o fluxo de recuperação."
      links={[
        { href: "/forgot-password", label: "Solicitar novo link" },
        { href: "/login", label: "Voltar ao login" }
      ]}
    >
      <div>
        <div className="eyebrow">Reset</div>
        <h2 className="section-title">Redefinir senha</h2>
      </div>
      <ResetPasswordForm initialToken={token} />
    </AuthPageShell>
  );
}
