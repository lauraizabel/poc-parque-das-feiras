import { baseLayout, stripHtml, RenderedEmail, TemplateVariables } from "./base-layout";

export function render(variables: TemplateVariables): RenderedEmail {
  const resetUrl = String(variables.resetUrl ?? "");
  const htmlBody = `
<h1>Redefina a sua senha</h1>
<p>Recebemos uma solicitação para redefinir a sua senha no Parque das Feiras. Clique no botão abaixo para criar uma nova senha:</p>
<p style="text-align:center;margin:24px 0">
  <a href="${escapeAttr(resetUrl)}" class="btn">Redefinir senha</a>
</p>
<p>Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
<p style="font-size:13px;word-break:break-all;color:#666">${escapeHtml(resetUrl)}</p>
<p style="font-size:13px;color:#888;margin-top:24px">Se você não solicitou esta redefinição, ignore este e-mail. O link expira em 1 hora.</p>`;

  const text = stripHtml(htmlBody);

  return {
    subject: "Redefina a sua senha — Parque das Feiras",
    html: baseLayout("Redefina a sua senha", htmlBody),
    text
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function escapeAttr(s: string): string {
  return s.replace(/[&<>"'/]/g, (c) => `&#${c.charCodeAt(0)};`);
}
