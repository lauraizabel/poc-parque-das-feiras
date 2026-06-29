import { baseLayout, stripHtml, RenderedEmail, TemplateVariables } from "./base-layout";

export function render(variables: TemplateVariables): RenderedEmail {
  const storeName = String(variables.storeName ?? "Sua loja");
  const domainHost = String(variables.domainHost ?? "");
  const storeSlug = String(variables.storeSlug ?? "");

  const htmlBody = `
<h1>Domínio ativado com sucesso 🎉</h1>
<p>Olá!</p>
<p>O domínio personalizado da sua loja <strong>${escapeHtml(storeName)}</strong> foi ativado!</p>
<div class="details">
<dl>
  <dt>Domínio</dt>
  <dd>${escapeHtml(domainHost)}</dd>
  <dt>Loja</dt>
  <dd>${escapeHtml(storeName)}</dd>
</dl>
</div>
<p>Seu público já pode acessar sua loja pelo endereço:</p>
<p><a href="https://${escapeHtml(domainHost)}" style="color:#c45c2c">https://${escapeHtml(domainHost)}</a></p>
<p>Além disso, o subdomínio padrão continua disponível:</p>
<p><a href="https://${escapeHtml(storeSlug)}.parquedasfeiras.com" style="color:#c45c2c">https://${escapeHtml(storeSlug)}.parquedasfeiras.com</a></p>`;

  const text = stripHtml(htmlBody);

  return {
    subject: `Domínio ativado — ${storeName}`,
    html: baseLayout("Domínio ativado", htmlBody),
    text
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
