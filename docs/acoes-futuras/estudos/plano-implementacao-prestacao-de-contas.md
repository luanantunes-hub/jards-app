# Plano de implementação — Módulo de Prestação de Contas

> 01/10/2026. Transforma o [estudo do módulo](./plano-modulo-prestacao-de-contas.md) em entregas executáveis. O estudo diz **o quê e por quê**; este documento diz **como, em que ordem e em quais PRs**.
> As fases 0 e 1 estão detalhadas PR a PR. As fases 2 a 10 aparecem como lista de entregas e serão detalhadas no início de cada uma, com o que a fase anterior ensinar.

## 0. Como ler

- Cada entrega tem um código (`P0.3` = fase 0, entrega 3) e vira **um PR** pequeno, que pode entrar sozinho sem quebrar o que existe.
- Estimativas em **dias úteis de uma pessoa**. Elas já incluem testes e revisão.
- "Aceite" é o que precisa ser verdade para o PR ser aprovado.
- Os números de linha citados são do `main` de 01/10/2026 (commit `b5128bf`).

---

## 1. Ponto de partida

O levantamento do código mudou algumas premissas do estudo. O que o plano leva em conta:

| Fato | Onde | Consequência |
|---|---|---|
| As 9 tabelas do módulo (`prestacoes_contas`, `prestacao_itens`, `prestacao_comprovantes`, `prestacao_atividades`, `prestacao_atividade_evidencias`, `prestacao_relatorio`, `prestacao_status_log`, `prestacao_distribuicao`, `prestacao_divulgacao`) não têm `create table` em nenhuma migration | `supabase/migrations/` | Primeiro PR versiona o schema a partir do banco real |
| Todas as consultas do módulo usam `(supabase as any)`; as tabelas não estão no tipo `Database` | `lib/supabase/types.ts:621-741` | Tipar junto com a migration de base |
| Acesso por `can_access_prestacao`: criador **ou** membro da organização do projeto ou da captação; não há `organization_id` | `20260830044912_predeploy_phase1_fixes.sql:101-129`, `20261001210000_corrigir_acessos_abertos.sql:15-76` | Prestação sem projeto e sem captação fica visível só para quem criou |
| `enable row level security` só existe para 2 das 9 tabelas | mesmas migrations | Conferir no banco e garantir em migration |
| Os uploads vão para `prestacoes/{id}/...` e `orcamentos/{id}/...`, mas a política do bucket `documentos` exige que a primeira pasta seja o ID da organização | `comprovantes/page.tsx:94-98`, `atividades/page.tsx:120-135`, `orcamento/page.tsx:202-203`; política em `20260830044912:58-97` | Os uploads do módulo provavelmente falham hoje; migrar caminhos e arquivos |
| `extrair-comprovante` e `importar-orcamento` usam a chave de serviço e não conferem quem chama | `supabase/functions/*/index.ts` | Corrigir antes de abrir o módulo a clientes |
| Mudança de status é feita no navegador, em duas escritas sem transação e sem checagem de papel; a criação não grava log | `prestacoes/[id]/page.tsx:157-175` | Função no banco |
| `valor_realizado` nunca é calculado; a visão geral soma uma coluna `valor` que nunca é gravada; o relatório mostra quantidades fixas ("1,00", 100%) | `[id]/page.tsx:130-134`, `relatorio/page.tsx:119-132, 192-198` | Tirar do ar as regras erradas já na fase 0 |
| O bloqueio de módulo é só visual: o layout é componente de cliente, `proxy.ts` não confere módulo, e `modulos_ativos`/`modulos_acesso` não existem em migration | `app/(dashboard)/layout.tsx:145-276`, `proxy.ts` | Proteção no servidor e no RLS |
| **As migrations não refletem o banco de produção em papéis de equipe**: `20260830080000_team_access_roles` (colaborador/leitor) nunca foi aplicada; a última regra no repositório aceita `admin`, `captador`, `visualizador`, `proponente`; a tela de equipe convida como `colaborador`/`leitor` | `20260905000003:1-7`, `20260921041646:133-135, 148, 203`; `app/api/members/invite/route.ts:58` | Resolver antes de mexer em convites (tarefa separada já sugerida) |
| Já existem dois tipos de usuário externo com espaço próprio: `captador` e `proponente`, que não ocupam vaga | `20260921041646`, `workspace-captador/`, `workspace-proponente/` | O cliente da consultoria (proponente) pode enviar comprovantes da própria prestação na fase 5 |
| A cobrança é por pessoa (`profiles.plano`), os créditos por organização; usuário extra é item da mesma assinatura do plano | `fn_process_stripe_billing_event` em `20260910000002:13-172`; `app/api/members/seats/route.ts:157-181` | Assinatura do módulo é nova e por organização |
| O webhook real é a edge function; a rota do Next é cópia para desenvolvimento, e um teste exige que as duas fiquem iguais | `app/api/stripe/webhook/route.ts:1-3`, `tests/predeploy.test.ts:34-52` | Mudar as duas no mesmo PR |
| Testes: `node:test` com `tsx`, testes de funções puras e testes que leem o texto das migrations; nenhum teste fala com o banco; o CI roda typecheck, testes e build, sem lint e sem e2e | `package.json`, `.github/workflows/predeploy.yml` | Criar testes de RLS (P0.8) |
| Tarefas agendadas: `pg_cron` chamando funções SQL; edge function só é chamada por `pg_net` num gatilho | `20260830000001:510-527`, `20260825000010:22-68` | Coleta do agente e sincronização do Salic usam `pg_cron` + `pg_net` |
| `zod` não é dependência declarada; não há biblioteca de toast | `package.json` | Adicionar `zod` (P1.1); mensagens seguem o padrão local das páginas |

