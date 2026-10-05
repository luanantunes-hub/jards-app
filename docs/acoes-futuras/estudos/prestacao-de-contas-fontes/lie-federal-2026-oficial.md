# Lei de Incentivo ao Esporte (federal): regras oficiais de 2026 para execução e prestação de contas

Pesquisa feita em 01/10/2026 para o módulo de prestação de contas do Jards. Diferente de `esporte-federal-2026.md`, que se apoiou só em resumos de busca, este arquivo foi escrito a partir dos **textos oficiais lidos na íntegra** e dos **arquivos oficiais baixados e abertos** da página "Modelos e Manuais".

## 0. Método, legenda e limites

**Textos lidos na íntegra**

- LC 222/2025, no Planalto.
- Decreto 12.861/2026, na Câmara (publicação original) e no Planalto.
- Portaria MESP 10/2026, no DOU (in.gov.br).
- Portaria 424/2020, no DOU, e as alterações que encontrei: Portaria 454/2020, 62/2023, 82/2023, 2/2024, MESP 84/2024 e MESP 33/2025.
- Portaria 37/2026 (Regimento da CTLIE) e Portarias MESP 39 e 51/2026 (composição da CTLIE).
- Decreto 13.105/2026, que altera a estrutura regimental do MESP.

**Arquivos oficiais abertos**

- As planilhas `.xls` foram convertidas para `.xlsx` no LibreOffice, sem perder fórmulas.
- Os `.doc` e `.docx` foram convertidos para texto.
- Os PDFs foram lidos como texto. Os do defeso usam uma fonte com codificação embaralhada, então renderizei as páginas e li as imagens.

**Legenda de confiança**

- **alta**: texto oficial lido diretamente.
- **média**: inferência a partir de texto oficial, documento oficial antigo ou fonte oficial indireta.
- **baixa**: não verificado em fonte oficial.
- **[?]**: incerto. Precisa de confirmação antes de virar regra rígida no software.

**Abreviações**

- **P10**: Portaria MESP 10/2026.
- **P424**: Portaria 424/2020, com as alterações listadas acima.
- **Dec**: Decreto 12.861/2026.
- **LC**: Lei Complementar 222/2025.
- **Form**: `formulariopcppcfatualizado2026-1.xls`.

**Limites**

- **Páginas do gov.br fora do ar.** As notícias do gov.br/esporte respondem "unauthorized", provavelmente por causa do defeso eleitoral. A página de orientações do PDLIE (`orientacoes-pdlie.pdf`) também responde "unauthorized". O "Formulário de Solicitação de Alteração no Projeto" mostra "Estamos em manutenção". Por isso não há notícias oficiais de 2026 nesta pesquisa.
- **Busca no DOU sem achados.** Não encontrei nenhum ato que altere a P10 depois de 04/03/2026. Busquei por "Portaria MESP nº 10", "Portaria nº 10, de 3 de março de 2026" e "Lei Complementar nº 222" entre 03/2026 e 10/2026. Esse é um resultado de busca, não uma garantia.

---

## 1. Base legal, transição entre regimes e sistemas

### 1.1 Normas vigentes

| Norma | O que importa para a prestação de contas (PC) | Confiança |
|---|---|---|
| **LC 222, de 26/11/2025** (DOU 27/11/2025) | Revoga a Lei 11.438/2006 (art. 25). Exige conta específica no **BB ou CAIXA** em nome do proponente, sob pena de indedutibilidade (art. 11). Diz que a PC "ficará a cargo do proponente e será apresentada, na forma estabelecida por regulamento, ao Ministério do Esporte" (art. 19). Exige divulgação com a Bandeira Nacional (art. 18). Infrações e multa de 2× a vantagem indevida (arts. 20–21). Veda pagar remuneração de atleta profissional (art. 6º, §2º). **A LC não traz 15%, 60 dias, remanejamentos, diligência nem reconsideração.** Esses números estão no Decreto e na Portaria. | alta |
| **Decreto 12.861, de 27/02/2026** (DOU 02/03/2026, Seção 1, p. 1) | Revoga o Decreto 6.180/2007 (art. 41). Conta específica e exclusiva (arts. 30–31). **15% de despesas administrativas** (art. 12). Vedação de intermediação (art. 13). Proibição de comprar espaço publicitário (art. 14). Receitas do projeto no orçamento (art. 15). Proibição de cobrar dos beneficiários (art. 16). Acessibilidade (art. 17). No mínimo 50% de alunos da rede pública na formação esportiva regular (art. 18). **PCF em 60 dias** e PCP a critério do MESP (art. 33). Infrações (arts. 34–35). | alta |
| **Portaria MESP 10, de 03/03/2026** (DOU 04/03/2026, Seção 1, p. 39) | Regulamento operacional completo: contas, execução, recursos humanos, compras, remanejamento, readequação, prorrogação, PCP, PCF, TCE e divulgação. **Revoga a P424** (art. 103). Assinada por André Luiz Carvalho Ribeiro. | alta |
| Portaria 37, de 13/04/2026 (DOU 14/04/2026) | Regimento Interno da CTLIE. Reconsideração em 5 dias corridos (art. 31). Diligência da CTLIE em 30 dias improrrogáveis (art. 20, §1º). Revoga a Portaria 498/2020. Assinada pelo ministro Paulo Henrique Perna Cordeiro. | alta |
| Decreto 13.105, de 24/08/2026 | Reestrutura o MESP. A DPPIE continua responsável pela LC 222 (art. 17-A do Anexo I do Decreto 11.343/2023). | alta |
| **P424/2020** (DOU 23/06/2020) e alterações | **Continua valendo para projetos protocolados antes da P10** (P10, art. 102). Os modelos da página oficial ainda citam os artigos da P424. | alta |

### 1.2 Transição entre P424 e P10 (regra de ouro para o software)

**P10, art. 102** (texto literal): "Os projetos protocolados sob a égide da Portaria MC nº 424, de 22 de junho de 2020, terão sua análise, acompanhamento e prestação de contas regidos pelas disposições nela previstas, observado o normativo vigente à época do protocolo, bem como a Lei Complementar nº 222/2025." Confiança: alta.

**Consequência para o modelo de dados.** Cada projeto precisa de um campo `regime` com os valores `P424` ou `P10`. O critério é a data de protocolo do projeto no SLI: antes ou a partir de **04/03/2026**, data de publicação e vigência da P10 (art. 104). A janela de 2026 abriu em 04/03/2026. Confiança: média. O "a partir de 04/03" é inferência dos arts. 102–104.

**Diferenças entre os regimes que mudam regras no software** (confiança alta para cada linha; os artigos estão na tabela):

| Tema | P424 (projetos antigos) | P10 (projetos protocolados em 2026) |
|---|---|---|
| Remanejamento | Até 2. Na redação da Port. 33/2025, o art. 57 permite fazer direto até 20% **sem anuência prévia**, sem limitar a qual dos dois, e comunicar em 5 dias. Acima de 20%, aprovação prévia. Mexer em elaboração e captação exige aprovação prévia. | Até 2 (art. 52). **Somente o segundo** pode ser feito sem anuência prévia, até 20%, comunicando em 5 dias. Acima de 20%, aprovação prévia. Proibido alterar o percentual de encargos. |
| Readequação (captação durante a execução) | Uma única. O pedido vai até **60 dias** antes do fim do Termo, conforme o tutorial oficial, que cita o "art. 57-A §1º". **[?]** Não achei no DOU o ato que incluiu o art. 57-A. | Uma única, até **90 dias** antes do fim do Termo (art. 53, §1º). Depende da CTLIE e de Termo Aditivo. |
| Aplicação financeira | Poupança, se o uso for em 1 mês ou mais; fundo de curto prazo, se for em menos de 1 mês (art. 29, §1º). Rendimentos **não podem** pagar despesa administrativa, elaboração/captação ou pessoal sem autorização (art. 29, §3º). | Fundos lastreados em títulos públicos federais, com rentabilidade diária (art. 28, §1º). **A restrição do §3º da P424 sumiu.** O rendimento vai para "ações do projeto aprovado", com justificativa (art. 28, §2º). |
| Saldo remanescente ao fim da execução | Transferência para outro projeto em até **120 dias** (art. 60, §2º). | Em até **60 dias** do encerramento da execução (art. 57, §2º). |
| PCF não apresentada no prazo | O DIFE dá **30 dias** para apresentar ou recolher, sob pena de TCE (art. 71, §3º). | A DPPIE **recolhe o saldo** das contas CAPTAÇÃO e MOVIMENTO e **recomenda TCE** (art. 67, §3º). O acesso ao SLI é suspenso e os outros projetos ficam paralisados (§4º). |
| Recurso contra reprovação da PC | Reconsideração à CGPC em **30 dias** (art. 84, §5º). | Reconsideração **única em 5 dias** e depois **recurso administrativo em 10 dias** (Lei 9.784). Vale separadamente para o objeto (art. 71, §§2º–3º) e para a parte financeira (art. 80, §§5º–6º). |
| Prazo de análise da PCF | Técnica e financeira em até 360 dias cada, na redação da Port. 33/2025. A redação original previa 360 dias para a técnica e 180 para a financeira. | 360 dias para a técnica e 360 para a financeira (art. 82). |
| Despesa fora da vigência | Ressarcimento (art. 46). | Ressarcimento (art. 40) **mais multa adicional de 5%** sobre o valor, recolhida por GRU (art. 80, §7º). |
| Peças da PCF | Art. 72, com 13 incisos. | Art. 68, com 15 incisos. Acrescenta as grades horárias e as **fotos de acessibilidade**. |
| Recibo de captação | 3 vias. O DIFE aprova o recibo e só então o recurso é liberado (art. 27). Captação informada em 3 dias úteis. | Emitido no SLI em **2 vias** (art. 27). |
| Envio da PC | "Sistema Eletrônico, Remessa Postal ou e-mail" (arts. 69 e 71). | PCP pelo **SEI** (art. 65). PCF por **protocolo digital** (art. 67, §1º). |

### 1.3 Sistemas (onde fica cada coisa)

| Sistema | Uso | Fonte | Confiança |
|---|---|---|---|
| **SLI (Sistema da Lei de Incentivo)** | Cadastro do proponente, envio do projeto (PDF pesquisável com OCR, até 25 MB por arquivo), **recibos de captação**, número do projeto que vai em todos os comprovantes, registro da conclusão da PCF e cadastro de inadimplentes. | P10, arts. 3º, 5º, 27, 41 §1º, 79 p.ú. e 83 | alta |
| **SEI (protocolo digital do MESP)** | Envio da **PCP** (art. 65: "via Sistema Eletrônico (SEI)") e da **PCF** (art. 67, §1º: "via protocolo digital"). Também recebe pedidos de remanejamento, aplicação financeira e readequação (art. 54: "por meio do protocolo digital"). | P10 | alta para a PCP. Média para "protocolo digital = SEI" na PCF. |
| E-mail | A DPPIE pode pedir diligências da PCF por e-mail, e o recebimento deve ser confirmado em **1 dia útil** (art. 68, §4º). Comunicações de recolhimento também vão por e-mail (art. 80, §1º). O e-mail que vale é o cadastrado no SLI (art. 4º, §1º). | P10 | alta |
| **Transferegov.br** | **Não é onde se faz a PC da LIE.** O Transferegov só publica o **mapeamento de processos (Bizagi)** da LIE, em 10 fluxos. Entre eles estão "08 – Prestação de Contas Parcial", "09 – Prestação de Contas Final" e "10 – Gestão de Contas". Fazem parte do esforço de "internalização", mas a lista de Acordos de Cooperação Técnica firmados **não inclui o MESP**. A página do Transferegov ainda cita a Lei 11.438 e a P424. | Página "Lei de Incentivo ao Esporte – LIE — Transferegov.br" (modificada em 08/10/2025) | média |
| SIAFI, CEPIM, SICONV | Consultados na admissibilidade (P10, arts. 15–16) e na liberação de parcelas (fluxo 08). Inadimplência na PC leva a registro no SIAFI (art. 83). | P10 | alta |

**Fluxos do Transferegov** (imagens lidas; confiança média, porque é mapeamento e não norma):

- **PCF:**
  1. Término da execução.
  2. A PCF foi recebida? Se não, o MESP "solicita envio" e verifica.
  3. Atualiza o controle e analisa a documentação.
  4. Se estiver regular, aprova, comunica o proponente e verifica se há saldo na conta CAPTAÇÃO para recolher. Atualiza a planilha de controle e passa à "Gestão de Contas".
  5. Se estiver irregular, diligencia o proponente e avalia o cumprimento do objeto.
  6. Se não houver cumprimento, emite parecer de rejeição, oficia o proponente e recolhe o saldo remanescente.
- **PCP:**
  1. O proponente elabora a PCP e pede a liberação da nova parcela.
  2. O MESP analisa a execução. Se a documentação estiver incompleta, diligencia.
  3. Emite parecer. Se a PCP estiver irregular, faz visita técnica e relatório.
  4. Se houver contrato de patrocínio, faz Termo Aditivo de valor.
  5. Consulta o SIAFI.
  6. Se o proponente estiver regular, libera o recurso. Se não, pede correção ou recolhe os recursos à União.

---

## 2. Contas bancárias, rendimentos e meios de pagamento

