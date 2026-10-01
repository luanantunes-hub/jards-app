# Pesquisa: "Manual de Prestação de contas PIE.pdf" e "ManualProjetosCulturais-07.pdf"

Insumo para o módulo de prestação de contas do Jards. Data da pesquisa: 01/10/2026.

## Como ler este arquivo

- **Fonte primária:** os dois PDFs do Google Drive do usuário.
  - PIE: id do Drive omitido.
  - Manual cultural: id do Drive omitido.
- **Citações de página ("p.")** usam a página do PDF.
  - PIE: 22 páginas, sem numeração impressa.
  - Manual cultural: 122 páginas. Conferi que a numeração impressa coincide com a do PDF.
- **Marcações usadas:**
  - **"não consta"**: o documento não trata do assunto.
  - **[?]**: trecho ambíguo ou internamente inconsistente.
  - **[web]**: informação de busca na web. Não está no documento e serve só para confirmar normas.
  - **[inferência]**: dedução minha a partir do documento, sem texto expresso.
- **Truncamento e qualidade da extração:**
  - **PIE:**
    - O `read_file_content` do Drive devolveu o texto completo.
    - Também baixei o PDF e conferi página a página com `pdftotext`: 22 páginas, todas com texto selecionável, sem OCR.
    - As imagens são fotos decorativas. Conferi renderizando as p.9, 16 e 22.
    - A p.2 tem dois hiperlinks para arquivos do Drive, provavelmente as íntegras das normas: [id do Drive omitido], sobre a linha da Portaria FESPORTE 123/2025, e [id do Drive omitido], sobre a linha da IN FESPORTE 04/2025. Nenhum dos dois está acessível: a API respondeu "not found". **Não foram lidos.**
  - **Manual de Projetos Culturais:**
    - **O `read_file_content` do Drive veio TRUNCADO.** Parou na p.80 (Módulo IV, campo "QTD DE DIAS"), sem o resto do orçamento nem o Módulo V inteiro (execução e prestação de contas).
    - Recuperei o texto completo baixando o PDF (2,8 MB) e extraindo as 122 páginas com `pdftotext`. Todas têm texto selecionável.
    - Figuras e tabelas com texto embaralhado (Fig. 1 na p.24, Tab. 2 na p.35, Figs. 26 e 27 nas p.104–105) foram lidas renderizando a página como imagem.

---

# PARTE A — "Manual de Prestação de contas PIE.pdf"

## A.0 Identificação

| Campo | Conteúdo |
|---|---|
| Título | Capa (p.1): "MANUAL DE EXECUÇÃO FINANCEIRA E PRESTAÇÃO DE CONTAS". Título nos metadados do PDF: "Manual de Prestação de contas PIE". |
| Órgão/autor | **FESPORTE – Fundação Catarinense de Esporte**, do Governo do Estado de Santa Catarina. Logos de ambos na p.22. Contato (p.22): pie@fesporte.sc.gov.br, WhatsApp (48) 97400-8748, telefone (48) 3665-6157. Endereço do protocolo (p.16): Rua Comandante José Ricardo Nunes, nº 79, Capoeiras, Florianópolis/SC. |
| O que é "PIE" | **Programa de Incentivo ao Esporte**, programa **estadual de Santa Catarina**. Instituído pelo Decreto estadual nº 780, de 03/12/2024, e coordenado pela FESPORTE (p.3). |
| Mecanismo | Renúncia fiscal de **ICMS**: "empresas contribuintes do ICMS em Santa Catarina patrocinem projetos esportivos, previamente aprovados pela FESPORTE" (p.3). Os recursos captados "tornam-se renúncia fiscal e adquirem natureza pública" (p.5). |
| Esfera | Estadual (UF: SC). Não é federal nem municipal. |
| Versão/data | **Não consta no texto.** Metadados do PDF: feito no Canva, criado em 20/02/2026, campo autor "(usuário omitido)". As normas citadas são de dez/2024 a out/2025, então o manual é posterior a 02/10/2025. |
| Base legal (p.2) | (1) **Decreto nº 780, de 3/12/2024**, que institui o PIE e regulamenta o credenciamento de projetos esportivos. (2) **Instrução Normativa FESPORTE nº 04, de 2/10/2025**, sobre regras de entrega e análise da prestação de contas do PIE. (3) **Instrução Normativa N. TC-33/2024**, do TCE-SC, sobre critérios de concessão e comprovação de recursos concedidos a qualquer título. (4) **Portaria FESPORTE nº 123, de 02/10/2025**, sobre a comissão CAPE, editais, cadastramento, análise, captação, execução, acompanhamento, monitoramento e fiscalização. |
| Sistemas eletrônicos | **Prosas**: submissão, funcionalidade "comunicado" e formulário "Relatório Financeiro de Prestação de Contas" (p.6, p.16). **SGPE**: processo eletrônico do projeto; o número do processo deve constar na NF (p.11, p.19). **gov.br**: assinatura digital do Termo de Compromisso (p.7). **Banco do Brasil**: "instituição financeira responsável pela centralização e pelo processamento da movimentação financeira do Estado" (p.4–5). |
| Instâncias citadas | **DPOP/FESPORTE**: gere a conta e aprova remanejamentos (p.5, p.14). **CAPE** (Comissão de Avaliação e Seleção de Projetos Esportivos): readequação (p.6). **CMA** (Comissão de Monitoramento e Avaliação), vinculada à DPOP (p.8). Presidência da FESPORTE (p.8, p.14). |
| Natureza | O manual é "orientativo". A base legal "deve ser consultada em sua origem" (p.3). |

[web] Confirmações:
- O Decreto SC 780/2024 regulamenta o PIE, ligado ao Convênio ICMS CONFAZ nº 78/2019.
- A IN FESPORTE nº 4/2025 foi publicada no DOE-SC em 08/10/2025.
- A IN TC-33/2024 do TCE-SC revogou a IN TC-14/2012.

## A.1 Linha do tempo e prazos

| # | Etapa | Prazo / regra | Marco de contagem | Pág. |
|---|---|---|---|---|
| 1 | Autorização para captar | A FESPORTE publica no DOE o extrato do projeto apto à captação, com o prazo final de captação e os valores | Publicação no DOE | p.4 |
| 2 | Abertura de conta | A FESPORTE solicita a abertura da conta única e específica no BB. As contas só operam após regularização pelo titular na agência | Não consta prazo | p.4–5 |
| 3 | Período de captação | **12 meses, improrrogáveis**. "Carta de captação possui prazo de vigência de 12 (doze) meses" | Não consta o marco exato [?]: provavelmente a emissão da carta de captação ou a publicação no DOE | p.5–6 |
| 4 | Fim antecipado da captação | Pode ser pedido após captar **≥ 20%** do valor autorizado, via "comunicado" no Prosas ou e-mail | — | p.5–6 |
| 5 | Captação encerrada por decurso de prazo | O proponente informa a intenção de prosseguir **em até 30 dias** | Encerramento da captação | p.6 |
| 6 | Captação < 20% | Restituição à FESPORTE dos recursos, do saldo e dos rendimentos | — | p.6 |
| 7 | Readequação (captação parcial ≥ 20%) | Obrigatória. Não pode alterar o objeto. Vai a um avaliador designado pelo presidente da CAPE | — | p.6 |
| 8 | Termo de Compromisso (TC) | Após o fim da captação, a FESPORTE envia o TC. O proponente devolve **assinado (gov.br) em 10 dias**. Se não devolver, o projeto é desclassificado e chama-se o próximo da lista | Envio do TC [?: não diz se são dias úteis ou corridos] | p.7 |
| 9 | Início da execução | A conta só pode ser movimentada após a assinatura do TC. "A Prestação de Contas inicia-se no momento da assinatura termo de compromisso" | Assinatura do TC | p.3, p.5 |
| 10 | Janela de despesas | Só são válidas despesas **após a assinatura do TC e até o fim da vigência**. Pagamento após a vigência só se o fato gerador ocorreu durante a vigência | Assinatura do TC / fim da vigência | p.12, p.20 |
| 11 | Relatórios técnicos parciais | **A cada 6 meses**, solicitados pela CMA | [?] provavelmente a assinatura do TC (não consta) | p.8 |
| 12 | Esclarecimentos (a qualquer tempo) | **10 dias úteis** para responder | Solicitação | p.10 |
| 13 | Irregularidade em fiscalização | **15 dias** para defesa ou regularização, sob pena de suspensão do repasse, cancelamento ou outras medidas | Notificação [?: não diz se são úteis ou corridos] | p.11 |
| 14 | Relatórios de fiscalização | Consolidados em **relatórios anuais** no processo SGPE | — | p.11 |
| 15 | Prorrogação de execução | Pedido fundamentado **até 30 dias antes** do encerramento do prazo do TC. Formalizado por **termo aditivo assinado antes do vencimento** | Encerramento previsto no TC ("a contar da data de seu protocolo" [?]) | p.15 |
| 16 | Prorrogação de ofício | Quando a FESPORTE causa atraso de liberação, limitada ao exato período do atraso | — | p.14 |
| 17 | **Prazo de entrega da prestação de contas final** | **Não consta no manual.** [web] A IN FESPORTE 04/2025 diz: protocolo via Prosas em **até 30 dias úteis, contados do primeiro dia útil subsequente ao término da execução** | — | — |
| 18 | Prazo de análise da prestação final | **Não consta** | — | — |
| 19 | Guarda dos documentos originais | **10 anos**, contados do dia útil subsequente à data da prestação de contas | Data da prestação | p.19 |

