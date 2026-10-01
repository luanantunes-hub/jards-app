# Plano de implementação — Módulo de Prestação de Contas (Cultura, Esporte, Audiovisual e Saúde)

> Estudo de 01/10/2026. Proposta para discussão; nada aqui foi implementado.
> Fontes: os manuais da pasta "prestação de contas" do Drive, os dois PDFs enviados na conversa, pesquisa na web (só resumos de busca; regras dessa origem aparecem marcadas com [web] e as incertas com [?]) e um mapeamento do código atual.
> As extrações detalhadas, com página citada em cada regra, estão em [`prestacao-de-contas-fontes/`](./prestacao-de-contas-fontes/README.md).

## 0. Resumo

O módulo de prestação de contas atual foi desenhado para a Lei Rouanet, com regras fixas no código e várias telas incompletas. Atender cultura, esporte, audiovisual e saúde não é questão de adicionar telas: cada mecanismo tem contas, prazos, tetos, documentos e formulários próprios, e eles mudam com frequência (a Rouanet trocou de instrução normativa em 2024, 2025 e 2026).

Decisões centrais:

1. **Regime normativo como dado versionado.** Cada prestação aponta para um *regime* (ex.: `rouanet_in29_2026`, `ancine_in159_2021`, `lie_p10_2026`). O regime guarda os parâmetros (prazos, tetos, meios de pagamento, documentos exigidos, checklist de envio, modelos de saída). As checagens são funções em código, testadas, que o regime liga e parametriza. Nada de "20%" escrito em componente React.
2. **O extrato bancário é a espinha dorsal.** Todas as quatro áreas exigem a mesma coisa no fundo: cada débito da conta do projeto precisa ter um documento fiscal válido, ligado a um item aprovado do orçamento, pago ao próprio credor. O módulo passa a ser construído em cima de contas → lançamentos → pagamentos → despesas → itens.
3. **O Jards é a mesa de trabalho, não o sistema oficial.** Nenhum sistema oficial aceita escrita por API. O Jards organiza, valida e gera o pacote no formato de cada sistema; a pessoa lança ou envia lá. Mas há APIs públicas de **leitura** que funcionam (Salic, Transferegov para a saúde, dados abertos da ANCINE, CNPJ e sanções): o Jards importa o projeto e confere o que já foi lançado (seção 5).
4. **Alertas apoiam, não julgam.** O próprio manual de avaliação do MinC diz que apontamentos automáticos passam por análise humana. Cada checagem tem severidade (bloqueia envio, alerta de glosa, exige justificativa) e sempre aceita justificativa registrada.
5. **Antes de qualquer funcionalidade, uma fase de fundação**: versionar o schema que hoje só existe no banco remoto, isolar por organização, corrigir o armazenamento e a função de IA sem autorização.
6. **Posicionamento:** nenhum concorrente cobre, do lado do proponente e da consultoria, regras por lei despesa a despesa, conciliação pelo extrato e saída no formato oficial ao mesmo tempo. O concorrente mais próximo (PROJETE) ainda está em desenvolvimento. O Jards já tem o CRM de captação e as ativações do patrocinador e pode fechar o ciclo até a renovação (seção 4).

Ordem sugerida: Fundação → Rouanet completo (piloto em cultura) → carteira e patrocinador → ANCINE → Esporte (LIE federal) → Saúde (PRONON/PRONAS). Estimativa: cerca de 27 semanas de uma pessoa full-stack (≈ 4 a 5 meses com duas), detalhada na seção 14.

---

## 1. Fontes e grau de confiança

| Área | Documento | Órgão / versão | O que cobre | Confiança |
|---|---|---|---|---|
| Cultura | Manual do Proponente – Módulo II – Monitoramento e Execução | MinC/SEFIC, v3, ago/2026 | Execução no Salic, contas, comprovantes, remanejamento, readequação, checklist de envio | Alta (oficial) |
| Cultura | Manual do Proponente – Módulo III – Avaliação de Resultados | MinC/SGPTC, 2026 (IN 29/2026) | Prestação final, porte, relatório do objeto, GRU, campos do comprovante | Alta (oficial) |
| Cultura | **IN MinC 29/2026 e IN 34/2026, texto integral** | MinC, DOU de 30/01/2026 e 14/08/2026 | Todos os parâmetros de execução e prestação de contas, conferidos artigo por artigo | Alta (norma) |
| Cultura | Manual IN 29 (Olivieri) | Escritório privado, fev/2026 | Tetos, carteira por proponente, plano de distribuição, sanções | Média (secundária; confirmar no texto da IN) |
| Cultura | Manual de Uso da Marca do PRONAC — jan/2026 e versão defeso jun/2026 | MinC | Marcas, créditos, placas, defeso eleitoral | Alta (oficial) |
| Cultura | Manual de Projetos Culturais (Vale) | Instituto Cultural Vale, 2021 | Rouanet sob a IN 02/2019 | **Obsoleto** — usar só como histórico |
| Audiovisual | Manual de Prestação de Contas v2.11 | ANCINE/SPR, 23/09/2026 (IN 159/2021) | PC completa: contas, documentos, tetos, RP/DE/DO, GRU, sanções, parcelamento | Alta (oficial) |
| Esporte (federal) | Manual de Divulgação da LIE — versão defeso | Ministério do Esporte, "versão 2023" | Só marcas e divulgação; o texto das regras de defeso está em imagem | Baixa para PC |
| Esporte (federal) | LC 222/2025, Decreto 12.861/2026, Portaria MESP 10/2026, Portaria 424/2020 e modelos oficiais (formulário PCP/PCF 2026, RCO, carimbo, GRU, remanejamento, PDLIE, manual do defeso), lidos na íntegra | MESP, 2026 | Contas, tetos, vedações, PCP/PCF, prazos, recursos, transição de regimes e layout do formulário | Alta (oficial) |
| Saúde | Manual de análise contábil e financeira PRONON e PRONAS/PCD | MS/FNS, 2ª ed., ago/2019 | Só a parte financeira da prestação final, nos regimes 875/2013, 1550/2014 e PRC 5/2017 | Média; desatualizado frente à Portaria 8.031/2025 |
| Saúde | Pesquisa web: Portaria GM/MS 8.031/2025 (Anexo LXXXVI-A), Transferegov, Lei 15.513/2026 | — | Habilitação e chamamento no Transferegov, CMD no lugar do CIHA, deduções de 2026 | Média (só resumos de busca) |
| Audiovisual | Pesquisa web: layout das planilhas do STR, logomarca, FSA | — | Layout do DE quase completo; RP parcial; DO e FSA não encontrados | Média |

**Limite da pesquisa web:** neste ambiente, o acesso direto a páginas foi bloqueado para quase todos os domínios (não só o gov.br), e a cota de buscas da sessão acabou. Tudo o que está marcado [web] veio de resumos do buscador; nenhum texto normativo foi lido na íntegra.

### Fontes que faltam (bloqueiam partes do plano)

Precisam ser baixados num navegador e colocados na pasta do Drive:

2. **Saúde**: texto da Portaria GM/MS 8.031/2025 (DOU de 08/09/2025, Seção 1, p. 99–106). O "Manual Orientativo" previsto nela ainda não saiu (prazo até 08/06/2026, prorrogável até 08/03/2027).
3. **ANCINE**: "Manual STR – Planilhas" e os modelos `.xls` de RP, DE e DO; Manual de Aplicação da Logomarca v3.0; guias de acompanhamento do FSA no BRDE.

---

## 2. O que é comum e onde as leis divergem

### 2.1 Ciclo comum

Todas as áreas seguem o mesmo esqueleto, com nomes diferentes:

```
aprovação ─► captação (conta de captação) ─► liberação (limiar mínimo / termo assinado)
   ─► execução (conta de movimento): débito ⇄ pagamento ⇄ documento fiscal ⇄ item aprovado
   ─► comprovação (contínua, semestral ou anual) ─► prestação final (prazo fatal)
   ─► análise: objeto + financeiro ─► diligências ─► resultado (aprovada | com ressalvas | reprovada)
   ─► devolução de saldo (GRU) · glosas · recurso · sanções ─► guarda documental (5 anos ou mais)
```

### 2.2 Parâmetros por regime

