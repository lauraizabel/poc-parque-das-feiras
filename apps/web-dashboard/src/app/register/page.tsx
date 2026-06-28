import { AuthPageShell } from "../../components/auth-page-shell";
import { RegisterForm } from "../../components/auth-forms";

export default function RegisterPage() {
  return (
    <AuthPageShell
      eyebrow="Cadastro"
      title="Crie sua conta antes de abrir a primeira loja."
      subtitle="Esse fluxo cria o acesso base do usuário. Se preferir já sair com a primeira loja pronta, use o onboarding completo do lojista."
      links={[
        { href: "/register-merchant", label: "Quero criar minha loja agora" },
        { href: "/login", label: "Já tenho acesso" },
        { href: "/forgot-password", label: "Preciso recuperar minha senha" }
      ]}
    >
      <div>
        <div className="eyebrow">Nova conta</div>
        <h2 className="section-title">Cadastro inicial</h2>
      </div>
      <RegisterForm />
    </AuthPageShell>
  );
}
