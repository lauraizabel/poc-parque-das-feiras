# Plano de migracao do dashboard do lojista

Este documento organiza a migracao do prototipo em `projeto_design_dashboard` para o dashboard real em `apps/web-dashboard`, mantendo as integracoes ja existentes com `apps/api`.

## Objetivo

Migrar a experiencia visual e operacional criada no Lovable para o dashboard Next.js do lojista, sem perder autenticacao, selecao de loja, permissoes, chamadas reais de API, testes smoke e fluxo multi-store.

## Contexto tecnico atual

- `projeto_design_dashboard`: app Vite/TanStack Router gerado no Lovable, com Tailwind v4, componentes Radix/shadcn, lucide icons, shell lateral, topbar, mobile nav, dark/light theme e telas mockadas.
- `apps/web-dashboard`: app Next.js 15 com React 19, hoje concentrado em uma pagina principal com estado client-side, login, onboarding e consoles conectados a API.
- `apps/api`: NestJS com endpoints ja existentes para autenticacao, lojas, catalogo, pedidos, dominios, membros, tema, frete, pagamentos e integracoes.
- O ponto mais importante da migracao e separar o visual do Lovable dos dados mockados, usando os contratos reais ja implementados.

## Prioridades

- P0: necessario para liberar a migracao sem quebrar login, autorizacao ou operacao principal.
- P1: necessario para chegar no dashboard completo e conectado.
- P2: melhoria, refinamento ou item que pode vir depois do primeiro corte funcional.

## Fase 0 - Auditoria e preparacao

- [x] P0 - Inventariar componentes do Lovable que serao migrados:
  - `src/components/shell/Sidebar.tsx`
  - `src/components/shell/Topbar.tsx`
  - `src/components/shell/ContextStrip.tsx`
  - `src/components/shell/MobileNav.tsx`
  - `src/components/shell/EmptyState.tsx`
  - componentes `src/components/ui/*` somente quando forem necessarios para drawer, dialog, select, tabs, tooltip e table
- [x] P0 - Mapear telas Lovable para consoles atuais:
  - `/dashboard` -> `OverviewConsole`
  - `/dashboard/catalogo` -> `CatalogConsole`
  - `/dashboard/pedidos` -> `OrdersConsole`
  - `/dashboard/vitrine` -> `StorefrontThemeConsole`
  - `/dashboard/dominios` -> `DomainConsole`
  - `/dashboard/equipe` -> `MembersConsole`
  - `/dashboard/configuracoes` -> `SettingsConsole`, `ShippingConsole`, integracoes e modulos futuros
- [x] P0 - Confirmar dependencias que precisam entrar em `apps/web-dashboard`:
  - `lucide-react`
  - `@radix-ui/react-*` usados de fato, com prioridade para dialog, dropdown-menu, select, tabs e tooltip
  - `class-variance-authority`
  - `clsx`
  - `tailwind-merge`
  - `sonner` fica P2 ate existir fluxo de toast real
  - `recharts` fica P2; a primeira entrega usa grafico leve em CSS para evitar dependencia prematura
- [x] P0 - Decidir se o dashboard Next vai adotar Tailwind v4 ou se os estilos do Lovable serao traduzidos para CSS atual.
  - Decisao: traduzir o design system do Lovable para CSS do `apps/web-dashboard` primeiro. Migrar para Tailwind v4 so depois de estabilizar a experiencia, porque o app real ainda nao usa Tailwind.
- [x] P1 - Criar checklist visual de paridade com screenshots do Lovable por tela.
  - Checklist base: shell autenticado, resumo, catalogo, pedidos, vitrine, dominios, equipe, configuracoes e onboarding.

### Resultado da Fase 0

- O dashboard real continuara em Next App Router.
- O prototipo Lovable sera usado como referencia de layout e componentes, nao como app a ser copiado integralmente.
- Dados mockados do Lovable nao entram no app real; cada tela deve receber dados via API ou via props derivadas do contexto autenticado.
- As primeiras fases evitam dependencias novas quando CSS e componentes locais resolvem o problema com menos risco.

## Fase 1 - Base visual no Next

- [x] P0 - Migrar tokens de design do Lovable para `apps/web-dashboard/src/app/globals.css`:
  - cores `canvas`, `shell`, `panel`, `ember/accent`, `signal`, `warn`
  - raios, tipografia, bordas, inputs e estados de foco
  - utilitarios `animate-entrance` e `text-eyebrow`