## A.2 Contas bancárias, meios de pagamento, rendimentos, tarifas

- **Conta:**
  - **Uma** conta "única e específica, vinculada ao CNPJ do proponente".
  - Aberta a pedido da FESPORTE no **Banco do Brasil**, como instituição centralizadora do Estado (p.4–5).
  - "Sob a gerência da DPOP/FESPORTE" (p.5).
  - O proponente precisa regularizá-la na agência antes de operar (p.5).
- **Durante a captação** a conta "estará apta apenas para a captação", vedada a movimentação para outros fins (p.5).
- **Movimentação:** só após a assinatura do Termo de Compromisso e exclusivamente para a execução (p.5).
- **Aportes:** devem ser depositados "direta e somente na conta vinculada" (p.5).
  - É vedado captar acima do autorizado. O excedente é recolhido em conta indicada pela FESPORTE (p.5).
- **Aplicação financeira:**
  - Obrigatória e feita **pelo proponente**, em "fundo de aplicação financeira de curto prazo, de baixo risco, lastreado em títulos da dívida pública" (p.5).
  - Dica do manual: pedir ao gerente.
  - É responsabilidade do proponente "certificar-se de que todos os recursos captados estejam em aplicação" (p.12).
- **Rendimentos:**
  - O proponente repõe os rendimentos do período em que os recursos não estiveram aplicados (p.12).
  - Rendimentos **não são computados como recursos captados** (p.12).
  - Rendimentos ficam fora da base de cálculo do teto de 10% de elaboração e captação (p.13).
  - Podem ser usados em itens previstos no plano de trabalho **sem apostilamento** (p.14).
  - Saldo e rendimentos são restituídos se a captação ficar abaixo de 20% (p.6).
- **Bloqueio judicial:** informar imediatamente, sob pena de arquivamento. A reposição dos valores bloqueados e de seus rendimentos cabe ao proponente (p.5).
- **Meios de pagamento:**
  - "exclusivamente" eletrônicos: **boletos bancários, PIX e transferências**. "Vedado em qualquer hipótese o saque em dinheiro" (p.12).
  - Comprovantes aceitos: ordens bancárias e comprovantes de transferência eletrônica ou de PIX "realizados diretamente para a conta bancária de titularidade dos credores" (item XVI, p.18).
  - Cheque: não consta.
- **Tarifas bancárias:** não consta. São vedadas despesas com "multas, juros ou correção monetária" (p.13), mas tarifas não são citadas.
- **Extratos exigidos na prestação de contas:**
  - Da conta corrente vinculada, com a movimentação completa do período (item V, p.16).
  - Da aplicação financeira, com o rendimento líquido de todo o período (item VI, p.16).

## A.3 Orçamento

- **Estrutura:**
  - O **Plano de Trabalho** atualizado faz parte do Termo de Compromisso (p.7).
  - Há menção a "cronograma físico-financeiro" (p.8, p.15), "orçamento analítico" (p.13), "itens orçamentários", "grupo de despesa" (p.14) e "planilha aprovada" (p.10).
  - O manual não detalha a estrutura de rubricas ou etapas.
- **Princípio:** "somente despesas previstas no plano de trabalho podem ser realizadas! caso contrário o valor deverá ser devolvido!" (p.13).
- **Tetos:**
  - **Despesas de produção ≤ 10%.** Abrangem a "elaboração do projeto desportivo ou paradesportivo e a captação de recursos". A base é o valor **efetivamente captado**, excluídos os rendimentos (p.13).
  - Encargos sociais e trabalhistas obrigatórios "poderão ser incluídos no orçamento analítico, observando-se o limite de despesa estabelecida no caput" (p.13). [?] Não fica claro se o limite do caput é o mesmo dos 10%.
  - Teto por projeto, por proponente, por rubrica ou de cachê: **não consta**.
- **Remanejamento** (p.14):
  - Pedidos justificados, para alterar duração, quantidade ou valor de itens aprovados. Análise e aprovação pela **DPOP/FESPORTE**.
  - Só itens orçamentários previstos no projeto aprovado.
  - **Por apostilamento:** alterações de despesas do plano de trabalho, de metas e etapas, e prorrogação de ofício da vigência.
    - Exige análise do setor técnico.
    - Dispensa homologação da presidência, análise jurídica e publicação no DOE.
    - Pedido "via sistema eletrônico indicado pela FESPORTE".
  - O apostilamento deve ser **aprovado antes** de realizar a despesa alterada (p.12).
  - **Dispensado o apostilamento para:**
    - I – redução de preço unitário;
    - II – acréscimo de preço unitário **até 10%** do item ou, quando admitido, do grupo de despesa do plano inicial;
    - III – acréscimo ou supressão de quantitativo **até 20%** do previsto no plano inicial.
  - **Vedado** alterar o plano com base em economia de licitação ou contratação, ou em sobra após a execução, "salvo quando necessário à execução do objeto e ao alcance dos resultados esperados".
- **Readequação por captação parcial (≥ 20%):** novo orçamento sem mudar o objeto, demonstrando "funcionalidade plena das ações" (p.6).
- **Despesas vedadas** (p.13):
  - I – despesas:
    - a) multas, juros ou correção monetária;
    - b) cessão, contratação ou transferência de atleta, profissional ou não;
    - c) atividades ou projetos de cunho religioso;
    - d) recepções e festas de acesso restrito;
    - e) despesas em data anterior ou posterior à vigência.
  - II – bens ou serviços fornecidos pela própria parceira, por seus dirigentes, cônjuges ou parentes em linha reta, colateral ou por afinidade **até o 2º grau**, inclusive quando sócios da contratada.
  - III – remunerar, a qualquer título:
    - a) membro de Poder, do MP ou dirigente de órgão ou entidade da Administração Pública Estadual;
    - b) servidor ou empregado público do concedente ou do órgão descentralizador, ou seu cônjuge, companheiro ou parente até o 2º grau, ressalvadas a lei específica e a LDO.
- **Permitido com regras:** bolsa-auxílio para atletas, com documentação mensal (item XXII, p.18).

## A.4 Documentos comprobatórios

- **Titularidade:** documentos "emitidos única e exclusivamente em nome do proponente" (p.12).
- **Comprovante regular:**
  - Documentos fiscais da legislação tributária, **originais e em 1ª via** (exceto entidade de direito público).
  - Também valem folhas de pagamento e guias de encargos e tributos (p.19).
  - Documentos emitidos por plataforma eletrônica precisam de origem garantida por **certificação digital** (p.19).
- **Conteúdo obrigatório do documento fiscal** (p.19):
  - I – data de emissão, nome, endereço e CNPJ/CPF do destinatário;
  - **II – identificação do processo SGPE do projeto**;
  - III – descrição detalhada (quantidade, marca, tipo, modelo, qualidade etc.);
  - IV – valores unitário e total de cada item e valor total da operação.
- **NF-e:** pode ser apresentada pelo **DANFE**, "cuja autenticidade será verificada pela chave de acesso". Se não der para discriminar o objeto, o emitente fornece um **termo complementar** (p.19).
- **Legibilidade:** sem "emendas, borrões, rasuras, acréscimos ou entrelinhas" (p.19).
- **Recibo** (p.19):
  - Só para serviço prestado por contribuinte **não obrigado** a emitir documento fiscal, inclusive recibos de plataformas eletrônicas.
  - Mínimo: descrição precisa do serviço, nome, endereço, CPF/CNPJ do emitente, **valor em número e por extenso** e deduções.
- **RPA:** não consta com esse nome.
- **Folha de pagamento** (p.19): nome, cargo, matrícula, CPF, descrição e valor de cada parcela, descontos, líquido, competência, **comprovação do depósito bancário** e assinatura dos responsáveis.
- **Pessoal** (p.20): no mínimo, comprovante de recolhimento de **INSS e FGTS**.
- **Atesto de recebimento** (p.17 item VII; p.20):
  - Declaração do responsável nos comprovantes, certificando que o material ou equipamento foi recebido ou o serviço prestado "conforme as especificações".
  - Atestado assinado pelo recebedor, com nome e cargo.
  - Em sistemas informatizados, rastreabilidade do responsável.
- **Comprovante de pagamento:** item XVI, p.18 (ver A.2).
- **Contratos** (item XII, p.17):
  - Cópia dos contratos de serviços, com os comprovantes.
  - Para pessoal contratado como **PJ**: todos os contratos, NFs e comprovantes de pagamento.
