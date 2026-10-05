# Prestação de contas de projetos incentivados: materiais de referência e dados abertos

Módulo de **Prestação de Contas** do Jards, que atende proponentes e consultorias de captação.
Mecanismos cobertos: Rouanet, ANCINE, LIE, PRONON/PRONAS, PNAB e MROSC.

Pesquisa e testes feitos em **01/10/2026**.

---

## 0. Como ler este documento

### Método

- As normas e os manuais foram lidos no texto integral sempre que possível. Isso inclui Planalto, TCU, CFC, eCFR, EU e GOV.UK.
- Quando não houve acesso direto, usei resumos do buscador. Esses itens aparecem marcados com **[busca]**.
- As APIs foram **testadas com `curl`** a partir deste ambiente. Os trechos de resposta reproduzidos são reais.

### Marcadores

| Marcador | Significado |
|---|---|
| **[busca]** | Conteúdo confirmado só por resumo do buscador. A página não foi aberta. |
| **[inferência]** | Conclusão minha a partir dos dados. Não está escrita na fonte. |
| **[verificar]** | Ponto plausível que não consegui confirmar. |

### Limitações do ambiente

Estes pontos explicam por que alguns itens não foram testados.

**Bloqueios de rede e de WAF**
- O WebFetch estava bloqueado.
- Algumas páginas do gov.br exigem autenticação ou caem em WAF a partir deste IP:
  - gov.br/cultura, notícias da CGU e o PDF do Manual MROSC devolvem 401 ou "autenticar";
  - portaldatransparencia.gov.br e bb.com.br caem em captcha ou WAF.
- O servidor de arquivos de CNPJ da Receita (`arquivos.receitafederal.gov.br`) e os portais do BB Developers e da Caixa Developers estavam inacessíveis.
- As APIs do ADN da NFS-e recusam a conexão TLS. **[inferência]** Elas exigem certificado de cliente (mTLS).

**Testes que dependem de chave ou certificado**
- A API do Portal da Transparência foi testada **sem chave** e devolveu 401, como esperado.
- As APIs que exigem certificado ICP-Brasil ou contrato bancário não puderam ser chamadas: NF-e DistDFe, ADN NFS-e e BB Extratos.

---

## 1. Resumo executivo

### 1.1 Os 5 materiais mais úteis para o produto

1. **Portaria Conjunta MGI/CGU nº 41/2023**, regulamentação da "análise informatizada" do Transferegov.
   - Define as faixas de valor (até R$ 750 mil; de R$ 750 mil a R$ 5 mi).
   - Define a "nota de risco" de 0 a 1, que vem de um modelo preditivo da CGU.
   - Define as "trilhas de auditoria" e os tetos de tolerância (0,9 e 0,7).
   - É o **modelo oficial** de prestação de contas baseada em risco. O Jards pode imitá-lo do lado do proponente ("pré-malha fina").
2. **TCU, Acórdão 726/2026-Plenário** (passivo de prestação de contas do MinC e da ANCINE).
   - O passivo soma cerca de 30 mil processos e mais de R$ 22 bi.
   - Há prescrições e falta controle de marcos prescricionais.
   - 95,21% das contas foram aprovadas sem verificação financeira detalhada [busca].
   - A ANCINE leva 1.168 dias, quando o prazo é de 180.
   - O acórdão justifica funcionalidades de **linha do tempo de prazos e prescrição** e de **dossiê pronto para auditoria tardia**.
3. **Lei 14.903/2024, arts. 18 a 21, e Decreto 11.453/2023, arts. 29 a 32 e 51.**
   - Estabelecem a prestação de contas **por objeto**. O relatório financeiro só é exigido por exceção.
   - Projetos de até R$ 200 mil podem ter verificação in loco.
   - O art. 51 do decreto cria a **matriz de risco da Rouanet**: pequeno, médio e grande porte.
   - Isso define **qual dossiê** o Jards monta para cada projeto.
4. **Decreto 8.726/2016 (MROSC), com a redação do Decreto 11.948/2024, arts. 54 a 58.**
   - O relatório de execução do objeto traz metas, ações, evidências (listas, fotos, vídeos) e satisfação do público.
   - O relatório financeiro só é exigido se houver meta não cumprida ou indício de irregularidade.
   - A análise financeira é uma **conciliação bancária**: relação de pagamentos contra débitos da conta específica.
   - O rateio deve ter memória de cálculo e é **vedada a duplicidade de fontes**.
   - A guarda dos documentos é de 10 anos.
   - É o **esqueleto de dados** do módulo.
5. **Manuais operacionais com roteiros de análise**. Estes viram checagens automáticas quase literais.
   - MinC, *Manual do Proponente – Módulo III – Avaliação de Resultados* (IN MinC 29/2026).
   - ANCINE, *Manual de Prestação de Contas* v2.11 (set/2026).
   - FNS, *Manual de orientações para análise contábil-financeira do PRONON/PRONAS*.
   - TCU, cartilha *Convênios e outros repasses* (listas de "irregularidades mais frequentes").

### 1.2 APIs que funcionam e o que dá para automatizar

**Funcionam sem chave (testadas em 01/10/2026)**

| Fonte | O que entrega | O que dá para automatizar |
|---|---|---|
| **API Salic** (`api.salic.cultura.gov.br/api/v1`) | O detalhe de cada PRONAC: **captações** (doador, valor, data), **relação de pagamentos** (fornecedor, CNPJ/CPF, nº do comprovante, data, valor, rubrica), execução física por item (`relatorio_fisco`), readequações, prorrogações, certidões e marcas. | Importação e conciliação dos projetos Rouanet do cliente. |
| **Transferegov, nova API "Gestão de Parcerias"** (`api-publica.transferegov.gestao.gov.br/parcerias`) | Projetos **PRONON/PRONAS**: propostas, metas, itens, parcerias, contas BB (captação e movimento) e **linhas de extrato bancário** com CNPJ do depositante e do beneficiário. | Extrato e conciliação de PRONON/PRONAS **sem integração bancária**. |
| **ANCINE** (CSVs diários em `dados.ancine.gov.br/dados-abertos/`) | Projetos com renúncia, captação por artigo e situação (inclusive "PC FINAL – Aprovada com ressalvas" e "TCE instaurada"); processos em prestação de contas. | Monitoramento de situação dos projetos audiovisuais. |
| **TCU Certidões APF** | Uma chamada por CNPJ devolve CEIS, CNEP, CNIA (CNJ) e Inidôneos (TCU). | **Due diligence de fornecedor e de proponente.** |
| **CGU, downloads diários** | CEIS, CNEP e **CEPIM**, este último das entidades impedidas. | Mesma due diligence, em lote. |
| **CNPJ** (BrasilAPI, Minha Receita, CNPJá open, CNPJ.ws, ReceitaWS) e **IBGE CNAE** | Situação cadastral, CNAE principal e secundários, Simples, QSA. | Checar compatibilidade entre o CNAE do fornecedor e a rubrica, CNPJ inapto e vínculo societário. |
| **BCB SGS/PTAX** e **BrasilAPI feriados** | IPCA, Selic, **Taxa Legal (SGS 29543)**, poupança e câmbio; feriados. | Correção de débitos e devoluções (Lei 14.903, art. 21 § 6º; CC art. 406). Câmbio de invoices. Prazos em dias úteis. |

**Exigem credencial ou contrato (não testadas)**

| Fonte | Requisito |
|---|---|
| Portal da Transparência | Chave gratuita. |
| BB API Extratos | Contrato PJ, Portal Developers e certificado. |
| Open Finance | Só instituições autorizadas. Na prática, exige um agregador. |
| NF-e Distribuição DF-e e ADN NFS-e | Certificado ICP-Brasil do proponente. |

### 1.3 O que dá para automatizar já

1. Importar o PRONAC e montar automaticamente o "esqueleto" da prestação de contas: rubricas aprovadas, pagamentos lançados e captações.
2. Conciliar pagamentos com o extrato. É automática no PRONON/PRONAS via Transferegov. Na Rouanet e na LIE depende de OFX, CNAB ou API do BB.
3. Checar cada fornecedor: CNPJ ativo, CNAE compatível, sanções (CEIS, CNEP, CEPIM, TCU) e sócio em comum com o proponente.
4. Validar a chave de NF-e (44 dígitos) e de NFS-e (50 posições) offline. A validação confere DV, CNPJ do emitente e AAMM dentro da vigência.
5. Calcular correção e juros de devoluções.
6. Monitorar mudanças de situação: Salic, ANCINE e Transferegov.

**Ponto de atenção:** desde julho de 2026 existe **CNPJ alfanumérico**. Todo validador de CNPJ e de chave de documento fiscal precisa suportá-lo.

---

# PARTE A — Materiais de referência

Formato de cada item:
- **Título**, autor ou órgão, ano e link.
- O que ensina.
- **Por que importa para o Jards**: qual funcionalidade ou regra ele informa.

## A1. Prestação de contas de recursos públicos: TCU, CGU e Transferegov

### A1.1 TCU, Acórdão 726/2026-Plenário: passivo de prestações de contas na Cultura (MinC e ANCINE)

- **Dados:** TC 014.873/2025-7, sessão de 25/03/2026, relator min. Augusto Nardes.
- **Links:**
  - notícia oficial: https://portal.tcu.gov.br/imprensa/noticias/tribunal-aponta-falhas-em-prestacoes-de-contas-na-area-da-cultura
  - inteiro teor, padrão de URL [verificar]: https://pesquisa.apps.tcu.gov.br/doc/acordao-completo/726/2026/Plen%C3%A1rio

**O que ensina**
- O MinC não tem mecanismo para monitorar prazos prescricionais. Já houve prescrições.
- Faltam normas com prazo para analisar contas e instaurar TCE.
- As regras de análise financeira foram enfraquecidas.
- A ANCINE leva **1.168 dias** para analisar uma prestação de contas, contra o prazo de 180.
- Determinações:
  - em 120 dias, controle de prazos prescricionais com marcos interruptivos e alertas;
  - em 60 dias, priorizar processos com risco de prescrição nos próximos 12 meses.
- A imprensa e o relatório técnico de nov/2025 citam:
  - cerca de 30 mil processos e mais de R$ 22 bi;
  - cerca de 1,3 mil projetos já prescritos;
  - 95,21% das contas aprovadas sem verificação financeira detalhada [busca].

**Por que importa**
- O proponente pode ser cobrado **anos depois**. Por isso o produto precisa:
  - guardar o dossiê de forma imutável e versionada;
  - registrar marcos (envio, diligências, respostas);
  - calcular janelas de prescrição;
  - avisar quando o ministério "acordar" um processo antigo.
- A determinação de priorizar processos com risco de prescrição indica que **diligências de projetos antigos vão aumentar em 2026–2027**. É uma oportunidade de produto: recuperação de dossiês antigos via API do Salic.

### A1.2 TCU, Acórdão 2089/2025-Plenário: metodologia de indicadores para prestação de contas de transferências discricionárias

- **Dados:** TC 003.559/2025-4, sessão de 10/09/2025.
- **Link:** https://portal.tcu.gov.br/imprensa/noticias/auditoria-avalia-gestao-das-prestacoes-de-contas-de-transferencias-voluntarias

**O que ensina**
- Propõe indicadores de desempenho para a gestão das prestações de contas, como prazos de análise e omissões.
- Recomenda sistemas que **emitam alertas automáticos de risco de prescrição**.
- Recomenda controle consolidado de valores recuperados.

