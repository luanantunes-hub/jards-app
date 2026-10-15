# PD0.4 — Inventário: como a captação está protegida no banco

> 14/10/2026. Leitura do banco de produção (só consulta, nada foi alterado) e do código da `main` (`f207f01`). Substitui a lista que o plano supunha na seção 1 e na PD0.4. Nada aqui foi aplicado.

## Resumo

- **Hoje o banco não separa os módulos.** Quem é membro de uma organização lê, pela API, contratos, contas de patrocínio, cotas, propostas, vendas, interações e contrapartidas dela, mesmo sem ter o módulo Captação. As telas escondem; o banco não.
- **Ninguém é atingido hoje.** As 155 organizações têm a Captação ativa e os 156 membros têm acesso a ela (149 admin, 6 captador, 1 proponente). Duas organizações têm também a Prestação, em cortesia. Nenhuma usa só a Prestação. O fechamento protege o que vem: organização só com Prestação ou só com Produção.
- **O plano supôs regras "por organização" nas tabelas centrais; no banco real elas são "por pessoa".** `captacoes`, `contatos`, `projetos_crm`, `atividades`, `editais_user` e `notas` só aparecem para quem as criou. As migrations de julho que as tornariam "por organização" (`20260726000012`, `20260726000022`) estão no repositório e não valem no banco. Nenhuma organização tem mais de um criador de negociação, por isso ninguém notou.
- **Proposta:** uma migration que acrescenta, em 39 tabelas comerciais, uma regra restritiva "exige o módulo Captação", sem apagar nenhuma regra existente. Mais três decisões do dono (seção 5).

## 1. Como as tabelas estão protegidas hoje

| Jeito | Como funciona | Tabelas (principais) |
|---|---|---|
| Por pessoa | `account_id = auth.uid()`: só quem criou | `captacoes`, `contatos`, `atividades`, `projetos_crm`, `editais_user`, `notas`, parte de `empresas_crm` |
| Por organização | `organization_id = ANY(auth_org_ids())`: qualquer membro, de qualquer papel e módulo | `contas_patrocinio`, `contratos`, `cotas_patrocinio`, `propostas`, `vendas_patrocinio`, `comissoes`, `planos_ativacao` e afins |
| Por vínculo de membro | `exists (select 1 from organization_members …)`: o mesmo efeito, escrito de outro jeito | `crm_interacoes`, `crm_followups`, `compromissos_cliente`, `saude_*` |
| Com módulo | `auth_tem_modulo(organization_id, 'prestacao')`, em regras restritivas | `prestacoes_contas`, `prestacao_fornecedores`, `prestacao_fornecedor_documentos` |

`auth_tem_modulo(org, modulo)` já existe, vale para qualquer módulo e dá passe livre ao super admin. Ela exige que o módulo esteja em `organizations.modulos_ativos` **e** em `organization_members.modulos_acesso`. Hoje todo mundo tem `captacao` nos dois, e o gatilho que mantém `modulos_ativos` só mexe no módulo do contrato. A Captação não tem contrato em `organization_modulos` (só a Prestação tem), então o gatilho nunca a remove.

## 2. O que será fechado (exige o módulo Captação)

"Fora da Captação" é quem lê a tabela sem ser página ou função da própria Captação. Em todas as linhas abaixo a resposta é **ninguém**, salvo o que está anotado.

| Grupo | Tabela | Linhas | Proteção hoje | Anotação |
|---|---|---:|---|---|
| Dinheiro e contratos | `contas_patrocinio` | 7 | organização | |
| | `contratos` | 7 | organização | |
| | `cotas_patrocinio` | 9 | organização | a regra de `projeto_orcamento_rateios` consulta esta tabela (tela de orçamento do projeto, da Captação) |
| | `propostas` | 4 | organização | `proposta_visualizacoes` e o bucket `propostas` consultam esta tabela |
| | `vendas_patrocinio` | 2 | organização (só leitura) | |
| | `comissoes` | 0 | organização | |
| | `ciclos_comerciais` | 0 | organização | |
| | `renovacoes_cliente` | 1 | organização | |
| | `renovacao_arvores_decisao` | 0 | organização | |
| | `previsoes_renovacao` | 1 | vínculo | |
| | `participacoes_agencia_cliente` | 2 | organização | |
| Relacionamento | `crm_interacoes` | 24 | vínculo | |
| | `crm_followups` | 13 | vínculo | |
| | `crm_duvidas` | 0 | vínculo | |
| | `emails` | 0 | vínculo | |
| | `compromissos_cliente` | 5 | vínculo | a Produção vai ler pela ponte da fase 9, por função, não pela tabela |
| | `objetivos_parceria`, `planos_parceria` | 0, 0 | vínculo | |
| | `saude_conta`, `saude_parceria_criterios` | 0, 0 | vínculo | |
| | `saude_parceria_scorecards` | 24 | vínculo | |
| Ativação do patrocínio | `planos_ativacao` e seis `ativacao_*` (`acoes`, `acao_atividades`, `evidencias`, `objetivos`, `orcamento_itens`, `publicos`) | 0 cada | organização | `vw_planos_ativacao_resumo` lê com as permissões de quem consulta |
| Equipe externa | `atribuicoes` | 6 | organização + vínculo | |
| | `atribuicao_notas`, `workspace_acoes`, `projeto_workspace_acoes` | 2, 2, 0 | vínculo | regras e bucket `workspace-anexos` consultam `atribuicoes` |
| | `captadores`, `captador_workspaces` | 10, 4 | vínculo | |
| | `captador_oportunidade_etiquetas`, `captador_proponente` | 310, 0 | vínculo | |
| | `captador_score_criterios`, `proponente_score_criterios` | 5, 5 | organização | |
| Outros | `marcos_captação` | 0 | organização | |