- **Serviços técnicos:**
  - Demonstrativo de **horas técnicas** por profissional, com qualificação, datas, horas e valor unitário (item X, p.17).
  - Nos serviços de assessoria, consultoria e eventos: horas técnicas com custo unitário e total "além das justificativas da escolha" (p.21).
  - Comprovante de qualificação para serviço regulamentado por conselho de classe (item XI, p.17).
- **Cotações:**
  - **Entidade privada:** não há exigência numérica de cotações. Valem os "princípios da impessoalidade, moralidade, transparência e economicidade" (p.21).
  - **Administração pública municipal** (item XIII, p.17): proposta vencedora, atas da comissão de licitação, adjudicação e homologação, pesquisa de preços e justificativa de dispensa ou inexigibilidade.
- **Publicidade** (p.20):
  - I – memorial descritivo da campanha;
  - II – autorização de divulgação ou contrato;
  - III – exemplar impresso;
  - IV – cópia do áudio ou vídeo com comprovante da emissora (datas e horários);
  - V – tabela oficial de preços do veículo e demonstrativo dos valores.
- **Transporte de pessoas:** relação de passageiros fornecida pelo transportador (p.21).
- **Glosa:** o termo "glosa" não aparece. Consequências citadas:
  - Devolução de despesa fora do plano de trabalho (p.13).
  - Ressarcimento de despesa fora da vigência (p.12).
  - Reposição de rendimentos não auferidos (p.12).
  - Pedido de apresentação de comprovante faltante; se não atendido, "informará o fato aos órgãos federais de fiscalização" (p.20). [?] A menção a "federais" num programa estadual parece texto herdado de outra norma.

## A.5 Comprovação do objeto e das metas

- **Relatório técnico de execução do objeto** (item I, p.16): atividades desenvolvidas e **comparativo metas propostas × resultados alcançados, com justificativas para metas não atingidas**. Há "modelo disponível no site da FESPORTE".
- **Relatórios técnicos parciais semestrais** (p.8):
  - I – etapas realizadas;
  - II – metas atingidas;
  - III – objetivos alcançados;
  - IV – resultados alcançados;
  - V – despesas realizadas;
  - VI – conformidade com o plano de trabalho e o cronograma físico-financeiro;
  - VII – aplicação exclusiva nas despesas previstas;
  - VIII – dificuldades;
  - IX – **registros fotográficos e comprovantes de execução de atividades**.
- **Evidências:**
  - Fotos, vídeos e mídias (item III, p.16).
  - Lista de treinados, capacitados, participantes e palestrantes, com **nome, CPF, assinatura**, tema, carga horária, local e data (item IX, p.17 e p.21).
  - Relação de todos os serviços prestados, assinada pelo gestor máximo (item XX, p.18).
  - Bolsa-atleta: súmulas e inscrições em competições oficiais (item XXII).
- **Marca:**
  - Fotografias que comprovem a **ativação da marca do Governo do Estado, FESPORTE e PIE** em materiais promocionais, uniformes, placas e demais formas previstas no plano de trabalho (item XXI, p.18).
  - Bens permanentes: fotos da **etiqueta, adesivo ou placa** com o "número do convênio" e menção ao Governo do Estado, FESPORTE e PIE (item XIV, p.17).
  - Manual de marca: não citado no documento. [web] Existe um "Manual da Marca PIE" no portal Prosas da FESPORTE.
- **Clipping:** não consta com esse nome. A fiscalização remota usa "mídias disponíveis" e "redes sociais" (p.11).
- **Indicadores de fiscalização** (p.10):
  - I – cumprimento do cronograma físico, em % de atividades no prazo;
  - II – aderência ao escopo;
  - III – resultados (quantitativo de beneficiários, etapas, metas);
  - IV – **taxa de execução financeira**, em % utilizado sobre o previsto;
  - V – conformidade das despesas.

## A.6 Prestação parcial × final

- **Parcial:**
  - Relatórios técnicos parciais **a cada 6 meses**, com o conteúdo descrito em A.5 (p.8).
  - "Relatório Parcial das atividades" a qualquer tempo, "havendo motivos justificados" (p.10).
  - Formulário próprio: não consta.
- **Final (p.16–18), entrega em dois canais:**
  - **Originais em papel** no protocolo da FESPORTE em Florianópolis, presencialmente ou pelos Correios.
  - **Digitalizada** no Prosas, no mesmo formulário da proposta, seção **"Relatório Financeiro de Prestação de Contas"**. "Cada campo é referente a um arquivo .pdf que pode conter um ou mais documentos."
  - Os documentos são digitalizados e organizados **em ordem cronológica** (IN FESPORTE 04/2025).
  - [?] [web] Conflito: a IN FESPORTE 04/2025 diria que **não é permitida a entrega em papel nem por outro meio que não o Prosas**. Também exigiria PDF colorido e assinado digitalmente via gov.br. O manual manda entregar os originais no protocolo.
- **Lista de itens da prestação final**, como está no manual:

| Item | Documento | Condição |
|---|---|---|
| I | Relatório técnico de execução do objeto (modelo FESPORTE) | sempre |
| II | Parecer do Conselho Fiscal | entidade privada sem fins lucrativos |
| III | Documentos da execução do objeto (fotos, vídeos, mídias) | sempre |
| IV | **Balancete de prestação de contas**, assinado pelo representante legal (modelo FESPORTE) | sempre |
| V | Extratos da conta corrente vinculada, do período completo | sempre |
| VI | Extrato da aplicação, com rendimento líquido do período | sempre |
| VII | Documentos fiscais de todas as despesas, com declaração de recebimento | sempre |
| VIII | Comprovantes complementares (fotos, folhas, relatório-resumo de viagem, ordens de tráfego, bilhetes, memorial descritivo, guias de encargos e tributos, faturas, duplicatas) | conforme a despesa |
| IX | Relação de treinados, participantes e palestrantes | treinamentos, cursos, palestras |
| X | Demonstrativo de horas técnicas | assessoria, consultoria, capacitação, seminários |
| XI | Comprovante de qualificação profissional | serviço regulamentado por conselho |
| XII | Contratos de serviços (e de PJ) | contratação de serviços |
| XIII | Documentos de licitação e pesquisa de preços | proponente da administração pública municipal |
| XIV | Fotos de bens permanentes com etiqueta ou placa | aquisição de bem permanente |
| XV | **Borderô** de receitas e despesas | projeto com outras fontes (municipais, estaduais, federais, patrocínio privado, bilheteria, inscrições, estandes) |
| XVI | Comprovantes de pagamento | sempre |
| XVII | **Guia de recolhimento e comprovante de devolução à FESPORTE do saldo não aplicado** | se houver saldo |
| (XVIII) | **ausente na numeração** [?] | — |
| XIX | Manifestação do controle interno municipal | proponente órgão municipal |
| XX | Relação de todos os serviços prestados, assinada pelo gestor máximo | sempre [?] |
| XXI | Fotos da ativação de marca (Governo do Estado, FESPORTE, PIE) | sempre |
| XXII | Bolsa-auxílio de atleta: documento com foto, transferências mensais para a conta do atleta, **recibos mensais assinados**, comprovantes de participação em competições oficiais, declarações de filiação à entidade proponente e à federação estadual sediada em SC | se pagar bolsa |
| "XX" (repetido) [?] | Outros documentos que o setor técnico julgar necessários | a critério da FESPORTE |

- **Devolução de saldo:**
  - Por guia de recolhimento à FESPORTE (item XVII).
  - Destinação de saldo e rendimentos em caso de captação abaixo de 20% (p.6).
  - Desistência: os recursos captados são recolhidos pela FESPORTE (p.5).
  - **Bens remanescentes:** o TC precisa ter cláusula de destinação (p.7). A regra de destinação não consta.

## A.7 Análise e resultado

- **Fiscalização durante a execução** (p.9–11):
  - Feita por análise documental e de veracidade dos relatórios parciais, por auditorias técnicas e financeiras (in loco ou remotas) e por pedidos de informação.
  - Executada por servidores da FESPORTE ou de outros órgãos estaduais designados.
  - Na visita in loco, a equipe se identifica e tem "amplo acesso".
- **Amostragem por faixa de valor captado e executado** (p.9):

| Faixa | Valor | Amostra | Forma |
|---|---|---|---|
| Baixo | até R$ 150.000,00 | 10% dos projetos | aleatória, remota ou presencial |
| Médio | R$ 150.000,01 a R$ 350.000,00 | 20% | presencial e aleatória |
| Alto | acima de R$ 350.000,00 | 40% | presencial e aleatória |

- **Diligências:**
  - Esclarecimentos em **10 dias úteis** (p.10).
  - Irregularidade: defesa ou regularização em **15 dias** (p.11).
  - "Justificativas inconclusas ou não acatadas poderão acarretar em possíveis sanções" (p.10).
- **Consequências citadas:** suspensão do repasse, cancelamento do projeto, "outras medidas administrativas cabíveis" (p.11), ressarcimento (p.12), devolução (p.13), arquivamento (p.5) e desclassificação (p.7).
- **Prazo de análise da prestação final:** não consta.
- **Resultados possíveis da análise final:** não consta.
  - [web] Pela IN FESPORTE 04/2025: "regular", "regular com ressalva" ou "irregular".