| Regra | Texto/fonte | Confiança |
|---|---|---|
| Banco: **Banco do Brasil ou Caixa Econômica Federal**. O titular é o proponente. | LC, art. 11. Dec, art. 30. | alta |
| A conta é **exclusiva** do projeto. Todos os recursos captados circulam nela, e só conta como incentivo o que foi depositado ali. O MESP e os órgãos de controle têm acesso aos extratos até o encerramento da PC. | Dec, art. 31, §§1º–3º | alta |
| **Duas contas**, abertas **pela DPPIE** e vinculadas ao CNPJ: **CAPTAÇÃO** e **MOVIMENTO**. | P10, art. 20 | alta |
| A CAPTAÇÃO é **bloqueada para movimentação** pelo proponente. Só recebe depósitos com CPF ou CNPJ do depositante, reposição de bloqueio judicial ou outros depósitos autorizados pela DPPIE. Todo aporte de incentivador vai direto e exclusivamente para ela. | P10, art. 20, §§2º e 10 | alta |
| A MOVIMENTO recebe recursos vindos da CAPTAÇÃO, "sob a gerência do MESP". Só pode ser movimentada depois da assinatura do **Termo de Compromisso** e exclusivamente para executar o projeto. | P10, art. 20, §3º | alta |
| O proponente precisa regularizar a conta na agência e autorizar o banco, **em caráter irrevogável e irretratável**, a cumprir as determinações da DPPIE. | P10, art. 20 §1º e art. 21 | alta |
| A **liberação** da CAPTAÇÃO para a MOVIMENTO pode ser integral ou parcial, conforme a DPPIE. Na liberação parcelada, cada nova parcela depende de PCP do período. | P10, art. 37 e art. 65 §2º | alta |
| O dinheiro captado vira renúncia fiscal e tem natureza pública. Não volta ao incentivador, salvo nos casos previstos. | P10, art. 20, §9º | alta |
| **Aplicação financeira obrigatória** enquanto o recurso não é usado, nas duas contas. Deve ser em fundos lastreados em títulos públicos federais, com rentabilidade diária e prospecto que permita aplicar e resgatar qualquer valor. O pedido ao banco é feito na regularização da conta. | P10, art. 28 caput e §1º | alta |
| O proponente **repõe** os rendimentos do período em que o recurso ficou sem aplicação. | P10, art. 28, §5º | alta |
| **Rendimentos** só podem ser usados nas ações do projeto, sob as mesmas regras de PC. A escolha da ação precisa ser justificada no RCO. Os rendimentos **não contam como recurso captado**. Devem constar da Planilha Orçamentária e da Descrição do Plano de Trabalho, ajustados ao valor efetivamente obtido. Para usar a aplicação financeira, o proponente faz pedido formal com o valor exato (art. 55). | P10, art. 28 §§2º–4º, arts. 54–55 | alta |
| **Bloqueio judicial**: deve ser informado imediatamente, sob pena de arquivamento. A reposição do valor e dos rendimentos cabe ao proponente; se não houver reposição, há ressarcimento na PCF. | P10, art. 20, §§7º–8º | alta |
| **Estorno** de depósito feito por engano: pedido fundamentado, com anuência do incentivador, em até **60 dias** do depósito. Depois disso, o valor vai para GRU. Se o SLI rejeitar o aporte automaticamente, o estorno ocorre mesmo após 60 dias. **Correção** de depósito entre projetos da mesma entidade em captação: também em 60 dias. | P10, arts. 23 e 25 | alta |
| **Meios de pagamento**: qualquer operação bancária autorizada pelo Banco Central, desde que identifique a destinação e o credor. **Saque em dinheiro é proibido em qualquer hipótese.** Cada débito na MOVIMENTO precisa de um comprovante. | P10, arts. 38–39 | alta |
| O Form ainda tem colunas "CHEQUE" e "DATA" do cheque (aba PAGAMENTOS). É legado. **[?]** Sugestão: usar a coluna para o identificador da transação (PIX, TED ou boleto) e a data do débito. | Form, aba PAGAMENTOS | média |
| **Tarifas bancárias**: **não encontrado.** A LC, o Dec, a P10 e os modelos não dizem se tarifa é despesa elegível. | busca no texto das quatro normas | — |
| Extratos: o proponente acompanha os extratos das duas contas para juntar à PC (P10, art. 20, §6º). A P424 exigia "extratos mensais" (art. 21, §6º). A PCF exige extrato das duas contas **desde o recebimento até o último pagamento** e o **demonstrativo de rendimentos** das duas (P10, art. 68, V–VI). | P10 e P424 | alta |
| **Saldo remanescente** ao fim do projeto: pode ser transferido **uma única vez**, em até **60 dias** do encerramento, para outro projeto da mesma entidade que esteja em captação, indicando o destino. O pedido pode correr antes de concluída a análise da PCF. Se a PCF não for apresentada ou for rejeitada, a transferência fica proibida. | P10, arts. 57 §§1º–3º e 67 §§4º–6º | alta |
| Para pedir a transferência, o saldo da MOVIMENTO volta antes para a CAPTAÇÃO do próprio projeto. | Modelo RCO 2026, item IV-i (nota) | alta (modelo) |

---

## 3. Orçamento

### 3.1 Estrutura (modelo oficial "Planilha Orçamentária")

Arquivos `copy_of_4planilha_orcamentaria.xls` e `copy2_of_3...`. São quase idênticos e têm uma aba, "Planilha Orçamentária". Confiança: alta.

- **A2:** "XII. Orçamento Analítico – Detalhe aqui os itens de despesa, por ação, necessários à execução do projeto, com as especificações orçamentárias necessárias."
- **Colunas (linha 4/5):**

| Coluna | Rótulo | Explicação no modelo |
|---|---|---|
| A | 1- N° | — |
| B | 2- Detalhamento ações / Item | — |
| C | Detalhamento | — |
| D | 3- Quant. | quantidade de cada item |
| E | 4- Unid. | unidade de medida |
| F | 5- Duração | — |
| G | 6- R$ Unit. | — |
| H | 7 - Total | `=D*F*G` ("col. 3 x col. 5 x col. 6") |

- **Hierarquia:**
  - Bloco **"ATIVIDADE(S) FIM"**. Ações numeradas 1, 2, 3… e itens 1.1, 1.2… Cada ação tem uma linha "TOTAL:". As ações do exemplo são: Locação de Espaços; RH – Atividade Fim; Encargos Trabalhistas; Exames Médicos; Hospedagem/Alimentação; Material Esportivo; Material/Premiação; Transporte/Locomoção; Uniformes.
  - Linha "TOTAL ATIVIDADE(S) FIM" (H47 soma os totais das ações).
  - Bloco **"ATIVIDADE(S) MEIO"**. Ações do exemplo: Encargos; Material de Consumo/Expediente; RH – Atividade Meio; Serviços de Terceiros (assessoria jurídica e **contador**).
- **Rodapé com fórmulas:**
  - D63 "TOTAL ATIVIDADE(S) MEIO" = H63.
  - D64 "**Porcentagem da Atividade Meio x Fim (Até 15%)**": `H64 = H63/H47`, ou seja **meio ÷ fim**.
  - D65 "TOTAL ATIVIDADE MEIO + ATIVIDADE(S) FIM" = H47+H63.
  - D66 "ELABORAÇÃO E CAPTAÇÃO DE RECURSOS" (valor digitado).
  - D67 "Porcentagem de Elaboração e Captação de Recursos": `H67 = H66/H65`, ou seja elaboração ÷ (meio + fim).
  - D68 "TOTAL GERAL" = H65+H66.
- **Encargos**: item próprio, separado do salário (P10, art. 7º, IX). As planilhas de ajuste usam encargos de **65% do salário** (`=G14*65%`). É um exemplo, não regra.
- **Bruto ou líquido**: o projeto precisa dizer se o salário é bruto ou líquido (P10, art. 7º IX e art. 44 §3º).
- **Proibido lançar "valores fechados"**: todo item tem quantidade × duração × valor unitário (P10, art. 7º, V).

### 3.2 Tetos

| Teto | Regra exata | Fonte | Confiança |
|---|---|---|---|
| **Despesas administrativas (atividade-meio) ≤ 15%** | "As despesas administrativas relacionadas aos projetos ficam limitadas a 15% (quinze por cento) **do orçamento total**, hipótese em que deverá haver previsão específica no orçamento analítico." Despesa administrativa é a da atividade-meio, **excluído o pessoal indispensável à atividade-fim** (§1º). Encargos entram no limite quando forem de atividade-meio (§2º). | Dec, art. 12 | alta |
| **Divergência no denominador** | Os modelos oficiais calculam **meio ÷ fim** ("Porcentagem da Atividade Meio x Fim (Até 15%)"). Isso aparece na Planilha Orçamentária (H64) e na Planilha de Ajuste Simples (H68 e `M68=(M66+P66)/(M49+P49)`). O Decreto fala em "orçamento total". **[?]** Sugestão: calcular as duas razões, bloquear quando meio/fim > 15% (o critério da área técnica, que é o mais restritivo) e mostrar também meio/(fim+meio). | Modelos e Dec | alta para a divergência |
| Remanejamento | Qualquer remanejamento respeita os 15% de atividade-meio aprovados na ATO (Análise Técnica e Orçamentária). | P10, art. 52, §5º | alta |
| **Elaboração e captação** (despesas de produção), por nível | Formação esportiva **até 10%**. Esporte para toda a vida **até 7%**. Excelência esportiva **até 5%**. Projeto executado **integralmente** no N, NE ou CO: **até 15%**. A base é sempre fim + meio do projeto original ou do valor da ATO. **Teto absoluto: R$ 100.000,00.** **Fica fora** dos 15% de atividade-meio. No inciso IV, o local de execução só pode mudar para outro estado do N, NE ou CO. | P10, art. 26 e §§1º–3º | alta |
| Elaboração na P424 | Mesmos percentuais, por manifestação: educacional 10%, participação 7%, rendimento 5%, N/NE/CO 15%, teto de R$ 100 mil. O cálculo usa **apenas o valor efetivamente captado, sem rendimentos** (P424, art. 26, §1º). As planilhas de ajuste calculam 10% de (meio + fim), com fórmula fixa. | P424, art. 26 | alta |
| Elaboração e captação **não são intermediação** | — | Dec, art. 13, §5º | alta |
| Subcontratação | Admitida só para **atividades acessórias**, prevista no plano e sob supervisão direta. É proibido subcontratar gestão, coordenação ou direção. O MESP fixará limites (§6º): **não encontrado ato com esses limites**. | Dec, art. 13, §§3º e 6º | alta |
| Limite de captação por projeto | Excelência: R$ 5 milhões. Esporte para toda a vida: R$ 2,5 milhões. Formação: sem limite. No máximo 6 projetos por ano por CNPJ raiz. | P10, art. 14. Dec, art. 23. | alta |
| Captar mais que o autorizado | Proibido. O excedente vai para o Tesouro. | LC art. 10 p.ú. P10 art. 22 §2º. | alta |

### 3.3 Remanejamento, readequação, prorrogação e local

| Tema | Regra (P10) | Confiança |
|---|---|---|
| **Remanejamento** (art. 52) | Até **2** pedidos entre ações, justificados por mudança de duração, quantidade ou valor dos itens aprovados. **Somente o 2º** pode ser feito direto, sem anuência prévia, se for de até **20%** e não passar do total aprovado na ATO. Nesse caso, o proponente informa em **5 dias** e envia a documentação atualizada (§1º). Acima de 20% "(valor total do projeto)", precisa de aprovação prévia da DPPIE (§2º). Só itens já previstos (§3º). Respeitar os 15% de meio (§5º). Remanejamento de RH segue a legislação trabalhista, com justificativa detalhada (§6º). **Proibido mudar o percentual de encargos** (§7º). Na PCF, juntar comprovantes e justificativas de toda alteração; o mérito é analisado na PCF (§8º). | alta |
| Remanejamento na P424 (projetos antigos) | Art. 57, na redação da Port. 33/2025: até 2. Até 20% direto, sem anuência, comunicando em 5 dias. Acima de 20%, aprovação prévia. Alterar valores de **elaboração e captação** exige aprovação prévia. Respeitar os 15%. | alta |
| **Readequação** (art. 53) | É a captação depois de iniciada a execução. Só **uma**, pedida até **90 dias** antes do fim do Termo. Proibido incluir item que não foi autorizado. Depende de parecer técnico e aprovação da CTLIE. Formalizada por **Termo Aditivo** de valor e/ou prazo, assinado antes do fim do Termo. Encargos só mudam em caso excepcional (mudança de lei ou justificativa técnica). | alta |
| Documentação para remanejamento, aplicação financeira ou readequação (art. 54) | Ofício com justificativa; Descrição do Plano de Trabalho; **planilha de remanejamento**; planilha orçamentária atualizada; calendário de competições, se mudar; atividades programadas com grade, locais e datas de cada núcleo; Certidão de Registro Cadastral (CRC), quando o nível for excelência. Pedido de **aplicação financeira** informa o valor a sair da CAPTAÇÃO, sob pena de indeferimento (art. 55). | alta |
| **Prorrogação de prazo** (art. 56) | Pedido fundamentado até **30 dias** antes do fim do Termo ou do Aditivo. **Até 2 prorrogações**, cada uma por Termo Aditivo assinado antes do vencimento. O pedido traz data específica, justificativa, novo cronograma físico-financeiro mês a mês, Descrição do Plano de Trabalho e cronograma de execução. A página oficial pede ainda ofício com a data no formato dd/mm/aaaa, grade de atividades, cessão de espaço, ata da diretoria e, para excelência, a CRC. | alta |
| **Local de execução** (art. 42) | Só muda com anuência prévia. Sem ela, caracteriza inexecução. O pedido traz plano de trabalho atualizado, termo de cessão, grade por núcleo e comprovação de acessibilidade. | alta |
| Qualquer outra alteração do plano de trabalho | Precisa de autorização prévia da DPPIE (art. 43). | alta |

**Planilha oficial de remanejamento e readequação**

Arquivo `copy_of_2planilharemanejamentoderecursosreadequacaodopt.xls`. Confiança: alta.

- **Abas:** "Remanejamento-Readequação" (o modelo, com área de impressão B1:M383) e "EXEMPLO".
- **Cabeçalho:** B1 "Projeto: / Processo nº:". B4 "REMANEJAMENTO DE RECURSOS/READEQUAÇÃO DO PLANO DE TRABALHO – MODELO I".
- **Cabeçalho repetido em cada bloco de item:**

| Coluna | Rótulo |
|---|---|
| B | Nº Item |
| C | Detalhamento das ações |
| D | Alterações |
| E | Desdobramento do item (a, b, c…) |
| F | Unidade |
| G | Qtde. |
| H | Duração |
| I | Valor Unitário R$ |
| J | Total da Linha R$ |
| K | JUSTIFICATIVA |
| L | Utilização de Saldo Remanescente (Valores R$ / Detalhamentos) |
| M | Utilização de Aplicação Financeira (Valores R$ / Detalhamentos) |

- **Linhas de cada bloco (11 linhas):**
  1. "SITUAÇÃO AUTORIZADA/APROVADA"
  2. "SITUAÇÃO EXECUTADA", com subitens a/b/c
  3. "SITUAÇÃO PROPOSTA (Além do que foi executado)", com subitens a/b/c
  4. "TOTAL DO ITEM" (`=executada+proposta`)
  5. "VALOR REMANEJADO/VALOR READEQUADO"
- **Fórmulas:**
  - Total da linha: `J = G*H*I`.
  - No EXEMPLO, valor remanejado: `J15 = J7-J8-J11`, ou seja aprovada − executada − proposta. **O rótulo diz o contrário** ("situação proposta + situação executada − situação aprovada"). Siga a fórmula e o tutorial: valor **positivo** é sobra a remanejar; valor **negativo** é uso por readequação.
  - Item retomado em readequação ("M 1.3", situação AUTORIZADA): `J37 = J30+J33*-1`.
- **Códigos dos itens:** atividade-fim usa "1.1"…"7.5". Atividade-meio usa o prefixo "**M**" ("M 1.1").
- **Totais no fim do modelo:**
  - B380 "TOTAL DA READEQUAÇÃO – USO DE RECURSOS (valores negativos)".
  - B381 "TOTAL DO REMANEJAMENTO – USO DE RECURSOS (valores positivos)". No modelo, a fórmula é `=SUMIF(#REF!,">0")`, **quebrada**.
  - B382 "USO DE SALDO REMANESCENTE" (=L382).
  - B383 "USO DE APLICAÇÃO FINANCEIRA NESSE REMANEJAMENTO" (=M383).