- [x] P0 - Corrigir textos com encoding quebrado no dashboard atual durante a migracao:
  - exemplos atuais com mojibake: `Sessao`, `Nao`, `Operacao`, `Dominios` aparecendo com caracteres corrompidos
  - padrao esperado: UTF-8 com acentos corretos
- [x] P0 - Criar componentes compartilhados do dashboard real:
  - `DashboardLayout`
  - `DashboardSidebar`
  - `DashboardTopbar`
  - `DashboardMobileNav`
  - `DashboardContextStrip`
  - `DashboardEmptyState` ja existia em `dashboard-state.tsx`
  - `DashboardCard`, `DashboardBadge` e `DashboardTable` ficam para as fases de cada console, para evitar abstracao antes do uso real
- [x] P0 - Adaptar o shell do Lovable para receber dados reais:
  - nome da loja selecionada
  - email/nome do usuario
  - role do membro
  - moeda da loja
  - link da vitrine real
  - logout real
  - seletor de loja existente
- [x] P0 - Manter o login e o bootstrap atual antes de renderizar o novo shell autenticado.
- [ ] P1 - Adicionar alternancia de tema do Lovable com persistencia em local storage.
- [x] P1 - Garantir responsividade com sidebar desktop e mobile nav.
- [x] P1 - Remover textos auxiliares de demo que nao fazem sentido em producao, como `ops console v2`, nomes ficticios e dominio `curadoria-minimal`.

### Resultado da Fase 1

- `apps/web-dashboard/src/components/dashboard-layout.tsx` concentra sidebar, topbar, context strip e mobile nav.
- `DashboardShell` continua responsavel por autenticacao, restauracao de sessao, logout, onboarding sem loja e passagem de dados reais para os consoles.
- O CSS do dashboard recebeu tokens e classes do shell operacional sem adicionar dependencias.
- Validacao executada: `apps/web-dashboard/node_modules/.bin/tsc.CMD --project apps/web-dashboard/tsconfig.json --noEmit`.
- Observacao: `pnpm` nao estava disponivel no PATH do ambiente, entao a validacao usou o `tsc` local do app.

## Fase 2 - Roteamento e arquitetura de estado

- [x] P0 - Quebrar `DashboardShell` em rotas ou secoes modulares no Next.
- [x] P0 - Definir estrategia de navegacao:
  - opcao recomendada: manter Next App Router com rotas reais (`/dashboard/catalogo`, `/dashboard/pedidos`, etc.)
  - opcao temporaria: preservar navegacao por `activeSection` ate a migracao visual estabilizar
- [x] P0 - Centralizar contexto autenticado em um provider:
  - token
  - usuario
  - memberships
  - loja selecionada
  - permissoes
  - funcoes `refreshContext` e `logout`
- [x] P0 - Criar client API unico em `apps/web-dashboard/src/lib` para evitar fetch duplicado.
- [x] P1 - Padronizar estados de loading, empty, error e success.
- [ ] P1 - Adicionar protecao visual por role:
  - owner/manager ve resumo completo
  - operador ve pedidos/catalogo quando permitido
  - leitor ve modulos em modo leitura
- [ ] P2 - Considerar React Query para cache, invalidacao e refetch coordenado.

### Resultado da Fase 2

- `apps/web-dashboard/src/components/dashboard-session.tsx` centraliza token, usuario, memberships, loja selecionada, login, logout e refresh de contexto.
- `apps/web-dashboard/src/lib/dashboard-api.ts` concentra base URL, headers de autenticacao e normalizacao de mensagens.
- `DashboardShell` ficou dividido entre provider, experiencia autenticada, login, onboarding e renderizacao do modulo ativo.
- A navegacao continua por `activeSection` como caminho temporario; rotas reais do Next ficam para a etapa de estabilizacao depois que os consoles migrados estiverem prontos.
- Validacao executada: `apps/web-dashboard/node_modules/.bin/tsc.CMD --project apps/web-dashboard/tsconfig.json --noEmit`.

## Fase 3 - Resumo conectado

- [x] P0 - Migrar layout de KPIs do Lovable para `OverviewConsole`.
- [x] P0 - Substituir valores mockados por dados reais ja carregados:
  - pedidos totais
  - faturamento basico
  - pedidos com atencao
  - produtos publicados
  - baixo estoque
  - sem estoque
  - saude do dominio
- [x] P1 - Adicionar bloco "Fluxo operacional" com serie real dos ultimos dias.
- [x] P1 - Adicionar lista de catalogo recente com produtos reais.
- [x] P1 - Adicionar card de storefront com dominio/subdominio real e status de publicacao quando existir.
- [ ] P2 - Criar endpoint agregado no backend para resumo do dashboard, evitando tres chamadas paralelas em cada carregamento.