**Por que importa**
- Inspira o **painel de saúde da carteira** para a consultoria. Exemplos de indicadores:
  - dias até o prazo de prestação de contas;
  - diligências abertas;
  - valor em risco de glosa;
  - projetos em análise há mais de 180 dias.

### A1.3 TCU, Acórdão 1318/2023-Plenário: auditoria operacional da Lei Rouanet

- **Dados:** TC 040.520/2021-8, sessão de 28/06/2023, relator min.-subst. Augusto Sherman.
- **Link:** https://portal.tcu.gov.br/imprensa/noticias/auditoria-analisa-eficiencia-da-lei-rouanet

**O que ensina**
- Foca admissibilidade e aprovação.
- Recomenda que o **Salic incorpore "controles de aplicação, com critérios de validação dos campos" e emissão de "alertas" e "erros"**.
- Aponta arquivamento em massa de propostas por falta de resposta a diligência.

**Por que importa**
- O TCU recomenda ao governo exatamente o que o Jards pode oferecer ao proponente: **validação de campos com alerta e erro antes do envio**.
- Também reforça a importância de lembretes de prazo de diligência.

### A1.4 TCU, cartilha *Convênios e outros repasses*, 6ª edição (com errata)

- **Link:** https://portal.tcu.gov.br/data/files/13/80/53/07/3F03071076A7C107E18818A8/Convenios_outros_repasses_6_edicao_inclui_errata.pdf
- **Formato:** 70 páginas. Há seção sobre o MROSC.

**O que ensina**
- O ciclo completo do convênio.
- Listas oficiais de **"Irregularidades e falhas mais frequentes"** em quatro momentos: proposição, execução financeira, licitações e contratação de terceiros.
- Exemplos de falhas na execução financeira:
  - despesa fora da vigência;
  - pagamento antecipado;
  - recursos não aplicados no mercado financeiro;
  - transferência para outras contas;
  - **NF sem identificação do instrumento**;
  - cheque ao portador;
  - saldo não devolvido;
  - rendimentos usados fora do objeto.
- Exige comprovar a realização do serviço: fichas de frequência, relatórios e medições. Exige também a entrega de bens à população, com data, quantidade e beneficiário.

**Por que importa**
- É a fonte "canônica" mais citada para a **lista de checagens** (ver A6).

### A1.5 Resolução TCU nº 344/2022: prescrição das pretensões punitiva e ressarcitória

- **Link:** https://pesquisa.apps.tcu.gov.br/redireciona/norma/NORMA-21624

**O que ensina** [busca]
- Prescrição de 5 anos.
- Prescrição intercorrente de 3 anos de paralisação.
- Marcos interruptivos: notificação, ato inequívoco de apuração, tentativa de solução conciliatória e decisão condenatória recorrível.
- A **aprovação das contas pelo concedente não interrompe** a prescrição (art. 5º).

**Por que importa**
- Dá a base de cálculo da funcionalidade "linha do tempo de prescrição" do A1.1.
- O modelo de dados deve registrar cada marco com a data.

### A1.6 Portaria Conjunta MGI/MF/CGU nº 33/2023 e Portaria Conjunta MGI/CGU nº 41/2023: análise informatizada

- **Links:**
  - Portaria 33/2023: https://www.gov.br/transferegov/pt-br/legislacao/portarias/portaria-conjunta-mgi-mf-cgu-no-33-de-30-de-agosto-de-2023
  - Portaria 41/2023: https://www.gov.br/transferegov/pt-br/sobre/analise-informatizada-dos-instrumentos-do-transferegov.br/portaria-conjunta-mgi-cgu-no-41-de-31-de-outubro-de-2023

**O que ensina** (Portaria 41/2023, lida no texto integral)

Definições do art. 2º:
- **nota de risco**: varia de 0 a 1 e expressa a "probabilidade de uma prestação de contas ser reprovada", calculada por "modelo preditivo supervisionado" da CGU;
- **trilha de auditoria**: procedimento que identifica indícios de não conformidade cruzando o Transferegov com bases da CGU.

Faixas de valor:
- **faixa A**: até R$ 750 mil, com teto de tolerância de 0,9;
- **faixa B**: de R$ 750 mil a R$ 5 mi, com teto de tolerância de 0,7.

Requisitos para a análise informatizada (art. 5º):
- apontamentos das trilhas saneados;
- **sem saldo remanescente** na conta;
- sem parecer desfavorável no acompanhamento;
- sem dano ao erário detectado.

**Por que importa**
- É o **modelo regulatório de "malha fina"** que o Jards pode reproduzir no lado do proponente.
- Proposta de funcionalidade: um **"Score de prontidão"** por projeto.
  - Trilhas próprias: sanções, CNAE, datas, duplicidades, saldo e rendimentos.
  - Faixas de valor iguais às do governo.
  - Meta: "zerar apontamentos antes de enviar".

### A1.7 CGU, "Malha Fina de Convênios" (desde 2018), e Projeto Malha Fina MinC/ANCINE/CGU (dez/2024)

- **Links** [busca]:
  - https://agenciabrasil.ebc.com.br/geral/noticia/2022-02/projeto-malha-fina-automatiza-analises-contas-cgu
  - https://farofafa.com.br/2024/12/16/malha-fina-da-ancine-adota-ia-e-analise-de-riscos-para-zerar-passivo-de-prestacoes-de-contas-da-agencia/

**O que ensina**
- Aprendizado de máquina para prever o resultado da análise convencional.
- Na ANCINE, o modelo foi aplicado ao passivo de filmes de baixo orçamento, de R$ 1,5 mi a R$ 2,5 mi.
- Em 2024 houve redução anunciada de 70% do passivo da ANCINE: 3,7 mil projetos regulares e 1,6 mil em diligência.

**Por que importa**
- O governo **já usa score de risco** para decidir quem analisa a fundo.
- Os projetos com dados "limpos" e coerentes tendem a passar pela malha.
- Isso é o argumento de valor do Jards: qualidade de dado estruturado.

## A2. MROSC: Lei 13.019/2014 e Decreto 8.726/2016

### A2.1 Lei 13.019/2014, arts. 63 a 72, e Decreto 8.726/2016, arts. 54 a 58, com redação do Decreto 11.948/2024

- **Links:**
  - Lei 13.019/2014: https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l13019.htm
  - Decreto 8.726/2016: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/decreto/d8726.htm

**O que ensina** (texto vigente lido)

- **Art. 54:** a prestação de contas serve para "demonstrar e verificar resultados".
- **Art. 55:** relatório de execução do objeto no Transferegov, contendo:
  - metas ou justificativa;
  - ações;
  - "listas de presença, fotos, vídeos";
  - contrapartida;
  - impactos;
  - **grau de satisfação do público** (§ 5º: declaração de entidade local ou conselho, se não houve pesquisa).
- **Art. 56:** a administração **extrai** o relatório de execução financeira do Transferegov **só** se houver descumprimento injustificado de metas ou indício de irregularidade. Esse relatório contém:
  - receitas e despesas, inclusive rendimentos;
  - comprovante de devolução de saldo;
  - extrato;
  - **memória de cálculo do rateio**, que deve indicar a fonte de cada fração e veda "duplicidade ou sobreposição de fontes";
  - bens;
  - notas e holerites.
- **Art. 57:** a análise financeira compara previsto e realizado por item e verifica a **conciliação bancária**, isto é, a correlação entre a relação de pagamentos e os débitos da conta específica.
- **Art. 58:** guarda dos originais por **10 anos**.
- **Art. 59:** prestação de contas anual em parcerias com mais de 1 ano.
- **Art. 60:** a análise "por amostragem" anual existia e **foi revogada pelo Decreto 11.948/2024**.

**Por que importa**
- Define o **modelo de dados mínimo** do módulo:
  - meta → ação → evidência;
  - despesa → item do plano → pagamento → débito no extrato;
  - rateio com fonte por fração.
- A regra de "duplicidade de fontes" vira checagem entre projetos do mesmo proponente. O Jards enxerga a **carteira inteira**; o órgão, não.

### A2.2 Manual MROSC: do Planejamento à Prestação de Contas

- **Dados:** Portaria Interministerial SG/MGI/AGU nº 197/2025, publicada em ago/2025.
- **Links:**
  - página: https://www.gov.br/transferegov/pt-br/osc/normativos/manual-mrosc
  - PDF: https://www.gov.br/transferegov/pt-br/legislacao/portarias/MANUALMROSCDoPlanejamentoPrestaodeContasreduzido13082025.pdf

**O que ensina** [busca; o PDF deu 401 a partir deste ambiente]
- Guia oficial e atualizado do ciclo inteiro da parceria: planejamento, celebração, execução e monitoramento, emendas e prestação de contas.

**Por que importa**
- É a referência de linguagem e de etapas para o fluxo MROSC.
- Também serve aos editais estaduais e municipais de cultura que usam termos de fomento.

## A3. Cultura: Marco do Fomento, Decreto 11.453, Rouanet, PNAB e ANCINE

### A3.1 Lei 14.903/2024: Marco Regulatório do Fomento à Cultura, arts. 17 a 21

- **Link:** https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/l14903.htm

**O que ensina** (texto lido)

- **Art. 17 § 5º:** rendimentos podem ser aplicados no objeto **sem autorização prévia**.
- **Art. 17 § 3º:** alterações de plano "de pequeno percentual ou valor" basta comunicar.
- **Art. 18:**
  - "Relatório de Objeto da Execução Cultural" em até **120 dias** após a vigência;
  - em instrumentos de **até R$ 200 mil**, a prestação de contas pode ser feita por visita técnica (Relatório de Verificação Presencial);
  - guarda de documentos por **5 anos**;
  - § 4º: se a administração não decidir no prazo, as contas **consideram-se aprovadas**, salvo dolo, fraude ou simulação.
- **Art. 20:** o Relatório Financeiro só é exigido:
  - se o objeto não for comprovado; ou
  - se houver denúncia admitida.
- **Art. 21:**
  - resultados possíveis: aprovar, aprovar com ressalvas (sem má-fé) ou rejeitar;
  - decisão em **360 dias**;
  - devolução com **IPCA + juros do art. 406 do CC** (taxa legal), descontado o atraso da administração;
  - possibilidade de converter a sanção em **plano de ações compensatórias**.

**Por que importa**
- Define o **modo "relatório de objeto primeiro"**.
- Define os prazos do calendário: 120 dias, 360 dias e 5 anos.
- Define a fórmula de correção (ver B7).
- Define a regra de **aprovação tácita**. O produto deve contar o prazo e registrar a data de término da vigência.

### A3.2 Decreto 11.453/2023: fomento cultural e Rouanet, arts. 25 a 34 e 51

- **Link:** https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/D11453.htm

**O que ensina** (texto lido)

- **Art. 25:** conta específica com **aplicação automática**.
- **Art. 26:** lista de despesas permitidas. Inclui:
  - assessoria jurídica e contábil;
  - impulsionamento;
  - aluguel;
  - tributos e tarifas.
- **Arts. 29 a 32:** três categorias de prestação de informações:
  - **in loco**, para valores abaixo de R$ 200 mil;
  - **relatório de execução do objeto**;
  - **relatório de execução financeira**, só se o objeto não for comprovado ou houver denúncia.
