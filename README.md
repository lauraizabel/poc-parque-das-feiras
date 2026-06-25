# SaaS Monorepo Starter

Estrutura inicial de um monorepo para produto SaaS com:

- `apps/web`: Next.js para site publico e painel
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
  web/
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

## Proximos passos recomendados

1. Escolher estrategia de autenticacao: Clerk, Auth.js ou auth propria no NestJS.
2. Implementar tenancy por subdominio e dominios customizados.
3. Fechar o provider inicial de pagamentos entre Stripe Connect, Pagar.me, Mercado Pago ou Asaas.
4. Adicionar observabilidade com Sentry + OpenTelemetry.
5. Definir CI/CD com migrations, seeds e deploy por ambiente.
