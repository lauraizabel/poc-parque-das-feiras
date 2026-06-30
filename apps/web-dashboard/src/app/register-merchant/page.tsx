import { MerchantOnboardingForm } from "../../components/merchant-onboarding-form";

const steps = [
  ["01", "Conta", "active"],
  ["02", "Identidade", "pending"],
  ["03", "Operação", "pending"],
  ["04", "Domínio", "pending"]
];

export default function RegisterMerchantPage() {
  return (
    <main className="onboarding-setup-shell">
      <header className="onboarding-setup-topbar">
        <a className="dashboard-brand" href="/login">
          <div className="dashboard-brand-mark">R</div>
          <div>
            <strong>Resumo</strong>
            <span>Setup inicial</span>
          </div>
        </a>
        <nav className="dashboard-action-row">
          <a className="dashboard-action" href="/login">
            Já tenho acesso
          </a>
          <a className="dashboard-action" href="/register">
            Criar só a conta
          </a>
        </nav>
      </header>

      <section className="onboarding-setup-grid">
        <aside className="onboarding-progress-card">
          <div className="eyebrow">Progresso</div>
          {steps.map(([step, label, status]) => (
            <div className={`onboarding-step is-${status}`} key={step}>
              <span>{step}</span>
              <strong>{label}</strong>
            </div>
          ))}
        </aside>

        <section className="onboarding-form-panel">
          <div>
            <div className="eyebrow">Primeira loja</div>
            <h1>Configure sua operação</h1>
            <p>
              Crie o acesso do lojista, defina o nome da loja, valide o slug em tempo real e comece
              com o subdomínio padrão pronto para uso.
            </p>
          </div>
          <MerchantOnboardingForm mode="signup" />
        </section>
      </section>
    </main>
  );
}