- **Recursos:** não consta.
  - [web] Pela IN FESPORTE 04/2025: recurso em **10 dias corridos** a contar do dia útil seguinte à intimação, dirigido à Presidência da FESPORTE, que decide em até **30 dias corridos**.

## A.8 Regras especiais

- **Defeso eleitoral:** não consta.
- **Desistência:** arquivamento e recolhimento dos recursos pela FESPORTE (p.5).
- **Bloqueio judicial:** comunicar de imediato e repor os valores (p.5).
- **Não devolução do TC em 10 dias:** desclassificação e convocação do próximo classificado (p.7).
- **Prorrogação da captação:** vedada (p.6).
- **Prorrogação da execução:** pedido ≥ 30 dias antes, por termo aditivo assinado antes do vencimento (p.15). O pedido deve conter:
  - I – justificativa detalhada;
  - II – novo cronograma físico;
  - III – novo cronograma físico-financeiro;
  - IV – metas, atividades, eventos e itens executados e a executar.
- **Prorrogação de ofício:** pelo período exato do atraso causado pela FESPORTE (p.14).
- **Alterações:** por apostilamento, aprovado antes da despesa. Há as faixas de dispensa de 10% e 20% (p.12, p.14).
- **Readequação após captação parcial:** o objeto não pode mudar (p.6).
- **Formulários:** "A FESPORTE poderá detalhar procedimentos e instituir formulários" no site (p.15).

## A.9 Modelos e anexos citados

| Nome (como no documento) | Finalidade | Onde |
|---|---|---|
| Relatório técnico de execução do objeto | Prestação final: atividades e metas × resultados | "modelo disponível no site da FESPORTE" (p.16) |
| Balancete de prestação de contas | Demonstrativo financeiro assinado pelo representante legal | "modelo disponível no site da FESPORTE" (p.16) |
| Formulário do projeto, seção "Relatório Financeiro de Prestação de Contas" | Upload da prestação no Prosas | Prosas (p.16) |
| Termo de Compromisso (com o Plano de Trabalho atualizado) | Instrumento de execução | p.7 |
| Termo aditivo | Prorrogação de prazo | p.15 |
| Carta de Captação | Autoriza a captação; vigência de 12 meses | p.6, p.10 |
| Guia de recolhimento | Devolução de saldo | p.18 |
| Borderô | Receitas e despesas com outras fontes | p.18 |
| Relatórios técnicos parciais | Monitoramento semestral | p.8 |
| Íntegras da IN FESPORTE 04/2025 e da Portaria 123/2025 | Hiperlinks no PDF para o Drive | p.2 — **inacessíveis** |

## A.10 Checagens automatizáveis (derivadas só do manual PIE)

1. **Janela de validade da despesa.** A data do documento fiscal e a data do pagamento devem ficar entre a assinatura do TC e o fim da vigência. Pagamento após a vigência só é aceito se a emissão ou competência estiver dentro da vigência (p.12, p.20).
2. **Destinatário do documento = proponente.** Conferir o CNPJ/CPF do destinatário na NF (p.12, p.19-I).
3. **Número do processo SGPE presente na NF.** Validar o campo de descrição ou informações complementares (p.19-II).
4. **NF completa.** Verificar descrição, quantidade, valor unitário e total, e que a soma dos itens bate com o total (p.19-III/IV).
5. **DANFE com chave de acesso.** Exigir a chave e permitir a verificação de autenticidade (p.19).
6. **Recibo só para contribuinte não obrigado a NF.** Checklist de campos: descrição, nome, endereço, CPF/CNPJ, valor em número e por extenso, deduções (p.19).
7. **Folha de pagamento.** Checklist de campos. Para cada competência com pessoal, exigir guias de INSS e FGTS e o comprovante do depósito (p.19–20).
8. **Atesto de recebimento** em toda despesa, com nome, cargo e assinatura do recebedor (p.17-VII, p.20).
9. **Meio de pagamento** ∈ {boleto, PIX, transferência}. Bloquear "saque". Conferir que o favorecido do pagamento é o credor da NF (p.12, p.18-XVI).
10. **Vínculo ao plano de trabalho.** Toda despesa ligada a um item aprovado; sem vínculo, alerta de devolução (p.13).
11. **Faixas de variação sem apostilamento.**
    - Preço unitário: até +10% sobre o item (ou grupo de despesa).
    - Quantidade: até ±20%.
    - Redução de preço: livre.
    - Acima disso, exigir apostilamento aprovado com data anterior à da despesa (p.12, p.14).
12. **Teto de 10% para elaboração e captação.** Calcular sobre o valor captado, sem rendimentos (p.13).
13. **Despesas vedadas.**
    - Categorias de bloqueio: multas, juros e correção; cessão ou transferência de atleta; religioso; festas restritas (p.13).
    - **Conflito de interesse:** cruzar o CPF/CNPJ do fornecedor e o quadro societário com dirigentes e parentes até o 2º grau (cadastro de dirigentes) (p.13-II).
14. **Captação.**
    - Total captado ≤ valor autorizado.
    - % captado: ≥ 20% para seguir ou encerrar antes; < 20% leva à restituição.
    - Contador de 12 meses improrrogáveis.
    - Alerta de 30 dias após o decurso (p.5–6).
15. **Prazos com alerta:**
    - Devolução do TC em 10 dias (p.7).
    - Relatório parcial a cada 6 meses (p.8).
    - Esclarecimentos em 10 dias úteis (p.10).
    - Defesa em 15 dias (p.11).
    - Pedido de prorrogação até 30 dias antes do fim da vigência (p.15).
16. **Rendimentos.**
    - Conciliar o saldo em conta corrente com o saldo aplicado; marcar dias com saldo não aplicado, porque o proponente repõe os rendimentos.
    - Separar rendimentos de captação.
    - Permitir uso de rendimentos em itens do plano sem apostilamento (p.12, p.14).
17. **Classificação de fiscalização** pelo valor captado e executado: baixo, médio ou alto (p.9).
18. **Indicadores** do painel do projeto (p.10):
    - % de atividades no prazo;
    - taxa de execução financeira (utilizado ÷ previsto);
    - beneficiários e metas atingidas.
19. **Checklist condicional da prestação final** (itens I–XXII):
    - Parecer do conselho fiscal se for OSC.
    - Licitação e controle interno se for órgão municipal.
    - Borderô se houver outras fontes.
    - Lista de passageiros se houver locação de veículo.
    - Lista de participantes se houver curso ou palestra.
    - Documentos de publicidade se houver mídia.
    - Fotos com etiqueta se houver bem permanente.
    - INSS e FGTS se houver pessoal.
    - Contratos se houver PJ.
    - Kit mensal se houver bolsa-atleta.
20. **Bolsa-atleta.** Para cada mês do benefício, exigir um comprovante de transferência para a conta do atleta e um recibo assinado (p.18-XXII).
21. **Montagem do pacote.** Documentos em ordem cronológica, um PDF por campo do formulário Prosas (p.16).
22. **Saldo final.** Saldo = captado + rendimentos − despesas comprovadas. Se for maior que zero, exigir guia e comprovante de devolução (p.18-XVII).
23. **Retenção.** Lembrete de guarda até 10 anos após o dia útil seguinte à prestação (p.19).

## A.11 Diferenças em relação às leis federais

Pela leitura do próprio documento, cruzando com as regras da Rouanet descritas no manual do Instituto Cultural Vale (Parte B):

| Tema | PIE (SC) | Rouanet (manual Vale) |
|---|---|---|
| Tributo | ICMS estadual (p.3) | IR federal (B, p.10) |
| Gestor | FESPORTE / DPOP / CMA / CAPE | SEFIC / CNIC |
| Instrumento | **Termo de Compromisso** assinado após o fim da captação, com Plano de Trabalho (p.7) | Aprovação e alterações por portaria no DOU (B, p.13), mais Declaração de Responsabilidade eletrônica. O manual não cita termo bilateral [inferência] |
| Contas | **1 conta** vinculada no BB; movimentação só após o TC (p.4–5) | **2 contas** (Captação e Movimentação) no BB (B, p.96–97) |
| Liberação | Encerrar a captação (≥ 20% ou 12 meses) + assinar o TC | Atingir 20% do homologado; transferência entre contas (B, p.97) |
| Aplicação financeira | Obrigatória **pelo proponente**, que repõe rendimentos não auferidos (p.5, p.12) | Automática (B, p.99) |
| Rendimentos | **Não** contam como captação (p.12) | Contam para os 20% (B, p.97) |
| Saque | **Vedado** em qualquer hipótese (p.12) | Até R$ 1.000,00 para pequenas despesas (B, p.100) |
| Limites de custos | 10% para elaboração + captação, juntos (p.13) | Captação ≤ 10% e ≤ R$ 100 mil; administração ≤ 15%; divulgação ≤ 20/30%; elaboração vedada (B, p.76–78, 89) |
| Remanejamento livre | +10% em preço unitário; ±20% em quantidade (p.14) | +50% por rubrica (B, p.107) |
| Entrega | Originais no protocolo + PDFs no Prosas (p.16) | 100% digital no SALIC (B, p.21, 112) |
| Documento fiscal | Deve citar o **processo SGPE**; 1ª via original; atesto de recebimento (p.19–20) | Não consta exigência equivalente |
| Acompanhamento | Relatórios parciais **semestrais** + fiscalização **amostral por faixa de valor** (p.8–9) | Comprovação contínua no SALIC (B, p.95, 104) |
| Prazo final | Não consta no manual. [web] 30 dias úteis | 60 dias (B, p.95) |
| Guarda | **10 anos** (p.19) | 5 anos (B, p.113) |
| Controle externo | IN TC-33/2024, do TCE-SC (p.2) | Órgãos de controle federais |
| Marca | Governo do Estado + FESPORTE + PIE (p.18) | Manuais de marca do PRONAC e do Vale-Cultura (B, p.108) |
| Esporte | Vedada cessão ou transferência de atleta; bolsa-atleta permitida com documentos mensais (p.13, p.18) | — |