### Resultado da Fase 3

- `OverviewConsole` foi refeito no visual operacional do Lovable usando pedidos, produtos e dominio reais.
- O resumo agora exibe KPIs, fluxo operacional em barras, saude de dominio, card da vitrine e catalogo recente.
- A tela segue usando as chamadas reais existentes para pedidos, catalogo e dominios; o endpoint agregado permanece como melhoria P2.
- Validacao executada: `apps/web-dashboard/node_modules/.bin/tsc.CMD --project apps/web-dashboard/tsconfig.json --noEmit`.

## Fase 4 - Catalogo conectado

- [x] P0 - Migrar tabela/lista visual do Lovable para produtos reais de `CatalogConsole`.
- [x] P0 - Preservar operacoes existentes:
  - criar/editar categoria
  - desativar categoria
  - criar/editar produto
  - publicar, desativar e arquivar produto
  - filtros por status, estoque e categoria
- [x] P0 - Trocar formulario longo inline por drawer/modal ou painel lateral para o fluxo "Novo produto".
- [x] P1 - Implementar busca por nome/SKU no client e preparar query no backend se o volume crescer.
- [x] P1 - Exibir imagem principal do produto quando `images` existir, mantendo fallback visual.
- [x] P1 - Ajustar campos de preco para entrada em reais, convertendo para centavos no submit.
- [x] P1 - Adicionar acoes por linha com menu, seguindo o design de console.
- [ ] P2 - Adicionar upload/gestao de imagens se o backend ainda nao tiver fluxo completo.

### Resultado da Fase 4

- `CatalogConsole` agora usa toolbar, filtros, busca, tabela operacional e painel lateral para criar/editar produtos ou categorias.
- Operacoes existentes foram preservadas: criar/editar categoria, desativar categoria, criar/editar produto, publicar, inativar e arquivar produto.
- O preco passou a ser digitado em reais no painel e convertido para centavos no payload.
- Imagem principal do produto e fallback visual sao exibidos na lista.
- Validacao executada: `apps/web-dashboard/node_modules/.bin/tsc.CMD --project apps/web-dashboard/tsconfig.json --noEmit`.

## Fase 5 - Pedidos conectados

- [x] P0 - Migrar visual de abas/status do Lovable para `OrdersConsole`.
- [x] P0 - Usar pedidos reais de `/orders/:storeId/management`.
- [x] P0 - Preservar atualizacao de status com os `allowedActions` retornados pela API.
- [x] P0 - Manter campos operacionais reais:
  - motivo/contexto
  - transportadora
  - servico
  - codigo e URL de rastreio
  - notas
- [x] P1 - Converter status tecnicos para labels amigaveis sem perder o valor tecnico no payload.
- [x] P1 - Criar detalhe expansivel do pedido, evitando que a lista fique pesada.
- [x] P1 - Adicionar contadores por aba com base nos pedidos carregados.
- [x] P1 - Destacar pedidos que exigem atencao.
- [ ] P2 - Adicionar endpoint de metrica operacional para tempo medio de fulfillment.

### Resultado da Fase 5

- `OrdersConsole` agora usa abas com contadores, lista operacional e painel de detalhe por pedido.
- Os dados seguem vindo de `/orders/:storeId/management`.
- A atualizacao de status preserva `allowedActions` e os campos de motivo, transporte, rastreio e notas.
- Status tecnicos sao exibidos como labels amigaveis, mas o payload continua usando o valor tecnico.
- Validacao executada: `apps/web-dashboard/node_modules/.bin/tsc.CMD --project apps/web-dashboard/tsconfig.json --noEmit`.

## Fase 6 - Vitrine conectada

- [x] P0 - Migrar estrutura visual de editor de storefront para `StorefrontThemeConsole`.
- [x] P0 - Conectar dados reais de tema, banner, textos e configuracoes ja existentes no console atual.
- [x] P0 - Garantir preview realista usando a loja selecionada.
- [x] P1 - Separar secoes editaveis:
  - hero
  - colecoes/produtos em destaque
  - manifesto/texto institucional
  - newsletter, se houver backend
- [x] P1 - Implementar estados de rascunho/publicado se o backend suportar.
  - Backend atual publica o tema diretamente em `PATCH /stores/:storeId/theme`; nao ha contrato de rascunho nesta fase.
- [x] P1 - Adicionar botao "Pre-visualizar" apontando para a vitrine real.
- [ ] P2 - Criar historico de publicacao e rollback de tema.

### Resultado da Fase 6

