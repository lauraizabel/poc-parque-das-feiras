# MVP Tasks

## 1. Visão Geral do MVP

O MVP é uma plataforma SaaS de marketplace multi-lojas em que cada lojista pode criar e operar sua própria loja dentro da plataforma, com vitrine pública, catálogo, carrinho, checkout, pedidos, domínio próprio, pagamentos e painel de gestão.

Diretrizes principais do MVP:

- Backend em monolito modular com NestJS.
- Multi-tenancy por `storeId`.
- Resolução da loja pública pelo `Host` da requisição.
- Cada loja nasce com um subdomínio padrão.
- Cada loja pode ter no máximo 1 domínio próprio no MVP.
- Painel do lojista separado logicamente da vitrine pública.
- Admin global com visão operacional básica da plataforma.
- Sem microservices no MVP.
- Sem banco separado por loja.
- Sem carrinho multi-loja no MVP.

## 2. Fora de Escopo do MVP

- Carrinho com itens de múltiplas lojas.
- Split complexo de pagamentos e repasses automáticos avançados.
- Multi-moeda.
- Motor avançado de promoções.
- Regras tributárias complexas.
- ERP/WMS/CRM integrações nativas.
- CMS avançado para páginas customizadas.
- Marketplace de apps/plugins.
- Internacionalização completa.
- Tema visual totalmente livre com page builder.
- App mobile nativo.
- SLA operacional multi-região.
- Busca avançada com engine dedicada.
- Recomendação de produtos por IA.
- Domínios próprios sem `www` como fluxo oficial principal.
- Mais de um domínio próprio por loja.

## 3. Épicos Principais

- Fundação do monorepo e arquitetura base
- Identidade, autenticação e autorização
- Onboarding do lojista e gestão de lojas
- Multi-tenant e resolução por host
- Gestão de domínios próprios e SSL
- Catálogo, categorias e mídia
- Vitrine pública da loja
- Carrinho e experiência de compra
- Checkout, pagamento e webhooks
- Pedidos, frete e pós-compra
- Painel do lojista
- Admin global
- Notificações, auditoria e observabilidade
- Qualidade, segurança e documentação

## 4. Tasks Técnicas por Épico

Legenda de prioridade:

- `P0`: bloqueante para o MVP ou caminho crítico de venda/operação
- `P1`: importante para entregar o MVP com segurança e usabilidade
- `P2`: complementar, mas ainda dentro do MVP

## Epic 1: Fundação do monorepo e arquitetura base

### Task 1.1 (P0): Inicializar monorepo com apps e pacotes compartilhados
- [x] Configurar monorepo com `pnpm workspaces` ou `Turborepo`, incluindo apps de `web-storefront`, `web-dashboard`, `api` e pacotes compartilhados de tipos/config.
- [x] Critérios de aceite: repositório instala dependências com um único comando e executa apps principais localmente.
- [x] Notas técnicas: padronizar TypeScript, ESLint, Prettier, aliases de import e variáveis de ambiente por app.
- [x] Dependências: nenhuma.

### Task 1.2 (P0): Definir convenções de módulos do backend monolítico
- [x] Estruturar módulos NestJS por domínio: auth, stores, domains, catalog, cart, checkout, payments, orders, admin, notifications, audit.
- [x] Critérios de aceite: cada módulo possui controller/service/repository e boundaries claras.
- [x] Notas técnicas: evitar acoplamento circular; centralizar contratos compartilhados em pacote comum.
- [x] Dependências: inicialização do monorepo.

### Task 1.3 (P0): Configurar ambiente local com PostgreSQL, Redis e storage mock
- [x] Criar `docker-compose` ou stack equivalente para PostgreSQL, Redis e serviço compatível com S3 local.
- [x] Critérios de aceite: ambiente sobe localmente e API conecta com sucesso aos serviços.
- [x] Notas técnicas: usar MinIO para desenvolvimento local e variáveis de ambiente documentadas.
- [x] Dependências: inicialização do monorepo.

### Task 1.4 (P0): Configurar Prisma com baseline do banco
- [x] Criar schema Prisma inicial, client compartilhado e pipeline de migrations.
- [x] Critérios de aceite: migration inicial aplicada com sucesso em ambiente local.
- [x] Notas técnicas: usar naming consistente, índices por `storeId`, timestamps, soft delete quando fizer sentido.
- [x] Dependências: ambiente local com PostgreSQL.

### Task 1.5 (P1): Criar seeds mínimas para papéis e admin inicial
- [x] Implementar seed para permissões base, usuário admin global e dados de apoio mínimos.
- [x] Critérios de aceite: comando de seed cria dados previsíveis para desenvolvimento e QA.
- [x] Notas técnicas: não hardcodear senhas inseguras sem documentação explícita do ambiente.
- [x] Dependências: Prisma configurado.

### Task 1.6 (P0): Implementar configuração centralizada e validação de ambiente
- [x] Criar camada de configuração tipada para API e frontends com validação de env vars.
- [x] Critérios de aceite: app falha com mensagem clara quando faltar variável obrigatória.
- [x] Notas técnicas: separar envs de pagamento, storage, e-mail e domínio.
- [x] Dependências: apps criados.

### Task 1.7 (P1): Configurar pipeline inicial de CI
- [x] Criar pipeline para lint, typecheck, testes unitários básicos e validação de migrations.
- [x] Critérios de aceite: pull requests executam pipeline automatizado com status claro.
- [x] Notas técnicas: preparar cache de dependências e execução paralela por app.
- [x] Dependências: monorepo e scripts base.

## Epic 2: Identidade, autenticação e autorização

### Task 2.1 (P0): Modelar entidades de usuário, membership e roles
- [x] Criar entidades `User`, `StoreMember` e enumerações de papéis: `PLATFORM_ADMIN`, `STORE_OWNER`, `STORE_MANAGER`, `STORE_SUPPORT`, `CUSTOMER`.
- [x] Critérios de aceite: migrations criadas com constraints e relações consistentes.
- [x] Notas técnicas: membership por loja com role explícita; permitir um usuário em várias lojas.
- [x] Dependências: Prisma baseline.