---

## 2. Pré-requisitos

| # | Item | Por quê | Bloqueia |
|---|---|---|---|
| 1 | **Leitura do banco de produção.** Autorizar o conector Supabase nesta sessão (configurações de conectores do claude.ai) ou alguém com acesso rodar `supabase db dump --schema public` e `--schema storage` | Gerar a migration de base com tipos, padrões, chaves e gatilhos reais | P0.1 |
| 2 | **Inventário dos dados atuais**: linhas por tabela de prestação, prestações sem projeto e sem captação, objetos no bucket com prefixo `prestacoes/` e `orcamentos/` | Dimensionar o preenchimento de `organization_id` e a migração de arquivos | P0.2, P0.3 |
| 3 | **Papéis de equipe reconciliados** (tarefa "Reconcile team roles between app and database") | Os convites por módulo mexem nas mesmas funções | P0.6 |
| 4 | **Ambiente de teste do banco**: branch do Supabase ou projeto de homologação, e usuário de e2e com organização própria | Testar migrations e RLS sem tocar produção | P0.8 |
| 5 | Adicionar **`zod`** às dependências | Validar os parâmetros dos regimes no app e nas edge functions | P1.1 |
| 6 | **Cadastro no INLABS** (gratuito) para a equipe | Coleta do DOU pelo vigia normativo | P1.10 |
| 7 | **3 organizações piloto** com projetos Rouanet em execução, recrutadas agora | O piloto começa na fase 4 e depende de dados reais | Fase 4 |
| 8 | **Preço no Stripe** de R$ 92,80, primeiro em modo de teste, e conferência do valor real de `STRIPE_PRICE_SEAT` | Cobrança | Fase 5 |

---

## 3. Convenções de execução

**Banco**
- Migrations novas, aditivas e idempotentes (`if not exists`); nunca editar migration antiga. Nome: `AAAAMMDDHHMMSS_prestacao_<assunto>.sql`.
- Mudanças de estrutura em dois tempos: **expandir** (coluna nova anulável, preenchimento, código passa a usar) e, depois do deploy conferido, **contrair** (`not null`, remoção do antigo) em outro PR.
- Toda escrita com regra de negócio (status, aceite, envio, liberação de módulo) passa por função `security definer` com `set search_path = public`, checagem de papel dentro da função e `grant execute` só para `authenticated` ou `service_role`.
- Tarefa agendada segue o padrão do repositório: bloco `do $$` protegido, `cron.unschedule` e `cron.schedule` chamando função SQL; quando precisar de edge function, `pg_net` com segredo em cabeçalho, como em `calendar-sync-push`.

