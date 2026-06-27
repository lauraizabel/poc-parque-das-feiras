# Checklist de Deploy Inicial

Checklist para subir o primeiro ambiente do MVP com ordem segura de ativação.

## Objetivo

Garantir que o ambiente inicial suba com:

- banco e Redis acessíveis
- storage funcional
- API compilando e inicializando com env válido
- frontends apontando para as URLs corretas
- pagamentos, domínios e e-mail ativados apenas quando seus segredos e endpoints estiverem prontos

## 1. Preparação

Antes do primeiro deploy:

1. confirmar branch/revisão a publicar
2. rodar localmente `pnpm --filter @acme/api build`
3. rodar localmente `pnpm --filter @acme/api test:smoke-e2e`
4. rodar `pnpm db:status` e confirmar que as migrations esperadas estão presentes
5. validar `README.md` e `RUNBOOKS.md` como referência operacional da release

## 2. Variáveis obrigatórias

Bloco mínimo para subir a base:

- `NODE_ENV`
- `STOREFRONT_URL`
- `DASHBOARD_URL`
- `API_URL`
- `MARKETPLACE_ROOT_DOMAIN`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_ACCESS_TTL`
- `JWT_REFRESH_TTL`
- `AUTH_RATE_LIMIT_MAX`
- `AUTH_RATE_LIMIT_WINDOW_MS`
- `WEBHOOK_RATE_LIMIT_MAX`
- `WEBHOOK_RATE_LIMIT_WINDOW_MS`
- `STORAGE_PROVIDER`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

Obrigatórias conforme provider de storage:

- `S3_REGION` para `MINIO` e `S3`
- `S3_ENDPOINT` para `MINIO`
- `R2_PUBLIC_URL` para `R2`

Obrigatórias conforme pagamentos:

- `PAYMENTS_ENABLED`
- `PAYMENT_PROVIDER`
- `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` quando `PAYMENT_PROVIDER=STRIPE`
- `PAGARME_API_KEY` quando `PAYMENT_PROVIDER=PAGARME`
- `MERCADO_PAGO_ACCESS_TOKEN` quando `PAYMENT_PROVIDER=MERCADO_PAGO`
- `ASAAS_API_KEY` quando `PAYMENT_PROVIDER=ASAAS`

Obrigatórias conforme domínios:

- `DOMAINS_ENABLED`
- `DOMAIN_PROVIDER`
- `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` quando `DOMAIN_PROVIDER=CLOUDFLARE`
- `VERCEL_ACCESS_TOKEN` e `VERCEL_PROJECT_ID` quando `DOMAIN_PROVIDER=VERCEL`

Obrigatórias conforme e-mail:

- `EMAIL_ENABLED`
- `EMAIL_PROVIDER`
- `RESEND_API_KEY` quando `EMAIL_PROVIDER=RESEND`
- `SENDGRID_API_KEY` quando `EMAIL_PROVIDER=SENDGRID`
- `AWS_SES_REGION`, `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY` quando `EMAIL_PROVIDER=AWS_SES`

## 3. Ordem segura de ativação

Use esta ordem para reduzir chance de ambiente “meio ligado”:

1. banco de dados
2. Redis
3. storage
4. API
5. workers
6. storefront e dashboard
7. pagamentos
8. webhook URL do provider
9. e-mail
10. domínios customizados

Justificativa:

- a API depende de banco, Redis e storage já acessíveis para healthcheck limpo
- workers devem entrar depois da API compilada e com env válido
- pagamentos devem ser ativados antes da URL pública de webhook ser registrada
- domínios customizados devem entrar por último, quando API, workers e DNS público já estiverem corretos

## 4. Sequência de deploy

### 4.1 Infra base

1. provisionar Postgres
2. provisionar Redis
3. provisionar storage compatível com S3
4. criar bucket configurado em `S3_BUCKET`

### 4.2 Banco

1. configurar `DATABASE_URL`
2. rodar `pnpm db:migrate:deploy`
3. rodar `pnpm db:status`

Observação:

- não há processo formal de seed documentado no monorepo neste momento
- se o ambiente inicial precisar de dados administrativos ou catálogo de suporte, tratar isso explicitamente como operação manual controlada

### 4.3 API

1. configurar todas as envs base e de storage
2. executar build da API
3. subir a API
4. validar bootstrap sem erro de env

### 4.4 Workers

Subir conforme escopo do ambiente:

- `pnpm --filter @acme/api worker:payments-webhooks`
- `pnpm --filter @acme/api worker:domains-dns`
- `pnpm --filter @acme/api worker:domains-ssl`
- `pnpm --filter @acme/api worker:notifications-email`

Ambiente mínimo recomendado para produção inicial:

- `worker:payments-webhooks`
- `worker:notifications-email`

Ativar workers de domínio quando `DOMAINS_ENABLED=true`.

### 4.5 Frontends

1. configurar `NEXT_PUBLIC_APP_URL` e `NEXT_PUBLIC_API_URL` equivalentes por app
2. publicar storefront
3. publicar dashboard
4. validar navegação base e comunicação com a API

## 5. Ativação de providers externos

### Storage

Checklist:

1. bucket criado
2. credenciais válidas
3. endpoint correto para o provider
4. `GET /health` com storage em `up`

### Pagamentos

Checklist:

1. `PAYMENTS_ENABLED=true`
2. `PAYMENT_PROVIDER` correto
3. segredos do provider configurados
4. API pública já acessível por HTTPS
5. worker de webhook ativo
6. só então registrar a URL pública de webhook no provider

Validação mínima:

1. criar pedido
2. criar intent
3. entregar webhook de teste
4. confirmar que o pedido sai de `WAITING_PAYMENT`

### E-mail

Checklist:

1. `EMAIL_ENABLED=true`
2. provider e credenciais corretos
3. worker de e-mail ativo
4. testar uma notificação simples

Observação:

- o processamento atual usa provider `console` no fluxo do worker; integração real de entrega ainda precisa ser completada antes de depender disso em produção

### Domínios customizados

Checklist:

1. `DOMAINS_ENABLED=true`
2. provider de domínio configurado
3. API pública e workers de domínio ativos
4. `MARKETPLACE_ROOT_DOMAIN` apontando corretamente para a plataforma
5. registrar primeiro um domínio `www`, nunca apex direto neste corte
6. validar DNS antes de esperar SSL

## 6. Validações pós-deploy

Executar após subir o ambiente:

1. `GET /health`
2. `GET /integrations`
3. fluxo de autenticação básico
4. criação de loja via `register-merchant`
5. fluxo smoke principal

Checklist funcional mínimo:

- `GET /health` retorna `200`
- storefront e dashboard carregam nas URLs esperadas
- `POST /auth/register-merchant` funciona
- produto pode ser criado/publicado
- checkout cria pedido
- intent de pagamento é criada
- webhook processa e atualiza pedido

## 7. Critérios de rollback / bloqueio

Não seguir com ativação de pagamentos ou domínios se:

- `GET /health` não estiver saudável
- migrations falharem
- API não subir com env válido
- worker de webhook não estiver operacional
- smoke do fluxo principal falhar

Rollback mínimo recomendado:

1. remover tráfego novo
2. desativar entrada de webhook externa se ela já foi publicada
3. voltar a revisão anterior da API/frontends
4. preservar banco e filas para análise antes de qualquer ação destrutiva

## 8. Comandos de referência

- `pnpm db:generate`
- `pnpm db:migrate`
- `pnpm db:migrate:deploy`
- `pnpm db:status`
- `pnpm --filter @acme/api build`
- `pnpm --filter @acme/api test:smoke-e2e`
- `pnpm --filter @acme/api test:payments-webhook`
- `pnpm --filter @acme/api worker:payments-webhooks`
- `pnpm --filter @acme/api worker:domains-dns`
- `pnpm --filter @acme/api worker:domains-ssl`
- `pnpm --filter @acme/api worker:notifications-email`