- **"Modelo II"** é a Planilha Orçamentária consolidada após a alteração: executada + proposta + remanejamento/readequação (tutorial).

**Tutorial** (`tutorial_remanejamentoereadequacao2023.doc`, ainda no texto da P424; confiança alta para o documento):

- Remanejamento é "toda alteração de valor/quantidade/duração dos itens".
- Readequação é "a possibilidade de o proponente captar recurso após o início da execução".
- O campo amarelo "VALOR REMANEJADO" deve ser positivo.
- "Utilização de saldo remanescente/aplicação financeira" só se preenche nos itens que vão usar esses saldos.
- Readequação não pode modificar o objeto.
- **Se o valor unitário aumentar, enviar 3 novos orçamentos por item.**

### 3.4 Despesas vedadas

Confiança alta para todas as linhas.

| Vedação | Fonte |
|---|---|
| Taxa de administração, de gerência ou similar | P10, art. 58, I |
| Pagamento a agente público da ativa por serviço, inclusive consultoria | P10, art. 58, II |
| Despesa em favor de clubes ou associações de servidores públicos | P10, art. 58, III |
| Despesa que gere vantagem financeira ou material ao patrocinador | P10 art. 58 IV. Dec art. 34 I. LC art. 20 I. |
| Despesa em benefício de membros da entidade proponente, salvo função específica aprovada no projeto | P10, art. 58, V |
| Compra de imóvel | P10, art. 58, VI |
| Remuneração de atleta profissional (conceito de remuneração dos arts. 457–458 da CLT) | LC art. 6º §2º. Dec art. 6º. P10 art. 59 I. |
| Manutenção ou organização de equipes profissionais de alto rendimento e de competições profissionais | Dec art. 6º §2º. P10 art. 59 II. |
| **Intermediação**, isto é, transferir a execução do objeto a terceiros. A sanção é rescisão do Termo. | Dec art. 13. P10 art. 59 III. |
| **Compra de espaço publicitário** em qualquer meio | Dec, art. 14 |
| Cobrar qualquer valor dos beneficiários em projeto de atividade regular | Dec, art. 16 |
| Despesa antes do Termo de Compromisso ou depois do fim da vigência | Dec art. 29 §3º. P10 arts. 40 e 80 §7º (multa de 5%). |
| Saque em dinheiro | P10, art. 38 |
| Projeto só de despesas administrativas de manutenção da entidade | P10, art. 32, I |
| Patrocínio ou doação a projeto que beneficie pessoa vinculada ao incentivador. Não é dedutível, e o MESP pode bloquear. | LC art. 3º §2º e art. 5º. Dec art. 2º §§5º–6º. P10 art. 22 §4º. |
| Benefícios de convenção coletiva não aprovados na admissibilidade ficam por conta da entidade | P10, art. 44, §4º |

### 3.5 Cotações, compras e contratos

| Regra | Fonte | Confiança |
|---|---|---|
| Na fase de projeto, o valor de cada despesa não pode passar da **média de 3 orçamentos** ou da **tabela de referência** | P10, art. 7º, §4º | alta |
| Na execução, entidade privada sem fins lucrativos compra ou contrata **sem novos orçamentos**, até o valor aprovado por item ou ação | P10 art. 46 caput. P424 art. 51 (Port. 33/2025). | alta |
| **No mínimo 3 orçamentos** só quando o valor autorizado do item aumentar | P10 art. 46 §3º. Tutorial. | alta |
| Cotação: descrição completa do item e critério de menor preço, admitidos outros critérios | P10, art. 47 | alta |
| Dispensa de cotação: pela natureza do objeto ou se não houver pluralidade de fornecedores. Comprovar preços do mesmo fornecedor em outras vendas (analogia com a Lei 14.133). | P10, art. 48 | alta |
| **Cada processo de compra** contém: cotação ou justificativa da ausência; justificativa da escolha do fornecedor e do preço; **comprovante de recebimento** da mercadoria ou serviço; documentos contábeis do pagamento | P10, art. 49 | alta |
| Contrato com fornecedor contém cláusulas de objeto, regime, prazos, preço, forma de pagamento, reajuste, direitos e multas, início e fim | P10, art. 50 | alta |
| Entidade pública segue a Lei 14.133. **Pregão é obrigatório** para bens e serviços comuns. | P10, art. 51 | alta |
| O MESP pode exigir pregão eletrônico também de entidade privada | Dec art. 10 §3º. P10 art. 46 §2º. | alta |
| Documentos de compra guardados por **10 anos** após a aprovação da PCF | P10, art. 46, §1º | alta |
| Na PC (parcial ou final), comprovar que as compras seguiram o plano e os valores aprovados | P10, art. 46, §4º | alta |

### 3.6 Recursos humanos

| Regra | Fonte | Confiança |
|---|---|---|
| Formas de contratação: **RPA, CLT ou PJ** especializada que disponibilize os profissionais de forma não exclusiva, sem configurar intermediação | P10, art. 44 | alta |
| A seleção se baseia na qualificação. A remuneração se baseia em pesquisa independente ou em **tabela de referência da DPPIE**. | P10, art. 44, §1º | alta |
| A forma de contratação e os encargos ficam explícitos no projeto. **Não se inclui encargo não autorizado** na admissibilidade. | P10, art. 44, §2º | alta |
| Remuneração de pessoal, inclusive da própria entidade, diretamente envolvido, **limitada ao período de vigência**, segregada no plano e aprovada antes | P10, art. 45 | alta |
| Encargos e verbas (FGTS, férias, 13º, rescisórias) fazem parte da remuneração. Não há vínculo com o poder público. Os encargos são de responsabilidade exclusiva da entidade. | P10, art. 45, §§1º–3º | alta |
| Reter e recolher os tributos (IR, INSS, ISS) é obrigação do proponente | P10 art. 76. Form, aba PAGAMENTOS, instrução 5. | alta |
| **Tabelas de referência** (`tabelasdereferncia.zip`, de 20/02/2020) | Tetos mensais de RH. Educacional/participação: Gerente Geral R$ 17.425; Professor 1 R$ 7.357,27; Monitor R$ 2.906,13; Estagiário R$ 1.453,06. Rendimento: classes I–IV. Também há diárias de 2018: Brasília/Manaus/Rio R$ 238,77; outras capitais R$ 213,63; demais R$ 188,50; exterior US$ 185–382,50. **[?]** Ainda são a referência vigente? | média |
| Bolsa auxílio só para beneficiários do nível **excelência** | P10, art. 13 | alta |
| Excelência exige **CRC** válida durante toda a execução. Se vencer, há 30 dias para apresentar nova. Sem ela, pagamentos suspensos e ressarcimento do que foi pago no período sem certidão. | P10, art. 31 | alta |

---

## 4. Documentos fiscais e comprobatórios

| Requisito | Fonte | Confiança |
|---|---|---|
| Comprovantes emitidos **única e exclusivamente em nome da entidade proponente** | P10 art. 41. P424 art. 47. | alta |
| **Número do projeto no SLI** registrado em **todos** os comprovantes de despesa | P10, art. 41, §1º | alta |
| Fatura, recibo e NF **discriminam** o serviço ou produto. Guardar o original e a cópia **frente e verso**, com beneficiários identificáveis, pelo prazo decadencial. | P10, art. 78 | alta |
| **Diárias** (deslocamento, hospedagem, alimentação) comprovadas por **recibo próprio assinado pelo usuário, com identificação e CPF** | P10, art. 41, §2º | alta |
| Pagamento a pessoa física por recibo exige recolher IR, INSS e ISS | Form, aba PAGAMENTOS, instrução 5 | alta |
| Originais arquivados **na sede** por no mínimo **10 anos** após a avaliação da PCF, à disposição do MESP e do controle. A DPPIE pode pedir os originais a qualquer momento. | P10 arts. 69, 70 e 77. IN RFB 1.131/2011, art. 36. | alta |
| O contador e o proponente respondem civil, penal e administrativamente pelas informações | P10, art. 68, §1º | alta |
| Documentos em língua estrangeira vão com tradução juramentada | P10, art. 98 | alta |
| Assinatura manual ou digital válida (Lei 14.063, art. 4º, II). **Proibidas** outras formas de autenticação. | P10 art. 6º §4º e art. 16 §5º | alta |
| Arquivos em **PDF pesquisável com OCR**, até **25 MB** cada. A regra está escrita para a apresentação do projeto e para modelos e declarações. **[?]** Aplicar também à PC. | P10, arts. 5º e 6º §3º | alta para o texto, média para a PC |

**Modelo de carimbo** (`modelo_carimbos2023.doc`). A página oficial diz que o carimbo "deverá constar na folha de rosto e verso das notas fiscais originais", no item 8 (Prestação de Contas Final). Confiança: alta.

1. **Frente da NF original:**
   ```
   Nº SLIE/SLI ______________
   MINISTÉRIO DO ESPORTE
   SECRETARIA EXECUTIVA
   LEI 11.438/2006
   ```
2. **Verso da NF original:**
   ```
   ATESTO QUE O SERVIÇO FOI RECEBIDO EM: _____/____/____
   ______________________________
   ASSINATURA
   ```

- O modelo ainda cita a **Lei 11.438/2006**, que foi **revogada**. **[?]** Não há versão atualizada com "LC 222/2025". O software deve gerar o texto exatamente como o modelo publicado e deixar o rótulo da lei configurável.
- O atesto do verso cumpre o "comprovante do recebimento da mercadoria e/ou serviço" da P10, art. 49, III.

**Recibo de captação** (`2023modelorecibo.doc`, "Comunicado de Recibo"; P10, art. 27):

- Campos 01–35:
  - Tipo (doação ou patrocínio).
  - Valor.
  - Banco: "Banco do Brasil ou Caixa". Agência, conta específica e data do depósito.
  - Forma (bens ou serviços), especificação e critério de avaliação.
  - Dados do incentivador: nome, CNPJ/CPF, endereço, telefone, se é pública ou privada, grupo empresarial, dirigente e área de patrocínio.
  - Dados do projeto: título idêntico ao da portaria e data de publicação no DOU.
  - Dados do declarante.
- O recibo deve ser numerado **sequencialmente por projeto** e acompanhado de **cópia do extrato** que comprove o depósito.
- O modelo fala em 3 vias. A P10 diz que o recibo é **emitido pelo SLI em 2 vias**.

**RPA**: a P10 admite RPA como forma de contratação (art. 44, I). **Não há modelo oficial de RPA** na página. Não encontrado.

---

## 5. Prestação de contas parcial (PCP) e final (PCF)

### 5.1 Prazos e regras

| Item | Regra | Fonte | Confiança |
|---|---|---|---|
| **PCP: quando** | A critério da DPPIE (art. 64). **Obrigatória** quando a liberação é parcelada: é condição para a parcela seguinte (art. 65, §2º). O Dec, art. 33 §3º, também diz "a critério do MESP". | P10, Dec | alta |
| PCP: como | Via **SEI**, com nº do processo, nome do projeto e documentos I–XI. Itens I–VII nos **formulários aprovados pela DPPIE**. | P10, art. 65 | alta |
| PCP: análise | Relatório de acompanhamento em **60 dias**, prazo que para durante diligência. **Não** julga o mérito nem a parte financeira (isso fica para a CGPC, na PCF). | P10, art. 66 | alta |
| **PCF: prazo** | **Até 60 dias** contados do **término da vigência do Termo de Compromisso ou do Termo Aditivo**. O Dec, art. 33, fala em "60 dias contado da data de término do projeto". | P10 art. 67. Dec art. 33. | alta |
| Contagem de prazos | Começa na **cientificação oficial**. Exclui o dia do começo e inclui o do vencimento. Dias **corridos**. Se vencer em dia sem expediente, vai para o próximo dia útil. Prazo em meses ou anos conta de data a data; se o mês não tiver o dia, vale o último dia do mês. **Prazos não se suspendem**, salvo força maior. | P10, arts. 99 e 101 | alta |
| PCF: abrangência | Registros e conformidade contábil e financeira de **toda a vigência do Termo e dos Aditivos**. Totalidade dos valores recebidos, com relatório de cumprimento do objeto. | P10 art. 68. Dec art. 33 §1º. | alta |
| Receitas do projeto | Bilheteria, inscrições e outras entram no Relatório de Receita e Despesa. Inscrições são revertidas integralmente ao projeto. | P10 art. 68 §5º e art. 7º §3º. Dec art. 15. | alta |
| Ingressos (doação do tipo "b") | O valor de ingressos não distribuídos é restituído na PCF | Dec, art. 11, §2º | alta |

### 5.2 Conteúdo da PCP (P10, art. 65) e da PCF (P10, art. 68)

Na tabela, um traço (—) indica que o item não consta daquela prestação.

| # | Peça | Formulário oficial | PCP (art. 65) | PCF (art. 68) |
|---|---|---|---|---|
| 1 | Relatório de cumprimento (parcial) do objeto: resultados esperados e atingidos, objetivos, repercussão | **Modelo RCO** (`modelorcoatualizado2026-1.docx`) | I | I |
| 2 | Relação de pessoal contratado | Form, aba **RECURSOS HUMANOS** | II | II |
| 3 | Relação de beneficiários | Form, aba **BENEFICIADOS** | III | III |
| 4 | Relatório de receitas e despesas | Form, aba **RECEITA E DESPESA** | IV | IV |
| 5 | Relatório de execução físico-financeira | Form, aba **EXECUTADO** | IV | IV |
| 6 | Relação de pagamentos | Form, aba **PAGAMENTOS** | IV | IV |
| 7 | Calendário oficial / atividades programadas: eventos | Form, aba **EVENTOS** | V | XI |
| 8 | Grade horária de atividades de cada núcleo | Form, aba **GRADE** | VI | XII |
| 9 | Grade horária dos recursos humanos | modelo separado `copy2_of_6grade_horaria_recursos_humanos.xls` | VII | — (não listado no art. 68 [?]) |
| 10 | Comprovação de divulgação (PDLIE) e de execução | fotos, mídia, peças (art. 94) | VIII | X |
| 11 | Fotos dos materiais e equipamentos adquiridos | — | IX | XIII |
| 12 | Fotos e reportagens do andamento ou da realização | — | X | XIV |
| 13 | Certidões de regularidade fiscal, tributária e trabalhista | — | XI | — |
| 14 | Cronograma físico-financeiro **a executar** | Form, aba **A EXECUTAR** ("APLICA-SE APENAS À PRESTAÇÃO DE CONTAS PARCIAL") | (form) | — |
| 15 | Extratos das contas CAPTAÇÃO e MOVIMENTO, do recebimento ao último pagamento | extrato bancário | — (o RCO diz "apenas na PCF") | V |
| 16 | Demonstrativo de rendimentos das duas contas | extrato de aplicação | (o RCO pede nas duas) | VI |
| 17 | Comprovante de GRU ou de transferência do saldo | GRU | — | VII |
| 18 | Cópia dos comprovantes de despesa, com a documentação dos arts. 42–51 (compras e contratos) | NF com carimbo, recibos, contratos, cotações | — | VIII |
| 19 | Relação de bens permanentes adquiridos, produzidos ou construídos | Form, aba **BENS ADQUIRIDOS** | (o form de 2026 permite PARCIAL) | IX |
| 20 | **Fotos que comprovem a acessibilidade** nos locais aprovados | — | — | **XV (novo)** |
| 21 | Relatório de diárias e passagens, um por evento | Form, aba **DIÁRIAS** | (RCO 2026, item "n": "até o momento de apresentação da PCP") | (comprovante de despesa) |

