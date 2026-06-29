import { baseLayout, stripHtml, RenderedEmail, TemplateVariables } from "./base-layout";

export function render(variables: TemplateVariables): RenderedEmail {
  const customerFullName = String(variables.customerFullName ?? "Cliente");
  const storeName = String(variables.storeName ?? "");
  const orderId = String(variables.orderId ?? "");
  const totalLabel = String(variables.totalLabel ?? "");
  const itemCount = String(variables.itemCount ?? "");

  const htmlBody = `
<h1>Pedido confirmado 🎉</h1>
<p>Olá, <strong>${escapeHtml(customerFullName)}</strong>!</p>
<p>Seu pedido na loja <strong>${escapeHtml(storeName)}</strong> foi criado com sucesso e está sendo processado.</p>
<div class="details">
<dl>
  <dt>Pedido</dt>
  <dd>${escapeHtml(orderId)}</dd>
  <dt>Itens</dt>
  <dd>${escapeHtml(itemCount)}</dd>
  <dt>Total</dt>
  <dd>${escapeHtml(totalLabel)}</dd>
</dl>
</div>
<p>Você receberá uma notificação quando o pagamento for confirmado.</p>
<p style="font-size:13px;color:#888;margin-top:24px">Se você tiver dúvidas, entre em contato com a loja.</p>`;

  const text = stripHtml(htmlBody);

  return {
    subject: `Pedido confirmado — ${storeName}`,
    html: baseLayout("Pedido confirmado", htmlBody),
    text
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
