# ANCINE: lacunas do Manual de PC v2.11 (pesquisa web, 01/10/2026)

Complementa o "Manual de Prestação de Contas" v2.11 (23/09/2026), que já foi lido. O que o manual cobre não foi repetido aqui.

---

## 0. Limitações desta pesquisa (leia antes)

1. **WebFetch ficou bloqueado para todos os domínios testados, e não só para gov.br.** O proxy de saída devolveu `EGRESS_BLOCKED` em:
   - brde.com.br
   - scribd.com
   - cqsfv.com.br
   - legisweb.com.br
   - regulacaoemnumeros-direitorio.fgv.br
   - telaviva.com.br
   - panoramaaudiovisual.com.br
   - pt.wikipedia.org

   Por isso nenhum PDF ou página foi lido diretamente.
2. **A cota de WebSearch da sessão (200 buscas, compartilhada) acabou** no meio dos itens (a). As lacunas (c), (d) e (e) ficaram com pouca ou nenhuma busca própria.
3. **Tudo o que segue vem de resumos e trechos devolvidos pelo buscador**, com cerca de 35 consultas. Esses resumos citam trechos dos PDFs da ANCINE, mas o resumidor pode errar. Por isso:
   - a confiança **máxima** é **média** para conteúdo, mesmo quando o rótulo apareceu igual em várias buscas;
   - a confiança é **alta** apenas para a **existência** de documentos e URLs.
4. Marcações usadas:
   - **[?]** indica um ponto incerto ou uma inferência minha;
   - **"não encontrado"** traz junto o que foi buscado.
5. Recomendação prática: baixar manualmente os arquivos da seção 6 (gov.br e BRDE) e entregá-los localmente para extração definitiva. A fonte mais confiável do layout são os próprios modelos `.xls`. Em projetos BB Gestão Ágil, a fonte é a RP pré-preenchida que o STR gera.

---

## 1. Lacuna (a): planilhas do STR (RP, DE, DO)

### 1.1 Visão geral do STR

| Afirmação | Confiança | Fonte |
|---|---|---|
| O STR (Sistema de Triagem Financeira) recebe, em planilha eletrônica, os três formulários financeiros de **todos** os projetos, inclusive os do FSA: Relação de Pagamentos (RP), Demonstrativo Orçamentário e Financeiro (DO) e Demonstrativo do Extrato da Conta Corrente (DE). | média | S1, S2, S3 |
| Caminho de acesso: Sistema ANCINE Digital → menu "OUTROS SERVIÇOS" → "Triagem Financeira" → "Enviar planilhas do projeto". | média | S1/S3 (resumo do buscador sobre o Manual STR) |
| Envia-se **um DE para cada conta**, de captação e de movimentação. | média | S1, S2 |
| O STR só aceitava planilhas salvas como "Pasta de Trabalho do Excel 97-2003" (.xls). Os modelos disponíveis na IN 124/2015 já vinham nesse formato. **[?] Não confirmei se isso continua valendo em 2026.** | baixa | resumo do buscador (Manual STR, era IN 124) |
| Os modelos de planilha estavam no anexo da IN 124/2015. Existe o arquivo `in-124-demonstrativo-orcamentario.xls` em gov.br. | alta (existência) | S9 |
| Ao carregar a RP, o STR aponta "críticas" e gera um relatório delas. Exemplo: linha sem data de pagamento. | média | S2/S3 |
| O STR entrou em vigor numa quarta-feira, 2 de janeiro. Pelo calendário, o ano é **2019** [?]. A ANCINE fez treinamento sobre o "novo STR". | média | S10, S11 |
| Versões do manual localizadas:<br>• "Manual do STR – Versão 2.0 (v. 26/10/2021)"<br>• `manualstr2021.pdf`<br>• `manualstr.pdf`<br>• "Manual – Relação de Pagamentos Pré-preenchida"<br><br>Um resumo citou um "Manual STR – Planilhas versão 2.10" **[?]**, que pode ser confusão com o Manual de PC v2.10. | alta (existência) / baixa (versão 2.10) | S2, S3, S4, S5 |
| **Projetos no BB Gestão Ágil:**<br>• o STR gera a RP **pré-preenchida** com os dados que o proponente lançou no BB Gestão;<br>• o proponente baixa, revisa, corrige e reenvia;<br>• o **DE é montado automaticamente pelo STR** e não pode ser enviado em planilha nem editado no sistema. | média | S4, S12 |