Observações:

- Itens I–IV da PCF e I–VII da PCP usam **obrigatoriamente** os formulários da DPPIE (art. 68 §2º e art. 65 §1º).
- Erro material na P10: o art. 68, VII remete ao "art. 56" para a transferência de saldo, mas o artigo certo é o 57.
- No modelo RCO 2026, a lista de peças (a–q) ainda remete aos "**arts. 69 ou 72 da Portaria nº 424/2020**".

### 5.3 Modelo RCO 2026 ("PRESTAÇÃO DE CONTAS PARCIAL/FINAL – RELATÓRIO DE CUMPRIMENTO DO OBJETO")

Arquivo `modelorcoatualizado2026-1.docx`, criado em 07/01/2026. Confiança: alta. Estrutura que o software deve gerar:

1. **I. DADOS DO PROJETO**: Processo nº; SLIE/SLI; Proponente; Projeto; Manifestação desportiva; Modalidades; CNPJ; Responsável legal.
2. **II. CONSECUÇÃO DO OBJETO**:
   - Objeto e objetivos.
   - Resultados esperados e atingidos e repercussão.
   - Alterações durante a execução, com justificativa: termo aditivo, mudança de local, remanejamentos, readequação, uso de aplicação financeira.
   - **Local(is) de Execução**, alterações e **condições de acessibilidade**. O modelo cita o art. 16 do Decreto 6.180, hoje revogado.
3. **III. METAS QUALITATIVAS E QUANTITATIVAS**:
   - Metas aprovadas, resultados e benefícios, com **indicadores e instrumentos de verificação**.
   - Apresentar **todos** os instrumentos de verificação.
   - Metas quantitativas com dados quantificáveis.
   - "Apresentar também a percepção e **% quanto o atingimento da meta**" (novo em 2026).
   - "ATENÇÃO: Atentar-se para não alterar as metas aprovadas na Análise Técnica e Orçamentária" (novo em 2026).
4. **IV. DOCUMENTOS COMPROBATÓRIOS** (a–q):
   - a) pessoal contratado
   - b) beneficiários
   - c) receitas e despesas
   - d) execução físico-financeira
   - e) pagamentos
   - f) extratos das contas CAPTAÇÃO e MOVIMENTO, **apenas na PCF**
   - g) demonstrativo de rendimentos das duas contas
   - h) GRU
   - i) pedido de transferência do saldo remanescente. A entidade transfere o saldo da MOVIMENTO para a CAPTAÇÃO antes de pedir.
   - j) comprovantes de despesa
   - k) bens
   - l) comprovante do PDLIE, citando os "arts. 94 a 98 da Portaria 424"
   - m) cronograma de atividades realizadas
   - n) **demonstrativo de diárias e passagens** até a PCP (novo em 2026)
   - o) calendário de eventos
   - p) fotos de materiais
   - q) fotos e reportagens
5. **"Aplicação financeira"**: tabela "DETALHAMENTO DAS AÇÕES" com colunas **AÇÃO Nº | VALOR (R$) | JUSTIFICATIVA**. O critério é o "melhor resultado para a execução" (P424 art. 29 §2º, equivalente à P10 art. 28 §2º).
6. **V. CONSIDERAÇÕES FINAIS**: texto padrão "Ressalta-se que foi atingido o objeto pactuado e cumprido fielmente o Plano de Trabalho aprovado."
7. **VI. AUTENTICAÇÃO**: "Atesto a veracidade…". Data e assinatura do responsável legal. A nota de rodapé diz: "Este documento será considerado para fins de análise técnica de cumprimento do objeto **somente com a assinatura do responsável legal**."

### 5.4 Layout exato do formulário PCP/PCF 2026

Fonte: `formulariopcppcfatualizado2026-1.xls`. Autor do arquivo: David Fuezi Lima de Oliva (DPPIE). Confiança: alta para tudo nesta seção.

**Características gerais**

- **10 abas, nesta ordem**: `RECEITA E DESPESA`, `EXECUTADO`, `PAGAMENTOS`, `RECURSOS HUMANOS`, `BENEFICIADOS`, `GRADE`, `EVENTOS`, `A EXECUTAR`, `BENS ADQUIRIDOS`, `DIÁRIAS`.
- Sem proteção, sem linhas ou colunas ocultas, sem validação de dados e sem nomes definidos.
- Fonte **Times New Roman**: títulos em 16 negrito; rótulos em 8–11.
- Preenchimento cinza **#C0C0C0** nas células de total e nos cabeçalhos de instrução. Na aba A EXECUTAR, cabeçalhos em **#969696**.
- Cada aba tem a imagem do **selo LIE vertical** ("Marca_Lei_De_Incentivo_Ao_Esporte…Vertical") ancorada em A1:A2.
- Páginas em **paisagem**, papel A4 (código 9). A aba A EXECUTAR usa papel Carta (código 1) com "ajustar à página".
- Cada aba tem **área de impressão** (abaixo). As instruções ficam fora dela.
- **Marcador de tipo**: no canto superior direito, linha 1 "PARCIAL   (     )" e linha 2 "FINAL  (     )". Aparece em RECEITA E DESPESA (E1/E2), EXECUTADO (J1/J2), PAGAMENTOS (H1/H2), RECURSOS HUMANOS (I1/I2), BENEFICIADOS (M1/M2), BENS ADQUIRIDOS (G1/G2) e DIÁRIAS (K1/K2). **Não aparece** em GRADE, EVENTOS nem A EXECUTAR. O software marca "X" dentro dos parênteses.
- **Rodapé de assinatura** abaixo da tabela: "LOCAL E DATA:" e "NOME E ASSINATURA DO RESPONSÁVEL:".

**Mudanças em relação ao formulário anterior** (`copy_of_formulariopcppcfatualizado.xls`, ainda publicado na página):

- (a) BENS ADQUIRIDOS e DIÁRIAS **perderam** a nota "APLICA-SE APENAS À PRESTAÇÃO DE CONTAS FINAL" e **ganharam** o marcador PARCIAL/FINAL.
- (b) RECEITA E DESPESA, instrução 6: o asterisco e a nota de rodapé de "outras fontes" passam a valer "(apenas na prestação de contas final)".
- (c) RECURSOS HUMANOS, instrução de NOME e RG: contratação PJ deve indicar o **CNPJ**.
- (d) RECURSOS HUMANOS, instrução de período: "considerando o período de vigência aprovado para execução do projeto".

#### Aba 1 — `RECEITA E DESPESA` (área de impressão A1:E35)

- B1:D2 (mesclado): "RELATÓRIO DE EXECUÇÃO DE RECEITA E DESPESA". E1/E2: PARCIAL/FINAL.
- A4:D4: " 1 – NOME DO PROJETO:". E4:E5: "2 – N.º SLI:". A5:D5: " 3 - PROPONENTE:".
- **Cabeçalho da tabela (linha 6):**

| Colunas | Rótulo |
|---|---|
| A6:B6 | "4 - RECEITA" |
| C6 | "5 - VALOR" |
| D6 | "6 - DESPESA" |
| E6 | "7 - VALOR" |

- **Linhas de dados: 7 a 30** (24 linhas). A:B mescladas em cada linha.
- **Totais (linha 31):** A31:B31 "8 – TOTAL....................", com `C31 = SUM(C7:C30)`. D31 "8 – TOTAL....................", com `E31 = SUM(E7:E30)`. O rótulo do total da despesa deveria ser "9" segundo as instruções; é erro do modelo.
- **Saldo:** A33:D33 "10 – SALDO................", com `E33 = C31-E31`.
- Formato numérico: `#,##0.00`.
- A34 "LOCAL E DATA :". B34:E34 "NOME E ASSINATURA DO RESPONSÁVEL:".
- **Instruções** (A37–A50):
  - A39: "OBS: MENCIONAR SE A PRESTAÇÃO DE CONTAS É PARCIAL OU FINAL".
  - A40: execução da receita e da despesa = receitas de doação ou patrocínio, resultado da aplicação financeira dos recursos incentivados, recursos de outras fontes e despesas.
  - Campo 1: nome completo do projeto aprovado.
  - Campo 2: número do projeto no SLI.
  - Campo 3: nome completo do proponente.
  - **Campo 4 (RECEITA)**: nomes dos **incentivadores**; **resultados das aplicações financeiras**; origem de **outras fontes** (lei estadual ou municipal, recursos próprios, bilheteria, venda de produto).
  - **Campo 5 (VALOR)**: valor do incentivo, **resultado mensal** das aplicações e outras fontes.
  - **Campo 6 (DESPESA)**: "Mencionar as **metas realizadas**… identificando com asterisco as metas realizadas com recursos de outras fontes, mencionando em nota de rodapé a origem destes recursos (apenas na prestação de contas final)".
  - **Campo 7 (VALOR)**: valor de cada **macroação**.
  - Campo 8: soma das receitas. Campo 9: soma dos gastos.
  - **Campo 10 (SALDO)**: "Recolher por meio de GRU (apenas na prestação de contas final)".
- **Modelo de dados implícito:** receitas uma por incentivador e uma por **mês de rendimento**; despesas uma por meta ou macroação.

#### Aba 2 — `EXECUTADO` (área de impressão A1:J34)

- B1:I2: "RELATÓRIO DE EXECUÇÃO FÍSICO-FINANCEIRA". J1/J2: PARCIAL/FINAL.
- **Cabeçalho de identificação:**
  - A4:D4 "01. PROPONENTE:" e E4:J4 "02. NOME DO PROJETO:".
  - A5:B5 "03. VALOR CAPTADO:"; C5:D5 "04. VALOR DE RENDIMENTOS DE APLICAÇÃO FINACEIRA:" (grafia do original); E5:F5 "05. Nº DO PROCESSO:"; G5:H5 "06. Nº SLI:"; I5:J5 "07. PERÍODO DE VIGENCIA:".
- **Cabeçalho da tabela (linhas 7–8):**

| Colunas | Rótulo |
|---|---|
| A7:A8 | "08. AÇÃO" |
| B7:C8 | "09. ESPECIFICAÇÃO" |
| D7:F7 | "EXECUÇÃO FÍSICA", com D8 "10. UNIDADE DE MEDIDA", E8 "11. PROGRAMADA", F8 "12. EXECUTADA" |
| G7:J7 | "EXECUÇÃO FINANCEIRA (R$)", com G8 "13.PROGRAMADA", H8 "14. EXECUTADA", I8 "15. APLICAÇÃO FINANCEIRA", J8 "16. TOTAL" |

- **Linhas de dados: 9 a 31** (23 linhas). B:C mescladas. **A coluna J (total) não tem fórmula por linha.** **[?]** Pela instrução 16 ("total dos recursos aplicados"), o software deve calcular `J = H + I`.
- **Totais (linha 32):** A32:F32 "17. TOTAL ................", com `G32 = SUM(G9:G31)`, `H32 = SUM(H9:H31)`, `I32 = SUM(I9:I31)` e `J32 = SUM(J9:J31)`.
- A33:B33 "LOCAL E DATA:". D33:J33 "NOME E ASSINATURA DO RESPONSÁVEL:".
- **Instruções 1–17** (A40:B56):
  - 1: denominação constante do CNPJ.
  - 3: valor captado.
  - 4: rendimentos das aplicações.
  - 5: nº do processo.
  - 6: nº SLI.
  - 7: período de vigência do Termo de Compromisso.
  - 8: numeração sequencial da ação conforme o plano de trabalho.
  - 9: descrição sucinta de cada ação, executada ou em execução.
  - 10: unidade de medida de cada ação, etapa ou fase.
  - 11: quantidade programada no plano.
  - 12: quantidade executada.
  - 13: "valor… executados pelo concedente". Texto herdado de convênio. Na prática, valor programado.
  - 14: "executados pela instituição beneficiada (contrapartida)". Texto legado. Na prática, valor executado com recurso incentivado.
  - 15: valor executado com rendimentos.
  - 16: total aplicado no período do campo 07.
  - 17: soma.

#### Aba 3 — `PAGAMENTOS` (área de impressão A1:H35)

- B1:G2: "RELAÇÃO DE PAGAMENTOS". H1/H2: PARCIAL/FINAL.
- A4:G4 " 1 – NOME DO PROJETO:". H4:H5 "2 – N.º SLI:". A5:G5 " 3 - PROPONENTE:".
- **Cabeçalho da tabela (linha 6):**

| Coluna | Rótulo |
|---|---|
| A6 | "4 -AÇÃO" |
| B6 | "5 - CREDOR" |
| C6 | "6 – C.N.P.J./C.P.F." |
| D6 | "7 - CHEQUE" |
| E6 | "8 - DATA" |
| F6 | "9 - TIT.CRÉDITO" |
| G6 | "10 - DATA" |
| H6 | "11 - VALOR" |

- **Linhas de dados: 7 a 32** (26 linhas).
- **Total:** A33:G33 "12 - TOTAL................", com `H33 = SUM(H7:H32)` no formato `#,##0.00`.
- **Instruções** (A41–B54):
  - A41: pagamentos feitos com recurso captado pela LIE e com aplicação financeira.
  - Campo 2: "SLIE N.º".
  - **Campo 4**: instrução "ITEM: Enumerar seqüencialmente os pagamentos efetuados". Diverge do cabeçalho "AÇÃO". **[?]** Sugestão: código da ação mais nº sequencial.
  - **Campo 5 (CREDOR)**: razão social ou nome que consta da NF, fatura ou recibo. Pagamento a PF por recibo exige **recolher IR, INSS e ISS**.
  - Campo 6: CNPJ ou CPF do credor.
  - Campo 7: nº do cheque.
  - Campo 8: data do cheque.
  - **Campo 9 (TÍTULO DE CRÉDITO)**: sigla mais número. Exemplos: "N.F." Nota Fiscal, "Fat." Fatura, "Rec." Recibo, como em **"NF 0457"**.
  - Campo 10: data de emissão do título.
  - Campo 11: valor do título.
  - Campo 12: soma.