### Task 2.2 (P0): Implementar autenticação por e-mail e senha
- [x] Criar endpoints de cadastro, login, logout e refresh ou sessão equivalente.
- [x] Critérios de aceite: usuário consegue autenticar e acessar rotas protegidas.
- [x] Notas técnicas: usar hash seguro de senha, política mínima de senha e cookies/httpOnly ou JWT com rotação.
- [x] Dependências: entidades de usuário.

### Task 2.3 (P1): Implementar confirmação de e-mail e recuperação de senha
- [x] Criar fluxo de token para verificação de conta e reset de senha.
- [x] Critérios de aceite: usuário recebe link, confirma conta e redefine senha com token válido.
- [x] Notas técnicas: persistir expiração, limitar reuso e registrar auditoria do fluxo.
- [x] Dependências: autenticação base e notificações por e-mail.

### Task 2.4 (P0): Implementar guards e autorização por papel e escopo de loja
- [x] Criar middleware/guard para validar autenticação, role global e acesso por `storeId`.
- [x] Critérios de aceite: usuários sem permissão recebem erro consistente e auditável.
- [x] Notas técnicas: separar autorização global de autorização contextual da loja.
- [x] Dependências: membership e autenticação.

### Task 2.5 (P1): Construir telas base de autenticação no dashboard
- [x] Implementar páginas de login, cadastro, esqueci senha e redefinição de senha.
- [x] Critérios de aceite: fluxos funcionam com validação de formulário e mensagens de erro.
- [x] Notas técnicas: usar Tailwind + shadcn/ui com componentes compartilhados de formulário.
- [x] Dependências: endpoints de autenticação.

### Task 2.6 (P1): Implementar testes básicos de autenticação e autorização
- [x] Criar testes unitários e de integração para login, hash, guards e controle de acesso.
- [x] Critérios de aceite: cenários de sucesso e falha cobertos para usuários e papéis principais.
- [x] Notas técnicas: incluir testes para acesso indevido entre lojas.
- [x] Dependências: autenticação e guards.

## Epic 3: Onboarding do lojista e gestão de lojas

### Task 3.1 (P0): Modelar entidade Store e configurações iniciais
- [x] Criar entidade `Store` com nome, slug interno, status, subdomínio padrão, owner e configurações essenciais.
- [x] Critérios de aceite: migration inclui unicidade de slug/subdomínio e relação com owner.
- [x] Notas técnicas: reservar slugs proibidos e normalizar entrada.
- [x] Dependências: usuário e membership.

### Task 3.2 (P0): Implementar fluxo de criação de conta de lojista com loja inicial
- [x] Criar fluxo em que um usuário cadastra conta e já cria sua primeira loja.
- [x] Critérios de aceite: ao concluir onboarding, usuário vira `STORE_OWNER` da loja criada.
- [x] Notas técnicas: transação única para user + store + membership + subdomínio padrão.
- [x] Dependências: autenticação e entidade Store.

### Task 3.3 (P0): Gerar subdomínio padrão automaticamente
- [x] Implementar geração de subdomínio padrão no formato `slug.marketplace.com`.
- [x] Critérios de aceite: toda nova loja nasce com subdomínio único e acessível.
- [x] Notas técnicas: tratar colisões com estratégia previsível e registrar host canônico.
- [x] Dependências: criação de loja.

### Task 3.4 (P1): Criar telas de onboarding e configuração inicial da loja
- [x] Implementar UX para nome da loja, slug desejado e dados iniciais de operação.
- [x] Critérios de aceite: fluxo orienta o lojista até a criação da loja com feedback claro.
- [x] Notas técnicas: validar disponibilidade de nome interno/subdomínio em tempo real.
- [x] Dependências: fluxo backend de criação de loja.

### Task 3.5 (P1): Implementar gestão básica de membros da loja
- [ ] Criar CRUD simples para convidar, listar, alterar papel e remover membros da loja.
- [ ] Critérios de aceite: owner consegue administrar membros respeitando hierarquia mínima.
- [ ] Notas técnicas: convite pode ser simples por e-mail com status pendente no MVP.
- [ ] Dependências: roles e StoreMember.

### Task 3.6 (P2): Implementar testes e seeds de onboarding
- [ ] Criar seeds e cenários de teste para owner, manager e support com loja vinculada.
- [ ] Critérios de aceite: ambiente de dev permite validar onboarding rapidamente.
- [ ] Notas técnicas: incluir exemplos de lojas com subdomínio padrão.
- [ ] Dependências: fluxo de criação de loja.

## Epic 4: Multi-tenant e resolução por host

### Task 4.1 (P0): Modelar estratégia de tenant resolution por host
- [x] Definir camada responsável por resolver `storeId` a partir do `Host` da request.
- [x] Critérios de aceite: requests públicas identificam a loja por subdomínio ou domínio próprio ativo.
- [x] Notas técnicas: considerar fallback seguro e distinção entre domínio do dashboard e da vitrine.
- [x] Dependências: Store e StoreDomain.

### Task 4.2 (P0): Implementar middleware de resolução pública da loja
- [x] Criar middleware/interceptor na API para anexar contexto da loja às requests públicas.
- [x] Critérios de aceite: catálogo, carrinho e checkout operam apenas com a loja resolvida pelo host.
- [x] Notas técnicas: bloquear acesso quando domínio estiver inválido, removido ou sem correspondência.
- [x] Dependências: estratégia de tenant resolution.

### Task 4.3 (P0): Implementar isolamento de dados por `storeId`
- [x] Garantir que consultas multi-tenant sempre filtrem por `storeId` quando aplicável.
- [x] Critérios de aceite: não existe leitura ou escrita cruzada entre lojas nos módulos de domínio.
- [x] Notas técnicas: encapsular filtros em repositories/services para reduzir risco de fuga de dados.
- [x] Dependências: módulos de catálogo, carrinho, pedidos e afins.

