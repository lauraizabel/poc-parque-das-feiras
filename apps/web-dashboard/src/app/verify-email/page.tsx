import { AuthPageShell } from "../../components/auth-page-shell";
import { VerifyEmailForm } from "../../components/auth-forms";

export default async function VerifyEmailPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const token = typeof searchParams.token === "string" ? searchParams.token : null;

  return (
    <AuthPageShell
      eyebrow="Confirmação"
      title="Confirme o seu e-mail para concluir o acesso."
      subtitle="Abra esta página a partir do link recebido por e-mail ou cole o token manualmente para ativar a conta."
      links={[
        { href: "/login", label: "Ir para login" },
        { href: "/register", label: "Criar outra conta" }
      ]}
    >
      <div>
        <div className="eyebrow">Verificação</div>
        <h2 className="section-title">Confirmar e-mail</h2>
      </div>
      <VerifyEmailForm initialToken={token} />
    </AuthPageShell>
  );
}
