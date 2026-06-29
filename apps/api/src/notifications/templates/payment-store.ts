import { baseLayout, stripHtml, RenderedEmail, TemplateVariables } from "./base-layout";

const STATUS_LABELS: Record<string, string> = {
  APPROVED: "aprovado",
  FAILED: "falhou",
  EXPIRED: "expirado",
  REFUNDED: "reembolsado"
};

export function render(variables: TemplateVariables): RenderedEmail {
  const paymentStatus = String(variables.paymentStatus ?? "");
  const statusLabel = STATUS_LABELS[paymentStatus] ?? paymentStatus.toLowerCase();
  const storeName = String(variables.storeName ?? "");
  const orderId = String(variables.orderId ?? "");
  const customerEmail = String(variables.customerEmail ?? "");
  const totalLabel = String(variables.totalLabel ?? "");

  const statusEmoji: Record<string, string> = {
    APPROVED: "✅",
    FAILED: "❌",
    EXPIRED: "⏰",
    REFUNDED: "🔄"
  };
  const emoji = statusEmoji[paymentStatus] ?? "";

  const htmlBody = `
<h1>${emoji} Pagamento ${statusLabel}</h1>
<p>Olá!</p>
<p>O pagamento de um pedido na sua loja <strong>${escapeHtml(storeName)}</strong> foi <strong>${statusLabel}</strong>.</p>
<div class="details">
<dl>
  <dt>Pedido</dt>
  <dd>${escapeHtml(orderId)}</dd>
  <dt>Cliente</dt>
  <dd>${escapeHtml(customerEmail)}</dd>
  <dt>Valor</dt>
  <dd>${escapeHtml(totalLabel)}</dd>
  <dt>Status</dt>
  <dd>${statusLabel}</dd>
</dl>
</div>
<p>Acesse o painel da sua loja para mais detalhes.</p>`;

  const text = stripHtml(htmlBody);

  return {
    subject: `Pagamento ${statusLabel} — ${storeName}`,
    html: baseLayout(`Pagamento ${statusLabel}`, htmlBody),
    text
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function escapeAttr(s: string): string {
  return s.replace(/[&<>"'/]/g, (c) => `&#${c.charCodeAt(0)};`);
}