**Código**
- Regras do domínio em `lib/prestacao/**`, em TypeScript puro, sem React e sem Supabase, testáveis com `node:test`. Nenhum número de regra em componente.
- Tabelas novas entram no tipo `Database` de `lib/supabase/types.ts` no mesmo PR da migration; cada PR que toca uma tela remove o `(supabase as any)` dela.
- Next.js 16: ler o guia correspondente em `node_modules/next/dist/docs/` antes de escrever. `middleware` virou `proxy.ts`; proteção de rota em layout de servidor ou em route handler; não usar `forbidden()` (experimental).
- Interface pelo `DESIGN.md` e pelos primitivos existentes: `components/list/ListPagePrimitives.tsx`, `components/ui/DetailPagePrimitives.tsx`, `Dropdown`, `Select`, `CustomDropdown`, `StatusBadge`, `StatusDropdown`, `ColumnManager`, `useDeleteConfirm()` para exclusões. Erros junto do formulário, nunca `alert()`.
- Mudança no webhook do Stripe sempre nos dois arquivos (edge function e rota do Next).

**Testes** (seção 8 detalha)
- Função pura: teste unitário com casos dos manuais.
- Contrato SQL: teste de texto sobre a migration, como os de `tests/predeploy.test.ts`.
- RLS: testes pgTAP em `supabase/tests/` (P0.8).
- Fluxo: Playwright em `e2e/authenticated/`.

**Antes de abrir o PR**: `npm run lint && npm run typecheck && npm test && npm run build -- --webpack`, e a migration aplicada no ambiente de teste.

---

## 4. Fase 0 — Fundação e acesso por módulo (≈ 22 dias)

Objetivo: o módulo atual passa a ser seguro, isolado por organização, com arquivos funcionando, sem regras erradas na tela, e a prestação vira um módulo que se libera por organização e por pessoa. Nada novo para o cliente final ainda.

### P0.1 — Schema da prestação versionado (2 dias)

- Migration `prestacao_base.sql` gerada do dump de produção (pré-requisito 1): as 9 tabelas com `create table if not exists`, restrições, padrões, índices, chaves e gatilhos; `enable row level security` nas 9. Em produção ela não muda nada; num banco novo cria tudo.
- Colunas que o código grava e que precisam existir: `prestacao_comprovantes.risco_glosa`, `motivos_glosa`.
- Tipos das 9 tabelas no `Database` de `lib/supabase/types.ts`.
- Teste `tests/prestacao-schema.test.ts`: toda tabela `prestacao*` usada no código tem `create table` em migration e `enable row level security`.
- **Aceite:** diff entre o dump de produção depois da migration e o de antes é vazio; banco novo sobe com as tabelas; typecheck passa.

### P0.2 — Prestação pertence à organização (3 dias)

- Expandir: `prestacoes_contas.organization_id uuid references organizations(id)`, índice.
- Preencher: organização do projeto; senão a da captação; senão a organização em que quem criou é admin. Casos que sobrarem vão para uma lista de conferência manual (pré-requisito 2).
- Gatilho `before insert` preenche `organization_id` pelo projeto ou pela captação quando vier vazio (transição).
- Reescrever `can_access_prestacao(uuid)`: `organization_id = any(auth_org_ids())`. A exceção "quem criou" fica só enquanto houver linha sem organização.
- Políticas de `prestacoes_contas`: inserir exige organização do usuário e permissão de escrita (`auth_can_write_org`); leitor só lê.
- App: `NovaPrestacaoModal` envia `organization_id` de `useOrganizationId()`; captações e projetos do modal e a lista de prestações filtram pela organização atual.
- **Contrair (PR separado, depois do deploy conferido):** `organization_id not null` e remoção da exceção "quem criou".
- **Aceite:** pessoa de outra organização não vê nem altera prestação (P0.8 testa); prestação sem projeto continua visível para a organização.

### P0.3 — Arquivos no caminho da organização (2 dias)