#### Aba 4 — `RECURSOS HUMANOS` (área de impressão A1:I35)

- B1:H2: "RELAÇÃO DE RECURSOS HUMANOS CONTRATADOS". I1/I2: PARCIAL/FINAL.
- A4:H4 "NOME DO PROJETO:". I4:I5 "N.º SLIE:". A5:H5 "PROPONENTE:".
- **Cabeçalho da tabela (linha 6):**

| Coluna | Rótulo |
|---|---|
| A | "Nº" |
| B | "NOME (Ordem alfabética)" |
| C | "RG" |
| D | "FUNÇÃO/ATIVIDADE" |
| E | "TELEFONE" |
| F | "CARGA HORÁRIA" |
| G | "SALÁRIO/ VALOR DO SERVIÇO" |
| H | "ENCARGOS" |
| I | "PERÍODO CONTRATAÇÃO" |

- **Linhas de dados: 7 a 33** (27 linhas). Sem total e sem fórmulas.
- A34:B34 "LOCAL E DATA:". D34 "NOME E ASSINATURA DO RESPONSÁVEL:".
- **Instruções** (A41–A50):
  - Data do relatório.
  - Ação ou subação com a mesma codificação do plano de trabalho.
  - Descrição.
  - **NOME e RG**; se a contratação for PJ, indicar o **CNPJ**.
  - Função.
  - **Telefone e endereço**. A instrução pede endereço, mas não há coluna para ele.
  - **Carga horária** diária, semanal ou mensal.
  - **Salário em reais**.
  - **Encargos** sociais e trabalhistas.
  - **Período** do mês inicial ao final, dentro da vigência aprovada.
- Na célula A73 há um marcador oculto, fora da área de impressão: "COAME v.1.0 set08".

#### Aba 5 — `BENEFICIADOS` (área de impressão A1:M38)

- A1:L2: "RELAÇÃO DE DIRETAMENTE BENEFICIADOS". M1/M2: PARCIAL/FINAL.
- A4:L4 "NOME DO PROJETO:". M4:M5 "N.º SLI:". A5:L5 "PROPONENTE:".
- **Cabeçalho da tabela (linhas 6–7):**

| Colunas | Rótulo |
|---|---|
| A6:A7 | "Nº" |
| B6:B7 | "Evento/ modalidade" |
| C6:C7 | "Nome (ordem alfabética)" |
| D6:D7 | "Endereço" |
| E6:E7 | "Telefone" |
| F6:F7 | "Idade" |
| G6:L6 | "BENEFÍCIOS", com G7…L7 = "XXXX" em 6 colunas. O placeholder deve ser trocado pelo **tipo de benefício**: café, lanche, transporte, assistência médica ou odontológica. |
| M6:M7 | "OBSEVAÇÕES" (grafia do original) |

- **Linhas de dados: 8 a 34**, já numeradas de 1 a 27 em A.
- **Totais por sexo**:
  - A35:M35: "Total público atendido sexo Feminino:".
  - A36:M36: "Total público atendido sexo Masculino:".
  - Os valores são digitados no texto da célula mesclada.
- A37:C38 "LOCAL E DATA:". D37:M38 "NOME E ASSINATURA DO RESPONSÁVEL:".
- **Instruções** (A43–A52):
  - Identificar os diretamente beneficiados e os benefícios recebidos.
  - Data do relatório.
  - Ação/subação.
  - Descrição.
  - "NOME e RG. Nome e RG do **contratado**": erro de cópia, o certo é beneficiado. Não há coluna de RG.
  - Idade.
  - **Total de público atendido separado por feminino e masculino**.
  - Telefone.
  - Tipo de benefício.
  - "numerar e, à parte, tecer as observações…".
- **Projeto grande:** o software precisa gerar várias páginas ou abas, porque o modelo tem 27 linhas. **[?]** A norma não diz se pode haver várias páginas; o formulário só traz 27 linhas.

#### Aba 6 — `GRADE` (área de impressão A1:H33; sem PARCIAL/FINAL)

- A1:H2: "GRADE HORÁRIA DE ATIVIDADES PROGRAMADAS".
- A4:H4 "NOME DO PROJETO:". A5:H5 "PROPONENTE:". A6:F6 "Nº PROCESSO:". G6:H6 "Nº SLI:".
- **Bloco por núcleo, repetido** (linhas 8–20 e 21–33):
  - A8 "NÚCLEO:", A9 "ENDEREÇO:", A10 "RESPONSÁVEL PELO PROJETO NO NÚCLEO :", A11 "TELEFONE:".
  - Cabeçalho nas linhas 12–13:

| Colunas | Rótulo |
|---|---|
| A12:A13 | "TURMA" |
| B12:B13 | "MODALIDADE" |
| C12:C13 | "QTDE. ALUNOS/ BENEFICIÁRIOS" |
| D12:D13 | "DIAS DA SEMANA" |
| E12:F12 | "HORÁRIO", com E13 "DE" e F13 "A" |
| G12:G13 | "EQUIPE/ PROFISSINAIS ENVOLVIDOS" (grafia do original) |
| H12:H13 | "OBSERVAÇÕES" |

  - Dados nas **linhas 14 a 20**, 7 turmas por núcleo. No segundo bloco: cabeçalho nas linhas 25–26 e dados nas linhas 27–33.
- **Repetir o bloco quantos núcleos houver.**

#### Aba 7 — `EVENTOS` (sem área de impressão; sem PARCIAL/FINAL)

- B1:H2: "EVENTOS A REALIZAR/PARTICIPAR".
- A4:H4 "NOME DO PROJETO:". A5:H5 "PROPONENTE:". A6:F6 "Nº PROCESSO:". G6:H6 "Nº SLI:".
- **Cabeçalho da tabela (linhas 8–9):**

| Colunas | Rótulo |
|---|---|
| A8:B9 | "NOME DO EVENTO". A coluna A traz a numeração 1–17 e a B o nome. |
| C8:D8 | "DATA", com C9 "DE" e D9 "A" |
| E8:G8 | "LOCAL", com E9 "ENDEREÇO", F9 "CIDADE" e G9 "PAÍS" |
| H8:H9 | "Nº BENEFICIÁRIOS PREVISTOS" |

- **Linhas de dados: 10 a 26** (17 linhas). Sem instruções.

#### Aba 8 — `A EXECUTAR` (área de impressão A1:L43; **só na PCP**)

- B1:L2: "CRONOGRAMA FÍSICO FINANCEIRO DE DESEMBOLSO - A EXECUTAR".
- **Cabeçalho de identificação:** A3:K3 "1 - PROPONENTE:"; L3:L6 "5 – N.º SLI:"; A4:K4 "2 - NOME DO PROJETO:"; A5:K5 "3 - PROCESSO Nº:"; A6:K6 "4 - PERÍODO DE EXECUÇÃO:".
- **Bloco ATIVIDADE FIM:**
  - A7:B7 "ATIVIDADE FIM". C7:L7 "VALORES EM R$".
  - Linha 8: A8 "6 - Nº"; B8 "7 - NOME DA AÇÃO"; C8 "8 - TOTAL DA AÇÃO ORÇADO NO P.T."; **D8…K8 = "1º MÊS"…"8º MÊS"**; L8 "9 - TOTAL A EXECUTAR".
  - **Linhas 9–23** (15 ações). `L{n} = SUM(D{n}:K{n})`.
  - O modelo **vem com valores de exemplo** que devem ser zerados: linha 9 "RECURSOS HUMANOS" com 190.000 e meses; linha 10 "TRANSPORTE" com 100.000.
  - Linha 24 "TOTAL DA ATIVIDADE FIM": `C24 = SUM(C9:C23)`; D24…K24 somam cada mês; `L24 = SUM(L7:L23)`.
- **Bloco ATIVIDADE MEIO:**
  - A26:B26 "ATIVIDADE MEIO". C26:L26 "VALORES EM R$". A linha 27 repete o cabeçalho, com A27 "Nº".
  - **Linhas 28–33** (6 ações). Exemplo a zerar: linha 28 "RECURSOS HUMANOS" com 30.000.
  - Linha 34 "TOTAL DA ATIVIDADE MEIO": `C34 = SUM(C28:C33)`; meses somados; `L34 = SUM(L28:L33)`.
- **Totais finais:**
  - Linha 36 "TOTAL ATIVIDADE MEIO + ATIVIDADE FIM": `C36 = SUM(C24+C34)` e `L36 = SUM(L24+L34)`.
  - Linha 37 "**ELABORAÇÃO E CAPTAÇÃO DE RECURSOS**": C37 e D37 com exemplo de 15.000; `L37 = SUM(D37:K37)`.
  - Linha 38 "TOTAL GERAL": `C38 = SUM(C37+C36)` e `L38 = SUM(L36:L37)`.
  - Linha 39: rótulos "1º MÊS"…"8º MÊS" e "TOTAL A EXECUTAR".
  - Linha 40 "TOTAL MENSAL": `D40 = +D24+D34+D37` e assim até K40; `L40 = SUM(D40:K40)`.
  - Linha 41 "ACUMULADO": `D41 = +D40`; `E41 = +D41+E40`; …; `K41 = +J41+K40`.
- A42 "LOCAL E DATA:". F42 "NOME E ASSINATURA DO RESPONSÁVEL:".
- **Formatos numéricos:** contábil `_(* #,##0.00_)…` e `#,##0.00`.
- **Instruções 1–9:**
  - 1: denominação no CNPJ.
  - 2: título.
  - 3: processo.
  - 4: vigência do Termo.
  - 5: nº SLI.
  - 6: nº da ação no PT, **em nível macro**.
  - 7: nome da ação, em nível macro.
  - 8: valor aprovado por ação.
  - 9: valor a executar até o fim do projeto, **soma dos meses**.
- **Limitação:** o modelo tem só 8 meses. O cronograma mês a mês de admissibilidade tem 14. O software deve expandir as colunas de mês até o fim da vigência. **[?]** Expandir é aceitável? A DPPIE não diz.

#### Aba 9 — `BENS ADQUIRIDOS` (área de impressão A1:G35)

- A1:F2: "RELAÇÃO DE BENS ADQUIRIDOS, PRODUZIDOS OU CONSTRUÍDOS". G1/G2: PARCIAL/FINAL.
- A4:F4 " 1 – NOME DO PROJETO:". G4:G5 "2 – N.º SLI:". A5:F5 " 3 - PROPONENTE:".
- **Cabeçalho da tabela (linha 6):**

| Coluna | Rótulo |
|---|---|
| A6 | "4 -AÇÃO" |
| B6 | "5 - ITEM" |
| C6 | "6 – ORIGEM" |
| D6 | "7 - LOCALIZAÇÃO" |
| E6 | "8 - DESTINAÇÃO" |
| F6 | "9 - DATA" |
| G6 | "10 - VALOR" |

- **Linhas de dados: 7 a 32** (26 linhas).
- **Total:** A33:F33 "11 - TOTAL................", com `G33 = SUM(G7:G32)`.
- **Instruções:**
  - Bens **permanentes** comprados com recurso incentivado ou com rendimentos.
  - Projeto conforme a portaria de aprovação.
  - SLI no formato "Ano-número", por exemplo "98-1234".
  - Ação do plano de trabalho.
  - Item numerado em sequência.
  - **Origem**: adquirido, produzido ou construído.
  - **Localização**: onde o bem será mantido.
  - **Destinação**: destino do bem **depois do fim do projeto**.
  - Data da aquisição ou da conclusão.
  - Valor.
- O destino dos bens remanescentes também é cláusula do Termo de Compromisso (P10, art. 36, IV).

#### Aba 10 — `DIÁRIAS` (área de impressão A1:K36)

- A1:J2: "RELATÓRIO DE DIÁRIAS E PASSAGENS". K1/K2: PARCIAL/FINAL.
- **Cabeçalho de identificação:** A4:I4 "NOME DO PROJETO:"; J4:K5 "N.º SLI:"; A5:I5 "PROPONENTE:"; A6:K6 "AÇÃO/SUB-AÇÃO:"; A7:K7 "EVENTO:"; A8:C8 "LOCAL:"; D8:K8 "PERÍODO:".
- **Cabeçalho da tabela (linhas 9–10):**

| Colunas | Rótulo |
|---|---|
| A9:A10 | "Nº" |
| B9:B10 | "NOME PASSAGEIRO" |
| C9:C10 | "RG" |
| D9:D10 | "TELEFONE" |
| E9:E10 | "FUNÇÃO" |
| F9:F10 | "TRECHO(S)" |
| G9:G10 | "VALOR PASSAGEM" |
| H9:I9 | "DIÁRIA", com H10 "VALOR" e I10 "QDE" |
| J9:J10 | "OUTRAS DESPESAS" |
| K9:K10 | "TOTAL" |

- **Linhas de dados: 11 a 34** (24 linhas). A numeração em A **pula o 16**: vai de 1 a 15 e depois de 17 a 25. É erro do modelo.
- **K não tem fórmula.** A instrução define: "TOTAL = passagens + (qtde.diárias x $ diária) + outras despesas", ou seja `K = G + H*I + J`.
- **Instruções:**
  - "**Elaborar uma planilha por evento**".
  - Ação/subação com o código do PT.
  - Evento com a descrição do PT.
  - Nome e RG do passageiro.
  - Função (técnico, auxiliar, atleta, monitor).
  - Telefone.
  - Trecho.
  - "DATA – inserir datas da viagem". **Não existe coluna de data**; usar o campo PERÍODO ou a coluna de trechos. **[?]**
  - Valor da passagem com taxa de embarque.
  - Valor unitário da diária.
  - Quantidade.
  - Outras despesas "discriminar à parte".

#### Modelo separado — `GRADE HORÁRIA DOS RECURSOS HUMANOS`

Arquivo `copy2_of_6grade_horaria_recursos_humanos.xls`, aba "Cronograma Execução". Exigido na PCP (art. 65, VII) e no Termo de Compromisso.

- **Cabeçalho:** A1 título; A2 nome do projeto; A3 proponente; A4 nº do processo; H4 nº SLI.
- **Linha 6:**

| Coluna | Rótulo |
|---|---|
| A | Cargo |
| C | Atribuições |
| D | Quant. |
| E…K | Segunda … Domingo |
| L | Carga horária semanal |
| M | Forma de contratação (**CLT/RPA/PJ**) |
| N | Formação acadêmica |

---

## 6. Devolução (GRU)

### 6.1 Quando se recolhe

Tudo pela P10. Confiança alta para cada item.