Total: **39 tabelas**.

### Por pessoa, só por consistência (sem vazamento hoje)

`captacoes` (77 linhas), `contatos` (71) e `editais_user` (138) já só aparecem para quem as criou. Incluí-las faz a regra valer inteira ("dado comercial exige a Captação"), com um custo: quem perder o módulo deixa de ver até o que criou. Recomendação: incluir. As duas leituras da Prestação nesse grupo são `captacoes` em `NovaPrestacaoModal` e `LinksDoPatrocinador`, só úteis em organização com Captação (em organização sem ela a lista fica vazia; confirmar no preview que a tela explica em vez de quebrar).

## 3. O que fica como está

- **Compartilhadas entre módulos** (a Prestação e a Produção leem): `projetos_crm` (138), `atividades` (27), `notas` (11), `empresas_crm` (188, referência), `proponentes` (9), `documentos` (3 linhas; 27 arquivos de código da Prestação), `projeto_orcamento_itens` (12), `resultados_projeto` (0), `tarefas` (0, legado).
- **Configuração e plataforma:** `config_org`, `atividade_tipos`, `crm_taxonomia_opcoes`, `etiquetas`, `funil_etapas_removidas`, `user_preferences`, `dashboard_preferences`, `notificacoes`, `calendar_connections`, `email_connections`, `organization_members`, `organization_invitations`, `organization_modulos`, `organization_seats`, `organization_seat_purchases`, `admin_audit_logs`, `mcp_api_key_usage`, `creditos`, `desbloqueios`, `solicitacoes_pesquisa_empresa`, `solicitacoes_transferencia`, `contribuicoes`, `contribuicoes_confirmacoes`, `editais_inscritos` (legado, 0 linhas), `projeto_incentivo_sites_usuario`.
- **Já com regra de módulo:** `prestacoes_contas`, `prestacao_fornecedores`, `prestacao_fornecedor_documentos`.
- **Sem regra para o navegador (só funções e a chave de serviço acessam):** `historico_captações` (20 linhas), `historico_creditos`, `notification_events`, `piloto_organizacoes`, `prestacao_ia_chamadas`, `_org_insert_counters`.

## 4. Quem depende dessas tabelas fora da Captação

- **Telas da Prestação:** só `captacoes` e `projetos_crm` (`NovaPrestacaoModal`, `LinksDoPatrocinador`). Nenhuma lê as demais.
- **Banco, a serviço da Prestação:** o gatilho `fn_prestacao_organizacao` consulta `captacoes` e `projetos_crm` com as permissões de quem grava. Com a regra nova, quem não tem a Captação não enxerga a negociação e a checagem "a negociação é de outra organização" é pulada. Já é assim hoje para negociação de outra pessoa (regra "por pessoa"), então a PD0.4 não piora; vale tornar a função `security definer` numa entrega pequena à parte.
- **Funções que rodam com as permissões de quem chama** e leem tabelas comerciais, todas da própria Captação: `fn_create_activation_plan`, `fn_customer_success_automations`, `fn_receita_empresa`, `fn_score_empresa`, `fn_sync_empresa_tipo`, `fn_validate_activation_child`, `fn_validate_activation_commitment`, `fn_validate_plano_ativacao_relations`. E três visões com `security_invoker`: `vw_contas_carteira`, `vw_eficacia_canais`, `vw_planos_ativacao_resumo`.
- **Fora do alcance das regras** (já exigem admin e Captação no código ou passam por função): o MCP do Claude e do ChatGPT (usa a chave de serviço, com `papel = admin` e `captacao` em `modulos_acesso`), o link público do patrocinador `/r/[token]` (só as funções `fn_relatorio_patrocinador_*`) e as funções de borda (chave de serviço).

