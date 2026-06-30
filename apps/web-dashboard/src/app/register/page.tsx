import { AuthFormLayout } from "../../components/auth-page-shell";
import { RegisterForm } from "../../components/auth-forms";

const perks = [
  "Catálogo, pedidos, vitrine e domínio em um só console",
  "Operação preparada para múltiplas lojas desde o primeiro acesso",
  "Equipe com papéis granulares para crescer com controle"
];

export default function RegisterPage() {
  return (
    <AuthFormLayout
      eyebrow="Cadastro · 01 de 02"
      marketing={{
        title: "Operar uma marca digital deveria parecer com pilotar.",
        subtitle:
          "Crie sua conta no Resumo e siga para o setup da primeira loja quando estiver pronto.",
        metrics: [
          { value: "3min", label: "setup médio" },
          { value: "BRL", label: "moeda inicial" },
          { value: "24/7", label: "telemetria" }
        ],
        perks
      }}
      reverse
      subtitle="Esse fluxo cria o acesso base do usuário. Para sair com a loja pronta, use o onboarding completo."
      title="Abra sua conta operacional"
    >
      <RegisterForm />
      <a className="auth-next-link" href="/register-merchant">
        <span>
          <strong>Criar conta e primeira loja</strong>
          Pule a etapa separada e configure sua operação agora.
        </span>
        <em aria-hidden="true">→</em>
      </a>
    </AuthFormLayout>
  );
}
