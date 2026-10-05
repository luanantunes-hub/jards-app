# ANCINE: artefatos oficiais para gerar e conferir a prestação de contas

Pesquisa feita em 01/10/2026. Complementa o "Manual de Prestação de Contas" v2.11, que já foi lido. Esta pesquisa substitui as lacunas listadas em `research/ancine-web.md`.

**Diferença em relação à pesquisa anterior.** Desta vez os arquivos oficiais foram **baixados e lidos diretamente** (curl em gov.br e brde.com.br). Os três modelos `.xls` do STR foram abertos com xlrd e convertidos com LibreOffice para inspeção com openpyxl. Assim foi possível ver células, fórmulas, validações, proteção e formatos.

**Convenções usadas neste documento:**
- **[?]** marca ponto incerto ou inferência minha;
- **"não encontrado"** vem acompanhado do que foi tentado;
- Linhas e colunas seguem a notação do Excel (ex.: `C5`, `L52` = linha 52).

---

## 0. Resumo executivo

| Pergunta | Resposta curta |
|---|---|
| Os modelos de RP, DE e DO foram obtidos? | **Sim.** Versões oficiais anexas à IN 159, salvas pela ANCINE em **12/03/2026**. Formato `.xls` (BIFF8 / Excel 97-2003). |
| O layout está completo? | **RP: sim. DE: sim. DO: sim.** Inclui célula a célula, fórmulas, validações, formatos e proteção. Ver §2 a §4. |
| Qual a versão do Manual STR – Planilhas? | **v2.2, de 30/09/2025.** Incorpora a RP pré-preenchida do BB Gestão Ágil. O manual antigo de RP pré-preenchida dá **404**: foi absorvido. |
| Existe manual de documentos fiscais? | **Sim.** "Manual de Envio de Documentos Fiscais – STR", de 04/05/2021. Ver §6. |
| Qual a versão do Manual de Logomarca? | **v3.0, de 24/08/2022.** Não há versão mais nova na página oficial. |
| A IN 159 tem alterações posteriores? | **Sim.** INs 160/2022, 164/2022, 167/2023 e **176/2026** (de 07/05/2026, que mudou o item VII-e do Anexo). Mais a DDC 1965-E/2023, que criou nova hipótese de reembolso **sem alterar o texto da IN**. |
| Há IN nova de prestação de contas? | **Não.** Em 01/10/2026 a última IN publicada é a 176; as URLs das INs 177 a 181 dão 404. |
| A ANCINE tem prazo legal para analisar a prestação de contas? | **Não encontrado na IN 159.** O que existe:<br>• prazos de diligência e de recurso (30 dias);<br>• prescrição de 5 anos e intercorrente de 3 anos (Res. TCU 344/2022, aplicada pela ANCINE desde 24/01/2023). Ver §10. |
| Há API? | **Não há API própria de projetos.** Existem:<br>• dados abertos em CSV no dados.gov.br, cujo host de arquivos devolveu 403 a partir deste ambiente;<br>• página pública do SAD com o detalhe de cada SALIC, em HTML que pode ser raspado. Ver §11. |

---

## 1. STR – regras gerais que o software precisa respeitar

Fonte: Manual STR – Planilhas v2.2 (M-STR).

| # | Regra | Fonte |
|---|---|---|
| 1 | O STR **só carrega planilhas salvas como "Pasta de Trabalho do Excel 97-2003" (.xls)**. | M-STR §3.1 |
| 2 | O nome do arquivo precisa ter **mais de 5 caracteres, sem contar a extensão**. `DO.XLS` é rejeitado. Exemplos do manual: `DO_TESTE 1`, `DEM EXT_TESTE 1_22.222-22`, `RP_TESTE 1_22.222-22`. | M-STR §3.2, §4.1.2–4.1.4 |
| 3 | Quantidade de planilhas:<br>• **um DO por projeto (SALIC)**;<br>• **um DE por conta**, de captação e de movimentação;<br>• **uma RP por conta de movimentação**;<br>• **mais uma RP exclusiva de contrapartida**, quando a contrapartida for executada fora da conta de movimentação. | M-STR §3.2.2, §3.2.3, §4.1.2 |
| 4 | Contas **abertas ou migradas para o BB Gestão Ágil** (abertas após 01/01/2020):<br>• o **DE é gerado pelo STR** e não pode ser enviado, alterado nem excluído;<br>• o STR gera uma **RP pré-preenchida** para cada DE de movimentação, que precisa ser revisada e reenviada;<br>• o DO é sempre manual. | M-STR §3.1, §4.1.1 |
| 5 | Sincronização com o BB Gestão Ágil:<br>• a integração atualiza 1×/dia, com até 24 h de atraso;<br>• "Obter Dados Atualizados BB Ágil" **apaga e regera** as planilhas BB, incluindo comentários. | M-STR §4.1.1; FAQ SPR 18.4 |
| 6 | Onde se informa o SALIC:<br>• o login no STR aceita SALIC ou nº de processo;<br>• **nas planilhas, só o SALIC**, no formato `NN-NNNN` (2 dígitos do ano + 4 dígitos). Exemplo: `99-9999`. | M-STR §2.3, §3.2.1 |
| 7 | Obras com várias fontes (vários processos ou SALICs, inclusive várias chamadas FSA) têm **um conjunto de planilhas por SALIC**. A única seção consolidada entre SALICs é a **seção III do DO**. | M-STR §2.2, §3.2.1 |
| 8 | Etapas de crítica:<br>1. **críticas de carga**: na inclusão da planilha no "Quadro de Listagem";<br>2. **críticas de cruzamento**: no clique em "Enviar Planilhas".<br>O relatório de críticas sai em PDF e aponta a **linha exata**. | M-STR §5 |
| 9 | Depois do envio:<br>• é **bloqueado** incluir ou alterar planilhas no mesmo SALIC;<br>• para reabrir, é preciso e-mail a `prestacao.contas@ancine.gov.br` com o assunto `Autorização para ajustes nas planilhas carregadas no STR – SALIC: XX-XXXX`, informando proponente, CNPJ, SALIC, data e **código do envio**;<br>• a ANCINE então apaga **todas** as planilhas, por isso é preciso baixar antes. | M-STR §6.3 |
| 10 | O e-mail de confirmação do envio deve ser **impresso e juntado** à prestação de contas. Enviar pelo STR **não é** entregar a prestação de contas. | M-STR §6.1, §6.3 |
| 11 | O STR calcula e confronta dois totais:<br>• **A COMPROVAR** = captações registradas no SALIC + contrapartida mínima do SALIC + rendimentos (dos DEs);<br>• **COMPROVADO** = Σ todas as RPs + Σ despesas bancárias dos DEs.<br>Se COMPROVADO < A COMPROVAR, o **envio é bloqueado**. | M-STR §5.3.3 |

**Nota de implementação, testada neste ambiente.** O caminho que funcionou foi:
1. abrir o modelo oficial;
2. preencher as células;
3. salvar via LibreOffice headless com o filtro `MS Excel 97`.

Esse caminho preservou:
- a proteção da planilha;
- a validação de lista do DE;
- as fórmulas, recalculadas corretamente.

**[?] Não testei se o STR aceita um `.xls` gerado pelo LibreOffice.** O mais seguro é partir do `.xls` oficial e inserir linhas dentro da faixa de dados, como o manual manda. Assim as fórmulas `SUM`/`SUBTOTAL` se expandem sozinhas.

---

## 2. Relação de Pagamentos (RP): layout exato

**Arquivo e configuração da planilha**

| Atributo | Valor |
|---|---|
| Arquivo | `IN_159_Relacao_de_Pagamentos.xls` |
| Aba | única, `REL. PGTOS` |
| Fonte | Arial |
| Cabeçalhos das colunas | 8 pt, negrito, centralizado, com quebra de linha |
| Página | paisagem, A4 (`paperSize 9`), ajuste a 1 página de largura |
| Títulos de impressão | linha 11 |
| Congelamento | acima da linha 12 |
| AutoFiltro | `A11:I29` |

**Proteção**
- A planilha é **protegida com senha**, mas é permitido **inserir e excluir linhas** e usar o autofiltro.
- Só as células de entrada estão desbloqueadas.
- As colunas `K:IV` e as linhas 40 e 41 estão **ocultas** e não têm conteúdo.

### 2.1 Mapa de células

| Linha | Conteúdo (texto literal) | Células de entrada |
|---|---|---|
| 1 | `RELAÇÃO DE PAGAMENTOS` (A1:I1) | — |
| 2 | `AGÊNCIA NACIONAL DO CINEMA` + quebra + `SUPERINTENDÊNCIA DE PRESTAÇÃO DE CONTAS` (A2:I2) | — |
| 4 | `I. IDENTIFICAÇÃO DO PROJETO` (A4:I4) | — |
| 5 | `I.a. TÍTULO.......................:` (A5:B5) | **C5:I5** (mescladas, texto `@`) |
| 6 | `I.b. SALIC.........................:` | **C6:I6** (texto) |
| 7 | `I.c. PROPONENTE.............:` | **C7:I7** (texto) |
| 8 | `I.d. BANCO....:` (A8) · `I.e. AGÊNCIA.........:` (C8) · `I.f. Nº CONTA......................:` (F8:G8) | **B8** banco · **D8:E8** agência · **H8:I8** conta |
| 10 | `II. LANÇAMENTOS` (A10:I10) | — |
| 11 | Cabeçalhos das colunas (tabela 2.2) | — |
| **12–29** | 18 linhas de lançamento (o usuário pode inserir quantas precisar, a partir da linha 13) | **A12:I29** |
| 30 | `II.j. TOTAL  ` (A30:H30) · **I30 `=SUM(I12:I29)`** | — |
| 32 | `III. OBSERVAÇÕES (apresentar qualquer informação relevante para a análise deste demonstrativo e da prestação de contas do projeto)` | **A33:I35** (mescladas) |
| 37 | `IV. LOCAL / DATA:` (A37:B37) · `V. NOME LEGÍVEL DO RESPONSÁVEL:` (C37:E37) · `VI. ASSINATURA DO RESPONSÁVEL:` (F37:I37) | **A38:B38**, **C38:E38**, **F38:I38** |

### 2.2 Colunas da seção II

Os rótulos estão na linha 11, como texto literal, e as quebras de linha foram trocadas por espaço. A coluna J é margem estreita.

| Col. | Código e rótulo | Largura (1/256 car.) | Formato da célula | Regras de preenchimento (M-STR §3.2.3) e críticas do STR (§5) |
|---|---|---|---|---|
| A | `II.a. ITEM ORÇAM.` | 3254 | Geral, centralizado | • Obrigatório.<br>• Deve ser **idêntico** (texto exato) a um `IV.a` (código) **ou** `IV.b` (descrição) do DO.<br>• **Linhas cinzas de grupo do DO não valem** (ex.: "8. Gerenciamento"; usar "8.1").<br>• Item não previsto: usar código ou descrição nova e justificar no DO V.<br>• Crítica de envio: RP×DO (§5.3.2). |
| B | `II.b. CREDOR` | 8265 | Geral | • Nome ou razão social do **emissor** do documento fiscal.<br>• Na RP do BB, documentos "Outros documentos" chegam vazios e precisam ser preenchidos. |
| C | `II.c. CPF / CNPJ` | 5229 | **Texto (`@`)**, alinhado à esquerda | • "Devem ser numéricos".<br>• CPF/CNPJ **inexistente bloqueia a carga** (§5.1.2).<br>• Exceções:<br>  – **INVOICE**: nº do documento;<br>  – **tributos**: CPF/CNPJ do credor do fato gerador;<br>  – **GRU de devolução**: zeros `00.000.000/0000-00` com `II.f = GRUDEV`. |
| D | `II.d. HISTÓRICO` | 4022 | Geral | • **Exatamente igual** ao `II.b` do DE (forma de pagamento + número do banco, ex. `TED 62.501`).<br>• Limite de **60 caracteres** no DE; cortar à direita.<br>• Repetir o mesmo histórico em todas as linhas do mesmo débito.<br>• RP de contrapartida: preencher `CONTRAPARTIDA`.<br>• Crítica de envio: RP×DE (§5.3.1). |
| E | `II.e. DATA DO PGTO.` | 2998 | data (`m/d/yy`, locale en-US no `.xls`) | • Data do débito, `dd/mm/aaaa`.<br>• Precisa coincidir com `II.a` do DE para o mesmo histórico.<br>• Crítica para vazio, data inexistente ou formato mm/dd (§5.1.5). |
| F | `II.f. TIPO DOC. FISCAL` | 2450 | Texto (`@`), centralizado | • Obrigatório (§5.1.3).<br>• Siglas padronizadas: `NF`, `CF`, `RPA`, `Recibo`, `DARF`, `GPS`, `Fatura`…<br>• **`INVOICE`** obrigatório para despesa no exterior.<br>• **`GRUDEV`** obrigatório para GRU de devolução de saldo.<br>• "Outros", vindo do BB, deve ser reclassificado. |
| G | `II.g. Nº. DOC. FISCAL` | 3108 | Geral | • Obrigatório.<br>• Crítica para vazio ou texto não numérico (§5.1.4).<br>• Recibo sem número: numeração sequencial.<br>• Tributo: **nº do documento do fato gerador**.<br>• GRU: **código de recolhimento** da GRU. |
| H | `II.h. DATA DE EMISSÃO` | 2706 | data | • `dd/mm/aaaa`, obrigatória.<br>• Datas absurdas vindas do BB (ex. `25/06/0202`) chegam em branco e precisam ser preenchidas. |
| I | `II.i. VALOR` | 2742 | contábil `_(* #,##0.00_)…` | • Numérico e **> 0**.<br>• Decimal com vírgula (§5.1.6).<br>• Valor **efetivamente pago por aquele débito**: líquido de retenções, ou a fração do documento quitada naquele débito.<br>• Retenções e IRRF vão em linha própria, em nome do credor da despesa (FAQ 11.1/11.3). |

