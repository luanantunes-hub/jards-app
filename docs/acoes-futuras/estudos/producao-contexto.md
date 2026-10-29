# Módulo de produção — contexto para continuar

> 15/10/2026. Ponto de partida para quem continua o módulo de produção numa sessão local, com acesso ao Supabase. Leia isto antes do plano.

## Onde está cada coisa

| Documento | Para quê |
|---|---|
| [estudo-modulo-producao.md](./estudo-modulo-producao.md) | A ideia, o mapa de funcionalidades e as referências estudadas (o quê e por quê) |
| [plano-implementacao-modulo-producao.md](./plano-implementacao-modulo-producao.md) | As entregas (PD0.1, PD0.2…), a ordem, os aceites, os riscos e as decisões do dono (como, em que ordem, em quais PRs) |
| Este arquivo | O que já foi feito, o que vem agora e os cuidados que não estão óbvios no plano |

## A visão do dono, em uma frase

Um módulo de produção **robusto**, para qualquer gênero e porte (espaço cultural que recebe, show e teatro que circulam, festival, exposição, audiovisual, formação), em que **produção é operação**: programação, pessoas, acordos com terceiros, logística, o dia, o dinheiro da produção, parceiros e mapas. A prestação de contas só recebe o que a produção registra; ela não é o centro. O dono rejeitou explicitamente uma versão "pobre", centrada em prestação.

Referências de que ele gostou: SystemOne (a data como página única), Eventival (pessoas e hospitalidade), Saturation (orçamento vivo), Bizzabo (portal e retorno do patrocinador). Ele pediu também mapa de palco, inventário, checklist de transporte e cálculo de combustível por modelo de veículo.

## O que já está na main

| Entrega | O que foi feito | Onde |
|---|---|---|
| PD0.2 | A produção como terceiro módulo, **escondida para todos** até a organização tê-la ativa: `ModuloId`, `MODULOS`, `MODULOS_EM_CONSTRUCAO`, `INICIO_DO_MODULO`, `moduloVisivel`; menu e título de `/producoes`; o seletor não mostra módulo em construção (mas mantém o módulo aberto); externos não recebem módulo além da captação; teste que barra listas novas de módulos escritas à mão | `lib/modulos.ts`, `lib/equipe-modulos.ts`, `lib/navigation/rotas.ts`, `app/(dashboard)/layout.tsx`, `tests/modulos.test.ts`, `tests/modulos-listas.test.ts` |
| PD0.12 | Catálogo de 14 tipos de produção com vocabulário (o nome da temporada vem do formato), modelos de dia (com refeição, dia de viagem e folga para quem circula) e a regra de painéis por data (sinais valem para qualquer tipo; painel com conteúdo não some; dinheiro só com permissão) | `lib/producao/vocabulario.ts`, `lib/producao/porte.ts`, `tests/producao-vocabulario.test.ts` |

Nenhuma tela nova está visível: o banco ainda não aceita `producao` (isso é a PD0.1).

## Decisões do dono já tomadas (15/10/2026)

- Começar a fase 0 pelas entregas que não dependem do banco (feito).
- **Isolar no banco os dados comerciais da captação** de quem não tem o módulo.
- Lista ampla de tipos (os 14 do catálogo).
- Acesso limitado às temporadas e espaços em que a pessoa está vinculada, como opção por membro.

As outras decisões da seção 12 do plano continuam abertas: preço, teste grátis, pilotos, fornecedores, funil de venda de datas, provedores pagos, política de dados pessoais.

## Próximos passos, em ordem

### 1. Pré-requisito 1: ler o banco de produção (precisa do Supabase)

Rodar no editor SQL ou pelo conector, só leitura:

```sql
-- nomes reais das 4 regras de módulo (PD0.1)
select conrelid::regclass as tabela, conname, pg_get_constraintdef(oid)
from pg_constraint
where conname ilike '%modulo%' and contype = 'c';

-- texto vigente das regras do bucket documentos (PD0.14)
select policyname, cmd, permissive, qual, with_check
from pg_policies where schemaname = 'storage' and tablename = 'objects';

-- regras das tabelas da captação (PD0.4)
select tablename, policyname, cmd, permissive, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('captacoes','contatos','empresas_crm','projetos_crm','atividades','contas_patrocinio','contratos','cotas_patrocinio','propostas','vendas_patrocinio','crm_interacoes');

-- extensões disponíveis (pg_cron, pg_net, btree_gist)
select extname, extversion from pg_extension;
```

### 2. PD0.4 — Isolar a captação no banco (prioridade: a brecha já existe hoje)

Quem tem só a Prestação lê pela API as negociações, contatos e contas de patrocínio da organização, porque `auth_org_ids()` (`supabase/migrations/20260726000012_org_rls.sql:14-23`) não olha o módulo. Detalhes no plano (PD0.4). Resumo: inventariar as tabelas comerciais, acrescentar regras **restritivas** com `auth_tem_modulo(organization_id, 'captacao')` sem apagar as existentes, manter `projetos_crm` e `atividades` por organização (a prestação e a produção leem), e pgTAP por perfil. Conferir que o link público do patrocinador (`/r/[token]`) e o cabeçalho da prestação continuam funcionando.

### 3. PD0.1 — A produção nas regras de módulo do banco