- `lib/prestacao/armazenamento.ts`: monta caminhos `{orgId}/prestacoes/{prestacaoId}/comprovantes/{uuid}.{ext}`, `.../atividades/{atividadeId}/...` e `.../orcamento/...`, sem nome original do arquivo no caminho; teste unitário (caracteres, `..`, extensão).
- As três telas passam a usar o helper.
- Script `scripts/prestacao-migrar-arquivos.mjs`, com execução de ensaio primeiro: move os objetos antigos pela API de Storage e atualiza `storage_path`. Idempotente; só apaga o antigo depois de conferir o novo.
- Corrigir o retorno antecipado em `orcamento/page.tsx:214-217`, que deixa o PDF para trás.
- **Aceite:** upload, visualização e exclusão funcionam com as políticas atuais do bucket; nenhum objeto restante fora do prefixo da organização.

### P0.4 — Edge functions com autorização (2 dias)

- `extrair-comprovante` e `importar-orcamento`: ler o cabeçalho `Authorization`, validar o usuário, chamar `can_access_prestacao(prestacao_id)` com o cliente do usuário, exigir que `storage_path` comece por `{orgId}/prestacoes/{prestacao_id}/`; só então baixar com a chave de serviço. `prestacao_id` obrigatório nas duas.
- `verify_jwt = true` nas duas em `supabase/config.toml`; CORS restrito ao domínio do app.
- `importar-orcamento`: erro claro quando falta `GOOGLE_AI_API_KEY`; modelo vindo de `GOOGLE_AI_MODEL`, como na outra função. Adicionar a variável ao `.env.example`.
- Teste de texto: as duas funções validam o usuário e o acesso antes do download.
- **Aceite:** chamada sem token, com token de outra organização ou com caminho de outra prestação devolve 401/403.

### P0.5 — Acesso por módulo: dados (2 dias)

- Migration `modulos_acesso.sql` (com `add column if not exists`, porque o layout já lê essas colunas e elas podem existir em produção; conferir no dump):
  - `organizations.modulos_ativos text[] not null default '{captacao}'`;
  - `organization_members.modulos_acesso text[] not null default '{captacao}'` e `prestacao_funcao text` (preparador, revisor, responsável);
  - `organization_invitations.modulos_acesso`, `prestacao_funcao`;
  - tabela `organization_modulos` (seção 7.6 do estudo), já com `status` e as colunas do Stripe, que só serão usadas na fase 5.
- Gatilho mantém `organizations.modulos_ativos` igual às linhas ativas de `organization_modulos`; o navegador não escreve essas colunas (bloqueio por gatilho, como o de `jards_super_admin`).
- Função `auth_tem_modulo(org uuid, modulo text)`: organização com o módulo ativo **e** membro com o módulo em `modulos_acesso`, ou super admin. `can_access_prestacao` passa a exigir `auth_tem_modulo(organization_id, 'prestacao')`.
- **Aceite:** membro sem o módulo não lê tabela da prestação, mesmo sendo da organização.

### P0.6 — Convite e equipe por módulo (3 dias; depende do pré-requisito 3)

- Novas versões de `add_organization_member_with_seat` e `reserve_organization_invitation` recebendo `target_modulos` e `target_funcao`; a vaga é conferida **por módulo** (captação: regra atual; prestação: 1 + vagas da `organization_modulos`, sem contar captador, proponente e convidados).
- `POST /api/members/invite` e `PATCH /api/members/[userId]` aceitam módulos e função e recusam módulo que a organização não tem.
- `GET /api/members/seats?modulo=` devolve o resumo por módulo, com a mesma contagem da função SQL (hoje a rota conta `proponente` e a função não).
- `NovoMembroModal`: escolha de módulos (só aparece se a organização tiver a prestação), função na prestação com `Dropdown`, resumo de vagas por módulo.
- `configuracoes` → Equipe: coluna "Módulos" e edição.
- **Aceite:** convidar alguém só para a prestação funciona do convite ao primeiro acesso; vaga de captação não é consumida.

### P0.7 — Espaço de quem usa só a prestação e bloqueio no servidor (2 dias)

