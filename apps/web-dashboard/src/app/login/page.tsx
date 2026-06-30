import { AuthFormLayout } from "../../components/auth-page-shell";
import { LoginForm } from "../../components/auth-forms";

export default async function LoginPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const initialMessage =
    searchParams.registered === "1"
      ? "Cadastro concluído. Entre para acessar o painel."
      : searchParams.reset === "1"
        ? "Senha redefinida. Faça login com a nova credencial."
        : null;

  return (
    <AuthFormLayout
      eyebrow="Entrar"
      title="Acesse seu cockpit"
      subtitle="Use o e-mail vinculado à sua conta para abrir o dashboard, trocar de loja e seguir com a operação."
    >
      <LoginForm initialMessage={initialMessage} />
      <div className="auth-divider">
        <span />
        <strong>ou</strong>
        <span />
      </div>
      <a className="auth-next-link" href="/register-merchant">
        <span>
          <strong>Criar conta no Resumo</strong>
          Abra sua operação em menos de dois minutos.
        </span>
        <em aria-hidden="true">→</em>
      </a>
    </AuthFormLayout>
  );
}