- **Art. 51 (Rouanet):** a metodologia vem de **matriz de risco**:
  - pequeno porte: categorias dos arts. 29 a 34;
  - **médio porte**: relatório do objeto e relatório financeiro sempre, **vedado o in loco**;
  - **grande porte**: os dois relatórios e um **plano de monitoramento específico**.

**Por que importa**
- O Jards deve classificar cada projeto por porte e mecanismo e **gerar o checklist de dossiê correspondente**.
- Segundo os manuais de 2026, as faixas da IN 29/2026 são: até R$ 200 mil, até R$ 750 mil, até R$ 5 mi e acima.
- Ver também `rouanet-in29-manual-olivieri.md` desta pasta.

### A3.3 IN MinC nº 29/2026 e *Manual do Proponente – Módulo III – Avaliação de Resultados* (MinC/SGPTC, 2026)

- **Links:**
  - manual: https://www.gov.br/cultura/pt-br/centrais-de-conteudo/marcas-e-logotipos/marcas-rouanet/ManualdoProponenteModuloIIIAvaliacaodeResultados1.pdf
  - legislação: https://www.gov.br/cultura/pt-br/assuntos/lei-rouanet/textos/legislacao

**O que ensina** (texto local lido)

Aspectos financeiros comprovados:
- aderência ao orçamento aprovado;
- vínculo da despesa com o objeto;
- movimentação **só** pelas contas vinculadas;
- preços de mercado;
- limites normativos.

Documentos:
- NF em nome do proponente, com descrição **igual** à da planilha aprovada;
- data entre a portaria de autorização e o fim da execução;
- retenções de ISS, INSS e IR destacadas;
- para PJ, **só nota fiscal**: recibo apenas quando não incide ISS ou ICMS;
- passagens com cartão de embarque.

Outras regras:
- devolução ao FNC por GRU, com códigos 34902, 340034 e 019473;
- **reembolso** é exceção: só depois de captar 20%, com nota de débito;
- pagamento após o fim da execução gera **ressalva**, se o fato gerador estiver no prazo;
- um mesmo fornecedor pode receber **no máximo 20% do captado**, com exceções;
- em pequeno e médio porte, a análise financeira olha **só as inconformidades** apontadas no Relatório de Execução Financeira.

**Por que importa**
- É a fonte mais direta de **regras validáveis por máquina** para a Rouanet (ver A6).

### A3.4 PNAB e Lei Paulo Gustavo: guias do MinC

- **Links:**
  - *Guia prático de monitoramento e avaliação dos resultados do Ciclo 1 da PNAB* (dez/2025): https://www.gov.br/cultura/pt-br/assuntos/politica-nacional-aldir-blanc/politica-nacional-aldir-blanc/arquivos/materiais-de-orientacao/guias-manuais-e-cartilhas/dezembro2025_minc_guia-pratico-monitoramento-e-avaliacao-ciclo1-1.pdf
  - página dos guias: https://www.gov.br/cultura/pt-br/assuntos/politica-nacional-aldir-blanc/guias-praticos-1/guias-praticos
  - FAQ 80 (agente cultural com dúvida de prestação de contas): https://www.gov.br/cultura/pt-br/acesso-a-informacao/perguntas-frequentes/politica-nacional-aldir-blanc/perguntas-gerais/80-sou-agente-cultural-e

**O que ensina** [busca; PDF com WAF]
- Orienta estados e municípios a monitorar e avaliar os resultados e a preencher a planilha de monitoramento enviada ao Transferegov.
- O agente cultural presta contas **ao ente local**, que segue a Lei 14.903 e o Decreto 11.453.

**Por que importa**
- O Jards atende proponentes de editais estaduais e municipais. O formato de "relatório de objeto" dessas leis deve ser um **template de primeira classe**.
- Os dados de execução da PNAB são abertos (ver B4.4).

### A3.5 ANCINE: *Manual de Prestação de Contas* v2.11 (23/09/2026), IN ANCINE 158/2021 e IN 159/2021

- **Links:**
  - manual: https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/manual-de-prestacao-de-contas
  - manual do STR: https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/manual-str

**O que ensina** (texto lido; detalhado em `ancine-str-logomarca-fsa-web.md`)

Glosas:
- pagamento fora da conta de movimentação;
- pagamento não eletrônico (só TED, DOC ou Pix);
- pagamentos à própria proponente ou a **empresas com sócios em comum ou do mesmo grupo econômico**;
- material permanente;
- hospedagem de parentes;
- estrangeiro irregular.

Limites:
- gerenciamento de até 10%;
- documento fiscal emitido antes do marco inicial de execução.

Planilhas obrigatórias:
- RP (Relação de Pagamentos);
- DE (Demonstrativo do Extrato);
- DO (Demonstrativo Orçamentário);
- todas pelo STR.

**Por que importa**
- O audiovisual é o mecanismo com **regras de partes relacionadas** mais explícitas.
- O Jards precisa cruzar o QSA do proponente com o QSA dos fornecedores (ver B5.3).
- O produto pode **exportar RP, DE e DO** no layout do STR.

## A4. Esporte, saúde e contabilidade ou auditoria do terceiro setor

### A4.1 LIE: Lei Complementar 222/2025, Decreto 12.861/2026 e Portaria MESP 10/2026

- **Links:**
  - LC 222/2025: https://www.planalto.gov.br/ccivil_03/LEIS/LCP/Lcp222.htm
  - Decreto 12.861/2026: https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/D12861.htm
  - modelos e manuais: https://www.gov.br/esporte/pt-br/acoes-e-programas/lei-de-incentivo-ao-esporte/modelos-e-manuais

**O que ensina** (decreto lido)
- **Art. 12:** despesas administrativas limitadas a **15%**.
- **Art. 30:** conta específica **somente no BB ou na Caixa**. O Ministério e os órgãos de controle **acessam extratos e saldos** durante toda a execução.
- **Art. 33:** prestação de contas final em **60 dias** após o término, com relatório de cumprimento do objeto.
- Se a prestação de contas não for apresentada:
  - o proponente fica suspenso para novos projetos;
  - o saldo é recolhido.
- O Ministério pode exigir prestação de contas parcial.
- Ingressos não distribuídos são restituídos na prestação de contas.

**Por que importa**
- Integração bancária só com **dois bancos** (BB e Caixa). Ver B6.
- O teto de 15% e a regra dos ingressos viram checagens.
- O detalhamento está em `lie-federal-2026-web.md`.

### A4.2 FNS/MS: *Manual de orientações para análise de aspectos contábeis e financeiros das prestações de contas PRONON e PRONAS/PCD*

- **Dados:** 2ª edição, ago/2019, v3.1.
- **Link:** https://portalfns.saude.gov.br/wp-content/uploads/2023/02/Manual-de-Orientacoes-PRONON-e-PRONAS.PCD-2-edicao-Verso-3.1.pdf

**O que ensina** (PDF lido)

Traz os **roteiros de análise usados pelo próprio FNS**, em formato de checklist "Sim/Não". Exemplos:
- extratos da conta captação e da conta movimento "desde o dia do recebimento até o último pagamento", **listando os meses faltantes**;
- demonstrativo de rendimentos;
- conciliação bancária;
- saldo remanescente com rendimentos recolhido;
- planilhas de rendimentos e de conciliação.

O regime também exige demonstrações contábeis com **parecer de auditoria independente registrada no CRC** (ver `saude-pronon-pronas-manual-2019.md`).

**Por que importa**
- É praticamente um **caderno de testes** pronto. A checagem "meses sem extrato" é trivial de automatizar.
- Hoje o PRONON e o PRONAS correm no Transferegov (ver B2), o que permite automatizar boa parte dessas checagens.

### A4.3 CFC: ITG 2002 (R1), entidade sem finalidade de lucros, e NBC TG 07 (R2), subvenção e assistência governamentais

- **Links:**
  - ITG 2002 (R1): https://www1.cfc.org.br/sisweb/SRE/docs/ITG2002(R1).pdf
  - NBC TG 07 (R2): https://www1.cfc.org.br/sisweb/SRE/docs/NBCTG07(R2).pdf

**O que ensina**
- Na ITG 2002, o reconhecimento de receitas de subvenções e doações em contas segregadas.
- O controle **por projeto**.
- As notas explicativas obrigatórias, como as subvenções recebidas e a aplicação.
- Na NBC TG 07, o reconhecimento em resultado à medida que as despesas do projeto ocorrem.

**Por que importa**
- O plano de contas e os relatórios do Jards devem permitir **exportar o razão por projeto** e conciliar com a contabilidade da OSC.
- O auditor independente (exigido no PRONON e PRONAS) vai cobrar isso.

### A4.4 CFC, FBC e Profis: *Manual de Procedimentos para o Terceiro Setor – aspectos de gestão e de contabilidade* (2015)

- **Link:** https://cfc.org.br/wp-content/uploads/2018/04/Publicacao_Terceiro-Setor.pdf

**O que ensina**
- Controles internos.
- Plano de contas modelo.
- Auditoria.
- Aspectos tributários das OSCs.

**Por que importa**
- É boa referência para o **plano de contas padrão** e para os controles internos que o produto deve induzir: segregação de funções, aprovação de pagamento e guarda de documentos.

### A4.5 CFC: NBC TA 800 e NBC TA 805, auditoria de demonstrações elaboradas com estruturas de propósito especial e de quadros ou elementos isolados

- **Links:**
  - NBC TA 800: https://www1.cfc.org.br/sisweb/SRE/docs/NBCTA800.pdf
  - NBC TA 805: https://www1.cfc.org.br/sisweb/SRE/docs/NBCTA805.pdf

**O que ensina**
- São as normas que o auditor usa ao emitir parecer sobre a **prestação de contas de um projeto específico**, que é um demonstrativo de propósito especial.
- Esse tipo de parecer é exigido no PRONON e PRONAS e frequente em contratos de patrocínio.

**Por que importa**
- O "pacote do auditor" do Jards deve seguir o que o auditor pede:
  - base de preparação;
  - demonstrativo de receitas e despesas;
  - conciliação;
  - amostra de comprovantes rastreável.

## A5. Inspiração internacional

### A5.1 2 CFR Part 200 (Uniform Guidance), Subparts D, E e F, eCFR atualizado em 29/09/2026

- **Links:**
  - eCFR: https://www.ecfr.gov/current/title-2/subtitle-A/chapter-II/part-200
  - revisão de 2024 (89 FR 30046, vigente desde 01/10/2024): https://www.federalregister.gov/documents/2024/04/22/2024-07496/guidance-for-federal-financial-assistance
  - proposta de nova revisão (91 FR 32198, 29/05/2026; comentários até 13/07/2026): https://www.federalregister.gov/documents/2026/05/29/2026-10817/regulation-for-federal-financial-assistance

**O que ensina** (seções lidas via API)
- **§200.403:** fatores de admissibilidade do custo:
  - necessário, razoável e alocável;
  - conforme limites;
  - consistente com políticas que valem igualmente para outras atividades;
  - tratamento consistente;
  - **adequadamente documentado**.
- **§200.334:** guarda dos registros por 3 anos após o relatório final.
- **§200.344:** encerramento (closeout) com relatórios finais.
- **§200.501:** *single audit* para quem gasta US$ 1 milhão ou mais por ano.
- **§200.302:** gestão financeira que permita rastrear os fundos até o nível de despesa.