### Task 4.4 (P0): Criar testes de resolução por host e isolamento de tenant
- [x] Cobrir cenários com subdomínio padrão, domínio custom ativo, host inválido e acesso cruzado.
- [x] Critérios de aceite: testes impedem regressões de segurança multi-tenant.
- [x] Notas técnicas: priorizar integração e testes end-to-end dos fluxos públicos.
- [x] Dependências: middleware e isolamento por `storeId`.

## Epic 5: Gestão de domínios próprios e SSL

### Task 5.1 (P0): Modelar entidade StoreDomain e status de domínio
- [x] Criar entidade `StoreDomain` com campos de host, tipo, status, timestamps, dados de verificação DNS e SSL.
- [x] Critérios de aceite: status suportados incluem `PENDING`, `AWAITING_DNS`, `VERIFYING`, `SSL_PENDING`, `ACTIVE`, `ERROR`, `REMOVED`.
- [x] Notas técnicas: garantir unicidade global do domínio e limitação de 1 domínio próprio por loja no MVP.
- [x] Dependências: Store.

### Task 5.2 (P0): Implementar cadastro de domínio próprio pelo lojista
- [x] Criar endpoint e tela para cadastro de domínio próprio com suporte oficial a host `www`.
- [x] Critérios de aceite: sistema recusa domínio já em uso, inválido ou fora do formato aceito.
- [x] Notas técnicas: normalizar domínio, bloquear apex sem `www` no fluxo oficial do MVP.
- [x] Dependências: StoreDomain model.

### Task 5.3 (P1): Exibir instruções DNS para ativação do domínio
- [ ] Gerar instruções claras de CNAME para o lojista configurar seu domínio.
- [ ] Critérios de aceite: dashboard mostra valor esperado de destino e status atual do apontamento.
- [ ] Notas técnicas: incluir cópia fácil e mensagens para erros comuns de DNS.
- [ ] Dependências: cadastro de domínio próprio.

### Task 5.4 (P0): Implementar rotina de verificação de DNS
- [x] Criar job assíncrono que verifica se o CNAME está apontando corretamente.
- [x] Critérios de aceite: domínio transita entre `AWAITING_DNS`, `VERIFYING` e próximos estados com base na verificação.
- [x] Notas técnicas: usar BullMQ para retries, backoff e registro detalhado de erros.
- [x] Dependências: Redis/BullMQ e StoreDomain.

### Task 5.5 (P0): Integrar provisionamento de domínio custom e SSL
- [x] Integrar com Cloudflare for SaaS ou alternativa compatível para ativação do domínio e emissão de certificado.
- [x] Critérios de aceite: quando DNS estiver correto, sistema acompanha progresso até SSL ativo.
- [x] Notas técnicas: abstrair provider para permitir troca futura; persistir IDs externos e payloads relevantes.
- [x] Dependências: verificação de DNS e escolha de provider.

### Task 5.6 (P0): Implementar monitoramento de status SSL e tratamento de erro
- [x] Criar job para consultar status do certificado e atualizar domínio para `SSL_PENDING`, `ACTIVE` ou `ERROR`.
- [x] Critérios de aceite: dashboard reflete status real e mantém subdomínio padrão disponível enquanto o custom não ativa.
- [x] Notas técnicas: nunca interromper acesso pelo subdomínio padrão por falha no domínio custom.
- [x] Dependências: integração com provider de domínio/SSL.

### Task 5.7 (P1): Implementar remoção e substituição segura do domínio próprio
- [ ] Permitir remover domínio custom ou substituí-lo respeitando a regra de apenas 1 ativo por loja.
- [ ] Critérios de aceite: remoção marca status como `REMOVED` e impede conflito futuro.
- [ ] Notas técnicas: auditar quem removeu e limpar sincronização externa quando aplicável.
- [ ] Dependências: StoreDomain ativo.

### Task 5.8 (P1): Criar telas do painel para acompanhamento de ativação do domínio
- [ ] Implementar páginas/estados de UI com timeline simples de ativação, DNS e SSL.
- [ ] Critérios de aceite: lojista entende claramente o que falta para ativar o domínio.
- [ ] Notas técnicas: usar polling simples no MVP ou refresh manual orientado.
- [ ] Dependências: APIs de domínio e jobs de status.

### Task 5.9 (P1): Criar testes de integração do ciclo de domínio próprio
- [ ] Cobrir cadastro, conflito, DNS incorreto, ativação bem-sucedida e fallback para subdomínio.
- [ ] Critérios de aceite: fluxo principal de domínio próprio está protegido contra regressão.
- [ ] Notas técnicas: mockar provider externo e validar máquina de estados.
- [ ] Dependências: implementação dos fluxos de domínio.

## Epic 6: Catálogo, categorias e mídia

### Task 6.1 (P0): Modelar entidades de catálogo
- [x] Criar entidades `Category`, `Product`, `ProductImage` e opcionalmente `ProductVariant` se necessário para o MVP.
- [x] Critérios de aceite: modelo suporta nome, slug, descrição, preço, preço promocional, SKU, estoque, fotos, categoria, status e `storeId`.
- [x] Notas técnicas: usar índices por `storeId`, `slug`, `status` e constraints para integridade.
- [x] Dependências: Prisma baseline e Store.

### Task 6.2 (P0): Implementar CRUD backend de categorias
- [x] Criar endpoints para criar, listar, editar, ordenar e desativar categorias da loja.
- [x] Critérios de aceite: loja gerencia apenas suas próprias categorias.
- [x] Notas técnicas: considerar slug único por loja.
- [x] Dependências: entidades de catálogo e autorização por loja.

