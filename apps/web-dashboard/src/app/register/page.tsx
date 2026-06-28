import { AuthPageShell } from "../../components/auth-page-shell";
import { RegisterForm } from "../../components/auth-forms";

export default function RegisterPage() {
  return (
    <AuthPageShell
      eyebrow="Cadastro"
      title="Crie sua conta antes de abrir a primeira loja."
      subtitle="Esse fluxo cria o acesso base do usuário. Depois do login, você segue com a criação e a operação das lojas vinculadas."
      links={[
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