**Por que importa**
- O §200.403 é um ótimo **framework de checagem por despesa** em 5 perguntas: necessária? razoável? alocável ao objeto? dentro de limites? documentada?
- Pode estruturar a UI de revisão de cada lançamento.

### A5.2 OMB, 2025 *Compliance Supplement* (2 CFR 200, Appendix XI), Part 3: *Compliance Requirements*

- **Link:** https://www.whitehouse.gov/omb/information-resources/guidance/compliance-supplement

**O que ensina** [busca]
- Os **12 tipos de requisito** que o auditor testa:
  - atividades permitidas;
  - custos permitidos;
  - gestão de caixa;
  - elegibilidade;
  - equipamentos;
  - contrapartida;
  - **período de execução**;
  - compras e *suspension & debarment*;
  - receita do programa;
  - relatórios;
  - monitoramento de subrecipientes;
  - testes especiais.

**Por que importa**
- É um **guia de "audit readiness"** pronto. Cada requisito vira um grupo de checagens no Jards.
- *Suspension & debarment* equivale a CEIS e CNEP.
- *Period of performance* equivale a datas dentro da vigência.
- *Cash management* equivale a rendimentos e saldo.

### A5.3 Comissão Europeia, *EU Grants: AGA – Annotated Grant Agreement*, v2.0, 01/04/2025

- **Link:** https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/common/guidance/aga_en.pdf

**O que ensina** (PDF lido)
- Comentário artigo a artigo do modelo de acordo de subvenção: elegibilidade de custos (custos reais e unitários), documentação e controles.
- **Certificate on the Financial Statements (CFS)**: auditor externo obrigatório quando a contribuição solicitada for de **EUR 430.000 ou mais** (Horizon Europe). Em outros programas, os limiares parametrizáveis são EUR 150.000 ou 325.000.

**Por que importa**
- A ideia de **certificação por limiar** inspira uma regra configurável no Jards: "a partir de R$ X, gerar pacote para auditor".
- O formato "anotado com exemplos" é bom para a ajuda contextual da UI.

### A5.4 UK Cabinet Office, *Government Functional Standard GovS 015: Grants* e *Minimum Requirements* 1 a 10 (atualizado em 15/09/2026)

- **Links:**
  - página: https://www.gov.uk/government/publications/government-functional-standard-govs-015-grants
  - MR 7, *Risk, Controls & Assurance*: https://assets.publishing.service.gov.uk/media/68108507dbea49d6a3305f48/2024-10-14_Minimum_Requirement_SEVEN_-_Risk_Controls_Assurance_v2.6.pdf
  - MR 8, *Performance & Monitoring*: https://assets.publishing.service.gov.uk/media/668271f2aec8650b100901aa/Minimum_Requirement_EIGHT_-_Performance___Monitoring_-v2.5.1.pdf
  - MR 9, *Annual Review & Reconciliation*: https://assets.publishing.service.gov.uk/media/668272037d26b2be17a4b4bc/Minimum_Requirement_NINE_-_Review___Reconciliation_-v2.5.pdf

**O que ensina**
- Padrão de gestão de *grants* do lado do financiador:
  - risco de fraude;
  - monitoramento proporcional ao risco;
  - revisão anual;
  - **reconciliação** entre gasto e pagamento.

**Por que importa**
- Mostra como o financiador **pensa a proporcionalidade**: mais controle onde há mais risco.
- Bom vocabulário para o lado "patrocinador e incentivador" do Jards, caso o produto venha a atender empresas patrocinadoras.

## A6. Riscos e glosas mais comuns: lista consolidada e checagens

### Fontes da lista

| Sigla | Fonte | Seção |
|---|---|---|
| T | TCU, cartilha *Convênios e outros repasses* | A1.4 |
| M | MinC, Manual do Proponente Módulo III e IN 29/2026 | A3.3 |
| A | ANCINE, Manual de PC v2.11 | A3.5 |
| F | FNS, Manual PRONON e PRONAS | A4.2 |
| R | MROSC, Decreto 8.726 | A2.1 |
| L | Decreto 12.861/2026 (LIE) | A4.1 |
| D | Achado meu nos dados da API Salic | B1 |

### Nível de automação

| Nível | Significado |
|---|---|
| **auto** | Dá para automatizar com os dados e APIs da Parte B. |
| **semi** | Exige revisão humana ou OCR. |

### Checagens

| # | Risco ou glosa frequente | Fontes | Checagem no Jards | Nível |
|---|---|---|---|---|
| 1 | Despesa **fora da vigência**: documento fiscal antes da autorização ou do marco inicial, ou pagamento após o fim | T, M, A | Comparar a data de emissão da NF (ou o AAMM da chave) e a data do débito com a vigência. Pagamento posterior com fato gerador dentro do prazo gera **ressalva**, não glosa. | auto |
| 2 | Despesa **não prevista** no orçamento, ou descrição da NF diferente da rubrica | T, M, A | Mapear cada lançamento para um item aprovado (`id_planilha_aprovacao` no Salic). Comparar por similaridade o texto da NF com o da rubrica. | semi |
| 3 | Estouro de rubrica acima do permitido sem readequação | M, A | Somar o executado por item contra o aprovado. O `relatorio_fisco` do Salic dá o percentual executado. Alertar ao passar do limite de remanejamento. | auto |
| 4 | Pagamento **fora da conta do projeto**, transferência para outras contas ou uso para despesas da entidade | T, M, A | Cada pagamento precisa de um débito correspondente no extrato da conta de movimentação. Alertar transferências para conta própria ou sem beneficiário. | auto, se houver extrato |
| 5 | Pagamento **não eletrônico**: espécie ou cheque ao portador | T, A | Classificar o tipo de lançamento do extrato (saque, cheque). `tipo_forma_pagamento` no Salic. | auto |
| 6 | **Pagamento antecipado** ao fornecedor | T | Data do débito anterior à data da NF ou do serviço. | auto |
| 7 | **Recursos não aplicados** ou rendimentos usados fora do objeto ou não devolvidos | T, F, M | Saldo parado por mais de 30 dias sem aplicação. Rendimentos acumulados contra o aprovado. Saldo e rendimentos devolvidos (GRU) no fim. | auto |
| 8 | **Saldo remanescente** não devolvido | T, F, L | Saldo final diferente de zero sem GRU ou comprovante de recolhimento. A Portaria 41/2023 também exige saldo zero para a malha informatizada. | auto |
| 9 | Extratos **incompletos**, com meses faltando | F | Cobertura mensal de extratos da data do primeiro crédito ao último pagamento. | auto |
| 10 | Documento fiscal **inidôneo**: recibo de PJ quando cabe NF, NF cancelada ou chave inválida | M, T | Validar o DV e a estrutura da chave (NF-e de 44 dígitos; NFS-e de 50 posições). CNPJ do emitente na chave igual ao do fornecedor. Situação da NF-e e da NFS-e quando houver certificado (B5). | auto ou semi |
| 11 | **Fornecedor irregular**: CNPJ inapto ou baixado na data, ou empresa de fachada | T, A | Situação cadastral e data de abertura antes da NF, via B5.3. Alertar empresa aberta pouco antes do contrato. | auto |
| 12 | Fornecedor **sancionado**: CEIS, CNEP, inidôneo TCU, CNIA, CEPIM | T | API TCU Certidões e downloads da CGU (B4). | auto |
| 13 | **CNAE incompatível** com o serviço prestado | T [inferência] | Comparar o CNAE principal **e os secundários** com a rubrica. No teste de B5.3, o fornecedor de "aluguel de vans" tinha CNAE principal 7490-1/04 e o CNAE **secundário** 7711-0/00 compatível. | auto, com tabela rubrica→CNAE |
| 14 | **Partes relacionadas**: pagamento à própria proponente, a sócios ou a empresas com sócios em comum | A, M | Cruzar o QSA do proponente com o QSA do fornecedor (BrasilAPI ou CNPJá). Cruzar o CPF do RPA com a lista de dirigentes. | auto |
| 15 | **Concentração** em um fornecedor acima de 20% do captado (Rouanet) | M | Somar os pagamentos por CNPJ e comparar com o captado (API Salic). | auto |
| 16 | Limites percentuais: administração (15% na LIE), gerenciamento (10% na ANCINE), captação e divulgação | L, A, M | Somar por grupo de rubrica e comparar com o teto do mecanismo. | auto |
| 17 | **Duplicidade**: mesma NF lançada duas vezes, ou em dois projetos e fontes | R, T | Chave da NF, ou fornecedor + número + valor, repetida no projeto e **na carteira** do proponente. Rateio com memória de cálculo. | auto |
| 18 | Falta de **retenções** e guias (ISS, INSS, IRRF e PIS/COFINS/CSLL) | M | Para serviço de PJ ou de PF por RPA, esperar a guia correspondente. O Salic lança guias como `tipo_documento` "2". | semi |
| 19 | Passagens sem cartão de embarque ou fora da classe econômica | M, A | Checklist de anexos por tipo de despesa. | semi |
| 20 | Bens permanentes sem autorização ou sem destinação | A; Lei 14.903, art. 16 | Classificar a despesa como permanente e exigir a justificativa ou o termo de doação. | semi |
| 21 | **Objeto sem evidência**: listas de presença, fotos, plano de distribuição, contrapartidas e acessibilidade | R, T, M | Checklist de evidências por meta, produto e plano de distribuição. Os metadados das fotos (data e geolocalização) devem cair na vigência e no local. | semi |
| 22 | Ingressos e gratuidade fora do aprovado | L, M | Comparar o plano de distribuição aprovado (`distribuicao` no Salic) com o borderô. | semi |
| 23 | **Prazos perdidos** de prestação de contas, diligência ou recurso | T, L, A1.1 | Calendário com prazos legais (60, 120 e 360 dias) e alertas. Registro de marcos para a prescrição (A1.5). | auto |
| 24 | Contrapartida não comprovada | T, R | Comprovação separada da contrapartida, quando houver. | semi |
| 25 | Despesas pessoais ou desvinculadas, como hospedagem de parentes | A, M | Palavras-chave e beneficiário pessoa física sem vínculo com a ficha técnica. | semi |
| 26 | **Qualidade de dado**: data de pagamento no futuro, CNPJ ou CPF em branco, CNPJ como número sem zeros à esquerda | D | Ver os dados: Salic e Transferegov (B1 e B2). | auto |