### 2.3 Cabeçalho da RP por tipo

| Campo | RP de conta de movimentação | RP de contrapartida |
|---|---|---|
| `I.d. BANCO` | Código numérico (só dígitos), igual ao `I.e` do DE | **`CONTRAPARTIDA`** (obrigatório) |
| `I.e. AGÊNCIA` | Só dígitos; DV com letra é omitido; igual ao `I.f` do DE | Pode ficar vazio |
| `I.f. Nº CONTA` | Igual ao `I.g` do DE | `CONTRAP`, `CONTRAP 1`, `CONTRAP 2`… |

### 2.4 Regras de linhas

1. **Débito pago com vários documentos fiscais:** uma linha por documento, repetindo `HISTÓRICO` e `DATA DO PGTO`.
2. **Documento que cobre várias rubricas:** uma linha por rubrica, com a parcela correspondente.
3. **Documento pago com vários débitos:** uma linha por débito, cada uma com o valor parcial.
4. **Débito estornado pelo banco** (ex.: TED devolvida): **excluir** da RP.
5. **Ressarcimento de empréstimo** da proponente: aparece no DE (`II.g`) **sem** linha correspondente na RP. É a única exceção à conciliação.
6. **Reembolso:** lançar cada despesa reembolsada, não o beneficiário do reembolso.
7. **BB Gestão Ágil:** só permite 1 rubrica por pagamento. Por isso o manual recomenda pagar separadamente cada função, mesmo quando o credor e o documento são os mesmos.

Fonte: M-STR §3.2.3.

---

## 3. Demonstrativo do Extrato da Conta Corrente (DE): layout exato

**Arquivo e configuração da planilha**

| Atributo | Valor |
|---|---|
| Arquivo | `IN_159_Demonstrativo_do_Extrato.xls` |
| Aba | única, `Demonstrativo do Extrato` |
| Página | paisagem, A4, sem congelamento |
| Linhas ocultas | 40 a 87 |

**Proteção:** com senha, permitindo inserir e excluir linhas.

**Colunas ocultas `K:IV`:**
- **`L2` = `CAPTAÇÃO` e `L3` = `MOVIMENTAÇÃO`** são a fonte da lista de validação de `I.d`;
- `M2:M13` traz uma lista órfã de fontes, sem uso em nenhuma validação: Art. 1º, 1º-A, 3º e 3º-A da Lei 8.685, Art. 18/25 da Lei 8.313, Lei 10.179, Inc. X Art. 39 e Art. 41 da MP 2228-1, PAR, PAQ, Outros Editais e Contrapartida.

### 3.1 Mapa de células

| Linha | Conteúdo | Entrada |
|---|---|---|
| 3 | `DEMONSTRATIVO DO EXTRATO DE CONTA CORRENTE` (A3:I3) | — |
| 4 | `AGÊNCIA NACIONAL DO CINEMA` + quebra + `SUPERINTENDÊNCIA DE PRESTAÇÃO DE CONTAS` | — |
| 6 | `I. IDENTIFICAÇÃO DO PROJETO` | — |
| 7 | `I.a. TÍTULO…:` (A7:B7) | **C7:I7** |
| 8 | `I.b. SALIC…:` | **C8:I8** |
| 9 | `I.c. PROPONENTE…:` | **C9:I9** |
| 10 | `I.d. CONTA DE:` (A10) · `I.e. BANCO…:` (C10) · `I.f. AGÊNCIA…:` (E10) · `I.g. Nº CONTA…:` (G10) | • **B10**: lista `=$L$1:$L$3`, ou seja `CAPTAÇÃO` / `MOVIMENTAÇÃO`, com a mensagem de entrada "Selecione"<br>• **D10** banco<br>• **F10** agência<br>• **H10:I10** conta |
| 12 | `II. MOVIMENTAÇÃO` | — |
| 13 | Cabeçalhos (tabela 3.2) | — |
| **14–19** | 6 linhas de lançamento. Para inserir mais, a partir da linha 16, e arrastar a fórmula de `II.i` até antes da linha cinza. | **A14:H19** (I é fórmula) |
| 20 | `II.j. TOTAL:` (A20:B20) | — |
| 22 | `III. CONCILIAÇÃO BANCÁRIA` | — |
| 24–29 | Quadro de conciliação (tabela 3.3) | — |
| 32 | `IV. OBSERVAÇÕES (apresentar qualquer informação relevante…)` | **A33:I35** |
| 37 | `V. LOCAL / DATA:` · `VI. NOME LEGÍVEL DO RESPONSÁVEL:` · `VII. ASSINATURA DO RESPONSÁVEL:` | **A38:B38**, **C38:F38**, **G38:I38** |

### 3.2 Colunas da seção II

Fórmula da linha TOTAL: `C20 … H20 = SUBTOTAL(9, X14:X19)`; `I20 = I19`.

| Col. | Código e rótulo | Formato | Sinal | Regra (M-STR §3.2.2) |
|---|---|---|---|---|
| A | `II.a. DATA` | `dd/mm/yy;@` | — | Data contábil do lançamento, conforme o extrato. |
| B | `II.b. HISTÓRICO` | texto | — | • Tipo de lançamento + nº do documento, conforme o extrato.<br>• **≤ 60 caracteres** (eram 30 até 09/06/2021).<br>• Débitos de pagamento: **idêntico à RP**.<br>• Cheque estornado e reapresentado: mesmo histórico, com o estorno negativo (só para despesas anteriores a 01/01/2020). |
| C | `II.c. FOMENTO DEPÓSITOS` | contábil | **sempre +** | Crédito de recurso público:<br>• na conta de **captação** (fomento indireto);<br>• na **conta bloqueada** (fomento direto);<br>• na **conta de movimentação FSA**, quando o aporte vem do agente financeiro.<br>Em geral **não se usa em conta de movimentação, exceto FSA**. |
| D | `II.d. OUTROS DEPÓSITOS` | contábil | **sempre +** | Recursos próprios ou de terceiros na conta de movimentação, inclusive para cobrir débitos. |
| E | `II.e. TRANSFERÊNCIAS REC/CONC` | contábil | concedida **−** (captação) / recebida **+** (movimentação) | **Só** transferências entre contas do projeto. Nunca pagamentos. |
| F | `II.f. APLICAÇÕES / RESGATES` | contábil | aplicação **−** / resgate **+** | O total é o rendimento líquido. |
| G | `II.g. PAGAMENTOS` | contábil | **sempre +** (a fórmula subtrai) | • Só em conta de movimentação.<br>• Todo débito para pagar ou reembolsar despesa, mais o ressarcimento de empréstimo. |
| H | `II.h. DESPESAS BANCÁRIAS` | contábil | **sempre +** | Tarifas, IOF e juros. |
| I | `II.i. SALDO` | contábil | fórmula | • **`I14 = C14+D14+E14+F14-G14-H14`**;<br>• **`In = I(n-1)+(Cn+Dn+En+Fn-Gn-Hn)`**.<br>Deve igualar o saldo do extrato após cada lançamento, e o **saldo final deve ser 0**. |

**Formatação condicional:** nos valores, ≥ 0 aparece em azul (`#0000FF`) e < 0 em vermelho.

### 3.3 Seção III, Conciliação bancária (fórmulas)

| Célula | Rótulo | Fórmula |
|---|---|---|
| B24 / G24 | `CRÉDITOS` / `DÉBITOS` | — |
| C25 | `Incentivos Depósitos` | `=C20` |
| C26 | `Outros Depósitos` | `=D20` |
| C27 | `Transferências` | `=E20` |
| C28 | `Rend. Aplicação` | `=F20` |
| C29 | `Soma` | `=SUM(C25:C28)` |
| H25 | `Pagamentos` | `=G20` |
| H26 | `Despesas Bancárias` | `=H20` |
| H27 | `Soma` | `=SUM(H25:H26)` |
| H29 | `Saldo Final` | `=I20` → deve ser **0** |

---

## 4. Demonstrativo Orçamentário e Financeiro (DO): layout exato

**Arquivo e configuração da planilha**

| Atributo | Valor |
|---|---|
| Arquivo | `IN_159_Demonstrativo_Orcamentario_e_Financeiro.xls` |
| Aba | única, `Demonstrativo Orçam. e Financ.` |
| Página | retrato, A4 |
| Área de impressão | `A2:E455` |
| Títulos de impressão | linha 51 |
| Largura das colunas | A 8,3 · B 36,3 · C 17,1 · D 18,3 · E 16,8 · F 1,3 |

**Proteção:** com senha.

**Colunas ocultas:** `G` (vazia) e `IV`.
- `IV11:IV13` formam o **nome definido `Mecanismos`**, usado na validação de `C9`.
- Valores exatos: `Fomento Indireto (leis de incentivo)`, `Fomento Direto (Editais: PAR / PAQ / Outros)` e `FSA`.

**Paleta do `.xls`:**

| Índice | RGB | Cor | Uso |
|---|---|---|---|
| 22 | (192,192,192) | cinza claro | títulos e subgrupos |
| 23 | (128,128,128) | cinza escuro | grupos de etapa e totais |
| 55 | (150,150,150) | — | subtotais da seção III |

### 4.1 Seções I e II

| Linha | Rótulo literal | Entrada ou fórmula |
|---|---|---|
| 2 | `DEMONSTRATIVO ORÇAMENTÁRIO E FINANCEIRO` | — |
| 5 | `I. IDENTIFICAÇÃO DO PROJETO` | — |
| 6 | `I.a. TÍTULO……:` | **C6:E6** |
| 7 | `I.b. SALIC……:` | **C7:E7** |
| 8 | `I.c. PROPONENTE……:` | **C8:E8** |
| 9 | `I.d. MECANISMO DESTA PRESTAÇÃO DE CONTAS ……:` | **C9:E9**, com lista `=Mecanismos`. Erro: "Mecanismo Inválido – Você não selecionou um mecanismo válido. Tente novamente." Mensagem de entrada: "Mecanismo – Selecione o mecanismo que deverá ser prestado contas". |
| 11 | `II. RESUMO FINANCEIRO` | — |
| 12 | `II.a. Total de Recursos Disponibilizados (captações + rendimentos + contrapartida) a comprovar` | **`C12 = IF(C9="FSA",D42,IF(C9="Fomento Indireto (leis de incentivo)",D31,D38))`**. O texto de C9 precisa ser **exato**; qualquer outro valor cai em Fomento Direto. |
| 13 | `II.b. Total de Recursos Executados` | `C13 = D447` |
| 14 | `II.c. Sub Total (diferença entre os recursos disponibilizados e o  executado)` | `C14 = C13-C12` (≥ 0 em azul `#0066CC`, < 0 em vermelho) |
| 16 | `II.d. GRU para devoução do montante não executado` + quebra + `(a ser corrigido monetariamente)` (*sic*) | `C16 = IF(C14<0,C14,0)` |

### 4.2 Seção III, Resumo de captações

Cabeçalho na linha 20:
- `III.a. FONTE DE RECURSOS`
- `III.b. ÚLTIMO ORÇAMENTO APROVADO`
- `III.c. VALOR CAPTADO`
- `III.d. DIFERENÇA`

A coluna A é fixa e não editável. **C e D são de entrada**, e `E = D − C`. A seção III é a única que consolida todos os SALICs da obra.

| Linha | III.a (texto fixo) | Bloco |
|---|---|---|
| 21 | `Artigo 1º – Lei 8.685/93` | Fomento indireto |
| 22 | `Artigo 1º-A – Lei 8.685/93` | 〃 |
| 23 | `Artigo 3º  - Lei 8.685/93` | 〃 |
| 24 | `Artigo 3º-A – Lei 8.685/93` | 〃 |
| 25 | `Artigo 18 ou 25 – Lei 8.313/91` | 〃 |
| 26 | `Lei 10.179/01` | 〃 |
| 27 | `Inciso X. Art. 39 - MP 2228-1/01` | 〃 |
| 28 | `Art. 41 - MP 2228-1/01` | 〃 |
| 29 | `Contrapartida Aprovada` | 〃 |
| 30 | `Rendimentos de Aplicações Financeiras` | 〃 |
| **31** | `III.e. Sub-total (Prestação de Contas - Fomento Indireto)` | `=SUM(x21:x30)` em C, D e E |
| 33 | `PAR - Prêmio Adicional de Renda` | Fomento direto |
| 34 | `PAQ - Programa de Incentivo à Qualidade` | 〃 |
| 35 | `Edital de Coprodução Internacional` | 〃 |
| 36 | `Outros Editais` | 〃 |
| 37 | `Rendimentos de Aplicações Financeiras` | 〃 |
| **38** | `III.f. Sub-total (Prestação de Contas - Fomento Direto)` | `=SUM(x33:x37)` |
| 40 | `FSA` | FSA |
| 41 | `Rendimentos de Aplicações Financeiras` | 〃 |
| **42** | `III.g. Sub-total (Prestação de Contas - FSA)` | `=SUM(x40:x41)` |
| 44 | `Outras Fontes (sem incentivo federal, não passíveis de comprovação junto à Ancine) (detalhar no final, campo V.Observações)` | Outras |
| **45** | `III.h. Sub-total (Outras Fontes)` | `=x44` |
| **47** | `III.i. TOTAL GERAL` | `=x31+x38+x42+x45`. Deve ser igual ao orçamento total aprovado. |