### 1.2 Relação de Pagamentos (RP)

Finalidade: detalhar **todos os pagamentos** do projeto, inclusive a contrapartida, em conciliação com o DE da respectiva conta, por fonte de recursos. A RP também serve de base para o DO. (média, S1/S2/S8)

**Seção II, colunas identificadas** (rótulos exatos como aparecem nos trechos):

| Código | Rótulo | Regra encontrada | Confiança |
|---|---|---|---|
| II.a | `ITEM ORÇAM.` | Descrição do item orçamentário. Na RP pré-preenchida, fica em branco se não foi classificado no BB Gestão Ágil. | média |
| II.b | `CREDOR` | Nome completo ou razão social do **emissor do documento fiscal**. | média |
| II.c | `CPF / CNPJ` | **Somente numérico.** Número do CPF ou CNPJ do emissor do documento fiscal. | média |
| II.d | `HISTÓRICO` | Deve usar **exatamente a mesma nomenclatura** do lançamento correspondente no DE (coluna II.g PAGAMENTOS), para o STR conciliar. | média |
| II.e | `DATA DO PGTO.` | Formato de data `dd/mm/aaaa`. Linha sem data gera crítica. | média |
| II.f | `TIPO DOC. FISCAL` | Sigla do tipo de documento. Em guias de tributo, usar a sigla do documento de arrecadação (DARF, GPS etc.). Há a opção "Outros". | média |
| II.g | `Nº DOC. FISCAL` **[?]** | Preenchimento obrigatório; deve corresponder ao número do documento fiscal emitido. O nome do campo apareceu, o código "II.g" é inferência minha pela ordem. | baixa |
| II.h | `DATA DE EMISSÃO` | Formato de data `dd/mm/aaaa`. Data de emissão do documento fiscal. | média |
| II.i | `VALOR` **[?]** | Valor de cada pagamento, conforme o documento fiscal. O nome apareceu, o código é inferência. | baixa |

- **Seção I da RP (cabeçalho e identificação):** não encontrada. **[?]** Por analogia com o DE, deve trazer título, SALIC, proponente e dados da conta.
- **Formulário antigo (IN 40/2005), só como referência histórica:** Itens, Credor, CNPJ/CPF, Título de Crédito (cheque), Data, Nº Documento Fiscal, Data, Valor. (média, S13)

**Regras de preenchimento da RP:**

1. **Guias de tributo** (FAQ SPR 11.3; média, S14):
   - `CREDOR` e `CNPJ` repetem os dados do **documento fiscal do fato gerador**;
   - o número do documento é o número da guia ou, na falta dele, uma numeração sequencial para todas as guias do projeto;
   - a "data de emissão" recebe a **data de pagamento da guia**;
   - o tipo de documento recebe a sigla da guia (DARF, GPS…).
2. **Retenções na fonte e IRRF:** lançar em **linha própria**, em nome do credor da despesa, para facilitar a vinculação. (média, S14)
3. **Cuidados na RP pré-preenchida** (FAQ SPR 18.5; média, S12):
   - completar `ITEM ORÇAM.` quando estiver em branco;
   - revisar `CREDOR`, `CPF/CNPJ` e `DATA DE EMISSÃO` quando o documento foi classificado de forma genérica no BB;
   - incluir documentos fiscais que não foram declarados no BB;
   - quando um único débito corresponde a **vários documentos fiscais**, abrir uma linha por documento;
   - quando um débito ou documento cobre **mais de uma rubrica**, criar linhas adicionais e dividir o valor entre as rubricas.

### 1.3 Demonstrativo do Extrato da Conta Corrente (DE)

Finalidade: registrar os créditos e débitos de cada conta do projeto, conforme o extrato bancário. Envia-se uma planilha por conta. (média, S1/S2)

**Seção I: identificação** (média, S2/S3):