| Parâmetro | Rouanet (IN MinC 29/2026) | ANCINE (IN 159/2021) | PRONON/PRONAS (PRC 5, Anexo LXXXVI-A) | LIE federal (LC 222/2025, Dec. 12.861/2026, Port. MESP 10/2026) |
|---|---|---|---|---|
| Sistema oficial | Salic | STR + BB Gestão Ágil + Protocolo Digital | Transferegov (habilitação, chamamento, execução); SEI/SIPAR nos projetos antigos | SLI (cadastro, captação, recibos, nº do projeto, inadimplência); PCP pelo SEI e PCF por protocolo digital (o Transferegov não recebe a prestação) |
| Contas | Captação (bloqueada) + Movimento, BB | Captação + Movimentação (+ Recolhimento do investidor), BB, abertas pela ANCINE; FSA sem captação | Captação + Movimento, BB | CAPTAÇÃO (bloqueada) + MOVIMENTO, no BB ou na Caixa, abertas pela DPPIE |
| Liberação | ≥ 20% do valor total captado, contando rendimentos e doações em bens ou serviços (art. 56); reembolso de despesas entre a portaria de captação e a liberação (art. 47) | autorização da ANCINE | Termo de Compromisso | Termo de Compromisso; liberação integral ou parcelada pela DPPIE |
| Meios de pagamento | "como PIX e TED" (art. 58); a IN não veda saque, cheque nem cartão, e o Salic lista cheque e saque | TED, DOC, PIX; boleto em casos listados; **cheque e saque = glosa** | não consta (cheque citado no manual antigo) | qualquer operação bancária que identifique o credor; **saque proibido** (art. 38); aplicação financeira obrigatória, com reposição do rendimento não obtido |
| Comprovação durante a execução | contínua no Salic; deixar de fazer 30% das comprovações gera inadimplência (art. 65, § 3º); o manual recomenda manter ≥ 80% | por RP/DE/DO no fim; parcial existe sem regra clara | anual, até 30/04 | PCP a critério da DPPIE e obrigatória a cada parcela, quando a liberação é parcelada; análise em 60 dias |
| Prazo da prestação final | 60 dias do fim da execução (art. 69; situação E75); omissão gera inadimplência e diligência de 20 dias (art. 95); MinC analisa em 6 meses (art. 71) | 180 dias da conclusão do objeto (CPB, estreia, fim do festival) | 30/04 do ano seguinte ao último exercício | 60 dias corridos do fim da vigência do Termo ou do Aditivo (art. 67); MESP analisa em até 360 + 360 dias |
| Entrega | eletrônica no Salic | planilhas no STR + Protocolo Digital | Transferegov ("poderá") | formulário oficial PCP/PCF (10 abas) + Relatório de Cumprimento do Objeto; PCP pelo SEI, PCF por protocolo digital |
| O documento fiscal precisa ter | descrição igual à planilha; em nome do proponente; retenções; o MinC é autorizado a consultar a NF eletrônica (art. 68); Pronac na nota não é exigido | título + nº SALIC; proponente como tomadora; emissão ≤ 30 dias após o débito | SIPAR + nome do projeto (ou declaração do representante) | em nome do proponente; **nº do projeto no SLI** em todos; carimbo na frente (nº SLI, Ministério do Esporte) e atesto de recebimento no verso; diárias com recibo assinado e CPF |
| Tetos principais | sobre o "valor do projeto": administração ≤ 15% (inclui tarifas); divulgação/acessibilidade ≤ 20%, paga na proporção do captado; captação ≤ 10% e ≤ R$ 150 mil | gerenciamento ≤ 10%; agenciamento ≤ 10% proporcional ao captado; colocação ≤ 10%; contrapartida ≥ 5% | elaboração + captação ≤ 5% e ≤ R$ 50 mil (a confirmar no Anexo LXXXVI-A) | atividade-meio ≤ 15% (o Decreto fala em orçamento total; as planilhas oficiais calculam meio ÷ fim); elaboração + captação 10%, 7% ou 5% conforme o nível (15% no N/NE/CO), até R$ 100 mil, fora dos 15% |
| Concentração e vedações | fornecedor ≤ 20% do captado (art. 24, exceções I–V); proponente + partes relacionadas ≤ 20% (30% PF/MEI), sem teto para grupos familiares e corpos estáveis que atuem na execução (art. 23) | fornecedor/grupo 25–50% = advertência; > 50% = inabilitação | não consta | vedados: taxa de administração, agente público, vantagem ao patrocinador, benefício a membros da entidade, imóvel, atleta profissional, intermediação, espaço publicitário, cobrança de beneficiários |
| Remanejamento sem autorização | livre se não mudar o valor do projeto, os custos vinculados e a captação (art. 64, § 3º); o Salic ainda aplica 50% do item; complementação até +50% com ≥ 50% captado; redução até 50%; MinC analisa alterações em 30 dias e o silêncio permite executar (art. 64) | pedido prévio quando as alterações somam 20% do orçamento; sempre justificar | não consta | até 2 pedidos; só o 2º pode ser direto, até 20%, com aviso em 5 dias; acima disso, aprovação prévia; encargos não mudam; readequação única até 90 dias antes do fim; 3 orçamentos se o valor unitário subir |
| Devolução de saldo | GRU ao FNC (34902 / 340034 / 019473), referência = Pronac; após reprovação, 20 dias, corrigido pela poupança (art. 77) | GRU por fonte (019401, 026642, 026667, 026674), referência = SALIC | GRU ao Tesouro em 30 dias da notificação | GRU (UG 180076, gestão 00001, código 18004-1, referência = nº do processo, pagamento no BB); saldo pode ir uma vez para outro projeto em captação em até 60 dias |
| Resultado | aprovada / com ressalvas (8 hipóteses) / reprovada (art. 76); recurso em 30 dias (art. 78); inabilitação de 3 anos; TCE (art. 90) | aprovada / com ressalvas / não aprovada; multa de 50% (Lei do Audiovisual) ou 20% (FSA/Funcines); inabilitação até 2 anos | parecer conclusivo; TCE | aprovada / com ressalvas / parcialmente / reprovada (art. 79); reprovação: 45 dias para recolher; despesa fora da vigência: ressarcimento + 5%; reconsideração em 5 dias e recurso em 10; sem PCF: saldo recolhido, TCE, SLI suspenso e outros projetos paralisados |
| Guarda de documentos | 5 anos do fim da vigência do projeto (art. 82) | não consta no manual | 5 anos após a aprovação | 10 anos após a avaliação da PCF, na sede (art. 69) |
| Transição de regimes | IN 29 vale para projetos em andamento | IN 150/2019 e IN 125/2015 para projetos antigos | 875/2013, 1550/2014, PRC 5/2017, Anexo LXXXVI-A/2025 | Portaria 424/2020 para projetos protocolados antes de 04/03/2026 (art. 102): remanejamento, saldo (120 dias) e recurso (30 dias) diferentes |

### 2.3 Divergências que ainda precisam do texto da norma

| Tema | O que se sabe | Decisão provisória |
|---|---|---|
| Rouanet: remanejamento por item | A IN 29 não fixa limite por item; o Módulo II (ago/2026) e a tela do Salic ainda aplicam 50% | aplicar as duas: alerta acima de 50% do item, bloqueio se mudar totais, custos vinculados ou captação |
| Rouanet: bloqueio das contas | O art. 70 bloqueia as contas ao fim da execução, mas o art. 69 dá 60 dias para concluir pagamentos | tratar pagamentos após o fim da execução como "exige justificativa" (fato gerador no prazo) |
| Rouanet: forma de pagamento | A IN não veda saque nem cheque; o manual pede meios eletrônicos | saque e cheque exigem justificativa e anexo, sem bloquear |
| Rouanet: comprovação tempestiva | IN: inadimplência ao deixar de fazer 30% das comprovações; manual: manter ≥ 80% comprovado | alerta pelas duas réguas |
| LIE: denominador dos 15% | O Decreto diz "orçamento total"; as planilhas oficiais calculam meio ÷ fim | bloquear quando meio ÷ fim passar de 15% (o critério da área técnica, mais restritivo) e mostrar as duas razões |
| LIE: carimbo e GRU | O carimbo oficial ainda cita a Lei 11.438 (revogada); o exemplo de GRU usa outra UG | gerar o texto como publicado, com lei, UG e código configuráveis |
| Saúde: limites do Anexo LXXXVI-A | Não confirmados | idem, aguardando o texto da Portaria 8.031/2025 |

---

## 3. Diagnóstico do módulo atual

O que existe em `app/(dashboard)/prestacoes/`: lista; visão geral com status e checklist; orçamento (CSV/PDF); comprovantes com leitura por IA (Gemini) e risco de glosa; atividades com evidências; distribuição de ingressos; divulgação; relatório em tela. As tabelas são `prestacoes_contas`, `prestacao_itens`, `prestacao_comprovantes`, `prestacao_atividades`, `prestacao_atividade_evidencias`, `prestacao_relatorio`, `prestacao_status_log`, `prestacao_distribuicao` e `prestacao_divulgacao`.

### 3.1 Problemas de fundação (bloqueiam a evolução)

1. **Schema fora do controle de versão.** Nenhuma migration cria as tabelas de prestação; só existem as políticas de acesso (`20260830044912_predeploy_phase1_fixes.sql`, `20261001210000_corrigir_acessos_abertos.sql`). Tipos, defaults e restrições reais são desconhecidos.
2. **Sem `organization_id`.** O acesso depende de `can_access_prestacao` olhar projeto ou captação. Não há papéis (quem lança, quem revisa, quem envia).
3. **Arquivos fora da regra do bucket.** Os caminhos `prestacoes/{id}/...` e `orcamentos/{id}/...` não começam pelo ID da organização, que é o que as políticas de storage exigem.
4. **`extrair-comprovante` roda com a chave de serviço e não confere quem chama** nem se a pessoa tem acesso à prestação.
5. **Mudança de status só no navegador**, em duas escritas não atômicas, sem checagem de papel e sem exigir o checklist.
6. **`valor_realizado` nunca é calculado** (a tela promete cálculo automático; não há gatilho nem função).
7. **O módulo não é bloqueado por rota** e as colunas `modulos_ativos` e `modulos_acesso` não existem em nenhuma migration.

### 3.2 Regras erradas ou desatualizadas

- O alerta "limite de 20% para pessoa física" soma RPA e recibos sobre o aprovado. A regra real da Rouanet é outra: 20% por **fornecedor** e 20% (30% para PF/MEI) para **proponente e partes relacionadas**, sobre o **captado**. Além disso, a consulta lê uma coluna `valor` que nunca é gravada.
- "A Lei Rouanet recomenda ao menos 20% de acesso gratuito": a IN 29/2026 exige ≥ 10% gratuito social/educativo, até 10% para patrocinadores, até 10% para o proponente e ≥ 20% vendido a até R$ 50.
- A tolerância padrão de 15% por item do orçamento não corresponde a nenhuma regra encontrada; o remanejamento segue as regras do regime (seção 2.2).
- A divulgação verifica "lei mencionada" e "logo do MinC". O manual de marcas de 2026 exige a marca Lei Rouanet à esquerda, "Ministério da Cultura apresenta", Governo Federal no bloco de realização (fora do defeso), aprovação prévia no Salic e versão própria no defeso eleitoral.
- O relatório usa quantidades fictícias ("1,00", 100%, saldo 0) e mistura fontes no total.
- Prazo da prestação é um campo manual; a regra "60 dias após o fim da execução" é só um comentário.

### 3.3 O que aproveitar

A estrutura de abas, o upload com leitura por IA, o fluxo de evidências de atividades, a importação de orçamento por CSV/PDF e o padrão visual. A recomendação é **evoluir as tabelas existentes por migrations** (não recriar do zero) e reescrever as telas sobre os primitivos atuais (`ListPagePrimitives`, `DetailPagePrimitives`, `Dropdown`/`Select`, `StatusBadge`), conforme o `DESIGN.md`.

---

## 4. Mercado e posicionamento

Pesquisa de cerca de 20 produtos no Brasil e 23 no exterior, em `prestacao-de-contas-fontes/mercado-brasil.md` e `mercado-internacional.md`.