Sobre a **Lei de Incentivo ao Esporte federal**: o manual PIE não a cita. A única diferença que dá para perceber pelo documento é a de natureza: tributo estadual (ICMS) e gestão pela FESPORTE, em vez de IR e órgão federal. Qualquer outra comparação com a LIE exigiria fonte externa.

---

# PARTE B — "ManualProjetosCulturais-07.pdf"

## B.0 Identificação

| Campo | Conteúdo |
|---|---|
| Título | "Manual de Elaboração e Gestão de Projetos Culturais para a Lei Federal de Incentivo à Cultura" (p.1–2). |
| Órgão/autor | **Não é um órgão público.** "Este manual é uma iniciativa da **Vale**, com realização do **Instituto Cultural Vale**" (p.2). Ficha técnica (p.3): elaboração e redação de Suellen Moreira e Henilton Menezes; revisão de Kátia Moreira; projeto gráfico de Eduardo Albuquerque; coordenação geral da Sociat Consultoria. Há videoaulas por módulo no site do Instituto Cultural Vale (institutoculturalvale.org). |
| Lei/mecanismo | **FEDERAL: Lei Rouanet** (Lei 8.313/1991, PRONAC), mecanismo "Incentivo a Projetos Culturais" (mecenato), com dedução de **Imposto de Renda** (p.9–10). **Não** é estadual, municipal, ProAC, ICMS nem ISS. |
| Órgão gestor citado | Secretaria Especial da Cultura, vinculada ao Ministério do Turismo. Gestão pela SEFIC. Aprovação com a CNIC (p.5, 9–11). |
| Versão/data | **Sem versão ou data no texto.** Metadados do PDF: InDesign, criado em 28/05/2021. O texto cita "(2020)" (p.100) e exemplos com datas de 2021 (p.52). O "-07" do nome do arquivo pode indicar edição ou versão [?]. O rodapé da última página (p.122) diz "Lei Federal de Incentivo à Cultura \| Guia do Patrocinador" [?], possivelmente resquício de outra publicação. |
| Base legal citada | Lei 8.313/1991; Decreto 5.761/2006; **IN nº 02/2019** (publicada pelo Ministério da Cidadania, p.70); Lei 12.761/2012 (Vale-Cultura); Lei 13.146/2015 (LBI); Decreto 9.404/2018; Lei 9.784/1999 (art. 26 §3º); IN RFB 1.131/2011; Decreto 71.733/1973. |
| Sistema | **SALIC** (cadastro, execução, comprovação financeira, marcas, prestação de contas), Salic Mobile, VerSALIC e Comparar (p.28–29). |
| Estrutura | 5 módulos: I Conceitos; II SALIC e primeiras etapas; III Planejamento técnico; IV Orçamento; **V Execução, Gestão e Prestação de Contas** (p.93–114). Anexos 1–3 (p.115–121). |

[web] **Atenção — o manual está desatualizado.** A IN 02/2019 que ele usa foi substituída. Segundo busca web, a norma vigente em 2025 é a **IN MinC nº 23, de 05/02/2025**, que consolidou normas anteriores, inclusive a IN 1/2023. Há notícia de nova revisão em andamento para 2026. Os números da Parte B refletem a IN 02/2019 e precisam ser revalidados contra a IN vigente antes de virarem regra de software.

## B.1 Linha do tempo e prazos

| # | Etapa | Prazo / regra | Marco | Pág. |
|---|---|---|---|---|
| 1 | Apresentação de propostas | 1º/fev a 30/nov de cada ano (IN 02/2019, art. 2º §2º) | Ano civil | p.17–18 |
| 2 | Início do projeto | No mínimo **90 dias** após o envio da proposta | Envio da proposta | p.38 |
| 3 | Admissibilidade | Diligência padrão com checklist | — | p.21–22 |
| 4 | Enquadramento | Proposta "disponível por 5 dias para CNIC avaliar enquadramento"; depois a Portaria de autorização para captação no DOU | — | p.23–24 (Fig. 1) |
| 5 | Contas | Abertas pela Secretaria "em alguns dias" após o DOU; o proponente regulariza na agência do BB | DOU | p.22, p.96 |
| 6 | Análise técnica | Requer captação ≥ **10%**, com exceções listadas. Parecer técnico em **30 dias** (Fig. 1). Depois CNIC e homologação | % captado | p.23–24 |
| 7 | Movimentação | Ao atingir **20%** do homologado para execução. Planos anuais e plurianuais: 1/12, 1/24, 1/36 ou 1/48 | — | p.97 |
| 8 | Captação | Só dentro do período autorizado. Depósito fora do prazo ou valor: estorno justificado **em até 30 dias**, senão os recursos vão ao FNC | — | p.98 |
| 9 | Pessoa física incentivadora | Depósito até o último dia útil do ano; o proponente emite o "Recibo de Mecenato" | Ano fiscal | p.18 |
| 10 | Execução além de 31/12 | Marcar "Prorrogação automática = SIM" | Ano fiscal | p.38 |
| 11 | Comprovação financeira | **Contínua**: "à medida que os correspondentes débitos tiverem sido lançados no extrato bancário" (art. 47 §1º) | Débito no extrato | p.95, p.104 |
| 12 | Alteração do projeto | Pedido **≥ 30 dias antes** do início da meta ou ação; a Secretaria tem **30 dias** para analisar | Início da meta | p.105–106 |
| 13 | Peças de divulgação | Aprovação prévia no SALIC; a Secretaria responde em **5 dias úteis** | Submissão | p.109 |
| 14 | **Prestação de contas final** | Relatório final no SALIC em **até 60 dias** (art. 48) | **Fim do prazo de execução** | p.95, p.112 |
| 15 | Análise da prestação final | Prazo não consta. O manual alerta que "pode levar mais tempo" que 5 anos | — | p.113–114 |
| 16 | Guarda | **5 anos** contados da avaliação dos resultados (art. 57 §2º). Recomenda guardar até a publicação da aprovação da prestação | Avaliação dos resultados | p.113–114 |
| 17 | Sanção | Impedimento de operar o sistema "por até 3 anos" | — | p.114 |

[?] Na p.112: "Os campos a serem preenchidos só ficarão disponíveis no SALIC na etapa de prestação de contas, ou seja, 60 dias a partir da data final de execução". Não fica claro se os campos abrem durante os 60 dias ou só depois deles. O art. 48 (p.95) diz "no prazo máximo de 60 dias".

## B.2 Contas, meios de pagamento, rendimentos, tarifas

- **Duas contas no Banco do Brasil**, "único banco autorizado a operar com recursos da Lei" (p.22):
  - **Conta Captação:** recebe aportes e não pode ser movimentada.
  - **Conta Movimentação:** recebe as transferências (p.96–97).
  - Abertas pela Secretaria em nome do proponente, na agência escolhida (código de 5 dígitos sem DV, p.38).
  - Depósito em conta não regularizada é estornado (p.22).
  - Guardar o "Contrato de Abertura da Conta" (p.22).
- **Transferências:** a 1ª da Captação para a Movimentação é feita pela SEFIC a pedido do proponente; as seguintes são automáticas (p.99).
- **Aplicação:** automática em fundo de curto prazo ou operação lastreada em título da dívida pública federal (art. 32 §2º). O manual recomenda conferir com o banco, porque a responsabilidade pelo não investimento "costuma ser imputada ao proponente" (p.99).
- **Rendimentos:**
  - Usados exclusivamente no projeto, "dentro das mesmas regras e limites" (p.99).
  - Contam para o índice de 20% (art. 30, p.97).
  - Saldo final, rendimentos incluídos, recolhido ao **FNC** (p.95, p.100).
- **Tarifas:**
  - Contas **isentas** das tarifas necessárias à execução; a lista está no Anexo V da IN (p.99).
  - Outras taxas são pagas com recursos próprios (p.99).
  - "Taxas bancárias" são despesa vedada (art. 17 VI, p.90).
