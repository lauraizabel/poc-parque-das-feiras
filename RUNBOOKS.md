# Runbooks Operacionais

Runbooks curtos para os incidentes mais prováveis da base atual do MVP.

## Checklist rapido

Antes de entrar em um incidente específico:

1. validar infraestrutura local com `pnpm compose:up`
2. validar dependencias da API com `GET /health`
3. confirmar que a API foi buildada com `pnpm --filter @acme/api build`
4. confirmar que os workers necessários estão rodando

Workers disponíveis:

- `pnpm --filter @acme/api worker:payments-webhooks`
- `pnpm --filter @acme/api worker:domains-dns`
- `pnpm --filter @acme/api worker:domains-ssl`
- `pnpm --filter @acme/api worker:notifications-email`

## Falha de webhook de pagamento

Sintomas comuns:

- pedido fica preso em `WAITING_PAYMENT`
- pagamento fica em `PENDING`
- webhook retorna `403`, `400` ou entra mas não reconcilia estado

Diagnóstico rápido:

1. confirmar que `STRIPE_WEBHOOK_SECRET` está preenchido quando `PAYMENTS_ENABLED=true`
2. conferir se `POST /payments/webhooks/stripe` está recebendo header `stripe-signature`
3. verificar se o worker `worker:payments-webhooks` está rodando
4. rodar `pnpm --filter @acme/api test:payments-webhook`
5. se necessário, rodar `pnpm --filter @acme/api test:payments-processing`

Erros/códigos mais prováveis:

- `STRIPE_WEBHOOK_SECRET_MISSING`: segredo do webhook não configurado
- `STRIPE_SIGNATURE_MISSING`: assinatura não chegou no request
- `STRIPE_SIGNATURE_INVALID`: payload assinado com segredo errado ou corpo alterado
- `STRIPE_WEBHOOK_BODY_INVALID`: payload não é JSON válido
- `STRIPE_WEBHOOK_EVENT_ID_REQUIRED`: evento sem `id`
- `PAYMENT_WEBHOOK_METADATA_INCOMPLETE`: metadata sem `paymentId`, `orderId` ou `storeId`
- `PAYMENT_WEBHOOK_EVENT_UNSUPPORTED`: tipo de evento ainda não tratado

Ações imediatas:

1. corrigir env e reiniciar a API se o segredo estiver ausente ou incorreto
2. reentregar o webhook somente depois de subir o worker
3. se o evento entrou mas o pedido não andou, conferir se o job foi processado pelo worker e se não travou por timeout/retry
4. se o tipo de evento não for suportado, tratar como limitação conhecida do MVP e não como indisponibilidade da fila

Notas úteis:

- a fila usada é `payment-webhook-processing`
- política atual: `attempts=6`, `backoff=5000ms`, `timeout=45000ms`, `concurrency=4`
- sem worker, o evento pode ser persistido mas o pedido não sai de `WAITING_PAYMENT`

## Falha de domínio customizado / SSL

Sintomas comuns:

- domínio fica em `AWAITING_DNS`, `VERIFYING`, `SSL_PENDING` ou `ERROR`
- host customizado não resolve storefront
- SSL não ativa mesmo após apontamento de DNS

Diagnóstico rápido:

1. confirmar que o host foi cadastrado como `www.seudominio.com`
2. chamar `GET /domains/:storeId` para inspecionar status e campos de DNS/SSL
3. rodar `POST /domains/:storeId/verify-dns` para forçar nova verificação
4. rodar `POST /domains/:storeId/sync-ssl` quando já existir `sslProvisioningId`
5. confirmar que `worker:domains-dns` e `worker:domains-ssl` estão rodando
6. rodar `pnpm --filter @acme/api test:domains`

Erros/códigos mais prováveis:

- `DOMAIN_HOST_WWW_REQUIRED`: domínio apex sem `www`
- `DOMAIN_HOST_ALREADY_IN_USE`: host já registrado por outra loja
- `STORE_CUSTOM_DOMAIN_ALREADY_EXISTS`: loja já possui domínio customizado
- `STORE_CUSTOM_DOMAIN_NOT_FOUND`: loja ainda não tem domínio customizado
- `DOMAIN_SSL_PROVISIONING_MISSING`: sincronização de SSL disparada antes do provisioning