### 4.1 Quem já está no mercado brasileiro

| Grupo | Exemplos | O que fazem | O que não fazem |
|---|---|---|---|
| Plataformas do patrocinador | Prosas, Simbi, Incentiv, Bússola Investimento Social, Bee The Change, Incentivo Certo | Seleção, metas, contrapartidas, indicadores ESG, aprovação de logomarca pela empresa | Despesa, conciliação e regras por lei; o cliente é o patrocinador |
| Ferramentas do proponente e da consultoria | **PROJETE** (Projetus), **IncentiVou Manager**, Plataforma Valorize | PROJETE promete despesa ligada a comprovante e meta, multi-lei (em desenvolvimento, 400+ organizações). IncentiVou junta CRM, comissões, trilha de auditoria e dossiê, só para a LIE | Conciliação começando pelo extrato, exportação no formato oficial, cobertura multi-lei pronta |
| Audiovisual | 2Movie, Profilme | Orçamento e cost report no plano de contas da ANCINE | Regras e checklist da IN 159 [?] |
| Gestão de OSC | Bússola Financeiro (2026), HYB, Gestor de Convênios | Orçamento por projeto e fonte, conciliação (Open Finance), checagem de regularidade em bases públicas | Regras de cada lei de incentivo |
| Horizontais | Qive, VExpenses, Espresso, Paytrack, Nibo, Omie, Conta Azul, Dynadok | OCR, captura de NF por CNPJ, conciliação, detecção de duplicidade | Nada específico de projeto incentivado |
| Sistemas oficiais | Salic (aba Compliance, API de leitura), ANCINE (STR, BB Gestão Ágil, assistente Cine Bot), Transferegov | Recebem a prestação e já cruzam lançamentos com o extrato do BB | Lentos, rígidos, um por lei; passivo de cerca de 30 mil prestações sem análise no MinC e na ANCINE (TCU, Acórdão 726/2026) |

### 4.2 Referências internacionais que valem copiar

| Padrão | De onde vem | Como fica no Jards |
|---|---|---|
| Orçamento "vivo": aprovado → remanejado → comprometido → pago → saldo | Instrumentl Spenddown, GreenSlate, Fluxx | Colunas da árvore de orçamento (seção 6.4) |
| Conciliação em três vias (extrato, documento, pagamento) que só casa sozinha com um único candidato | Expensify, Ramp, Hubdoc, SmartyGrants | Tela de conciliação com "por que casou" (seção 6.3) |
| Regra que cita a norma, com três desfechos e decisão final humana | Ramp Policy Agent, Arachne (Comissão Europeia) | Conforme / Revisar / Não conforme, e "não calculável" quando falta dado (seção 8) |
| Fila de "não atribuído" resolvida na própria linha | GreenSlate (Tax Credit Summary), Pleo | Painel de pendências e percentual de prontidão (seção 10) |
| Remanejamento como pedido com estados; administrativo × formal | Fluxx, GreenSlate (EFC Change Report) | Seção 6.4 |
| Pacote de envio com checklist, nomenclatura e manifesto; pré-pacote no meio da execução | Screen Australia, Entertainment Partners, Horizon Europe | Seção 6.8 |
| Períodos travados e "cada número leva à sua fonte" | Euna/AmpliFund, DataSnipper, Pleo | Retrato imutável a cada envio (seção 12) |
| Evidência com data e local capturados na origem | Banco Mundial (GEMS), Good Grants | Biblioteca de evidências por meta (seção 6.5) |
| Painel de carteira por papel | GreenSlate (Incentives Dashboard), EMDESK | Visão para consultorias (seção 6.9) |
| Acesso de convidado (contador, auditor, patrocinador) | Entertainment Partners (Moneypenny), GreenSlate | Seção 6.9 |

### 4.3 Lacunas e posicionamento

Ninguém resolve bem, do lado do proponente e da consultoria:

1. regras de cada lei aplicadas despesa por despesa, **antes** do envio;
2. conciliação começando pelo extrato da conta do projeto;
3. saída no formato do sistema oficial (RP/DE/DO da ANCINE, formulário PCP/PCF da LIE, Planilha II da saúde, espelho do Salic);
4. gestão de diligências e glosas anos depois do envio, quando a equipe já mudou;
5. visão de carteira para consultorias com dezenas de projetos de clientes diferentes;
6. relatório ao patrocinador emitido pelo proponente (hoje cada patrocinador tem sua plataforma e o proponente redigita);
7. o ciclo inteiro em um lugar: captação → contrato → contrapartidas → execução → prestação → renovação.

**Posicionamento:** o Jards já tem CRM de captação, contas de patrocínio, ativações e entregas. O módulo fecha o ciclo: do extrato ao dossiê, multi-lei, para o proponente e para a consultoria, e devolve ao patrocinador a prova da contrapartida — o que alimenta a renovação no CRM.

### 4.4 O que evitar

- Chamar monitoramento de impacto de "prestação de contas" (o proponente percebe a diferença).
- Alerta sem explicação, sem fonte e sem ação; IA que dá "nível de risco" sem citar a regra (é o que a função `extrair-comprovante` faz hoje).
- Conciliação automática "otimista", com mais de um candidato.
- Depender de uma única integração bancária ou fiscal sem importação manual de reserva.
- Formulário longo sem salvamento automático; relatório que obriga a exportar para Excel para conferir.
- Jargão contábil como linguagem principal (termos oficiais como rótulo secundário).
- Pedir à pessoa que digite o que já é público (Pronac, valores, incentivadores).
- Cobrar cada módulo ou dimensão à parte.

---

## 5. Dados abertos e integrações

Não há API de **escrita** em nenhum sistema oficial, mas há APIs de **leitura** que funcionam (testadas em 01/10/2026). Detalhes e exemplos de resposta em `prestacao-de-contas-fontes/materiais-referencia-e-dados-abertos.md`.

| Fonte | Acesso | O que traz | Uso no Jards | Fase |
|---|---|---|---|---|
| **API Salic** (`api.salic.cultura.gov.br/api/v1`) | público, sem chave | Por Pronac: captações, **pagamentos já lançados** (fornecedor, CNPJ/CPF, documento, forma, data, valor, item da planilha), execução por item, readequações, prorrogações, situação, plano de distribuição, marcas | Criar a prestação a partir do Pronac; sincronizar diariamente; conferir o que foi lançado no Salic contra nota e extrato; alertar mudança de situação. Sem extrato e sem os PDFs | 1 |
| **Transferegov — API Gestão de Parcerias** | público, sem chave | PRONON e PRONAS: proposta, plano, contas no BB e **linhas de extrato** | Conciliação da saúde sem integração bancária. A LIE não está nessa API | 7 |
| **ANCINE — dados abertos** | CSV diário | Situação, captação por artigo, prestação de contas, TCE | Preencher e acompanhar projetos audiovisuais | 5 |
| **TCU (certidões) e CGU (CEIS, CNEP, CEPIM)** | público | Sanções e impedimentos por CNPJ | Checagem de fornecedor sancionado | 2 |
| **BrasilAPI, Minha Receita, CNPJá; IBGE** | público | Situação cadastral, data de abertura, CNAE principal e **secundários**, quadro societário | Fornecedor inapto, CNAE incompatível, partes relacionadas (sócios em comum) | 2 |
| **Banco Central (SGS, PTAX)** | público | IPCA, Selic, poupança, taxa legal, câmbio | Atualizar devoluções (poupança na Rouanet, Selic na ANCINE); converter invoices | 4 |
| **BrasilAPI feriados** | público | Feriados nacionais | Prazos em dias úteis | 1 |
| **NF-e (Distribuição DF-e) e NFS-e Nacional (ADN)** | certificado digital ICP-Brasil do proponente | Notas emitidas contra o CNPJ do proponente | Captura automática das notas (opcional, com o certificado do cliente). As consultas públicas têm captcha: não automatizar | 8 |
| **Extrato bancário** (API do BB, CNAB 240 da Caixa, Open Finance via agregador) | contrato PJ, certificado ou agregador | Lançamentos da conta | Extrato automático no futuro; a importação de OFX, CSV e PDF continua sempre disponível | 8 |

Cuidados:

- A API do Salic devolve **CPFs de fornecedores sem máscara**: guardar só para projetos do próprio cliente e mascarar na interface.
- **CNPJ alfanumérico** vale desde julho de 2026: validadores de CNPJ e de chave de nota precisam aceitá-lo.
- Os dados públicos têm falhas (pagamento com data futura, CNPJ vazio, CNPJ como número sem zeros): toda importação passa por checagem de qualidade.

---

## 6. Arquitetura

### 6.1 Regime normativo

- **Catálogo global** `prestacao_regimes`, mantido pela equipe Jards (super admin). Cada registro é uma versão: código, área, mecanismo, esfera (federal, estadual, municipal), UF/município, órgão, sistema oficial, norma de referência, vigência, `parametros` (jsonb validado por schema Zod no código), `checagens` (lista de códigos com severidade e parâmetros), `checklist_envio`, `modelos_saida` e `fontes` (documento e página de cada regra).
- **Cada prestação guarda o regime e a versão** usados. Uma nova norma não muda prestações em andamento sem uma ação explícita e auditada (a IN 29/2026 se aplica a projetos em andamento; nesse caso o super admin migra em lote, com registro).
- **Exceções declaradas por prestação** (ex.: projeto do art. 24, I–V da Rouanet, isento do teto por fornecedor; grupo artístico familiar; animação na ANCINE), sempre com justificativa e anexo.
- **Regimes da v1**: `rouanet_in29_2026`, `ancine_in159_2021` (+ `ancine_in150_2019` para projetos antigos), `lie_p10_2026` (+ `lie_p424_2020` para projetos protocolados antes de 04/03/2026), `pronon_pronas_prc5_2017` (+ `_1550_2014`, `_875_2013` e `_lxxxvi_a_2025` quando houver o texto). Um regime `generico` cobre patrocínio direto e leis ainda não modeladas, sem checagens normativas.
- **Parâmetro "a confirmar".** Valores que vieram só de fonte secundária ficam marcados no catálogo. A tela mostra o aviso e a checagem nunca bloqueia; no máximo alerta.

### 6.2 Unidade de prestação