| Código | Campo | Regra |
|---|---|---|
| I.a | `TÍTULO` | — |
| I.b | `SALIC` | — |
| I.c | `PROPONENTE` | — |
| I.d | `CONTA DE` | CAPTAÇÃO ou MOVIMENTAÇÃO |
| I.e | `BANCO` | código numérico do banco |
| I.f | `AGÊNCIA` | **não aceita letras**; se o dígito verificador tiver letra, omitir o DV |
| I.g | `Nº CONTA` | — |

**Seção II: MOVIMENTAÇÃO.** As colunas foram identificadas por códigos e aparecem na ordem de II.a a II.j:

| Código | Rótulo | Regra encontrada | Confiança |
|---|---|---|---|
| II.a | `DATA` | Mesmas datas do extrato, formato `dd/mm/aaaa`. | média |
| II.b | `HISTÓRICO` | Natureza do lançamento: saldo inicial, pagamento, recebimento, transferência etc. | média |
| II.c | `FOMENTO` | Valor **sempre positivo**. Usado para crédito na conta de **captação** (leis de incentivo), na **conta bloqueada** (fomento direto: PAR, PAQ, editais) ou na **conta de movimentação FSA**, quando o aporte vem do agente financeiro. | média |
| II.d | `OUTROS DEPÓSITOS` | Recursos **próprios ou de terceiros** depositados nas contas de movimentação. | média |
| II.e | `TRANSFERÊNCIAS REC/CONC` | **Somente** transferências entre contas do próprio projeto (por exemplo, da bloqueada ou de captação para a de movimentação). Não registra pagamentos. Em geral não se preenche na conta de movimentação. | média |
| II.f | `APLICAÇÕES/RESGATES` | Aplicação com sinal **negativo** (é débito); resgate com sinal **positivo** (é crédito). | média |
| II.g | `PAGAMENTOS` | Usado **só em contas de movimentação**. Todo débito para pagar ou reembolsar despesa do projeto, seja TED, DOC, cheque ou transferência. Valor **positivo**: a planilha já subtrai. Cada lançamento deve existir na RP, com o mesmo `HISTÓRICO`. | média |
| II.h | `DESPESAS BANCÁRIAS` | Tarifas e despesas bancárias debitadas no extrato. | média |
| II.i | `SALDO` | **Não é editável: é calculado por fórmula** e deve reproduzir o saldo do extrato após cada lançamento. Serve como checagem: o saldo do extrato e o do DE precisam coincidir. | média |
| II.j | linha **TOTAL** | Totaliza as colunas. Para II.f, o total representa o rendimento líquido das aplicações (resgates − aplicações). | baixa |

- A ordem de II.a a II.j saiu de trechos diferentes. Não consegui ver a planilha inteira.
- **[?]** Não encontrei coluna separada de **estorno de tarifas**, nem de **devolução ou recolhimento (GRU)**. O formulário antigo (IN 21/2003 e IN 40/2005) tinha, em créditos: saldo anterior, depósitos, rendimentos, estorno de CPMF, estorno de tarifas, transferências e outros créditos; e, em débitos: cheques emitidos, transferências, saques e despesas bancárias (baixa, S13). No layout atual, a GRU de devolução provavelmente vai em PAGAMENTOS ou em outra coluna. **Verificar no .xls.**

### 1.4 Demonstrativo Orçamentário e Financeiro (DO)

Encontrei pouco sobre o DO: a cota de busca acabou aqui.

| Afirmação | Confiança | Fonte |
|---|---|---|
| O DO faz duas comparações:<br>• orçamento aprovado × valores **efetivamente captados**, por fonte de recursos;<br>• orçamento analítico aprovado × orçamento **executado**. | média | S1, S2 |
| **Item III:** registra os valores **aprovados para captação** por fonte. A coluna `FONTE DE RECURSOS` **não é de preenchimento livre**: cada linha já traz um mecanismo ou fonte, e o captado de cada fonte vai na linha dela. | média | S2, S8 |
| **Item IV:** orçamento lançado **no mesmo nível de detalhamento aprovado pela ANCINE**. | média | S8 |
| Linhas **cinzas** contêm fórmulas que somam os grupos de itens orçamentários e não devem ser editadas. | média | S2 |
| O DO declara os valores executados, inclusive a contrapartida, por item orçamentário. Inclui itens executados que não estavam previstos na aprovação. | média | S15 (IN 150/2019) |
| Colunas exatas dos itens III e IV (aprovado, captado, executado, por fonte?) e conteúdo dos itens I e II. | **não encontrado** | — |