- **Meios de pagamento:**
  - A IN previa uso exclusivo de cartão magnético ou do gerenciador financeiro do BB, "ainda não implementado (2020)".
  - Valem transferências eletrônicas, boletos, guias, depósitos e **cheques** (p.100).
  - **Saque até R$ 1.000,00** para pequenas despesas, só quando a transferência for inviável. Alternativa: ressarcimento até R$ 1.000,00 ao gestor ou coordenador, com os documentos fiscais (p.100).
- **Extratos a guardar mensalmente** (p.100), nomeados por mês:
  - Conta corrente da Conta Captação;
  - aplicações da Conta Captação;
  - conta corrente da Conta Movimentação;
  - aplicações da Conta Movimentação.

## B.3 Orçamento

- **Estrutura no SALIC** (p.75–84, Fig. 26 na p.104):
  - Custos Vinculados, com percentuais calculados pelo sistema.
  - Custos por Produto, organizados assim: **Produto → Local (UF/Município) → Etapa → Item**.
  - As etapas são: Pré-Produção/Preparação; Produção/Execução; Pós-Produção; Assessoria Contábil e Jurídica; Recolhimentos.
- **Campos de cada item:**
  - Item, escolhido de uma tabela fechada de rubricas.
  - Unidade: cachê, dia, metro, hora, obra, projeto, unidade, verba etc.
  - Quantidade de dias: obrigatória, sem efeito no cálculo.
  - Quantidade, Ocorrência e Valor unitário. **Total = quantidade × ocorrência × valor unitário** (p.81).
  - Fonte de Recurso.
  - Detalhamento/Justificativa/Observações.
- **Preço de referência:**
  - O SALIC mantém a média de valor unitário por rubrica e por cidade. Acima dela, a justificativa é **obrigatória** e o item não salva sem ela (p.81, 84).
  - Na planilha final, rubricas em laranja estão acima do limite e precisam de justificativa (p.91).
  - Uma nova rubrica pode ser pedida em "Solicitar inclusão de itens" (p.86).
- **Outras fontes:** itens custeados por outras fontes somam ao total do projeto, mas **não são analisados nem exigem comprovação fiscal** (p.83).
- **Custos vinculados (tetos):**
  - Administração **≤ 15%** do Valor do Projeto (IN art. 10; Decreto art. 26).
    - Despesas admitidas: material de escritório, aluguel administrativo, correios, transporte administrativo, telefone, água, luz e internet, pessoal administrativo e encargos.
    - Se uma única rubrica passar de **50%** do custo de administração, exige justificativa de economicidade (p.76–77).
  - Divulgação **≤ 30%** em projetos até R$ 300.000,00 e **≤ 20%** nos demais (art. 9º, p.77).
  - Remuneração de captação **≤ 10%** do Custo do Projeto, com teto de **R$ 100.000,00**. Paga **proporcionalmente às parcelas captadas** (art. 8º, p.78).
  - Os custos vinculados mantêm o percentual **sobre o valor captado** (p.103). Exemplo: captado R$ 200 mil gera limites de 15% = R$ 30 mil, 20% = R$ 40 mil e 10% = R$ 20 mil.
  - Pagar captação acima do teto por outras rubricas "é ilegal". Projeto captado integralmente por edital não pode usar a rubrica de captação (p.103).
  - Somados no máximo, os vinculados podem elevar o total em até 45% (p.78).
- **Tetos por tipicidade** (art. 4º):
  - Singulares: até R$ 1.000.000,00.
  - Específicos: até R$ 6.000.000,00.
  - Especiais: sem limite (p.33–34).
- **Tetos por tipo de proponente** (Tab. 2, p.35; não se aplicam a projetos especiais):

| Proponente | Limite | Projetos ativos | Em espaços públicos | N, NE ou CO | MG, ES ou Sul |
|---|---|---|---|---|---|
| MEI / pessoa física | R$ 1 mi | até 4 | +2 | +R$ 750 mil | +R$ 375 mil |
| Demais EI | R$ 6 mi | até 8 | +3 | +R$ 3,75 mi | +R$ 1,875 mi |
| EIRELI, Ltda, demais empresas e OSCs | R$ 10 mi | até 16 | +4 | +R$ 30 mi | +R$ 15 mi |

- **Outros limites:**
  - Cachê por apresentação: artista solo R$ 45.000; grupo R$ 90.000; músico de orquestra R$ 2.250; maestro R$ 45.000. Valor acima exige justificativa e passa pela CNIC (p.88).
  - Direitos autorais e conexos **≤ 10%** do valor homologado. Custeio de execução pública de música (entidades de gestão coletiva) só se **não houver cobrança de ingresso** (art. 13, p.88–89).
  - Remuneração do proponente **≤ 50%** do homologado (art. 11, p.55).
  - **Per capita ≤ R$ 250,00** (art. 4º II, p.90).
  - Audiovisual: limites próprios no art. 15 (p.38, p.88).
- **Rubricas obrigatórias:**
  - **Contador**: previsão e contratação obrigatórias, com registro no conselho.
  - **Advogado**: previsão obrigatória, contratação opcional (art. 6º §§2º–3º, p.87, p.103–104).
  - Acessibilidade no orçamento (art. 18 §1º, p.87).
  - Produto "Contrapartidas Sociais" (p.68).
  - Vale-Cultura para empregados CLT (art. 2º §6º, p.72).
- **Material permanente:** só se for mais econômico que a locação ou indispensável. Exige **cotação prévia com pelo menos 3 fornecedores** e declaração de destinação cultural (art. 14, p.85–86, p.102).
- **Despesas vedadas** (art. 17, p.89–90):
  - I – elaboração de proposta e taxa de administração;
  - II – benefício a agente público;
  - III – convites personalizados, recepções, festas, coquetéis e bufê, exceto refeições da equipe e de participantes de ações educativas;
  - IV – passagem em 1ª classe ou executiva, salvo exceção;
  - V – captação em proposta com patrocínio exclusivo de edital ou de instituição criada pelo patrocinador;
  - VI – **taxas bancárias, multas, juros ou correção monetária**;
  - VII – espaço de rádio e TV no audiovisual, exceto inserções de divulgação do produto principal.
  - Vedações gerais: difusão de imagem de agente político (art. 16, p.73), intermediação (art. 28 da Lei; art. 41 da IN; p.16) e vantagem ao patrocinador (Lei art. 23 §1º, p.70).
- **Alteração de orçamento** (p.107–108):
  - Cada rubrica pode subir **até 50%** sem autorização prévia, desde que o valor total não mude. Acima disso, é preciso pedir.
  - **Não** se alteram os custos vinculados.
  - Pedidos só após **20% captado**, com exceções.
  - **Complementação de até 50%** exige ≥ 50% captado, novo detalhamento e ampliação de metas.
  - **Redução de até 50%** exige ≥ 20% captado.
  - Readequação da mesma natureza **só 1 vez**, exceto em planos anuais ou caso fortuito.

## B.4 Documentos comprobatórios

- **Padrão:** documento fiscal válido, seja NF de serviço ou de produto, cupom fiscal ou contracheque CLT (p.101).
- **Recibo como exceção:** por exemplo, aluguel de teatros públicos ou serviços de instituições sem fins lucrativos, "dependendo da legislação local".
- **Fornecedor informal:** NF avulsa na prefeitura (p.101).
- **Fornecedor habilitado:** conferir o CNAE no cadastro de CNPJ da Receita (p.101).
- **Lista do art. 47 §1º** (p.95):
  - I – licitação ou justificativa de dispensa (administração pública);
  - II – cotações de preços;
  - III – NFs, recibos, **RPCI** (Recibo de Pagamento a Contribuinte Individual), faturas, contracheques;
  - IV – **memória de cálculo do rateio**;
  - V – comprovante de recolhimento ao FNC do saldo e dos rendimentos.
- **Pagamento:**
  - Evitar mais de um pagamento por transferência. "Um comprovante de pagamento para cada nota fiscal"; se não for possível, juntar memória de cálculo.
  - Rateio com memória de cálculo, e "o valor da transferência na conta do projeto deve ser igual ao valor proporcional calculado" (p.101–102).
- **Contratos:** recomendados para serviços continuados (p.101).
- **Cotações:** obrigatórias (3) só para material permanente. Para consumo, alimentação e combustível, não precisam ser apresentadas (p.102).
- **Registro no SALIC, aba "Comprovação Financeira"** (Fig. 27, p.105). Campos do comprovante:
  - Nacional/Internacional;
  - Tipo de fornecedor (CPF/CNPJ), CPF/CNPJ e Nome;
  - Tipo de comprovante (ex.: Cupom Fiscal), Data de emissão, Número, Série e arquivo;
  - Forma de pagamento (ex.: Cheque), Data do pagamento, Nº do documento de pagamento e Valor, mostrado como "(atual: 0)(max: 4.000,00)";
  - Justificativa.
  - [inferência] O campo valor parece limitado ao saldo a comprovar da rubrica.