- Uma prestação = **um projeto × uma fonte × um identificador oficial** (Pronac, SALIC/processo ANCINE, SIPAR, nº do projeto na LIE). A ANCINE exige prestação separada por fonte, mesmo para a mesma obra.
- Um projeto (`projetos_crm`) pode ter várias prestações; uma prestação recebe **vários aportes** (hoje há um único `captacao_id`).
- Prestações da mesma obra e do mesmo objeto (ANCINE) ficam agrupadas para a concentração por fornecedor e para o prazo que vence por último.

### 6.3 Núcleo financeiro

```
conta bancária ─1:N─► lançamento (extrato importado)
lançamento (débito) ─N:N─► pagamento ─N:1─► despesa (documento fiscal) ─N:1─► item do orçamento
despesa ─N:1─► fornecedor (PF, PJ, MEI, estrangeiro; partes relacionadas; grupo econômico)
```

- **O extrato manda.** Débito sem pagamento conciliado é pendência; pagamento sem débito correspondente também.
- **Conciliação em três vias** (linha do extrato, documento fiscal, comprovante de pagamento) por valor, data, número do documento de pagamento (normalizado sem "." e ",", como o Salic exige) e CPF/CNPJ do favorecido.
- **Casamento automático só quando é inequívoco:** valor igual, data dentro da tolerância do regime, CNPJ igual e **um único candidato**. Com dois ou mais candidatos, vira sugestão para a pessoa escolher. Cada casamento mostra o motivo ("mesmo valor, mesmo CNPJ, 2 dias de diferença").
- Estados de cada linha do extrato: conciliado, sugerido, divergente (valor ou data), sem documento; e de cada documento: sem pagamento. Ações em lote com desfazer.
- Retenções (ISS, INSS, IRRF) ficam na despesa e geram linhas próprias quando o regime exige (ANCINE lança o tributo em nome do credor, na rubrica do fato gerador).
- Rendimentos, tarifas, IOF, transferências entre contas, aportes e devoluções são categorias de lançamento, cada uma com regra por regime (ex.: ANCINE glosa tarifas que não sejam de manutenção).

### 6.4 Orçamento versionado

- Versões: solicitada, aprovada para captar, adequada, homologada, readequada (as cinco do Salic), com uma ativa.
- Árvore genérica de nós (`produto`, `etapa`, `meta`, `grupo`, `local`, `item`), porque cada regime tem uma hierarquia: Rouanet usa Fonte → Produto → Etapa → UF → Município → Item; a ANCINE usa rubricas de desenvolvimento, produção, pós e comercialização; LIE e saúde usam plano de trabalho com metas e etapas.
- Cada item tem **grupo de custo** (administração, divulgação/acessibilidade, captação, gerenciamento, agenciamento, elaboração, recolhimentos, execução), que alimenta os tetos.
- **Colunas da árvore:** aprovado, remanejado (±), vigente, **comprometido** (contratos firmados ainda não pagos), pago, saldo, % executado e % do teto do regime quando o grupo tem limite. Cada linha mostra as pendências daquele item (sem comprovante, sem conciliação, regra violada).
- **Alterações** (remanejamento, complementação, redução, inclusão, termo aditivo) são pedidos com estados (rascunho, solicitado, aprovado, negado) e data de aprovação. Ao montar o pedido, o sistema calcula na hora o quanto foi movido contra o limite do regime:
  - dentro do limite → **administrativo**: aplica com justificativa e entra no relatório;
  - acima do limite → **formal**: gera a minuta do pedido ao órgão e fica "aguardando órgão" até o upload da aprovação.
- O motor checa, quando o regime exige, se a aprovação veio **antes** da despesa. Uma linha do tempo mostra as versões do orçamento com a diferença por item.

### 6.5 Objeto e evidências

Metas com previsto × realizado e justificativa; locais de realização (realizado, não realizado com justificativa, realizado com outras fontes); atividades (já existem); evidências tipadas (foto, vídeo, link, lista de presença, declaração, clipping, borderô, print, relatório de exibição, CPB); plano de distribuição; bens permanentes com cotação, inventário e destinação; peças de divulgação com aprovação e marcas.

- Cada evidência é ligada a meta, atividade, local e data. Data e localização da foto são lidas do arquivo e conferidas com a vigência e o local da atividade.
- **Cobertura por meta** ("Meta 3: 4 de 6 oficinas com evidência") alimenta a prontidão e o relatório do objeto.
- **Rastreabilidade nos dois sentidos:** "o que comprova a meta 2?" e "a que meta serve a nota 4471?".

### 6.6 Pós-envio

Diligências com prazo calculado, glosas com data-base, decisões, recursos, devoluções (GRU), parcelamentos (ANCINE) e marcação de inadimplência ou inabilitação, que afeta todos os projetos do proponente.

### 6.7 Integração com o resto do Jards

| Objeto existente | Uso no módulo |
|---|---|
| `projetos_crm` | Criar prestação a partir do projeto; mudar `fase` para `prestacao` ao entrar em E75 ou fim de execução |
| `captacoes` aprovadas | Viram aportes da prestação (valor, incentivador, data) |
| `proponentes` | Carteira: limites por proponente (Rouanet), inadimplência e inabilitação valendo para todos os projetos |
| `planos_ativacao`, `compromissos_cliente`, `ativacao_evidencias` | Contrapartidas de marca do patrocinador viram peças de divulgação com evidência reaproveitada |
| `atividades` | Prazos de prestação, diligências e relatórios parciais criam tarefas com responsável, aparecendo em Lista, Calendário e Gantt |
| `notification_events` | Alertas de prazo e de verificações bloqueantes |
| `documentos` + bucket `documentos` | Todos os arquivos, com `prestacao_id` e caminho `{orgId}/prestacoes/{id}/...` |

### 6.8 Saídas para os sistemas oficiais

Sem API de escrita, o Jards gera:

- **Rouanet**: "espelho Salic" com os campos do comprovante na ordem da tela (tipo, número, série, data, CPF/CNPJ, forma, data e nº do pagamento, valor), rascunho do Relatório de Execução do Objeto, plano de distribuição, bens doados e GRU pré-preenchida.
- **ANCINE**: planilhas RP, DE e DO no layout do STR e GRU por fonte. O DE já tem layout conhecido (cabeçalho com título, SALIC, proponente, tipo de conta, banco, agência e conta; colunas Data, Histórico, Fomento, Outros Depósitos, Transferências, Aplicações/Resgates, Pagamentos, Despesas Bancárias e Saldo calculado). A RP tem as colunas principais (item orçamentário, credor, CPF/CNPJ só com números, histórico idêntico ao do DE, data do pagamento, tipo e número do documento fiscal, data de emissão, valor). O DO depende do modelo oficial.
- **LIE federal**: dossiê da prestação final (ofício do responsável legal, execução desde o início somando as parciais, relatório de cumprimento dos objetivos, extratos, documentos, lista de beneficiários, relatório fotográfico); prestação parcial sob demanda.
- **Saúde**: relação de pagamentos, Planilha II de conciliação, Tabela 1 de rendimentos, informações compiladas, relação de bens com inventário.
- **Todos**: pacote com checklist do destino, arquivos renomeados no padrão exigido, validação de formato e tamanho, **manifesto** (lista de arquivos com hash) e relatório PDF da prestação. Um **pré-pacote** pode ser gerado a qualquer momento para mostrar o que falta hoje. Cada envio gera uma versão travada (seção 12).

Importações: extrato (OFX, CSV e PDF do Banco do Brasil), XML de NF-e/NFS-e, orçamento aprovado (CSV, XLSX, PDF) e dados públicos do projeto (seção 5).

### 6.9 Carteira, patrocinador e convidados

- **Carteira para consultorias e captadores:** lista e quadro de todas as prestações dos clientes, com próximo prazo, % de prontidão, valor em risco (soma dos achados "não conforme" e "revisar"), captado × executado e responsável. Papéis distintos: o cliente envia, o consultor revisa, o responsável aprova e envia.
- **Relatório do patrocinador emitido pelo proponente:** link somente leitura por patrocinador, com marcos, contrapartidas entregues (reaproveitando `ativacao_evidencias`), fotos e execução resumida; relatório periódico gerado automaticamente; aceite do patrocinador registrado e levado ao CRM para a renovação.
- **Convidados:** acesso por convite, com escopo por seção e data de expiração, para contador (que assina declarações), auditor e patrocinador. O convidado comenta e marca itens como "verificado"; tudo entra no histórico.
- **Captura por vários canais:** um e-mail (e, depois, WhatsApp) por projeto para receber notas e recibos, que caem na fila de conciliação; regras por CNPJ de fornecedor (item padrão, retenções); resumo semanal por responsável ("faltam 7 comprovantes no projeto X").

---

## 7. Modelo de dados

Convenções: `organization_id not null` em toda tabela por organização; RLS por organização e papel; `created_at`, `updated_at`, `created_by`; valores em `numeric(15,2)`; enums como `text` com `check`, seguindo o restante do schema.

### 7.1 Catálogo (global)

| Tabela | Colunas principais |
|---|---|
| `prestacao_regimes` | `codigo`, `nome`, `area` (cultura, esporte, audiovisual, saude, outro), `mecanismo` (chave de `tipos_patrocinio`/`captacoes.lei`), `esfera`, `uf`, `municipio`, `orgao`, `sistema_oficial`, `norma_referencia`, `versao`, `vigente_desde`, `vigente_ate`, `status` (rascunho, publicado, obsoleto), `parametros jsonb`, `checagens jsonb`, `checklist_envio jsonb`, `modelos_saida jsonb`, `fontes jsonb` |
| `calendario_regulatorio` | `tipo` (defeso_eleitoral, feriado), `esfera`, `uf`, `municipio`, `inicio`, `fim`, `descricao`, `fonte`. Alimenta a contagem de dias úteis e o defeso (2026: 04/07 a 04/10, ou 25/10 onde houver 2º turno) |

### 7.2 Prestação e financeiro

