import { baseLayout, stripHtml, RenderedEmail, TemplateVariables } from "./base-layout";

export function render(variables: TemplateVariables): RenderedEmail {
  const storeName = String(variables.storeName ?? "");
  const orderId = String(variables.orderId ?? "");
  const customerEmail = String(variables.customerEmail ?? "");
  const totalLabel = String(variables.totalLabel ?? "");
  const itemCount = String(variables.itemCount ?? "");

  const htmlBody = `
<h1>Novo pedido recebido 🛒</h1>
<p>Sua loja <strong>${escapeHtml(storeName)}</strong> recebeu um novo pedido!</p>
<div class="details">
<dl>
  <dt>Pedido</dt>
  <dd>${escapeHtml(orderId)}</dd>
  <dt>Cliente</dt>
  <dd>${escapeHtml(customerEmail)}</dd>
  <dt>Itens</dt>
  <dd>${escapeHtml(itemCount)}</dd>
  <dt>Total</dt>
  <dd>${escapeHtml(totalLabel)}</dd>
</dl>
</div>
<p>Acesse o painel da sua loja para gerenciar o pedido.</p>`;

  const text = stripHtml(htmlBody);

  return {
    subject: `Novo pedido — ${storeName}`,
    html: baseLayout("Novo pedido", htmlBody),
    text
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