### Task 6.3 (P0): Implementar CRUD backend de produtos
- [x] Criar endpoints para criar, editar, publicar, desativar e arquivar produtos.
- [x] Critérios de aceite: produto suporta estados `DRAFT`, `ACTIVE`, `INACTIVE`, `OUT_OF_STOCK`, `ARCHIVED`.
- [x] Notas técnicas: validar preço promocional, estoque e relação com categoria.
- [x] Dependências: entidades de catálogo.

### Task 6.4 (P1): Implementar upload de imagens para produtos
- [ ] Criar fluxo de upload para S3/R2 com associação a `ProductImage`.
- [ ] Critérios de aceite: lojista consegue enviar, listar e remover imagens do produto.
- [ ] Notas técnicas: validar tipo/tamanho, gerar chave segura e URL pública/assinada conforme estratégia.
- [ ] Dependências: storage configurado e ProductImage.

### Task 6.5 (P1): Implementar ordenação e imagem principal do produto
- [ ] Permitir definir imagem capa e ordem de exibição.
- [ ] Critérios de aceite: vitrine exibe imagem principal corretamente.
- [ ] Notas técnicas: usar campo de ordenação persistido e restrição de uma capa por produto.
- [ ] Dependências: upload de imagens.

### Task 6.6 (P1): Construir telas de catálogo no painel do lojista
- [ ] Implementar listagem, formulário e ações rápidas para produtos e categorias.
- [ ] Critérios de aceite: lojista consegue operar catálogo sem usar API manualmente.
- [ ] Notas técnicas: incluir filtros por status, estoque e categoria.
- [ ] Dependências: CRUD backend de catálogo.

### Task 6.7 (P1): Implementar testes de catálogo, estoque e mídia
- [ ] Criar testes para regras de status, estoque, categoria e uploads.
- [ ] Critérios de aceite: cenários críticos do catálogo ficam cobertos.
- [ ] Notas técnicas: incluir casos de acesso indevido entre lojas e arquivos inválidos.
- [ ] Dependências: catálogo e upload.

## Epic 7: Vitrine pública da loja

### Task 7.1 (P0): Definir shell da storefront pública por tenant
- [x] Criar estrutura de páginas públicas orientada por host da loja resolvida.
- [x] Critérios de aceite: a mesma app pública renderiza lojas diferentes conforme domínio/subdomínio.
- [x] Notas técnicas: centralizar busca do contexto da loja no carregamento da requisição.
- [x] Dependências: resolução por host.

### Task 7.2 (P1): Implementar tema básico e personalização visual mínima
- [ ] Criar entidade/configuração `StoreTheme` com cores, logo, banner e textos básicos.
- [ ] Critérios de aceite: lojista consegue aplicar personalização simples na vitrine.
- [ ] Notas técnicas: limitar escopo do MVP a poucos tokens visuais configuráveis.
- [ ] Dependências: Store e upload de mídia.

### Task 7.3 (P0): Construir homepage pública da loja
- [x] Implementar página inicial com identidade da loja, destaques e listagem básica de produtos/categorias.
- [x] Critérios de aceite: homepage responde ao tenant correto e exibe produtos publicados.
- [x] Notas técnicas: tratar loja sem produtos com estado vazio amigável.
- [x] Dependências: StoreTheme e catálogo.

### Task 7.4 (P0): Construir listagem de produtos e filtros básicos
- [x] Implementar página de catálogo com paginação e filtros simples por categoria.
- [x] Critérios de aceite: apenas produtos `ACTIVE` e disponíveis aparecem publicamente.
- [x] Notas técnicas: usar query params simples e SEO básico do Next.js.
- [x] Dependências: homepage pública e catálogo.

### Task 7.5 (P0): Construir página de detalhe do produto
- [x] Implementar página com fotos, descrição, preço, estoque e ação de adicionar ao carrinho.
- [x] Critérios de aceite: produto indisponível exibe estado correto e não permite compra indevida.
- [x] Notas técnicas: garantir slug por loja e fallback para imagem ausente.
- [x] Dependências: catálogo e imagens.

### Task 7.6 (P1): Implementar testes básicos da vitrine pública
- [ ] Criar testes de renderização por tenant, visibilidade de produtos e regras de status.
- [ ] Critérios de aceite: mudança de host altera corretamente a loja exibida.
- [ ] Notas técnicas: incluir ao menos fluxo smoke público end-to-end.
- [ ] Dependências: storefront pública.

## Epic 8: Carrinho e experiência de compra

### Task 8.1 (P0): Modelar entidades Cart e CartItem
- [x] Criar entidades para carrinho simples por loja com vínculo a sessão ou cliente identificado.
- [x] Critérios de aceite: carrinho pertence a uma única loja e contém itens com snapshot mínimo de preço.
- [x] Notas técnicas: não permitir mistura de produtos de lojas distintas no mesmo carrinho.
- [x] Dependências: catálogo e tenant resolution.

### Task 8.2 (P0): Implementar API de carrinho
- [x] Criar endpoints para criar carrinho, adicionar item, atualizar quantidade, remover item e limpar carrinho.
- [x] Critérios de aceite: API valida estoque, status do produto e loja do host.
- [x] Notas técnicas: persistir preço unitário no item para evitar inconsistência de sessão.
- [x] Dependências: Cart/CartItem.

### Task 8.3 (P1): Implementar persistência de carrinho no frontend
- [x] Construir camada no storefront para manter carrinho por loja durante navegação.
- [x] Critérios de aceite: usuário mantém o carrinho ao navegar na mesma loja.
- [x] Notas técnicas: pode usar cookie/session/local storage em conjunto com carrinho server-side.
- [x] Dependências: API de carrinho.

### Task 8.4 (P1): Construir UI de carrinho simples
- [x] Implementar drawer ou página de carrinho com resumo, edição de quantidades e subtotal.
- [x] Critérios de aceite: cliente consegue revisar itens antes do checkout.
- [x] Notas técnicas: destacar que o carrinho é exclusivo da loja atual.
- [x] Dependências: persistência de carrinho.