| Tabela | Colunas principais |
|---|---|
| `prestacoes_contas` (alterar) | + `organization_id`, `regime_id`, `identificador_oficial`, `identificador_tipo`, `fonte_recurso`, `proponente_id`, `grupo_objeto_id`, `valor_homologado`, `porte` (calculado), marcos (`data_aprovacao`, `data_liberacao`, `data_termo`, `data_inicio_execucao`, `data_fim_execucao`, `data_conclusao_objeto`, `data_envio`), `prazo_final` (calculado) + `prazo_final_override` com justificativa, `situacao_oficial`, `status` (workflow interno), `inadimplente`, `resultado` |
| `prestacao_aportes` | `prestacao_id`, `captacao_id`, `incentivador_nome`, `incentivador_documento`, `valor`, `data`, `conta_id`, `validado_oficialmente`, `recibo_doador_documento_id` |
| `prestacao_contas_bancarias` | `prestacao_id`, `tipo` (captacao, movimento, unica, recolhimento, aplicacao), `banco`, `agencia`, `conta`, `aberta_por`, `data_abertura`, `data_encerramento`, `comprovante_encerramento_id` |
| `prestacao_extrato_importacoes` | `conta_id`, `formato`, `periodo_inicio`, `periodo_fim`, `hash_arquivo` (evita importação duplicada), `documento_id` |
| `prestacao_lancamentos` | `conta_id`, `data`, `natureza` (credito, debito), `valor`, `historico`, `numero_documento`, `numero_normalizado`, `categoria` (aporte, transferencia, pagamento, tarifa, rendimento, aplicacao, resgate, devolucao, estorno, outro), `status_conciliacao` |
| `fornecedores` (por organização) | `tipo_pessoa` (PF, PJ, MEI, estrangeiro), `documento`, `nome`, `cnae_principal`, `grupo_economico`, `parte_relacionada` + `tipo_relacao` (proponente, cônjuge, coligada, sócio em comum, dirigente, parente) |
| `prestacao_despesas` (evolui `prestacao_comprovantes`) | `item_id`, `fornecedor_id`, `tipo_documento` (nfe, nfse, cupom, recibo, rpa, rpci, invoice, folha, guia, fatura, boleto, apolice, nota_debito), `numero`, `serie`, `chave_acesso`, `data_emissao`, `data_fato_gerador`, `valor_bruto`, `iss`, `inss`, `irrf`, `outras_retencoes`, `valor_liquido`, `descricao`, `moeda` + `cambio`, `identificacao_projeto` (presente, declaração, ausente), `reembolso`, `status` (rascunho, em_revisao, aceita, lancada_oficial, glosada), `justificativa`, `extracao_ia jsonb` |
| `prestacao_pagamentos` | `despesa_id`, `lancamento_id`, `forma` (pix, ted, doc, boleto, cheque, saque, cartao, cambio), `data`, `valor`, `favorecido_documento`, `numero_documento_pagamento` |

### 7.3 Orçamento

| Tabela | Colunas principais |
|---|---|
| `prestacao_orcamento_versoes` | `prestacao_id`, `tipo` (solicitada, aprovada, adequada, homologada, readequada), `ativa`, `ato` (portaria, termo aditivo), `data_ato`, `documento_id` |
| `prestacao_orcamento_nos` (substitui `prestacao_itens`, mantido como view durante a transição) | `versao_id`, `parent_id`, `tipo` (produto, etapa, meta, grupo, local, item), `codigo`, `nome`, `uf`, `municipio`, `grupo_custo`, `unidade`, `quantidade`, `ocorrencias`, `valor_unitario`, `valor_total`, `fonte`, `ordem` |
| `prestacao_alteracoes` | `tipo` (remanejamento, complementacao, reducao, inclusao, exclusao, termo_aditivo, prorrogacao, transferencia), `status` (rascunho, solicitada, aprovada, negada), `solicitada_em`, `aprovada_em`, `ato`, `justificativa`, `diff jsonb` |

### 7.4 Objeto, divulgação e bens

| Tabela | Colunas principais |
|---|---|
| `prestacao_metas` | `descricao`, `indicador`, `unidade`, `previsto`, `realizado`, `justificativa`, `no_orcamento_id` |
| `prestacao_locais` | `pais`, `uf`, `municipio`, `status` (realizado, nao_realizado, outras_fontes), `inicio`, `fim`, `justificativa` (≤ 500 caracteres, limite do Salic) |
| `prestacao_atividades` (existente) | + `meta_id`, `local_id`; corrigir a ordem e a obrigatoriedade da justificativa |
| `prestacao_evidencias` (generaliza `prestacao_atividade_evidencias`) | `tipo` (foto, video, link, lista_presenca, declaracao, clipping, bordero, print, relatorio_exibicao, cpb, outro), `requisito` (alcance do objeto, democratização, acessibilidade, distribuição, divulgação), vínculo a meta, atividade, local, peça ou bem, `documento_id`, `url` |
| `prestacao_distribuicao` (existente) | + `produto`, `categoria` por regime (social/educativo, patrocinador, proponente, preço popular, venda, gratuita total), `preco`, `beneficiario_documento`, `declaracao_documento_id`; editar em vez de só criar e excluir |
| `prestacao_pecas` (substitui `prestacao_divulgacao`) | `tipo`, `dimensoes`, `data_veiculacao`, `aprovacao_status`, `aprovacao_data`, `aprovacao_protocolo` (Salic, e-mail da ASCOM, ANCINE), `versao_manual` (padrão, defeso), `marcas jsonb` (ordem e papel de cada marca), `texto_creditos`, `evidencia_veiculacao_id`, `compromisso_id` |
| `prestacao_bens` | `despesa_id`, `descricao`, `tipo` (movel, imovel, obra_arte, equipamento), `numero_inventario`, `cotacoes` (até 3 documentos), `destinacao`, `beneficiario_documento`, `termo_doacao_id`, `aceite_id`, dados do cartório (imóveis) |

### 7.5 Pós-envio, verificações e auditoria

| Tabela | Colunas principais |
|---|---|
| `prestacao_diligencias` | `origem` (órgão), `tipo`, `recebida_em`, `prazo_dias`, `dias_uteis`, `vence_em` (calculado), `status`, `resposta`, `respondida_em` + anexos |
| `prestacao_glosas` | `despesa_id`, `valor`, `motivo`, `data_base` (regra do regime: data do débito, ponto médio para mais de 100 itens na ANCINE etc.) |
| `prestacao_decisoes` | `resultado` (aprovada, aprovada_ressalvas, reprovada, regular, regular_ressalva, irregular), `data`, `documento_id`, `ressalvas` |
| `prestacao_recursos` | `decisao_id`, `protocolado_em`, `prazo`, `status`, `resultado` |
| `prestacao_devolucoes` | `motivo` (saldo, rendimento, glosa, reprovação), `codigo_recolhimento`, `ug`, `servico`, `referencia`, `competencia`, `valor_principal`, `pago_em`, `comprovante_id` |
| `prestacao_parcelamentos` | `devolucao_id`, `parcelas`, `valor_parcela`, `deferido_em`, `status` |
| `prestacao_verificacoes` | `check_codigo`, `severidade` (bloqueio, alerta, justificativa, info), `entidade_tipo`, `entidade_id`, `mensagem`, `fonte`, `status` (aberta, resolvida, justificada, dispensada), `justificativa`, `resolvida_por`, `resolvida_em` |
| `prestacao_eventos` (auditoria imutável) | `ator`, `acao`, `entidade`, `antes jsonb`, `depois jsonb`, `ip`, `created_at`; substitui e amplia `prestacao_status_log` |

Papéis por prestação (`prestacao_membros` ou papel na organização): **preparador** (lança), **revisor** (aceita ou recusa despesas, aprova justificativas) e **responsável** (muda status e registra o envio). Mudanças de status e aceite de despesas passam por funções no banco (`security definer`), não por `update` direto do navegador.

---

## 8. Motor de checagens

### 8.1 Como funciona

- Cada checagem é uma função TypeScript pura em `lib/prestacao/checagens/`, com código estável (ex.: `FORNECEDOR_CONCENTRACAO`), que recebe o estado da prestação e os parâmetros do regime e devolve achados.
- Severidades: **bloqueio** (impede marcar como pronta para envio), **alerta** (risco de glosa ou ressalva), **justificativa** (precisa de texto ou anexo), **info**.
- Roda no servidor a cada gravação relevante (rota de API ou função no banco que enfileira) e grava em `prestacao_verificacoes`. Resolver, justificar ou dispensar fica registrado com autor e data.
- Cada achado mostra a **fonte** (norma, artigo ou página do manual, com o trecho citado), copiada do catálogo do regime.
- **Resultado de cada verificação:** *Conforme*, *Revisar* ou *Não conforme*, sempre com "por quê" em uma frase, "fonte" e "dados usados". Quando falta dado, o resultado é **"não calculável"** e diz o que falta ("falta o CPF do prestador") — nunca um conforme silencioso.
- Na dúvida, o motor tende a "revisar"; a decisão final é humana. Aceitar uma exceção exige justificativa escrita, que entra no relatório e no histórico.
- **Fila de pendências:** uma tabela por item do orçamento com as colunas "sem item", "sem comprovante", "sem conciliação", "regra pendente" e "sem evidência de meta", com contagem e valor, ação na própria linha e filtro "só pendentes" para zerar o projeto numa sessão. O **percentual de prontidão** é o indicador principal da visão geral.
- Um painel mostra onde as violações se concentram e quanto a equipe discorda das sugestões automáticas, para calibrar as regras.
- Testes por regime com casos montados a partir dos manuais (seção 15).

### 8.2 Catálogo inicial

As listas completas, com página citada, estão nos arquivos de fontes (Rouanet: 59 + 49 + 39 checagens; ANCINE: 38; LIE: 34; saúde: 22 + 22; marcas: 22 + 9). Abaixo, as que entram na primeira versão, com o regime que as liga.