- Extrair a lógica de módulo do layout para `lib/modulos.ts` (funções puras: módulo inicial, pode acessar, mostra seletor), com testes.
- `app/(dashboard)/prestacoes/layout.tsx` vira layout de servidor que confere sessão e acesso ao módulo em alguma organização e redireciona quem não tem. O isolamento por organização continua no RLS, porque a organização atual é escolhida no navegador (`localStorage`).
- Layout do dashboard: membro só da prestação entra em `/prestacoes`, não vê o menu da captação nem o aviso de créditos; rotas da captação redirecionam para `/prestacoes`. Corrigir `trocarOrganizacao`, que hoje não relê `modulos_ativos` da nova organização.
- O seletor de módulo continua só para super admin até a P0.9 existir; depois aparece para quem tem os dois módulos na organização atual.
- `lib/navigation/rotas.ts` e `tests/navegacao.test.ts` com o caso `/prestacoes`.
- **Aceite:** e2e com três usuários (só captação, só prestação, os dois) cobrindo menu, redirecionamentos e acesso direto por URL.

### P0.8 — Testes de banco (2 dias)

- `supabase/tests/prestacao_rls.test.sql` (pgTAP): duas organizações; membros admin, colaborador e leitor, com e sem o módulo; captador; anônimo. Casos de leitura, inserção, alteração e exclusão nas 9 tabelas e no bucket.
- Rodar com `supabase test db`. Se a cadeia de migrations não subir do zero (não há `seed.sql` e há migrations que nunca rodaram em produção), rodar no branch do Supabase até a cadeia ser corrigida, e registrar isso no PR.
- Job `db` no workflow de CI quando a cadeia subir do zero.
- **Aceite:** testes verdes no ambiente de teste e passo a passo no README para rodar.

### P0.9 — Liberação do módulo pelo super admin (2 dias)

- `app/admin/organizacoes/`: lista organizações; liberar a prestação como **cortesia** (prazo, motivo, vagas de cortesia); ver quem tem acesso.
- Rota `app/api/admin/modulos/route.ts` com checagem de `jards_super_admin` e `writeAdminAuditLog` (incluir o recurso `organizacao` em `ALLOWED_RESOURCES`).
- Rotina diária `jards-prestacao-cortesias` encerra cortesias vencidas, com aviso 7 dias antes.
- `AdminNav` com o novo item.
- **Aceite:** liberar e encerrar a cortesia muda o acesso dos membros sem deploy, e tudo aparece no log de auditoria.

### P0.10 — Correções no módulo atual (2 dias)

- Status por função `fn_prestacao_mudar_status(prestacao_id, novo_status, comentario)`: confere a transição (mapa de `[id]/page.tsx:37-44`) e o papel, grava status e log na mesma transação. Gatilho grava o primeiro log na criação.
- Aceite e recusa de comprovante passam a gravar quem e quando.
- Tirar da tela as regras erradas (seção 3.2 do estudo) até o motor de checagens existir: alerta de 20% de pessoa física, tolerância padrão de 15%, "20% gratuito", e as quantidades fixas do relatório (passam a "—").
- `valor_realizado` provisório: view `prestacao_itens_execucao` somando os comprovantes aceitos por item. Na fase 2 ela é substituída pelos pagamentos conciliados.
- Tratar erros em todas as escritas das telas atuais; exclusões pelo `useDeleteConfirm()`.
- **Aceite:** nenhum número de regra sem fonte na tela; status não muda sem log.

### Ordem e paralelismo

- P0.1 → P0.2 → P0.3 → P0.4 (a P0.4 confere o caminho novo dos arquivos).
- P0.2 → P0.10.
- P0.5 → P0.6 → P0.7, e P0.5 → P0.9.
- P0.8 depois de P0.2 e P0.5.

Com duas pessoas: A faz P0.1, P0.2, P0.3, P0.4 e P0.10; B faz P0.5, P0.6, P0.7, P0.9 e P0.8. São 11 dias para cada uma, pouco mais de 2 semanas de calendário.

**Marco M0:** o módulo atual funciona para uma organização piloto liberada por cortesia, com dados isolados, arquivos no lugar certo, funções de IA protegidas e testes de RLS verdes.

---

## 5. Fase 1 — Núcleo multi-regime e Rouanet (≈ 27 dias)

### P1.1 — Catálogo de regimes (3 dias)