### Task 8.5 (P1): Implementar testes de regras do carrinho
- [ ] Cobrir mistura de lojas, estoque insuficiente, produto inativo e atualização concorrente simples.
- [ ] Critérios de aceite: carrinho respeita isolamento e integridade básica.
- [ ] Notas técnicas: incluir mensagens de erro consistentes para frontend.
- [ ] Dependências: API de carrinho.

## Epic 9: Checkout, pagamento e webhooks

### Task 9.1 (P0): Modelar entidades de checkout e pagamento
- [x] Criar entidades `Customer`, `Payment` e `PaymentTransaction` com dados mínimos para iniciar e rastrear pagamentos.
- [x] Critérios de aceite: modelo suporta status inicial, payload externo, tentativas e auditoria básica.
- [x] Notas técnicas: preparar abstração para gateway e futura evolução de split/comissão.
- [x] Dependências: Cart e Order.

### Task 9.2 (P0): Modelar entidade Order e OrderItem
- [x] Criar entidades `Order` e `OrderItem` com snapshot de itens, preços, cliente, endereço e `storeId`.
- [x] Critérios de aceite: status mínimos suportados incluem `CREATED`, `WAITING_PAYMENT`, `PAYMENT_APPROVED`, `PAYMENT_FAILED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELED`, `REFUNDED`.
- [x] Notas técnicas: separar claramente domínio de pedido do domínio de pagamento.
- [x] Dependências: catálogo, carrinho e Customer.

### Task 9.3 (P0): Implementar criação de pedido a partir do carrinho
- [x] Transformar carrinho válido em pedido com status inicial e lock básico de preço/itens.
- [x] Critérios de aceite: pedido é criado com itens, totais e referência da loja corretamente.
- [x] Notas técnicas: validar estoque no momento da criação e reservar/baixar conforme política simples do MVP.
- [x] Dependências: Order/OrderItem e API de carrinho.

### Task 9.4 (P0): Integrar gateway de pagamento via adapter
- [x] Criar adapter para gateway escolhido entre Stripe, Mercado Pago, Pagar.me ou Asaas.
- [x] Critérios de aceite: checkout cria intenção/transação de pagamento e devolve dados necessários ao frontend.
- [x] Notas técnicas: isolar provider em interface única para troca futura.
- [x] Dependências: modelagem de pagamento e decisão do gateway.

### Task 9.5 (P0): Construir UI de checkout
- [x] Implementar formulário de cliente, endereço, frete e pagamento no storefront.
- [x] Critérios de aceite: cliente consegue concluir pedido e iniciar pagamento sem sair do contexto da loja.
- [x] Notas técnicas: validar campos no client e server, com feedback claro de erro.
- [x] Dependências: criação de pedido e integração de pagamento.

### Task 9.6 (P0): Implementar endpoint de webhooks de pagamento
- [x] Criar endpoint seguro para receber eventos do gateway.
- [x] Critérios de aceite: webhook valida assinatura/origem e persiste evento recebido.
- [x] Notas técnicas: processar webhook de forma idempotente e desacoplada do request síncrono.
- [x] Dependências: integração com gateway.

### Task 9.7 (P0): Implementar processamento assíncrono de webhooks
- [x] Enfileirar eventos recebidos e atualizar `Payment`, `PaymentTransaction` e `Order`.
- [x] Critérios de aceite: sistema trata aprovado, recusado, expirado e reembolsado.
- [x] Notas técnicas: registrar payload bruto, chave idempotente, retries e dead-letter simples se necessário.
- [x] Dependências: endpoint de webhook e BullMQ.

### Task 9.8 (P0): Implementar máquina de estados de pagamento e pedido
- [x] Formalizar transições válidas entre estados de pagamento e pedido.
- [x] Critérios de aceite: transições inválidas são bloqueadas e auditadas.
- [x] Notas técnicas: separar status de pagamento do status operacional do pedido.
- [x] Dependências: Order e Payment.

### Task 9.9 (P1): Implementar testes de checkout e webhooks
- [x] Criar testes para pedido criado, pagamento aprovado, recusado, expirado e reembolsado.
- [x] Critérios de aceite: reconciliação entre pedido e pagamento funciona de forma reproduzível.
- [x] Notas técnicas: mockar gateway e validar idempotência de webhook.
- [x] Dependências: checkout e processamento de webhooks.

## Epic 10: Pedidos, frete e pós-compra

### Task 10.1 (P0): Modelar frete simples e envio
- [x] Criar entidades `ShippingMethod` e `Shipment` com abordagem simples para o MVP.
- [x] Critérios de aceite: loja consegue configurar ao menos opções básicas de frete e prazo estimado.
- [x] Notas técnicas: frete pode ser fixo ou por faixa simples para não travar o MVP.
- [x] Dependências: Store e Order.

### Task 10.2 (P0): Implementar cálculo simples de frete no checkout
- [x] Calcular frete com regra simples por loja antes de criar o pedido final.
- [x] Critérios de aceite: checkout apresenta opções válidas e total final atualizado.
- [x] Notas técnicas: documentar limitações do cálculo no MVP.
- [x] Dependências: ShippingMethod e checkout.

### Task 10.3 (P1): Implementar consulta e acompanhamento de pedido pelo cliente
- [x] Criar página/endpoint para cliente acompanhar status do pedido.
- [x] Critérios de aceite: cliente visualiza status e resumo do pedido após compra.
- [x] Notas técnicas: acesso pode ocorrer por link seguro/token ou autenticação simples, conforme recorte do MVP.
- [x] Dependências: Order e storefront.

### Task 10.4 (P0): Implementar gestão operacional de pedidos no painel
- [x] Permitir listar pedidos e atualizar status operacionais como `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELED`.
- [x] Critérios de aceite: lojista consegue operar pedidos respeitando transições válidas.
- [x] Notas técnicas: registrar motivo opcional em cancelamentos e eventos relevantes.
- [x] Dependências: Order e guards de loja.

