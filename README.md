# SaaS Monorepo Starter

Estrutura inicial de um monorepo para produto SaaS com:

- `apps/web-storefront`: Next.js para a vitrine publica
- `apps/web-dashboard`: Next.js para o painel operacional
- `apps/api`: NestJS para API, jobs e integracoes
- `packages/database`: Prisma + schema base multi-tenant
- `packages/queue`: BullMQ + fabrica de filas
- `packages/config`: validacao de ambiente compartilhada
- `packages/types`: tipos compartilhados

## Stack escolhida neste primeiro corte

- Frontend: Next.js 15 + App Router
- Backend: NestJS 11
- Banco: PostgreSQL
- ORM: Prisma
- Cache/filas: Redis + BullMQ
- Pagamentos padrao: Stripe Connect
- Storage: S3 compativel com AWS S3 ou Cloudflare R2
- E-mail padrao: Resend
- Deploy sugerido: `apps/web` na Vercel e `apps/api` em Fly.io, Render ou AWS

As outras opcoes que voce listou continuam viaveis. A base foi deixada modular para trocar provider sem reescrever o projeto inteiro.

## Estrutura

```text
apps/
  api/
  web-storefront/
  web-dashboard/
packages/
  config/
  database/
  queue/
  types/
```

## Primeiros passos

1. Copie `.env.example` para `.env`.
2. Suba infraestrutura local com `pnpm compose:up`.
3. Instale dependencias com `pnpm install`.
4. Gere o client Prisma com `pnpm db:generate`.
5. Aplique a baseline do banco com `pnpm db:migrate`.
6. Rode o projeto com `pnpm dev`.

O comando `pnpm dev` sobe:

- storefront em `http://localhost:3000`
- API em `http://localhost:3001`
- dashboard em `http://localhost:3002`

## Infra local

O `docker-compose.yml` sobe:

- PostgreSQL em `localhost:5432`
- Redis em `localhost:6379`
- MinIO API S3 em `http://localhost:9000`
- MinIO Console em `http://localhost:9001`

Credenciais locais do MinIO:

- usuario: `minio`
- senha: `minio123`
- bucket inicial: `saas-local`

Para validar rapidamente se a API enxerga a infraestrutura, consulte `GET /health`. O endpoint retorna `200` quando Postgres, Redis e storage estao acessiveis e `503` quando alguma dependencia estiver indisponivel.

## Prisma e migrations

O pacote `@acme/database` concentra:

- schema Prisma em `packages/database/prisma/schema.prisma`
- client compartilhado em `packages/database/src/index.ts`
- scripts de migration e status

Comandos principais:

- `pnpm db:generate`: gera o Prisma Client
- `pnpm db:migrate`: cria/aplica migrations no ambiente local
- `pnpm db:migrate:deploy`: aplica migrations existentes
- `pnpm db:status`: mostra o estado das migrations

## Autenticacao base

A API ja possui fluxo inicial de autenticacao por e-mail e senha:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

Detalhes da implementacao:

- senha com hash via `scrypt`
- access token e refresh token em JWT
- refresh token com rotacao e hash persistido no banco
- rota protegida via Bearer token em `Authorization`

## Hardening minimo da API

A base da API agora aplica um conjunto minimo de protecoes nas superfícies mais sensiveis do MVP:

- rate limit em `POST /auth/register`, `POST /auth/register-merchant`, `POST /auth/login`, `POST /auth/refresh` e `POST /payments/webhooks/stripe`
- headers basicos de seguranca como `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`
- respostas de autenticacao com `Cache-Control: no-store`
- politica de sessao stateless: a API aceita autenticacao apenas por Bearer token e rejeita fluxos com cookie em rotas de auth ou mutacoes autenticadas

Variaveis de ambiente relacionadas:

- `AUTH_RATE_LIMIT_MAX`
- `AUTH_RATE_LIMIT_WINDOW_MS`
- `WEBHOOK_RATE_LIMIT_MAX`
- `WEBHOOK_RATE_LIMIT_WINDOW_MS`

Estrategia CSRF adotada neste MVP:

- nao usar cookie de sessao nem cookie de refresh token
- exigir `Authorization: Bearer ...` para rotas autenticadas
- rejeitar tentativas de usar cookies nesses fluxos para reduzir superficie de CSRF e sessao implicita

## Autorizacao base

A API agora separa autenticacao de autorizacao:

- `JwtAuthGuard`: valida o Bearer token e injeta o usuario autenticado
- `AuthorizationGuard`: valida papel global e contexto de loja
- `@PlatformRoles(...)`: restringe rotas por papel global
- `@StoreAccess()`: exige resolucao de `storeId`
- `@StoreRoles(...)`: restringe rotas por membership da loja

O `storeId` pode ser resolvido por:

- `params.storeId`
- `body.storeId`
- `query.storeId`
- header `x-store-id`

## Store base

O modelo inicial de `Store` ja inclui:

- `slug` interno unico
- `defaultSubdomain` unico
- `ownerId` com relacao explicita ao usuario dono
- configuracoes iniciais: `supportEmail`, `currencyCode` e `locale`

O endpoint `POST /stores` ja normaliza slug/subdominio, bloqueia slugs reservados e cria a loja vinculada ao usuario autenticado.

## Onboarding inicial do lojista

O endpoint `POST /auth/register-merchant` agora cria em uma unica transacao:

- usuario
- loja inicial
- membership `STORE_OWNER`
- subdominio padrao unico

O subdominio padrao nasce a partir do slug normalizado e aplica sufixos previsiveis quando houver colisao.

## Ambiente e validacao

O pacote `@acme/config` agora separa a configuracao em blocos:

- base da aplicacao: URLs, banco, Redis e JWT
- URLs separadas: `STOREFRONT_URL`, `DASHBOARD_URL` e `API_URL`
- pagamentos: `PAYMENTS_ENABLED` + `PAYMENT_PROVIDER`
- storage: `STORAGE_PROVIDER`
- e-mail: `EMAIL_ENABLED` + `EMAIL_PROVIDER`
- dominios: `DOMAINS_ENABLED` + `DOMAIN_PROVIDER`
- frontends: `NEXT_PUBLIC_STOREFRONT_URL`, `NEXT_PUBLIC_DASHBOARD_URL` e `NEXT_PUBLIC_API_URL`

Regras importantes:

- a API falha no bootstrap com mensagem clara quando faltar variavel obrigatoria
- pagamentos, e-mail e dominios so exigem credenciais quando o bloco estiver habilitado
- storage continua validado sempre, porque faz parte da base operacional do projeto

Exemplos:

- desenvolvimento local: `PAYMENTS_ENABLED=false`, `EMAIL_ENABLED=false`, `DOMAINS_ENABLED=false`
- ativando Stripe: `PAYMENTS_ENABLED=true` e preencher `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
- ativando Cloudflare: `DOMAINS_ENABLED=true` e preencher `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`

## Proximos passos recomendados

1. Escolher estrategia de autenticacao: Clerk, Auth.js ou auth propria no NestJS.
2. Implementar tenancy por subdominio e dominios customizados.
3. Fechar o provider inicial de pagamentos entre Stripe Connect, Pagar.me, Mercado Pago ou Asaas.
4. Adicionar observabilidade com Sentry + OpenTelemetry.
5. Definir CI/CD com migrations, seeds e deploy por ambiente.
