# Plano de implementação — Plano de Ativação do Patrocínio

## 1. Decisão arquitetural

Criar um novo agregado de domínio chamado **Plano de Ativação**, vinculado obrigatoriamente à conta do patrocinador e, conforme o contexto, ao projeto, à cota, ao contrato e à negociação que originou a parceria.

O recurso não deve criar sistemas paralelos de tarefas, calendário, compromissos, arquivos ou prestação de contas. Ele coordena esses objetos existentes:

- `planos_parceria` continua representando a estratégia contínua da relação com o patrocinador;
- `planos_ativacao` representa uma execução concreta, com período, projeto, cota e orçamento;
- `atividades` continua sendo a fonte de verdade para tarefas, responsáveis, datas, Lista, Calendário, Gantt e sincronização Google/Microsoft;
- `compromissos_cliente` continua representando direitos e entregáveis prometidos;
- `documentos` e o bucket privado `documentos` continuam armazenando arquivos;
- `prestacoes_contas` continua sendo o fechamento formal da execução;
- o orçamento produtivo do projeto permanece separado da verba de ativação.

## 2. Descobertas sobre a aplicação atual

A fundação já existe em `20260828000011_customer_success_jards.sql`:

- `planos_parceria`;
- `objetivos_parceria`;
- `compromissos_cliente`;
- `saude_conta`;
- `previsoes_renovacao`;
- vínculos de atividades com conta, contrato, compromisso e plano da parceria;
- automação de atividades para compromissos e renovação.

Também já existem:

- cotas com valor, contrapartidas, status e negociação vinculada;
- orçamento produtivo do projeto e rateio por cota;
- documentos privados por organização;
- calendário e Gantt de atividades;
- sincronização de atividades com Google Calendar e Microsoft;
- notificações com deduplicação, prioridade, prazos e Realtime;
- prestação de contas com orçamento, atividades, comprovantes e relatório no frontend.

### Pendência de engenharia antes do desenvolvimento

As tabelas de prestação de contas aparecem no frontend e nos tipos, mas as migrations responsáveis por criar `prestacoes_contas`, `prestacao_itens`, `prestacao_atividades`, `prestacao_atividade_evidencias` e tabelas relacionadas não foram localizadas no repositório. Antes de integrar o novo recurso, o schema remoto deve ser inspecionado e essas migrations devem ser trazidas para controle de versão.

## 3. Modelo de domínio

### 3.1 Novas tabelas

#### `planos_ativacao`

Agregado raiz.

- `id uuid primary key`
- `organization_id uuid not null`
- `account_id uuid not null`
- `conta_patrocinio_id uuid not null`
- `projeto_id uuid not null`
- `cota_id uuid null`
- `contrato_id uuid null`
- `captacao_id uuid null`
- `nome text not null`
- `descricao text null`
- `responsavel_id uuid null`
- `status text`: `rascunho | planejado | em_execucao | concluido | arquivado`
- `data_inicio date null`
- `data_fim date null`
- `valor_direito_snapshot numeric(15,2) null`
- `moeda char(3) default 'BRL'`
- `created_at`, `updated_at`

O snapshot financeiro preserva o valor acordado mesmo se a cota ou contrato for editado posteriormente.

#### `ativacao_publicos`

- `plano_id`
- `nome`
- `descricao`
- `necessidade`
- `prioridade`: `primario | secundario`
- `ordem`

#### `ativacao_objetivos`

- `plano_id`
- `titulo`
- `descricao`
- `indicador`
- `unidade`
- `meta`
- `valor_atual`
- `prazo`
- `status`: `nao_iniciado | em_andamento | atingido | em_risco | cancelado`

Não reutilizar `objetivos_parceria`: aqueles objetivos pertencem à relação contínua; estes pertencem a uma ativação específica.

#### `ativacao_acoes`

- `plano_id`
- `objetivo_id null`
- `titulo`
- `descricao`
- `canal text null`
- `responsavel_id null`
- `data_inicio`, `data_fim`
- `status`: `nao_iniciada | em_andamento | bloqueada | concluida | cancelada`
- `valor_planejado numeric(15,2)`
- `ordem`

O status executivo deve ser derivável das tarefas sempre que possível. Não manter uma segunda conclusão incompatível com `atividades.feita`.

#### `ativacao_acao_atividades`

Relação N:N entre ação e atividade.

- `acao_id`
- `atividade_id`
- unique (`acao_id`, `atividade_id`)

Essa abordagem permite que uma ação tenha diversas tarefas e que a mesma atividade coordenadora sirva mais de uma ação quando necessário.

#### `ativacao_orcamento_itens`

- `plano_id`
- `acao_id null`
- `categoria`
- `descricao`
- `pagador`: `patrocinador | proponente | compartilhado | terceiro`
- `valor_planejado numeric(15,2)`
- `valor_realizado numeric(15,2)`
- `data_prevista`, `data_realizada`
- `status`: `previsto | aprovado | comprometido | pago | cancelado`
- `ordem`