- `StorefrontThemeConsole` virou um editor com preview de vitrine, lista de secoes e formulario contextual.
- A tela preserva `GET/PATCH /stores/:storeId/theme` para cores, logo, banner, titulo, subtitulo e aviso.
- O botao de pre-visualizacao aponta para a vitrine local atual.
- Estados de rascunho/publicado nao foram adicionados porque o backend atual nao oferece esse contrato.
- Validacao executada: `apps/web-dashboard/node_modules/.bin/tsc.CMD --project apps/web-dashboard/tsconfig.json --noEmit`.

## Fase 7 - Dominios conectados

- [x] P0 - Migrar visual de tabela de dominios para `DomainConsole`.
- [x] P0 - Usar status reais de DNS e SSL:
  - `ACTIVE`
  - `SSL_PENDING`
  - `VERIFYING`
  - `AWAITING_DNS`
  - `ERROR`
  - `REMOVED`
- [x] P0 - Preservar criacao/adicao de dominio existente.
- [x] P1 - Exibir registros DNS reais retornados pela API, com acao de copiar.
- [x] P1 - Adicionar CTA de verificar DNS/SSL quando permitido.
- [x] P1 - Mostrar mensagens de erro de DNS/SSL de forma clara.
- [ ] P2 - Adicionar timeline de provisionamento.

### Resultado da Fase 7

- `DomainConsole` agora usa tabela operacional de host, status de DNS/SSL, registros CNAME e painel lateral de DNS.
- Foram preservadas as operacoes de consultar, cadastrar, verificar DNS, sincronizar SSL e remover dominio.
- Erros de DNS/SSL aparecem em feedback dedicado e os registros DNS podem ser copiados.
- A timeline detalhada foi substituida por tabela + registros nesta fase; timeline historica segue como P2.
- Validacao executada: `apps/web-dashboard/node_modules/.bin/tsc.CMD --project apps/web-dashboard/tsconfig.json --noEmit`.

## Fase 8 - Equipe e permissoes

- [x] P0 - Migrar visual de membros e roles para `MembersConsole`.
- [x] P0 - Preservar restricao `canManage` para owner.
- [x] P0 - Conectar lista real de membros e convites.
- [x] P1 - Criar resumo por role com dados reais.
- [x] P1 - Adicionar modal/drawer de convite.
- [x] P1 - Permitir alteracao de role quando a API suportar.
- [ ] P2 - Adicionar matriz granular de permissoes por modulo.

### Resultado da Fase 8

- `MembersConsole` agora tem resumo por role, lista operacional de membros/convites e painel lateral de convite.
- Restricao `canManage` foi preservada: apenas owner gerencia equipe.
- Foram preservadas as operacoes de listar, convidar, alterar role, remover membro e cancelar convite.
- A matriz granular de permissoes segue como P2 porque o backend atual trabalha com roles gerenciaveis.
- Validacao executada: `apps/web-dashboard/node_modules/.bin/tsc.CMD --project apps/web-dashboard/tsconfig.json --noEmit`.

## Fase 9 - Configuracoes e modulos pendentes

- [x] P0 - Migrar navegacao lateral interna de configuracoes do Lovable.
- [x] P0 - Conectar paineis ja existentes:
  - identidade da loja
  - frete/logistica
  - tema/regiao
  - membros quando fizer sentido
- [x] P1 - Separar configuracoes em submodulos:
  - loja
  - fiscal
  - pagamentos
  - frete
  - notificacoes
  - integracoes
  - regiao/idiomas
  - API/webhooks
- [x] P1 - Marcar modulos sem backend como "em producao" ou ocultar ate estarem prontos.
- [x] P1 - Conectar pagamentos e integracoes aos endpoints existentes, quando disponiveis.
  - Pagamentos nao tem configuracao por loja no backend atual.
  - Integracoes expoem apenas catalogo global em `GET /integrations`, sem contrato de configuracao por loja nesta fase.
- [ ] P2 - Implementar webhooks/API keys caso ainda sejam apenas mock.

### Resultado da Fase 9

- `SettingsConsole` agora tem navegacao interna por submodulo no estilo Lovable.
- Identidade da loja, notificacoes, frete, vitrine e dominios seguem conectados aos endpoints reais.
- Fiscal, pagamentos, integracoes e API/webhooks ficam visiveis como modulos em producao, sem dados mockados.
- Validacao executada: `apps/web-dashboard/node_modules/.bin/tsc.CMD --project apps/web-dashboard/tsconfig.json --noEmit`.

## Fase 10 - Onboarding e estados sem loja