### Task 10.5 (P1): Implementar baixa/ajuste de estoque ligado ao pedido
- [ ] Definir regra simples para impacto do pedido no estoque.
- [ ] Critérios de aceite: estoque permanece consistente após criação, cancelamento ou reembolso conforme política definida.
- [ ] Notas técnicas: política pode ser reservar na criação ou debitar na aprovação, desde que documentada.
- [ ] Dependências: pedidos e catálogo.

### Task 10.6 (P1): Implementar testes de pedidos e frete
- [ ] Cobrir criação, atualização de status, cancelamento, consulta do cliente e consistência de estoque.
- [ ] Critérios de aceite: fluxo principal de pós-compra permanece íntegro.
- [ ] Notas técnicas: validar regras de permissão entre cliente, loja e admin.
- [ ] Dependências: pedidos, frete e painel.

## Epic 11: Painel do lojista

### Task 11.1 (P0): Definir shell do dashboard multi-store
- [x] Criar estrutura base do painel com seleção de loja, navegação lateral e proteção de rotas.
- [x] Critérios de aceite: usuário autenticado acessa apenas lojas das quais é membro.
- [x] Notas técnicas: isolar contexto de loja do painel do contexto público por host.
- [x] Dependências: autenticação e StoreMember.

### Task 11.2 (P1): Implementar dashboard inicial da loja
- [ ] Construir visão geral com métricas simples: pedidos, faturamento básico, produtos e status de domínio.
- [ ] Critérios de aceite: owner/manager visualizam resumo operacional inicial.
- [ ] Notas técnicas: usar queries simples; não buscar BI avançado no MVP.
- [ ] Dependências: pedidos, catálogo e domínios.

### Task 11.3 (P1): Implementar páginas de configurações da loja
- [ ] Criar telas para editar dados da loja, tema básico, domínio, frete e notificações essenciais.
- [ ] Critérios de aceite: lojista consegue concluir toda configuração crítica pelo painel.
- [ ] Notas técnicas: agrupar por seções para reduzir complexidade.
- [ ] Dependências: módulos correspondentes.

### Task 11.4 (P1): Implementar tratamento consistente de loading, erro e vazio no painel
- [ ] Criar componentes e padrões de UX para estados assíncronos.
- [ ] Critérios de aceite: operações principais têm feedback visual claro em sucesso e falha.
- [ ] Notas técnicas: padronizar toasts, mensagens inline e códigos de erro amigáveis.
- [ ] Dependências: shell do dashboard.

### Task 11.5 (P1): Implementar testes de navegação crítica do painel
- [ ] Cobrir login, troca de loja, catálogo, pedidos e domínio custom como smoke tests.
- [ ] Critérios de aceite: principais rotas do painel têm validação automatizada mínima.
- [ ] Notas técnicas: priorizar E2E dos fluxos mais arriscados.
- [ ] Dependências: dashboard funcional.

## Epic 12: Admin global

### Task 12.1 (P1): Modelar visão administrativa da plataforma
- [ ] Definir endpoints e consultas para gestão global de lojas, usuários, pedidos e domínios.
- [ ] Critérios de aceite: `PLATFORM_ADMIN` possui visão agregada e ações básicas controladas.
- [ ] Notas técnicas: manter segregação clara entre operações globais e operações da loja.
- [ ] Dependências: autenticação e domínios principais.

### Task 12.2 (P1): Implementar listagem e detalhe de lojas no admin
- [ ] Criar CRUD operacional básico para visualizar lojas, status, owner e domínio.
- [ ] Critérios de aceite: admin consegue localizar uma loja e entender seu estado operacional.
- [ ] Notas técnicas: incluir filtros por status, data de criação e domínio ativo.
- [ ] Dependências: Store e StoreDomain.

### Task 12.3 (P1): Implementar listagem e detalhe de usuários no admin
- [ ] Criar telas/endpoints para visualizar usuários e memberships.
- [ ] Critérios de aceite: admin identifica vínculos entre usuários e lojas.
- [ ] Notas técnicas: evitar expor dados sensíveis desnecessários.
- [ ] Dependências: User e StoreMember.

### Task 12.4 (P1): Implementar visão administrativa de pedidos e pagamentos
- [ ] Criar consultas globais para pedidos e pagamentos com filtros básicos.
- [ ] Critérios de aceite: admin consegue investigar falhas operacionais sem editar dados indevidamente.
- [ ] Notas técnicas: priorizar leitura e poucas ações seguras no MVP.
- [ ] Dependências: Orders e Payments.

### Task 12.5 (P1): Implementar páginas do painel admin global
- [ ] Construir área separada para admin com rotas e navegação próprias.
- [ ] Critérios de aceite: usuários sem role global não acessam a área administrativa.
- [ ] Notas técnicas: reusar componentes do dashboard onde fizer sentido.
- [ ] Dependências: endpoints do admin.

### Task 12.6 (P1): Implementar testes de permissão do admin global
- [ ] Cobrir acesso permitido para admin e bloqueio para roles de loja.
- [ ] Critérios de aceite: fronteira entre admin global e painel do lojista fica protegida.
- [ ] Notas técnicas: incluir testes de UI e API.
- [ ] Dependências: área admin global.

## Epic 13: Notificações, auditoria e observabilidade

### Task 13.1 (P1): Modelar AuditLog e Notification
- [ ] Criar entidades `AuditLog` e `Notification` com contexto de usuário, loja, ação, canal e payload resumido.
- [ ] Critérios de aceite: ações sensíveis e notificações principais podem ser persistidas.
- [ ] Notas técnicas: evitar gravar dados sensíveis completos em logs.
- [ ] Dependências: Prisma e módulos de domínio.

### Task 13.2 (P1): Implementar trilha de auditoria para ações críticas
- [ ] Registrar eventos como login, criação de loja, alteração de domínio, mudança de papel, criação de produto e mudança de status de pedido.
- [ ] Critérios de aceite: admin e backend conseguem rastrear ações críticas com autor e timestamp.
- [ ] Notas técnicas: padronizar estrutura de evento auditável.
- [ ] Dependências: AuditLog model.

