# Plano de implementação — Módulo de Prestação de Contas

> 01/10/2026. Transforma o [estudo do módulo](./plano-modulo-prestacao-de-contas.md) em entregas executáveis. O estudo diz **o quê e por quê**; este documento diz **como, em que ordem e em quais PRs**.
> As fases 0 e 1 estão detalhadas PR a PR. As fases 2 a 10 aparecem como lista de entregas e serão detalhadas no início de cada uma, com o que a fase anterior ensinar.

## 0. Como ler

- Cada entrega tem um código (`P0.3` = fase 0, entrega 3) e vira **um PR** pequeno, que pode entrar sozinho sem quebrar o que existe.
- Estimativas em **dias úteis de uma pessoa**. Elas já incluem testes e revisão.
- "Aceite" é o que precisa ser verdade para o PR ser aprovado.
- Os números de linha citados são do `main` de 01/10/2026 (commit `b5128bf`).

## Andamento

Atualizado em 05/10/2026, na branch `claude/youthful-pascal-h3kudq`. Testes: 303 passando no `npm test`. O app (PR #13) e as funções `extrair-comprovante` e `importar-orcamento` estão publicados desde 05/10/2026; `ler-extrato-pdf` (P2.2) e `consultar-fornecedor` (P2.3, versão 2 com os comprovantes da P2.3b) também, no mesmo dia.

| Entrega | Situação | O que falta para valer em produção |
|---|---|---|
| P2.3 Fornecedores com CNPJ e sanções | Feita: `prestacao_fornecedores` é o cadastro da organização (PJ, MEI, pessoa física ou estrangeiro; parte relacionada com o tipo de relação; grupo econômico). O navegador grava só as colunas da pessoa (permissão por coluna); situação na Receita, abertura, natureza, porte, CNAEs, sócios e sanções só entram pela função `consultar-fornecedor`, que confere o papel (`auth_prestacao_org_pode`, novo, igual ao da prestação no nível da organização) e grava com a chave de serviço; trocar o documento apaga a consulta anterior. A consulta junta a BrasilAPI e a consulta consolidada de pessoa jurídica do TCU, que reúne inidôneos do TCU, CNIA do CNJ, CEIS e CNEP da CGU sem chave de API; o TCU respondeu do Supabase, e o CEPIM fica para quando houver a chave da CGU. CNPJ alfanumérico validado pelo exemplo da Receita (12.ABC.345/01DE-35); o TCU ainda recebe só o numérico, então o alfanumérico fica com sanções "não respondeu". `lib/prestacao/fornecedores.ts` dá os alertas com os códigos do catálogo (situação, sanção, consulta antiga, MEI divergente, parte relacionada). Página Fornecedores no menu da prestação, com lista, busca, filtros, cadastro que já consulta, detalhe com Receita, sócios e certidões, e versão para celular; CPF mascarado na lista. Migration `20261006150000` aplicada e registrada em 05/10/2026, depois do ensaio dos testes de acesso com a tabela nova (58 de 58 sem as exclusões; 67 no arquivo completo). Conferida com o usuário de teste: consulta real do CNPJ do Banco do Brasil (ativa, CNAE 6422-1/00, 41 sócios, nada consta nas quatro certidões), pessoa física como parte relacionada, e exclusão dos dois; nada de teste ficou | Ligar o fornecedor às despesas (P2.4) para o motor de checagens (P2.7) cruzar com a data de cada documento. CEPIM com a chave da CGU, se quiser |
| P2.3b Comprovantes do fornecedor | Feita: `prestacao_fornecedor_documentos` guarda os arquivos que provam a situação do fornecedor. Cada consulta grava dois, com origem `consulta`: a certidão oficial da consulta consolidada do TCU em PDF (TCU, CNJ, CEIS e CNEP) e o comprovante gerado pela função com o que a Receita (BrasilAPI) e o TCU devolveram, hora de Brasília, a ressalva de que não substitui o cartão CNPJ e o SHA-256 das respostas. Esses só a função cria e ficam como histórico; quem edita anexa cartão CNPJ, certidão ou outro documento (origem `pessoa`, PDF ou imagem até 10 MB, com SHA-256 calculado no navegador). O cartão CNPJ da Receita tem captcha e não tem API gratuita: a tela avisa quando falta e leva ao site de emissão. Organização e documento vêm do fornecedor (gatilho); o arquivo fica em `{organização}/fornecedores/{fornecedor}/`, que o bucket lê com o módulo e escreve com o papel de editar (`auth_prestacao_pasta_org_pode`). Arquivo registrado na tabela não é substituído nem apagado no bucket (`auth_prestacao_fornecedor_arquivo_livre`): a certidão guardada não pode ser trocada. Excluir o anexo apaga a linha e depois o arquivo; excluir o fornecedor leva as linhas e então os arquivos. Migrations `20261006160000` e `20261006170000` aplicadas e registradas em 05/10/2026, depois do ensaio dos testes de acesso (63 de 63 sem as exclusões; 72 no arquivo completo, com arquivo solto e registrado na pasta de fornecedores). Conferida com o usuário de teste: consulta real do Banco do Brasil guardou os dois PDFs (hash conferido no download), trocar ou apagar o arquivo registrado e apagar a linha da consulta foram recusados, anexo de cartão e de certidão, nova consulta, exclusão do anexo e do fornecedor pela tela, sem nada de teste no banco nem no bucket | Na P2.4, pedir o cartão CNPJ e a certidão do dia na despesa e cruzar o CNAE com a rubrica |
| P2.4 Despesas com fornecedor, documento fiscal e CNAE do item | Feita: o comprovante fiscal vira a despesa (a tabela `prestacao_comprovantes` mantém o nome até a P2.11). Ganha fornecedor da mesma organização da prestação (gatilho; fornecedor com despesa não é excluído), número, série, chave de acesso (única na prestação), retenções de ISS, INSS, IRRF e outras (que não passam do valor), valor líquido calculado pelo banco, identificação do projeto no documento e a justificativa de quem segue apesar dos alertas. Tipos novos: NFS-e, cupom (NFC-e), RPCI, fatura, apólice e nota de débito. O item do orçamento ganha `cnaes_aceitos` (divisão, grupo, classe ou subclasse, em algarismos), que o agrupador passa para os itens dentro, como o grupo de custo, e que a cópia da versão leva junto. No editor do item, a busca usa a tabela da CNAE 2.3 do IBGE (1.332 subclasses com as atividades, em `public/dados/cnae-subclasses.json`, gerada por `scripts/prestacao-gerar-cnae.ts` e baixada só quando a pessoa abre a escolha), e as sugestões vêm de atalhos de orçamento cultural (ator, músico, cenografia, hospedagem, impressão…) e do texto do IBGE. `lib/prestacao/despesas.ts` lê a chave da NF-e (dígito, emitente, inclusive CNPJ alfanumérico, mês, série e número) e da NFS-e nacional, e dá os alertas com os códigos do catálogo: CNAE do fornecedor (principal e secundários) fora dos aceitos pelo item, fornecedor com situação ou sanção, sem cartão CNPJ, sem certidão de sanções até 30 dias da data, chave inválida, de outro emitente, de outro mês, de outro número ou repetida, PJ com recibo, RPA sem INSS, serviço sem retenção e documento sem identificação do projeto. Na aba Comprovantes, cada linha mostra o fornecedor e o número de alertas, e o modal Despesa reúne documento, fornecedor, item, valores e justificativa, com a conferência mudando enquanto a pessoa preenche. Migration `20261006180000` aplicada e registrada em 05/10/2026, depois do ensaio dos testes de acesso (72 de 72 sem as exclusões; 81 no arquivo completo). Conferida no navegador com o usuário de teste, no computador e no celular, e desfeita depois: CNAEs sugeridos e escolhidos no item, árvore com os CNAEs, despesa ligada ao Banco do Brasil com o alerta de CNAE incompatível e de chave de outro emitente, líquido calculado, alertas justificados na lista e exclusão do fornecedor ligado recusada com a mensagem certa | Pagamentos da despesa (P2.5) e conciliação com o extrato (P2.6). Leitura do documento pela IA preenchendo emitente, número e chave (P2.10) |
| P2.5 Pagamentos da despesa | Feita: `prestacao_pagamentos` guarda os pagamentos de cada despesa: forma (PIX, TED, DOC, boleto, débito automático, cheque, saque, cartão ou câmbio), data, valor positivo, favorecido e o número do documento de pagamento, que o Salic compara com o do extrato. A prestação vem da despesa (gatilho) e `lancamento_id`, que só aceita lançamento da mesma prestação, fica para a conciliação (P2.6). Acesso igual ao das contas: lê quem acessa a prestação, escreve quem tem o papel de editar. `lib/prestacao/pagamentos.ts` dá a situação (sem pagamento, parcial, pago ou acima do líquido, em centavos) e os alertas: despesa sem pagamento, pagamentos acima do líquido, pagamento antes da emissão do documento, meio que o regime veda ou não lista (da dimensão pagamentos do regime; sem regime, saque, cheque e cartão pedem justificativa), favorecido diferente do fornecedor (MEI pode receber no CPF do titular) e pagamento sem número. No modal Despesa, a seção Pagamentos lista e registra (valor e favorecido em branco usam o que falta e o documento do fornecedor) e exclui com confirmação; a lista mostra "A pagar", "Pago R$ …" ou "Pago". Migration `20261006190000` aplicada e registrada em 05/10/2026, depois do ensaio dos testes de acesso (75 de 75 sem as exclusões; 84 no arquivo completo). Conferida no navegador com o usuário de teste e desfeita: dois pagamentos (PIX e saque) quitando a despesa da Platibanda, aviso do saque e do número que falta, exclusão pela tela | Conciliação com o extrato (P2.6): ligar cada pagamento ao lançamento e mostrar pago e comprometido no orçamento pelos pagamentos conciliados |
| P2.6 Conciliação | Feita, sem migration: a ligação é o `lancamento_id` do pagamento (P2.5), de modo que um TED pode quitar várias notas e uma despesa pode ser paga em parcelas. `lib/prestacao/conciliacao.ts` diz quais lançamentos esperam despesa (débitos de pagamento ou sem categoria clara; tarifa, aplicação, resgate e transferência entre contas, não), a situação de cada um pela soma dos pagamentos ligados (pendente, parcial, conciliado ou acima), o meio de pagamento pelo histórico do banco e os pares prováveis: só valor igual, e então mesmo número do documento, mesma data ou até 5 dias de diferença e o documento do favorecido no histórico; cada débito e cada pagamento entram em um par só, o de mais pontos. Nada é ligado sozinho. A aba Conciliação, depois de Extrato, mostra no topo quantos débitos estão conciliados e quanto falta, e tem quatro partes: sugestões (cada uma com os motivos, e um botão para conciliar de uma vez as certas, com número igual ou mesma data), débitos sem despesa (escolher a despesa em aberto e ligar, o que registra o pagamento com a data, o número e o meio do extrato e o valor que falta), pagamentos sem lançamento (escolher o débito em aberto) e conciliados (com Desfazer). Conferida no navegador com o usuário de teste, no computador e no celular, e desfeita depois: conta e extrato de teste com aporte, PIX, TED e tarifa, sugestão pelo valor e pela data, débito ligado criando o pagamento, desfazer e o resumo acompanhando cada passo. Em 06/10/2026, o orçamento passou a usar a conciliação: pago é a parte de cada despesa coberta por pagamentos ligados ao extrato, na proporção do líquido (as retenções acompanham o pagamento ao fornecedor), e comprometido é o resto das despesas não recusadas; aceite ou análise do comprovante não mudam mais essas colunas (`execucaoDaDespesa` e `conciliadoPorDespesa` em `lib/prestacao/orcamento.ts`). A aba Orçamento avisa quanto já foi registrado como pago e ainda espera o débito do extrato, com o caminho para a Conciliação. A visão geral, o relatório, a coluna Comprovado da lista e o `valor_realizado` do banco continuam somando os comprovantes aceitos, porque medem a comprovação, não o caixa. Conferida no navegador com uma despesa de R$ 2.057,00 da Platibanda: TED de R$ 1.057,00 conciliado e PIX de R$ 1.000,00 sem lançamento deram pago R$ 1.057,00 e comprometido R$ 1.000,00 no item e no total, e os dados foram desfeitos | Motor de checagens (P2.7), que passa a usar a situação da conciliação (lançamento sem despesa, pagamento sem lançamento). Decidir se `valor_realizado` passa a seguir o pago conciliado (pede migration) |
| P2.2 Extrato em PDF pela IA | Feita: função `ler-extrato-pdf` (Gemini com esquema de resposta) transcreve o PDF do banco; `lerLeituraDoPdf` em `lib/prestacao/extrato.ts` transforma a leitura em lançamentos, com os mesmos saldos, conferência e categorias do OFX e do CSV. Só quem edita a prestação dispara a leitura (`autorizarArquivoDaPrestacao` com `exigirEdicao`, testado em Deno). Na tela, o PDF entra na mesma importação: o app confere pelo hash se o arquivo já foi importado na conta antes de gastar a leitura, mostra a prévia com o aviso de que foi lida pela IA, e o PDF enviado sai do storage se a pessoa desistir. A chave do lançamento lido do PDF deixa o histórico de fora, porque a IA pode escrevê-lo de outro jeito em outra leitura. Extrato fictício no layout do BB em `tests/fixtures/extrato/bb-exemplo.pdf`; a leitura real em produção saiu idêntica a `bb-exemplo-leitura.json` (8 lançamentos, lançamento futuro e linhas de saldo de fora, saldo conferido), em 6 a 10 s. No caminho, o padrão de modelo foi para `gemini-3.8-flash` em `_shared/modelo-ia.ts`: o `gemini-2.5-flash` responde 404 para contas novas, e a importação de orçamento em PDF estava quebrada por isso; voltou a ler (republicada e testada com um orçamento fictício). Conferida no navegador com o usuário de teste: ler e desistir, importar, PDF repetido recusado sem leitura, celular; nada de teste ficou | Nada. O custo de cada leitura fica no log da função até a P2.10 |
| P2.1 Contas bancárias e extrato | Feita: `lib/prestacao/extrato.ts` lê OFX 1.x e 2.x e CSV (colunas por sinônimo, crédito e débito juntos ou separados, marca D/C, linhas de saldo, dados antes do cabeçalho, UTF-8 ou Windows-1252), confere saldo inicial + créditos − débitos contra o final, sugere a categoria e gera a chave que impede lançamento repetido; testes com arquivos de exemplo em `tests/fixtures/extrato/`. Migration `20261006140000`: `prestacao_contas_bancarias` (quem edita escreve), `prestacao_extrato_importacoes` e `prestacao_lancamentos` (só entram por `fn_prestacao_extrato_importar`; o mesmo arquivo não entra duas vezes, e arquivo sem lançamento novo é recusado; desfazer é apagar a importação). A origem fica no formato da importação, pronta para um agregador de Open Finance. Aba Extrato na prestação: contas, importação com prévia, ajuste de colunas e conferência de saldo, lançamentos com filtros e versão para celular, arquivos importados com desfazer. Testes de acesso com as três tabelas e a função: 55 de 55 no ensaio em produção, numa transação desfeita. `20261006140000` aplicada e registrada em produção em 05/10/2026. Conferida no navegador com o usuário de teste na prestação da Platibanda: conta criada, `bb.csv` importado com saldo conferido, filtros e busca, o mesmo arquivo recusado na segunda vez, desfazer e exclusão da conta; nenhuma linha nem arquivo de teste ficou | Nada |
| P1.11 Regimes em todas as dimensões | Feita; as três migrations de 06/10 foram ensaiadas e aplicadas em produção em 05/10/2026: 8 regimes publicados (Rouanet v2, LIE P10 e P424, saúde LXXXVI-A e LXXXVI, ANCINE IN 159 e IN 150, genérico v2), as versões 1 da Rouanet e do genérico obsoletas, a prestação da Platibanda no genérico v2. Em 05/10/2026 a P424, o Anexo LXXXVI e a IN 150 ganharam a versão 2, conferida na própria norma | Nada para a P424: vale a redação atual (decisão de 05/10/2026). "saude" não existe em `captacoes.lei`, então o regime de saúde é escolhido à mão |
| P1.9 Lista e visão geral | Feita (`7cf9efa`) e publicada. Conferida na tela em 05/10/2026 com o usuário de teste, no computador e no celular; as correções (prazo da lista em duas linhas, filtros e abas que rolam no celular, seta dos seletores que encobria o texto, linha do comprovante) estão no PR #14 | Publicar o PR #14 |
| P0.3 Arquivos no caminho da organização | Feita (`2e5d186`). Em 05/10/2026 o comprovante que estava no caminho antigo foi para `{organização}/prestacoes/{prestação}/comprovantes/`, por uma função temporária; o sha256 conferiu, o usuário de teste o abre, e o original e duas cópias órfãs foram apagados | Apagar no painel do Supabase a função `mover-comprovante-antigo`, que hoje só responde 410 |
| P0.4 Funções de IA com autorização | Feita (`c64f0f2`) e publicada, com verificação de JWT | Nada |
| P0.10 Correções no módulo | Tela feita (`356941e`) e publicada; banco aplicado em produção em 05/10/2026 | Nada |
| P0.7 Acesso por módulo e bloqueio no servidor | Feita (`48447a7`) | Nada para o que existe hoje; quem não é super admin precisa da prestação liberada em `organizations.modulos_ativos` e `organization_members.modulos_acesso` para abrir `/prestacoes`. O e2e com três tipos de usuário espera a P0.5 |
| P1.2 Prestação ligada ao regime | Feita, aplicada e publicada em 05/10/2026 | Nada |
| P1.4 Criação guiada | Feita e publicada | Nada. O passo de orçamento leva à importação de planilha ou PDF |
| P1.7 Alterações de orçamento | Feita, aplicada e publicada em 05/10/2026 | Nada |
| P1.5 Importação do Salic | Eliminada em 05/10/2026 | Nada. A API pública do Salic não funciona mais: em 05/10/2026 as consultas de projetos e de proponentes devolviam erro 503. O Pronac continua sendo digitado na criação, e o orçamento entra por planilha ou PDF (P1.6) |
| P1.8 Prazos viram atividades e avisos | Feita, aplicada e publicada em 05/10/2026 | Nada |
| P1.6 Orçamento em árvore | Feita, aplicada e publicada (app e funções) em 05/10/2026; os 37 itens da Platibanda têm grupo de custo | Nada. A tabela antiga `prestacao_itens` ainda espelha na árvore e sai na contração |
| P1.3 Prazos e calendário | Feita (`0fb0697`) | `calendario_regulatorio` já existe (P1.1); a contagem passa a ler dele os feriados locais quando a prestação ganhar regime e local (P1.2) |
| P1.1 Catálogo de regimes | Feita; tabelas e seed aplicados em produção em 05/10/2026 | Nada. Feriados estaduais e municipais entram por regime ou pelo super admin; o segundo turno de 2026 (até 25/10), onde houver, ainda não está no calendário |
| P0.1 Estrutura versionada | Feita (`ec22685`) | Nada; tipar as tabelas em `lib/supabase/types.ts` fica para quando cada tela for reescrita |
| Tipos de comprovante (achado na P0.1) | Feita (`414bdb3`) e aplicada em produção em 04/10/2026 | Nada; um comprovante RPA salvo como quem criou a prestação passou (teste desfeito) |
| P0.2 Prestação pertence à organização | Expansão e contração aplicadas em produção em 05/10/2026. A contração (`20261006120000`) tornou `organization_id` obrigatório e tirou a exceção de quem criou das funções e das regras. Conferido depois de aplicada, numa transação desfeita: o usuário de teste vê a prestação, o comprovante e os 37 itens, edita e cria na própria organização; sem organização a criação é recusada com "A prestação precisa de uma organização"; outra organização é recusada; quem criou e é de outra organização não vê nem altera; visitante não vê. O app publicado continuou mostrando a prestação | Publicar a lista que deixa de pedir `organization_id is null` (PR #14). A permissão de escrita por papel (leitor só lê) espera a correção dos papéis |
| P0.5 Acesso por módulo nos dados | Feita e aplicada em produção em 05/10/2026 | Nada. Mudança de rota: `prestacao_funcao`, as colunas de módulo nos convites e a tabela `organization_modulos` vão para a P0.6 e a P0.9, onde são usadas |
| P0.9 Liberação pelo super admin (cortesia) | Feita e aplicada em produção em 05/10/2026 | Nada. A cortesia da Platibanda vai até 31/12/2026 |
| P0.6 Convite e equipe por módulo | Feita, aplicada e publicada em 05/10/2026 | O e2e "do convite ao primeiro acesso" com e-mail real fica para a P0.8. Na captação, o resto da reconciliação de papéis (leitor só lê, colaborador escreve) continua na tarefa própria; na prestação, a P0.10 já aplica |
| P0.8 Testes de banco | Feita: `supabase/tests/prestacao_rls.test.sql` (pgTAP, 59 verificações na entrega; 84 depois do extrato, dos fornecedores, dos comprovantes do fornecedor, das despesas e dos pagamentos) monta três organizações, oito pessoas (admin, colaborador preparador e revisor, leitor, sem o módulo, captador, outra organização, organização sem o módulo) e o visitante, e confere em cada uma das 12 tabelas e no bucket quem vê, cria, altera e apaga, além de status, avaliação e regimes pelas funções. Tudo roda numa transação desfeita, com o pgTAP instalado dentro dela. `scripts/testes-banco-em-bloco.ts` transforma o arquivo num bloco único para o editor SQL ou o conector. Em produção, em 05/10/2026, sem as 9 verificações de exclusão (o conector espera confirmação para comandos com `DELETE`): 49 de 50; o furo é o leitor enviar e substituir arquivos da prestação, porque as regras do bucket olhavam só organização e módulo. O histórico de status, suspeito de início, já era só leitura por permissão de tabela. A correção (escrever na pasta da prestação pede o papel de editar, e a prestação tem de ser da organização da pasta) está em `20261006130000` (enviar e substituir) e `20261006130100` (apagar), as duas aplicadas e registradas em 05/10/2026; os testes em produção deram 50 de 50 depois delas. A exclusão foi conferida avaliando as regras de `pg_policies` como cada pessoa, sem apagar nada: admin, colaborador e revisor apagam nas 11 tabelas que editam e o arquivo da prestação (o histórico de status, não); leitor, sem o módulo, captador, outra organização, organização sem o módulo e visitante não apagam nada. (Os comentários das duas migrations dizem que o conector trava com a palavra no nome da regra; na verdade ele só espera confirmação para `DELETE FROM`, e a segunda foi aplicada por ele.) | Rodar o arquivo completo, com as exclusões de verdade, pelo editor SQL quando quiser a prova por execução. Job `db` no CI quando a cadeia de migrations subir do zero |

### Banco de produção (leitura de 04/10/2026)

O acesso de leitura ao projeto `ykaymbmybellixxvtasi` foi liberado. O que a leitura mostrou:

- **Falha de segurança corrigida em 04/10/2026, com aprovação.** Sete das nove tabelas da prestação tinham a regra `using (true)`: qualquer conta logada lia, alterava e apagava prestações de todas as organizações. A migration `20261001210000_corrigir_acessos_abertos` estava no repositório, mas nunca tinha sido aplicada. Ela foi aplicada pelo `execute_sql`, porque o `apply_migration` e os comandos com `DROP` travavam no conector; `ALTER POLICY` entrou no lugar de `DROP/CREATE`. Ficou registrada no histórico como `20261004120000 corrigir_acessos_abertos`. Verificação: uma conta sem vínculo vê 0 prestações, 0 itens e 0 comprovantes; quem criou continua vendo tudo. Itens 4 e 5 também aplicados: visitantes não executam mais as 71 funções privilegiadas (exceto as 4 necessárias), e as 10 funções sem `search_path` ganharam um. O item 2 (`profiles`) já estava em vigor.
- **Outro vazamento entre organizações, fora da prestação, corrigido em 04/10/2026 com aprovação:** as regras de `crm_interacoes`, `crm_followups` e `crm_duvidas` (criadas em `20260828000010`) comparavam a organização do membro com ela mesma. Um membro de uma organização com 1 interação via 23 e mais 13 follow-ups de outras organizações. `20261004140000_crm_politicas_por_organizacao.sql` corrigiu, e depois disso a mesma pessoa vê só a da própria organização. Um teste impede o padrão em migrations novas.
- **O banco calcula `valor_realizado`** por gatilho, ao contrário do que o código sugeria e do que eu registrei na P0.10. Os gatilhos agora estão versionados na migration de base.
- **O enum `tipo_comprovante` não aceitava 7 tipos que a tela oferece** (RPA, extrato, invoice, folha, guia, cartão de embarque, print). Corrigido em produção com `20261004130000`.
- **As migrations divergem de produção nos dois sentidos.** Há migrations do repositório nunca aplicadas e mudanças de produção que não estão no repositório. O histórico de produção usa versões próprias: não usar `supabase db push` sem antes reconciliar.
- **Dados da prestação:** 1 prestação (sem projeto e sem captação), 37 itens, 1 comprovante no caminho antigo e 3 arquivos nos prefixos antigos. As colunas de módulo existem (`text[] not null default '{captacao}'`); 1 organização e 1 pessoa já têm a prestação.
- **Papéis:** membros aceitam `colaborador` e `leitor`, mas `organization_invitations` ainda não. Isso está registrado num cartão de tarefa separado.
- **P0.5 em produção (05/10/2026):** a função `auth_tem_modulo` aplica a mesma regra de `lib/modulos.ts`. `can_access_prestacao` passou a exigir o módulo. As 4 regras do bucket `documentos` exigem o módulo para `{org}/prestacoes/...`; antes, um membro sem o módulo conseguia listar e baixar esses arquivos. Um gatilho impede que alguém se dê módulo pago pelo navegador. Hoje isso já não era possível, porque `organizations` não aceita alteração do cliente; o gatilho é a segunda barreira. Teste numa transação desfeita: quem criou vê 1 prestação e 37 itens e envia arquivo; o colega da mesma organização sem o módulo vê 0 e não envia; os 2 documentos fora da prestação continuam visíveis; com uma regra temporária de alteração, mudar o nome passa e mudar os módulos é recusado. Efeito: 4 dos 5 membros da organização da prestação deixam de ver os dados dela, como já acontecia na tela.
- **P0.9 em produção (05/10/2026):** a tabela `organization_modulos` guarda o contrato de cada módulo, e um gatilho mantém `organizations.modulos_ativos` igual a ele: liberar, alterar ou encerrar a cortesia muda o acesso na hora, sem deploy. O navegador não escreve na tabela e só o super admin a lê. As vagas são conferidas por `admin_definir_acesso_modulo` (só a chave de serviço chama), que trava o contrato para duas liberações simultâneas não passarem do limite, recusa captador e não deixa ninguém sem módulo. A rotina `jards-prestacao-cortesias` roda às 00h10 de Brasília: avisa os administradores da organização 7 dias antes do fim e encerra as vencidas, com registro sem autor na auditoria. A Platibanda, liberada à mão antes, virou cortesia sem prazo com 1 vaga; em 05/10/2026 o prazo passou a 31/12/2026 (cliente piloto), com registro na auditoria. Ensaio numa transação desfeita: liberar dá o módulo à organização; com 1 vaga, o segundo membro é recusado; tirar o único módulo de alguém é recusado; a rotina gera 1 aviso por administrador e não repete; vencida, a organização perde o módulo e a rotina registra o encerramento; renovada, volta. Depois de aplicada: um admin comum lê 0 contratos e não roda a rotina nem as funções; visitante não lê; o super admin lê.
- **P0.6 em produção (05/10/2026):** convites e vínculos guardam os módulos e a função na prestação (preparador, revisor, responsável). Cada módulo tem a própria franquia: a captação conta só quem tem a captação (1 incluída + compradas), e a prestação segue o contrato da P0.9; captador e proponente não ocupam vaga e não recebem a prestação. As funções `reservar_convite_com_modulos`, `adicionar_membro_com_modulos` e `alterar_modulos_membro` só rodam com a chave de serviço e travam a organização; as antigas viraram atalhos para "só captação", com os mesmos códigos de erro, para o app publicado continuar funcionando. O aceite do convite copia módulos e função. Também foi corrigida a regra de papéis dos convites (`20261005130100`), que recusava colaborador, leitor e proponente: convidar um e-mail novo com esses papéis falhava, e por isso não havia nenhum colaborador ou leitor em produção. Ensaio numa transação desfeita, com uma organização de 1 vaga de captação e 3 de prestação: convite só da prestação passa sem gastar a captação; o 4º acesso à prestação e o 2º à captação são recusados; tirar o único módulo, dar a prestação a proponente e função inválida são recusados; o aceite cria o vínculo `{prestacao}` como responsável; o navegador não chama as funções novas.
- **P0.10 (banco) em produção (05/10/2026):** o status só muda por `fn_prestacao_mudar_status`, que confere a transição (o mesmo mapa da tela, em `lib/prestacao/status.ts`) e o papel e grava status e histórico na mesma transação; a criação grava o primeiro registro; o navegador não muda o status direto, não cria prestação fora do rascunho e só lê o histórico. Aceitar ou rejeitar comprovante passa por `fn_prestacao_avaliar_comprovante`, que grava `avaliado_por` e `avaliado_em`; comprovante novo começa pendente. Papéis: editar = admin e colaborador (leitor só lê, nas 8 tabelas com regra restritiva); avaliar = admin, revisor ou responsável; decidir (enviar, registrar a decisão do órgão, arquivar) = admin ou responsável. Ensaio numa transação desfeita, com membros da Platibanda trocados de papel: o leitor lê a prestação, os 37 itens e o histórico, mas não altera, não apaga, não cria item nem prestação, não muda status e não avalia; o revisor rejeita comprovante e cria item, mas não envia ao órgão; o responsável (só da prestação) envia e registra o ajuste; o admin sem o módulo não acha a prestação; status direto, histórico direto e comprovante já aceito são recusados.
- **P1.1 em produção (05/10/2026):** `prestacao_regimes` guarda cada versão de um regime (o regime inteiro em `parametros`, validado pelo schema `zod` de `lib/prestacao/regimes/schema.ts`, anotado com o tipo para o compilador acusar divergência) e `calendario_regulatorio` guarda feriados, pontos facultativos e o defeso eleitoral. O seed sai do código (`scripts/prestacao-gerar-seed-regimes.ts`) e um teste falha se o arquivo divergir; mudar um parâmetro publicado pede versão nova, e a anterior vira obsoleta. Em produção: Rouanet (7 prazos, 10 limites) e genérico publicados; 26 feriados e pontos facultativos nacionais de 2026 e 2027 e o defeso de 04/07 a 04/10/2026. Verificação numa transação desfeita: quem está logado lê os publicados e o calendário e não escreve; visitante não lê; o super admin vê rascunhos; o banco recusa duas versões publicadas do mesmo regime e feriado municipal sem município; o seed rodado de novo não duplica.
- **P1.2 em produção (05/10/2026):** a prestação ganhou regime, identificador oficial (o rótulo vem do regime, ex.: Pronac), fonte do recurso, proponente e os marcos (aprovação, liberação, termo, conclusão do objeto, envio). O banco calcula `prazo_final` pelo regime e pelo marco, com as regras de `lib/prestacao/prazos.ts` reescritas em SQL (Páscoa, feriados nacionais, pontos facultativos federais, `calendario_regulatorio`, art. 66 da Lei 9.784). A coluna `prazo` passou a ser o prazo vigente: o informado à mão (`prazo_final_override`), senão o calculado; informar um prazo diferente do calculado exige justificativa. A troca de regime entra no histórico. Ensaio numa transação desfeita: os dias sem expediente de 2026 a 2035 são os mesmos no banco e no código, e 72 de 72 vencimentos de referência batem; a prestação da Platibanda recebeu o regime genérico e manteve o prazo de 21/08 como informado; em Rouanet, fim da execução em 06/08 dá 05/10, e em 01/09 cai num sábado e vai para 03/11 (02/11 é Finados); prazo diferente sem justificativa e proponente de outra organização são recusados.
- **P1.8 em produção (05/10/2026):** cada prestação em rascunho ou revisão interna com prazo ganha a atividade "Enviar a prestação de contas", prioridade alta, com responsável (função de responsável na prestação, senão quem criou, senão um administrador com o módulo). Ela acompanha título e prazo, inclusive quando o prazo muda pelo cálculo do regime, e é concluída quando a prestação é enviada. A atividade já recebe os avisos de 7, 3, 1 e 0 dias e de atraso da rotina das atividades; a rotina `jards-prestacao-prazos` (08h20 de Brasília) soma os de 30 e 15 dias e manda todos quando a atividade não existe. Se o banco recusar a atividade (limite do plano gratuito), a prestação é salva assim mesmo. Ensaio numa transação desfeita: título e prazo novos chegaram à atividade; a 70 dias, nenhum aviso; a 30 dias, 1 aviso com link para a prestação, e rodar de novo não gera outro; a 7 dias com atividade, nenhum aviso da rotina; o envio concluiu a atividade; numa organização no limite do plano gratuito, a prestação foi salva sem atividade e o admin recebeu o aviso de 7 dias, sem repetição; o navegador não chama a rotina nem a sincronização. Na aplicação, a prestação da Platibanda ganhou a atividade (prazo 21/08/2026, já vencido; quem criou é o responsável e recebeu o aviso "Nova atividade para você").
- **P1.6 em produção (05/10/2026):** `prestacao_orcamento_versoes` guarda as versões (solicitada, aprovada para captar, adequada, homologada, readequada), com uma em uso por prestação, e `prestacao_orcamento_nos` guarda a árvore de cada versão (produto, etapa, meta, grupo e local agrupam; o item tem quantidade, ocorrências, unitário, total, remanejado, grupo de custo e local). O grupo de custo pode ficar num agrupador e vale para os itens abaixo dele. O banco confere a estrutura: agrupador da mesma versão, item não fica dentro de item, sem ciclo, item com comprovante não vira agrupador, total = quantidade × ocorrências × unitário quando há unitário. O navegador não muda o remanejado (fica para as alterações da P1.7) nem a versão em uso: copiar uma versão é de quem edita; tornar uma versão a que está em uso é de quem decide (admin ou responsável), e os comprovantes passam para os itens correspondentes. Os 37 itens da Platibanda viraram itens de uma versão "aprovada" com o mesmo id (R$ 1.036.380,00), e o comprovante ganhou `no_id`. Em 05/10/2026 os itens ganharam grupo de custo: execução com 27 (R$ 763.700, inclusive gerente de projeto, seguros e o designer da identidade e da calculadora), administração com 7 (R$ 231.180, dos quais R$ 135.180 são a taxa de 15% do instituto) e divulgação com 3 (R$ 41.500). Até o deploy, a tela antiga continua gravando em `prestacao_itens`, que espelha na árvore (criar, renomear e apagar conferidos), e `item_id` acompanha `no_id`. `prestacoes_contas.valor_realizado` passou a ser a soma de todos os comprovantes aceitos, com ou sem item, como as telas mostram. Ensaio numa transação desfeita: as regras acima recusaram o que deviam; a cópia manteve a hierarquia e o total; ativá-la levou o comprovante para o item copiado; o colaborador edita e não ativa; o leitor só lê; um comprovante aceito sem item entrou no realizado; apagar uma prestação com orçamento funciona. Na tela: colunas aprovado, remanejado, vigente, comprometido (comprovantes em análise, até a fase 2 trazer despesas e pagamentos), pago (aceitos), saldo e % pago; quadro de grupos de custo com os tetos da Rouanet (administração 15%, divulgação 20%, captação 10% e R$ 150 mil, sobre o valor do projeto, que exclui custos vinculados e captação pelo art. 17 da IN 29; corrigido na P1.7, que encontrou o cálculo sobre o total); importação de CSV com coluna de etapa e de PDF; a aba Comprovantes troca o item de um comprovante já enviado. A ligação entre grupo de custo e limite do regime fica em `lib/prestacao/orcamento.ts` até o editor de regimes (fase 6).
- **P1.7 em produção (05/10/2026):** `prestacao_alteracoes` guarda cada pedido de alteração do orçamento: movimentos (item, vigente antes, vigente proposto; item novo sem `no_id`), o cálculo feito na tela, a classificação e o andamento (rascunho → aplicada, quando administrativa; rascunho → aguardando o órgão → aprovada ou negada, quando formal). O navegador só cria e edita rascunhos; pedir, aplicar, registrar a decisão (com ato, documento na pasta `alteracoes/` da prestação e a opção "sem resposta no prazo") e reabrir passam por `fn_prestacao_alteracao_registrar`, que cabe a quem decide. Aplicar soma a diferença no remanejado dos itens da versão em uso e cria os itens novos; se o vigente de um item mudou desde o rascunho, a aplicação é recusada. O enquadramento da Rouanet segue o art. 64 da IN 29: remanejamento que mantém o valor do projeto, os custos vinculados (administração e divulgação) e a captação é administrativo (§ 3º); inclusão de item, complementação e redução são pedidos ao MinC; complementação exige captado ≥ 50% do homologado e soma até 50% (§ 4º); redução soma até 50% do valor total (§ 5º); estourar ou piorar um teto bloqueia a complementação e alerta nas demais; o "50% do item" do Manual Módulo II vira alerta, porque não está na IN; o prazo do MinC (30 dias, art. 64, §§ 7º a 9º) aparece no pedido. Regime sem regras de alteração deixa a classificação com a pessoa. A minuta do pedido sai do cálculo, para copiar ou imprimir. Ensaio numa transação desfeita, com dois itens da Platibanda: o navegador não cria alteração já aprovada nem muda o status direto; aplicar sem justificativa é recusado; aplicada, o remanejado foi −5.000 e +5.000; aplicada não se edita nem se apaga; valor velho é recusado; o colaborador edita rascunho e não pede ao órgão; o leitor só lê; a formal não se aplica sem pedido; negar sem motivo é recusado; reabrir e pedir de novo funcionam; documento fora da pasta é recusado; a aprovação por silêncio criou o item novo e somou no outro. Ficou para depois: guardar no próprio regime a ligação entre grupo de custo e limite e as regras de alteração (hoje em `lib/prestacao/orcamento.ts` e `lib/prestacao/alteracoes.ts`), no editor de regimes da fase 6.
- **Achado na P0.6:** a migration `20260830080000_team_access_roles` nunca foi aplicada em produção: não existem as regras "team role" (o leitor consegue escrever), e `auth_can_write_org` aceita só admin e captador (o colaborador não edita algumas configurações). É a tarefa de reconciliação de papéis. Quem entra por convite também passa pelo onboarding de quem cria a organização, que tenta renomear a organização; hoje a gravação é recusada sem aviso, mas a correção do onboarding precisa evitar que um convidado renomeie a organização de outra pessoa.
- **Achado na P0.9:** a regra que deixa o admin da organização inserir membros direto do navegador (`20260726000008`) dá "infinite recursion detected in policy" e nunca funcionou; o app adiciona membros pela rota do servidor. A P0.9 somou uma regra restritiva que impede incluir a prestação por esse caminho, para quando a recursão for corrigida. O conector também travou num ensaio com `DELETE` e `revoke ... truncate`; sem os dois, passou. Por isso a migration usa `revoke all` e o teste não apaga linhas. Na P0.6, um `DROP CONSTRAINT` passou normalmente: o travamento não é de todo `DROP`.
- **Achado no caminho:** o onboarding grava o nome da organização direto do navegador, mas `organizations` não aceita alteração do cliente; o nome nunca é salvo e nenhum erro aparece. Registrado como tarefa separada.
- **P0.2 em produção (05/10/2026):** a coluna `organization_id` foi criada e a única prestação recebeu a organização de quem a criou. Um gatilho preenche a organização pelo projeto ou pela captação e recusa vínculo de outra organização. A função `can_access_prestacao` passou a olhar a organização. Duas regras restritivas impedem criar ou mover prestação para organização alheia. Teste numa transação desfeita: quem criou vê 1 prestação e 37 itens; criar na própria organização funciona; criar ou mover para organização alheia é recusado; pessoa de outra organização vê 0. `auth_can_write_org` não foi usada porque em produção só libera `admin` e `captador`, e bloquearia colaboradores.

Ajustes de rota no que já foi feito:
- O executado (P0.10) é calculado no app (`lib/prestacao/execucao.ts`). O banco já fazia a mesma soma por item com gatilho; a tela soma direto para incluir no total os comprovantes aceitos sem rubrica.
- A lista de prestações já filtra pela organização atual, como o modal de criação no `main` (parte de app da P0.2).
- Na P0.4 o CORS continuou aberto: a autorização é pelo token no cabeçalho, sem cookie, então restringir a origem não protege nada e quebraria o uso local.
- Os testes ficam em `tests/prestacao-*.test.ts`, na raiz de `tests/`: o `npm test` passa o padrão `tests/**/*.test.ts` pelo shell, e uma subpasta faria os testes da raiz deixarem de rodar.
- O comportamento da autorização das funções tem teste em Deno (`supabase/functions/_shared/prestacao-acesso.test.ts`), que o CI ainda não roda.
- A lista vazia em `modulos_acesso` ou `modulos_ativos` vale como "só captação" até a P0.5 definir as colunas, para ninguém perder acesso por dado antigo.
- O regime da Rouanet nasceu em TypeScript (`lib/prestacao/regimes/`), com `satisfies` no lugar do `zod`; o banco e a validação em tempo de execução entram com o acesso ao banco.

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
| Tarefas agendadas: `pg_cron` chamando funções SQL; edge function só é chamada por `pg_net` num gatilho | `20260830000001:510-527`, `20260825000010:22-68` | Coleta do agente usa `pg_cron` + `pg_net` |
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
- `verify_jwt = true` nas duas em `supabase/config.toml`.
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
- `valor_realizado` provisório: soma dos comprovantes aceitos por item, calculada no app (`lib/prestacao/execucao.ts`). Na fase 2 ela é substituída pelos pagamentos conciliados.
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

## 5. Fase 1 — Núcleo multi-regime e Rouanet (≈ 36 dias)

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

### P1.5 — Importação do Salic (eliminada)

- Eliminada em 05/10/2026: a API pública do Salic (`api.salic.cultura.gov.br/api/v1`) não funciona mais; as consultas de projetos e de proponentes devolviam erro 503. O Pronac continua como identificador oficial digitado na criação, e o orçamento entra por planilha ou PDF lido pela IA (P1.6). A origem `salic` das versões do orçamento fica sem uso.

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

### P1.11 — Regimes em todas as dimensões (12 dias)

Pedida em 05/10/2026: esporte, saúde e audiovisual não podiam esperar as fases 7 a 9 para existir como regime, e as regras da Rouanet não podiam continuar no código.

- O regime passa a ter 15 dimensões, todas obrigatórias: versão da norma pela data, prazos, prestação parcial, orçamento (estrutura, grupos de custo com o nome da norma, bases e tetos), alterações, fornecedores e partes relacionadas, contas e rendimentos, pagamentos e documento fiscal, período e despesas vedadas, porte, objeto, divulgação e defeso, envio (documentos e modelos oficiais), pós-envio (resultados, devolução e GRU) e guarda. Cada dimensão traz as regras com fonte ou uma lacuna explicada ("não se aplica" ou "a norma não trata"), também com fonte; fonte secundária fica "a confirmar" e só alerta.
- As regras saem do código: os grupos de custo, as bases (o "valor do projeto" da Rouanet, a atividade-fim da LIE) e os tetos vêm do regime; o cálculo das alterações passa a interpretar a dimensão `alteracoes` (janela, condições para dispensar o órgão, captado mínimo, acumulado máximo, tetos, número de pedidos, antecedência, alertas por item, prazo e silêncio do órgão).
- Teste de cobertura (`tests/prestacao-regimes-cobertura.test.ts`): falha se um regime deixar uma dimensão sem regras e sem lacuna, se uma lacuna vier sem motivo ou fonte, se faltar um prazo essencial ou se uma lei não disser a que projetos se aplica, como é o orçamento, como se entrega e que resultados existem.
- Matriz de cobertura gerada do código: [`matriz-cobertura-regimes.md`](./matriz-cobertura-regimes.md).
- Regimes: `rouanet_in29_2026` v2; `lie_p10_2026` e `lie_p424_2020` (pela data de protocolo); `pronon_pronas_lxxxvi_a_2025` e o anexo anterior; `ancine_in159_2021` e `ancine_in150_2019` (pela data de aprovação). As versões anteriores herdam o regime novo com toda fonte "a confirmar" e só trocam o que foi conferido na norma antiga.
- Banco: vocabulário de grupos de custo com direitos autorais e coordenação e colocação; quem vê a prestação lê a versão do regime dela mesmo obsoleta; prazo final com conclusão do objeto (ANCINE) e fim do exercício (saúde); as prestações passam da versão 1 para a 2 do mesmo regime.
- Aplicação em 05/10/2026: ensaio com rollback (prazos pelos marcos novos, grupo inventado recusado, leitura do membro antes e depois, idempotência); o seed foi enviado regime a regime e cada `parametros` conferido pelo md5 contra um Postgres local que rodou o mesmo arquivo.
- Com duas versões publicadas da mesma lei, o banco sugere a mais recente (`prestacao_regime_sugerido`); a criação guiada mostra a quem a versão se aplica e avisa que há outra, para a pessoa escolher pela data do projeto.
- **Conferência na norma antiga (versão 2 dos derivados):** cada regra "a confirmar" da P424, do Anexo LXXXVI e da IN 150 foi procurada no próprio texto (com as alterações publicadas), e a leitura virou uma lista em `lib/prestacao/regimes/conferencias/`, aplicada por `aplicarConferencia`: confirmada troca a fonte pelo artigo da norma antiga, com o trecho; diferente troca a regra; a que só a norma nova tem sai. Caminho inexistente ou repetido é erro, e um teste confere as listas. Das 394 regras a confirmar sobraram 29, todas com o motivo na nota: na P424, as que vêm do Decreto 6.180/2007 (o texto não abriu), a base de elaboração sem o § 1º do art. 26 e o uso de rendimentos do art. 29, § 3º (o texto compilado diverge do DOU), a transição e dados do Tesouro; na IN 150, o que vem da IN 158 (depende da transição dela) e o material do objeto por modalidade, que a IN 150 remete à IN 125/2015. Diferenças que mudam o cálculo: elaboração e captação da P424 sobre fim + meio (não sobre o captado), sem inclusão de item novo, saldo pelo art. 59 e PCF omissa sem os 30 dias; despesas administrativas de volta ao Anexo LXXXVI, sem teto, com reforma admitida e recurso em 10 dias; tarifas glosadas sem exceção e oito exceções na concentração da IN 150, com os formulários RP, DE e DO próprios. O seed passou a publicar só os regimes listados em `CODIGOS_DO_SEED`; um teste confere que os demais estão iguais na migration anterior. Ensaio em 05/10/2026: num Postgres local, o arquivo publica as três versões 2 e o md5 de `parametros` de cada uma ficou registrado para a conferência depois da aplicação; em produção, um bloco desfeito no fim tornou a versão 1 obsoleta, publicou a 2 com as mesmas datas e manteve um único publicado por código (nenhuma prestação usa esses regimes hoje). Aplicada em 05/10/2026, regime a regime: o md5 de `parametros`, `fontes`, `checklist_envio` e `modelos_saida` de cada versão 2 é igual ao do Postgres local; a versão 1 dos três ficou obsoleta, cada lei tem um único regime publicado, o calendário não mudou (27 linhas) e as duas migrations estão registradas. Antes de aplicar a IN 150, dois textos herdados que ainda citavam a IN 159 (o motivo do porte e a nota do teto de gerenciamento) foram corrigidos.
- **Questão aberta:** a P10, art. 102, manda observar "o normativo vigente à época do protocolo". Se isso quer dizer a P424 na redação da data do protocolo, as alterações de 2021 a 2025 não alcançam os projetos mais antigos, e a P424 precisaria de versões por data. O regime usa a redação até a Portaria MESP 33/2025 e registra a dúvida na aplicabilidade.

### Ordem

P1.1 → P1.2 → (P1.3, P1.6) → P1.4 → P1.7 → P1.8 → P1.9 → P1.11. A P1.10 é independente e pode ir em paralelo.

**Marco M1:** uma prestação Rouanet criada com o Pronac, com o orçamento importado de planilha ou PDF em árvore, prazos calculados, tarefas e avisos funcionando, e o vigia mandando o resumo diário do DOU.

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
P6.1 coleta das páginas e arquivos dos órgãos com hash · P6.2 leitura dos atos pela IA e propostas com citação conferida · P6.3 tela de revisão e publicação em `app/admin/regimes/`, com segunda aprovação para regras que bloqueiam envio · P6.4 aviso aos clientes afetados · P6.5 conjunto de teste com as mudanças de 2026 (os regimes de ANCINE, LIE e saúde já existem desde a P1.11; o agente propõe as versões seguintes).

**Fases 7, 8 e 9 — ANCINE, LIE federal e saúde (≈ 2 semanas cada; os regimes saíram para a P1.11)**
Para cada área: regimes e seed revisados a partir do rascunho do agente · checagens próprias · saídas nos modelos oficiais (`prestacao-de-contas-fontes/modelos-oficiais/`) · integrações de leitura (dados abertos da ANCINE; Transferegov para a saúde) · testes com os exemplos dos manuais.

**Fase 10 — Expansão contínua:** captura automática de notas, extrato automático, assistente, estados e municípios.

**Dependências entre fases:** 0 → 1 → 2 → (3, 4) → piloto. A fase 5 depende da 0 (acesso) e da 4 (piloto) para a cobrança. A fase 6 depende da 1 (catálogo). As fases 7, 8 e 9 dependem da 2 (motor) e, de preferência, da 6 (rascunho dos regimes) e podem correr em paralelo.

---

## 7. Cronograma

| Fase | Estudo | Este plano | Diferença |
|---|---|---|---|
| 0 | 3 semanas | ≈ 4,5 semanas (22 dias) | Papéis de equipe divergentes, migração de arquivos e testes de RLS que não existiam |
| 1 | 4 semanas | ≈ 7 semanas (36 dias) | Seed gerado do TypeScript; a importação do Salic saiu (−3 dias); os regimes de todas as leis entraram (P1.11, +12 dias) |
| 2 a 9 | 26 semanas | 23 semanas | Fases 7 a 9 com 2 semanas cada (os regimes saíram para a P1.11); revisar no início de cada fase |
| **Total** | **33 semanas** | **≈ 34,5 semanas** de uma pessoa; ≈ 6 meses com duas | As fases 7 a 9 encolhem uma semana cada, porque os regimes saíram para a P1.11 |

Com duas pessoas, o caminho crítico é 0 → 1 → 2 → 4 (piloto). Em paralelo: P0.5 a P0.9 com a outra pessoa; P1.10 e a fase 6 fora do caminho crítico; fase 5 em paralelo com a 3.

---

## 8. Testes

| Tipo | Onde | O que cobre | Quando roda |
|---|---|---|---|
| Unitário | `tests/prestacao-*.test.ts` | Prazos, conciliação, checagens, schema dos regimes, caminhos de arquivo, lógica de módulo | `npm test`, CI |
| Contrato SQL | `tests/prestacao-schema.test.ts` e outros | Toda tabela com RLS; funções com `search_path`; seed igual à fonte; webhook igual nos dois arquivos | `npm test`, CI |
| RLS | `supabase/tests/*.test.sql` | Acesso por organização, papel e módulo, nas tabelas e no bucket | `supabase test db`; CI quando a cadeia de migrations subir do zero |
| Fluxo | `e2e/authenticated/prestacao-*.spec.ts` | Criação guiada, upload, mudança de status, acesso por tipo de usuário | Local e antes de cada liberação |
| Saídas | `tests/prestacao-saidas-*.test.ts` | Arquivos gerados comparados com referências sobre os modelos oficiais | `npm test` |

Os dados de teste dos e2e usam o prefixo de `e2e/helpers/supabaseAdmin.ts` e são apagados ao fim.

---

## 9. Implantação e dados existentes

- **Ordem de deploy:** migration de expansão → app → conferência → migration de contração.
- **Prestações existentes:** recebem organização (P0.2), arquivos migrados (P0.3) e regime (P1.2). Cada passo deixa registro no histórico da prestação.
- **Visibilidade:** até o fim da fase 4, só super admin e organizações com cortesia; a liberação pública acontece com a cobrança (fase 5).
- **Acompanhamento:** erros das edge functions, custo de IA por organização e por prestação, falhas das rotinas agendadas.
- **Volta atrás:** toda migration de expansão é compatível com o código anterior; a contração só entra depois de uma semana sem erro.

---

## 10. Riscos de execução

| Risco | Mitigação |
|---|---|
| O banco de produção diverge das migrations (papéis, funções e gatilhos que nunca rodaram) | Dump e diff antes da P0.1; migrations com `if not exists`; papéis resolvidos antes da P0.6 |
| A cadeia de migrations não sobe num banco novo | Testes de RLS no branch do Supabase até a cadeia ser corrigida |
| Migração de arquivos perder documentos | Ensaio antes, script idempotente, cópia antes de apagar, contagem antes e depois |
| A organização atual só é conhecida no navegador | Bloqueio do servidor por "tem acesso em alguma organização"; isolamento real no RLS |
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