### 1.5 "Manual de envio de documentos fiscais"

**Não encontrado.** Nenhuma busca trouxe documento com esse título. Buscas relacionadas trouxeram apenas o manual da RP pré-preenchida e o Manual STR. **[?]** Talvez seja o módulo de documentos fiscais do BB Gestão Ágil, ou parte do Manual de PC.

---

## 2. Lacuna (b): logomarca (IN 130/2016, IN 152/2020, Manual v3.0)

| Afirmação | Confiança | Fonte |
|---|---|---|
| A **IN ANCINE 130, de 13/12/2016** (DOU 19/12/2016, p. 20) normatiza o uso da logomarca e dos **créditos textuais** da ANCINE em produtos feitos com recursos públicos federais do audiovisual. | média | S16, S17 |
| A "**Logomarca Obrigatória**" muda conforme a fonte de recursos. Pode ser:<br>• só a da ANCINE;<br>• ANCINE combinada com **FSA** e **agentes financeiros**;<br>• ANCINE com a do Programa **Cinema Perto de Você**. | média | S16 |
| A aplicação segue o **Manual de Aplicação da Logomarca**, publicado no site da ANCINE. É ele que define tamanhos, cores e tipos de material. | média | S16, S18 |
| **Bandeira Nacional:**<br>• é símbolo nacional pela **Lei 5.700/1971**;<br>• deve ser aplicada em **todo material de divulgação** de projeto financiado com recursos públicos, nos termos dessa lei. | média | S16 |
| A **IN 152/2020** **revogou a obrigação nos créditos finais**. Em projetos de produção ou finalização, a logomarca obrigatória vai nos **créditos iniciais** e no **cartaz**. | média | S16, S18 (FAQ "Aplicação da Logomarca") |
| **Manual v3.0:**<br>• arquivo `ManualdeAplicacaodeLogomarcav.0324agosto22.pdf`;<br>• pelo nome, é a v3.0 de **24/08/2022** **[?]**. | alta (existência) / baixa (data) | S18 |
| **Manual v2.0:**<br>• publicado em torno de fevereiro de 2017 (notícia de 01/02/2017);<br>• tem cópia no Scribd e uma versão antiga no Yumpu. | média | S19, S20 |
| A EBC tem um manual próprio de padronização de logomarcas para PRODAV/TVs públicas (2019), útil como referência de aplicação. | alta (existência) | S21 |
| **Tamanhos mínimos, tempo de tela e posição exata** nos créditos iniciais e no cartaz. | **não encontrado** | Buscado em "Manual de Aplicação logomarca ANCINE 3.0" e "IN 130 créditos iniciais Bandeira". O conteúdo está no PDF do manual, que não consegui ler. |
| **Sanções** por descumprimento (glosa, reprovação, multa?). | **não encontrado** | Não sobrou cota para buscar. **[?]** Conferir os artigos finais da IN 130 e o capítulo de execução física do Manual de PC v2.11. |

---

## 3. Lacuna (c): FSA e BRDE

Quase nada foi encontrado: a cota de busca acabou antes deste item, e o brde.com.br estava bloqueado para leitura.

| Afirmação | Confiança | Fonte |
|---|---|---|
| Os formulários financeiros dos projetos FSA também vão **exclusivamente pelo STR**. | média | S1/S2 |
| No DE, o aporte do agente financeiro (BRDE) na **conta de movimentação FSA** é lançado em `II.c FOMENTO`. | média | S2 |
| O BRDE publica um "**Guia de Acompanhamento de Projetos contemplados pelo FSA**" em três versões:<br>• v02 (23/05/2019);<br>• v03 (01/07/2019);<br>• v04 (06/02/2020). | alta (existência) | S22, S23, S24 |
| O guia v04 aparece nas buscas sobre RP e DE, o que sugere que trata do STR. | — | S22 |
| O BRDE também publica:<br>• "**Orientações para prestação de contas – PEAPE**" (nov/2020);<br>• "**Sistema de Acompanhamento de Prazos Integrados e Obrigações**", manual do sistema (dez/2018). | alta (existência) | S25, S26 |
| Contrato de investimento, relatórios de comercialização, retorno do FSA (participação nas receitas) e prazos próprios do FSA. | **não encontrado** | Sem cota de busca e sem acesso a brde.com.br. Fontes prováveis: guia v04 (S22), Orientações PEAPE (S25) e Regulamento Geral do PRODAV. |

