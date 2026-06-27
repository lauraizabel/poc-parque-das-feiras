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

## Arquitetura em alto nivel

O monorepo esta organizado em tres camadas:

- `apps/`: superficies executaveis do produto. Hoje temos a API NestJS e dois frontends Next.js.
- `packages/`: blocos compartilhados de infra e dominio, como configuracao, banco, filas e tipos.
- `infra local`: Postgres, Redis e MinIO via Docker Compose para desenvolvimento.

Na pratica, o fluxo principal do MVP hoje e:

1. lojista cria conta e loja em `auth/register-merchant`
2. loja passa a operar sob `defaultSubdomain` proprio
3. catalogo, carrinho, checkout e pagamento usam a resolucao de tenant por host
4. webhooks e workers reconciliam estados assincronos
5. dashboard opera pedidos, envio e auditoria por `storeId`

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

## Setup local detalhado

Ordem recomendada para um ambiente limpo:

1. copiar `.env.example` para `.env`
2. subir dependencias com `pnpm compose:up`
3. instalar dependencias com `pnpm install`
4. gerar Prisma Client com `pnpm db:generate`
5. aplicar migrations com `pnpm db:migrate`
6. iniciar apps com `pnpm dev`

Checks uteis depois do bootstrap:

- `GET /health` para validar banco, Redis e storage
- `GET /integrations` para conferir o catalogo de providers suportados
- `pnpm --filter @acme/api build` para validar compilacao da API
- `pnpm --filter @acme/api test:smoke-e2e` para validar o fluxo core ponta a ponta

## Testes smoke do core

Para validar rapidamente o fluxo principal da API ponta a ponta, rode:

- `pnpm --filter @acme/api build`
- `pnpm --filter @acme/api test:smoke-e2e`

A suíte smoke cobre onboarding do lojista, cadastro/publicação de produto, checkout, criação de intent de pagamento, aprovação por webhook e atualização operacional do pedido.

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

## Modulos principais da API

O `AppModule` hoje agrega os seguintes modulos de negocio e suporte:

- `auth`: cadastro, login, refresh token, memberships e bootstrap do dashboard
- `stores`: operacoes administrativas da loja e fixtures de suporte
- `domains`: resolucao por host, dominio customizado, DNS e SSL
- `catalog`: categorias, produtos e publicacao para vitrine
- `cart`: carrinho publico por sessao ou e-mail do cliente
- `checkout`: consolidacao do carrinho em pedido com snapshot de itens e endereco
- `payments`: intents, webhooks, reconciliacao de status e transacoes
- `shipping`: metodos de frete e dados operacionais de entrega
- `orders`: consulta publica do pedido e operacao do backoffice
- `notifications`: fila e processamento de notificacoes de e-mail
- `audit`: trilha de eventos sensiveis e transicoes operacionais
- `health`: healthcheck de dependencias
- `integrations`: catalogo dos providers suportados
- `platform/security`: rate limit e headers basicos do MVP

Os modulos expostos ao storefront publico usam middlewares de resolucao por host; os modulos operacionais usam `JwtAuthGuard` + `AuthorizationGuard` e contexto de `storeId`.

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

## Variaveis de ambiente mais importantes

Blocos criticos para subir a base local:

- URLs: `STOREFRONT_URL`, `DASHBOARD_URL`, `API_URL`
- tenancy: `MARKETPLACE_ROOT_DOMAIN`
- persistencia: `DATABASE_URL`, `REDIS_URL`
- autenticacao: `JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`
- hardening: `AUTH_RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_WINDOW_MS`, `WEBHOOK_RATE_LIMIT_MAX`, `WEBHOOK_RATE_LIMIT_WINDOW_MS`
- storage: `STORAGE_PROVIDER`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_ENDPOINT`

Blocos opcionais que so ficam obrigatorios quando habilitados:

- pagamentos: `PAYMENTS_ENABLED`, `PAYMENT_PROVIDER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- dominios: `DOMAINS_ENABLED`, `DOMAIN_PROVIDER`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `VERCEL_ACCESS_TOKEN`, `VERCEL_PROJECT_ID`
- e-mail: `EMAIL_ENABLED`, `EMAIL_PROVIDER`, `RESEND_API_KEY`, `SENDGRID_API_KEY`, `AWS_SES_*`

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

## Fluxo multi-tenant

O modelo multi-tenant do MVP combina contexto autenticado com resolucao publica por host:

- cada `Store` possui `slug` interno e `defaultSubdomain` unico
- o storefront publico resolve a loja pelo `host` ou `x-forwarded-host`
- endpoints publicos de `cart`, `checkout`, `payments/public` e `orders/public` operam sempre no tenant resolvido pelo host
- endpoints operacionais resolvem e validam `storeId` por `params`, `body`, `query` ou header `x-store-id`
- quando ha conflito entre valores de `storeId`, a API bloqueia a requisicao

Esse desenho evita depender de um tenant global em sessao e reduz risco de vazamento cross-tenant.

## Store base

