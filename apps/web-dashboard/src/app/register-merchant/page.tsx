import { MerchantOnboardingForm } from "../../components/merchant-onboarding-form";
import { AuthPageShell } from "../../components/auth-page-shell";

export default function RegisterMerchantPage() {
  return (
    <AuthPageShell
      eyebrow="Onboarding"
      title="Abra sua primeira loja e saia do zero no mesmo fluxo."
      subtitle="Crie a conta do lojista, defina o nome da operação, valide o slug em tempo real e comece com o subdomínio padrão pronto para uso."
      links={[
        { href: "/login", label: "Já tenho acesso" },
        { href: "/register", label: "Quero só criar minha conta" }
      ]}
    >
      <div>
        <div className="eyebrow">Primeira loja</div>
        <h2 className="section-title">Conta e onboarding do lojista</h2>
      </div>
      <MerchantOnboardingForm mode="signup" />
    </AuthPageShell>
  );
}