Nos achados de qualidade de dado (#26):
- No PRONAC 261004, 1 de 492 pagamentos tem `data_pagamento` igual a 26/11/2026, depois da data de hoje.
- No PRONAC 221688, 40 de 1.248 pagamentos não têm `cgccpf`.
- No Transferegov, o CNPJ do beneficiário vem como `53096781000126.0`.

---

# PARTE B — Dados abertos e APIs

### Quadro-resumo (testes de 01/10/2026)

| Fonte | Funciona? | Autenticação | Principal uso no Jards |
|---|---|---|---|
| API Salic `/api/v1` | **Sim** | Nenhuma | Importar PRONAC, captações, pagamentos, execução por item e readequações |
| Transferegov, nova API Parcerias | **Sim** | Nenhuma | PRONON e PRONAS: proposta, plano, contas e **extrato bancário** |
| Transferegov, downloads CSV (siconv) | **Sim** | Nenhuma | Convênios e MROSC históricos. **Sem LIE e sem PRONON** |
| Transferegov, APIs antigas | **Não** (403 Cloudflare) | — | Desativadas após 31/08/2026 [busca] |
| ANCINE, CSVs | **Sim** | Nenhuma | Situação e captação dos projetos audiovisuais; fila de prestação de contas |
| TCU Certidões APF | **Sim** | Nenhuma | Sanções do CNPJ: CEIS, CNEP, CNIA e Inidôneos |
| CGU, downloads (CEIS, CNEP, CEPIM) | **Sim** | Nenhuma | Base local de sanções |
| Portal da Transparência API | Exige chave (401) | Header `chave-api-dados` | Sanções e convênios por consulta |
| dados.cultura.gov.br (CKAN) | **Sim** | Nenhuma | Execução da PNAB (XLSX) e catálogo |
| dados.gov.br API | Exige token (401) | Chave gov.br | Catálogo |
| CNPJ: BrasilAPI, Minha Receita, CNPJá open, CNPJ.ws, ReceitaWS | **Sim** | Nenhuma | Situação, CNAE, QSA, Simples |
| IBGE (CNAE, municípios) | **Sim** | Nenhuma | Descrição de CNAE e código IBGE |
| BCB SGS e PTAX | **Sim** | Nenhuma | IPCA, Selic, taxa legal, poupança, câmbio |
| BrasilAPI feriados | **Sim** | Nenhuma | Prazos em dias úteis |
| NFS-e, consulta pública (web) | Página no ar, **com hCaptcha** | — | Não automatizar |
| NFS-e ADN (APIs) | Recusou TLS (mTLS) | Certificado ICP-Brasil | Baixar NFS-e recebidas pelo proponente |
| NF-e, consulta pública | Redireciona para reCAPTCHA | — | Não automatizar |
| NF-e DistribuicaoDFe | 403 sem certificado | Certificado ICP-Brasil (e-CNPJ do destinatário) | Baixar NF-e recebidas pelo proponente |
| BB API Extratos | Não testável | OAuth, app key, mTLS e contrato PJ | Extrato automático (LIE, Rouanet, PRONON) |
| Caixa, extrato CNAB 240 | Layout obtido | Convênio EDI ou VAN | Importar arquivo (LIE) |
| Open Finance (diretório) | **Sim** (diretório público) | Dados de conta só para instituição autorizada | Via agregador |

## B1. Salic: API pública do MinC (Lei Rouanet)

### Endereços

- **Base:** `https://api.salic.cultura.gov.br/api/v1`.
  - Atenção ao prefixo `/api/v1`. O antigo `/v1/` agora devolve 404.
  - Barra final gera 301 para HTTP, e o HTTP é bloqueado neste proxy.
- **Docs (Scribe):** `https://api.salic.cultura.gov.br/docs`, "Last updated: September 29, 2026".
- **Coleção Postman:** `/docs.postman`. O `/docs.openapi` devolveu **500**.
- **Stack:** PHP/Laravel, atrás de Cloudflare.

### Autenticação, formatos e paginação

- "This API is not authenticated."
- Formatos: HAL+JSON (padrão), XML e CSV. Escolha por `Accept` ou `?format=`.
- Paginação: `limit` (1 a 100) e `offset`. A resposta traz `count`, `total` e links `first`, `next` e `last`.
- Não vi cabeçalho de *rate limit*. O detalhe de um projeto grande leva de 2 a 4 s e pesa até 1,7 MB.

### Endpoints testados

| Endpoint | Resultado |
|---|---|
| `GET /projetos?…` | Funciona. Filtros: `PRONAC`, `cgccpf`, `proponente`, `nome`, `area`, `segmento`, `UF`, `ano_projeto` (AA), datas de execução (`data_inicio_min/max`), `ano_captacao`, `sort`. Exemplo: `ano_projeto=26` → **8.261** projetos. **Bug:** `sort=PRONAC:asc` devolveu 503. |
| `GET /projetos/{PRONAC}` | **O endpoint mais valioso.** Traz `_embedded` com `captacoes`, `relacao_pagamentos`, `relatorio_fisco`, `readequacoes`, `prorrogacao`, `certidoes_negativas`, `documentos_anexados`, `marcas_anexadas`, `distribuicao`, `local_realizacao`, `deslocamento`, `divulgacao` e `relacao_bens_captal`. |
| `GET /projetos/areas` e `/projetos/segmentos` | Tabelas de domínio. |
| `GET /proponentes?cgccpf=` | Funciona e traz `total_captado`. |
| `GET /incentivadores?cgccpf=` e `/incentivadores/{id}/doacoes` | Funciona e traz `total_doado`. |
| `GET /fornecedores?cgccpf=` e `?PRONAC=` | Funciona e traz nome e e-mail. |
| `/fornecedores/{id}/produtos` | **Timeout de 60 s** no teste. |
| `GET /propostas` e `/propostas/{id}` | Funciona. |

### Exemplo real: PRONAC 221688 (OSESP 2023)

Situação "Apresentou prestação de contas". Volume em `_embedded`:

| Bloco | Quantidade |
|---|---|
| `relacao_pagamentos` | 1.248 |
| `captacoes` | 1.860 |
| `relatorio_fisco` | 49 itens |
| `readequacoes` | 13 |
| `documentos_anexados` | 110 |

```json
// relacao_pagamentos[0]
{"nome":"Advogado(a)","id_comprovante_pagamento":"2734229","id_planilha_aprovacao":"4378108",
 "cgccpf":"03281691000137","nome_fornecedor":"CESNIK, QUINTINO, SALINAS, FITTIPALDI & VALERIO ADVOGADOS",
 "data_aprovacao":"2023-09-19 05:44:54.000","tipo_documento":"2","nr_comprovante":"IRRF NF 29792",
 "data_pagamento":"2023-08-24 05:44:54.000","tipo_forma_pagamento":"2","nr_documento_pagamento":"17.552",
 "valor_pagamento":"23.44","id_arquivo":"4759782","justificativa":"",
 "nm_arquivo":"19set23 - R$ 23,44 CESNIK, QUINTINO, SALINAS, FITTIPALDI IRRF NF 29792.pdf"}
// relatorio_fisco[0]
{"etapa":"Produção / Execução","item":"Diárias: Hospedagem sem alimentação","unidade":"Dia",
 "qtd_programada":350,"valor_programado":112700,"perc_executado":26.48,"valor_executado":29844}
// captacoes[0]  (CPF de pessoa física mascarado)
{"PRONAC":"221688 ","valor":250,"data_recibo":"2022-12-05 00:00:00","cgccpf":"***662458**","nome_doador":"ERNANI PEREIRA DA CUNHA"}
```

### Atualidade dos dados

O PRONAC 261004 (São João de Campina Grande 2026) tem:
- última captação em 02/09/2026;
- 492 pagamentos lançados.

### Códigos de `tipo_documento`

O mapeamento é **[inferência]** a partir de amostra. A API não documenta os códigos.

| Código | Tipo provável |
|---|---|
| 1 | Cupom ou NF de PF, misto |
| 2 | Guia de tributo (IRRF, PCC, ISS) |
| 3 | Nota fiscal |
| 4 | Folha ou bolsa |
| 5 | RPA |
| 6 | Invoice do exterior |
| 7 | Contrato ou outros |

### Limitações

1. **Os links de arquivos** (`/projetos/abrir?id=`, `/verprojetos/abrir?id=`) devolvem **404**: os PDFs dos comprovantes não são baixáveis pela API.
2. **Não há extrato bancário** na API. O MinC recebe os extratos do BB internamente.
3. O status da prestação de contas aparece só como texto em `situacao` e `providencia`.
4. **CPFs de fornecedores pessoa física aparecem sem máscara**: 413 de 1.248 registros com 11 dígitos no exemplo. Isso pede **cuidado de LGPD**: armazenar só para projetos do próprio cliente.
5. **VerSalic** (`versalic.cultura.gov.br`) está "em migração" e redireciona para o **SalicComparar** (`aplicacoes.cultura.gov.br/comparar/salicnet/`), que está atrás de desafio Cloudflare.

### Como o Jards usaria

1. **Onboarding por CNPJ:** `/proponentes?cgccpf=` e depois `/projetos?cgccpf=` listam todos os PRONACs do cliente.
2. **Sincronização diária** de `/projetos/{PRONAC}`, com *diff*. Gera alertas de:
   - nova captação;
   - mudança de `situacao` ou `providencia`;
   - readequação deferida.
3. **Pré-preencher o dossiê:**
   - rubricas (`relatorio_fisco`);
   - pagamentos já lançados, para conferir contra NF e extrato;
   - doadores e patrocinadores, para recibos e relatórios aos incentivadores.
4. **Rodar as checagens de A6:**
   - #1 datas;
   - #3 rubrica;
   - #11 a #15 fornecedor (`cgccpf`);
   - #15 concentração;
   - #17 duplicidade;
   - #26 qualidade de dado.
5. **Benchmark** para a consultoria: valores praticados por rubrica em projetos semelhantes, a partir de `relacao_pagamentos` de projetos públicos.

## B2. Transferegov

### B2.1 Nova API de dados abertos, módulo "Gestão de Parcerias"

- **Base:** `https://api-publica.transferegov.gestao.gov.br/parcerias/`.
- **Swagger:** `/parcerias/docs`.
- **OpenAPI:** `/parcerias/openapi.json`, 18 rotas.

**Contexto**
- O Comunicado Transferegov nº 23/2026 [busca] criou o novo ambiente `api-publica…`.
- Os endereços antigos (`api.transferegov.gestao.gov.br/{transferenciasespeciais,fundoafundo,ted}`) seriam desligados após 31/08/2026. Hoje devolvem **403 Cloudflare**.
- O portal novo também lista os módulos `especiais`, `fundoafundo` e `ted` e uma página `downloads`.

**Autenticação:** nenhuma. Paginação por `pagina` e `tamanho_da_pagina`. A resposta vem como `{data, total_pages, total_items}`.

**Rotas**

| Grupo | Rotas |
|---|---|
| Programa e proposta | `/programa`, `/proposta`, `/meta-proposta`, `/item-proposta`, `/cronograma-desembolso` |
| Parceria e contas | `/parceria`, **`/parceria-conta`**, **`/extrato-bancario`** |
| Financeiro do governo | `/empenho-parceria`, `/documento-habil`, `/ordem-pagamento` |
| Análise e resultados | `/analise-proposta`, `/proposta-resultado-indicador`, `/distribuicao-recurso-proposta` |
| Emendas | `/beneficiario_emenda_parlamentar`, `/indicacao-beneficiario-emenda-parlamentar`, `/opp` |
| Controle | `/data-atualizacao`. Resultado: `"2026-10-01T00:00:00"` (atualização diária). |

**PRONON e PRONAS estão aqui (testado)**
- Dos 176 programas, **14** são do tipo **"Lei de incentivo à Saúde do Ministério da Saúde (PRONON e PRONAS)"**.
- Exemplos:
  - id 96, "Pronon – Prestação de Serviços Médico-Assistenciais" (2025);
  - id 99, "Pronas/PCD – Prestação de serviços médico-assistenciais".
- O programa 96 tem 202 propostas.
- Também aparece a **"Lei de Incentivo à Reciclagem"** (MMA).

**A LIE não aparece** nesta API. Os únicos órgãos são MS, MDS, MMA e MF.

**Extrato bancário público (testado)**

A cadeia de consulta é: proposta → `/parceria?id_proposta=` → `/parceria-conta?id_parceria=` → `/extrato-bancario?id_parceria_conta=`.

Exemplo: parceria 202400000270, "Em Execução", captação de 20/12/2024 a 30/11/2025.
- Conta Captação BB, com `cd_programa_bb_agil` 299: 57 lançamentos.
- Conta Movimentação BB, com `cd_programa_bb_agil` 300: 13 lançamentos.

```text
2026-05-11 Crédito Movimento do Dia            2.832.835,04
2026-05-11 Débito  BB-APLIC C.PRZ-APL.AUT     -2.832.835,04
2026-06-03 Débito  Câmbio                     -2.632.000,00
2026-07-03 Débito  Transferência enviada         -10.000,00 | 53096781000126.0 53.096.781 BRUNA ALESSANDRA DE AVILA
2026-07-16 Débito  Transferência enviada         -40.000,00 | 15237091000150.0 L. C. DRUZIAN CONSULTORIA
```

Na conta captação aparecem créditos "Transferência recebida" com **CNPJ e nome do doador**. Exemplo: "AGRODANIELI INDUSTRIA E COMERCIO LTDA".

**Qualidade de dado**
- O CNPJ do beneficiário vem como número de ponto flutuante (`.0`, perdendo zeros à esquerda). Precisa normalizar.

**Como o Jards usaria**
1. Para clientes PRONON e PRONAS, **importar o extrato oficial diariamente** sem integração bancária.
2. Conciliar automaticamente cada débito com o comprovante. Ver A6 #4 a #9.
3. Identificar doadores por CNPJ para o relatório de captação.
4. Puxar o plano de trabalho (`meta-proposta`, `item-proposta`) para montar o orçamento aprovado.
5. Monitorar `in_situacao_parceria`.
6. O mesmo vale para **termos de fomento e colaboração MROSC**, à medida que forem migrados para o módulo [verificar abrangência].

### B2.2 Downloads em massa (CSV, legado Siconv)

- **Endereço:** `https://repositorio.dados.gov.br/seges/detru/`. Funciona.
- **Data de carga:** `data_carga_siconv.txt` = **17/07/2026**. Está defasado em cerca de 2,5 meses.

**Arquivos úteis para convênios e termos MROSC**

| Arquivo | Tamanho |
|---|---|
| `siconv_pagamento` | 328 MB |
| `siconv_plano_aplicacao` | 267 MB |
| `siconv_convenio` | — |
| `siconv_proponentes` | — |
| `siconv_historico_situacao` | — |
| `siconv_solicitacao_rendimento_aplicacao` | — |
| `siconv_termo_aditivo` | — |
| `siconv_obtv_convenente` | — |
| `siconv.zip` completo | 3 GB |

**Teste:** em `siconv_programa` (1,2 milhão de linhas) **não há programas de LIE nem de PRONON ou PRONAS** pelo nome. Eles estão no módulo Parcerias (B2.1).

**Uso no Jards:** útil para clientes com convênios e emendas, e para benchmark. Não é prioritário para leis de incentivo.

### B2.3 LIE

- Sem API pública localizada.
- O Decreto 12.861/2026, art. 30, prevê acesso do Ministério aos extratos do BB e da Caixa.
- O sistema é o SLI do Ministério do Esporte (ver `lie-federal-2026-web.md`).
- As fontes possíveis são:
  - **DOU** (portarias de aprovação e captação, via INLABS; ver B7);
  - **integração bancária do próprio proponente** (B6).

## B3. ANCINE: dados abertos (OCA)

- **Catálogo:** https://www.gov.br/ancine/pt-br/oca/dados-abertos (31 conjuntos). Página atualizada em 01/10/2026.
- **Arquivos:** servidos em `https://dados.ancine.gov.br/dados-abertos/<arquivo>.csv`.
  - Não há listagem de diretório: devolve 403.
  - A CKAN do dados.gov.br exige token.

**Testados (CSV `;`, UTF-8, sem autenticação)**

1. `projetos-com-renuncia-fiscal.csv`, com 4.322 linhas e cerca de 1,5 MB.
   - Campos: `NUMERO_SALIC`, `TITULO_PROJETO`, datas de aprovação e primeira liberação, **`SITUACAO_ATUAL`**, `MECANISMO`, captado por artigo (1º, 1ºA, 3º, 3ºA, 18, 25, 39, FUNCINES…), `TOTAL_CAPTADO`, `PROPONENTE`, `CNPJ_PROPONENTE`, UF e município.
   - Distribuição de situações (amostra integral):

| Situação | Projetos |
|---|---|
| P61 – PC FINAL – Aprovada | 2.015 |
| P01 – Encerrado Prazo de Captação | 573 |
| P66 – PC FINAL – Aprovada com ressalvas | 163 |
| **P77 – Tomada de Contas Especial Instaurada** | 141 |
| P90 – Recurso Recebido | 100 |
| P67 e P63 – Reprovada | 32 e 29 |
| U03 – RPC – Doc. recebido, aguarda análise | 39 |
| E20 – Inadimplente | 33 |

2. **`processos-em-prestacao-de-contas.csv`**, com 11.406 linhas e `Last-Modified` de 01/10/2026 (**atualização diária**).
   - Campos: `NUMERO_PROCESSO`, `NUMERO_SALIC`, `TITULO_PROJETO`, `RESPONSAVEL_PRESTACAO`, `CNPJ_RESPONSAVEL_PRESTACAO`.

3. `projetos-fsa.csv` (FSA, fomento direto), com 1,1 MB.

**Também listados no catálogo**
- "Relação de contribuintes que aplicaram em projetos com renúncia fiscal".
- Obras com fomento indireto (CPB com nº Salic).
- Agentes regulares.
- Bilheteria diária (útil como **evidência de objeto** de distribuição e exibição).

**Como o Jards usaria**
- Monitorar situação e fila de prestação de contas dos projetos audiovisuais do cliente pelo CNPJ.
- Detectar mudança para "Diligência", "TCE" ou "Inadimplente".
- Usar bilheteria e CPB como evidência de cumprimento do objeto.

## B4. Transparência, sanções e catálogos

### B4.1 TCU: Consulta Consolidada de Pessoa Jurídica (Certidões APF)

**Endpoint**

```text
GET https://certidoes-apf.apps.tcu.gov.br/api/rest/publico/certidoes/{CNPJ}?seEmitirPDF=false
```

- **Funciona sem chave.** Tempo de resposta inferior a 1 s.
- Devolve, por CNPJ:
  - TCU Inidôneos;
  - **CNJ CNIA** (improbidade e inelegibilidade);
  - **CEIS**;
  - **CNEP**.
- `situacao` assume `NADA_CONSTA` ou `CONSTA`.
- `seEmitirPDF=true` devolve a **certidão em PDF**, que serve para anexar ao dossiê.

```json
{"certidoes":[{"tipo":"Inidôneos","emissor":"TCU","situacao":"NADA_CONSTA"},
 {"tipo":"CNIA","emissor":"CNJ","situacao":"NADA_CONSTA"},{"tipo":"CEIS","situacao":"NADA_CONSTA"},
 {"tipo":"CNEP","situacao":"NADA_CONSTA"}],"cnpj":"07.495.643/0001-00",
 "razaoSocial":"FUNDACAO ORQUESTRA SINFONICA DO ESTADO DE SAO PAULO - FUNDACAO OSESP","seCnpjEncontradoNaBaseTcu":true}
```

**Uso:** checagem de sanções de cada fornecedor no momento do lançamento e **re-checagem na data do pagamento** (A6 #12), com PDF arquivado.

**Observação:** o endpoint de dados abertos do TCU `contas.tcu.gov.br/ords/condenacao/consulta/inidoneos` foi **bloqueado pelo WAF** a partir deste ambiente.

### B4.2 CGU: downloads diários de CEIS, CNEP e CEPIM (Portal da Transparência)

**Padrões de URL**
- `https://portaldatransparencia.gov.br/download-de-dados/{ceis|cnep|cepim}/{AAAAMMDD}`
- redireciona para `https://dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/cepim/20260928_CEPIM.zip`

**Teste:** funcionou sem chave. A página traz as datas disponíveis: CEIS de 01/10/2026 e CEPIM de 28/09/2026.

**CEPIM**
- 3.526 entidades impedidas.
- Campos: `CNPJ ENTIDADE`, `NOME`, `NÚMERO CONVÊNIO`, `ÓRGÃO CONCEDENTE`, `MOTIVO DO IMPEDIMENTO`.
- Exemplos de motivo: "INSTAURACAO DE TOMADA DE CONTAS ESPECIAL", "DESCUMPRIMENTO DE CLAUSULA".

**Uso**
- Base local, atualizada todo dia, para checagem em lote e sem limite de taxa.
- O CEPIM serve para checar o **próprio proponente** e OSCs parceiras ou executoras.

### B4.3 API do Portal da Transparência

- **Swagger:** `https://api.portaldatransparencia.gov.br/v3/api-docs` (lido).
- **Autenticação:** header `chave-api-dados`. Sem chave, devolve 401: "Chave de API não informada".
- **Cadastro gratuito com login gov.br:** https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email
- **Limites:** variam conforme a fonte, de 90/300 a 400/700 requisições por minuto (dia/madrugada) [busca; verificar ao cadastrar].

**Endpoints úteis**
- `/ceis`, `/cnep`, `/cepim` (por CNPJ);
- `/acordos-leniencia`;
- `/convenios` (por número, processo ou id);
- `/pessoa-juridica?cnpj=` (vínculos do CNPJ com o governo);
- `/notas-fiscais` e `/notas-fiscais-por-chave`: **apenas NF-e de compras do Executivo federal**, não as do proponente;
- `/renuncias-valor` e `/renuncias-fiscais-empresas-habilitadas-beneficios-fiscais`: renúncias por CNPJ, de utilidade limitada aqui.

**Uso:** é um complemento. O B4.1 e o B4.2 já cobrem as sanções sem chave.

### B4.4 Portal de Dados da Cultura (CKAN) e dados.gov.br

**dados.cultura.gov.br**
- API CKAN `/api/3/action/package_search` **funciona**.
- Dataset "Projetos do Pronac – Lei Rouanet – SALIC", modificado em 08/09/2026, aponta para a API Salic.
- **"Implementação e Execução da PNAB"** traz XLSX com:
  - adesão;
  - PAAR do Ciclo 1;
  - PAR do Ciclo 2 (2025);
  - **execução financeira do Ciclo 1**;
  - **extratos bancários do Ciclo 1** dos entes.
- **Uso:** contexto para os proponentes de editais PNAB. Por exemplo, o ente executou e pagou? Há atraso de repasse? Também serve para benchmark.

**dados.gov.br**
- A API de catálogo exige token (401).
- Os arquivos geralmente estão hospedados nos órgãos de origem, por isso o B3 e o B4.2 são acessíveis diretamente.

## B5. Documentos fiscais e cadastro de fornecedores

### B5.1 NF-e

**Consulta pública por chave**
- Fica em `nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx`.
- Exige **reCAPTCHA**. Automatizar contorna o captcha e **não é recomendável**.

**Caminho oficial automatizável: Distribuição de DF-e de interesse**
- Web service `NFeDistribuicaoDFe` do Ambiente Nacional. Respondeu 403 sem certificado, como esperado.
- O **proponente** (destinatário) autentica com **e-CNPJ A1** e recebe por NSU:
  - os resumos (`resNFe`) de todas as NF-e emitidas contra seu CNPJ;
  - o XML completo, depois da **Manifestação do Destinatário** (evento "Ciência da Operação").

**Uso no Jards:** importar automaticamente as NF-e recebidas pelo CNPJ do projeto, com fornecedor, itens, valores e chave. Casar com pagamento e rubrica, o que elimina digitação.
- **Requisito:** o cliente cede o certificado A1. É sensível: guardar em cofre e ter consentimento explícito.
- **Regras de consumo e limites** estão nas NTs do Ambiente Nacional [verificar].

**Validação offline da chave (sem rede)**

A chave da NF-e tem 44 dígitos:

| Campo | Posições |
|---|---|
| cUF | 2 |
| AAMM | 4 |
| CNPJ do emitente | 14 |
| modelo (55/65) | 2 |
| série | 3 |
| número | 9 |
| tpEmis | 1 |
| cNF | 8 |
| DV (módulo 11) | 1 |

Checagens possíveis:
- DV;
- CNPJ do emitente igual ao fornecedor lançado;
- **AAMM dentro da vigência**.

**CNPJ alfanumérico:** desde jul/2026 (IN RFB 2.229/2024, NT 2025.001), o CNPJ na chave pode ter letras. O cálculo do DV converte cada caractere pelo código ASCII menos 48.

### B5.2 NFS-e: Padrão Nacional

**Obrigatoriedade.** Desde **01/01/2026** (LC 214/2025), municípios devem:
- emitir pelo **Emissor Nacional**; ou
- **compartilhar** suas NFS-e com o **ADN** (Ambiente de Dados Nacional).

Na prática, a NFS-e do fornecedor de serviço passa a estar no ADN [busca].

**APIs oficiais**
- Listadas em https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao (página atualizada em 20/08/2026).
- **ADN Contribuintes:** `https://adn.nfse.gov.br/contribuintes/docs/index.html`, com `GET /DFe/{NSU}` para distribuição de documentos em que o CNPJ figura como prestador, **tomador** ou intermediário.
- **DANFSe:** `https://adn.nfse.gov.br/danfse/docs/index.html`.
- **SEFIN Nacional:** emissão.
- **CNC:** cadastro nacional de contribuintes.
- Exigem **certificado ICP-Brasil (mTLS)**. A conexão foi recusada neste teste.
- Segundo o manual do contribuinte [busca], aceitam certificado com o mesmo **CNPJ raiz**.
- Manual: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/manual-contribuintes-apis-adn-sistema-nacional-nfse.pdf

**Consulta pública (web):** https://www.nfse.gov.br/ConsultaPublica/. Funciona por chave ou por dados da DPS, mas usa **hCaptcha**. Não automatizar.

**Chave da NFS-e: 50 posições** [busca]

| Campo | Posições | Observação |
|---|---|---|
| cMun | 7 | |
| ambiente gerador | 1 | |
| tipo de inscrição | 1 | |
| CNPJ ou CPF | 14 | |
| nNFSe | 13 | |
| AAMM | 4 | |
| cNum | 9 | |
| DV | 1 | |

Permite as mesmas checagens offline da NF-e.

**Uso no Jards:** com o certificado do proponente, baixar automaticamente **todas as NFS-e tomadas** pelo CNPJ do projeto. Serviços são a maior parte das despesas em cultura e esporte. É o maior ganho de automação em documentos.

### B5.3 CNPJ, situação cadastral, CNAE e QSA

Testes com o CNPJ 27.349.187/0001-90 (locadora de vans de um projeto Rouanet).

| Serviço | URL | Autenticação e limite | Resultado |
|---|---|---|---|
| **BrasilAPI** | `https://brasilapi.com.br/api/cnpj/v1/{cnpj}` | Nenhuma; cache Vercel | Situação, `cnae_fiscal` e **`cnaes_secundarios`**, `qsa`, `opcao_pelo_simples`, `regime_tributario` |
| **Minha Receita** | `https://minhareceita.org/{cnpj}` | Nenhuma; `cache-control` de 1 dia | Mesmo esquema da BrasilAPI. É *open source* e pode ser auto-hospedado com a base da Receita. |
| **CNPJá open** | `https://open.cnpja.com/office/{cnpj}` | Nenhuma; limite por IP [verificar] | `status`, `mainActivity`, `sideActivities`, `company.members` (sócios, com CPF mascarado) |
| CNPJ.ws público | `https://publica.cnpj.ws/cnpj/{cnpj}` | **3 requisições por minuto** (`x-ratelimit-limit: 3`) | Detalhado, inclusive Simples |
| ReceitaWS | `https://receitaws.com.br/v1/cnpj/{cnpj}` | **3 requisições por minuto** | Clássico |
| **IBGE CNAE** | `https://servicodados.ibge.gov.br/api/v2/cnae/subclasses/{codigo}` | Nenhuma | Descrição e hierarquia, com observações sobre o que a classe compreende |
| Receita, base completa | `arquivos.receitafederal.gov.br/…/dados_abertos_cnpj` | — | **Inacessível** deste ambiente (reset de conexão) |

**Achado útil:** o fornecedor de "Veículo: Vans (Aluguel)" tem CNAE **principal** 7490-1/04 (intermediação e agenciamento). Os CNAEs **secundários** incluem 7711-0/00 (locação de automóveis) e 4923-0/02 (locação de veículos com motorista). A checagem de compatibilidade precisa olhar os secundários, ou gera falso positivo.

**Uso**
- Validar fornecedores: situação na data da NF, data de abertura e CNAE contra a rubrica.
- **Partes relacionadas:** cruzar o QSA do fornecedor com o QSA e os dirigentes do proponente.
- **Arquitetura recomendada:** cache próprio (Supabase) com TTL de cerca de 7 dias. BrasilAPI ou Minha Receita como fonte primária e CNPJá como *fallback*.
- **Para produção com SLA**, avaliar a API paga do SERPRO (Consulta CNPJ) [verificar] ou auto-hospedar o Minha Receita.
- Garantir suporte a **CNPJ alfanumérico**.

**Não automatizáveis por meio público**
- **CND federal (PGFN)** e **CRF/FGTS** usam captcha nas páginas públicas [verificar]. Solução: tratar como upload com data de validade e alerta de vencimento.
- O Salic já traz `certidoes_negativas` com validade, e o produto pode ler esse campo.

## B6. Bancos: extratos

### B6.1 Banco do Brasil, API Extratos (Portal Developers BB)

Fontes [busca]: página do produto (WAF bloqueou a leitura direta), Fortes Tecnologia e Omie.

**Requisitos**
- Exclusiva para **PJ** com conta corrente no BB.
- Contratação com o gerente.
- Cadastro no Portal Developers pelo responsável da conta.
- Credenciais: `client_id`, `client_secret` e **`gw-dev-app-key`**.
- **mTLS com certificado A1**.

**O que oferece**
- Lançamentos de débito e crédito e saldos parciais.
- Consulta retroativa de **até 5 anos** (segundo a Fortes).
- Só consulta contas do **CNPJ dono da aplicação**.

**Relevância**
- Rouanet, LIE e PRONON e PRONAS usam contas no BB.
- O **BB Gestão Ágil** (classificação de despesa por débito) aparece no Transferegov como `cd_programa_bb_agil`.

**Uso no Jards**
- Opção "conectar conta BB do projeto": o cliente registra a própria aplicação, e o Jards usa as credenciais dele.
- **Não** é um agregador multi-cliente simples, porque cada CNPJ precisa ser dono da aplicação. A UX de *onboarding* precisa de um passo a passo.
- **Teste:** não foi possível. O portal recusou TLS ou WAF a partir deste ambiente.

### B6.2 Caixa: Extrato Eletrônico para Conciliação Bancária (CNAB 240)

- **Manual:** https://www.caixa.gov.br/Downloads/extrato-eletronico-conciliacao-bancaria/Manual_de_Leiaute_CNAB_240_Extrato_Eletronico_Para_Conciliacao_Bancaria.pdf (baixado e lido, 17 p., maio/2022).
- **Padrão:** FEBRABAN CNAB 240, **Segmento "E"** nas versões 089, 040 e 030.
- **Envio:** por EDI (VAN ou transmissão direta). Periodicidade diária, semanal, quinzenal ou mensal. Há tarifa por registro.
- **API pública de extrato PJ da Caixa:** não localizada. O portal developers.caixa.gov.br deu 502.
- No Open Finance, a Caixa publica `accounts` e `customers-business` (B6.3).
- **Uso no Jards:** importador de arquivo CNAB 240 Segmento E, junto com **OFX**. É o caminho para as contas da LIE na Caixa.
- **Layout de referência:** FEBRABAN CNAB 240 v10.9: https://cmsarquivos.febraban.org.br/Arquivos/documentos/PDF/Layout%20padrao%20CNAB240%20V%2010%2009%20-%2014_10_21.pdf

### B6.3 Open Finance Brasil

**Diretório público**
- `https://data.directory.openbankingbrasil.org.br/participants` funciona sem autenticação: 104 organizações.
- BB e Caixa constam. A Caixa anuncia as famílias `accounts`, `customers-business`, `payments-pix` e outras.

**Acesso a dados de conta**
- Só **instituições autorizadas pelo BCB**, como receptoras, com consentimento do cliente, certificação FAPI e mTLS.
- O Jards **não** pode consumir diretamente. Precisaria de um **agregador regulado** como parceiro [verificar contratos e cobertura de contas PJ vinculadas].

**Ponto de atenção [inferência]:** contas vinculadas de projeto (captação bloqueada) podem ter disponibilidade diferente no Open Finance. Testar antes de prometer.

### B6.4 Formatos de arquivo

- **OFX**, exportado pelo internet banking.
- **CNAB 240**, Segmento E.
- **CSV** e **PDF**: este último por OCR, como último recurso.

O importador do Jards deve aceitar os três primeiros e normalizar para:

```text
{data, valor, D/C, histórico, documento, contraparte_cnpj?}
```

## B7. Outras fontes úteis

### Banco Central: SGS (`https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados?formato=json&dataInicial=dd/mm/aaaa&dataFinal=dd/mm/aaaa`)

Sem autenticação. Séries diárias exigem intervalo de datas: sem ele, a série 11 devolveu "Requisição inválida".

| Série | Conteúdo | Último valor testado |
|---|---|---|
| **433** | IPCA mensal | ago/2026 = −0,32 |
| **11** | Selic diária | 0,050788% em 30/09/2026 |
| **4390** | Selic acumulada no mês | set/2026 = 1,08 |
| **29543** | **Taxa Legal** (CC art. 406, Lei 14.905/2024, Res. CMN 5.171/2024): Selic menos IPCA, com piso zero | out/2026 = 0,379020 |
| **195** | Rendimento da poupança | Útil para estimar rendimentos devidos de saldo não aplicado |

**Uso:** calculadora de devolução da **Lei 14.903, art. 21 § 6º**:
- IPCA desde o fim da vigência;
- mais juros pela taxa legal;
- menos o período de atraso da administração.

Também serve para estimar o "rendimento que deveria existir", ligado a A6 #7.

### Banco Central: PTAX (Olinda)

- **Endpoint:** `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='MM-DD-AAAA'&$format=json`
- **Teste:** funciona. Em 30/09/2026, venda a 5,18090.
- **Uso:** converter invoices em moeda estrangeira (`tipo_documento` 6 no Salic; "Câmbio" no extrato PRONON) e checar a taxa aplicada.

### Feriados

- **Endpoint:** `https://brasilapi.com.br/api/feriados/v1/{ano}`. Funciona, com os feriados nacionais.
- Para feriados estaduais e municipais é preciso tabela própria.
- **Uso:** contar prazos em dias úteis quando a norma assim exigir.

### IBGE Localidades

- **Endpoint:** `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/{id}`. Funciona.
- **Uso:** normalizar `municipio_ibge` (Salic e Transferegov) e o local de realização para evidência geográfica.

### DOU

- **INLABS**: XML diário do DOU, com cadastro gratuito. Redireciona para login.
- **Base de dados de publicações:** https://www.in.gov.br/acesso-a-informacao/dados-abertos/base-de-dados
- **Uso:** detectar portarias de aprovação, prorrogação, readequação, homologação de captação e sanções da LIE, do PRONON e PRONAS, da Rouanet e da ANCINE, pelo nome do projeto, pelo PRONAC ou pelo CNPJ. É a **única fonte estruturável para a LIE**.

### Bancos (lista)

- **Endpoint:** `https://brasilapi.com.br/api/banks/v1/{codigo}`. Funciona.
- **Uso:** normalizar códigos de banco em OFX e CNAB.

## B8. Recomendações de arquitetura de integração (curtas)

1. **Camada de conectores com cache** no Supabase:
   - tabelas `ext_salic_projeto`, `ext_transferegov_extrato`, `ext_cnpj`, `ext_sancoes` etc.;
   - campos `fetched_at` e `hash`;
   - *jobs* agendados: diário para Salic, Transferegov e ANCINE; sanções da CGU por download diário; CNPJ com TTL de cerca de 7 dias.
2. **Idempotência e diff:** guardar o JSON bruto e gerar eventos de mudança, como `situacao` alterada ou novo lançamento no extrato.
3. **Robustez:**
   - Salic com *timeouts* longos (60 a 120 s) e *retry* com *backoff*: houve 503 em `sort` e *timeout* em `produtos`;
   - Transferegov e gov.br atrás de Cloudflare ou WAF podem bloquear IPs de nuvem. Rodar os conectores em infraestrutura com IP estável e monitorar 403.
4. **Normalização:** CNPJ e CPF como texto com zeros à esquerda, preparado para o alfanumérico. Datas com timezone. Valores em centavos.
5. **LGPD:**
   - CPFs de fornecedores pessoa física vêm sem máscara no Salic;
   - certificados A1 e credenciais bancárias exigem cofre, criptografia, consentimento e escopo mínimo;
   - nunca usar dados de terceiros fora do projeto do próprio cliente.

---

## Fontes

### Normas e decisões
- TCU, Acórdão 726/2026-Plenário (notícia): https://portal.tcu.gov.br/imprensa/noticias/tribunal-aponta-falhas-em-prestacoes-de-contas-na-area-da-cultura
- TCU, Acórdão 2089/2025-Plenário (notícia): https://portal.tcu.gov.br/imprensa/noticias/auditoria-avalia-gestao-das-prestacoes-de-contas-de-transferencias-voluntarias
- TCU, Acórdão 1318/2023-Plenário (notícia): https://portal.tcu.gov.br/imprensa/noticias/auditoria-analisa-eficiencia-da-lei-rouanet
- TCU, Resolução 344/2022: https://pesquisa.apps.tcu.gov.br/redireciona/norma/NORMA-21624
- TCU, *Convênios e outros repasses*, 6ª ed.: https://portal.tcu.gov.br/data/files/13/80/53/07/3F03071076A7C107E18818A8/Convenios_outros_repasses_6_edicao_inclui_errata.pdf
- Portaria Conjunta MGI/MF/CGU 33/2023: https://www.gov.br/transferegov/pt-br/legislacao/portarias/portaria-conjunta-mgi-mf-cgu-no-33-de-30-de-agosto-de-2023
- Portaria Conjunta MGI/CGU 41/2023: https://www.gov.br/transferegov/pt-br/sobre/analise-informatizada-dos-instrumentos-do-transferegov.br/portaria-conjunta-mgi-cgu-no-41-de-31-de-outubro-de-2023
- Lei 13.019/2014: https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l13019.htm
- Decreto 8.726/2016 (com o Decreto 11.948/2024): https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/decreto/d8726.htm
- Lei 14.903/2024: https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/l14903.htm
- Decreto 11.453/2023: https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/D11453.htm
- Decreto 12.861/2026 (LIE): https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/D12861.htm
- LC 222/2025: https://www.planalto.gov.br/ccivil_03/LEIS/LCP/Lcp222.htm
- Lei 14.905/2024 (CC art. 406): https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/l14905.htm

### Manuais e guias (Brasil)
- MinC, Manual do Proponente Módulo III (2026): https://www.gov.br/cultura/pt-br/centrais-de-conteudo/marcas-e-logotipos/marcas-rouanet/ManualdoProponenteModuloIIIAvaliacaodeResultados1.pdf
- MinC, legislação Rouanet: https://www.gov.br/cultura/pt-br/assuntos/lei-rouanet/textos/legislacao
- MinC, guia PNAB Ciclo 1 (dez/2025): https://www.gov.br/cultura/pt-br/assuntos/politica-nacional-aldir-blanc/politica-nacional-aldir-blanc/arquivos/materiais-de-orientacao/guias-manuais-e-cartilhas/dezembro2025_minc_guia-pratico-monitoramento-e-avaliacao-ciclo1-1.pdf
- Manual MROSC (2025): https://www.gov.br/transferegov/pt-br/osc/normativos/manual-mrosc
- ANCINE, Manual de Prestação de Contas: https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/manual-de-prestacao-de-contas
- FNS, Manual PRONON e PRONAS: https://portalfns.saude.gov.br/wp-content/uploads/2023/02/Manual-de-Orientacoes-PRONON-e-PRONAS.PCD-2-edicao-Verso-3.1.pdf
- Ministério do Esporte, modelos e manuais LIE: https://www.gov.br/esporte/pt-br/acoes-e-programas/lei-de-incentivo-ao-esporte/modelos-e-manuais
- CFC, ITG 2002 (R1): https://www1.cfc.org.br/sisweb/SRE/docs/ITG2002(R1).pdf
- CFC, NBC TG 07 (R2): https://www1.cfc.org.br/sisweb/SRE/docs/NBCTG07(R2).pdf
- CFC, NBC TA 800: https://www1.cfc.org.br/sisweb/SRE/docs/NBCTA800.pdf
- CFC, NBC TA 805: https://www1.cfc.org.br/sisweb/SRE/docs/NBCTA805.pdf
- CFC, Manual do Terceiro Setor: https://cfc.org.br/wp-content/uploads/2018/04/Publicacao_Terceiro-Setor.pdf
- CGU, Malha Fina (Agência Brasil): https://agenciabrasil.ebc.com.br/geral/noticia/2022-02/projeto-malha-fina-automatiza-analises-contas-cgu
- Malha Fina ANCINE (Farofafá): https://farofafa.com.br/2024/12/16/malha-fina-da-ancine-adota-ia-e-analise-de-riscos-para-zerar-passivo-de-prestacoes-de-contas-da-agencia/

### Internacional
- eCFR 2 CFR 200: https://www.ecfr.gov/current/title-2/subtitle-A/chapter-II/part-200
- 89 FR 30046 (2024): https://www.federalregister.gov/documents/2024/04/22/2024-07496/guidance-for-federal-financial-assistance
- 91 FR 32198 (proposta de 2026): https://www.federalregister.gov/documents/2026/05/29/2026-10817/regulation-for-federal-financial-assistance
- OMB Compliance Supplement: https://www.whitehouse.gov/omb/information-resources/guidance/compliance-supplement
- EU AGA v2.0: https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/common/guidance/aga_en.pdf
- UK GovS 015: https://www.gov.uk/government/publications/government-functional-standard-govs-015-grants

### APIs e dados (testados)
- Salic API e docs: https://api.salic.cultura.gov.br/docs e https://api.salic.cultura.gov.br/api/v1/projetos
- Transferegov, APIs novas: https://api-publica.transferegov.gestao.gov.br/ e https://api-publica.transferegov.gestao.gov.br/parcerias/docs
- Transferegov, CSV: https://repositorio.dados.gov.br/seges/detru/
- ANCINE, dados abertos: https://www.gov.br/ancine/pt-br/oca/dados-abertos
  - https://dados.ancine.gov.br/dados-abertos/projetos-com-renuncia-fiscal.csv
  - https://dados.ancine.gov.br/dados-abertos/processos-em-prestacao-de-contas.csv
- TCU Certidões: https://certidoes-apf.apps.tcu.gov.br/api/rest/publico/certidoes/{cnpj}?seEmitirPDF=false
- CGU, downloads: https://portaldatransparencia.gov.br/download-de-dados/cepim
- Portal da Transparência, Swagger: https://api.portaldatransparencia.gov.br/v3/api-docs
- Portal de Dados da Cultura: https://dados.cultura.gov.br/
- NFS-e APIs: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao
- NFS-e, consulta pública: https://www.nfse.gov.br/ConsultaPublica/
- Manual de APIs do contribuinte (ADN): https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/manual-contribuintes-apis-adn-sistema-nacional-nfse.pdf
- BrasilAPI: https://brasilapi.com.br/
- Minha Receita: https://minhareceita.org/
- CNPJá open: https://open.cnpja.com/
- IBGE APIs: https://servicodados.ibge.gov.br/api/docs
- BCB SGS: https://api.bcb.gov.br/dados/serie/bcdata.sgs.29543/dados/ultimos/3?formato=json
- BCB PTAX (Olinda): https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/
- Caixa, CNAB 240 Extrato: https://www.caixa.gov.br/Downloads/extrato-eletronico-conciliacao-bancaria/Manual_de_Leiaute_CNAB_240_Extrato_Eletronico_Para_Conciliacao_Bancaria.pdf
- BB API Extratos (página do produto): https://www.bb.com.br/site/developers/apis-para-o-seu-negocio/api-extratos/
- Fortes Tecnologia, API de Extrato BB: https://ajuda.fortestecnologia.com.br/kb/pt-br/article/416055/api-de-extrato-banco-do-brasil
- Open Finance, diretório: https://data.directory.openbankingbrasil.org.br/participants
- CNPJ alfanumérico (Agência Gov): https://agenciagov.ebc.com.br/noticias/202410/receita-federal-anuncia-que-cnpj-tera-letras-e-numeros-a-partir-de-julho-de-2026
- Taxa Legal (TRF4): https://www.trf4.jus.br/trf4/controlador.php?acao=pagina_visualizar&id_pagina=5220
- Imprensa Nacional, base do DOU: https://www.in.gov.br/acesso-a-informacao/dados-abertos/base-de-dados

### Arquivos brutos dos testes

As respostas brutas das APIs (Salic, Transferegov, ANCINE, CEPIM, Portal da Transparência) e os textos das leis usados nos testes ficaram na área temporária da sessão de pesquisa e não foram versionados. Para reproduzir, repita as chamadas descritas na Parte B.