---

## 4. Lacuna (d): prazo de análise, prestação parcial e diligências fora da glosa

**Não encontrado.** A cota de busca acabou antes deste item.

- Existe um FAQ SPR 18.6, "Como o processo de envio das informações financeiras se encerra no STR?". O conteúdo não foi capturado.
- Fontes prováveis, nenhuma lida:
  - os capítulos de análise da IN 159/2021;
  - o artigo do JusBrasil/GEN "Prestação de Contas da Ancine analisada em três etapas: a questão metodológica e a possibilidade da denominada análise fiscal" (S27);
  - o curso ENAP "Execução Financeira e Prestação de Contas Referentes aos Projetos Audiovisuais", Módulo 1 (S28).

---

## 5. Lacuna (e): IN 159/2021, art. 18 e ANEXO

| Afirmação | Confiança | Fonte |
|---|---|---|
| **Dados da IN 159/2021:**<br>• data: 23/12/2021;<br>• publicação no DOU: 27/12/2021;<br>• vigência: **17/01/2022**;<br>• **revogou a IN 150/2019**;<br>• foi alterada pela **IN 160 (03/03/2022)** e pela **IN 167 (24/04/2023)**. | média | S29, S30, S31 |
| O Participa+Brasil teve consulta pública com "Considerações para subsidiar decisão de revisão da IN 159/2021". **[?] Pode existir revisão posterior; verificar se há IN nova em 2025 ou 2026.** | alta (existência) | S32 |
| **Art. 18, caput (paráfrase):** as despesas abaixo são irregulares e **glosadas independentemente das características do projeto**. | média | S29 |
| **Itens do art. 18 recuperados** (paráfrase; lista **incompleta**, sem a numeração dos incisos, exceto XXXVI):<br>• despesa **sem documento fiscal** comprobatório;<br>• **bebidas alcoólicas**;<br>• **cigarros**, salvo como objeto de cena;<br>• despesa executada em **conta bancária não autorizada** (ressalvado o art. 15) e despesa em **desacordo com as regras de movimentação** da conta do projeto;<br>• **juros e multas** de qualquer natureza;<br>• **IOC, IOF e tarifas bancárias**, salvo a tarifa de manutenção de conta;<br>• **inciso XXXVI**: pagamento de despesas da **folha de pessoal do próprio proponente** com recursos públicos. **[?]** | média (itens) / baixa (inciso XXXVI) | S29 |
| Os incisos têm **pelo menos 36 itens**, pois o XXXVI é citado. | baixa | S29 |
| Texto integral do art. 18 e o **ANEXO** (lista de documentos e formulários). | **não encontrado** | Os espelhos achados (legisweb, cqsfv.com.br, olivieriassociados.com.br com a IN 158) estavam bloqueados para leitura. |

---

## 6. Fontes

Todas foram vistas **apenas como resultado de busca**: nenhuma foi aberta diretamente. Os links de gov.br aparecem só como referência, para download manual.