### Task 13.3 (P1): Implementar notificações básicas por e-mail
- [ ] Criar serviço de e-mail para eventos essenciais: confirmação de conta, reset de senha, pedido criado, pagamento aprovado, domínio ativado.
- [ ] Critérios de aceite: e-mails mínimos são disparados e podem ser reprocessados em falha.
- [ ] Notas técnicas: usar provider abstraído e templates simples versionados no código.
- [ ] Dependências: autenticação, pedidos e domínios.

### Task 13.4 (P0): Implementar fila de jobs para notificações e rotinas assíncronas
- [x] Configurar BullMQ para envio de e-mail, verificação de domínio e processamento de webhook.
- [x] Critérios de aceite: jobs executam com retries, logging e monitoramento básico.
- [x] Notas técnicas: definir nomes de fila, políticas de retry e timeout por job.
- [x] Dependências: Redis e módulos assíncronos.

### Task 13.5 (P1): Implementar logging estruturado da aplicação
- [ ] Padronizar logs com contexto de request, usuário, loja e módulo.
- [ ] Critérios de aceite: erros e eventos operacionais críticos podem ser rastreados.
- [ ] Notas técnicas: incluir correlation ID e mascarar dados sensíveis.
- [ ] Dependências: configuração central da API.

### Task 13.6 (P1): Implementar tratamento global de erros
- [ ] Criar filtros/interceptors para normalizar erros de API e falhas internas.
- [ ] Critérios de aceite: frontend recebe respostas consistentes; backend registra detalhes técnicos.
- [ ] Notas técnicas: mapear erros de domínio, validação e integração externa.
- [ ] Dependências: API estruturada.

### Task 13.7 (P2): Configurar healthchecks e monitoramento básico
- [ ] Expor healthchecks de API, banco, Redis e filas.
- [ ] Critérios de aceite: ambiente permite validar rapidamente saúde operacional do sistema.
- [ ] Notas técnicas: usar rota protegida ou segmentada para monitoramento.
- [ ] Dependências: infraestrutura base.

## Epic 14: Qualidade, segurança e documentação

### Task 14.1 (P0): Implementar validação de entrada e sanitização
- [x] Aplicar validações server-side em payloads críticos e sanitização básica de campos textuais.
- [x] Critérios de aceite: entradas inválidas são rejeitadas com mensagens previsíveis.
- [x] Notas técnicas: revisar especialmente auth, produtos, domínios, checkout e webhooks.
- [x] Dependências: endpoints principais.

### Task 14.2 (P0): Revisar controles mínimos de segurança do MVP
- [x] Implementar rate limit em autenticação e webhooks, headers básicos, proteção CSRF conforme estratégia e políticas de sessão.
- [x] Critérios de aceite: superfície mais sensível do MVP possui proteção mínima documentada.
- [x] Notas técnicas: revisar upload de arquivos, enumeração de usuário e vazamento cross-tenant.
- [x] Dependências: autenticação e API pública.

### Task 14.3 (P0): Criar testes end-to-end dos fluxos principais
- [x] Automatizar fluxos de onboarding, cadastro de produto, compra, pagamento e atualização de pedido.
- [x] Critérios de aceite: suíte smoke cobre o core do MVP de ponta a ponta.
- [x] Notas técnicas: usar ambiente determinístico com mocks quando necessário.
- [x] Dependências: módulos core concluídos.

### Task 14.4 (P1): Criar documentação mínima de arquitetura e operação
- [x] Documentar setup local, env vars, módulos, fluxo multi-tenant, domínio custom e pagamentos.
- [x] Critérios de aceite: novo desenvolvedor consegue subir o projeto e entender os fluxos principais.
- [x] Notas técnicas: incluir decisões técnicas do MVP e limitações conhecidas.
- [x] Dependências: arquitetura base e decisões de infra.

### Task 14.5 (P1): Criar runbooks mínimos para incidentes operacionais
- [x] Documentar como investigar falha de webhook, falha de domínio/SSL, falha de e-mail e falha de fila.
- [x] Critérios de aceite: time consegue executar troubleshooting básico sem depender de conhecimento implícito.
- [x] Notas técnicas: manter procedimentos curtos e acionáveis.
- [x] Dependências: observabilidade e integrações.

### Task 14.6 (P1): Preparar checklist de deploy inicial
- [x] Documentar migrations, seeds, variáveis obrigatórias, providers externos e validações pós-deploy.
- [x] Critérios de aceite: existe procedimento claro para subir primeiro ambiente do MVP.
- [x] Notas técnicas: incluir ordem segura de ativação de gateways, storage, DNS e webhook URLs.
- [x] Dependências: documentação mínima.

## 5. Regras de Negócio Importantes

- Toda loja deve nascer com um subdomínio padrão único.
- Cada loja pode ter apenas 1 domínio próprio no MVP.
- O fluxo oficial de domínio próprio no MVP deve priorizar host com `www`.
- O domínio próprio nunca deve derrubar o acesso via subdomínio padrão enquanto não estiver `ACTIVE`.
- Toda request pública deve resolver a loja pelo `Host`.
- O dashboard do lojista não depende do domínio público da loja para operar.
- O sistema deve impedir uso do mesmo domínio em mais de uma loja.
- O sistema deve impedir que um carrinho contenha produtos de múltiplas lojas.
- O sistema deve garantir isolamento de dados por `storeId`.
- Apenas produtos publicados e válidos podem aparecer na vitrine pública.
- O pedido deve ser criado com status inicial antes da confirmação assíncrona do pagamento.
- O status do pedido deve refletir os eventos de pagamento processados por webhook.
- Webhooks de pagamento devem ser idempotentes.
- O MVP não deve depender de split complexo para operar.
- A arquitetura de pagamento deve permitir evolução futura para split/comissão.
- Mudanças críticas devem gerar logs e auditoria básica.