O modelo inicial de `Store` ja inclui:

- `slug` interno unico
- `defaultSubdomain` unico
- `ownerId` com relacao explicita ao usuario dono
- configuracoes iniciais: `supportEmail`, `currencyCode` e `locale`

O endpoint `POST /stores` ja normaliza slug/subdominio, bloqueia slugs reservados e cria a loja vinculada ao usuario autenticado.

## Dominio customizado

O fluxo de dominio customizado hoje segue estas etapas:

1. lojista registra um host `www.seudominio.com` em `POST /domains`
2. a API normaliza o host, impede dominio apex sem `www` e evita duplicidade
3. o sistema gera `dnsTargetValue` apontando para `<defaultSubdomain>.<MARKETPLACE_ROOT_DOMAIN>`
4. uma fila agenda verificacao de DNS
5. quando o CNAME confere, a API agenda provisionamento de SSL
6. o status evolui entre `AWAITING_DNS`, `VERIFYING`, `SSL_PENDING`, `ACTIVE` ou `ERROR`

Rotas operacionais relevantes:

- `GET /domains/:storeId`
- `POST /domains`
- `POST /domains/:storeId/verify-dns`
- `POST /domains/:storeId/sync-ssl`

Workers relacionados:

- `pnpm --filter @acme/api worker:domains-dns`
- `pnpm --filter @acme/api worker:domains-ssl`

## Onboarding inicial do lojista

O endpoint `POST /auth/register-merchant` agora cria em uma unica transacao:

- usuario
- loja inicial
- membership `STORE_OWNER`
- subdominio padrao unico

O subdominio padrao nasce a partir do slug normalizado e aplica sufixos previsiveis quando houver colisao.

## Fluxo de pagamentos

O fluxo padrao de pagamentos do MVP hoje esta preparado para Stripe Connect:

1. checkout gera um pedido em estado `CREATED`
2. `POST /payments/public/orders/:orderId/intent` cria ou reutiliza um `Payment` e abre um intent no provider
3. o pedido vai para `WAITING_PAYMENT`
4. `POST /payments/webhooks/stripe` persiste o evento bruto e agenda processamento assincrono
5. o worker/processador converte o evento em transicao de pagamento e pedido
6. o dashboard passa a operar o pedido a partir de `PAYMENT_APPROVED` ou `PAYMENT_FAILED`

Eventos tratados no reconciliador atual:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `charge.refunded`

Workers relacionados:

- `pnpm --filter @acme/api worker:payments-webhooks`

Testes mais uteis para essa area:

- `pnpm --filter @acme/api test:payments-webhook`
- `pnpm --filter @acme/api test:smoke-e2e`

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

## Filas e workers

A base atual usa BullMQ para tarefas assincronas que nao devem bloquear o request principal:

- verificacao de DNS de dominio customizado
- provisionamento e sincronizacao de SSL
- processamento de webhooks de pagamento
- notificacoes de e-mail

Workers disponiveis hoje:

- `worker:domains-dns`
- `worker:domains-ssl`
- `worker:payments-webhooks`
- `worker:notifications-email`

Em desenvolvimento, e aceitavel rodar apenas a API quando o foco for CRUD e testes sincronizados. Para validar reconciliacao real de filas, suba tambem os workers correspondentes.

## Fluxos principais do MVP

Os fluxos que hoje melhor representam a base do projeto sao:

- onboarding do lojista com criacao de loja e membership inicial
- cadastro e publicacao de categorias e produtos
- navegacao publica por subdominio/default host
- carrinho por sessao ou e-mail do cliente
- checkout com frete, snapshot do pedido e token publico do cliente
- pagamento com intent + webhook + reconciliacao de status
- operacao de pedido no dashboard com transicoes e auditoria
- dominio customizado com DNS e SSL assincronos

O caminho mais rapido para verificar esse conjunto e rodar a suite smoke da API.

## Limitacoes conhecidas do MVP

Decisoes deliberadas desta base inicial:

- autenticacao totalmente stateless por Bearer token, sem cookie de sessao
- rate limit em memoria de processo, adequado para MVP/local mas nao para distribuicao horizontal sem adaptacao
- reconciliacao de pagamentos depende de webhook e worker; sem isso o pedido fica em `WAITING_PAYMENT`
- dominios customizados assumem estrategia `www` e nao suportam apex diretamente neste corte
- documentacao operacional ainda esta concentrada no `README`; runbooks dedicados entram na task seguinte
- catalogo de integracoes existe, mas o provider realmente exercitado no fluxo principal hoje e Stripe Connect

## Proximos passos recomendados

1. Escolher estrategia de autenticacao: Clerk, Auth.js ou auth propria no NestJS.
2. Implementar tenancy por subdominio e dominios customizados.
3. Fechar o provider inicial de pagamentos entre Stripe Connect, Pagar.me, Mercado Pago ou Asaas.
4. Adicionar observabilidade com Sentry + OpenTelemetry.
5. Definir CI/CD com migrations, seeds e deploy por ambiente.