## 5. Decisões do dono (15/10/2026: as três recomendações foram aceitas)

1. **"Por pessoa" ou "por organização" nas tabelas centrais.** A Produção e a Prestação em equipe precisam que o projeto apareça para a organização inteira; hoje só aparece para quem o criou. Recomendação: passar `projetos_crm`, `atividades`, `notas`, `captacoes`, `contatos` e `editais_user` para "por organização" numa entrega separada (PD0.4b), agora, porque nenhuma organização tem dado de mais de um criador e a mudança é invisível hoje; depois dela fica mais difícil. Muda o que cada pessoa da equipe enxerga: passa a ver o que os colegas criaram.
2. **Papéis externos.** Os 6 captadores e o 1 proponente são membros da organização e, pelas regras de hoje, também leem contratos, propostas, vendas e comissões dela pela API. Recomendação: nas tabelas de dinheiro e contratos (primeiro grupo da seção 2), a regra restritiva exige o módulo **e** que o membro não seja captador nem proponente. Pelo levantamento do código, nenhuma tela de `workspace-captador` ou `workspace-proponente` lê essas tabelas (o proponente usa `fn_proponente_projeto_detalhe`); confirmar no e2e do captador.
3. **Incluir as três tabelas "por pessoa"** (`captacoes`, `contatos`, `editais_user`) na regra de módulo. Recomendação: sim.

## 6. Como será feito e testado

- Migration `producao_captacao_isolada.sql`, só de expansão: uma regra restritiva por tabela (`for all to authenticated`, `using` e `with check`), no molde das regras da Prestação, mais uma função auxiliar `auth_org_ids_com_modulo(modulo)` (`security definer`, `stable`, `revoke … from public, anon`) que devolve de uma vez as organizações em que a pessoa tem o módulo, para a regra não chamar a função por linha. Super admin continua com acesso total.
- `supabase/tests/captacao_isolada.test.sql` (pgTAP): membro só com a Prestação e membro só com a Produção não leem nem escrevem nas 39 tabelas; membro com a Captação fica como está; super admin fica como está; captador e proponente não leem as tabelas de dinheiro (se a decisão 2 passar).
- Teste de texto `tests/producao-captacao-isolada-sql.test.ts`: a lista de tabelas da migration é a mesma deste documento; não há DROP; função nova revoga de `public` e `anon`.
- **Ensaio no banco de produção, numa transação desfeita** (a migration e o pgTAP rodam juntos e terminam com um erro proposital que desfaz tudo): um branch do Supabase não serve, porque o banco real não se reconstrói só com as migrations do repositório (o histórico dele começa em 20260826).
- Só depois do "ok" do dono: aplicar a migration e conferir os quatro perfis (só Captação, só Prestação, só Produção, Captação e Produção). Hoje só o primeiro existe nos dados; os outros nascem no ambiente de e2e (PD0.3).

## 7. Resultado do ensaio (15/10/2026)

A migration `producao_captacao_isolada` e o teste `captacao_isolada.test.sql` rodaram juntos no banco de produção, numa transação desfeita (nada ficou gravado), com a migration duas vezes para conferir que reaplicar não faz nada.

- **Teste de acesso:** 28 de 28. As 42 regras existem, restritivas, para todos os comandos e só para quem está logado; só as 11 de dinheiro e contratos excluem captador e proponente; toda tabela com `organization_id` está classificada; as funções auxiliares não executam para o visitante.
- **Dados reais, antes e depois:** a contagem de linhas visíveis em cada uma das 42 tabelas foi feita **como cada pessoa real** (149 pessoas, 6.258 comparações, nenhum erro). Mudaram **26** comparações, todas em tabelas de dinheiro e contratos e só para quem tem papel de captador ou proponente numa organização: 4 pessoas (3 captadores e 1 captador e proponente) deixam de ler as linhas de `contas_patrocinio` (4 e 5), `contratos` (4 e 5), `cotas_patrocinio`, `participacoes_agencia_cliente`, `propostas`, `vendas_patrocinio`, `previsoes_renovacao` e `renovacoes_cliente` da organização em que atuam como externas. Para todos os admins e colaboradores nada mudou, nem nas demais tabelas.
- **Registros antigos sem organização:** a migration liga os 3 contatos e a negociação que estavam sem organização à única organização da conta que os criou.
- **Aplicar e conferir:** depois de aplicada, os quatro perfis (só Captação, só Prestação, Captação e Prestação, e o externo) são conferidos de novo com a conta de teste, e o histórico do Supabase confirma a versão aplicada.