**Observações:**
- A contrapartida só tem linha no bloco de fomento indireto.
- No FSA, `II.a` = FSA + rendimentos.
- **Divergência no manual:** o texto cita "Outras Fontes (linha 44)" e a fórmula confirma que é a linha 44.

### 4.3 Seção IV, Orçamento

A linha 49 avisa: `A tabela abaixo é apenas um MODELO e deverá ser adaptada para refletir o nível do orçamento efetivamente aprovado pela Ancine (orçamento detalhado ou em grande itens)`.

**Cabeçalho (linha 51):**
- `IV.a. ITEM ORÇAM.`
- `IV.b. DESCRIÇÃO`
- `IV.c. ÚLTIMO ORÇAM. APROVADO`
- `IV.d. ORÇAMENTO EXECUTADO`
- `IV.e. PERCENTUAL EXECUTADO`

As linhas 52 a 445 estão **desbloqueadas** (o modelo é adaptável). Há três tipos de linha:

- **Linha de grupo (cinza):**
  - A vazia;
  - **o código vem dentro do texto de B** (ex.: `1.1 Roteiro`);
  - `C` e `D` = `SUBTOTAL(9, faixa dos filhos)`.
  - Não pode ser usada como item na RP.
- **Linha folha:**
  - `A` = código (ex.: `1.1.1`), `B` = descrição;
  - `C` e `D` são valores digitados.
- **Todas as linhas:** `E = IF(AND(C=0,D=0)," ",IF(C>0,D/C,"NÃO ORÇADO"))`, em formato `0.00%`, vermelho quando > 1 (100%).

**Grupos do modelo** (L = linha; os subgrupos têm 5 folhas `X.Y.1…X.Y.5` com B vazio):

- **L52 1 Desenvolvimento de Projeto** (`=SUBTOTAL(9,C53:C64)`): L53 1.1 Roteiro; L59 1.2 Pesquisa.
- **L66 2 Pré-Produção** (`=SUBTOTAL(9,C67:C102)`): L67 2.1 Equipe; L73 2.2 Alimentação; L79 2.3 Hospedagem; L85 2.4 Passagens Aéreas; L91 2.5 Transporte; L97 2.6 Despesas de Produção.
- **L104 3 Produção e Filmagem** (`=SUBTOTAL(9,C105:C200)`): L105 3.1 Equipe; L111 3.2 Elenco Principal; L117 3.3 Elenco Coadjuvante; L123 3.4 Elenco Secundário; L129 3.5 Figuração; L135 3.6 Cenografia; L141 3.7 Figurino; L147 3.8 Maquiagem; L153 3.9 Equipamento; L159 3.10 Material Sensível; L165 3.11 Laboratório; L171 3.12 Alimentação; L177 3.13 Transporte; L183 3.14 Passagens Aéreas (trecho); L189 3.15 Hospedagem (locais); L195 3.16 Despesas de Produção.
- **L202 4 Pós-Produção** (`=SUBTOTAL(9,C203:C280)`): L203 4.1 Equipe; L209 4.2 Material sensível; L215 4.3 Laboratório de imagem; L221 4.4 Estúdio de som / efeitos; L227 4.5 Edição de imagens / som; L233 4.6 Letreiros/créditos; L239 4.7 Efeitos de imagem / som; L245 4.8 Música original; L251 4.9 Direitos autorais música; L257 4.10 Alimentação; L263 4.11 Transporte; L269 4.12 Passagens Aéreas (trecho); L275 4.13 Hospedagem (locais).
- **L282 5 Despesas Administrativas** (`=SUBTOTAL(9,C283:C348)`): L283 5.1 Advogado; L289 5.2 Aluguel de base produção; L295 5.3 Contador; L301 5.4 Controller; L307 5.5 Cópias e Encadernações; L313 5.6 Correio; L319 5.7 Depto Pessoal/Auxiliar Escr; L325 5.8 Material de Escritório; L331 5.9 Mensageiro / Courrier; L337 5.10 Secretaria; L343 5.11 Telefone.
- **L350 6 Tributos e Taxas** (`=SUBTOTAL(9,C351:C356)`): L351 6.1 Encargos Sociais.
- **L358 TOTAL DE PRODUÇÃO** (`=SUBTOTAL(9,C52:C356)`). Como o `SUBTOTAL` ignora subtotais aninhados, o resultado é a soma das folhas.
- **L360 7 Comercialização** (`=SUBTOTAL(9,C361:C438)`): L361 7.1 Equipe de Lançamento; L367 7.2 Assessoria de imprensa; L373 7.3 Material de divulgação; L379 7.4 Mídia (rádio, tv, impressa); L385 7.5 Produção - trailler, avant-trailler; L391 7.6 Cópias; L397 7.7 Tradução e legendagem; L403 7.8 Transporte; L409 7.9 Passagens aéreas; L415 7.10 Hospedagem; L421 7.11 Alimentação; L427 7.12 Eventos (pré-estréia, cabines); L433 7.13 Produção para outras mídias.
- **L440 `8. Gerenciamento`** (`=SUBTOTAL(9,C441)`): folha **L441 `8.1` = `Gerenciamento`**.
- **L443 `9. Agenciamento, Coordenação e Colocação `** (`=SUBTOTAL(9,C444:C445)`): folhas **L444 `9.1 ` = `Agenciamento`** e **L445 `9.2 ` = `Coordenação e Colocação`**. Atenção: no modelo os códigos têm **espaço no fim**, `"9.1 "`.
- **L447 `IV.f. TOTAL GERAL`** (`=SUBTOTAL(9,C52:C445)`, travada). Alimenta `C13`.

Linhas em branco: 65, 103, 201, 281, 349, 357, 359, 439, 442 e 446.

**Rodapé**
- **L449:** `V. OBSERVAÇÕES (apresentar justificativas para cada um dos sub-itens orçamentários que apresentarem diferenças e qualquer outra informação relevante…)`. Entrada em **A450:E452**.
- **L454:** `VI. LOCA / DATA:` · `VII.  NOME LEGÍVEL DO RESPONSÁVEL:` · `VIIII. ASSINATURA DO RESPONSÁVEL:` (erros de digitação do original). Entrada na **L455**.

**Regras do DO** (M-STR §3.2.1):

1. **É proibido inserir fórmulas** além das existentes (as linhas cinzas). Fórmulas extras geram crítica de carga.
2. `IV.a`:
   - obrigatório;
   - **só dígitos e pontos** ("2", "2.1");
   - **único** por item;
   - no mesmo nível de detalhe do orçamento aprovado;
   - se o orçamento aprovado não tiver números, a proponente pode numerar.
3. `IV.b`: **todas as rubricas aprovadas**, mesmo as não executadas.
4. **Itens não previstos não entram no DO.** Ficam só na RP, com código novo, e são justificados em V.
5. `IV.c`: o último orçamento aprovado (aprovação, redimensionamento ou remanejamento, o que for mais recente). O total deve ser igual ao orçamento pactuado.
6. `IV.d`: executado por item, **incluindo a contrapartida**. Item não executado fica em branco.
7. O campo V deve justificar:
   - cada item acima do aprovado;
   - cada item executado sem aprovação (descrição e valor);
   - `II.d` negativo;
   - o uso de Outras Fontes.

O manual traz três exemplos de DO preenchido: orçamento analítico, orçamento em grandes itens e "modelo do sistema do BRDE" (páginas 19 a 22, como imagem).

---

## 5. Críticas do STR, que viram validadores no software

| Crítica | Momento | Gatilho | Fonte |
|---|---|---|---|
| Identificação | carga | `I.b` SALIC diferente do projeto; `I.d CONTA DE` vazio; `I.e BANCO` vazio | M-STR §5.1.1 |
| CPF/CNPJ | carga | Vazio ou inexistente (DV inválido, ex. `00.000.000/0000-00` fora de GRUDEV) | §5.1.2 |
| Tipo do documento | carga | Vazio | §5.1.3 |
| Nº do documento | carga | Vazio ou texto em vez de número | §5.1.4 |
| Datas | carga | Vazia, inexistente (ex. 31/11) ou em formato mm/dd/aaaa | §5.1.5 |
| Valor | carga | Separador decimal ≠ vírgula, vazio ou zero | §5.1.6 |
| RP×DE | envio | `HISTÓRICO` da RP inexistente no DE, ou com `DATA DO PGTO` ≠ `DATA` do DE | §5.3.1 |
| RP×DO | envio | `ITEM ORÇAM.` da RP não encontrado em `IV.a` nem `IV.b`; diferença mínima de texto já reprova | §5.3.2 |
| A comprovar × comprovado | envio | Comprovado menor que a comprovar, o que **bloqueia** o envio | §5.3.3 |
| Versão da planilha | carga | "irregularidade nas versões" das planilhas, provavelmente por modelo errado ou desatualizado **[?]** | §4.1.4 |

---

## 6. STR – Documentos Fiscais

Fonte: "Manual de Envio de Documentos Fiscais – STR", de 04/05/2021 (M-DF).

**Acesso:** `https://strdocs.ancine.gov.br` → OUTROS SERVIÇOS → Triagem Financeira → Módulos → "Enviar documentos fiscais de um projeto". Só fica disponível depois que DO, RP e DE foram apresentados.

**Base legal (IN 159, Anexo, art. 2º §1º):** as cópias digitalizadas vão pelo STR **quando solicitadas**. Para projetos aprovados antes de 17/01/2022, há prazo de até 180 dias contados da diligência (§2º).

### 6.1 Natureza do documento, por lançamento (linha) da RP

| Natureza | Quantidade | Obrigatório? | Exemplos |
|---|---|---|---|
| **Documento Principal** | **exatamente 1** por linha | Sim | NF, NF-e, recibo, DARF |
| **Comprovante de Pagamento** | 0 ou 1 | Não, para o sistema | Comprovante de TED/PIX, cópia de cheque |
| **Outros Documentos** | 0 a n | Não. Exige o campo "Informação complementar" | Contrato, print dos créditos (para provar o vínculo), contrato de câmbio |

### 6.2 Arquivos

1. Formato: **PDF**, **1 documento por arquivo**, até **15 MB**.
2. Sem página em branco: um PDF com página em branco é rejeitado.
3. O conteúdo precisa estar legível, com no mínimo:
   - número do documento;
   - nome e CPF/CNPJ do credor **e do tomador**;
   - data de emissão;
   - tipo do documento;
   - identificação do projeto (nome e SALIC ou nº do contrato FSA);
   - descrição dos itens ou serviços.

### 6.3 Reclassificação, que o manual recomenda sempre

O manual sugere reclassificar todo documento no tipo padronizado do sistema (Recibo, Nota Fiscal, Nota Fiscal Eletrônica etc.).

| Tipo reclassificado | O que exige |
|---|---|
| **NOTA FISCAL ELETRÔNICA** | Campo **Chave**:<br>• NF-e: chave de acesso de 44 dígitos (ex. `3520 0915 4369 4000 0871 5500 1000 8512 8919 5663 1097`);<br>• NFS-e: código de verificação (ex. `LCQU-W4AK`). |
| **TRIBUTO** | Permite **associar a guia às linhas da RP** que são o fato gerador. |

### 6.4 Qualidade do documento

Situações que o sistema atribui: `Pendente de Upload`, `Em Processamento`, `Aprovada`, `Rejeitada` (em branco, desfocado) e `Justificado o não envio`.

### 6.5 Justificativa de ausência ou baixa qualidade

- É feita **por lançamento**, mesmo quando o envio foi em lote.
- Motivo: `Documento ilegível`, `Documento extraviado` ou `Outros`.
- Texto obrigatório de **até 1.000 caracteres**, com anexo opcional.

### 6.6 Envio em lote

O nome do arquivo indica a linha da RP. **A primeira linha de lançamento é a 12.**

| Natureza | Padrão do nome | Exemplo |
|---|---|---|
| Documento principal | `NNNNN_P.pdf` | `00012_P.pdf` |
| Comprovante de pagamento | `NNNNN_C.pdf` | `00012_C.pdf` |
| Outros documentos | `NNNNN_O_NN.pdf` | `00012_O_01.pdf` |

- Erros de associação geram um relatório em PDF.
- O manual recomenda enviar em blocos quando houver centenas de arquivos.

### 6.7 Situações do processo

- `Aguardando envio de documentos`
- `Em edição pelo proponente`
- `Documentos fiscais enviados para análise da ANCINE`: a partir daqui o processo fica **travado**.

O envio gera um **Código do Envio** e uma data.

---

## 7. Logomarca e Bandeira Nacional

Fontes:
- IN 130/2016, consolidada com a IN 152/2020;
- Manual de Aplicação da Logomarca **v3.0 (24/08/2022)**, que é a versão vigente: o controle de versões lista 1.0 (02/12/2009), 2.0 (31/01/2017) e 3.0 (24/08/2022);
- "Orientações para a inserção da Bandeira Nacional";
- página "Aplicação da Logomarca".