- Migration com `prestacao_regimes` e `calendario_regulatorio` (seção 7.1 do estudo); usuários autenticados leem os regimes publicados, só o super admin escreve.
- `lib/prestacao/regimes/schema.ts`: schema `zod` dos parâmetros comuns (prazos, tetos, meios de pagamento, documentos, checklist) e tipos derivados.
- `lib/prestacao/regimes/rouanet-in29-2026.ts` e `generico.ts`: parâmetros com a fonte de cada valor (artigo e página, a partir de `prestacao-de-contas-fontes/rouanet-in29-texto-integral.md`).
- `scripts/prestacao-gerar-seed-regimes.ts` gera a migration de seed a partir do TypeScript; um teste garante que o seed está igual à fonte.
- Feriados nacionais de 2026 e 2027 e o defeso eleitoral de 2026 no calendário.
- **Aceite:** o schema rejeita parâmetro faltando ou fora do tipo; cada valor da Rouanet tem fonte.

### P1.2 — Prestação ligada ao regime (2 dias)

- Colunas em `prestacoes_contas`: `regime_id`, `identificador_oficial`, `identificador_tipo`, `fonte_recurso`, `proponente_id`, marcos (`data_aprovacao`, `data_liberacao`, `data_termo`, `data_conclusao_objeto`, `data_envio`), `prazo_final` calculado e `prazo_final_override` com justificativa.
- Prestações existentes recebem `rouanet_in29_2026` quando a captação é Rouanet e `generico` nos outros casos, com registro no histórico.

### P1.3 — Prazos (3 dias)

- `lib/prestacao/prazos.ts`: dias corridos e úteis com o calendário, cálculo de cada marco pelos parâmetros do regime, "prazo que vence por último" para prestações agrupadas.
- Testes com os prazos da IN 29 e casos de fim de semana, feriado e defeso.

### P1.4 — Criação guiada (3 dias)

- Substitui o `NovaPrestacaoModal`: projeto ou captação → regime (sugerido pela lei da captação) → identificador oficial (Pronac) → importação → marcos. Rascunho salvo a cada passo.

### P1.5 — Importação do Salic (3 dias)

- `lib/prestacao/integracoes/salic.ts`: cliente da API pública (`api.salic.cultura.gov.br/api/v1`) e conversão para prestação, orçamento (depende de P1.6) e aportes.
- Sincronização diária pelo padrão `pg_cron` + `pg_net` + edge function, com registro da última sincronização e do erro, se houver.
- Quando a API falhar, a criação segue manual, com aviso.

### P1.6 — Orçamento em árvore (4 dias)

- `prestacao_orcamento_versoes` e `prestacao_orcamento_nos` (seção 7.3 do estudo), com grupos de custo.
- Migração de `prestacao_itens` para a árvore; `prestacao_comprovantes` ganha `no_id`. A tabela antiga fica só para leitura até a fase 2.
- Tela da árvore com aprovado, remanejado, vigente, comprometido, pago, saldo e % do teto.

### P1.7 — Alterações de orçamento (2,5 dias)

- `prestacao_alteracoes`; cálculo do quanto foi movido contra o limite do regime; administrativo × formal; minuta do pedido formal.

### P1.8 — Prazos viram tarefas e avisos (1,5 dia)

- Marcos criam `atividades` com responsável; rotina diária `jards-prestacao-prazos` gera notificações (padrão de `fn_dispatch_deadline_notifications`).

### P1.9 — Lista e visão geral (2 dias)

- Lista no padrão do `docs/LISTAS_PADRAO_OURO.md`, com regime, próximo prazo e % de prontidão; visão geral com marcos e pendências.

### P1.10 — Vigia normativo mínimo (2,5 dias)

- `normas_fontes` e `normas_documentos`; edge function `agente-normativo` só com coleta do DOU pelo INLABS e triagem por órgão e palavra-chave, sem IA; aviso ao super admin pelas notificações.
- Rotina diária `jards-agente-normativo` às 8h, depois da publicação do DOU.

### Ordem

P1.1 → P1.2 → (P1.3, P1.6) → P1.4 → P1.5 → P1.7 → P1.8 → P1.9. A P1.10 é independente e pode ir em paralelo.

**Marco M1:** uma prestação Rouanet criada pelo Pronac, com orçamento importado em árvore, prazos calculados, tarefas e avisos funcionando, e o vigia mandando o resumo diário do DOU.

---

## 6. Fases 2 a 10 — entregas previstas