- **Guarda:** cópias de NFs térmicas, que apagam com o tempo (p.113).
- **Glosa:** termo não usado. Motivos implícitos:
  - Despesa vedada.
  - Valor acima do limite, com a diferença paga por outra fonte (p.90).
  - Captação acima do teto (p.103).
  - "**Ausência de evidências do cumprimento do plano de distribuição é um dos principais motivos de reprovação**" (p.110).

## B.5 Comprovação do objeto e das metas

- **Art. 48** (p.95–96), conteúdo do relatório final:
  - I – realização do objeto com evidências;
  - II – **metas × resultados** a partir do cronograma físico;
  - III – produtos e serviços (exemplar, fotos, listas de presença, arquivos digitais, registro audiovisual);
  - IV – etapas com comprovantes conforme o Plano de Execução e a Planilha;
  - V – **acessibilidade**;
  - VI – **democratização do acesso**;
  - VII – amostras e registros das **peças de divulgação**;
  - VIII – relação de bens móveis e obras adquiridos, com a cotação do art. 14;
  - IX – bens imóveis;
  - X – termo de aceitação definitiva de obra de engenharia;
  - XI – **recibo do destinatário** de bem permanente doado a outra entidade cultural.
- **Evidências em geral** (p.93–94): "TUDO que for feito no projeto tem que ser registrado". Exemplos:
  - fotos, vídeos e NFs;
  - cópias de transferências;
  - listas de presença assinadas;
  - recibos de entrega ou venda de produtos;
  - links;
  - matérias, entrevistas e divulgações.
  - "Apenas afirmar que foi realizado algo não cumpre a legislação."
- **Plano de distribuição:** cumprido na proporção do captado. Exemplo: 50% captado exige 50% da distribuição. Evidências aceitas: borderôs, listas de presença, arquivos digitais, registros audiovisuais, comprovantes de distribuição gratuita, declarações de recebimento de instituições e patrocinadores (p.109–110).
- **Responsabilidade social:** acessibilidade, democratização e contrapartidas, com evidências como fotos, filmagens, declarações de escolas e instituições, cópias de materiais (p.110).
  - Na execução parcial, **nunca** se dispensam as medidas dos produtos executados (p.110–111).
  - Ações formativas: ≥ 10% do público, mínimo 20 e máximo 1.000 beneficiários, com 50% de estudantes e professores da rede pública (art. 22, p.48–50).
- **Cronograma:** apresentar o cronograma cumprido e justificar alterações (p.109).
- **Divulgação e marcas:**
  - Seguir os manuais de marca do **PRONAC** e do **Vale-Cultura**.
  - Informar as medidas de acessibilidade no material (art. 18 §2º).
  - **Toda peça** é submetida na aba "MARCAS" do SALIC **antes da produção**; aprovação em 5 dias úteis (p.108–109).
- **Produtos físicos** (filme, CD, DVD, livro): enviar à Secretaria em Brasília no suporte original e fazer os depósitos legais (art. 48 §§2º–3º, p.112–113).
- **Público:** "na prestação de contas do projeto o público deverá ser comprovado", porque o per capita é calculado sobre ele (p.91).

## B.6 Prestação parcial × final

- **Parcial:** não há "prestação parcial" formal. O que existe é **comprovação financeira contínua** no SALIC: cada despesa é registrada logo após o pagamento, com gráfico de comprovado e a comprovar e colunas Aprovado / Total Comprovado / Faltando Comprovar (p.104–105).
- **Final:** aba **"PRESTAÇÃO DE CONTAS"** do SALIC (p.111), com 7 relatórios. Os 5 primeiros podem ser consultados durante a execução:
  1. Relação de Pagamentos;
  2. Execução da Receita e Despesa;
  3. Relatório Físico;
  4. Pagamentos por UF/Município;
  5. Pagamentos Consolidados;
  6. **Relatório do Cumprimento do Objeto**;
  7. **Laudo Final**. [?] O manual não explica o Laudo Final.
- **Relatório do Cumprimento do Objeto** (p.112): texto livre, sem campos detalhados. Deve cobrir:
  - etapas, objetivos e metas alcançados;
  - resumo da movimentação financeira;
  - acessibilidade e democratização do acesso cumpridas;
  - medidas preventivas de impacto ambiental;
  - empregos e qualificações gerados.
  - Sempre **comparando o aprovado com o cumprido** e indicando execução TOTAL ou PARCIAL na proporção do captado.
- **Devolução de saldo:** recolhimento ao **FNC** do saldo e dos rendimentos, com comprovante (p.95, p.100).

## B.7 Análise e resultado

- **Acompanhamento** (p.25–26): cruzamento das informações inseridas no SALIC "utilizando modelos fornecidos pelos órgãos de controle", além de denúncias e indícios. Pode haver pedidos de informação e **visitas in loco**.
- **Comunicação oficial:** é a feita pelo SALIC (art. 68). O endereço cadastrado é considerado válido (p.93).
- **Diligências:**
  - Na admissibilidade (p.21–22).
  - Regularidade fiscal: a Secretaria emite CND, CRF e consulta o CADIN; se não conseguir, há diligência (p.20).
  - Diligências na prestação final: não consta.
- **Prazo de análise da prestação final:** não consta.
- **Resultados:** o manual menciona "**reprovação** de prestação de contas" (p.110) e a publicação da "**Aprovação** da Prestação de Contas" (p.114). Categorias formais (como aprovação com ressalvas): não consta.
- **Consequências** (cap. VIII da IN, p.114):
  - bloqueio das contas do projeto;
  - impedimento de operar o sistema por até 3 anos;
  - devolução com correção monetária e multas;
  - parcelamento de dívidas.
- **Recursos:**
  - Na fase de proposta: pedido de **reconsideração** se indeferida; recurso contra o enquadramento (Fig. 1, p.24).
  - Contra a decisão da prestação de contas: não consta.

## B.8 Regras especiais

- **Defeso eleitoral:** não consta.
- **Alterações** (arts. 36–41, p.105–107):
  - Podem mudar: proponente, ficha técnica, cronograma, agência, fontes, período de execução, orçamento e nome do projeto (com anuência do autor).
  - Novo local exige planilha, plano de distribuição, acessibilidade e cronograma novos.
  - Nova fonte de financiamento exige planilha e comprovantes (extrato, contrato de patrocínio, edital), e o valor é **abatido** do homologado.
  - **Troca de proponente** exige anuência dos patrocinadores e experiência comprovada, e não pode caracterizar intermediação.
- **Prorrogação:** campo "Prorrogação automática" quando a execução passa de 31/12 (p.38). O período de execução se altera pelo art. 36.
- **Cancelamento:** não consta. Arquivamento de proposta quando o proponente tem função irrelevante (p.55); captação fora do prazo leva os recursos ao FNC (p.98).
- **Execução parcial:** permitida, proporcional ao captado (p.94, 109–111).
- **Patrocinador:** até 10% dos produtos para o conjunto de patrocinadores. O art. 44 lista o que **não** é vantagem indevida. É proibido pagar sessão exclusiva (p.70–72).
- **Normas desatualizadas:** o manual pede que o proponente acompanhe mudanças, que podem afetar projetos em curso (p.14, p.93).

## B.9 Modelos e anexos citados

| Nome | Finalidade | Pág. |
|---|---|---|
| Anexo 1 – Lista dos principais documentos necessários para inscrição (reproduz o Anexo III da IN) | Documentos do proponente e da proposta | p.116–117 |
| Anexo 2 – Lista de produtos disponíveis no SALIC (70 produtos) | Produtos do plano de distribuição e do orçamento | p.118 |
| Anexo 3 – Segmentos por área no SALIC | Enquadramento (área e segmento) | p.119–121 |
| Declaração de Responsabilidade (Anexo II da IN) | Aceite eletrônico no SALIC | p.20, p.32, p.93, p.106 |
| Recibo de Mecenato | Comprovante fiscal ao incentivador | p.18 |
| Contrato de Abertura da Conta | Comprova a abertura ao patrocinador | p.22 |
| Carta de Anuência | Anuência de artista essencial ao projeto | p.117 |
| Procuração com firma reconhecida | Usuário do SALIC diferente do proponente | p.70, p.117 |
| Manual de Marcas do PRONAC; Manual de Marcas do Vale-Cultura | Divulgação | p.13, p.108 |
| Anexos da IN 02/2019: I (definições como Valor do Projeto, Custo do Projeto, Valor por Pessoa Beneficiada), IV (segmentos do art. 18), V (tarifas isentas), VII (CNAEs) | Referências normativas | p.16, p.17, p.63, p.90, p.99 |
| 7 relatórios da aba "Prestação de Contas" do SALIC (ver B.6) | Prestação final | p.111 |
| Sugestão de planilha (Item, Dias, Unidade, Qtde, Ocor., Valor unitário, Valor total solicitado, Justificativa) | Montagem do orçamento | p.80 |
| Memória de cálculo (rateio, múltiplos pagamentos) | Comprovação | p.95, p.101–102 |
| Termo de aceitação definitiva da obra | Obras e engenharia | p.96 |

## B.10 Checagens automatizáveis (derivadas só do manual Vale / IN 02/2019 — revalidar contra a IN vigente)

