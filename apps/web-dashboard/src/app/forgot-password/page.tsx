import { AuthFormLayout } from "../../components/auth-page-shell";
import { ForgotPasswordForm } from "../../components/auth-forms";

export default function ForgotPasswordPage() {
  return (
    <AuthFormLayout
      eyebrow="Recuperação"
      title="Solicite um novo link"
      subtitle="Se o e-mail existir na plataforma, enviamos um token válido para redefinir a credencial com segurança."
    >
      <ForgotPasswordForm />
      <a className="auth-next-link" href="/login">
        <span>
          <strong>Voltar ao login</strong>
          Use sua senha atual se já recuperou o acesso.
        </span>
        <em aria-hidden="true">→</em>
      </a>
    </AuthFormLayout>
  );
}
