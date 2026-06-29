export type TemplateVariables = Record<string, unknown>;

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export type TemplateRenderer = (variables: TemplateVariables) => RenderedEmail;

export function baseLayout(title: string, bodyHtml: string): string {
  const escapedTitle = title.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapedTitle}</title>
<style>
  body{margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
  .container{max-width:600px;margin:0 auto;padding:24px 16px}
  .card{background:#fff;border-radius:8px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
  .footer{margin-top:24px;text-align:center;font-size:13px;color:#888}
  h1{font-size:22px;margin:0 0 16px;color:#1a1a1a}
  p{font-size:15px;line-height:1.6;color:#444;margin:0 0 16px}
  .btn{display:inline-block;padding:12px 24px;background-color:#c45c2c;color:#fff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600}
  .btn:hover{background-color:#a84d24}
  .details{background:#f9f9f9;border-radius:6px;padding:16px;margin:16px 0;font-size:14px}
  .details dt{font-weight:600;color:#333;margin-top:8px}
  .details dd{margin:2px 0 0 0;color:#555}
</style>
</head>
<body>
<div class="container">
<div class="card">
${bodyHtml}
</div>
<div class="footer">
<p>Parque das Feiras — Marketplace de Feirantes</p>
</div>
</div>
</body>
</html>`;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