### 7.1 Qual marca usar, por fonte de recurso (IN 130, art. 2º, II)

| Fonte no plano de financiamento | Logomarca Obrigatória |
|---|---|
| Fomento indireto (Leis 8.313, 8.685, 11.437, 12.599, MP 2.228) e/ou fomento direto com orçamento da ANCINE | **ANCINE** |
| **FSA**, com ou sem outras fontes | **Conjunto**: ANCINE + FSA + agente financeiro (BRDE, ou FINEP quando for o agente) |
| RECINE / Programa Cinema Perto de Você | ANCINE + Cinema Perto de Você. O manual v3.0, capítulo VI, exige a ANCINE em infraestrutura com RECINE. |
| Qualquer projeto com recurso público | **Bandeira Nacional** em todo material de divulgação (art. 3º-A, Lei 5.700/1971) |

### 7.2 Onde aplicar (IN 130, art. 4º, já com a redação da IN 152)

| Tipo de projeto | Logomarca obrigatória em |
|---|---|
| Desenvolvimento | **Créditos iniciais e cartaz** da obra produzida a partir do roteiro, qualquer que seja a fonte da produção. É facultativa quando a obra for produzida por terceiro sem recurso público (§4º). |
| Produção ou finalização | **Créditos iniciais e cartaz** |
| Distribuição ou comercialização | **Cartaz** |
| Festival internacional | **Cartazes, vinhetas de abertura e catálogo** |
| Infraestrutura | **Placa de aço escovado** ao lado da bilheteria |
| Obra sem créditos iniciais | **Créditos finais** (§5º) |
| Demais materiais e créditos finais | Facultativo (§1º). A obrigação nos créditos finais foi **revogada**. |
| Obras derivadas não incentivadas | Facultativo (manual, capítulo VII) |

### 7.3 Matriz por peça

| Produto | Logo ANCINE e/ou FSA | Bandeira |
|---|---|---|
| Obra | obrigatória | facultativa |
| Cartaz | obrigatória | obrigatória |
| Site | facultativa | obrigatória |
| Trailer | facultativa | obrigatória |
| Demais materiais de divulgação | facultativa | obrigatória |
| Vinheta de abertura de festival internacional | obrigatória | **facultativa (manual v3.0)** × **obrigatória (Orientações da Bandeira)** **[?] divergência entre os dois documentos oficiais** |
| Catálogo de festival internacional | obrigatória | obrigatória |
| Placa de aço escovado (infraestrutura) | obrigatória | facultativa |

Fontes: manual v3.0, capítulo V; Orientações da Bandeira.

**Bandeira Nacional:**
- obrigatória em material **impresso, virtual ou audiovisual**, **exceto memes e vídeos curtos**;
- vale para projetos **não finalizados até 01/04/2020**, com a finalização medida pela data de emissão do CPB;
- **não há tamanho, posição nem ordem definidos**: a ANCINE orienta usar a proporção das demais marcas;
- **é proibido** alterar forma, cores, proporções ou dístico, ou acrescentar inscrições (Lei 5.700, art. 31).

### 7.4 Regras checáveis do Manual v3.0

| Regra | Valor |
|---|---|
| Duração da cartela ANCINE nos créditos iniciais | **≥ 3 s**, sem contar fade-in e fade-out. Deve vir **antes** das demais cartelas obrigatórias. |
| Cartela FSA + agente financeiro, juntos | **≥ 2 s**. **Nenhuma outra marca** na cartela (nem proponente, produtora, patrocinador ou apoiador). Vem depois da cartela ANCINE. |
| FSA e agente em cartelas separadas | Cada uma **≥ 2 s**. Ordem: ANCINE → FSA → agente financeiro. |
| Vinheta de festival internacional | Logo ANCINE **≥ 3 s**, no idioma do país do evento. Há versões em PT, EN, FR, ES, IT, DE, JA e RU. |
| Material audiovisual de divulgação (making of, teaser, trailer), se a marca for usada | Pode dividir cartela com outras marcas, em qualquer posição, **sem a duração mínima de 3 s**. |
| Ordem do conjunto | **Agente financeiro (esquerda ou cima) → FSA (meio) → ANCINE (direita ou baixo)** |
| Alinhamento | FSA e ANCINE: pelo **topo** (disposição horizontal) ou pelo **centro** (vertical). Em relação às outras marcas, sempre pelo centro. Alinhamento ótico permitido. |
| Proporção | • ANCINE e FSA com a **mesma altura** (sem contar as assinaturas).<br>• Altura do "**B**" do BRDE = altura do "**a**" da ANCINE.<br>• Reserva de integridade = altura do "a" da ANCINE em volta do conjunto. |
| Tamanho mínimo | **Não há**, desde que a leitura seja perfeita (inclusive dos textos) e a proporção com as demais marcas seja mantida. |
| Visibilidade | **≥ a marca mais visível da peça** em tamanho, duração e posição. No site, na **mesma seção** das demais marcas. |
| Cor | Só **colorida** ou **monocromática** (positivo ou negativo).<br>**Proibido:** escala de cinza; marca colorida em peça finalizada em P&B; cores alternativas, bordas, elementos extras, distorção ou outra tipologia.<br>**Uniformidade:** todas as marcas da peça coloridas, **ou** todas monocromáticas. |
| Tipografia | • ANCINE: Frutiger + DeriaSans.<br>• FSA: 21st + DeriaSans.<br>Não pode ser alterada. |
| Placa de infraestrutura | • **Aço escovado, 40 × 26 cm**.<br>• Logo monocromática positiva, com a ANCINE de **≥ 15 cm de largura**.<br>• Arial preta, entrelinha de 100%.<br>• Texto: **"Este cinema contou com recursos públicos geridos pela Agência Nacional do Cinema – ANCINE"**.<br>• Fixada ao lado da bilheteria, a **1,5 m do piso até a base**, em bom estado. |
| Aprovação prévia | **Não é necessária.** A verificação é feita pela COB/SPR na análise do cumprimento do objeto. Exceções devem ser consultadas antes: `cob.spr@ancine.gov.br` (`cae.spr@` para infraestrutura). |
| Texto descritivo junto à marca | Segue o edital ou chamada, quando ele exigir. Agentes financeiros seguem o próprio manual de marca (BRDE: `brde.com.br/marca` e `manualmarcabrde.pdf`). |

**Cores institucionais** (manual, p. 7):

| CMYK | RGB | Pantone |
|---|---|---|
| (85,25,90,10) | (31,132,76) | 356C |
| (85,15,90,0) | (0,156,86) | 355C |
| (50,20,95,0) | (144,169,68) | 377C |
| (50,0,90,0) | (139,199,81) | 376C |
| (0,15,80,0) | (255,214,79) | 116C |
| (68,27,74,8) | (91,140,96) | 5625C |
| (75,15,0,0) | (0,167,225) | 7460C |

**Arquivos oficiais para download** (página "Aplicação da Logomarca"):
- `arquivos/logo-ancine-2014.zip`
- `copy_of_FSA.zip`
- conjunto ANCINE/FSA/BRDE em JPG e PNG, colorido, monocromático preto e monocromático branco (`3logostransparente.png`, `LogosMono_BRDE_FSA_ANCINE_v2.png` etc.)
- cartelas (`cartelas2014.rar`, `logos-monocromaticos.zip`)
- versões em idiomas (`ingles.rar` etc.)

Os links completos estão em Fontes.

### 7.5 Sanções

| Situação | Consequência | Base |
|---|---|---|
| Marca aplicada **em desacordo com o manual** | **Advertência** | IN 130, art. 6º §1º |
| **Não aplicação** nos créditos iniciais (desenvolvimento, produção ou finalização), no cartaz (distribuição), na vinheta ou no catálogo (festival) ou na placa (infraestrutura) | **Devolução de 2%** dos recursos públicos federais **mais rendimentos**, calculada **por projeto** quando há vários projetos da mesma obra | art. 6º §2º I, §§3º–4º |
| **Não aplicação** no cartaz (desenvolvimento, produção ou finalização) ou no cartaz do festival | **Devolução de 0,5%** | art. 6º §2º II |
| Teto | A Diretoria pode agravar ou reduzir, **até 2%** | §6º |
| Recusa em devolver | Reprovação + TCE | §5º |
| Pagamento | GRU destinada ao FNC/FSA, atualizada desde a decisão | art. 10 |
| Qualquer descumprimento | **Aprovação com ressalvas** | IN 130, art. 7º; IN 159, art. 28 XI |
| Não aplicação | Gera **débito financeiro** | IN 159, art. 31 III |
| Infraestrutura | **30 dias** para corrigir depois da decisão; senão, inadimplência ou inabilitação | IN 130, art. 9º |
| Bandeira | **Contravenção penal (multa)**, comunicada ao MPF | art. 6º §7º, art. 12 parágrafo único |
| Recurso | 30 dias, à Diretoria Colegiada | art. 13 |
| Quitação da penalidade | Não presume aprovação das contas | art. 11 |

---

## 8. IN 159/2021: texto vigente consolidado

Texto lido na página oficial, modificada em 12/08/2026.

### 8.1 Alterações

| Norma | O que mudou na IN 159 |
|---|---|
| **IN 160, 03/03/2022** | • Revogou o art. 10 III (comprovação por CLT/holerite).<br>• Nova redação de art. 10 §2º, art. 18 II e art. 18 XXXIV-a (este depois revogado). |
| **IN 164, 01/09/2022** | • **Revogou o Capítulo VIII** (parcelamento, arts. 51–53).<br>• O tema passou à própria IN 164: atualização pela **SELIC** a partir do mês seguinte ao vencimento + **1% no mês do pagamento**; multa de mora de **0,33% ao dia, limitada a 20%**; parcelamento em até **60 vezes**, com parcela mínima de **R$ 200 (PJ)** e **R$ 50 (PF)**. |
| **IN 167, 24/04/2023** | • Art. 16 §2º: doação da **própria proponente** passou a valer como contrapartida.<br>• Art. 16 §3º.<br>• Art. 18 VII: **tarifa de manutenção de conta deixou de ser glosada**.<br>• Art. 18 XIII.<br>• **Revogou o art. 18 XXXIII** (diária no município sede).<br>• **Revogou o art. 18 XXXIV-a**.<br>• Nova redação do art. 18 XXXIV-b. |
| **IN 176, 07/05/2026** (FUNCINES; DOU de 11/05/2026) | Anexo, art. 1º VII-e: passou a cobrir infraestrutura "para **construção**, implantação, reforma ou **recuperação**", e o memorial do engenheiro ou arquiteto passou a ser exigido só "**quando for o caso**". |
| **DDC 1965-E/2023**, de 22/11/2023 (não altera o texto da IN) | Acrescenta como **hipótese de reembolso** a "locação intermediada por plataforma digital de aluguel por temporada", com **aplicação imediata** (FAQ SPR 1.1). |
| Acórdão TCU 2641/2022 | Tornou sem efeito os pontos do Acórdão 721/2019 sobre pagamentos à própria proponente ou grupo econômico, tributos e contrapartida por doação (FAQ SPR 1.1). |

### 8.2 Art. 18: despesas glosadas independentemente das características do projeto

Texto vigente, com as alterações:

> **Art. 18.** Serão consideradas irregulares e efetivamente glosadas, independentemente das características do projeto a elas vinculadas, as seguintes hipóteses:

I. despesas que não apresentem o correspondente documento fiscal comprobatório;

II. despesas cujo correspondente documento fiscal tenha sido lançado em duplicidade ou comprovadamente apresentado na prestação de contas de outro projeto cadastrado junto à ANCINE, ao Fundo Setorial do Audiovisual, ou à outras esferas públicas (Municipal, Estadual ou Federal); *(red. IN 160)*

III. despesas que comprovadamente se referem a outro projeto;

IV. pagamento de agenciamento para os seguintes casos:
   - a) captações de recursos em mecanismos diferentes do art. 1º-A da Lei n.º 8.685, de 1993, e da Lei n.º 8.313, de 1991;
   - b) captações de recursos provenientes de editais ou qualquer outro mecanismo de seleção pública, incluindo ações do Fundo Setorial do Audiovisual, programas internacionais e seleções realizadas por órgãos ou empresas estatais de qualquer entidade federativa; e
   - c) à própria proponente ou coprodutores, bem como a todas as empresas com sócios em comum ou pertencentes ao mesmo grupo econômico.

V. pagamento de Coordenação e Colocação para agentes não autorizados ou registrados na CVM (Deliberação CVM 372/2001 e Instrução CVM 348/2001), ou para a captação de recursos em mecanismos diferentes do art. 1º da Lei n.º 8.685, de 1993;

VI. pagamento que exceda os limites percentuais para as rubricas orçamentárias de gerenciamento e execução, de agenciamento e de coordenação e colocação;

VII. pagamento de juros e multas de qualquer natureza; IOC, IOF, tarifas bancárias, exceto a de manutenção da conta; qualquer encargo contratual, salvo tributos ou encargos pagos sobre os rendimentos das aplicações financeiras e fechamento de contratos de câmbio; *(red. IN 167)*

VIII. pagamento de anuidade de cartão de crédito e taxas financeiras não relacionadas à conversão de moeda, nos casos de despesas efetuadas em moeda estrangeira por meio de cartão de crédito;