| Código | O que verifica | Severidade | Regimes |
|---|---|---|---|
| **Prazos e estado** | | | |
| `PRAZO_FINAL` | Contagem até o prazo da prestação final, com marco e tipo de dia do regime | alerta → bloqueio vencido | todos |
| `PRAZO_DILIGENCIA` | Diligência aberta com vencimento próximo | alerta | todos |
| `RELATORIO_PARCIAL` | PCP exigida antes da próxima parcela (LIE) ou documentos anuais até 30/04 (saúde) | alerta → bloqueio | LIE, saúde |
| `COMPROVACAO_TEMPESTIVA` | Comprovações financeiras atrasadas acima de 30% (inadimplência, art. 65) ou comprovado abaixo de 80% do gasto (manual) | alerta | Rouanet |
| `LIBERACAO_MINIMA` | Despesa paga antes da liberação (20% captado / termo assinado) | justificativa | Rouanet, LIE, saúde |
| **Conta e conciliação** | | | |
| `DEBITO_SEM_COMPROVANTE` | Débito na conta de movimento sem despesa conciliada | bloqueio | todos |
| `NUMERO_PAGAMENTO_DIVERGENTE` | Nº do pagamento diferente do lançamento do extrato (normalizado) | bloqueio | Rouanet |
| `FORMA_PAGAMENTO` | Saque, cheque ou cartão fora das hipóteses do regime | bloqueio (ANCINE) / justificativa (Rouanet, LIE) | todos |
| `FAVORECIDO_DIFERENTE` | CPF/CNPJ do favorecido diferente do emitente (exceções: reembolso, MEI) | justificativa | todos |
| `EXTRATO_LACUNA` | Mês sem extrato entre abertura e último pagamento | bloqueio | todos |
| `TARIFA_GLOSAVEL` | Tarifa (exceto manutenção), juros, multa, IOF | alerta | ANCINE |
| `SALDO_FINAL` | Saldo diferente de zero no envio sem GRU registrada | bloqueio | todos |
| `SALDO_PARADO` | Saldo sem aplicação financeira por mais de 30 dias | alerta | todos |
| `DADO_IMPORTADO` | Dado público importado com falha (data de pagamento futura, CNPJ vazio ou sem zeros à esquerda) | info | Rouanet, saúde |
| `RENDIMENTO_LIMITE` | Captado + rendimentos acima do aprovado | bloqueio | Rouanet |
| **Documento fiscal** | | | |
| `DOC_FORA_VIGENCIA` | Emissão antes do marco inicial ou depois do fim da execução | alerta (ressalva na Rouanet) / bloqueio (saúde) | todos |
| `DOC_TOMADOR` | Documento não emitido em nome do proponente | bloqueio | todos |
| `DOC_IDENTIFICACAO_PROJETO` | Falta SALIC, nº do projeto no SLI ou SIPAR no documento quando exigido | bloqueio ou declaração | ANCINE, LIE, saúde |
| `ATESTO_RECEBIMENTO` | Nota sem carimbo e atesto de recebimento (data e assinatura) | bloqueio | LIE |
| `DOC_DESCRICAO_PLANILHA` | Descrição diferente do item aprovado | alerta | Rouanet |
| `DOC_PJ_SEM_NF` | Fornecedor PJ com recibo ou fatura sem dispensa legal anexada | justificativa | Rouanet, ANCINE |
| `DOC_RETENCOES` | Serviço sem ISS, INSS ou IRRF quando aplicável | alerta | todos |
| `DOC_EMISSAO_POS_DEBITO` | Emissão mais de 30 dias após o débito | alerta | ANCINE |
| `NFE_CHAVE_REPETIDA` | Chave de NF-e já usada no projeto ou em outro projeto da carteira | bloqueio | todos |
| `DOC_CHAVE_INVALIDA` | Chave de NF-e (44 dígitos) ou NFS-e (50 posições) com dígito verificador ou CNPJ do emitente diferente do fornecedor | bloqueio | todos |
| `PAGAMENTO_ANTECIPADO` | Débito anterior à emissão do documento e à entrega do serviço | alerta | todos |
| `RPA_CAMPOS` | RPA sem nome, CPF, endereço, data, assinatura, retenções ou SALIC | bloqueio | Rouanet, ANCINE |
| **Limites e partes relacionadas** | | | |
| `FORNECEDOR_CONCENTRACAO` | Soma por fornecedor ou grupo acima do teto (base e faixas do regime) | alerta / bloqueio | Rouanet, ANCINE |
| `PROPONENTE_PARTES_RELACIONADAS` | Proponente e partes relacionadas acima de 20% (30% PF/MEI) | alerta | Rouanet |
| `CONFLITO_INTERESSE` | Fornecedor ligado ao patrocinador ou doador | bloqueio | LIE |
| `FORNECEDOR_SITUACAO` | CNPJ inapto ou baixado na data do documento, ou aberto pouco antes do contrato | alerta | todos |
| `FORNECEDOR_SANCIONADO` | Fornecedor no CEIS, CNEP, CEPIM ou inidôneo do TCU | alerta | todos |
| `FORNECEDOR_CNAE` | CNAE principal **e secundários** incompatíveis com o item | alerta | todos |
| `PARTES_RELACIONADAS_QSA` | Sócio em comum entre fornecedor e proponente (quadro societário público) | alerta | todos |
| `TETO_GRUPO_CUSTO` | Administração, divulgação, captação, gerenciamento, agenciamento, elaboração, atividade-meio acima do teto (sobre valor do projeto, captado, orçamento total ou de produção, conforme o regime) | alerta | todos |
| `BANCO_CONTA` | Conta fora do banco exigido (BB; BB ou Caixa na LIE) ou titular diferente do proponente | bloqueio | todos |
| `CONTRAPARTIDA_MINIMA` | Contrapartida abaixo de 5% | alerta | ANCINE |
| `REEMBOLSO_MATRIZ` | Reembolso fora da lista do art. 15 ou acima de R$ 1.000 | bloqueio | ANCINE |
| `DESPESA_VEDADA` | Categoria vedada pelo regime (folha da proponente e infraestrutura na ANCINE; atleta profissional, intermediação e espaço publicitário na LIE etc.) | bloqueio | todos |
| **Orçamento e alterações** | | | |
| `ITEM_SEM_SALDO` | Despesa acima do saldo do item | bloqueio | todos |
| `REMANEJAMENTO_LIMITE` | Variação acima do limite sem alteração aprovada; número máximo de pedidos (LIE) | bloqueio | Rouanet, ANCINE, LIE |
| `ALTERACAO_PREVIA` | Despesa em item remanejado paga antes da aprovação, quando o pedido exigia aprovação prévia (1º remanejamento, ou acima de 20%) | bloqueio | LIE |
| `ENCARGOS_ALTERADOS` | Remanejamento que muda o percentual de encargos | bloqueio | LIE |
| `CRC_VALIDA` | Pagamento no nível de excelência com Certidão de Registro Cadastral vencida | bloqueio | LIE |
| `ALTERACAO_PENDENTE` | Readequação em análise no envio | bloqueio | Rouanet |
| **Objeto** | | | |
| `META_SEM_RESULTADO` | Meta sem realizado ou divergência sem justificativa | bloqueio | todos |
| `LOCAL_SEM_STATUS` | Local sem status; "não realizado" sem justificativa | bloqueio | Rouanet |
| `ACESSIBILIDADE_SEM_EVIDENCIA` | Medida pactuada sem evidência | alerta | Rouanet |
| `DISTRIBUICAO_PERCENTUAIS` | Percentuais do plano de distribuição fora do regime | alerta | Rouanet |
| `LISTA_PRESENCA` | Atividade formativa ou treino sem lista com identificação | alerta | Rouanet, LIE |
| `RH_GRADE_FREQUENCIA` | Profissional pago em dia sem atividade registrada, ou horas pagas acima da grade de RH | alerta | LIE |
| `BENEFICIARIO_PERFIL` | Beneficiário fora do perfil exigido (vulnerabilidade na Formação Esportiva, faixa etária) | alerta | LIE |
| `BEM_SEM_DESTINACAO` | Bem permanente sem cotação, inventário ou termo de doação | alerta | todos |
| `OBJETO_AUDIOVISUAL` | Produção sem CPB, cópia na Central de Conteúdo ou depósito legal | bloqueio | ANCINE |
| **Divulgação** | | | |
| `PECA_SEM_APROVACAO` | Peça veiculada sem aprovação prévia ou antes dela | alerta | Rouanet, LIE, ANCINE |
| `PECA_MARCAS` | Marcas obrigatórias ausentes, fora de ordem ou com papel errado | alerta | Rouanet, LIE, ANCINE |
| `PECA_DEFESO` | Peça no período de defeso com versão errada do manual | alerta | federais |
| `PECA_SO_ARTE` | Comprovação só com a arte aprovada, sem registro de veiculação | alerta | Rouanet |

---

## 9. Prazos e calendário

- Cada prazo do regime é **marco + quantidade + unidade (corridos ou úteis) + regra de contagem**. Os dias úteis usam `calendario_regulatorio` (feriados nacionais, estaduais e municipais).
- Prazos iniciais:

| Regime | Prazo | Marco |
|---|---|---|
| Rouanet | prestação final em 60 dias, improrrogável | fim da execução (situação E75) |
| Rouanet | diligências em 20 dias (art. 95), incluindo omissão, denúncia e análise preditiva | notificação / dia seguinte ao envio |
| Rouanet | análise de alterações em 30 dias (+30 com a unidade técnica, +60 em obras); silêncio permite executar | pedido |
| Rouanet | análise da prestação pelo MinC em 6 meses | envio |
| Rouanet | devolução em 20 dias e recurso em 30 dias após reprovação; novo prazo de 20 dias se o recurso for negado | dia seguinte ao registro da decisão |
| ANCINE | execução financeira e prestação final em 180 dias | conclusão do objeto (prazo que vencer por último entre processos da mesma obra) |
| ANCINE | GRU de glosa em 30 dias; recurso em 30 dias, com efeito suspensivo | comunicação / recebimento da notificação |
| LIE federal | prestação final em 60 dias (dias corridos); diligência em 30 dias improrrogáveis, com confirmação do e-mail em 1 dia útil; reconsideração em 5 dias e recurso em 10; recolhimento em 45 dias após reprovação; transferência de saldo em 60 dias; prorrogação pedida 30 dias antes; readequação até 90 dias antes | fim da vigência do Termo ou Aditivo; cientificação oficial |
| Saúde | documentos anuais até 30/04; GRU em 30 dias | calendário; notificação do MS |

