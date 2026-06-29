import { baseLayout, stripHtml, RenderedEmail, TemplateVariables } from "./base-layout";

export function render(variables: TemplateVariables): RenderedEmail {
  const verificationUrl = String(variables.verificationUrl ?? "");
  const htmlBody = `
<h1>Confirme o seu e-mail</h1>
<p>Obrigado por se cadastrar no Parque das Feiras! Confirme seu endereço de e-mail clicando no botão abaixo:</p>
<p style="text-align:center;margin:24px 0">
  <a href="${escapeAttr(verificationUrl)}" class="btn">Confirmar e-mail</a>
</p>
<p>Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
<p style="font-size:13px;word-break:break-all;color:#666">${escapeHtml(verificationUrl)}</p>
<p style="font-size:13px;color:#888;margin-top:24px">Se você não criou uma conta, ignore este e-mail.</p>`;

  const text = stripHtml(htmlBody);

  return {
    subject: "Confirme o seu e-mail — Parque das Feiras",
    html: baseLayout("Confirme o seu e-mail", htmlBody),
    text
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function escapeAttr(s: string): string {
  return s.replace(/[&<>"'/]/g, (c) => `&#${c.charCodeAt(0)};`);
}