- [ ] P0 - Migrar visual do onboarding do Lovable para o fluxo real de `MerchantOnboardingForm`.
- [ ] P0 - Preservar validacao de slug e criacao de loja conectada a API.
- [ ] P0 - Manter estado autenticado sem memberships levando ao onboarding.
- [ ] P1 - Adicionar progresso visual por etapa:
  - identidade
  - operacao
  - dominio
- [ ] P1 - Permitir continuar configuracao depois da criacao inicial da loja.
- [ ] P2 - Adicionar checklist inicial dentro do dashboard apos primeira loja criada.

## Fase 11 - Testes, QA e entrega

- [ ] P0 - Rodar typecheck do monorepo.
- [ ] P0 - Rodar build do dashboard.
- [ ] P0 - Atualizar testes Playwright existentes:
  - login
  - selecao de loja
  - navegacao entre modulos
  - permissoes de admin/lojista
  - smoke do dashboard autenticado
- [ ] P0 - Testar responsividade em desktop e mobile.
- [ ] P1 - Validar estados reais:
  - sem token
  - token expirado
  - usuario sem loja
  - loja sem produtos
  - loja sem pedidos
  - dominio com erro
  - usuario sem permissao
- [ ] P1 - Comparar visual com o Lovable por screenshots.
- [ ] P1 - Fazer revisao de acessibilidade basica:
  - labels
  - foco visivel
  - contraste
  - botoes icon-only com `aria-label`
- [ ] P2 - Adicionar testes visuais ou screenshots baseline.

## Alteracoes recomendadas antes ou durante a migracao

- [ ] P0 - Remover dados mockados do Lovable e transformar cada tela em componente parametrizado.
- [ ] P0 - Corrigir encoding dos textos existentes no dashboard atual para evitar regressao visual.
- [ ] P0 - Evitar portar TanStack Router para o app real; usar o App Router do Next para reduzir complexidade.
- [ ] P0 - Evitar importar todos os componentes `ui/*`; migrar apenas o que for usado.
- [ ] P0 - Padronizar labels de status em uma camada unica para catalogo, pedidos, dominios e membros.
- [ ] P1 - Criar helpers compartilhados:
  - `formatMoney`
  - `formatDate`
  - `normalizeMessage`
  - `slugify`
  - `statusToLabel`
  - `statusToTone`
- [ ] P1 - Substituir botoes de texto por botoes com icones onde o design pede acao compacta.
- [ ] P1 - Trocar cards longos de formulario por drawers/modals para manter a densidade operacional do design.
- [ ] P1 - Criar endpoint agregado de overview no backend.
- [ ] P1 - Criar endpoints de contadores por modulo se o volume de dados aumentar.
- [ ] P2 - Adicionar feature flags para liberar modulos migrados gradualmente.
- [ ] P2 - Criar documentacao curta de design tokens e padroes de componentes.

## Ordem sugerida de execucao

1. Base visual e shell autenticado.
2. Roteamento/context provider.
3. Resumo conectado.
4. Catalogo conectado.
5. Pedidos conectado.
6. Dominios conectado.
7. Vitrine conectada.
8. Equipe conectada.
9. Configuracoes/onboarding.
10. QA final, screenshots, Playwright e limpeza dos mocks.

## Criterios de aceite

- O usuario consegue logar no dashboard real.
- O usuario sem loja cai no onboarding real.
- O usuario com lojas consegue alternar a loja selecionada.
- Todos os modulos do Lovable aparecem no dashboard real com visual equivalente.
- Nenhum modulo usa dados mockados quando houver endpoint real disponivel.
- Catalogo, pedidos, dominios, equipe, vitrine e configuracoes continuam enviando alteracoes para a API.
- Permissoes por role continuam respeitadas.
- Mobile e desktop funcionam sem sobreposicao ou quebra de layout.
- `pnpm typecheck`, build relevante e smoke tests passam.

## Riscos e mitigacoes

- Diferenca de stack visual: Lovable usa Vite/Tailwind v4 e o dashboard usa Next. Mitigar migrando tokens e componentes aos poucos, validando build a cada modulo.
- Regressao em permissoes: o shell novo pode esconder contexto importante. Mitigar mantendo provider unico e testes por role.
- Dados mockados escaparem para producao: cada tela deve ter uma task explicita de substituicao por API real.
- Formulario ficar pesado no layout novo: mover criacao/edicao para drawers/modals.
- Dependencias demais no dashboard: importar apenas Radix/shadcn usados.
- Encoding quebrado: corrigir textos em UTF-8 antes de comparar screenshots.