- Prazos criam **tarefas em `atividades`** com responsável (aparecem no Calendário e no Gantt) e **notificações** em 30, 15, 7, 3 e 1 dia, com deduplicação pelo sistema de notificações existente.
- **Defeso eleitoral** como período no calendário. Peças com veiculação no período passam a ser checadas contra a versão de defeso do manual de marcas do regime.

---

## 10. Experiência do usuário

### 10.1 Lista `/prestacoes`

Padrão de `docs/LISTAS_PADRAO_OURO.md`: cabeçalho com resumo (em execução, prazo em até 30 dias, vencidas, com bloqueios), filtros por área, regime, status e responsável, busca e tabela com colunas configuráveis (`ColumnManager`): projeto, identificador oficial, regime, próximo prazo, % comprovado, saldo em conta, verificações abertas. Alternativa em cartões no celular. Botão principal preto "Nova prestação".

### 10.2 Criação guiada

1. Escolher o projeto (ou criar a partir da tela do projeto). Na Rouanet, informar o Pronac preenche o resto pela API do Salic (seção 5).
2. Área e mecanismo → regime sugerido pela data de aprovação, com a versão visível.
3. Identificador oficial, proponente e fonte.
4. Marcos: aprovação, liberação ou termo, início e fim da execução (ou conclusão do objeto).
5. Contas bancárias.
6. Orçamento aprovado: importar CSV, XLSX ou PDF (a importação por IA já existe) e revisar a árvore.
7. Aportes: vincular captações aprovadas.
8. Opcional: enviar a portaria, o termo de compromisso ou o contrato de patrocínio; a IA propõe prazos, vigência, contas, limites e periodicidade de relatórios, e a pessoa confirma campo a campo antes de virarem calendário e regras.

### 10.3 Área de trabalho `/prestacoes/[id]`

Abas, com `DetailTabs` e cabeçalho com status, regime, prazo e ação principal:

1. **Visão geral**: **% de prontidão** em destaque, contagem regressiva do prazo, captado × aprovado, saldo das contas, % comprovado, porte, fila de pendências, checklist de envio do regime e próximos prazos.
2. **Orçamento**: árvore com aprovado, remanejado, vigente, comprometido, pago, saldo e % do teto; ao clicar num item, uma sheet lateral mostra os lançamentos; pedidos de alteração com o limite calculado antes de salvar.
3. **Financeiro**:
   - *Contas e extratos*: importar extrato, ver lançamentos e categorias.
   - *Despesas*: envio em lote, leitura do documento, revisão campo a campo e vínculo ao item.
   - *Conciliação*: débitos à esquerda e despesas à direita, com sugestões automáticas para confirmar.
   - *Fornecedores*: concentração por fornecedor e por partes relacionadas, em barras com o teto marcado.
4. **Objeto**: metas, locais, atividades, evidências, distribuição e bens.
5. **Divulgação**: peças com aprovação, checklist de marcas por tipo de peça e aviso de defeso.
6. **Pendências**: todas as verificações abertas, agrupadas por severidade, com ação de resolver ou justificar.
7. **Envio**: checklist do regime, geração do pacote ou espelho, registro do envio oficial (data, protocolo, situação).
8. **Após o envio**: diligências, glosas, decisão, recursos, devoluções e parcelamentos.
9. **Histórico**: auditoria completa.

Padrões transversais:

- **Explicação na própria linha:** todo alerta tem "por quê" (regra e artigo) e "como resolver" (ação). Nada de alerta sem ação.
- **Estados com texto e ícone**, não só cor (exigência do `DESIGN.md`).
- **Linguagem de gestor**, com o termo oficial como rótulo secundário ("Relação de Pagamentos (RP)").
- **Estados vazios que ensinam:** "Importe o extrato de março para começar a conciliação".
- **Salvamento automático** em formulários longos; aceite em lote com desfazer; atalhos de teclado na conciliação.
- **Cada número leva à sua fonte:** valores do relatório, da relação de pagamentos e do balancete abrem o comprovante com o campo de origem destacado.

Regras do `DESIGN.md`: salvar em verde à direita no rodapé; roxo só para seleção; nada de `<select>` nativo; exclusões pelo diálogo global de confirmação (hoje várias exclusões não confirmam); erros junto ao formulário; algarismos tabulares nos valores; skeleton no carregamento.

### 10.4 Celular

Celular primeiro na captura: foto de nota ou recibo (com leitura do QR da NFC-e), foto de evidência com data, local e vínculo à atividade, lista de presença por QR ou assinatura, consulta de prazos e pendências. A conciliação e o orçamento ficam para tela grande.

---

## 11. Inteligência artificial

- **Leitura de documento v2**: XML de NF-e/NFS-e é lido sem IA. PDF e imagem usam o modelo atual, com prompt específico do regime. Campos novos: CPF/CNPJ do emitente e do tomador, número, série, chave de acesso, retenções, presença do identificador do projeto e descrição. A IA **sugere**, a pessoa confirma; nada é aceito automaticamente.
- **Extrato em PDF** → lançamentos.
- **Sugestão de conciliação** por valor, data, favorecido e número.
- **Rascunho do Relatório de Execução do Objeto** a partir de metas, atividades, locais e evidências, editável.
- **Leitura de obrigações** da portaria, do termo ou do contrato de patrocínio (prazos, vigência, limites, relatórios), sempre confirmada campo a campo pela pessoa.
- **Assistente ancorado na norma e no projeto:** responde "por que esta nota está em revisar?" citando a regra do catálogo e os dados usados. Diferente do assistente genérico que a ANCINE lançou (Cine Bot), ele conhece o estado da prestação.
- **Motivos de glosa ligados ao catálogo:** a função `extrair-comprovante` deixa de devolver "risco" e motivos em texto livre; cada motivo aponta para um código de checagem, com o dispositivo normativo.
- **Correções na função existente**: validar o token de quem chama e `can_access_prestacao` antes de baixar o arquivo; aceitar só caminhos da organização; registrar custo e modelo usado por chamada.

---

## 12. Segurança, LGPD e guarda

- RLS por `organization_id` e papel em todas as tabelas novas e alteradas; `can_access_prestacao` deixa de depender de projeto ou captação.
- Status, aceite de despesa e registro de envio por funções no banco com checagem de papel e escrita atômica no log.
- Arquivos em `{orgId}/prestacoes/{prestacaoId}/...`, com migração dos arquivos atuais.
- **LGPD**: listas de presença e declarações com CPF ficam como arquivo; quando estruturadas, o CPF é mascarado e só o hash é usado para busca. Em PRONON/PRONAS, **nenhum dado clínico de paciente** entra no sistema: só contagens agregadas e documentos exigidos.
- **Guarda**: após o envio, despesas e arquivos ficam travados contra exclusão até a data do regime (Rouanet: 5 anos do fim da vigência; LIE: 10 anos após a avaliação da PCF; saúde: 5 anos após a aprovação; ANCINE a confirmar). Correções viram nova versão, não sobrescrita.
- Bloqueio de rota para o módulo, com as colunas `modulos_ativos` e `modulos_acesso` criadas por migration e administradas na tela de admin. Até a liberação pública, só super admin.
- **Períodos travados:** ao registrar um envio (parcial ou final), forma-se um retrato imutável dos lançamentos, documentos e relatórios enviados; reabrir exige pedido com motivo e fica no histórico. Isso protege a memória do projeto para análises que chegam anos depois (o passivo do MinC e da ANCINE passa de 30 mil prestações).
- **Dados de terceiros importados:** CPFs de fornecedores vindos da API do Salic são guardados só para projetos do cliente e mascarados na interface.
- **CNPJ alfanumérico** aceito em todos os validadores.
- Instituições maiores (hospitais, em PRONON/PRONAS) vão pedir hospedagem no Brasil e políticas formais de segurança; registrar onde os dados ficam e quem acessa.

---

## 13. Riscos

| Risco | Mitigação |
|---|---|
| A norma muda no meio do projeto | Regimes versionados, migração explícita e auditada, fonte em cada regra |
| Fontes incompletas (LIE federal, saúde) | Fases dessas áreas só começam com o manual oficial em mãos; até lá, regime `generico` |
| Sem API de escrita nos sistemas oficiais; dados divergirem | Espelho com campos na ordem da tela oficial; sincronização de leitura (API do Salic, Transferegov, dados da ANCINE) para comparar o que foi lançado; registro da situação oficial |
| Responsabilidade por orientação errada | Alertas como apoio, fonte citada, justificativa sempre possível, aviso de que a análise é do órgão |
| Dados pessoais de beneficiários e pacientes | Minimização, mascaramento, arquivos privados, sem dado clínico |
| Escopo crescer sem fim | v1 limitada a cinco regimes; novos estados e municípios entram como configuração depois |
| Volume (projetos com milhares de lançamentos) | Índices por prestação e conta, paginação, verificações incrementais |
| O PROJETE (Projetus) lançar antes, com 400+ organizações | Entregar o que ele não promete: conciliação pelo extrato, exportação no formato oficial, carteira e ligação com o CRM |
| Plataformas do patrocinador exigirem que a prestação seja feita nelas | Relatório do patrocinador emitido pelo Jards; exportações no formato dessas plataformas |
| O sistema oficial absorver a conciliação (Salic Compliance, BB Gestão Ágil) | O valor do Jards fica antes do envio (validação, dossiê, carteira) e depois (diligências, histórico, renovação) |
| Integração bancária ou fiscal instável | Importação manual (OFX, CSV, PDF, XML) sempre disponível |
| Preço baixo de ferramentas horizontais e de IA de captação | Vender redução de risco de glosa e horas de equipe, com métrica visível ("R$ X validados, Y pendências evitadas") |

---

## 14. Sequência de entrega

Estimativas em semanas de uma pessoa full-stack.

### Fase 0 — Fundação (2 semanas)

- Exportar o schema remoto das tabelas de prestação para migrations e conferir tipos, padrões e chaves.
- `organization_id` com preenchimento retroativo; RLS por organização e papel.
- Migrar caminhos de arquivo para `{orgId}/...`; corrigir `extrair-comprovante` e `importar-orcamento`.
- Funções de banco para status e log; corrigir erros silenciosos e exclusões sem confirmação.
- Bloqueio de rota, colunas de módulo e tela de admin para ativar o módulo por organização.
- Primeiros testes do módulo.