Migration separada, **aplicada à mão no editor SQL**, com DROP + ADD das 4 regras (nomes do passo 1), e outra migration sem DROP com `create or replace` de `modulos_canonicos`, `fn_conferir_modulos` e `modulo_vagas_limite`. Detalhes e aceite no plano.

**Nenhuma organização recebe a produção antes da PD0.3**, senão quem só tem a produção cai numa página não encontrada.

### 4. PD0.3 — Espaço de quem usa só a produção

Desenho já pensado, ainda sem código:

- **Ajudante de servidor comum.** O bloqueio de `app/(dashboard)/prestacoes/layout.tsx` (busca `profiles.jards_super_admin` e `organization_members.modulos_acesso, organizations(modulos_ativos, modulos_leitura)` e chama `usaModuloEmAlgumaOrganizacao`) vira um ajudante em `lib/modulos-servidor.ts`, usado pela prestação e pela produção. Em `lib/modulos.ts`, uma função pura `inicioEmAlgumaOrganizacao(superAdmin, vinculos)` devolve a página inicial do primeiro módulo que a pessoa usa em alguma organização (senão `/configuracoes`), com teste. O redirecionamento fixo para `/dashboard` do layout da prestação passa a usar essa função.
- **`app/(dashboard)/producoes/layout.tsx`**: layout de servidor no mesmo molde, com `"producao"`, sem aviso de assinatura (ele vem na PDL.2).
- **`app/(dashboard)/producoes/page.tsx`**: estrutura das páginas de lista (`<div className="flex h-full flex-col">`, `ListPageHeader` com eyebrow "Produção" e título "Agenda", `ListContent`) e `ListEmptyState` com ícone `CalendarDays`, sem ação ainda (a criação de datas vem na PD1.3).
- **Entrada sem passar pela captação**: `app/(dashboard)/dashboard/layout.tsx` (já é de servidor) redireciona quem não usa a captação em nenhuma organização para a página inicial do módulo dele. Em caso de erro na consulta, não redireciona (o layout de cliente continua cobrindo).
- **e2e por perfil**: `e2e/perfis.setup.ts` gera um `storageState` por perfil a partir de variáveis (`E2E_PERFIL_SO_CAPTACAO_EMAIL`/`_PASSWORD`, `E2E_PERFIL_SO_PRESTACAO_…`, `E2E_PERFIL_SO_PRODUCAO_…`, `E2E_PERFIL_CAPTACAO_PRODUCAO_…`) e pula o perfil sem variável; projeto `modulos` no `playwright.config.ts` com `testDir: "./e2e/modulos"`. Atenção: o projeto `setup` atual usa `testMatch: /.*\.setup\.ts/` e pegaria o novo setup; trocar para `/auth\.setup\.ts/`. Spec `e2e/modulos/producao-acesso.spec.ts`: menu, redirecionamentos e acesso direto pela URL nos quatro perfis.

### 5. Depois

Seguir a ordem do plano (seção 4, "Ordem e paralelismo"): PD0.5 e PD0.6 depois da PD0.4; PD0.7 → PD0.8 → (PD0.9, PD0.10, PD0.11, PD0.13) → PD0.14. Atualizar a tabela "Andamento" do plano a cada entrega.

## Como o dono gosta de trabalhar

- Conversa em português, direto, sem jargão técnico.
- **Testar antes de subir**: cada mudança vai primeiro para um branch, com prints das telas (computador e celular) quando houver tela, e só vai para a `main` depois que ele aprova ("ok", "pode subir").
- Interface sempre pelo `DESIGN.md` (grafite `#282525`, nunca tom sobre tom, cor só no gráfico, estado vazio que explica a próxima ação).
- Mudanças pequenas e revisadas: antes de subir, rodar uma revisão crítica do próprio diff.

## Comandos de verificação

```bash
npm run -s typecheck
npm test                        # node:test; testes ficam na raiz de tests/
npx eslint <arquivos alterados> # o lint do repositório tem erros antigos; olhe só as linhas mudadas
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-placeholder npx next build --webpack
```

pgTAP (`supabase/tests/*.test.sql`) roda no editor SQL ou pelo conector, numa transação desfeita (`scripts/testes-banco-em-bloco.ts`), antes de cada merge com tabela nova. O CI não roda pgTAP nem e2e.

## Cuidados que não estão óbvios

- As regras de módulo do banco só mudam com DROP, e o conector do Supabase não roda DROP: migration separada, aplicada no editor SQL (precedente: `20261005130100_convites_papeis.sql`).
- Função publicada não ganha parâmetro novo (sobrecarga quebra o PostgREST com PGRST203): crie função com nome novo.
- Toda função nova: `revoke execute ... from public, anon` antes do `grant`.
- "Contratos" é o contrato do patrocinador; o da produção se chama **acordo**. "Atividade" é a tarefa; o item do dia é **bloco**. "Produção" também nomeia `prestacao_producao_cmd`: nos testes, use o padrão ancorado `^producao_`.
- A produção nunca mora em tabelas `prestacao_*`: o envio da prestação trava linhas e o descarte LGPD apaga fotos. A ponte (fase 10) copia, por função que confere a trava, a guarda e o descarte, porque função `security definer` passa por cima da trava.
- O Next.js deste projeto é o 16: leia o guia em `node_modules/next/dist/docs/` antes de escrever (está no `AGENTS.md`).