- Saldo não aplicado na PCF: RECEITA E DESPESA, campo 10, e art. 68, VII.
- Captação acima do autorizado: art. 22, §2º.
- Desistência: art. 22, §3º.
- Prazo de captação vencido com menos de 20% captado: art. 22, §1º, I.
- Depósito errado não estornado em 60 dias: art. 23, §2º.
- Não pedir a ATO em 12 meses: art. 30, §3º.
- Saldo da CAPTAÇÃO não indicado na ATO: art. 30, §7º.
- Não assinar o Termo em 180 dias: art. 35, §3º.
- Reprovação: art. 80, em 45 dias.
- Ressalva por cumprimento parcial: art. 80, §4º, em 30 dias.
- **Multa de 5%** sobre despesa feita fora da vigência: art. 80, §7º.
- Ingressos não distribuídos: Dec, art. 11, §2º.
- Atualização do valor devido pela **IN TCU 71/2012**, com os índices do TCU: art. 80, §3º.

### 6.2 Procedimento oficial

Fonte: `orientacoes-para-recolhimento-de-valores-ao-tesouro-nacional.pdf`, 3 páginas, PDF gerado em 20/03/2023, timbre "MINISTÉRIO DO ESPORTE – SECRETARIA EXECUTIVA – DIRETORIA DE PROGRAMAS E POLÍTICAS DE INCENTIVO AO ESPORTE". Confiança: alta para o conteúdo do documento.

| Campo da GRU | Valor oficial |
|---|---|
| **Unidade Gestora** | **180076** |
| **Gestão** | **00001** |
| Nome da unidade | DIFE |
| **Código de recolhimento** | **18004-1** |
| **Número de referência** | **nº do processo, sem caracteres especiais** (exemplo: `580000099201099`) |
| Pagamento | "**Pagar somente no Banco do Brasil, em dinheiro.**" O exemplo traz "GRU SIMPLES – Pagamento exclusivo no Banco do Brasil S.A." e "não poderá ser liquidada com cheque". |
| Outros campos do exemplo | Competência (mm/aaaa); vencimento; nome e CNPJ do contribuinte (o proponente); (=) Valor do principal; (−) Desconto/abatimento; (−) Outras deduções; (+) Mora/multa; (+) Juros/encargos; (+) Outros acréscimos; (=) Valor total |
| Pagamento em atraso | O proponente envia **ofício** com nº do processo, valor principal e data prevista de pagamento. O MESP calcula a mora, multa e juros e devolve a GRU preenchida, podendo ajustar a data. |
| Contato | `pcf.senife@cidadania.gov.br`. É endereço antigo do Ministério da Cidadania. **[?]** |

**Ressalvas** (confiança média):

- (a) O **exemplo** de GRU no próprio PDF mostra "UG/Gestão **180002 / 00001**", com unidade "SUBSECR. DE PLANEJ. ORCAM. E ADMINISTRACAO/ME" e competência 04/2012. Isso **contradiz** a instrução (UG 180076). O software deve usar **180076** (instrução textual) e deixar UG e código configuráveis.
- (b) O link oficial `consulta.tesouro.fazenda.gov.br/gru/gru_simples.asp` **não respondeu**: erro 502 no teste de 01/10/2026. O portal atual de emissão é o PagTesouro (`pagtesouro.tesouro.gov.br/portal-gru/`), que respondeu 200. **[?]** Não sei se os códigos 180076 / 18004-1 continuam valendo em 2026.
- (c) **Não há** orientação de 2026 publicada.

---

## 7. Análise, diligências, resultados, sanções e recursos

### 7.1 Quem analisa e em quanto tempo

| Etapa | Regra | Fonte | Confiança |
|---|---|---|---|
| PCP | A DPPIE emite relatório de acompanhamento em 60 dias, prazo interrompido por diligência. Não aprova o projeto antecipadamente. | P10, art. 66 | alta |
| PCF técnica (DPPIE) | Analisa RCO, execução física, **PDLIE**, **acessibilidade e democratização do acesso**, fotos e reportagens. Emite parecer: **aprova, aprova parcialmente ou reprova**. Pode adotar medida cautelar de **suspender o acesso** ao sistema se houver desvio de objeto. | P10, art. 71 | alta |
| PCF financeira (CGPC) | Analisa receita e despesa, execução financeira, pagamentos, extratos, rendimentos, recolhimentos e comprovantes. Emite o **Parecer de Avaliação Final**: aprovação, aprovação parcial, aprovação com ressalva ou reprovação. | P10, arts. 72–74 | alta |
| Prazos | Até **360 dias** para a análise técnica e **360 dias** para a financeira, contados do recebimento. A regra geral de 45 + 45 dias (art. 1º, §6º) **não vale** para a PCF. | P10, art. 82 | alta |
| Avaliação | O MESP verifica se os resultados foram alcançados, se os custos estimados batem com os reais e qual foi a repercussão. Pode usar peritos. | Dec, art. 32 | alta |
| Fiscalização | Visita técnica in loco ou virtual a qualquer tempo, por amostragem ou denúncia. Gera relatório circunstanciado. | P10, arts. 61–62 | alta |

### 7.2 Diligências

| Regra | Fonte | Confiança |
|---|---|---|
| PCF: diligência com **30 dias improrrogáveis** para suprir documentos ou informações | P10 art. 68 §3º. P424 art. 72 §3º. | alta |
| Diligência por **e-mail**, com confirmação de recebimento em **até 1 dia útil** | P10, art. 68, §4º | alta |
| Diligência da ATO: 30 dias improrrogáveis. Diligência da CTLIE: 30 dias improrrogáveis. Diligência da CRC: até 30 dias. | P10 arts. 30 §14 e 31 §2º. Port. 37/2026 art. 20 §1º. | alta |
| Diligência descumprida, no todo ou em parte: **arquivamento**, se a análise depende dela, ou **indeferimento** | P10, art. 100 | alta |
| Prazo de diligência da PCP: o prazo de 60 dias da análise para de correr | P10, art. 66 | alta |

### 7.3 Resultados (P10, art. 79)

Confiança alta.

| Resultado | Quando |
|---|---|
| **Aprovada** | Aplicação regular e avaliação técnica satisfatória |
| **Aprovada com ressalvas** | Contas regulares, avaliação técnica insatisfatória, sem prejuízo ao erário nem descumprimento do objeto |
| **Aprovada parcialmente** | Avaliação técnica satisfatória, mas irregularidades nas contas com prejuízo ao erário |
| **Reprovada** | Contas irregulares no Parecer de Avaliação Final, qualquer que seja o resultado técnico |

A conclusão é registrada no **SLI** (art. 79, p.ú.). O proponente recebe a decisão com cópia dos dois pareceres (art. 75). Aprovação com ressalva por cumprimento parcial lista os incisos do art. 68 não atendidos, quantificando-os (art. 72, §1º).

### 7.4 Consequências e sanções

| Situação | Consequência | Fonte | Confiança |
|---|---|---|---|
| PCF fora do prazo | A DPPIE recolhe o saldo das duas contas, com rendimentos, e recomenda **TCE**. Proibida a transferência do saldo. **SLI suspenso.** Outros projetos em tramitação ficam **paralisados** até o saneamento. Inadimplência registrada no SLI e no SIAFI. O Dec acrescenta a suspensão para apresentar novos projetos. | P10 arts. 67 §§3º–4º e 83. Dec art. 33 §2º. | alta |
| Saneamento | Restabelece o acesso e permite retomar os projetos, mas **não** recupera o uso do saldo em outro projeto | P10, art. 67, §6º | alta |
| Reprovação | **45 dias** para recolher, com rendimentos e atualização pela IN TCU 71/2012. Se não recolher, TCE. | P10, art. 80 | alta |
| Ressalva por cumprimento parcial, ou arquivamento | **30 dias** para recolher os remanescentes | P10, art. 80, §4º | alta |
| Despesa fora da vigência | Ressarcimento **mais 5%** por GRU | P10, art. 80, §7º | alta |
| Hipóteses de TCE | PC não apresentada; inexecução; desvio; despesa impugnada; uso indevido de rendimentos; saldo não devolvido; falta de documentos; dano ao erário | P10, art. 84 | alta |
| Efeitos da TCE | Inadimplência no SLI, que impede novos projetos. Inscrição no CADIN ("Diversos Responsáveis"). Envio ao TCU em 180 dias. | P10, arts. 84 §3º e 88 | alta |
| Infrações do Dec e da LC | Patrocinador paga o imposto não recolhido. **Multa de 2× a vantagem indevida.** **Rescisão** com devolução integral corrigida. Responsabilidade solidária do proponente na vantagem ao patrocinador. | Dec arts. 34–35. LC arts. 20–21. | alta |
| PDLIE descumprido | Esclarecimento em **5 dias**. Se reincidir, a CTLIE pode **impedir novos projetos por até 24 meses**. | P10, art. 93 | alta |
| Prescrição | 5 anos para as sanções, contados da apresentação da PCF. O ressarcimento ao erário não prescreve. | P10, art. 81 | alta |

### 7.5 Recursos

| Decisão | Recurso | Fonte | Confiança |
|---|---|---|---|
| CTLIE: autorização, aprovação parcial, rejeição | **Reconsideração em 5 dias** corridos, única, sem novo recurso | Dec art. 26. P10 art. 18. Port. 37 art. 31. | alta |
| Rejeição da execução do **objeto** (DPPIE) | Reconsideração **única em 5 dias** da comunicação oficial. Se indeferida, **recurso administrativo em 10 dias** (Lei 9.784/1999). | P10, art. 71, §§2º–3º | alta |
| Rejeição da execução **financeira** | Reconsideração única em 5 dias. Depois, recurso administrativo em 10 dias. | P10, art. 80, §§5º–6º | alta |
| Inadmissibilidade por falta de documento obrigatório | Não cabe recurso | P10, art. 16, §4º | alta |
| Projetos sob a P424 | Reconsideração à CGPC em **30 dias** contados do dia seguinte ao recebimento | P424, art. 84, §5º | alta |

---

## 8. Divulgação e marcas: PDLIE 2026 e manuais do defeso

### 8.1 Normas

| Regra | Fonte | Confiança |
|---|---|---|
| Divulgação com o apoio institucional e a **Bandeira Nacional** (Lei 5.700/1971) | LC art. 18. Dec art. 38. P10 art. 90 §1º. | alta |
| **PDLIE** é o plano assinado pelo responsável legal. Compromete a entidade a aplicar o **selo LIE** e as marcas do **MESP** e do **Governo Federal** em **todas** as peças, com tamanho, duração, formato, posição, quantidade e local. | P10, art. 90, I | alta |
| O PDLIE entra na ATO. Precisa estar **aprovado pela ASCOM** antes do Termo de Compromisso; sem ele, o Termo não é assinado. | P10 art. 35 I e art. 91 §4º | alta |
| Exposição do selo e da marca do Governo Federal **equivalente à do maior patrocinador** | P10, art. 90, §2º | alta |
| **Para cada inserção** de nome, marca ou produto de patrocinador, inserir o selo LIE e as marcas do MESP e do Governo Federal, **com igual exposição**. Vale para qualquer forma de divulgação. | P10, art. 92 | alta |
| Proibido distorcer marcas, alterar cores ou posições e desobedecer a proporção | P10, art. 93 | alta |
| Nome do patrocinador no **título** do projeto: permitido, desde que o MESP apareça como apresentador em todos os meios. **Não** vale para doador. | P10, art. 12 | alta |
| Comprovação: fotos, filmagens, gravações, peças de mídia | P10, art. 94 | alta |
| Proibido comprar espaço publicitário com o recurso | Dec, art. 14 | alta |

### 8.2 Modelo PDLIE 2026

Arquivo `pdlie_mesp-2026-1.docx`, de 17/06/2026. Confiança: alta.

- **Declaração:** o responsável legal (nome, RG, órgão emissor, CPF, entidade) "compromete-se a fazer constar o selo da LIE com a inserção da Bandeira Nacional, e as marcas do Ministério do Esporte e Governo Federal", "em consonância com a **Portaria nº 424/2020 / Portaria nº 10/2026** e o Manual de Divulgação". O modelo cita as duas portarias.
- **Tabela com 4 colunas:**

| Coluna | Instrução |
|---|---|
| **PEÇA DE DIVULGAÇÃO/VEÍCULO** | peça gráfica ou veículo |
| **TAMANHO/DURAÇÃO** | dimensões ou duração da peça audiovisual |
| **FORMATO DAS MARCAS** | formato conforme o Manual de Divulgação |
| **QUANTIDADE** | número de peças |

- **Fechamento:** "Declaro estar ciente das medidas aplicáveis em caso de descumprimento…". Local e data, com "de 2020" esquecido no modelo. Nome e cargo. Assinatura idêntica à do documento apresentado.
- **Instruções:**
  - Depois de finalizadas, as peças vão para aprovação da Diretoria de Comunicação Social pelo e-mail **ascom.pdlie@esporte.gov.br**.
  - **Nomear os anexos conforme a peça**, por exemplo "Placa de Identificação_2x1m" e "Banner_90x120cm".
  - Informar o **nº do processo** e o nome do programa.
  - Na abertura e no encerramento de eventos, usar: "O Governo Federal por meio do Ministério do Esporte apresenta (nome do projeto ou evento)".

### 8.3 Manual de Divulgação da LIE, versão defeso

Arquivo `lie-defeso.pdf`. É o "Manual de Divulgação da Lei de Incentivo ao Esporte – VERSÃO DEFESO", gerado em 07/07/2026, com 22 páginas. Li as imagens das páginas. Confiança: alta para o que está descrito.

- **Selo**: a assinatura institucional da LIE. Usar de preferência na **versão vertical**. Vale também em folhetos, formulários, eventos e publicidade de utilidade pública (p. 4).
- **Área de não interferência**: **2X** em volta do selo, sendo X a largura da letra "L" (p. 5).
- **Tamanho mínimo do selo**: **2,3 cm × 1,6 cm** no impresso; **63 × 45 px** no digital (p. 6).
- **Tipografia**: Open Sans (p. 7).
- **Cores do selo** (p. 8):

| Cor | CMYK | RGB | Pantone |
|---|---|---|---|
| Verde escuro | 80,89 / 35,16 / 93,52 / 27,31 | 51 / 104 / 51 | 7483 C |
| Verde | 73,44 / 3,17 / 63,4 / 0,03 | 54 / 172 / 124 | 2456 C |
| Azul escuro | — | 20 / 89 / 140 | 4152 C |
| Azul | — | 0 / 135 / 195 | 7060 C |
| Ocre | — | 210 / 153 / 41 | 7563 C |
| Amarelo | — | 249 / 199 / 50 | 123 C |
| Laranja | — | 242 / 140 / 31 | 1495 C |
| Laranja claro | — | 240 / 163 / 42 | 2011 C |