| # | Fonte | URL |
|---|---|---|
| S1 | Manual do Sistema STR (2021) | https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/manualstr2021.pdf |
| S2 | Manual do STR – Versão 2.0 (26/10/2021) | https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/Manual_do_STR___Versao_2.0__v_26_10_2021_.pdf |
| S3 | Manual do Sistema STR | https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/manualstr.pdf |
| S4 | Manual – Relação de Pagamentos Pré-preenchida | https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/Manual_STR_Relacao_Pagamentos_Pre_preenchida.pdf |
| S5 | Cópia do Manual STR v2.0 no Scribd | https://www.scribd.com/document/582735165/Manual-do-STR-Versao-2-0-v-26-10-2021 |
| S6 | Página "Sistemas" (prestação de contas) | https://www.gov.br/ancine/pt-br/assuntos/atribuicoes-ancine/fomento/prestacao-de-contas/sistemas |
| S7 | Página "Manuais" (prestação de contas) | https://www.gov.br/ancine/pt-br/assuntos/atribuicoes-ancine/fomento/prestacao-de-contas/manuais |
| S8 | Manual de PC, versões anteriores (v2.2 a v2.10) | https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/MANUALDEPC_v2.2_27.06.2022.pdf |
| S9 | Modelo IN 124 – Demonstrativo Orçamentário (.xls) | https://www.gov.br/ancine/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/arquivos/in-124-demonstrativo-orcamentario.xls |
| S9 | IN 124 com anexo, cópia fora do gov.br | http://www.fiscosoft.com.br/objetos/IN_124_2015_ANCINE_ANEXO.PDF |
| S9 | IN 124 no Contábeis | https://www.contabeis.com.br/legislacao/832638/instrucao-normativa-ancine-124-2016/ |
| S10 | Notícia: STR começa a vigorar em 2 de janeiro | https://www.gov.br/ancine/pt-br/assuntos/noticias/sistema-de-triagem-financeira-str-comeca-a-vigorar-nesta-quarta-feira-2-de-janeiro |
| S11 | BRAVI: notícia sobre o novo sistema | https://bravi.tv/ancine-anuncia-informatizacao-e-agilizacao-de-processo-de-prestacao-de-contas-novo-sistema-sera-implantado-em-janeiro/ |
| S12 | FAQ SPR 18.5 (RP pré-preenchida) | https://www.gov.br/ancine/pt-br/acesso-a-informacao/perguntas-frequentes1/superintendencia-de-prestacao-de-contas-spr/18-5-quais-sao-os-principais-cuidados-que-devo-ter-ao-preparar-a-rp-relacao-de-pagamentos-pre-preenchida |
| S12 | FAQ SPR 18.6 (encerramento do envio no STR) | https://www.gov.br/ancine/pt-br/acesso-a-informacao/perguntas-frequentes1/superintendencia-de-prestacao-de-contas-spr/18-6-como-o-processo-de-envio-das-informacoes-financeiras-se-encerram-no-str |
| S13 | IN 40/2005 (LegisWeb) | https://www.legisweb.com.br/legislacao/?id=76127 |
| S13 | IN 21/2003 (LegisWeb) | https://www.legisweb.com.br/legislacao/?id=75593 |
| S14 | FAQ SPR 11.3 (guias de tributos na RP) | https://www.gov.br/ancine/pt-br/acesso-a-informacao/perguntas-frequentes1/superintendencia-de-prestacao-de-contas-spr/11-3-como-as-guias-de-recolhimento-de-tributos-devem-ser-lancadas-na-relacao-de-pagamentos |
| S14 | FAQ SPR 11.1 (tributos pagáveis pela conta) | https://www.gov.br/ancine/pt-br/acesso-a-informacao/perguntas-frequentes1/superintendencia-de-prestacao-de-contas-spr/11-1-quais-tributos-taxas-e-encargos-podem-ser-pagos-pela-conta-do-projeto |
| S15 | IN 150/2019 (revogada) | https://www.gov.br/ancine/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-150 |
| S16 | IN 130/2016 (Imprensa Nacional) | https://www.in.gov.br/web/guest/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/22192718/ |
| S16 | IN 130/2016 (site da ANCINE) | https://www.gov.br/ancine/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-130 |
| S17 | DOU de 19/12/2016, p. 20 | https://pesquisa.in.gov.br/imprensa/servlet/INPDFViewer?jornal=1&pagina=20&data=19%2F12%2F2016&captchafield=firstAccess |
| S18 | FAQ "Aplicação da Logomarca" | https://www.gov.br/ancine/pt-br/acesso-a-informacao/perguntas-frequentes1/aplicacao-da-logomarca |
| S18 | Manual de Aplicação da Logomarca v3.0 | https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/ManualdeAplicacaodeLogomarcav.0324agosto22.pdf |
| S19 | Tela Viva: novo manual de logotipos (01/02/2017) | https://telaviva.com.br/01/02/2017/ancine-publica-novo-manual-de-aplicacao-de-logotipos/ |
| S20 | Manual de Aplicação de Logomarca 2.0 no Scribd | https://www.scribd.com/document/360936039/Manual-de-Aplicac-a-o-de-Logomarca-2-0-0 |
| S20 | Manual de Aplicação da Logomarca no Yumpu | https://www.yumpu.com/pt/document/view/12709396/manual-de-aplicacao-da-logomarca-ancine |
| S21 | Manual de padronização de logomarcas EBC/PRODAV (2019) | https://www.ebc.com.br/sites/_institucional/files/atoms/files/manual_de_padronizacao_das_logomarcas_e_entrega_de_produtos_prodav_tvs_publicas_2019.pdf |
| S22 | Guia de Acompanhamento FSA, v04 (BRDE) | https://www.brde.com.br/wp-content/uploads/2020/02/Guial_FSA_Acompanhamento.v04-de-06-02-2020.pdf |
| S23 | Guia de Acompanhamento FSA, v03 (BRDE) | https://www.brde.com.br/wp-content/uploads/2019/07/Guial_FSA_Acompanhamento.v03-de-01-07-2019.pdf |
| S24 | Guia de Acompanhamento FSA, v02 (BRDE) | https://brde.com.br/wp-content/uploads/2019/05/Guial_FSA_Acompanhamento.v02-de-23-05-2019.pdf |
| S25 | Orientações para prestação de contas PEAPE (BRDE) | https://www.brde.com.br/wp-content/uploads/2020/11/Orienta%C3%A7%C3%B5es-para-presta%C3%A7%C3%A3o-de-contas-PEAPE.pdf |
| S26 | Manual do Sistema de Acompanhamento ANCINE (BRDE) | https://www.brde.com.br/wp-content/uploads/2018/12/manual_sistema_acompanhamento_ANCINE.pdf |
| S27 | Artigo JusBrasil: análise em três etapas | https://www.jusbrasil.com.br/artigos/prestacao-de-contas-da-ancine-analisada-em-tres-etapas-a-questao-metodologica-e-a-possibilidade-da-denominada-analise-fiscal/705177875 |
| S27 | Mesmo artigo no blog GEN | https://blog.grupogen.com.br/juridico/areas-de-interesse/tributario/prestacao-de-contas-da-ancine-analisada-em-tres-etapas-a-questao-metodologica-e-a-possibilidade-da-denominada-analise-fiscal/ |
| S28 | Curso ENAP, Módulo 1 | https://repositorio.enap.gov.br/jspui/bitstream/1/5196/1/Mod_1_Considera%C3%A7%C3%B5es%20iniciais%20sobre%20a%20execu%C3%A7%C3%A3o%20financeira%20e%20presta%C3%A7%C3%A3o%20de%20contas%20nos%20projetos%20audiovisuais.pdf |
| S29 | IN 159/2021 (site da ANCINE) | https://www.gov.br/ancine/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-159 |
| S29 | Resumo das INs 158 e 159 (CQS/FV) | https://cqsfv.com.br/wp-content/uploads/2022/01/ins-ancine-158-e-159.pdf |
| S30 | IN 167/2023 (LegisWeb) | https://www.legisweb.com.br/legislacao/?id=444579 |
| S31 | Tela Viva: novas INs (10/01/2022) | https://telaviva.com.br/10/01/2022/ancine-apresenta-novas-instrucoes-normativas/ |
| S31 | Panorama Audiovisual: novas INs | https://panoramaaudiovisual.com.br/ancine-publicadas-novas-instrucoes-normativas-que-substituem-as-ins-no-125-e-no-150/ |
| S31 | IN 158 no site Olivieri Associados | https://www.olivieriassociados.com.br/wp-content/uploads/2022/04/Instrucao-Normativa-n.o-158-de-23-de-dezembro-de-2021-%E2%80%94-Portugues-Brasil.pdf |
| S32 | Participa+Brasil: revisão da IN 159 | https://www.gov.br/participamaisbrasil/consideracoes-para-subsidiar-decisao-de-revisao-da-instrucao-normativa-159-de-23-de-dezembro-de-2021 |
| outros | Slideshare "Dúvidas frequentes ANCINE" | https://pt.slideshare.net/redecemec/duvidas-frequentes-ancine |
| outros | Modelo de orçamento ANCINE no Scribd | https://www.scribd.com/doc/175580806/modelo-de-orcamento-ancine |