### Fase 1 — Núcleo multi-regime e Rouanet (3 semanas)

- `prestacao_regimes`, `calendario_regulatorio` e o regime `rouanet_in29_2026`.
- Criação guiada; importação do projeto pela API do Salic a partir do Pronac, com sincronização diária.
- Marcos, prazos calculados (dias úteis com feriados), tarefas e notificações.
- Orçamento versionado em árvore, com grupos de custo, coluna "comprometido" e pedidos de alteração (administrativo × formal).
- Nova visão geral com % de prontidão e lista no padrão.

### Fase 2 — Financeiro (4 semanas)

- Contas, importação de extrato (OFX, CSV, PDF), lançamentos.
- Fornecedores com consulta pública de CNPJ (situação, CNAE, sócios) e de sanções (TCU, CGU); despesas v2 e pagamentos.
- Conciliação em três vias com casamento automático só quando inequívoco.
- Motor de checagens (conforme / revisar / não conforme / não calculável) com as checagens financeiras e de documento da Rouanet; fila de pendências.
- Leitura de documento v2 (XML sem IA; PDF/imagem com IA; motivos ligados ao catálogo).

### Fase 3 — Objeto e divulgação (3 semanas)

- Metas, locais, evidências com data e local, cobertura por meta, distribuição (regras da IN 29) e bens.
- Peças de divulgação com marcas, aprovação e defeso.

### Fase 4 — Envio e piloto em cultura (3 semanas)

- Checklist de envio da Rouanet, espelho Salic, rascunho do relatório do objeto, GRU com atualização pela poupança.
- Pacote com manifesto e pré-pacote; retrato travado a cada envio.
- Pós-envio: diligências, glosas, decisões, recursos e devoluções.
- Piloto com projetos Rouanet reais.

### Fase 5 — Carteira, patrocinador e convidados (3 semanas)

- Painel de carteira para consultorias, com papéis (cliente envia, consultor revisa, responsável envia).
- Relatório do patrocinador emitido pelo proponente, ligado às ativações e ao CRM.
- Acesso de convidado (contador, auditor, patrocinador) e captura por e-mail; resumo semanal de pendências.

### Fase 6 — Audiovisual / ANCINE (3 semanas)

- Regimes `ancine_in159_2021` e `ancine_in150_2019`; prestação por fonte e agrupamento por obra.
- Matriz de reembolso, tetos de gerenciamento, agenciamento e colocação, contrapartida, concentração por obra.
- Planilhas RP, DE e DO no layout do STR; GRU por fonte; calculadora de débito (multa, Selic, mora) e simulador de parcelamento.
- Checklist do objeto por modalidade (CPB, Central de Conteúdo, depósito legal, jogos); acompanhamento pelos dados abertos da ANCINE.

### Fase 7 — Esporte / LIE federal (3 semanas)

- `lie_p10_2026` e `lie_p424_2020` (pela data de protocolo): duas contas no BB ou na Caixa, aplicação obrigatória, saque proibido, atividade-meio ≤ 15%, elaboração e captação por nível, vedações, remanejamento (2º pedido direto até 20%), readequação e prorrogações, PCP por parcela e PCF em 60 dias.
- Nível da prática com teto de captação, grade horária de RH × frequência × pagamentos, lista de beneficiários (≥ 50% da rede pública na formação regular), bolsa só na excelência com CRC válida.
- Geração do **formulário oficial PCP/PCF 2026** (10 abas: Receita e Despesa, Executado, Pagamentos, Recursos Humanos, Beneficiados, Grade, Eventos, A Executar, Bens Adquiridos, Diárias), do Relatório de Cumprimento do Objeto, da planilha de remanejamento, do texto do carimbo e da GRU.
- Marcas da LIE e do Ministério, com a versão de defeso (sem a marca do Governo Federal; "Ministério do Esporte" com a Bandeira).

### Fase 8 — Saúde (3 semanas)

- Regimes por portaria (875, 1550, PRC 5 e Anexo LXXXVI-A).
- Prestação anual até 30/04, auditoria independente, Planilha II, Tabela 1, relação de bens com inventário, recibos aos doadores (em 2026, só empresas do lucro real deduzem, até 1% do IR).
- Extrato e dados do projeto pela API de parcerias do Transferegov; registro de produção no CMD (substituiu o CIHA).

### Fase 9 — Expansão contínua

- Tela de admin para criar e publicar regimes sem deploy de código (parâmetros e checklists; novas checagens continuam em código).
- Captura automática de NF-e e NFS-e com o certificado digital do cliente; extrato automático (API do BB, CNAB da Caixa, Open Finance via agregador); captura por WhatsApp.
- Assistente de IA ancorado na norma e no projeto.
- Regimes estaduais e municipais (ProAC, Pro-Mac, FIA, Fundo do Idoso) e relatório ao patrocinador para patrocínio direto.

**Total das fases 0 a 8: cerca de 27 semanas.** As fases 6, 7 e 8 podem correr em paralelo com duas pessoas depois da fase 2.

---

## 15. Testes

- **Unitários por checagem** (`tests/prestacao/*.test.ts`, com o `tsx --test` já usado): casos positivos e negativos montados a partir dos exemplos dos manuais (ex.: complementação de R$ 100 mil com R$ 50 mil captados; agenciamento de R$ 100 mil autorizados e R$ 80 mil captados = teto de R$ 8 mil; ação formativa de 600 pessoas = 60).
- **Prazos**: dias corridos e úteis com feriados, marcos de cada regime e o "prazo que vence por último" da ANCINE.
- **Conciliação**: extratos de exemplo com tarifas, rendimentos, estornos e pagamentos parcelados.
- **RLS**: pessoa de outra organização, colega da mesma organização com papéis diferentes, anônimo.
- **Saídas**: arquivos de referência para espelho Salic, RP/DE/DO e Planilha II.
- **E2E (Playwright)**: criação guiada → importar extrato → lançar despesa → conciliar → resolver pendências → gerar pacote.

---

## 16. Critérios de sucesso do piloto (cultura)

- 3 projetos Rouanet reais em execução, de organizações diferentes.
- 100% dos débitos da conta de movimento conciliados antes do prazo final.
- Nenhuma diligência da análise preditiva por erro formal que o sistema detecta (número de pagamento, documento fora da vigência, tomador, saldo).
- Tempo para montar a prestação final reduzido pela metade em relação ao processo atual da equipe (medir antes).
- Toda regra exibida com fonte; nenhuma regra fixa em componente.

---

## 17. Arquivos previstos

### Criar

- `supabase/migrations/2026XXXX_prestacao_fundacao.sql` (schema atual versionado, `organization_id`, RLS por papel, funções de status)
- `supabase/migrations/2026XXXX_prestacao_regimes.sql` (catálogo, calendário, seeds)
- `supabase/migrations/2026XXXX_prestacao_financeiro.sql` (contas, lançamentos, fornecedores, despesas, pagamentos)
- `supabase/migrations/2026XXXX_prestacao_objeto.sql` (metas, locais, evidências, peças, bens)
- `supabase/migrations/2026XXXX_prestacao_pos_envio.sql` (diligências, glosas, decisões, recursos, devoluções, verificações, eventos)
- `lib/prestacao/regimes/` (schemas Zod dos parâmetros e seeds por regime)
- `lib/prestacao/checagens/` (uma função por código de checagem)
- `lib/prestacao/prazos.ts`, `lib/prestacao/conciliacao.ts`, `lib/prestacao/extrato/` (OFX, CSV, PDF BB)
- `lib/prestacao/saidas/` (espelho Salic, RP/DE/DO, Planilha II, dossiê da LIE, dossiê geral)
- `app/api/prestacoes/[id]/verificar/route.ts`, `.../exportar/route.ts`
- `app/(dashboard)/prestacoes/[id]/financeiro/`, `objeto/`, `pendencias/`, `envio/`, `pos-envio/`, `historico/`
- `components/prestacao/` (árvore de orçamento, tela de conciliação, cartão de verificação, checklist de envio)
- `tests/prestacao/`

### Modificar

- `app/(dashboard)/prestacoes/page.tsx`, `[id]/layout.tsx`, `[id]/page.tsx`, `orcamento/`, `comprovantes/` (vira Despesas), `atividades/`, `distribuicao/`, `divulgacao/` (vira Peças), `relatorio/`
- `components/modals/NovaPrestacaoModal.tsx` (vira criação guiada)
- `supabase/functions/extrair-comprovante/index.ts`, `supabase/functions/importar-orcamento/index.ts`
- `app/(dashboard)/layout.tsx` (bloqueio de rota e navegação do módulo)
- `lib/supabase/types.ts`
- `app/(dashboard)/projetos/[id]/page.tsx` (atalho para criar ou abrir a prestação)
- `package.json` (biblioteca para gerar XLSX e PDF, a escolher na fase 4)

---

## 18. Decisões em aberto

1. **Prioridade entre áreas.** Sugestão: cultura → carteira e patrocinador → audiovisual → esporte → saúde, pela qualidade das fontes, pela base de clientes e pela concorrência.
2. **Quem opera.** Proponente direto, consultoria/captador gerindo vários proponentes, ou os dois. Isso muda papéis, a "carteira" por proponente e o que o patrocinador vê.
3. **Plano comercial.** Se o módulo entra em todos os planos ou é cobrado à parte.
4. **Busca das fontes da seção 1** (LIE, saúde, IN 29 integral, manual STR).
5. **Estados e municípios.** Se algum programa estadual ou municipal usado pelos clientes (ProAC, Pro-Mac, ICMS, ISS) entra antes da fase 8.
6. **Visão do patrocinador.** Se o patrocinador recebe um relatório ou acesso de leitura à prestação.
7. **Quem paga o software.** Se a assinatura pode entrar no orçamento do projeto como custo administrativo, conforme cada lei (na LIE, dentro dos 15% de atividade-meio; na Rouanet, dentro dos 15% administrativos), ou se é custo da consultoria.
8. **Certificado digital do cliente.** Se o Jards vai guardar o certificado do proponente para capturar notas automaticamente (exige cuidado de segurança) ou se isso fica para depois.

---

## Anexo — Extrações das fontes

Ver [`prestacao-de-contas-fontes/README.md`](./prestacao-de-contas-fontes/README.md).