## 6. Fluxos Principais

### Fluxo: Onboarding do lojista
- [ ] Usuário cria conta.
- [ ] Usuário confirma e-mail, se habilitado no fluxo.
- [ ] Usuário informa dados da loja.
- [ ] Sistema cria `User`, `Store`, `StoreMember` e subdomínio padrão.
- [ ] Usuário acessa o painel da loja.

### Fluxo: Ativação de domínio próprio
- [ ] Lojista informa domínio `www`.
- [ ] Sistema valida formato e unicidade.
- [ ] Sistema exibe instruções de DNS.
- [ ] Job verifica CNAME.
- [ ] Sistema inicia provisionamento do domínio/SSL.
- [ ] Status evolui até `ACTIVE` ou `ERROR`.
- [ ] Loja permanece acessível por subdomínio durante todo o processo.

### Fluxo: Cadastro e publicação de produto
- [x] Lojista cria categoria.
- [x] Lojista cria produto em `DRAFT`.
- [x] Lojista faz upload de imagens.
- [x] Lojista revisa preço, estoque e conteúdo.
- [x] Lojista publica produto como `ACTIVE`.
- [x] Produto passa a aparecer na vitrine da loja.

### Fluxo: Compra na vitrine
- [x] Cliente acessa a loja pelo domínio ou subdomínio.
- [x] Cliente navega no catálogo e abre um produto.
- [x] Cliente adiciona item ao carrinho.
- [x] Cliente revisa carrinho e segue para checkout.
- [x] Cliente informa dados e seleciona frete.
- [x] Sistema cria pedido e inicia pagamento.
- [x] Cliente recebe retorno inicial do checkout.

### Fluxo: Confirmação de pagamento
- [x] Gateway envia webhook.
- [x] Sistema valida e persiste evento.
- [x] Job processa webhook.
- [x] Pagamento é atualizado.
- [x] Pedido transita para status coerente.
- [x] Loja e cliente recebem notificação básica, quando aplicável.

### Fluxo: Operação do pedido
- [x] Lojista visualiza pedido no painel.
- [x] Lojista muda pedido para `PROCESSING`.
- [x] Lojista registra envio e muda para `SHIPPED`.
- [x] Cliente acompanha status.
- [x] Pedido pode evoluir para `DELIVERED`, `CANCELED` ou `REFUNDED`.

## 7. Sugestão de Ordem de Implementação

## Implementation Order

1. Epic 1 com foco em `1.1` a `1.6`.
2. Epic 2 com foco em `2.1`, `2.2` e `2.4`.
3. Epic 3 com foco em `3.1`, `3.2` e `3.3`.
4. Epic 4 completo antes de avançar nos fluxos públicos.
5. Epic 6 antes da storefront final.
6. Epic 7 com foco em homepage, lista e detalhe de produto.
7. Epic 8 completo para fechar jornada de compra.
8. Epic 9 com foco em `9.1` a `9.8`.
9. Epic 10 com foco em frete simples e operação de pedidos.
10. Epic 11 para fechar o painel do lojista.
11. Epic 5 para domínio próprio e SSL, paralelizando com estabilização do core.
12. Epic 12 para admin global básico.
13. Epic 13 e Epic 14 para endurecimento operacional, segurança e release.

Sequência de redução de risco:

- Resolver multi-tenancy cedo evita retrabalho em catálogo, carrinho, pedido e storefront.
- Deixar domínio próprio após o core de venda reduz bloqueio por dependências externas.
- Implementar pagamentos via adapter desde o começo do checkout evita acoplamento ao gateway escolhido.
- Fechar testes de webhook e isolamento de tenant antes do release é obrigatório.

## 8. Checklist Final de Entrega

## MVP Acceptance Checklist

- [ ] Monorepo configurado com apps de API, storefront e dashboard.
- [ ] Ambiente local sobe com PostgreSQL, Redis e storage compatível.
- [ ] Migrations e seeds executam com sucesso.
- [ ] Lojista consegue criar conta e autenticar.
- [ ] Lojista consegue criar loja com subdomínio padrão funcional.
- [ ] Requests públicas resolvem corretamente a loja pelo `Host`.
- [ ] Lojista consegue cadastrar 1 domínio próprio com instruções DNS.
- [ ] Sistema verifica DNS e acompanha status de SSL até ativação.
- [ ] Loja continua acessível pelo subdomínio padrão enquanto domínio próprio não ativa.
- [ ] Lojista consegue personalizar minimamente a loja.
- [ ] Lojista consegue cadastrar categorias, produtos e imagens.
- [ ] Vitrine pública exibe corretamente produtos ativos da loja resolvida.
- [ ] Carrinho funciona para uma única loja por vez.
- [ ] Checkout cria pedido com status inicial corretamente.
- [ ] Gateway de pagamento está integrado por adapter.
- [ ] Webhooks de pagamento são recebidos e processados com idempotência.
- [ ] Pedido é atualizado corretamente para aprovado, recusado, expirado e reembolsado.
- [ ] Lojista consegue acompanhar e operar pedidos no painel.
- [ ] Cliente consegue acompanhar o pedido por fluxo definido no MVP.
- [ ] Frete simples funciona de ponta a ponta.
- [ ] Admin global consegue visualizar lojas, usuários, domínios, pedidos e pagamentos.
- [ ] Upload de imagens funciona com validações mínimas.
- [ ] E-mails básicos são enviados para eventos essenciais.
- [ ] Logs estruturados e auditoria básica estão ativos.
- [ ] Healthchecks básicos estão disponíveis.
- [ ] Testes unitários, integração e smoke E2E cobrem os fluxos centrais.
- [ ] Documentação mínima de setup, arquitetura, pagamentos e domínios foi entregue.
- [ ] Checklist de deploy e runbooks mínimos foram documentados.