- **Usos indevidos**: rotacionar, distorcer, recolorir, aplicar contorno, aplicar transparência ou trocar a fonte (p. 9).
- **Barra de assinatura**: obrigatório aplicar o selo LIE **junto** com as marcas do MESP e do Governo Federal. A altura do selo não pode passar da altura da marca nominativa do Governo Federal, e o alinhamento é centrado. "A marca do Governo Federal nunca deve ser aplicada em tamanho menor que a de outras marcas" (p. 10). **Na versão defeso, a barra mostra: selo LIE | "MINISTÉRIO DO ESPORTE" | Bandeira do Brasil.**
- **Versão vertical**: selo acima e centrado sobre a assinatura do Ministério com a bandeira. A largura do selo não pode passar da largura dessa assinatura (p. 11).
- **Fundos coloridos**: fundo escuro pede o texto em branco; fundo cuja cor coincide com a do selo pede a versão monocromática (pp. 12–13).
- **Expressão obrigatória** em impressos, mídias digitais, rádio e TV, abertura e encerramento: "**O Governo Federal por meio do Ministério do Esporte via Lei de Incentivo ao Esporte apresenta:**" seguida do nome do projeto ou evento, **sempre em primeiro lugar** (p. 14). **[?]** Na versão defeso, essa expressão continua citando o "Governo Federal", o que parece conflitar com a suspensão da marca durante o período eleitoral (ver 8.4).
- **Uniforme**: selo **à frente, no peito, com no mínimo 8 cm de largura**. Assinatura do Ministério com bandeira nas costas, com **no mínimo 20 cm de base**. Em tecido escuro, tipografia branca (p. 15).
- **Short e calça**: mínimo de 8 cm (pp. 16–17).
- **Boné**: mínimo de 5 cm (p. 18).
- **Quadra**: selo em **todas as laterais** da quadra ou do ginásio, em destaque em relação aos patrocinadores (p. 19).
- **Observações gerais** (p. 20): patrocinador no título é permitido se o MESP aparecer em todos os meios; exposição do selo e da marca do Governo Federal equivalente à do maior patrocinador; para cada inserção de patrocinador, selo e marcas com igual exposição.
- **Instruções gerais** (p. 21): layouts aprovados por **ascom.pdlie@esporte.gov.br**, enviados **em PDF ou JPG** e nomeados pela peça, por exemplo "Placa de Indentificação_2x1m" (grafia do original), "Banner_90x120cm" e "Uniforme_blusa".

### 8.4 Manual de assinatura no período eleitoral (SICOM)

Arquivo `manual-de-marca-mesp-defeso.pdf`, "Manual de assinatura de órgão e/ou entidade do SICOM no período eleitoral", junho de 2026, 17 páginas. Confiança: alta.

- "Durante o período eleitoral, **fica suspensa toda e qualquer forma de divulgação da marca do Governo Federal**, na publicidade, em qualquer ação de comunicação ou em qualquer suporte". Vale para a marca vigente ou anterior, conforme a **IN SECOM/PR nº 12, de 22/06/2026**. Não localizei o texto da IN no DOU. A grafia "não poderá ter vinculação com a atual gestão" (p. 2).
- **Período**: **de 04/07/2026 até o 1º turno (04/10/2026)**. Havendo 2º turno, vai até **25/10/2026** (p. 2). **Em 01/10/2026 o defeso está em curso.**
- **Assinatura**: nome do órgão ("MINISTÉRIO DO ESPORTE") mais a **Bandeira Nacional**, sem slogan.
  - Versão horizontal (preferencial): mínimo de **3,5 cm / 200 px**; em caso excepcional, **2,7 cm / 110 px**.
  - Versão vertical: **1,5 cm / 100 px**.
  - Área de não interferência = altura da palavra do órgão ("x"). Não colocar nenhum nome ou marca abaixo ou ao lado da assinatura. A posição preferencial é o canto inferior direito (pp. 3–6).
- Cores da bandeira: verde Pantone 7739C, amarelo 116C, azul 662C. Versões monocromáticas em preto e branco. Box branco sobre foto. Proibido rotacionar, distorcer, recolorir, usar contorno, marca-d'água, moldura ou desalinhar. Fonte **Rawline**, ou Arial na web (pp. 7–13).
- "É **vedada assinatura de órgãos da administração direta em conjunto com a assinatura do Governo Federal**" (p. 14).
- **Para o software**: peças produzidas e veiculadas entre 04/07 e 04/10 (ou 25/10) seguem o layout defeso, **sem marca do Governo Federal**. Na PCF, a comprovação do PDLIE de peças desse período **não deve ser apontada como falta da marca do Governo Federal**. **[?]** Nenhuma norma da DPPIE trata expressamente da análise de PDLIE no defeso; isso é inferência dos dois manuais.

---

## 9. Checagens automatizáveis

Entre colchetes, a fonte de cada checagem. "Regime" indica quando a regra muda entre P424 e P10.

### Regime e prazos

1. Atribuir o regime do projeto: `P424` se o protocolo no SLI foi antes de 04/03/2026; senão, `P10`. Aplicar as regras da tabela 1.2. [P10 arts. 102–104]
2. Calcular o prazo da PCF como **fim da vigência do Termo ou do último Aditivo + 60 dias corridos**, prorrogando para o próximo dia útil. Alertar em 30, 15 e 5 dias. [P10 arts. 67 e 99. Dec art. 33]
3. Se a liberação for parcelada, exigir PCP antes de cada nova parcela. [P10 art. 65 §2º]
4. Prorrogação: pedido até 30 dias antes do fim do Termo; no máximo 2 prorrogações; Aditivo assinado antes do vencimento. [P10 art. 56]
5. Readequação: no máximo 1; pedido até 90 dias antes do fim (P10) ou 60 dias (P424, segundo o tutorial [?]). [P10 art. 53 §1º. Tutorial 2023]
6. Diligência recebida: contar 30 dias corridos improrrogáveis e exigir confirmação do e-mail em 1 dia útil. [P10 art. 68 §§3º–4º]
7. Prazos de recurso: 5 dias para reconsideração e depois 10 para recurso administrativo (P10); 30 dias (P424). [P10 arts. 71 e 80. P424 art. 84 §5º]
8. Saldo remanescente: pedido de transferência em até 60 dias do fim da execução (P10) ou 120 dias (P424). Senão, GRU. [P10 art. 57 §2º. P424 art. 60 §2º]

### Contas e fluxo financeiro

9. Toda receita incentivada precisa ter entrado na conta **CAPTAÇÃO** do projeto (BB ou CAIXA), com CPF/CNPJ do depositante e **recibo SLI** correspondente. [LC art. 11. P10 arts. 20 §§2º e 10, e 27]
10. Total captado ≤ valor autorizado (portaria ou extrato do DOU). [LC art. 10 p.ú. P10 art. 22 §2º]
11. Nenhum débito na MOVIMENTO **antes** da assinatura do Termo nem **depois** do fim da vigência. Se houver, calcular ressarcimento mais 5%. [Dec art. 29 §3º. P10 arts. 40 e 80 §7º]
12. Nenhum **saque em dinheiro** no extrato. [P10 art. 38]
13. Cada débito na MOVIMENTO casa com um pagamento da aba PAGAMENTOS e com um comprovante. Conciliação 1:1 por valor e data. [P10 art. 39]
14. Saldo parado na conta sem aplicação: estimar os rendimentos que deixaram de ser obtidos e alertar que precisam ser repostos. [P10 art. 28 §§1º e 5º]
15. Rendimentos de aplicação **não** somam ao "valor captado". Na RECEITA E DESPESA entram como linhas próprias, **por mês**. [P10 art. 28 §3º. Form RECEITA E DESPESA, instrução 5]
16. Uso de rendimento em uma ação exige pedido aprovado (art. 55) e justificativa no RCO. Sob a P424, bloquear o uso de rendimento em despesa administrativa, elaboração/captação ou pessoal sem autorização. [P10 arts. 28 §2º e 55. P424 art. 29 §3º]
17. Depósito equivocado: alertar sobre o prazo de 60 dias para estorno ou correção. [P10 arts. 23 e 25]

### Orçamento

18. Atividade-meio: **meio/fim ≤ 15%** (fórmula dos modelos). Mostrar também meio/total. Aplicar a regra antes e depois de cada remanejamento. [Dec art. 12. Planilha Orçamentária H64. P10 art. 52 §5º]
19. Elaboração e captação ≤ 10% (formação), 7% (toda a vida), 5% (excelência) ou 15% (projeto integralmente em N/NE/CO) de (fim + meio), e ≤ R$ 100.000. Fica fora dos 15% de meio. Na P424, a base é só o captado, sem rendimentos. [P10 art. 26. P424 art. 26 §1º]
20. Cada item tem quantidade × duração × unitário. Proibido "valor fechado". [P10 art. 7º V. Planilha Orçamentária, coluna H]
21. Encargos em item próprio; salário marcado como bruto ou líquido; sem encargo que não tenha sido autorizado. [P10 arts. 7º IX e 44 §§2º–3º]
22. Remanejamento: contar os pedidos (≤ 2); só itens existentes; o 2º só dispensa aprovação se ≤ 20% e sem ultrapassar o total da ATO, com comunicação em 5 dias; proibido mudar o percentual de encargos. Na P10, tratar o **1º** como sujeito a aprovação prévia: é leitura de "somente no segundo remanejamento sem a necessidade de prévia anuência" (confiança média). Na P424, qualquer um dos dois pode ser feito direto até 20%. [P10 art. 52. P424 art. 57]
23. Item com valor unitário maior que o aprovado: exigir 3 orçamentos. [P10 art. 46 §3º. Tutorial]
24. Pagamento por item ≤ valor aprovado do item/ação. Se passar, pedir remanejamento. [P10 art. 46]
25. Lista de bloqueio de despesas vedadas: taxa de administração; agente público; clube de servidores; vantagem ao patrocinador; membro da entidade sem função aprovada; imóvel; atleta profissional; equipe ou competição profissional; espaço publicitário; cobrança de beneficiário. [P10 arts. 58–59. Dec arts. 6º, 14 e 16]
26. Credor com CNPJ ou CPF ligado ao incentivador (sócio, parente até 3º grau, coligada): alerta. [LC art. 5º. Dec art. 2º §§5º–6º]
27. Subcontratação só de atividade acessória prevista no PT; nunca gestão ou coordenação. [Dec art. 13 §3º]

### Documentos

28. Comprovante em nome do proponente (CNPJ do proponente). [P10 art. 41]
29. **Nº SLI** presente em todo comprovante, com carimbo na frente: "Nº SLIE/SLI ___ / MINISTÉRIO DO ESPORTE / SECRETARIA EXECUTIVA / LEI 11.438/2006". [P10 art. 41 §1º. Modelo de carimbos]
30. **Atesto de recebimento no verso** ("ATESTO QUE O SERVIÇO FOI RECEBIDO EM: dd/mm/aaaa + assinatura"), com data dentro da vigência e não anterior à emissão. [Modelo de carimbos. P10 art. 49 III]
31. NF discriminada, isto é, sem descrição genérica, guardada frente e verso. [P10 art. 78]
32. Diárias: recibo assinado pelo usuário, com identificação e CPF. Uma planilha DIÁRIAS por evento, com `K = G + H×I + J`. [P10 art. 41 §2º. Form DIÁRIAS]
33. Pagamento a pessoa física (RPA ou recibo): verificar retenção e recolhimento de IR, INSS e ISS. [P10 art. 76. Form PAGAMENTOS, instrução 5]
34. Processo de compra completo: cotação ou justificativa; justificativa da escolha; comprovante de recebimento; documento contábil. Contrato de serviço com as 8 cláusulas mínimas. [P10 arts. 49–50]
35. Arquivos em PDF pesquisável com OCR, ≤ 25 MB, assinatura manual ou digital válida. [P10 arts. 5º, 6º §§3º–4º e 16 §5º]
36. Projeto de excelência: CRC válida em toda a vigência. Se vencer, bloquear pagamentos. [P10 art. 31]
37. Guardar os originais por 10 anos após a avaliação da PCF. Tarefa de retenção. [P10 arts. 46 §1º, 69 e 77]

### Formulário e consistência entre abas

38. Totais: `RECEITA E DESPESA.C31 = Σ receitas`; `E31 = Σ despesas`; `E33 = C31 − E31`. Na PCF, se E33 > 0, exigir comprovante de GRU ou de transferência. [Form. P10 art. 68 VII]
39. `Σ PAGAMENTOS.H` = débitos da MOVIMENTO no período = `EXECUTADO.H32 + I32`. [Form. P10 art. 39] [?] A equivalência exata entre abas é inferência.
40. Na aba EXECUTADO, o campo 03 (A5:B5, valor captado) = Σ dos recibos SLI, e o campo 04 (C5:D5, rendimentos) = Σ dos rendimentos nos extratos. No modelo, os valores são digitados dentro da própria célula mesclada do rótulo. [Form. P10 arts. 27–28]
41. Ações de EXECUTADO, PAGAMENTOS, BENS e A EXECUTAR usam a **numeração do Plano de Trabalho**. Atividade-meio com prefixo "M" na planilha de remanejamento. [Form, instruções. Planilha de remanejamento]
42. A EXECUTAR (só na PCP): `L{ação} = Σ meses`; total geral = fim + meio + elaboração; acumulado ≤ valor aprovado. [Form A EXECUTAR]
43. RECURSOS HUMANOS: período de contratação dentro da vigência; PJ com CNPJ; pessoas coerentes com a GRADE HORÁRIA DE RH e com a planilha orçamentária. [Form RH, instruções. P10 art. 45]
44. BENEFICIADOS: total feminino + masculino = nº de beneficiados listados. Na formação esportiva regular, **≥ 50% de alunos da rede pública**. O formulário não tem esse campo; o software precisa de um campo interno. [Form BENEFICIADOS. Dec art. 18]
45. Marcador PARCIAL/FINAL coerente em todas as abas que o têm. Aba A EXECUTAR só na PCP. [Form]
46. Sinalizar os defeitos conhecidos do modelo: rótulo "8 – TOTAL" duplicado; numeração de DIÁRIAS pulando o 16; `SUMIF(#REF!)` na planilha de remanejamento; sinal invertido no rótulo do valor remanejado. [Form. Planilha de remanejamento]

### Objeto, metas e divulgação