### Observação fora do escopo

`fn_sync_empresa_tipo` (gatilho de `contas_patrocinio`, `captacoes` e `editais_user`) roda com as permissões de quem grava e lê `contas_patrocinio`. Com a regra nova, um captador que grave numa negociação não enxerga a conta e poderia marcar a empresa como "ex-cliente"; a atualização de `empresas_crm` já é barrada para quem não a criou, então o efeito prático é nulo, mas vale torná-la `security definer` junto com a PD0.4b (passar as tabelas centrais para "por organização").

## 8. Aplicada (15/10/2026)

Migration `20261015023043_producao_captacao_isolada` aplicada no banco de produção, com o ok do dono.

- **No catálogo:** 42 regras restritivas (`for all`, só para quem está logado), 11 com a exclusão de externos; nenhum registro sem organização nas três tabelas "por pessoa" (os 3 contatos e a negociação antigos foram ligados à organização da conta); as funções auxiliares não executam para o visitante.
- **Teste de acesso rodado sobre o banco já migrado:** 28 de 28.
- **Dados reais depois de aplicar:** 149 pessoas em 22 tabelas (3.278 comparações), contando o que cada pessoa vê contra o que as linhas das organizações dela mandam ver. 3.274 iguais. As 4 diferentes são de uma só pessoa, o super admin, que é captador em duas organizações e continua vendo as tabelas de dinheiro delas, como previsto (a regra dá acesso total ao super admin).
- **Workspaces dos externos:** as 13 funções que as telas do captador e do proponente chamam são `security definer` e nenhuma lê as tabelas de dinheiro.

## 9. PD0.4b — as tabelas centrais por organização (15/10/2026)

Decisão do dono: passar `captacoes`, `contatos`, `editais_user`, `projetos_crm` e `atividades` de "por pessoa" para "por organização", porque a equipe, a Prestação e a Produção em mais de uma pessoa dependem disso (um colaborador não via nem o projeto do admin). É a primeira metade (expansão): as regras "por pessoa" ficam e a contração vem depois.

| | Negociações, contatos, inscrições | Projetos e atividades |
|---|---|---|
| **Lê** | membro interno com o módulo Captação | membro interno com qualquer módulo |
| **Edita** | o mesmo, menos o leitor | o mesmo, menos o leitor |
| **Apaga** | admin da organização (ou quem criou) | admin da organização (ou quem criou) |
| **Cria** | como hoje: `account_id` é quem está logado | como hoje, mais a guarda abaixo |

- **Interno** é quem não é captador nem proponente: eles seguem vendo só o que criaram. As notas (`notas`) herdam a leitura do registro a que pertencem, então passam a aparecer para a equipe sem mudança; `empresas_crm` já era legível pela equipe.
- **Guarda de escrita** em projetos e atividades (restritiva): com a leitura por organização, quem gravasse numa organização alheia poria a linha na frente do outro inquilino. A guarda exige que a organização seja uma das de quem grava. Linha sem organização ainda é aceita na criação enquanto o app antigo circula; a contração tira isso.
- **Super admin** não ganha leitura de outras organizações: a função auxiliar `auth_org_ids_equipe(modulo, nivel)` não tem passe livre para ele.
- **Registros antigos sem organização:** 1 atividade de conta com uma só organização foi ligada a ela; 3 projetos de setembro de uma conta com três organizações ficam como estão (não se adivinha em qual).
- **Código:** a tela da negociação criava atividade sem `organization_id`; passa a levar a organização da negociação.

**Ensaio (transação desfeita, no banco de produção):** teste de acesso 38 de 38, migration reaplicável e, com dados reais, 149 pessoas em 5 tabelas (745 comparações) sem nenhuma diferença: hoje ninguém passa a ver nada novo, porque nenhuma organização tem linhas de mais de uma pessoa nessas tabelas.

**Fica para depois**
- **Contração (PD0.4c):** exigir organização na criação e apagar as regras "por pessoa" que viram redundantes.
- **`fn_sync_empresa_tipo`** roda com as permissões de quem grava: quando um colega altera uma negociação, a atualização do tipo da empresa (cliente ativo ou ex-cliente) só vale se ele tiver criado a empresa. Tornar a função `security definer`, com a conferência da organização, é uma entrega pequena à parte.
- **Leitor** ainda cria linhas próprias pela regra antiga; hoje a tela é que o impede.