Esse orçamento é separado de `projeto_orcamento_itens`, pois mede a verba usada para ativar o direito adquirido, e não o custo de produção do projeto.

#### `ativacao_evidencias`

- `plano_id`
- `acao_id null`
- `compromisso_id null`
- `documento_id null`
- `tipo`: `arquivo | link | imagem | video | metrica | declaracao`
- `url_externa null`
- `titulo`
- `descricao`
- `capturada_em`
- `status`: `rascunho | enviada | aprovada | rejeitada`
- `aprovada_por null`
- `aprovada_em null`

### 3.2 Tabelas existentes a estender

#### `compromissos_cliente`

Adicionar:

- `plano_ativacao_id`;
- `acao_ativacao_id`;
- `cota_id`;
- `evidencia_obrigatoria boolean default false`;
- `origem text`: `manual | cota | contrato | importacao`.

#### `documentos`

Adicionar vínculos opcionais:

- `projeto_id`;
- `conta_patrocinio_id`;
- `contrato_id`;
- `plano_ativacao_id`.

O `captacao_id` deixa de ser o único contexto possível, mas o bucket privado e as políticas por organização são preservados.

### 3.3 View agregada

Criar `vw_planos_ativacao_resumo` com `security_invoker = true` para evitar consultas N+1:

- ações totais e concluídas;
- tarefas pendentes e atrasadas;
- compromissos pendentes, aprovados e vencidos;
- evidências pendentes e aprovadas;
- orçamento planejado e realizado;
- próxima data relevante;
- percentual de progresso calculado.

## 4. Invariantes e RLS

Toda migration deve ser idempotente e aplicar RLS imediatamente.

Regras:

1. Conta, projeto, cota, contrato, captação e plano precisam pertencer à mesma organização.
2. A cota precisa pertencer ao projeto informado.
3. O contrato precisa pertencer à conta informada.
4. A captação, quando presente, precisa relacionar a empresa e o projeto correspondentes.
5. `account_id` deve ser `auth.uid()` em inserts feitos pelo cliente.
6. Administrador e colaborador podem criar e editar.
7. Leitor pode apenas consultar.
8. Captador externo não recebe acesso por padrão.
9. Aprovação de evidência deve registrar usuário e horário.
10. Exclusões relevantes devem preferir arquivamento; documentos já aprovados não devem ser apagados silenciosamente.

A aplicação hoje possui policies que permitem gerenciamento a qualquer membro da organização em algumas tabelas de Customer Success. Para esta feature, a policy deve verificar o papel em `organization_members`, não apenas pertencimento.

## 5. Experiência do usuário

### 5.1 Pontos de entrada

#### Conta do patrocinador

Adicionar aba **Ativações** em `/contas-patrocinio/[id]`:

- planos ativos e anteriores;
- projeto, cota e contrato;
- progresso, orçamento e próxima entrega;
- botão `Novo plano de ativação`.

Este é o ponto de entrada principal, pois a conta representa a relação com o patrocinador.

#### Projeto

Adicionar aba ou bloco **Ativações** em `/projetos/[id]`:

- visão agregada dos planos ligados ao projeto;
- patrocinador e cota;
- total de verba de ativação;
- entregáveis pendentes;
- acesso ao workspace correspondente.

#### Cota vendida

Quando uma cota mudar para `vendida`, oferecer a ação `Criar plano de ativação`. Não criar automaticamente: a equipe precisa confirmar contrato, período e responsável.

### 5.2 Criação guiada

Evitar um modal grande. Usar quatro passos com salvamento como rascunho:

1. **Contexto:** conta, projeto, cota, contrato e período.
2. **Estratégia:** objetivos, públicos e critérios de sucesso.
3. **Recursos:** valor do direito e verba planejada para ativação.
4. **Entregáveis:** importar contrapartidas da cota e revisar responsáveis/prazos.

### 5.3 Workspace `/ativacoes/[id]`

Abas:

1. **Resumo** — progresso, alertas, orçamento e próximos marcos.
2. **Estratégia** — objetivos, públicos e critérios de sucesso.
3. **Ações** — iniciativas, canais, responsáveis e tarefas.
4. **Orçamento** — verba planejada/realizada e pagador.
5. **Entregáveis** — direitos, compromissos, situação e aprovação.
6. **Evidências** — arquivos, links, métricas e validação.

As tarefas do plano aparecem automaticamente em `/atividades` e nas views Lista, Calendário e Gantt. Não criar calendário próprio.

## 6. Automações

1. Cota vendida: sugerir criação do plano.
2. Importação de contrapartidas: criar compromissos em rascunho para revisão.
3. Tarefa com data: permitir sincronização Google/Microsoft já existente.
4. Sete e três dias antes: notificar responsável por tarefa ou entregável aberto.
5. Item vencido: destacar risco no resumo; não alterar o status comercial da captação.
6. Entregável marcado como entregue sem prova obrigatória: solicitar evidência antes de aprovação.
7. Evidência enviada: notificar responsável pela aprovação.
8. Plano próximo do fim com pendências: gerar alerta de fechamento.
9. Plano concluído: oferecer criação ou vínculo com prestação de contas.

