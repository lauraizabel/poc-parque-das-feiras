"use client";

type DashboardState = {
  kind: "idle" | "success" | "error";
  message?: string;
};

type DashboardFeedbackProps = {
  state: DashboardState;
};

type DashboardEmptyStateProps = {
  title: string;
  description: string;
};

type DashboardLoadingStateProps = {
  label: string;
};

export function DashboardFeedback({ state }: DashboardFeedbackProps) {
  if (state.kind === "idle" || !state.message) {
    return null;
  }

  return (
    <p className={state.kind === "success" ? "feedback ok dashboard-feedback" : "feedback error dashboard-feedback"}>
      {state.message}
    </p>
  );
}

export function DashboardEmptyState({
  title,
  description
}: DashboardEmptyStateProps) {
  return (
    <section className="dashboard-state-card empty">
      <div className="eyebrow">Vazio</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </section>
  );
}

export function DashboardLoadingState({ label }: DashboardLoadingStateProps) {
  return (
    <section className="dashboard-state-card loading">
      <div className="dashboard-loading-pulse" />
      <div>
        <div className="eyebrow">Carregando</div>
        <h3>{label}</h3>
        <p>Aguarde um instante enquanto o painel sincroniza os dados da loja selecionada.</p>
      </div>
    </section>
  );
}