IX. pagamento de fatura de cartão de crédito na hipótese de não serem apresentados os correspondentes documentos comprobatórios das despesas que integram a fatura e a comprovação de vínculo contratual entre o projeto e o titular do cartão;

X. despesas reembolsadas sem apresentação dos correspondentes documentos comprobatórios e a comprovação de vínculo entre o projeto e o beneficiário do reembolso, conforme art. 15;

XI. pagamento de passagens, hospedagem e diárias na hipótese de não serem comprovados os vínculos entre o projeto e o beneficiário destas despesas;

XII. pagamento de serviço de Auditoria Independente;

XIII. pagamento de CONDECINE, de despesas referentes à obtenção da Classificação Indicativa, do Certificado de Produto Brasileiro - CPB e do Certificado de Registro de Título - CRT; *(red. IN 167; saiu "outros certificados ou registros oficiais")*

XIV. pagamento de despesa relacionada à rubrica glosada ou não autorizada pela ANCINE em análise realizada antes da fase de prestação de contas;

XV. serviço de cópias e reprodução de matrizes de obras audiovisuais executadas em laboratórios instalados no exterior e que se destinem à exploração comercial no mercado brasileiro;

XVI. aquisição de material permanente, excetuando-se:
   - a) os projetos de infraestrutura técnica, para os quais a aquisição de material permanente faz parte do cumprimento de sua finalidade;
   - b) aquele que tenha sido adquirido por motivo de economicidade ou por indisponibilidade para locação, desde que comprovado com justificativa e recibo de doação emitido em papel timbrado da instituição recebedora, que deverá ser sem fins lucrativos ou pública; e
   - c) aquela que tenha sido realizada para entrega à entidade pública ou privada de interesse público que não possa receber contraprestação pecuniária pela autorização de uso de espaço físico ou eventual prestação de serviço, desde que a despesa seja comprovada com recibo/termo de autorização, recibo detalhando e atestando o recebimento do bem, ambos emitidos pela entidade contratada, e nota fiscal do bem emitida pelo estabelecimento comercial.

XVII. despesas com bebidas alcoólicas;

XVIII. despesas com cigarros, exceto nos casos em que estiverem caracterizadas como objeto de cena;

XIX. pagamento de serviço de gerenciamento a empresa de serviços de radiodifusão de sons e imagens, empresas de comunicação eletrônica de massa por assinatura, distribuidoras cinematográficas, de vídeo ou de programas de televisão, empresas de telefonia fixa, empresas de telefonia móvel celular;

XX. despesas executadas fora dos marcos temporais iniciais e finais estabelecidos nos respectivos regramentos;

XXI. comprovantes de despesas que não tenham sido emitidos em nome da empresa proponente, com exceção dos comprovantes de despesas da contrapartida obrigatória emitidos em nome de coprodutores ou distribuidores, ficando sua aceitação condicionada à apresentação de cópias dos contratos pertinentes, observados os termos dos art. 8º e art. 9º;

XXII. documento fiscal irregular;

XXIII. nota fiscal fora do prazo de validade;

XXIV. documentos fiscais rasurados, rasgados ou com dados ilegíveis;

XXV. comprovantes de despesas que não estejam adequados ao previsto nos arts. 9º, 10, 11, 12, 14 e 15;

XXVI. documentos fiscais nos quais a pessoa natural prestadora do serviço não possua vínculo societário ou empregatício com a empresa emitente;

XXVII. despesas realizadas em itens não financiáveis, conforme definido em instrução normativa da ANCINE sobre aprovação e acompanhamento de projetos audiovisuais ou em regramento de fomento direto;

XXVIII. despesas a título de contrapartida obrigatória executadas por meio de recursos públicos de origem municipal, estadual, distrital ou federal, incluindo os aportes oriundos de Programas Internacionais de Fomento com os quais a ANCINE mantenha convênio, bem como oriundas de aporte da parte do coprodutor estrangeiro, no caso de coprodução internacional reconhecida pela ANCINE;

XXIX. documentos com data de emissão posterior à 30 (trinta) dias da data do débito correspondente em conta corrente;

XXX. execução de despesas em contas correntes não autorizadas pela ANCINE, ressalvado o previsto no art. 15;

XXXI. despesas realizadas em desacordo com as regras estabelecidas pela ANCINE para movimentação de recursos na conta do projeto;

XXXII. despesas executadas em itens orçamentários comprovados com aporte de recursos não financeiros de terceiros, comprovados por meio de contrato, apresentados para fins da comprovação da captação mínima de recursos exigidos na aprovação para execução do projeto;

XXXIII. ~~pagamento de diária para profissional que esteja trabalhando no município sede da produtora ou que não possua vínculo comprovado com o projeto;~~ **(revogado pela IN 167)**

XXXIV. comprovação de contrapartida por meio de declaração de doação de produtos e serviços nas seguintes situações:
   - a) ~~Doação de produtos e serviços, bem como o comodato de bens, equipamentos ou materiais, da proponente ou de seus sócios;~~ **(revogada pela IN 167)**
   - b) Doações de produtos e serviços em itens orçamentários não aprovados ou em montantes que gerem extrapolação do valor aprovado do item a que se refere; *(red. IN 167)*
   - c) Doações do serviço de gerenciamento;
   - d) Doações de produtos e serviços de terceiros comprovadas apenas com contratos; e
   - e) Doações de terceiros sem comprovação de vínculo com o projeto.

XXXV. despesas de infraestrutura nos projetos da modalidade de produção; e

XXXVI. pagamentos de despesas com folha de pessoal da proponente.

**Total:** 36 incisos, dos quais 35 estão vigentes (o XXXIII foi revogado).

**Artigos relacionados, em resumo:**

| Artigo | Conteúdo |
|---|---|
| Art. 19 | Despesas estranhas ao projeto: caráter pessoal; itens inconsistentes com a natureza do projeto; tributos sobre resultado, lucro ou receita da proponente ou do coprodutor. |
| Art. 20 | Glosa total ou parcial possível para:<br>• item não previsto;<br>• valor acima do pactuado;<br>• item inconsistente com o objeto.<br>Vale **mesmo dentro dos 20% de remanejamento** se a justificativa não for aceita. |
| Art. 21 parágrafo único | Contrapartida executada fora da conta, além do mínimo, **não compensa** glosas nem recursos públicos não comprovados. |
| Art. 22 | Glosa recolhida antes ou na forma da decisão permite **aprovação com ressalvas**. |

### 8.3 Arts. 28 e 29, por serem parametrizáveis

**Art. 28, aprovação com ressalvas.** Inclui, entre outros:
- **VI:** concentração de **≥ 25%** do total executado em um mesmo fornecedor ou grupo, somando **todas as RPs de todos os processos da mesma obra e objeto**. Exceções: animação, jogos eletrônicos e orçamento **< R$ 500.000**;
- **VIII:** depósitos ou retiradas de recursos próprios sem finalidade de pagamento;
- **IX:** formulários preenchidos de forma incorreta;
- **XI:** logomarca;
- **XII:** transferências para outras contas que não sejam pagamento a fornecedor.

**Art. 42, sanções:**
- **advertência** para os incisos I–V, VIII, IX e XII do art. 28, e para concentração **≤ 50%**;
- **inabilitação por até 2 anos** em caso de reincidência, de alteração do projeto técnico sem autorização (X) e de concentração **> 50%**.

**Art. 29, não aprovação:**
- omissão;
- não entrega do material do objeto;
- glosa não ressarcida;
- valores não comprovados e não devolvidos;
- gestão fraudulenta;
- **CPB não emitido ou inconsistente**;
- **diligência indispensável não atendida**;
- descumprimento de obrigação de fomento direto;
- objeto reprovado.

### 8.4 ANEXO da IN 159 (texto vigente)

> **Art. 1º** Integram a prestação de contas os seguintes documentos:

I. relação de pagamentos;

II. demonstrativo do extrato da conta corrente;

III. demonstrativo orçamentário e financeiro;

IV. comprovantes de recolhimentos dos saldos das contas-correntes de movimentação e de aplicação de recursos, quando houver, por meio da Guia de Recolhimento da União - GRU;

V. comprovantes de encerramento das contas-correntes de movimentação de recursos abertas pela própria proponente;

VI. extrato das contas bancárias utilizadas pelo projeto, inclusive as contas de aplicação financeira, compreendendo o período da abertura até seu encerramento;

VII. material comprobatório de cumprimento do objeto e finalidade, de acordo com a modalidade do projeto:

- a) **desenvolvimento**:
  1. cópia do roteiro desenvolvido;
  2. no caso de animação, descrição da técnica a ser utilizada, concepção visual (modelagem das personagens e croquis de cenários) e exemplos da estória em quadros ou animatique;
  3. materiais comprobatórios da pesquisa, quando constantes do orçamento.
- b) **produção**: número do CPB emitido para a obra.
- c) **distribuição ou comercialização**:
  1. número do CRT emitido para a obra;
  2. data do lançamento comercial.
- d) **festival internacional**:
  1. catálogo oficial do evento; e
  2. fotos ou vídeo de cobertura do evento; ou
  3. clipping de notícias.
- e) **infraestrutura para construção, implantação, reforma ou recuperação de sala ou complexo de exibição** *(red. IN 176/2026)*:
  1. alvará de funcionamento da sala ou complexo;
  2. relatório ou memorial descritivo emitido e assinado pelo engenheiro ou arquiteto responsável pela obra, detalhando o projeto executado, **quando for o caso** *(red. IN 176)*;
  3. fotos demonstrando o objeto finalizado e a situação anterior à execução;
  4. fotos comprovando a aplicação da logomarca obrigatória.
- f) **infraestrutura técnica para atualização tecnológica**:
  1. fotos do equipamento instalado;
  2. laudos técnicos da empresa responsável pela instalação e fornecimento, sobre a adequação dos equipamentos ao local;
  3. fotos comprovando a logomarca.
- g) **formação de público**:
  1. lista de presença e questionário de avaliação, preenchido e assinado pelo profissional da instituição de ensino responsável pelo acompanhamento;
  2. relação das obras brasileiras consideradas, com as datas de exibição;
  3. comprovação da exibição, por exemplo pelos materiais de divulgação;
  4. fotos comprovando a logomarca nas salas.
- h) **formação e qualificação audiovisual**:
  1. exemplar do material didático e/ou conteúdo audiovisual produzido, sem ônus, após a conclusão;
  2. relatório de impacto, com os resultados da capacitação;
  3. relatório de resultados abrangendo **todas** as operações comerciais geradas pelo projeto, inclusive anteriores;
  4. material de divulgação com a logomarca;
  5. controles de frequência, resultados das avaliações e certificados de conclusão.

VIII. cópias digitalizadas dos documentos fiscais e auxiliares comprobatórios das despesas do projeto.

> **Parágrafo único.** Em projetos com característica de **aquisição de ações**, apresentar cópia do registro na junta comercial ou outro comprovante da operação.

> **Art. 2º** Os formulários I, II e III são encaminhados **pelo sistema eletrônico da ANCINE** (STR).
> - §1º As cópias do inciso VIII, **quando solicitadas**, vão pelo sistema eletrônico.
> - §2º Para projetos aprovados até a vigência da IN, o envio do §1º pode ocorrer em até **180 dias da diligência**.
> - §3º A **prestação de contas parcial dispensa os incisos IV e V**.

> **Art. 3º** O cumprimento do objeto de produção considera a **cópia vinculada ao CPB**. A FAQ 15.1 acrescenta que ela é enviada por upload na Central de Conteúdo de Obras Audiovisuais e deve **conter as logomarcas obrigatórias**.

> **Art. 4º** Fomento direto segue o edital, que pode acrescentar ou dispensar documentos.

**Formulários do ANEXO:** são exatamente os três `.xls` do STR (RP, DE e DO), ligados no próprio texto da IN pelos `resolveuid` que redirecionam para os arquivos baixados. **Não há outros formulários-modelo no Anexo.**

---

## 9. FSA e BRDE

Fontes:
- **BRDE, "Guia de Acompanhamento de Projetos contemplados pelo FSA", janeiro de 2025** (G-BRDE25), que é o vigente na aba Acompanhamento;
- Guia v04 de 06/02/2020, para histórico;
- modelos de relatório de comercialização e planilha de retorno do BRDE;
- FAQ SPR 1.3 e 14.10;
- IN 159, art. 57.

### 9.1 Regras gerais