Usar `notification_events` e `fn_emit_notification`, com `dedupe_key`, em vez de inserir notificações diretamente.

## 7. Orçamento e indicadores

### Valores separados

- **Valor do direito:** valor da cota ou do contrato, salvo como snapshot.
- **Verba de ativação planejada:** soma dos itens planejados.
- **Verba de ativação realizada:** soma dos itens realizados.
- **Orçamento produtivo do projeto:** permanece em `projeto_orcamento_itens`.
- **Execução formal:** permanece em `prestacao_itens`.

### Indicadores do resumo

- progresso de tarefas;
- progresso de entregáveis;
- evidências aprovadas versus obrigatórias;
- verba planejada versus realizada;
- razão verba de ativação/valor do direito;
- itens vencidos;
- próximos sete dias;
- objetivos em risco.

A razão de ativação deve ser apenas informativa. Não definir um percentual universal como recomendação automática.

## 8. Sequência de entrega

### Fase 0 — Fundação, semana 1

- confirmar o schema remoto de prestação;
- criar migrations locais faltantes;
- fechar estados e invariantes;
- criar tipos TypeScript;
- definir telemetria e auditoria.

### Fase 1 — Núcleo do plano, semanas 2–3

- migrations de planos, públicos e objetivos;
- modal guiado de criação;
- lista na conta do patrocinador;
- resumo inicial;
- RLS por papel.

### Fase 2 — Ações e atividades, semanas 4–5

- ações de ativação;
- vínculo N:N com atividades;
- filtros em Atividades;
- progresso derivado;
- sync de calendário por atividade.

### Fase 3 — Entregáveis e evidências, semanas 6–7

- extensão de compromissos;
- importação das contrapartidas da cota;
- evidências e aprovação;
- pendências e notificações.

### Fase 4 — Orçamento e prestação, semanas 8–9

- orçamento de ativação;
- planejado versus realizado;
- vínculo/exportação assistida para prestação;
- validação de totais.

### Fase 5 — Hardening e piloto, semanas 10–11

- dashboard agregado;
- auditoria e histórico;
- testes de RLS, acessibilidade e concorrência;
- piloto com 3–5 planos reais;
- correções antes de liberar para todas as organizações.

Com duas frentes coordenadas — domínio/backend e workspace/frontend — o calendário pode cair para 7–9 semanas. A estimativa não inclui integrações novas com fornecedores externos.

## 9. Arquivos previstos

### Criar

- `supabase/migrations/…_planos_ativacao.sql`
- `supabase/migrations/…_ativacao_integracoes.sql`
- `lib/ativacao/queries.ts`
- `lib/ativacao/metrics.ts`
- `components/ativacao/ActivationWorkspace.tsx`
- `components/ativacao/ActivationSummary.tsx`
- `components/modals/NovoPlanoAtivacaoModal.tsx`
- `app/(dashboard)/ativacoes/[id]/page.tsx`
- `tests/ativacao-domain.test.ts`

### Modificar

- `lib/supabase/types.ts`
- `app/(dashboard)/contas-patrocinio/[id]/page.tsx`
- `app/(dashboard)/projetos/[id]/page.tsx`
- `app/(dashboard)/atividades/page.tsx`
- `components/modals/NovaAtividadeModal.tsx`
- `app/(dashboard)/prestacoes/[id]/page.tsx`
- sistema de notificações e automações de prazo.

## 10. Testes obrigatórios

- domínio: estados, snapshots, totais e vínculos válidos;
- RLS: isolamento entre organizações e matriz de papéis;
- integração: atividades, calendário, compromissos, documentos e prestação;
- concorrência: duas edições sem perda silenciosa;
- UX: rascunho, retomada, erros, vazios e acessibilidade por teclado;
- performance: resumo em uma view e evidências paginadas;
- storage: arquivos privados e caminhos iniciados por `organization_id`;
- regressão: Customer Success, projeto, cota e prestação continuam funcionando.

## 11. Critérios de sucesso do piloto

- primeiro plano ativo criado sem suporte técnico;
- pelo menos 90% das ações com responsável e data;
- entregáveis obrigatórios com evidência rastreável;
- nenhum total financeiro divergente;
- nenhum vazamento multi-tenant nos testes;
- redução de entregas vencidas ou sem prova;
- uso recorrente do resumo durante a execução;
- aprovação da equipe sobre a separação entre orçamento produtivo e verba de ativação.

## 12. Recomendação final

Começar pela **conta de patrocínio**, e não pelo projeto. O patrocinador é o dono da relação; projeto, cota e contrato contextualizam uma ativação específica. O projeto recebe uma visão agregada, mas a fonte de verdade fica em `planos_ativacao`.

O primeiro incremento deve terminar na criação do plano, públicos, objetivos e ações ligadas às atividades. Orçamento, evidências e prestação entram em ondas seguintes para que o MVP gere valor cedo sem comprometer a integridade financeira.
