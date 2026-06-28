import { AuthPageShell } from "../../components/auth-page-shell";
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
    <AuthPageShell
      eyebrow="Acesso"
      title="Entre no painel e recupere seu contexto de loja."
      subtitle="Faça login com seu e-mail e senha para abrir o dashboard, trocar de loja e seguir com a operação."
      links={[
        { href: "/register", label: "Criar conta" },
        { href: "/forgot-password", label: "Esqueci minha senha" }
      ]}
    >
      <div>
        <div className="eyebrow">Entrar</div>
        <h2 className="section-title">Acesso do lojista</h2>
      </div>
      <LoginForm initialMessage={initialMessage} />
    </AuthPageShell>
  );
}