| Tema | Regra | Fonte |
|---|---|---|
| Norma aplicável à PC | **Edital e contrato**; a IN 159 e a IN 158 se aplicam **subsidiariamente**. A PC "especial" do contrato FSA segue as regras da PC parcial (arts. 54–57). | FAQ 1.3; IN 159, art. 57 |
| Onde se entrega a PC | Análise pela ANCINE (SPR), em sistema próprio. Planilhas pelo STR, como os demais projetos. Dúvidas: `prestacao.contas@ancine.gov.br`. | G-BRDE25 §5; M-STR §3.2.1 (I.d = "FSA") |
| Prazo da PC | **O do contrato.** Com recurso incentivado + FSA na mesma obra, vale o **maior** prazo. Prorrogação de **até 3 meses** com requerimento motivado, por `acompanhamento.fsa@brde.com.br`. | G-BRDE25 §4.3; Guia 2020 §5; IN 159, art. 5º |
| Despesas após a conclusão | Os contratos FSA "costumam" ter **limite final mais restrito** para os gastos. Para projetos sob a IN 158, **nenhuma despesa depois de 180 dias da conclusão do objeto** (art. 57). | FAQ 2.10 |
| Conta | Depósito **único** do BRDE em conta BB aberta pela ANCINE (IN 158). Diligência de **30 dias** para indicar a agência. O aporte vai em `DE II.c FOMENTO` na **conta de movimentação**. | G-BRDE25 §2.1; M-STR §3.2.2 |
| Recursos próprios exigidos como captação mínima | **Não** são depositados na conta de movimentação e **não** entram na PC da SPR. São verificados pela área de fomento. | FAQ 14.10 |
| Conclusão do objeto (para fins do FSA) | • Produção: CPB; série: último episódio no CPB.<br>• Desenvolvimento: entrega do projeto.<br>• Comercialização: data da 1ª exibição comercial, informada no SAPIO.<br>• Festival: catálogo ou fotos, vídeo, clipping.<br>• Jogos: executável + vídeo de *playthrough* + relatório de pós-lançamento.<br>Tudo pelo **SAPIO**. | G-BRDE25 §3 |
| Prorrogações | • Conclusão: até **metade do prazo ordinário**. O FAE é dispensado se a prorrogação for de até 180 dias ou se houve FAE nos 120 dias anteriores.<br>• Lançamento: até **12 meses**.<br>• Condições de desembolso: até **12 meses**, com **≥ 50%** da captação exigida.<br>• O **FAE parcial e final foi extinto** pela IN 158: o SAPIO ainda mostra "vencido", mas isso **não** conta como inadimplência. | G-BRDE25 §4 |
| Remanejamento | • **< 20%**: sem aprovação prévia, mas justificado na PC.<br>• **> 20%** ou redimensionamento: aprovação prévia. Orçamento em grandes itens: via **CUP** (`apps.ancine.gov.br/ords/r/ancine/cup/home`); orçamento detalhado: via protocolo digital (CAS/SFO). | G-BRDE25 §4.10; IN 158, arts. 49–50 |
| Prazo da ANCINE para analisar pedidos de acompanhamento | **90 dias corridos**, interrompido por diligência. | IN 158, art. 3º II e §3º |
| Logomarcas | Conjunto ANCINE + FSA + agente financeiro, conforme contrato + IN 152 + manual ANCINE + manual BRDE. Sem validação prévia. | G-BRDE25 §6 |

### 9.2 Relatórios de comercialização (retorno ao FSA)

**Quem apresenta:** a produtora e a distribuidora, **cada uma o seu** relatório.

**Período (semestral):**
- começa na **data de lançamento** e vai até o dia anterior a 6 meses depois. Exemplo: 10/09/2017 a 09/03/2018; depois 10/03/2018 a 09/09/2018;
- o dia de início é o mesmo para todos os relatórios;
- o 1º relatório inclui **todas** as receitas anteriores ao lançamento: pré-licenciamento, licenciamento de marca e cessão de direitos.

**Prazos:**
- 1º relatório: **dia 15 do 7º mês seguinte ao mês da data de exibição ou lançamento**;
- seguintes: **dia 15 do 7º mês após o fim do período anterior**;
- exemplos do guia: lançamento em 09/2017 → 15/04/2018; 2º relatório → 15/10/2018;
- se o 1º período já tiver passado quando o contrato for assinado: **dia 15 do 3º mês** após a assinatura.

**Duração e forma:**
- a obrigação vale durante **todo o "Prazo de Retorno Financeiro"**, definido no contrato. **[?] O número de anos não foi encontrado nos guias; está no contrato ou no RG PRODAV.**
- O envio é **exclusivamente pelo SAPIO**. A planilha do BRDE ainda menciona meio físico + eletrônico, o que é anterior ao SAPIO **[?]**.
- **Sem receita no período:** relatório simplificado, só com a aba "Aspectos Gerais".

**Modelos do BRDE** (`.xlsx`, baixados):

| Modelo | Abas |
|---|---|
| CINEMA | `1. Aspectos Gerais`, `2. Desempenho Salas`, `3. Receitas Outras Janelas`, `4. P&A`, `5. Resultados`, `6. Anexos` |
| TV | Estrutura análoga |

Campos-chave:
- **Salas:** sacado, CNPJ/CPF, nº e data do documento, valor faturado; exibidor, nº de salas, cópias, ingressos, CNPJ, valor arrecadado, *fee*.
- **Janelas:** TV aberta, TV fechada, DVD rental e sell-thru, VOD, licenciamento de marcas, outras licenças, internacional.
- **P&A recuperável:** equipe, cópias, produção audiovisual, produção gráfica, mídia, promoção, transporte, outros.
- **Resultados:** RBD → tributos (PIS/COFINS: Lucro Real 1,65/7,6; Presumido 0,65/3; Simples) e ISS → RLD → comissão de distribuição → comissão do FSA → P&A → **RLP**.

**Alíquotas de retorno** (planilha BRDE "SUAT 2017 e chamadas a partir de 2018"):

| Linha | Base | Alíquota |
|---|---|---|
| Cinema e TV | Sobre a **RLP** | `0,5 × (investimento FSA / orçamento dos itens financiáveis, produção + gerenciamento)` |
| Cinema e TV | Licenciamento de marcas, imagens e adaptação | Mesma fórmula da RLP |
| Cinema e TV | **Obras derivadas** | **2%** |
| Cinema e TV | **Pré-licenciamento** | `FSA / orçamento` |
| Comercialização, modalidade A | Sobre a RLD | `FSA / despesas financiáveis comprovadas` |
| Comercialização, modalidade A | Sobre a RBD | 1/10 da alíquota sobre a RLD |
| Comercialização, modalidades B e C | Sobre a RBD | 2% |

O valor de pré-licenciamento deve ficar **disponível** para devolução, que é cobrada por boleto do BRDE depois do 1º relatório (Guia 2020, Q28).

**Licenciamento mínimo:** há planilhas por data-base (até 02/08/2017; 03/08/2017–19/03/2018; a partir de 20/03/2018), conforme as Res. CGFSA 104, 112, 136 e 142. O guia lembra que o mínimo de R$ 7.500 do item 62.5 do RG PRODAV **não vale** para TV comunitária ou universitária.

**Não encontrado:** contrato-padrão de investimento FSA com a cláusula de prazos de prestação de contas.
- Tentativa: a página de Acompanhamento e a de Contratação do BRDE.
- Os contratos são individuais. **[?] O prazo de PC do FSA deve ser lido do contrato de cada projeto.**

---

## 10. Prazos da ANCINE, prestação de contas parcial, diligências e prescrição

| Tema | Regra | Fonte |
|---|---|---|
| Prazo da **proponente** para a PC final | 180 dias da conclusão do objeto. Se a 1ª liberação de recurso for posterior à conclusão, conta-se da liberação. Fomento direto segue o regramento. Vários processos do mesmo objeto: vale o **último** prazo, com **uma PC por processo**. Objetos autônomos (desenvolvimento, produção, distribuição) **não** aproveitam o prazo um do outro. | IN 159, arts. 3º–5º; FAQ 1.2 e 2.9 |
| Fim da execução financeira | Até 180 dias da conclusão do objeto (projetos sob a IN 158). | IN 158, art. 57; FAQ 2.10 |
| Prazo para concluir o objeto | • 36 meses: animação com mais de 70 min;<br>• 24 meses: demais produções;<br>• 12 meses: desenvolvimento, distribuição e festival.<br>Todos contados da 1ª liberação. | IN 158, art. 53 |
| Omissão | Inadimplência + reprovação. Notificação; depois de **30 dias**, TCE ou cobrança. | IN 159, art. 6º |
| **Prazo da ANCINE para analisar a PC** | **Não encontrado na IN 159 nem na FAQ SPR.**<br>• A IN 158, art. 3º II (90 dias corridos) vale para análises **da IN 158** (acompanhamento), não da PC.<br>• Um resumo de busca citou "180 dias úteis a partir do Relatório de Análise Documental"; a origem não foi confirmada e parece ser de norma revogada **[?]**.<br>• Prioridade de análise: Portaria ANCINE 491-E/2019, citada no Guia BRDE 2020, Q26 **[?] vigência não verificada**. | buscas e leituras indicadas |
| Prescrição | **5 anos** (pretensões punitiva e de ressarcimento) e **intercorrente de 3 anos** com o processo parado, conforme a **Res. TCU 344/2022**, art. 2º e art. 8º. O marco da intercorrente é o 1º marco interruptivo (Res. TCU 367/2024).<br>• A ANCINE aplica a todos os processos desde a **DDC 110-E/2023 (24/01/2023)**.<br>• O Parecer Referencial PFE-ANCINE 3/2024 diz que, mesmo prescrito, a ANCINE **analisa** a PC (julgamento declaratório). Depois de reconhecida a prescrição, a proponente **não pode** ser inscrita como inadimplente, nem no SIAFI ou CADIN. | Farofafá (texto da DDC); Parecer 3/2024 |
| Prazo para instaurar TCE | **120 dias** (omissão) e **360 dias** (contas que não permitem concluir pela regularidade, contados da apresentação). | Norma TCU sobre TCE citada no Parecer 3/2024 **[?] provavelmente IN TCU 71/2012, art. 4º §1º, possivelmente substituída pela IN TCU 98/2024** |
| **Diligências** | **30 dias** contados da **confirmação de recebimento**, com prorrogação **única** de 30 dias a pedido justificado (§3º).<br>• Omissão → notificação de **inadimplência**;<br>• mais **30 dias** sem saneamento → proposta de **não aprovação** + TCE ou cobrança.<br>• A ANCINE pode pedir esclarecimentos e documentos "a qualquer tempo" (art. 47). | IN 159, arts. 45 e 47 |
| Confirmação de recebimento | Ciência nos autos, AR, meio eletrônico ou registro de servidor; recusa vale como entrega certificada.<br>A IN 158, art. 3º §2º considera **e-mail recebido em 48 h** (para as comunicações da IN 158). | IN 159, arts. 44 e 46 |
| Recurso | **30 dias**, com efeito suspensivo. Reconsideração → autoridade superior → Diretoria Colegiada (última instância). Manifestações em relatórios e pareceres não são recorríveis. | arts. 48–50 |
| Débito | GRU com vencimento em **30 dias** da emissão.<br>• **Multa de 20%** (FSA e FUNCINES) ou **50%** (Lei 8.685) sobre o débito atualizado, com a não aprovação como fato gerador.<br>• Pagar antes da não aprovação evita a multa (art. 36 §2º).<br>• Lei 8.685 com mais de 70% cumprido: devolução proporcional (art. 31 §2º).<br>• Marcos de atualização: art. 32. Com mais de 100 itens glosados, usa-se a **data média** entre a despesa mais antiga e a mais recente. | IN 159, arts. 31–37 |
| Prestação de contas parcial | A ANCINE **pode** pedir conforme o regramento específico. Documentos = Anexo **menos os incisos IV e V**. Análise: relatório financeiro parcial + análise da execução parcial; vai a deliberação. Despesas aprovadas no parcial **podem ser reanalisadas** na final. Aplica-se subsidiariamente à "PC especial" do FSA. A IN 158 prevê pedidos de PC parcial na avaliação da execução parcial (art. 43 §2º) e no redimensionamento (art. 51 parágrafo único). | IN 159, arts. 54–57; IN 158 |
| Inspeção in loco | Agendada com **≥ 10 dias** de antecedência. Impedir a inspeção leva a inadimplência. Infraestrutura: inspeção durante a análise, salvo prova documental. | IN 159, arts. 58–60 |
| Guarda de documentos | Originais por **5 anos a partir da decisão final**, em ordem cronológica ou da RP. Papel termossensível: guardar com cópia. | IN 159, art. 8º |

---

## 11. Dados abertos e consulta pública

### 11.1 Conjuntos no dados.gov.br

Lista extraída da página OCA/Dados Abertos. Formato: `https://dados.gov.br/dados/conjuntos-dados/<slug>`.

**Úteis para a prestação de contas:**

| Slug | Uso possível |
|---|---|
| `relacao-de-processos-em-fase-de-prestacao-de-contas` | Processo, SALIC, título, CNPJ, razão social, valor contratado (segundo o resumo de busca; arquivo `https://dados.ancine.gov.br/dados-abertos/ProcessosEmPrestacaoDeContas.csv`, também em XML) |
| `relacao-de-projetos-com-valores-captados-por-mecanismo-de-renuncia-fiscal` | Valores captados por mecanismo |
| `relacao-de-contribuintes-que-aplicaram-em-projetos-com-renuncia-fiscal` | Investidores por projeto |
| `projetos--de-investimento-contratados-no-ambito-do-fsa` | Contratos FSA |
| `obras-nao-publicitarias-brasileiras-com-investimento-do-fsa` | Obras com FSA |
| `obras-nao-publicitarias-brasileiras-com-fomento-indireto-aprovado-na-ancine-leis-de-incentivo-federa` | Obras com leis de incentivo |
| `relacao-de-grupos-economicos` | Detectar partes relacionadas: agenciamento (art. 18 IV-c) e concentração de 25% (art. 28 VI) |
| `agentes-economicos-regulares-registrados-na-ancine` | Cadastro de agentes |
| `produtoras-independentes-regulares-registradas-na-ancine` | Cadastro de produtoras |
| `obras-nao-publicitarias-brasileiras-registradas-na-ancine` | Confirmar CPB |
| `crt-obras-nao-publicitarias-registradas` | Confirmar CRT |
| `lancamentos-comerciais-por-distribuidoras` | Data de lançamento (prazos do FSA) |
| `relatorio-de-bilheteria-diaria-de-obras-informadas-pelas-distribuidoras` / `…-exibidoras` | Conferir o relatório de comercialização |

