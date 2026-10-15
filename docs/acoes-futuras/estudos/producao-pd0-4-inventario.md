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

## 5. Decisões do dono

1. **"Por pessoa" ou "por organização" nas tabelas centrais.** A Produção e a Prestação em equipe precisam que o projeto apareça para a organização inteira; hoje só aparece para quem o criou. Recomendação: passar `projetos_crm`, `atividades`, `notas`, `captacoes`, `contatos` e `editais_user` para "por organização" numa entrega separada (PD0.4b), agora, porque nenhuma organização tem dado de mais de um criador e a mudança é invisível hoje; depois dela fica mais difícil. Muda o que cada pessoa da equipe enxerga: passa a ver o que os colegas criaram.
2. **Papéis externos.** Os 6 captadores e o 1 proponente são membros da organização e, pelas regras de hoje, também leem contratos, propostas, vendas e comissões dela pela API. Recomendação: nas tabelas de dinheiro e contratos (primeiro grupo da seção 2), a regra restritiva exige o módulo **e** que o membro não seja captador nem proponente. Pelo levantamento do código, nenhuma tela de `workspace-captador` ou `workspace-proponente` lê essas tabelas (o proponente usa `fn_proponente_projeto_detalhe`); confirmar no e2e do captador.
3. **Incluir as três tabelas "por pessoa"** (`captacoes`, `contatos`, `editais_user`) na regra de módulo. Recomendação: sim.

## 6. Como será feito e testado

- Migration `producao_captacao_isolada.sql`, só de expansão: uma regra restritiva por tabela (`for all to authenticated`, `using` e `with check`), no molde das regras da Prestação, mais uma função auxiliar `auth_org_ids_com_modulo(modulo)` (`security definer`, `stable`, `revoke … from public, anon`) que devolve de uma vez as organizações em que a pessoa tem o módulo, para a regra não chamar a função por linha. Super admin continua com acesso total.
- `supabase/tests/captacao_isolada.test.sql` (pgTAP): membro só com a Prestação e membro só com a Produção não leem nem escrevem nas 39 tabelas; membro com a Captação fica como está; super admin fica como está; captador e proponente não leem as tabelas de dinheiro (se a decisão 2 passar).
- Teste de texto `tests/producao-captacao-isolada-sql.test.ts`: a lista de tabelas da migration é a mesma deste documento; não há DROP; função nova revoga de `public` e `anon`.
- **Ensaio no banco de produção, numa transação desfeita** (a migration e o pgTAP rodam juntos e terminam com um erro proposital que desfaz tudo): um branch do Supabase não serve, porque o banco real não se reconstrói só com as migrations do repositório (o histórico dele começa em 20260826).
- Só depois do "ok" do dono: aplicar a migration e conferir os quatro perfis (só Captação, só Prestação, só Produção, Captação e Produção). Hoje só o primeiro existe nos dados; os outros nascem no ambiente de e2e (PD0.3).