Detalhar cada fase no início dela. Dependências entre fases no fim da seção.

**Fase 2 — Financeiro (≈ 4 semanas)**
P2.1 contas bancárias e importação de extrato OFX e CSV (`lib/prestacao/extrato/`, com arquivos de exemplo nos testes) · P2.2 extrato em PDF do BB pela IA · P2.3 fornecedores com CNPJ (BrasilAPI) e sanções (CGU e TCU) · P2.4 despesas v2 evoluindo `prestacao_comprovantes` · P2.5 pagamentos · P2.6 conciliação (`lib/prestacao/conciliacao.ts` e tela) · P2.7 motor de checagens (registro de checagens, `prestacao_verificacoes`, rota `/api/prestacoes/[id]/verificar`) · P2.8 checagens financeiras e de documento da Rouanet · P2.9 fila de pendências · P2.10 leitura de documento v2 (XML sem IA, prompt por regime, motivos ligados aos códigos de checagem, custo por chamada) · P2.11 remoção de `prestacao_itens`, da view provisória e das colunas antigas.

**Fase 3 — Objeto e divulgação (≈ 3 semanas)**
P3.1 metas e locais · P3.2 evidências com data e local lidos do arquivo · P3.3 cobertura por meta · P3.4 distribuição pela IN 29 · P3.5 bens · P3.6 peças com marcas, aprovação e defeso.

**Fase 4 — Envio e piloto (≈ 3 semanas)**
P4.1 checklist de envio · P4.2 espelho Salic · P4.3 rascunho do relatório do objeto · P4.4 GRU · P4.5 pacote com manifesto e pré-pacote · P4.6 retratos travados · P4.7 pós-envio (diligências, glosas, decisões, recursos, devoluções) · P4.8 piloto com as 3 organizações, medindo tempo e custo de IA.

**Fase 5 — Carteira, patrocinador, convidados e cobrança (≈ 4 semanas)**
P5.1 carteira · P5.2 relatório do patrocinador por link · P5.3 convidados com escopo e validade · P5.4 espaço do proponente com as próprias prestações · P5.5 captura por e-mail · P5.6 cobrança: preço `STRIPE_PRICE_MODULO_PRESTACAO`, checkout do módulo na edge function `stripe-checkout`, webhook nos dois arquivos reconhecendo o módulo e atualizando `organization_modulos`, compra de vagas, "Meu plano", cadastro por `/cadastro?modulo=prestacao`, somente leitura após cancelamento.

**Fase 6 — Agente normativo e editor de regimes (≈ 3 semanas)**
P6.1 coleta das páginas e arquivos dos órgãos com hash · P6.2 leitura dos atos pela IA e propostas com citação conferida · P6.3 tela de revisão e publicação em `app/admin/regimes/`, com segunda aprovação para regras que bloqueiam envio · P6.4 aviso aos clientes afetados · P6.5 conjunto de teste com as mudanças de 2026 e rascunho dos regimes de ANCINE, LIE e saúde.

**Fases 7, 8 e 9 — ANCINE, LIE federal e saúde (≈ 3 semanas cada)**
Para cada área: regimes e seed revisados a partir do rascunho do agente · checagens próprias · saídas nos modelos oficiais (`prestacao-de-contas-fontes/modelos-oficiais/`) · integrações de leitura (dados abertos da ANCINE; Transferegov para a saúde) · testes com os exemplos dos manuais.

**Fase 10 — Expansão contínua:** captura automática de notas, extrato automático, assistente, estados e municípios.

**Dependências entre fases:** 0 → 1 → 2 → (3, 4) → piloto. A fase 5 depende da 0 (acesso) e da 4 (piloto) para a cobrança. A fase 6 depende da 1 (catálogo). As fases 7, 8 e 9 dependem da 2 (motor) e, de preferência, da 6 (rascunho dos regimes) e podem correr em paralelo.

---

## 7. Cronograma

| Fase | Estudo | Este plano | Diferença |
|---|---|---|---|
| 0 | 3 semanas | ≈ 4,5 semanas (22 dias) | Papéis de equipe divergentes, migração de arquivos e testes de RLS que não existiam |
| 1 | 4 semanas | ≈ 5,5 semanas (27 dias) | Seed gerado do TypeScript e sincronização diária do Salic |
| 2 a 9 | 26 semanas | 26 semanas | Revisar no início de cada fase |
| **Total** | **33 semanas** | **≈ 36 semanas** de uma pessoa; ≈ 6 meses com duas | |