**Restrições de acesso encontradas:**
- O host `dados.ancine.gov.br` respondeu **403 (nginx da origem, não do proxy)** a partir deste ambiente para o CSV e para a raiz. **[?]** Pode ser bloqueio por IP ou geografia. Testar a partir do servidor do Jards.
- A **API do dados.gov.br** exige token (`chave-api-dados-abertos`; Swagger em `https://dados.gov.br/swagger-ui/index.html`). Sem token, **401**.
- O PDA 2023–2025 prevê uma **API de CRT** **[?] não localizada**.

### 11.2 Consulta pública de projetos (SAD/SIF), sem login

URL: `https://sad.ancine.gov.br/projetosaudiovisuais/ConsultaProjetosAudiovisuais.do?method=detalharProjeto&numSalic=NNNNNN`

O SALIC vai **sem hífen** (ex. `240264`). Testado com sucesso, em HTML Latin-1. A página traz:

| Bloco | Campos |
|---|---|
| Identificação | projeto, SALIC, processo, responsável, UF, diretor, produtor, roteirista, segmento, gênero, formato, sinopse |
| Situação | **SITUAÇÃO** (ex. `CEA Projeto cancelado`), **DATA DA SITUAÇÃO**, **PROVIDÊNCIA TOMADA** |
| Aprovações | Aprovação inicial (data + portaria/deliberação), **Primeira Liberação**, **Última Prorrogação**, **Período de Captação** |
| Valores | Por **mecanismo**: **Valores Aprovados**, **Valores Captados**, **Saldo** |
| Contas | **Contas de captação** e **de movimentação**: mecanismo, agência, conta, situação |

- Busca: `?method=consultarProjetos` (com `offset`).
- **Não há API.** Seria preciso raspar o HTML.

---

## 12. Checagens automatizáveis novas

Foco no STR, nos documentos fiscais, na logomarca, no FSA e nos prazos. Cada item traz a fonte.

**Legenda:**
- **B** = bloqueia o envio no STR;
- **G** = glosa ou ressalva;
- **A** = alerta.

### 12.1 Geração e formato dos arquivos

| # | Checagem | Tipo | Fonte |
|---|---|---|---|
| 1 | Exportar `.xls` BIFF8 (Excel 97-2003). Nome sem extensão com **> 5 caracteres**; sugestão: `RP_<SALIC>_<banco>-<agência>-<conta>.xls`. | B | M-STR §3.1, §3.2 |
| 2 | Partir dos modelos oficiais de 12/03/2026 e **não inserir fórmulas novas** no DO. Inserir linhas **dentro** da faixa de dados: RP entre 12 e 29 (a partir da 13); DE a partir da 16, estendendo `II.i`. | B | M-STR §3.2.1–3.2.3 |
| 3 | Gerar o conjunto certo de planilhas por SALIC:<br>• 1 DO;<br>• 1 DE por conta não BB (captação e movimentação);<br>• 1 RP por conta de movimentação;<br>• mais RP(s) de contrapartida quando houver despesa fora da conta.<br>Para contas BB Gestão Ágil, **não gerar DE**; gerar só a RP para conferir com a pré-preenchida. | B | M-STR §3.2.2, §3.2.3, §4.1 |
| 4 | SALIC nas três planilhas no formato `^\d{2}-\d{4}$` e igual ao SALIC do envio. Título e proponente iguais ao cadastro (conferível pela página SAD, §11.2). | B | M-STR §2.3, §5.1.1 |
| 5 | `DO I.d` ∈ {`Fomento Indireto (leis de incentivo)`, `Fomento Direto (Editais: PAR / PAQ / Outros)`, `FSA`}, com **texto exato**, porque `C12` compara strings. `DE I.d` ∈ {`CAPTAÇÃO`, `MOVIMENTAÇÃO`}. | B | modelos .xls |
| 6 | Banco e agência **só com dígitos**: remover o DV quando ele tiver letra (ex. `59461-X` → conta `59461`?). **[?]** A regra de "não preencher" o DV com letra está escrita para a agência; para a conta o manual não diz. | B | M-STR §3.2.2 |
| 7 | Gravar datas como **datas do Excel** (serial), nunca como texto. Rejeitar datas inexistentes e anos fora de uma faixa plausível (ex. `0202`). | B | M-STR §5.1.5, §3.2.3 (II.h) |
| 8 | Gravar valores como número (> 0 na RP), sem texto como "1.234,56". | B | M-STR §5.1.6 |

### 12.2 RP

| # | Checagem | Tipo | Fonte |
|---|---|---|---|
| 9 | `CPF/CNPJ` só com dígitos e **DV válido**. Exceções:<br>• `INVOICE`: aceita o nº do documento;<br>• `GRUDEV`: zeros;<br>• linhas de tributo: CPF/CNPJ do credor do fato gerador.<br>**[?] Risco:** o **CNPJ alfanumérico** da Receita (IN RFB 2.229/2024, atribuição a partir de jul/2026) choca com o "devem ser numéricos" do STR. Não encontrei orientação da ANCINE. Alertar e guardar o valor original. | B / A | M-STR §3.2.3, §5.1.2 |
| 10 | `TIPO DOC. FISCAL` não vazio e de um vocabulário controlado: NF, CF, RPA, RECIBO, DARF, GPS, FATURA, INVOICE, GRUDEV… Proibir "Outros". `INVOICE` ⇔ despesa no exterior; `GRUDEV` ⇔ devolução de saldo. | B / A | M-STR §3.2.3, §5.1.3 |
| 11 | `Nº DOC.` obrigatório. Recibos sem número: gerar sequência automática por projeto. Tributo: nº do documento do fato gerador. GRU: código de recolhimento. | B | M-STR §3.2.3 |
| 12 | `ITEM ORÇAM.` ∈ (`IV.a` ∪ `IV.b` do DO), com comparação **exata**, e que **não** seja linha de grupo (`SUBTOTAL`). Item fora do DO exige justificativa no DO V. | B | M-STR §5.3.2 |
| 13 | Para cada linha da RP, o par (`HISTÓRICO`, `DATA DO PGTO`) existe no DE da mesma conta, onde `RP I.d/e/f` = `DE I.e/f/g`. | B | M-STR §5.3.1 |
| 14 | Para cada débito `II.g` do DE, a soma das linhas da RP com o mesmo histórico e data é igual ao valor do débito. Exceção: ressarcimento de empréstimo, que exige observação. Débitos estornados ficam fora da RP. | A | M-STR §3.2.2, §3.2.3 |
| 15 | `Σ RP(conta)` = `DE II.g total`. Se divergir, exigir texto em `RP III`. | A | M-STR §3.2.3 (II.i) |
| 16 | `HISTÓRICO` com ≤ 60 caracteres e **único por débito**. Dois TEDs no mesmo dia precisam carregar o nº do documento. | B | M-STR §3.2.2 |
| 17 | RP de contrapartida: `I.d = "CONTRAPARTIDA"`, `I.f = "CONTRAP[ n]"`, histórico `CONTRAPARTIDA`. | B | M-STR §3.2.3 |
| 18 | `Σ RP por item` = `DO IV.d(item)`, para cada item. | A | M-STR §3.2.3 (II.a) |
| 19 | Pré-checagem do envio: `Σ captações SALIC + contrapartida mínima SALIC + Σ rendimentos DE` ≤ `Σ RP + Σ despesas bancárias DE`. | B | M-STR §5.3.3 |

### 12.3 DE

| # | Checagem | Tipo | Fonte |
|---|---|---|---|
| 20 | Sinais por coluna:<br>• C, D, G e H ≥ 0;<br>• E < 0 na captação e > 0 na movimentação;<br>• F < 0 na aplicação e > 0 no resgate.<br>`II.c` vazio em conta de movimentação, exceto FSA. `II.g` só em conta de movimentação. | B / A | M-STR §3.2.2 |
| 21 | Saldo recalculado linha a linha = saldo do extrato importado (OFX/CSV do banco); **saldo final = 0**. Se não for 0, falta a GRU de devolução ou o encerramento da conta (Anexo IV/V). | A / G | M-STR §3.2.2; Anexo |
| 22 | `Σ transferências concedidas (captação)` = `Σ transferências recebidas (movimentação)` do mesmo projeto. **[inferência minha]** | A | M-STR §3.2.2 |
| 23 | `II.h DESPESAS BANCÁRIAS` > 0: prevê glosa (art. 18 VII), salvo **tarifa de manutenção de conta**. Sugerir devolução por GRU via PagTesouro, com uma GRU **por conta** e o SALIC no "Número de Referência". | G | IN 159, art. 18 VII; FAQ 14.5 |
| 24 | Depósitos `II.d` ou retiradas sem pagamento vinculado: aprovação com ressalvas (art. 28 VIII e XII). Exigir observação no `DE IV`. | G / A | IN 159, art. 28 |

### 12.4 DO e orçamento

| # | Checagem | Tipo | Fonte |
|---|---|---|---|
| 25 | `IV.a` matches `^\d+(\.\d+)*$` (atenção: o modelo traz `"9.1 "` com espaço; aparar) e é **único**. Todas as rubricas aprovadas estão presentes. Itens não previstos **não** entram no DO. | B / A | M-STR §3.2.1 |
| 26 | `Σ IV.c` = orçamento aprovado. `III.i (C47)` = orçamento total aprovado. Linhas de fonte sem aprovação ficam em branco. "Outras Fontes" preenchido exige detalhe em V. | A | M-STR §3.2.1 |
| 27 | Itens com `IV.e` > 100%, itens novos e `II.d` < 0 exigem justificativa em `DO V`. | A | M-STR §3.2.1; IN 159, art. 20 |
| 28 | Remanejamento: `Σ (executado acima do aprovado + itens novos)` > **20% do orçamento global** sem autorização prévia → alerta de glosa (o art. 20 vale mesmo abaixo de 20%). | G / A | IN 158, art. 50; IN 159, art. 20 parágrafo único |
| 29 | Limites:<br>• **gerenciamento ≤ 10%** do orçamento de produção e ≤ executado com recursos ANCINE;<br>• **agenciamento ≤ 10%** do captado (Lei 8.313 e art. 1º-A) e **0** em edital, FSA ou parte relacionada;<br>• **coordenação e colocação ≤ 10%** do captado pelo art. 1º.<br>O excesso é glosado. | G | IN 158, art. 31; IN 159, art. 18 IV, V, VI |
| 30 | Gerenciamento pago a radiodifusora, programadora, distribuidora ou telefonia → glosa (verificar CNAE e grupo econômico). | G | IN 159, art. 18 XIX |

### 12.5 Documentos e despesas (IN 159)

| # | Checagem | Tipo | Fonte |
|---|---|---|---|
| 31 | `data_emissão ≤ data_débito + 30 dias`, e a emissão não pode ser anterior ao marco inicial por serviço prestado antes dele (FAQ 14.7). | G | IN 159, arts. 13 e 18 XXIX |
| 32 | Despesa dentro dos marcos: ≥ marco inicial (aprovação para captação ou contrato) e ≤ conclusão do objeto + 180 dias (IN 158) ou limite do contrato FSA. | G | art. 18 XX; IN 158, art. 57 |
| 33 | Duplicidade: (CNPJ emissor + tipo + nº) repetido no projeto **e entre projetos** do mesmo proponente ou grupo; chave NF-e repetida. | G | art. 18 II |
| 34 | Palavras proibidas na descrição ou categoria: bebida alcoólica, cigarro (exceto objeto de cena), CONDECINE, CPB, CRT, classificação indicativa, auditoria independente, juros, multa, IOF, IOC, anuidade de cartão, folha de pagamento da proponente, infraestrutura em projeto de produção, material permanente. | G | art. 18 VII, VIII, XII, XIII, XVI, XVII, XVIII, XXXV, XXXVI |
| 35 | Reembolso (débito para pessoa diferente do emissor) só nas hipóteses do art. 15:<br>• per diem;<br>• figurante ≤ **R$ 1.000/mês**;<br>• tributos;<br>• compra ≤ **R$ 1.000 cada**;<br>• locação ≤ **R$ 1.000**;<br>• compras no exterior com cartão;<br>• locação por plataforma digital (DDC 1965-E/2023).<br>A despesa precisa ter data ≤ data do débito do reembolso. | G | art. 15; art. 18 X, XXX; FAQ 1.1 |
| 36 | Beneficiário do PIX ou TED = emissor do documento (nome e CPF/CNPJ), salvo reembolso. | G | art. 13 parágrafo único; FAQ 14.9 |
| 37 | Locação de bens da proponente ou do coprodutor: **3 orçamentos** anexados e valor ≤ o menor. | G | art. 12 |
| 38 | Despesa no exterior: `INVOICE` + contrato de câmbio (ou fatura do cartão) anexados como "Outros Documentos". | G | art. 14; M-DF §2.3 |
| 39 | Contrapartida por doação: campos I a VIII do art. 16 §2º presentes, item aprovado e valor ≤ aprovado. Sem gerenciamento doado. Contrapartida **não** pode vir de recurso público, inclusive de coprodutor estrangeiro. | G | art. 16; art. 18 XXVIII, XXXIV |
| 40 | Concentração por credor ou grupo (`relacao-de-grupos-economicos` + sócios), somando todos os processos da obra:<br>• **≥ 25%** → ressalva + advertência;<br>• **> 50%** → inabilitação.<br>Exceções: animação, jogos e orçamento **< R$ 500 mil**. | G / A | art. 28 VI; art. 42; FAQ 14.6 |

