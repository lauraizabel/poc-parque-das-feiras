import { AuthPageShell } from "../../components/auth-page-shell";
import { ForgotPasswordForm } from "../../components/auth-forms";

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell
      eyebrow="Recuperação"
      title="Peça um novo link para redefinir a sua senha."
      subtitle="Se o e-mail existir na plataforma, enviamos um token válido para redefinir a credencial com segurança."
      links={[
        { href: "/login", label: "Voltar ao login" },
        { href: "/register", label: "Criar conta" }
      ]}
    >
      <div>
        <div className="eyebrow">Esqueci minha senha</div>
        <h2 className="section-title">Solicitar redefinição</h2>
      </div>
      <ForgotPasswordForm />
    </AuthPageShell>
  );
}