47. RCO: cada meta aprovada tem indicador, instrumento de verificação, valor alcançado e **% de atingimento**. Metas não podem diferir das aprovadas na ATO. [Modelo RCO 2026]
48. RCO, seção "Aplicação financeira": tabela ação × valor × justificativa, somando o rendimento usado. [Modelo RCO. P10 art. 28 §2º]
49. Fotos de acessibilidade presentes na PCF (P10). Ações de acessibilidade para idosos e pessoas com deficiência descritas. [P10 arts. 11 e 68 XV. Dec art. 17]
50. PDLIE aprovado pela ASCOM antes do Termo. Cada peça do PDLIE (peça, tamanho, formato, quantidade) tem prova de execução: foto, vídeo ou arquivo. [P10 arts. 35 I, 90 e 94. Modelo PDLIE]
51. Em cada peça: selo LIE e marcas com **exposição ≥ à do maior patrocinador**; selo ≥ 2,3 × 1,6 cm (63 × 45 px); uniforme com selo ≥ 8 cm e assinatura ≥ 20 cm; boné ≥ 5 cm; expressão "O Governo Federal por meio do Ministério do Esporte via Lei de Incentivo ao Esporte apresenta:" em primeiro lugar. [P10 arts. 90 §2º e 92. Manual defeso pp. 6, 14–18]
52. Peça veiculada entre 04/07/2026 e 04/10/2026 (ou 25/10/2026): exigir o layout **defeso**, com "MINISTÉRIO DO ESPORTE" + bandeira e sem marca do Governo Federal. [Manual SICOM p. 2. Manual LIE defeso] [?]
53. Nenhuma despesa de compra de espaço publicitário. [Dec art. 14]

---

## 10. Modelos da página "Modelos e Manuais" (uma linha cada)

Todos baixados da página oficial. A seção indica onde o arquivo aparece na página oficial.

**Seção 1 — Admissibilidade**

- **Declaração de Inexistência de Sobreposição de Recursos Financeiros** (`declaracao-de-inexistencia-de-sobreposicao-financeira.doc`): o representante declara não ter sobreposição com outras fontes.
- **Declaração de Não Enquadramento nas Vedações – P10** (`declaracoes-das-vedacoes_.docx`): reproduz os arts. 32, 58 e 59 da P10.
- **Declaração de Autenticidade de Documentos** (`declaraodeautenticidadedocumentos…2023.doc`): dispensa autenticação com base na Lei 13.726/2018.
- **Tabela de preços SINAPI para obras** (`.docx`): só para projetos até 2025, porque obra deixou de existir.
- **Modelo de Termo de Parceria** (`modelo__termo_de__parceria.doc`): comprova capacidade técnico-operativa. Também é o Anexo II da P10.
- **Orçamento Bolsa Auxílio** (`orcamento-bolsa-auxilio.docx`): cita a Portaria 441/2020.
- **Orçamento Encargos Trabalhistas** (`orcamento-encargos-trabalhistas.docx`): declaração de que os encargos estão no PT.
- **Tabelas de Referência** (`tabelasdereferncia.zip`, de 2020): diárias e tetos de RH por manifestação, mais planilha de precificação.
- **Declaração de Necessidade de Utilização de Recursos 2026** (`…-2026-1-1.doc`): cita o Dec 12.861, art. 25, II.

**Seção 2 — Divulgação**

- **Manual da marca** (`manual-de-marca-mesp-defeso.pdf`): assinatura SICOM no período eleitoral.
- **Manual de Divulgação da LIE** (`lie-defeso.pdf`): versão defeso.
- Orientações do PDLIE: **indisponível**, a página responde "unauthorized".

**Seção 3 — Recibos**

- **Modelo de recibo** (`2023modelorecibo.doc`): comunicado de recibo de doação ou patrocínio, campos 01–35.

**Seção 6 — Análise Técnica e Orçamentária**

- **Planilha de Ajuste Simples** (`copy_of_1planilha_ajuste_simples.xls`): aprovado × captado × rendimentos, com justificativa, 15% de meio e 10% de elaboração.
- **Planilha de Ajuste Parcelado** (`copy_of_2planilha_ajuste_parcelado.xls`): até 4 parcelas mais aplicação financeira mais consolidado. Bloqueia total > aprovado com `IF(...>H,FALSE)`.
- **Planilha Orçamentária** (`copy_of_4planilha_orcamentaria.xls` e `copy2_of_3…`): ver 3.1.
- **Descrição do Plano de Trabalho** (`copy3_of_4…doc` e `copy_of_3…doc`): identificação, período, público, metodologia e metas com indicadores e instrumentos. Ainda cita o Dec 6.180.
- **Grade horária de Recursos Humanos** (`copy2_of_6…xls`): ver 5.4.
- **Cronograma de execução** (`copy2_of_5cronograma_de_execucao.xls`): atividades × meses 1–13.
- **Atividades programadas – grade e eventos** (`copy_of_7…xls` e `copy_of_3…-1.xls`): abas GRADE e EVENTOS, iguais às do Form.

**Declarações de projetos sob a P424**

- **Cessão de Espaço Físico**: autorização de uso do local, com dias, horários e período.
- **Sobreposição Financeira**.
- **Vínculo Profissional 2026**: não há atleta com contrato especial de trabalho desportivo. Cita a LC 222, art. 6º §2º.
- **Manutenção de Equipes 2026**: recursos não usados com equipes ou competições profissionais. Cita o Dec, art. 6º.
- **Não Enquadramento nas Vedações – P424**: arts. 37, 61 e 62.
- **Não possui capacidade de atrair investimentos**: cita o Dec 6.180, art. 24, II, que foi revogado.

**Seção 7 — Execução**

- **Cronograma Físico-Financeiro mês a mês** (`copy_of_1cronograma_fisico_financeiro_mes_a_mes-1.xls`): fim e meio × 14 meses, mais elaboração.
- **Atividades programadas**.
- **Cessão de espaço**.
- **PDLIE** (`pdlie_mesp-2026-1.docx`).
- Formulário de Solicitação de Alteração: página "em manutenção".

**Seção 7.4 — Prestação de Contas Parcial**

- **Formulários** (`formulariopcppcfatualizado2026-1.xls`).
- **Modelo RCO** (`modelorcoatualizado2026-1.docx`).

**Seção 7.5 — Remanejamento e Readequação**

- **Tutorial** (`tutorial_remanejamentoereadequacao2023.doc`).
- **Planilha de Remanejamento** (`copy_of_2planilharemanejamento…xls`).
- Descrição do Plano de Trabalho.
- Planilha Orçamentária.

**Seção 8 — Prestação de Contas Final**

- **Formulários**: versão 2026 e versão anterior `copy_of_formulariopcppcfatualizado.xls`.
- **Modelos de carimbos** (`modelo_carimbos2023.doc`).
- **Modelo RCO**: 2026 e `modelorco2023_esporte.docx`.
- **Orientações para recolhimento ao Tesouro** (PDF).

**Seção 9 — Selo LIE**

- **Formulário de inscrição ao selo** (`formulriodeinscrioaoselodaleideincentivoaoesporte.docx`): reconhecimento de entidade, projeto ou patrocinador. Não tem a ver com PC.

---

## 11. Inconsistências nos documentos oficiais (para tratar no produto)

1. **Os modelos ainda citam o regime antigo.** O RCO 2026 cita a P424 (arts. 69/72, 29 §2º, 94–98) e o Dec 6.180. O carimbo cita a Lei 11.438. O PDLIE cita a P424 e a P10. A página "Modelos e Manuais" ainda diz que a LIE é "regida pela Portaria nº 424/2020". Na prática, os mesmos modelos atendem os dois regimes.
2. **Denominador dos 15%.** O Dec fala em "orçamento total"; os modelos calculam meio ÷ fim.
3. **GRU**: a UG da instrução (180076) é diferente da UG do exemplo (180002). O link do Tesouro está fora do ar. O e-mail ainda é do Ministério da Cidadania.
4. **Formulário PCP/PCF**:
   - "8 – TOTAL" aparece duas vezes.
   - EXECUTADO não tem fórmula na coluna J; os campos 13 e 14 trazem texto de convênio.
   - PAGAMENTOS: o cabeçalho "AÇÃO" diverge da instrução "ITEM", e a coluna "CHEQUE" é legado.
   - BENEFICIADOS pede "RG do contratado", mas não tem coluna de RG.
   - DIÁRIAS pula o nº 16 e não tem coluna de data.
   - A EXECUTAR só tem 8 meses e vem com valores de exemplo.
5. **Planilha de remanejamento**: `SUMIF(#REF!)` quebrado e rótulo com sinal invertido em relação à fórmula.
6. **P10, art. 68, VII** remete ao "art. 56", mas o artigo certo é o 57. A **P10, art. 68, I** fala em "relatório de cumprimento **parcial** do objeto" também na PCF; parece cópia do art. 65.
7. **Defeso**: o manual LIE defeso tira a marca do Governo Federal das assinaturas, mas mantém a expressão "O Governo Federal por meio do Ministério do Esporte…" e menções à "marca do Governo Federal" nas pp. 14 e 20.

---

## Fontes

**Normas (texto integral lido)**

- LC 222/2025, Planalto: https://www.planalto.gov.br/ccivil_03/leis/lcp/Lcp222.htm
- Decreto 12.861/2026:
  - Câmara (publicação original, DOU 02/03/2026, Seção 1, p. 1): https://www2.camara.leg.br/legin/fed/decret/2026/decreto-12861-27-fevereiro-2026-798764-publicacaooriginal-178268-pe.html
  - Planalto: https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/D12861.htm
  - Locais: `decreto12861-camara.html` e `decreto12861-planalto.htm`
- Portaria MESP 10/2026, DOU 04/03/2026, Seção 1, p. 39: https://www.in.gov.br/web/dou/-/portaria-mesp-n-10-de-3-de-marco-de-2026-690209578
- Portaria 424/2020, DOU 23/06/2020: https://www.in.gov.br/web/dou/-/portaria-n-424-de-22-de-junho-de-2020-262970445
- Alterações da P424, todas no DOU:
  - Portaria 454/2020: https://www.in.gov.br/web/dou/-/portaria-n-454-de-5-de-agosto-de-2020-271231841
  - Portaria 62/2023: https://www.in.gov.br/web/dou/-/portaria-n-62-de-18-de-setembro-de-2023-510533589
  - Portaria 82/2023: https://www.in.gov.br/web/dou/-/portaria-n-82-de-21-de-novembro-de-2023-524556860
  - Portaria 2/2024: https://www.in.gov.br/web/dou/-/portaria-n-2-de-8-de-janeiro-de-2024-536542844
  - Portaria MESP 84/2024: https://www.in.gov.br/web/dou/-/portaria-mesp-n-84-de-9-de-setembro-de-2024-583471698
  - Portaria MESP 33/2025: https://www.in.gov.br/web/dou/-/portaria-mesp-n-33-de-10-de-abril-de-2025-623708571
- Portaria 37/2026 (Regimento CTLIE): https://www.in.gov.br/web/dou/-/portaria-n-37-de-13-de-abril-de-2026-699555096
- Portaria MESP 39/2026: https://www.in.gov.br/web/dou/-/portaria-mesp-n-39-de-22-de-abril-de-2026-701119147
- Portaria MESP 51/2026: https://www.in.gov.br/web/dou/-/portaria-mesp-n-51-de-20-de-maio-de-2026-706956020
- Decreto 13.105/2026: https://www.in.gov.br/web/dou/-/decreto-n-13.105-de-24-de-agosto-de-2026-727763261
- Busca no DOU (in.gov.br/consulta) sem alteração da P10 até 01/10/2026: https://www.in.gov.br/consulta/-/buscar/dou

**Página e arquivos oficiais do MESP**

- Página "Modelos e Manuais": https://www.gov.br/esporte/pt-br/acoes-e-programas-1/lei-de-incentivo-ao-esporte/modelos-e-manuais-3
- Arquivos: base `https://www.gov.br/esporte/pt-br/acoes-e-programas-1/lei-de-incentivo-ao-esporte/modelos-e-manuais-3/<arquivo>/@@download/file` (ou `@@display-file/file` para os PDFs):
  - `formulariopcppcfatualizado2026-1.xls`
  - `copy_of_formulariopcppcfatualizado.xls`
  - `modelorcoatualizado2026-1.docx`
  - `modelorco2023_esporte.docx`
  - `modelo_carimbos2023.doc`
  - `orientacoes-para-recolhimento-de-valores-ao-tesouro-nacional.pdf`
  - `tutorial_remanejamentoereadequacao2023.doc`
  - `copy_of_2planilharemanejamentoderecursosreadequacaodopt.xls`
  - `copy_of_4planilha_orcamentaria.xls`
  - `copy2_of_3planilha_orcamentaria.xls`
  - `copy_of_1planilha_ajuste_simples.xls`
  - `copy_of_2planilha_ajuste_parcelado.xls`
  - `pdlie_mesp-2026-1.docx`
  - `manual-de-marca-mesp-defeso.pdf`
  - `lie-defeso.pdf`
  - `2023modelorecibo.doc`
  - `copy2_of_6grade_horaria_recursos_humanos.xls`
  - `copy2_of_5cronograma_de_execucao.xls`
  - `copy_of_7grade_de_atividades_programadas.xls`
  - `copy_of_3grade_de_atividades_programadas-1.xls`
  - `copy_of_1cronograma_fisico_financeiro_mes_a_mes-1.xls`
  - `copy3_of_4descricao_do_plano_de_trabalho.doc`
  - `copy_of_3descricao_do_plano_de_trabalho.doc`
  - todas as declarações da seção 10
  - `tabelasdereferncia.zip`
  - `formulriodeinscrioaoselodaleideincentivoaoesporte.docx`
- Indisponíveis em 01/10/2026:
  - https://www.gov.br/esporte/pt-br/acoes-e-programas/lei-de-incentivo-ao-esporte/orientacoes-pdlie.pdf ("unauthorized")
  - https://www.gov.br/esporte/pt-br/acoes-e-programas/lei-de-incentivo-ao-esporte/formulario-de-solicitacao-de-alteracao-no-projeto-em-fase-de-execucao ("em manutenção")
  - https://www.gov.br/esporte/pt-br/noticias-e-conteudos/esporte/ministerio-do-esporte-atualiza-regras-da-lei-de-incentivo-e-fortalece-projetos-sociais ("unauthorized", provavelmente por causa do defeso)

**Transferegov e Tesouro**

- Transferegov, LIE (fluxos 01–10): https://www.gov.br/transferegov/pt-br/sobre/internalizados/parcerias/lei-incentivo-esporte
- Imagens dos fluxos: `…/arquivos/lei-de-incentivo-ao-esporte-lie/08lie_prestaodecontasparcial/@@images/image` e `…/09lie_prestaodecontasfinal/@@images/image` (locais: `tg-08…png` e `tg-09…png`)
- Instrumentos internalizados (lista de ACTs, sem o MESP): https://www.gov.br/transferegov/pt-br/sobre/internalizados
- PagTesouro, portal GRU: https://pagtesouro.tesouro.gov.br/portal-gru/
- Link antigo da GRU, fora do ar: https://consulta.tesouro.fazenda.gov.br/gru/gru_simples.asp

**Usadas só para localizar links (não serviram de fonte de regra)**: buscas WebSearch que apontaram para gov.br/secom, legisweb, modeloinicial, rsp.esp.br e gnpazinato.com.br.