1. **Custos vinculados sobre o captado.**
   - Administração ≤ 15%.
   - Divulgação ≤ 30% (projeto ≤ R$ 300 mil) ou ≤ 20%.
   - Captação ≤ 10% e ≤ R$ 100 mil, paga só na proporção do captado (p.76–78, 103).
2. **Administração:** alerta se uma rubrica passar de 50% do custo de administração (p.77).
3. **Tetos de rubrica:** cachês por apresentação; direitos autorais ≤ 10%; execução pública de música só sem ingresso; proponente ≤ 50% (p.55, 88–89).
4. **Per capita** = custo total ÷ público ≤ R$ 250, recalculado com o **público comprovado** (p.90–91).
5. **Plano de distribuição** (art. 20):
   - Gratuito social ≥ 20%.
   - Patrocinadores ≤ 10%.
   - Divulgação ≤ 10%.
   - Popular (≤ R$ 50) ≥ 10%.
   - Livre ≤ 50%, com preço médio ≤ R$ 225.
   - Meia-entrada = 50% dos vendidos.
   - Bilheteria ≤ custo total (p.62–68).
   - [?] Inconsistência interna: o resumo da p.48 fala em "20% divulgação" e "20% até R$ 50"; o texto do art. 20 (p.62) e o autopreenchimento do SALIC (p.67) usam 10%.
6. **Ações formativas:** ≥ 10% do público previsto, mínimo 20, máximo 1.000, com 50% de rede pública (p.49–50).
7. **Remanejamento:**
   - Variação por rubrica ≤ +50% sem pedido.
   - Total inalterado.
   - Bloquear alteração em custos vinculados.
   - Pedido só após 20% captado.
   - 1 readequação por natureza (p.107–108).
8. **Liberação:** captado + rendimentos + bens e serviços mensuráveis ≥ 20% do homologado (p.97).
9. **Captação:** depósito fora do período ou acima do valor gera alerta de estorno em 30 dias (p.98).
10. **Conciliação contínua:** todo débito do extrato da Conta Movimentação precisa de comprovante registrado (art. 47 §1º, p.95).
11. **Um pagamento por NF.** Transferência com várias NFs exige memória de cálculo. Rateio: valor transferido = valor proporcional (p.101–102).
12. **Saques** ≤ R$ 1.000,00, com justificativa de inviabilidade de transferência (p.100).
13. **Material permanente:** ≥ 3 cotações anexas, declaração de destinação cultural e, se doado, recibo do destinatário (p.96, 102).
14. **Valor comprovado ≤ saldo a comprovar da rubrica**, como o SALIC mostra em "max" (Fig. 27, p.105). [inferência]
15. **CNAE do fornecedor** compatível com o item (p.101).
16. **Despesas vedadas** (art. 17): tarifas bancárias, multas e juros, bufê e festas, 1ª classe ou executiva, elaboração de proposta (p.89–90).
17. **Contador contratado e comprovado** antes do fechamento (p.103).
18. **Prazos com alerta:**
    - Prestação final em 60 dias após o fim da execução (p.95).
    - Alteração ≥ 30 dias antes da meta (p.106).
    - Peça de divulgação aprovada antes da produção, SLA de 5 dias úteis (p.109).
19. **Peças de divulgação:** checklist de marcas (PRONAC/Vale-Cultura) e informação de acessibilidade (p.108).
20. **Execução proporcional:** % de metas e de distribuição ≈ % captado. Responsabilidade social obrigatória para cada produto executado (p.94, 109–111).
21. **Extratos:** 4 tipos por mês (p.100).
22. **Saldo final** > 0 exige comprovante de recolhimento ao FNC (p.95, 100).
23. **Guarda:** 5 anos após a avaliação dos resultados, com lembrete até a aprovação publicada (p.113–114).
24. **Cronograma:** duração das etapas = período do projeto (p.52).

## B.11 O que é diferente das leis federais

- **Não se aplica no sentido pedido:** o documento **é** sobre a lei federal (Rouanet), escrito por um patrocinador privado (Vale/Instituto Cultural Vale). Não descreve lei estadual nem municipal.
- **O ponto crítico é a defasagem normativa.** O manual se baseia na IN 02/2019, na Secretaria Especial da Cultura do Ministério do Turismo e no "Ministério da Cidadania". [web] A norma vigente é a IN MinC 23/2025.
- **Pontos marcados como provisórios no próprio texto:**
  - Cartão magnético e gerenciador financeiro "ainda não implementado (2020)" (p.100).
  - Uso de cheques e de saque de até R$ 1.000 (p.100).
  - Esses são candidatos fortes a terem mudado.
- **Viés de patrocinador:** o manual dá ênfase a regras de contrapartida ao patrocinador (p.70–72) e termina com o rodapé "Guia do Patrocinador" (p.122) [?].

---

# PARTE C — Implicações para o modelo de dados do Jards (síntese das duas fontes)

- **Regras por programa, não fixas no código.** Tetos e prazos variam muito: 10% contra 15/20/30/10%; +10%/±20% contra +50%; 60 dias contra 30 dias úteis [web]; 5 contra 10 anos; 1 conta contra 2 contas. Precisam ser parâmetros versionados, porque a IN muda e o manual Vale já está defasado.
- **Hierarquia de orçamento:**
  - Rouanet: Produto → Local → Etapa → Item, com quantidade × ocorrência × valor unitário.
  - PIE: Plano de Trabalho → itens e grupos de despesa, com metas e etapas.
  - O modelo precisa suportar as duas formas.
- **Entidades necessárias:**
  - Conta bancária com tipo (captação, movimentação, única) e extratos de conta corrente e de aplicação por mês.
  - Aporte ou captação.
  - Despesa: documento fiscal, comprovante de pagamento e atesto, ligada a um item orçamentário.
  - Rateio e memória de cálculo.
  - Apostilamento ou alteração, com data de aprovação, que precisa ser anterior à da despesa no PIE.
  - Relatório parcial e relatório final.
  - Evidência: foto, lista de presença, borderô, clipping, peça de divulgação com status de aprovação.
  - Devolução de saldo (guia).
  - Bem permanente: cotações, etiqueta e destinação.
  - Beneficiário de bolsa, com kit mensal.
- **Eventos de prazo com marco configurável:** publicação, assinatura do TC, fim da vigência, notificação. Cada prazo precisa de um flag de dias úteis ou corridos, porque ambos aparecem e às vezes o tipo não é especificado [?].

---

# Fontes web consultadas (só para confirmação de normas)

- [Instrução Normativa FESPORTE Nº 4 de 02/10/2025 — LegisWeb](https://www.legisweb.com.br/legislacao/?id=484686)
- [Decreto Nº 780 de 03/12/2024 (SC) — LegisWeb](https://www.legisweb.com.br/legislacao/?id=469833)
- [Decreto Nº 780 de 3/12/2024 — Cenofisco](https://www.cenofisco.com.br/Documento/Legislacao-Especifica/ICMS-e-Outros/Sul/Santa-Catarina/Titulo/DECRETO-N-780-DE-3-DE-DEZEMBRO-DE-2024/286ffa24678b99e8e0637f0110ac99b0?tipoEmail=fiscal)
- [Programa de Incentivo ao Esporte (PIE) — portal Fesporte no Prosas](https://fesporte.prosas.com.br/)
- [Manual da Marca PIE (Prosas)](https://fesporte.prosas.com.br/assets/assets/files/MANUAL_MARCA_PIE_.pdf)
- [Portaria 123 PIE (extrato DOE, Prosas)](https://fesporte.prosas.com.br/assets/files/PORTARIA%20123%20PIE.pdf)
- [Perguntas e respostas sobre o PIE — FESPORTE](https://www.fesporte.sc.gov.br/eventos/geral/item/5108-perguntas-e-respostas-sobre-o-pie/5108-perguntas-e-respostas-sobre-o-pie)
- [Instrução Normativa N. TC-33/2024 — TCE-SC](https://www.tcesc.tc.br/node/60696)
- [IN TC-33/2024 consolidada (PDF) — TCE-SC](https://www.tcesc.tc.br/sites/default/files/leis_normas/INSTRU%C3%87%C3%83O%20NORMATIVA%20N.%20TC%2033-2024%20CONSOLIDADA.pdf)
- [Instrução Normativa MINC Nº 23 de 05/02/2025 — LegisWeb](https://www.legisweb.com.br/legislacao/?id=472998)
- [IN nº 23/25: Novas regras da Lei Rouanet — IDEA](https://institutodea.com/artigo/in-no-23-25-novas-regras-da-lei-rouanet/)
- [MinC inicia revisão da IN da Lei Rouanet (2026) — Desenvolvimento Artístico](https://www.desenvolvimentoartistico.com/single-post/a-regra-do-jogo-vai-mudar-de-novo-minc-inicia-revis%C3%A3o-oficial-da-lei-rouanet-o-que-muda-para-sua)

Nenhum domínio gov.br foi acessado por fetch. As confirmações vieram apenas dos resumos de resultados de busca.