Com duas pessoas, o caminho crítico é 0 → 1 → 2 → 4 (piloto). Em paralelo: P0.5 a P0.9 com a outra pessoa; P1.10 e a fase 6 fora do caminho crítico; fase 5 em paralelo com a 3.

---

## 8. Testes

| Tipo | Onde | O que cobre | Quando roda |
|---|---|---|---|
| Unitário | `tests/prestacao/*.test.ts` | Prazos, conciliação, checagens, schema dos regimes, caminhos de arquivo, lógica de módulo | `npm test`, CI |
| Contrato SQL | `tests/prestacao-schema.test.ts` e outros | Toda tabela com RLS; funções com `search_path`; seed igual à fonte; webhook igual nos dois arquivos | `npm test`, CI |
| RLS | `supabase/tests/*.test.sql` | Acesso por organização, papel e módulo, nas tabelas e no bucket | `supabase test db`; CI quando a cadeia de migrations subir do zero |
| Fluxo | `e2e/authenticated/prestacao-*.spec.ts` | Criação guiada, upload, mudança de status, acesso por tipo de usuário | Local e antes de cada liberação |
| Saídas | `tests/prestacao/saidas/` | Arquivos gerados comparados com referências sobre os modelos oficiais | `npm test` |

Os dados de teste dos e2e usam o prefixo de `e2e/helpers/supabaseAdmin.ts` e são apagados ao fim.

---

## 9. Implantação e dados existentes

- **Ordem de deploy:** migration de expansão → app → conferência → migration de contração.
- **Prestações existentes:** recebem organização (P0.2), arquivos migrados (P0.3) e regime (P1.2). Cada passo deixa registro no histórico da prestação.
- **Visibilidade:** até o fim da fase 4, só super admin e organizações com cortesia; a liberação pública acontece com a cobrança (fase 5).
- **Acompanhamento:** erros das edge functions, custo de IA por organização e por prestação, falhas da sincronização do Salic e das rotinas agendadas.
- **Volta atrás:** toda migration de expansão é compatível com o código anterior; a contração só entra depois de uma semana sem erro.

---

## 10. Riscos de execução

| Risco | Mitigação |
|---|---|
| O banco de produção diverge das migrations (papéis, funções e gatilhos que nunca rodaram) | Dump e diff antes da P0.1; migrations com `if not exists`; papéis resolvidos antes da P0.6 |
| A cadeia de migrations não sobe num banco novo | Testes de RLS no branch do Supabase até a cadeia ser corrigida |
| Migração de arquivos perder documentos | Ensaio antes, script idempotente, cópia antes de apagar, contagem antes e depois |
| A organização atual só é conhecida no navegador | Bloqueio do servidor por "tem acesso em alguma organização"; isolamento real no RLS |
| A API do Salic ficar fora do ar ou mudar | Criação manual sempre possível; o vigia normativo acompanha mudanças nos campos |
| As duas cópias do webhook do Stripe se separarem | Mudança sempre nas duas; teste de paridade que já existe |
| A fase 0 parecer "parada" para o negócio | M0 com uma organização piloto real usando o módulo atual corrigido |

---

## 11. Primeira semana

| Dia | Pessoa A | Pessoa B |
|---|---|---|
| 1 | Pré-requisitos 1 e 2: dump, diff e inventário | Pré-requisito 3: papéis de equipe (tarefa separada) |
| 2 | P0.1 migration de base e tipos | P0.5 migration de módulos e `organization_modulos` |
| 3 | P0.1 teste e conferência no ambiente de teste; abrir PR | P0.5 `auth_tem_modulo` e ajuste de `can_access_prestacao`; abrir PR |
| 4 | P0.2 expansão, preenchimento e gatilho | P0.6 funções de convite e vagas por módulo |
| 5 | P0.2 políticas e telas; abrir PR | P0.6 API e tela de equipe |

Com uma pessoa só, seguir a coluna A e depois a B.