Ações imediatas:

1. garantir que o CNAME do host aponta para `<defaultSubdomain>.<MARKETPLACE_ROOT_DOMAIN>`
2. reexecutar a verificação de DNS depois da propagação
3. se DNS estiver correto e SSL seguir pendente, subir/validar o worker de SSL
4. se o status for `ERROR`, inspecionar a mensagem persistida de DNS/SSL e corrigir provider ou apontamento antes de tentar de novo

Notas úteis:

- filas envolvidas: `domain-dns-verification`, `domain-ssl-provisioning`, `domain-ssl-status`
- políticas atuais:
- DNS: `attempts=5`, `backoff=10000ms`, `timeout=60000ms`, `concurrency=2`
- SSL provisioning: `attempts=8`, `backoff=15000ms`, `timeout=120000ms`, `concurrency=1`
- SSL status: `attempts=10`, `backoff=30000ms`, `timeout=60000ms`, `concurrency=1`

## Falha de e-mail / notificação

Sintomas comuns:

- notificação é enfileirada mas não “entrega”
- worker de e-mail não consome jobs
- erro de validação ao tentar enfileirar notificação

Diagnóstico rápido:

1. confirmar que `worker:notifications-email` está rodando
2. validar infraestrutura com `GET /health` e foco em Redis
3. rodar `pnpm --filter @acme/api test:notifications-queue`
4. revisar payload da notificação, principalmente `to`, `subject` e `templateKey`

Erros/códigos mais prováveis:

- `NOTIFICATION_EMAIL_INVALID`: e-mail do destinatário inválido
- `NOTIFICATION_SUBJECT_REQUIRED`: assunto ausente ou curto demais
- `NOTIFICATION_TEMPLATE_REQUIRED`: template ausente ou curto demais

Ações imediatas:

1. corrigir payload de entrada se a fila nem aceita o job
2. subir o worker de e-mail se o job é aceito mas não há processamento
3. validar Redis se houver sintomas de fila parada
4. lembrar que o provider atual do processamento é `console`, então em desenvolvimento a “entrega” aparece em log, não em provedor externo real

Notas úteis:

- fila usada: `notifications-email`
- política atual: `attempts=5`, `backoff=10000ms`, `timeout=30000ms`, `concurrency=4`

## Falha de fila / worker

Sintomas comuns:

- jobs entram e não são consumidos
- worker não sobe
- logs mostram `failed`, `stalled` ou timeout de job

Diagnóstico rápido:

1. confirmar `REDIS_URL` válido e Redis acessível
2. validar `GET /health` e olhar o check de Redis
3. reiniciar o worker específico do fluxo afetado
4. confirmar que a API foi buildada antes de subir worker com `pnpm --filter @acme/api build`
5. observar logs padrão do worker:
   - `<queue> worker ready`
   - `<queue> completed`
   - `<queue> failed`
   - `<queue> stalled`
   - `<queue> worker error`

Ações imediatas:

1. se o worker não sobe, rebuildar a API e reiniciar o processo
2. se houver `stalled`, investigar timeout ou processamento bloqueado
3. se houver `failed`, olhar a mensagem do erro do job e correlacionar com o módulo dono
4. se todos os workers falharem ao mesmo tempo, tratar primeiro como incidente de Redis

Isolamento por fluxo:

- pagamento: subir `worker:payments-webhooks`
- domínio/DNS: subir `worker:domains-dns`
- domínio/SSL: subir `worker:domains-ssl`
- e-mail: subir `worker:notifications-email`

## Comandos de referência

- `pnpm compose:up`
- `pnpm compose:down`
- `pnpm db:status`
- `pnpm --filter @acme/api build`
- `pnpm --filter @acme/api test:smoke-e2e`
- `pnpm --filter @acme/api test:payments-webhook`
- `pnpm --filter @acme/api test:payments-processing`
- `pnpm --filter @acme/api test:domains`
- `pnpm --filter @acme/api test:notifications-queue`