### 12.6 Documentos fiscais no STR

| # | Checagem | Tipo | Fonte |
|---|---|---|---|
| 41 | Cada linha da RP tem **exatamente 1 documento principal** em PDF, com ≤ 15 MB, 1 documento por arquivo e **sem página em branco**. Comprovante de pagamento opcional (máx. 1). "Outros" com informação complementar. | B | M-DF §2, §3, §9 |
| 42 | Exportar o lote com nomes `NNNNN_P.pdf`, `NNNNN_C.pdf` e `NNNNN_O_NN.pdf`, onde NNNNN é a **linha física da RP no .xls** (a 1ª é a 12). O software precisa guardar o mapeamento linha↔documento **depois** da exportação final. | B | M-DF §11 |
| 43 | NF-e com chave de 44 dígitos (validar DV mod 11); NFS-e com código de verificação. Guias de tributo associadas às linhas do fato gerador. | A | M-DF §9.2–9.3 |
| 44 | Justificativa de ausência ≤ **1.000 caracteres**, com motivo ∈ {ilegível, extraviado, outros}. | B | M-DF §10 |
| 45 | Conteúdo mínimo do documento (OCR ou checklist): nº, nome e CPF/CNPJ do credor **e do tomador (proponente)**, data, tipo, **título do projeto + SALIC ou nº do contrato FSA**, descrição. Recibo de PF: CPF, função e período. | G | M-DF §3; IN 159, arts. 9–10; art. 18 XXI |

### 12.7 Logomarca

| # | Checagem | Tipo | Fonte |
|---|---|---|---|
| 46 | Matriz de obrigatoriedade por tipo de projeto × peça × fonte (§7.1–7.3). Gera o checklist de evidências: frame dos créditos iniciais, cartaz, catálogo, foto da placa. | G | IN 130, art. 4º; manual v3.0, capítulo V |
| 47 | Créditos: cartela ANCINE **≥ 3 s**, antes das outras; FSA + agente **≥ 2 s**, sem outras marcas; ordem agente → FSA → ANCINE. Obra sem créditos iniciais exige a marca nos créditos finais. | G / A | manual v3.0, capítulos II e III |
| 48 | Peças: todas as marcas coloridas **ou** todas monocromáticas, sem escala de cinza. Logo obrigatória ≥ maior logo da peça. Bandeira em toda peça de divulgação (exceto memes e vídeos curtos), sem alteração. | A | manual v3.0, capítulo II; Orientações da Bandeira |
| 49 | Placa de infraestrutura: 40 × 26 cm, aço escovado, ANCINE ≥ 15 cm, texto padrão, 1,5 m do piso. | G | manual v3.0, capítulo VI |
| 50 | Estimativa de sanção: **2%** ou **0,5%** de (recursos públicos federais + rendimentos) **por projeto (SALIC)**. | A | IN 130, art. 6º |

### 12.8 Prazos e FSA

| # | Checagem | Tipo | Fonte |
|---|---|---|---|
| 51 | Prazo da PC = conclusão do objeto (data do CPB, lançamento, último dia do festival ou entrega do desenvolvimento) + 180 dias. Se a 1ª liberação for posterior, conta a partir dela. Com vários processos, vale o último. No FSA, vale o contrato (+ até 3 meses prorrogáveis). | A | IN 159, arts. 3º–5º; G-BRDE25 §4.3 |
| 52 | Diligência: vencimento = recebimento + 30 dias; prorrogação única de +30. Em seguida, alertas de inadimplência (+30) e de reprovação/TCE. Recurso: 30 dias. GRU: 30 dias. | A | IN 159, arts. 35, 45, 48 |
| 53 | Prescrição: alerta quando o processo fica **parado mais de 3 anos** ou se aproxima de **5 anos** desde o marco inicial. | A | Res. TCU 344/2022; DDC 110-E/2023 |
| 54 | Calendário dos relatórios de comercialização do FSA (produtora e distribuidora): período semestral a partir do lançamento; vencimento no **dia 15 do 7º mês**; relatório simplificado se não houver receita. | A | G-BRDE25 §7; modelo BRDE |
| 55 | Cálculo do retorno ao FSA pelas alíquotas da planilha BRDE (§9.2). Separar e reter o pré-licenciamento. | A | planilha BRDE de retorno |
| 56 | FSA: recursos próprios exigidos como captação mínima **não** podem entrar na conta de movimentação; alertar se houver `II.d` nessa situação. | A | FAQ 14.10 |
| 57 | Cruzar com a página pública do SAD: valores aprovados e captados, contas, situação e datas (1ª liberação, prorrogação). Divergência gera alerta antes do envio. | A | §11.2 |
| 58 | Atualização de débito para GRU de devolução voluntária: SELIC acumulada desde o mês seguinte ao débito + 1% no mês do pagamento. A multa de mora (0,33% ao dia, máx. 20%) só vale depois do vencimento. | A | IN 164, art. 2º; FAQ 14.5 |

---

## 13. Arquivos baixados

Arquivos baixados durante a pesquisa. Os três modelos oficiais de planilha estão versionados em [`modelos-oficiais/ancine/`](./modelos-oficiais/ancine/); os demais podem ser baixados de novo pelos links da seção de fontes.

| Arquivo | Conteúdo |
|---|---|
| `IN_159_Relacao_de_Pagamentos.xls` | Modelo oficial da RP (salvo em 12/03/2026) |
| `IN_159_Demonstrativo_do_Extrato.xls` | Modelo oficial do DE (12/03/2026) |
| `IN_159_Demonstrativo_Orcamentario_e_Financeiro.xls` | Modelo oficial do DO (12/03/2026) |
| `xlsx/*.xlsx` | Conversões dos três modelos, para inspeção com openpyxl |
| `do_dump.txt`, `do_rowmap.txt` | Dump célula a célula e mapa de linhas do DO |
| `Manual_STR_Planilhas_v2.2_2025-09-30.pdf` + `str.txt` | Manual do STR – Envio de Planilhas v2.2 |
| `Manual_STR_Documentos_Fiscais.pdf` + `docfiscais.txt` | Manual de Envio de Documentos Fiscais (04/05/2021) |
| `Manual_Aplicacao_Logomarca_v3.0_2022-08-24.pdf` + `.txt` | Manual de Aplicação da Logomarca v3.0 |
| `Orientacoes_Bandeira_Nacional.pdf` + `.txt` | Orientações para a inserção da Bandeira Nacional |
| `in159_full.txt` / `in159_fold.txt` | IN 159 consolidada (texto oficial gov.br) |
| `in130.txt`, `in152.txt`, `in158.txt`, `in160.txt`, `in164.txt`, `in167.txt`, `in176.txt` | Textos das INs relacionadas |
| `faq/faq_all.txt` | Todas as 64 respostas da FAQ SPR |
| `PFE_ANCINE_Parecer_Referencial_3-2024_prescricao.pdf` + `parecer.txt` | Parecer da PFE-ANCINE sobre prescrição |
| `brde/BRDE_Guia_Acompanhamento_FSA_2025-01.pdf` + `guia2025.txt` | Guia de Acompanhamento FSA, jan/2025 |
| `brde/BRDE_Guia_FSA_Acompanhamento_v04_2020-02-06.pdf` + `guia2020.txt` | Guia v04, 2020 |
| `brde/BRDE_Modelo_Relatorio_Comercializacao_CINEMA.xlsx` | Modelo de relatório de comercialização, cinema |
| `brde/BRDE_Modelo_Relatorio_Comercializacao_TV.xlsx` | Modelo de relatório de comercialização, TV |
| `brde/BRDE_Retorno_Planilha1_SUAT2017_chamadas2018+.xlsx` | Planilha de alíquotas de retorno ao FSA |
| `dados/salic_240264.html` | Exemplo da página pública de detalhe de projeto do SAD |
| `img/*.png` | Páginas do manual de logomarca (cores) e da Bandeira, renderizadas |

**Não obtidos:**

| Item | Motivo |
|---|---|
| Manual SAPIO do BRDE | 403 |
| CSV de dados abertos da ANCINE | 403 |
| "Manual – RP Pré-preenchida" | 404; o conteúdo está no STR v2.2 |
| Tabela de códigos de GRU da FAQ 14.5 | O quadro está vazio na página |

---

## Fontes

**ANCINE (gov.br)**
- Prestação de Contas – Manuais: https://www.gov.br/ancine/pt-br/assuntos/atribuicoes-ancine/fomento/prestacao-de-contas/manuais
- Prestação de Contas – Sistemas: https://www.gov.br/ancine/pt-br/assuntos/atribuicoes-ancine/fomento/prestacao-de-contas/sistemas
- Manual STR v2.2: https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/ManualdoSTRVerso2.2v_30_09_2025.pdf/@@display-file/file
- Manual de Documentos Fiscais: https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/Manualdeenviodedocumentosfiscaissistema.pdf/@@display-file/file
- Modelos do STR:
  - https://www.gov.br/ancine/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/IN_159_Relacao_de_Pagamentos.xls/@@download/file
  - https://www.gov.br/ancine/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/IN_159_Demonstrativo_do_Extrato.xls/@@download/file
  - https://www.gov.br/ancine/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/IN_159_Demonstrativo_Orcamentario_e_Financeiro.xls/@@download/file
- IN 159 (consolidada): https://www.gov.br/ancine/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-159
- IN 176/2026: https://www.gov.br/ancine/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-176
- INs 130, 152, 158, 160, 164 e 167: `https://www.gov.br/ancine/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-<n>`
- Aplicação da Logomarca: https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/aplicacao-logomarca
- Manual de Logomarca v3.0: https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/ManualdeAplicacaodeLogomarcav.0324agosto22.pdf/@@display-file/file
- Orientações da Bandeira: https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/OrientacoesparaInsercaodaBandeiraNacionalnosmateriaisdedivulgacaoem3marc.pdf/@@display-file/file
- Arquivos de logomarca:
  - https://www.gov.br/ancine/pt-br/arquivos/logo-ancine-2014.zip/@@download/file
  - https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/copy_of_FSA.zip/@@download/file
  - https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/3logostransparente.png
- FAQ SPR (índice e 64 respostas): https://www.gov.br/ancine/pt-br/acesso-a-informacao/perguntas-frequentes1/superintendencia-de-prestacao-de-contas-spr
- Dados Abertos ANCINE: https://www.gov.br/ancine/pt-br/acesso-a-informacao/dados-abertos e https://www.gov.br/ancine/pt-br/oca/dados-abertos
- Consulta SAD (exemplo): https://sad.ancine.gov.br/projetosaudiovisuais/ConsultaProjetosAudiovisuais.do?method=detalharProjeto&numSalic=240264

**BRDE**
- Acompanhamento FSA: https://www.brde.com.br/acompanhamento/?tab=ci
- Guia jan/2025: https://www.brde.com.br/wp-content/uploads/2025/01/Guia-de-Acompanhamento-25-jan.pdf
- Guia v04 (2020): https://www.brde.com.br/wp-content/uploads/2020/02/Guial_FSA_Acompanhamento.v04-de-06-02-2020.pdf
- Relatórios de comercialização:
  - https://www.brde.com.br/wp-content/uploads/2019/12/Modelo-Relatorio-de-Comercializacao-CINEMA-1.xlsx
  - https://www.brde.com.br/wp-content/uploads/2019/12/Modelo-Relatorio-de-Comercializacao-TV.xlsx
- Planilha de retorno: https://www.brde.com.br/wp-content/uploads/2023/01/Retorno-Planilha-1-PROPONENTE-SUAT-2017-e-chamadas-a-partir-de-2018.xlsx
- Manual da marca BRDE: https://www.brde.com.br/wp-content/uploads/2015/11/manualmarcabrde.pdf (link citado na página da ANCINE; não baixado)

**Prescrição, TCU e outros**
- Parecer Referencial nº 3/2024/CCAJ/PFE-ANCINE: https://www.gov.br/agu/pt-br/composicao/procuradoria-geral-federal-1/subprocuradoria-federal-de-consultoria-juridica/PARECERREFERENCIALn.000032024CCAJPFEANCINEPGFAGUNUP00768000273202468OK.pdf
- DDC 110-E/2023, texto reproduzido em: https://farofafa.com.br/2023/01/25/ancine-acata-tcu-e-fixa-em-5-anos-prescricao-de-contas-de-filmes/
- Nova metodologia de análise (2020): https://cqsfv.com.br/2020/04/30/ancine-aprova-nova-metodologia-de-prestacao-de-contas/
- Res. TCU 344/2022, art. 8º (resumo de busca): https://www.migalhas.com.br/depeso/376405/a-nova-regulamentacao-da-prescricao-no-tcu
- Dataset "Processos em Prestação de Contas" (resumo de busca): https://dados.gov.br/dataset/processos-em-prestacao-de-contas
- API dados.gov.br: https://dados.gov.br/dados/conteudo/cgu-lanca-a-api-do-novo-portal-de-dados-abertos
