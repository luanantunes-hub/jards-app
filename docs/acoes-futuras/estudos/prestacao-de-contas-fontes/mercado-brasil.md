# Prestação de contas de projetos incentivados: análise de mercado no Brasil

**Data da pesquisa:** 01/10/2026
**Escopo:** softwares concorrentes e análogos ao módulo de prestação de contas do Jards (Rouanet, ANCINE, Lei de Incentivo ao Esporte, PRONON/PRONAS e mecanismos vizinhos).

---

## 0. Resumo executivo

1. **Ninguém resolve bem a prestação de contas do lado do proponente ou da consultoria, despesa por despesa, para várias leis ao mesmo tempo.** Há quatro grupos:
   - **plataformas de patrocinadores**: Prosas, Simbi, Incentiv, Bússola Investimento Social;
   - **gestão financeira de OSC/MROSC**: Bússola Financeiro, HYB, Gestor de Convênios;
   - **software de nicho de uma lei só**: IncentiVou (LIE), 2Movie e Profilme (ANCINE);
   - **consultorias com "plataforma" própria**: Valorize, Incentivo Certo, Smart Capta, PROJETE.
2. **O concorrente mais direto é o PROJETE (Projetus).**
   - Ainda está em desenvolvimento.
   - Promete o que o Jards precisa: despesa ligada ao comprovante e à meta, classificação pelas regras de cada instrumento, prazos e pendências.
   - Cobre Rouanet, LIE, PRONAS, PRONON, MROSC e outros.
   - Já tem 400+ organizações na plataforma atual.
3. **O IncentiVou Manager é o único que junta CRM de captação, pipeline, comissões, trilha de auditoria e prestação de contas.** Atende só a LIE.
4. **No financeiro de OSC, o mais avançado é o Bússola Financeiro** (lançado em 2026). Tem orçamento por projeto e fonte, rubricas configuráveis, alerta de desvio, conciliação automática e relatório por financiador. Não é específico de lei de incentivo.
5. **As plataformas de patrocinador monitoram metas, marcos, contrapartidas e indicadores ESG, não a despesa.**
   - Simbi: tem prestação de contas com conciliação, mas "exclusivo para investimento social privado".
   - Incentiv: tem aprovação de dados pela empresa e prova de contrapartidas com foto e vídeo.
6. **Os sistemas oficiais estão se digitalizando**, mas continuam lentos, rígidos e diferentes entre si:
   - Salic ganhou a aba Compliance, que confere lançamentos contra o extrato do BB;
   - a ANCINE usa o BB Gestão Ágil, que pré-preenche a Relação de Pagamentos, e lançou o Cine Bot (IA) em 08/2026;
   - PRONON/PRONAS e LIE migraram para o Transferegov.
   - O passivo é enorme: cerca de 30 mil prestações de contas pendentes no MinC, R$ 22 bi.
7. **Lacunas abertas:**
   - motor de regras por lei antes do envio;
   - exportação no formato do sistema oficial;
   - captura automática de NF-e e NFS-e emitidas contra o CNPJ do projeto;
   - conciliação das contas vinculadas;
   - gestão de diligências e glosas;
   - visão de carteira para consultorias;
   - ciclo contínuo captação → contrato → contrapartida → prestação → renovação.
8. **Vantagem estrutural do Jards:** ele já tem CRM, contas de patrocínio, ativações, entregas e um módulo de prestações com orçamento, comprovantes, atividades, divulgação, distribuição e relatório. Isso permite ocupar a posição que IncentiVou e PROJETE disputam, com cobertura multi-lei.

---

## 1. Método e limites

- **Como as páginas foram lidas.** O WebFetch estava bloqueado. As páginas foram lidas com `curl` e o script `busca.py`. Quando o site bloqueava, usei trechos do WebSearch.
- **Reclame Aqui.** Respondeu 403 (Cloudflare). As informações de lá vêm só de trechos de busca, marcados como "(trecho de busca)".
- **Jusbrasil.** Também bloqueou (Cloudflare). Usei o trecho de busca.
- **Legenda:**
  - **[?]**: não consegui confirmar. Indico a fonte do indício.
  - **"alegado"**: está no marketing do produto, sem demonstração ou review independente.
  - **"prometido"**: o próprio site diz que está em desenvolvimento.
- **Nomes parecidos.** "Incentive.me" (indomitum-design, campanhas de incentivo de vendas) **não é** a Incentiv (incentiv.me). As reclamações de "Incentive.me" no Reclame Aqui não se aplicam à Incentiv.
- **Preços.** Quase nenhum produto do nicho publica preço. Onde aparece valor, a fonte está indicada.
- **Regras das leis.** Os detalhes normativos (prazos, contas, tetos) estão nas outras notas desta pasta e só são citados aqui quando afetam o mercado:
  - `rouanet-in29-manual-olivieri.md`
  - `lie-federal-2026-web.md`
  - `ancine-str-logomarca-fsa-web.md`
  - `saude-regras-vigentes-2026-web.md`

---

## 2. Mapa do mercado

### 2.1 Segmentos

| Segmento | Quem paga | Exemplos | Relação com o módulo do Jards |
|---|---|---|---|
| A. Plataformas de investimento social (lado patrocinador) | Empresas, institutos, fundações, governo | Prosas, Simbi, Incentiv, Bússola Investimento Social, Bee The Change, Incentivo Certo | Definem o que o patrocinador pede ao proponente. Concorrem pelo "portal do patrocinador". |
| B. Ferramentas para proponente e consultoria em leis de incentivo | Proponentes, OSCs, consultorias | PROJETE, IncentiVou Manager, Plataforma Valorize, 2Movie e Profilme (audiovisual) | **Concorrência direta.** |
| C. Gestão de OSC e parcerias públicas (MROSC) | OSCs, prefeituras | Bússola Financeiro e Gestão, HYB, Gestor de Convênios, PSTGov, OSC Fácil | Concorrem quando o proponente é OSC com várias fontes de recurso. |
| D. Componentes horizontais análogos | Empresas em geral | Dynadok, VExpenses, Espresso, Paytrack, Qive, Nibo, Conta Azul, Omie, Granatum | Fonte de padrões de UX e de integrações. |
| E. Sistemas oficiais | Governo | Salic (+ API pública), SLI e Transferegov (LIE), SAD, STR e BB Gestão Ágil (ANCINE), Transferegov (PRONON/PRONAS, MROSC), Mapas Culturais e portais (LPG/PNAB) | Onde a prestação é de fato entregue. Determinam formatos e dores. |
| F. Captação e elaboração com IA (adjacente) | Proponentes, captadores | Capitaai, AprovAI (Brada), Conecta LIR | Não fazem prestação de contas. Disputam o mesmo cliente e ancoram preço baixo. |

### 2.2 Tabela comparativa

Legenda das células:
- **S**: confirmado no site ou em fonte;
- **P**: parcial, alegado ou prometido;
- **—**: não encontrado;
- **[?]**: indício não confirmado.

| Produto | Público principal | Leis/mecanismos | Orçamento por rubrica | Despesa + comprovante | Conciliação bancária | Metas/evidências | Contrapartidas | Relatórios | Integração com sistema oficial | IA/OCR | Workflow de aprovação | Portal do patrocinador | Preço público |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Prosas** | Patrocinador, governo | Editais ISP, chamamentos; BIP com Rouanet e leis estaduais/municipais | — | — [?] | — | S | — | S | Leitura de dados públicos (Salic, Receita) | — | S (seleção) | S (cliente é o patrocinador) | Não |
| **Simbi** (ex-Simbiose) | Patrocinador | Base de 215 mil iniciativas; incentivo + ISP | S (do investidor) | P (só ISP) | S (só ISP) | S | [?] | S | Leitura de dados públicos | S (IA para seleção e recomendação) | S (questionários e critérios) | S | Não |
| **Incentiv** (Monitoramento) | Patrocinador + proponente | Rouanet, LIE, FIA, Idoso, leis estaduais/municipais | — | — | — | S (marcos, métricas) | S (foto, vídeo, logomarca) | S (trimestral automático) | — | S (sugere métricas) | S (empresa aprova os dados, no Premium) | S | Taxa de sucesso 5–10% [?] |
| **Bússola** (Financeiro + Gestão + Investimento Social) | OSC + investidor | Convênios e termos de fomento; "Rouanet, LIE, Pronas/Pronon, FINEP" (lado investidor) | S (por projeto e fonte) | S | S (automática; mecanismo [?]) | S | [?] | S (por financiador) | — (due diligence em 20+ bases públicas) | [?] | P | S | Inscrições/Certificados a partir de R$ 39/mês; Financeiro sob consulta |
| **PROJETE** (nova fase) | OSC/proponente + financiador | Rouanet, LPG, Aldir Blanc, FIA, FUMCAD, Idoso, LIE, PRONAS, PRONON, Fomento/Colaboração, emendas | P (prometido) | P (prometido) | — | P (despesa → meta) | — | P | — | — | [?] | P (licença para financiador) | Mensalidade por faixa de projetos ativos (sem valor) |
| **IncentiVou Manager** | Empresa + executor + equipe interna | LIE | [?] | [?] | [?] | P (dossiê único) | [?] | S (ESG) | — | P (alegado) | S (trilha de auditoria, alertas) | S | Não |
| **Plataforma Valorize** | Proponente + patrocinador | LIE (foco) e outras | [?] | P (alegado) | [?] | P | [?] | P | — | — | [?] | P | Cadastro de projeto grátis |
| **Bee The Change** | Patrocinador + proponente | Rouanet, Audiovisual, LIE, FIA, Idoso, PRONON, PRONAS, ICMS, IPTU/ISS | P (budget anual por incentivo) | — | — | — | — | — | — | — | S (contrato e recibo automatizados) | S | Grátis para empresa; 3–6% do captado para proponente |
| **Incentivo Certo** (Think Projetos) | Patrocinador | Diversas | — | — | — | S | P (aprovar materiais) | S | — | — | S (aprovação de materiais) | S | Grátis para empresa |
| **HYB** | OSC | MROSC, convênios | S (rateio por projeto) | S | S (Open Finance) | S | — | S (contábeis MROSC) | — | — | [?] | — | Não |
| **Gestor de Convênios** | OSC, prefeitura | MROSC, convênios, contratos de repasse | P | P (pagamentos por competência) | — | S | — | S (Plano de Trabalho em PDF) | Leitura diária do Transferegov | — | — | — | Não (R$ 180/mês citado em fonte não identificada [?]) |
| **2Movie / Profilme.NET** | Produtora audiovisual | ANCINE (plano de contas), plataformas de streaming | S | S | P (CNAB no Profilme) | — | — | S (cost report) | — | — | S (Profilme: "questionamento" de custo) | — | Não |
| **Dynadok** | Empresa ou órgão com volume de documentos | Horizontal (marketing cita Rouanet e LPG) | — | S (validação) | S (extrato × pagamentos, alegado) | S (coerência físico-financeira, alegado) | — | — | NF-e na SEFAZ (alegado) | S | — | — | Por página processada |
| **VExpenses / Espresso / Paytrack** | Empresas | Horizontal | — | S | — | — | — | S | — | S (OCR, QR, duplicidade) | S | — | VExpenses: R$ 21/usuário ativo/mês |
| **Qive** | Empresas | Horizontal (NF-e, NFS-e, CT-e) | — | S (captura por CNPJ) | — | — | — | — | SEFAZ (S) | — | — | — | Sob proposta |
| **Nibo / Conta Azul / Omie / Granatum** | PMEs, contadores | Horizontal | P (centros de custo) | S | S | — | — | S | Open Finance, APIs bancárias | S (Nibo: IA em extrato PDF) | P | — | Planos públicos [?] |
| **Salic** (oficial) | Proponente, MinC | Rouanet | S (planilha aprovada) | S | S (Compliance × extrato BB) | S (comprovação física) | P (plano de distribuição) | S | — | — | S (análise MinC) | — | Gratuito |
| **SAD + STR + BB Gestão Ágil** (oficial) | Produtora, ANCINE | ANCINE/FSA | S | S | S (DE automático) | P | — | S (RP, DO, DE) | — | P (Cine Bot só orienta) | S | — | Gratuito |
| **Transferegov** (oficial) | OSC, proponente | MROSC, PRONON/PRONAS, LIE (fluxos) | S | S | S | S | — | S | — | — | S | — | Gratuito |

---

## 3. Fichas por produto

### A. Plataformas de investimento social (lado patrocinador)

#### 1. Prosas — prosas.com.br

| | |
|---|---|
| **Público** | Empresas, institutos e fundações (investimento social privado), órgãos públicos (chamamentos), e empreendedores sociais como inscritos. |
| **Escala (site)** | +R$ 4 bi destinados; +2.900 editais; +290 mil usuários; +365 mil propostas. |
| **Leis e mecanismos** | Editais próprios dos clientes, chamamentos públicos (Funarte SP e Funcultura aparecem nos depoimentos). O BIP lista "+20 mil projetos aprovados na Lei Rouanet" e projetos de leis estaduais e municipais. |
| **Preço** | Sob consulta. |

**Execução e prestação de contas**
- O módulo de **Monitoramento** traz:
  - metas e indicadores;
  - "cadastro de evidências" (fotos, vídeos, arquivos, textos por meta);
  - alertas por periodicidade;
  - gráficos a partir dos indicadores;
  - painel gerencial com todos os projetos;
  - "transparência … em uma página pública".
- **Prestação de contas financeira (despesa, comprovante, conciliação): não encontrei descrição.** O blog define "prestação de contas" como coleta de dados de impacto: fotos, vídeos, relatos. [?]
- **Integração com sistemas oficiais:** só leitura e cruzamento de dados públicos (Salic e Receita) no Painel da Lei Rouanet e no Programa de Dados, com "GAP Social" por empresa e dados de 16 mil empresas.

**Diferenciais**
- Maior rede de editais do país.
- Dados públicos organizados:
  - BIP;
  - Painel Rouanet por cidade;
  - Programa de Dados, com comunidade no WhatsApp.
- Consultoria em investimento social.

**Fraquezas e reclamações**
- Reclame Aqui (trecho de busca): 3 reclamações e 0% respondidas, sem reputação definida.
- Queixas de "plataforma não funciona" e perda de inscrição em edital por instabilidade.

**O que o Jards deve aprender**
- Evidência vinculada à meta, com página pública, é o "padrão mínimo" que o patrocinador conhece.
- Dados públicos de incentivadores (BIP e Programa de Dados) são produto em si. O Jards já tem base de patrocinadores e pode ligar essa inteligência à renovação de patrocínio.
- **Evitar:** chamar de "prestação de contas" o que é só monitoramento de impacto. O proponente sabe que a dor é a financeira.

---

#### 2. Simbi (ex-Simbiose Social) — simbi.social

| | |
|---|---|
| **Público** | Investidores sociais: "mais de 40 empresas, fundações e institutos". A OSC não paga e não há taxa de captação. |
| **Leis e mecanismos** | Incentivo fiscal e investimento social privado. Monitora "todos os portais oficiais": a base tem 215 mil iniciativas. Em 2022 a Artemisia falava em 18 legislações e +1 mil auditorias. |
| **Preço** | Planos Essencial e Modular, sob consulta. |

**Execução e prestação de contas**
- Gestão orçamentária do investidor: saldos disponíveis e histórico.
- Programa de Seleção, com página de edital.
- Questionários personalizados enviados às iniciativas.
- **Prestação de Contas** "exclusivo para investimento social privado": "relatórios, documentos e conciliação bancária reunidos em um só lugar".
- Dashboards.
- Mapa de Demanda Social.
- **Simbi IA:**
  - analisa inscrições;
  - recomenda onde investir;
  - faz busca em linguagem natural.
- Serviços de auditoria de OSCs.

**Diferenciais**
- Base de dados proprietária desde 2016.
- O projeto aprovado em lei de incentivo "aparece na Simbi … sem você precisar cadastrar".
- Auditoria de OSCs.
- Depoimento do IDIS: "facilitou muito o fluxo de análise de prestação de contas".

**Fraquezas**
- A prestação de contas com conciliação **não cobre projetos incentivados**, só ISP. A plataforma diz isso explicitamente.
- Não presta serviço ao proponente.
- Não encontrei reclamações públicas.

**O que o Jards deve aprender**
- O patrocinador já espera **conciliação bancária e documentos num só lugar**. Se o proponente entregar isso pronto pelo Jards, encaixa no fluxo do investidor.
- Importar automaticamente os dados públicos do projeto, em vez de pedir cadastro, é o padrão: a Simbi faz isso para descoberta.
- A IA foi aplicada à **seleção**, não à prestação. Isso deixa espaço livre.

---

#### 3. Incentiv (Monitoramento / Monitore) — incentiv.me

| | |
|---|---|
| **Público** | Marketplace entre empresas e proponentes, com versão básica de monitoramento para proponentes. |
| **Escala** | Mais de 6 mil projetos incentivados (site); cerca de R$ 88 mi mobilizados para 280 projetos (fonte Sitawi/Draft, data anterior). |
| **Leis e mecanismos** | Formulário do site lista Rouanet, LIE, FIA e Fundo do Idoso estaduais e municipais, e leis estaduais e municipais de cultura e esporte. |
| **Preço** | Para o proponente, modelo de sucesso de 5–10% do captado, segundo trecho de busca. [?] Não confirmado no site. |

**Execução e prestação de contas**
- **Gestão de Marcos:** relatórios trimestrais com marcos do período.
- **Gestão de Contrapartidas:** prova por foto ou vídeo em local específico.
- **Relatórios Trimestrais Automatizados**, gerados "com um clique".
- **Dashboard** ESG.
- **IA** que "sugere métricas e indicadores".
- **Pitch Day.**
- **Monitoramento Premium** (2024): métricas, marcos, contrapartidas e "aprovações de logomarca" cadastrados. A empresa **aprova os dados inseridos** pelo proponente.
- Monitoramento padrão em três etapas: Calibragem, Conexão, Avaliação & Fechamento.
- **Não encontrei módulo financeiro** (despesa, comprovante, conciliação). O guia de 2026 só dá recomendações de rotina.

**Diferenciais**
- Contrapartida tratada como objeto de primeira classe.
- Aprovação de logomarca pela empresa.
- Discurso de "monitoramento baseado em confiança", menos burocrático.

**Fraquezas**
- Não encontrei reclamações (cuidado com o homônimo Incentive.me).
- O financeiro fica fora.

**O que o Jards deve aprender**
- **Copiar:**
  - contrapartida com prova e aprovação do patrocinador;
  - aprovação de uso de logomarca;
  - relatório trimestral gerado automaticamente com marcos.
- Isso encaixa nos módulos "ativações" e "entregas" do Jards e no relatório para o patrocinador.

---

#### 4. Bússola Social (Gestão, Financeiro, Investimento Social) — bussolasocial.com.br

| | |
|---|---|
| **Público** | OSCs (+1.500) e investidores sociais. |
| **Leis e mecanismos** | Convênios, termos de fomento, ISP. Para investidores: "Organize investimentos realizados via leis de incentivo — como Lei Rouanet, Lei do Esporte, Pronas/Pronon e FINEP — com rastreabilidade total para auditorias". |
| **Preço** | Inscrições e Certificados a partir de R$ 39/mês, com plano grátis e 20% de desconto anual. Financeiro tem teste de 7 dias e condições sob consulta. Gestão, Editais e Investimento Social têm preço personalizado. |

**Bússola Financeiro (lançado em 2026)**
- Orçamento por projeto e **fonte de recurso**, com **rubricas personalizáveis** e múltiplas fontes por projeto.
- **Alertas de desvio** e saldo em tempo real.
- Planejado × realizado.
- Prestação de contas "automática" e relatório por financiador.
- Arquivo eletrônico.
- **Conciliação bancária automática** (mecanismo [?]).
- Integração com o ecossistema ("em breve").

**Bússola Gestão**
- Beneficiários, atividades com participantes e evidências.
- Indicadores.
- **App do Educador**, para registro em campo.

**Bússola Investimento Social**
- Edital ou chamada direta.
- **Due diligence automática em mais de 20 bases públicas** em menos de 2 minutos: Receita, PGFN, CEIS, CNEP, TCU, CAUC, SICONV, TRFs, cartório de protestos.
- "Prestação de contas vinculada a cada parcela".
- "Execução orçamentária por rubrica".
- Recebe e consolida a prestação de contas de todas as OSCs.

**Diferenciais**
- Conhece os dois lados: quem repassa e quem executa.
- Interface sem jargão contábil.
- Suporte humano às OSCs durante os editais.

**Fraquezas**
- Não é específico das regras de cada lei (tetos, vedações, formatos oficiais).
- O Financeiro é novo.
- Não encontrei reclamações.

**O que o Jards deve aprender**
- **Copiar:**
  - o modelo **projeto × fonte de recurso × rubrica**;
  - o alerta de desvio orçamentário;
  - a **due diligence automática de regularidade** (certidões, CAUC, CEIS), útil para habilitação e para a prestação, que exige certidões válidas;
  - a linguagem "para gestores, não para contadores".
- O teste grátis self-service no Financeiro é um padrão de aquisição que o Jards pode usar no módulo.

---

#### 5. Bee The Change — beethechange.com.br

| | |
|---|---|
| **Público** | Empresas de lucro real (grátis) e proponentes clientes (com contrato e taxa). |
| **Leis e mecanismos** | Rouanet, Audiovisual, LIE, FIA, Fundo do Idoso, PRONON, PRONAS, ICMS, IPTU/ISS. |
| **Preço** | Para o proponente, 3% a 6% sobre o captado via plataforma, conforme o incentivo. |

**Funcionalidades**
- A empresa cadastra o **orçamento anual**. O sistema faz uma "distribuição inicial de verba por incentivo fiscal".
- Match por política de ISP.
- Ao manifestar intenção de patrocínio, o fluxo é "todo automatizado":
  - contrato com o proponente;
  - orientação de depósito na conta do projeto;
  - **emissão de recibo oficial**;
  - gestão dos patrocínios.
- **Não há prestação de contas.**

**O que o Jards deve aprender**
- Automatizar o trecho **intenção → contrato → depósito → recibo** com checagem de conta vinculada. É a ponte entre o CRM do Jards e a prestação.
- A distribuição do orçamento fiscal do patrocinador por mecanismo é uma boa ferramenta de venda ("quanto você pode destinar").

---

#### 6. Incentivo Certo 360 (Think Projetos) e Smart Capta

**Incentivo Certo 360**
- Painel grátis para a empresa acompanhar o andamento, **acessar documentos, aprovar materiais e avaliar resultados**.
- Projetos validados com a Grant Thornton em cerca de 70 itens.

**Smart Capta**
- Marketplace (Rouanet, LIE).
- Fluxo da marca: diagnóstico fiscal grátis, curadoria, negociação e "acompanhamento das contrapartidas, impacto e prestação de contas". A prestação aqui é **serviço**, não software.
- Promete "relatórios de execução, métricas de alcance, contrapartidas auditáveis".

**O que o Jards deve aprender**
- O mercado vende "auditável e rastreável" ao patrocinador como diferencial.
- **Aprovação de materiais de divulgação** pelo patrocinador é recorrente: Incentiv faz aprovação de logomarca e Incentivo Certo faz aprovação de materiais. Isso deve existir no módulo de divulgação do Jards.

---

### B. Ferramentas para proponente e consultoria (concorrência direta)

#### 7. PROJETE (Projetus) — projete.org

| | |
|---|---|
| **Público** | OSCs e proponentes; financiadores e gestores de fomento (licenciamento para institutos, empresas, órgãos públicos, procuradorias e tribunais de contas). |
| **Leis e mecanismos (site)** | Rouanet, Lei Paulo Gustavo, Aldir Blanc, FIA, FUMCAD, Fundo do Idoso, LIE, PRONAS, PRONON, Termo de Fomento, Termo de Colaboração, emendas parlamentares. |
| **Estado** | A plataforma atual (estruturação e escrita de propostas) tem +400 organizações. A **"nova fase" de prestação de contas está em desenvolvimento**, com validação junto a clientes. |
| **Preço** | Para organizações, "mensalidade por faixa, definida pelo número de projetos ativos, com entrada acessível". Para financiadores, licenciamento. |

**Funcionalidades prometidas (seis)**
1. Repositório por projeto com histórico de alterações.
2. Despesa associada ao comprovante e "classificada de acordo com as regras do instrumento de financiamento".
3. Calendário de obrigações com alertas.
4. **Vínculo de cada despesa à meta e à atividade.** O mock mostra "NF 4471 · Serviço de oficina · 12.400,00 · Meta 2 · Formação" e a frase "o vínculo que o avaliador cobra".
5. Relatórios de execução.
6. "Identificar pendências" com alertas e orientações.

**Diferenciais**
- Credibilidade operacional: 8 anos, +580 projetos, R$ 435 mi "com prestação de contas aprovada", 2.660 organizações atendidas.
- A narrativa de dor usa dados oficiais (MinC, CNPq, CGU, TCU).

**Fraquezas**
- Ainda não existe como produto de prestação de contas.
- Não menciona conciliação, OCR nem integração com sistema oficial.

**O que o Jards deve aprender**
- É o concorrente que define a régua. **A despesa ligada à meta e às regras do instrumento será o mínimo esperado.**
- O preço por número de projetos ativos é natural para consultorias.
- O Jards deve chegar antes com:
  - conciliação;
  - captura de NF;
  - exportação no formato oficial;
  - CRM.
  Nada disso está no roadmap público do PROJETE.

---

#### 8. IncentiVou Manager — incentivou.com.br

| | |
|---|---|
| **Público** | Empresas incentivadoras, executores (OSCs, clubes) e equipe interna. |
| **Leis** | Lei de Incentivo ao Esporte. |
| **Preço** | Não público. O site é consultoria + plataforma, com planos de serviço (Start, Projeto Aprovado, Captação, Execução Segura, Esporte 360°). |

**Funcionalidades declaradas**
- Matchmaking, marketplace e simuladores (potencial de dedução da empresa; aptidão do executor).
- "IA & Dados" ("prever, recomendar e proteger"), sem detalhe. [?]
- Alertas inteligentes (prazos e riscos).
- Relatórios ESG.
- **Acesso da equipe:** "gestão geral de projetos, empresas, **pipeline de captação, CRM de incentivo**, contatos, histórico de negociação, **comissões** e dashboard de performance".
- **Compliance:** "trilha de auditoria, validação documental, controle de acesso, alertas de prazo e **dossiê único do projeto**".
- Para executores: "Execução Segura: monitoramento para evitar glosas".

**Diferenciais**
- É o desenho de produto mais próximo do Jards: CRM + captação + comissões + prestação.

**Fraquezas**
- Uma lei só.
- Funcionalidade de prestação descrita de forma genérica.
- Marca nova: perfis sociais recentes, sem reviews.

**O que o Jards deve aprender**
- Validação: o mercado de LIE já pede "CRM de incentivo + dossiê único + trilha de auditoria".
- **Copiar:** o "dossiê único" (pacote final do projeto) e o simulador de aptidão como porta de entrada.
- **Diferenciar:** multi-lei e profundidade financeira.

---

#### 9. Plataforma Valorize (Valorize Projetos) — valorizeprojetos.com.br

| | |
|---|---|
| **Público** | Patrocinadores e proponentes, principalmente de LIE, com execução também de Rouanet e outras. |
| **Preço** | Cadastro de projeto grátis; serviços sob consulta. |

**Funcionalidades (blog, 22/06/2026)**
- Centralização da operação.
- Organização documental.
- "Controle financeiro e acompanhamento de indicadores".
- "Prestação de contas estruturada".
- Rastreabilidade e governança.

Não encontrei telas, documentação nem detalhe operacional. São alegações. [?]

**O que o Jards deve aprender**
- O discurso para a empresa patrocinadora é **governança, compliance e ESG** (áreas financeiro, jurídico, ESG e fornecedores "em fluxos paralelos").
- O relatório do Jards para o patrocinador deve falar com essas áreas.

---

#### 10. Audiovisual: 2Movie (Foconet) e Profilme.NET

**2Movie**
- "Planos de contas Netflix, Amazon Prime, Ancine, Disney+".
- Importação de orçamento do Movie Magic ou do Excel.
- Versões do orçamento aprovado.
- Cost Report, Cash Flow e Trial Balance.
- Multimoeda.
- "Controle o orçamento e trabalhe de acordo com as regras da Ancine: prestações de contas, pagamentos, relatórios".

**Profilme.NET**
- "Prestação de Contas de Projetos Incentivados: Conformidade com IN vigente".
- Adiantamento de produção.
- Liberação e conferência de custos "a pagar", com ferramenta de questionamento.
- Pagamentos com arquivo CNAB e retorno.
- NFS-e.
- Múltiplas contas bancárias de projetos.
- Auditoria.

**Preço:** sob consulta nos dois.

**Fraquezas**
- Focados na produtora, não em Rouanet, LIE ou saúde.
- Não encontrei exportação direta para STR nem BB Gestão Ágil. [?]

**O que o Jards deve aprender**
- **Versionar o orçamento aprovado** (aprovado, remanejado, readequado).
- **Plano de contas por financiador**: o mesmo gasto mapeado para rubricas diferentes.
- Fluxo "questionar custo antes de pagar".
- No audiovisual, quem faz prestação de contas é o *controller*. O Jards deve ter perfil de usuário e permissões para esse papel.

---

#### 11. Adjacentes de captação com IA: Capitaai, AprovAI (Brada), Conecta LIR

**Capitaai**
- Radar de editais em 50+ portais, com contagem ao vivo.
- **Fit score** por edital: "qual certidão trava e quanto vale resolver".
- Rascunho de projeto ancorado em "1.005 aprovados reais".
- 11 trilhas de constituição de OSC.
- **R$ 97 por ano**; captador paga R$ 97 por cliente por ano.
- Não faz prestação de contas. Só promete que "a nota fiscal sai com descrição que serve pra prestação de contas".

**AprovAI (Brada, 2024)**
- "ChatGPT dos editais" para redação de projetos.

**Conecta LIR**
- Lei de Incentivo à Reciclagem.
- IA para match.
- "Automatiza o compliance documental".

**O que o Jards deve aprender**
- **Âncora de preço muito baixa** na captação (R$ 97/ano). O valor do Jards precisa vir da gestão e da prestação de contas, onde a dor e o risco são maiores.
- **Copiar do Capitaai:**
  - a transparência operacional ("/status" público das fontes);
  - o padrão "fit score + o que falta para chegar a 100%". Aplicado à prestação: "prontidão para envio: 82%, faltam 3 extratos e 2 notas sem Pronac".

---

### C. Gestão de OSC e parcerias públicas

#### 12. HYB (Conplan) — hyb.com.br

| | |
|---|---|
| **Público** | OSCs: APAEs, fundações, institutos de saúde, educação e assistência. +300 organizações, no mercado desde 2009. |
| **Leis e mecanismos** | MROSC, convênios, SUS (BPA/APAC). |
| **Preço** | Sob consulta, com implantação assistida. |

**Funcionalidades**
- "Metas, tarefas, evidências e orçamento por projeto, com a segregação de contas que o MROSC exige".
- Orçamento, fluxo de caixa e contas a pagar.
- **Conciliação bancária via Open Finance, com rateio por projeto.**
- Relatórios contábeis (balancetes, razões) compatíveis com MROSC.
- ISO 27001 e 27701, AWS Brasil.

**Fraquezas**
- Reclame Aqui (trecho de busca, 12/2022, empresa Conplan): "Software HYB não entrega as funcionalidades do programa", com suporte que não resolve.
- Não é específico de leis de incentivo.

**O que o Jards deve aprender**
- **Rateio** de uma despesa entre projetos ou fontes.
- **Certificação ISO 27001/27701** como argumento de venda para instituições. PRONON e PRONAS envolvem dados de saúde.
- Implantação assistida reduz churn em público pouco digital.

---

#### 13. Gestor de Convênios — gestordeconvenios.com.br

| | |
|---|---|
| **Público** | OSCs, fundações, institutos, prefeituras e consórcios. |
| **Leis e mecanismos** | MROSC (Lei 13.019/2014, Decreto 11.531/2023), convênios, contratos de repasse. |
| **Preço** | Demo grátis. Um trecho de busca cita R$ 180/mês, de fonte não identificada. [?] |

**Funcionalidades**
- **Dados do Transferegov atualizados todos os dias**: +200 programas, cerca de 5.500 municípios.
- Captação dirigida por CNPJ e natureza jurídica.
- **Plano de Trabalho em PDF "num clique"** com dados do convenente e do IBGE.
- "Prestação estruturada por competência, com metas e pagamentos no convênio". A dor citada é "prestação de contas remontada do zero quando o responsável sai".
- Alertas de CAUC e CADIN.
- Templates de declarações.

**O que o Jards deve aprender**
- Duas dores bem formuladas:
  - **continuidade quando o responsável sai**, que pede histórico e trilha;
  - **bloqueios de regularidade sem aviso** (CAUC e certidões).
- A geração de documentos com dados pré-preenchidos é barata e muito valorizada.

---

#### 14. Outros do segmento C (citados, não aprofundados)

- **PSTGov:** sistema para órgãos públicos gerirem convênios e parcerias com OSCs, com prestação de contas e monitoramento. Público governo.
- **OSC Fácil:** "atendimento à Lei 13019", para prefeituras e entidades. Só trecho de busca. [?]
- **Softagon (Plataforma Cultural)** e **Placarsoft (módulo Projetos de Incentivo):** produtos para secretarias municipais (mapa cultural, mecenato municipal; gestão esportiva com projetos de incentivo).
  - O FAQ da Placarsoft pergunta "O sistema gera relatórios para prestação de contas?", mas a resposta não foi lida. [?]
  - Mostram que o lado governo municipal também está se digitalizando: LPG, PNAB e leis municipais.

---

### D. Componentes análogos (padrões para copiar)

#### 15. Dynadok (validação documental com IA) — dynadok.com

**Alegações do blog (25/09/2026), voltado a leis de incentivo**
- Valida autenticidade da NF-e "direto na SEFAZ".
- Checa se o CNPJ do emissor bate com o fornecedor esperado e se o valor corresponde ao item orçamentário.
- **Detecta notas e RPAs duplicados.**
- Checa coerência entre relatório físico e fotos.
- Cruza extratos com a relação de pagamentos.
- Checa vigência de certidões.
- "Até 95% do tempo de conferência manual" economizado.
- Cita as três irregularidades que o TCU mais encontra:
  - pagamento sem comprovação do serviço;
  - documento duplicado;
  - falta de transparência na movimentação.

**Modelo:** API e preço por página processada. Cases fora do nicho: Cogna, Cenibra, Unicesumar.

**O que o Jards deve aprender**
- Essas checagens são o "pré-auditor" que falta ao proponente.
- O Jards pode implementá-las com regras próprias por lei, ou usar um provedor como a Dynadok via API para NF-e e duplicidade.

#### 16. Gestão de despesas: VExpenses, Espresso, Paytrack

**VExpenses**
- OCR "Intelliscan" preenche valor, data e estabelecimento.
- Auditoria automática "Hórus".
- Assistente que lança despesa por voz, texto ou imagem.
- Aprovação de relatórios pelo app.
- **R$ 21 por usuário ativo por mês.** Aprovadores não pagam.
- Reclame Aqui (trecho de busca): 5 reclamações, sobre suporte lento e cadastro.

**Espresso**
- OCR ou **QR code** da nota.
- Validação pela "Barista IA" contra a política.
- **Identifica recibos duplicados e palavras proibidas.**

**Paytrack**
- Validação por IA e OCR.
- Reembolso por Pix.
- Integração com ERP, Uber e 99.

**O que o Jards deve aprender**
- **Captura no celular** (foto ou QR da NFC-e).
- **Política como regra executável:** a "política" aqui é a IN ou portaria da lei.
- **Duplicidade.**
- **Aprovação em lote no app.**
- Cobrar por quem lança e não por quem aprova é um modelo amigável para patrocinadores e conselheiros.

#### 17. Captura de NF-e e NFS-e: Qive (ex-Arquivei)

- Conexão com a SEFAZ: **toda NF-e e CT-e emitida contra o CNPJ aparece automaticamente**, com NFS-e suportada.
- Extração de valores, impostos e partes.
- Manifestação do destinatário.
- Preço sob proposta. Um comparativo de terceiro cita uma proposta de R$ 1.139/mês com conector SAP. [?]
- Reclame Aqui (trecho de busca): 11 reclamações, sobre suporte, login e falha de captura com Bling e Mercado Livre.

**O que o Jards deve aprender**
- Para projetos com **CNPJ próprio ou conta vinculada**, a captura automática elimina a digitação.
- A **manifestação do destinatário** ajuda a provar a operação.
- Nenhum concorrente do nicho faz isso.

#### 18. Financeiro e conciliação: Nibo, Conta Azul, Omie, Granatum

**Nibo**
- Conciliador Open Finance: 20+ bancos.
- Robôs sugerem conciliação.
- **IA importa extrato em PDF.**
- Modo "financeiro", para cliente e contador, e modo "contábil".

**Conta Azul**
- Centros de custo por projeto.
- Conciliação automática.
- Atende ONGs.
- **Reclame Aqui (trechos de busca):**
  - integrações com Itaú e Santander quebrando;
  - Pix que não concilia com boleto;
  - conciliação "de 20 em 20 lançamentos" inviável com volume.

**Omie**
- Importação de extrato.
- Integração com o Banco do Brasil via API, que exige certificado A1 e contrato com o gerente.

**Granatum**
- Plano único com conciliação e planejamento orçamentário por centro de custo. Só trecho de busca. [?]

**O que o Jards deve aprender**
- **Tela de conciliação em duas colunas** (extrato à esquerda, lançamentos à direita), com sugestão automática e aceitação em lote.
- **Importar OFX, CSV e PDF desde o início.** Integração bancária via API quebra com frequência; não apostar só nela.
- O Salic já faz uma conciliação parecida no Compliance. O proponente reconhece o padrão.

#### 19. BB Gestão Ágil (Banco do Brasil) — usado pela ANCINE e pelo FNDE (PDDE)

- O responsável **associa cada pagamento a um item orçamentário** e informa os dados do documento fiscal sobre as transações da conta.
- Para projetos com conta aberta pela ANCINE após 01/01/2020:
  - o STR gera a **Relação de Pagamentos pré-preenchida**;
  - o **Demonstrativo do Extrato é montado automaticamente**.

**O que o Jards deve aprender**
- O modelo mental oficial é **"transação bancária → item orçamentário → documento fiscal"**. O Jards deve começar do extrato, e não do comprovante solto.

#### 20. Assinatura e coleta de evidências

- Não pesquisei a fundo assinadores (Clicksign, ZapSign, D4Sign). [?]
- Duas notas relevantes:
  1. Ao menos uma regra de 2026 pode restringir assinaturas eletrônicas "informais" na LIE. A Portaria MESP 10/2026 aparece citada assim num trecho de busca, sem confirmação. [?] O Jards deve suportar **assinatura gov.br ou ICP-Brasil** onde a norma exigir.
  2. A coleta em campo (presença, fotos) já é produto em Bússola (App do Educador) e Incentiv (contrapartidas). Ninguém confirma **metadados verificáveis** como data e hora, geolocalização ou hash. [?]

---

### E. Sistemas oficiais (referência de fluxo e fonte de dores)

#### 21. Salic (Rouanet)

**Funções**
- Toda a execução e prestação é online. A comprovação financeira é feita **sobre os débitos do extrato do Banco do Brasil**, com o comprovante anexado a cada débito.
- A aba **Compliance** "confere se o que foi lançado pelo proponente está de acordo com a movimentação da conta no Banco do Brasil".
- O app **SalicMobile** permite acompanhar o projeto e enviar documentos e notas.
- **API pública de leitura**: api.salic.cultura.gov.br.
  - Testada em 01/10/2026: `/api/v1/projetos` responde.
  - Traz valores solicitado, aprovado e captado, datas, situação, fornecedores por PRONAC, incentivadores e doações.
  - A documentação mostra produtos de fornecedor com `id_comprovante_pagamento` e `id_planilha_aprovacao`.
  - **Não há API de escrita** para comprovação. [?] Nada encontrado.

**Dores**
- Lentidão para carregar planilhas.
- "Bugs" e inconsistências (Elaborando Projetos, 2024).
- Quedas em prazos críticos: retirada do ar após tentativa de ataque hacker (Cultura e Mercado) e queda no último dia de inscrições (Poder360). Os anos desses episódios não foram confirmados. [?]
- Rigidez: o sistema "não permite informações adicionais ou demonstrar o que foi pago" e só funciona bem "se não houver alterações aos fatos e orçamentos aprovados" (trecho de busca do artigo Jusbrasil "Novo SALIC").
- **Passivo de cerca de 30 mil prestações pendentes, R$ 22 bi** (TCU, via imprensa).
- A IN 29/2026 fixa análise preferencialmente em 6 meses após o envio, segundo trecho de busca do Instituto DEA. [?]

**Implicação para o Jards**
- O proponente vai continuar digitando no Salic.
- O valor do Jards está em:
  - chegar ao Salic com tudo **conciliado e validado**;
  - manter o dossiê para a análise que pode vir anos depois;
  - usar a API pública para **pré-preencher** o projeto.

#### 22. Lei de Incentivo ao Esporte (SLI e Transferegov)

- O SLI cobre cadastro, submissão, captação e recibos.
- A página "LIE" do Transferegov descreve fluxos de Remanejamento, Termo Aditivo, PCP, PCF e Gestão de Contas.
- **Prestação final em 60 dias** (Decreto 12.861/2026).
- Teto de 15% para custos administrativos (trecho de busca).
- Ver `lie-federal-2026-web.md` para as incertezas sobre qual sistema recebe a prestação em 2026.

**Dores (consultorias)**
- Gasto fora da rubrica.
- Nota inconsistente ou ilegível.
- Contrato sem assinatura.
- Serviço sem prova de entrega.
- Pagamento em espécie.
- Falta de lista de presença ou fotos.
- Alteração sem autorização.
- Extrato incompleto.
- Relatório técnico incoerente.

São quase todas **checáveis por software**.

#### 23. ANCINE (SAD, STR, BB Gestão Ágil, Cine Bot, Cadastro Único)

- O STR recebe as planilhas RP, DO e DE e aponta "críticas".
- O BB Gestão Ágil pré-preenche a RP e gera o DE.
- O **Cadastro Único de Projetos** (01/2025) unifica a carteira e digitaliza remanejamentos.
- O **Cine Bot** (06/08/2026) é assistente de IA que responde dúvidas sobre prestação de contas com base nas normas internas.
- A ANCINE levava em média 1.168 dias para analisar prestações com prazo regulamentar de 180 (trecho de busca sobre auditoria TCU). [?]

**Implicação para o Jards**
- O próprio governo passou a usar IA para orientar o proponente. Um assistente do Jards ancorado no manual **e nos dados do projeto** vai além disso.

#### 24. PRONON/PRONAS e MROSC (Transferegov) e LPG/PNAB (Mapas Culturais e portais)

- **PRONON/PRONAS:**
  - habilitação e propostas migraram para o Transferegov (2024/2025);
  - prestação "poderá" correr lá;
  - planilha de conciliação com referência a SEI (ver `saude-pronon-pronas-manual-2019.md`).
- **Transferegov:** complexo. Existe um mercado de cursos de 40 horas só para operá-lo (Orzil, Squadra), o que é um indicador de dor de UX.
- **LPG/PNAB:** prestação em dois níveis. O agente cultural presta ao município, muitas vezes pelo **Mapa Cultural** ou portal local, e o município presta à União pelo Transferegov.

---

## 4. Lacunas que nenhum concorrente resolve bem (oportunidades)

1. **Motor de regras multi-lei aplicado à despesa, antes do envio.**
   - PROJETE promete; Bússola tem rubricas e alertas genéricos; IncentiVou é só LIE; 2Movie é só ANCINE.
   - Ninguém confirmado checa, por lei:
     - período de execução;
     - rubrica aprovada;
     - tetos percentuais;
     - meio de pagamento;
     - Pronac, SIPAR ou nome do projeto no documento;
     - fornecedor parte relacionada;
     - certidão vigente.
2. **Saída no formato do sistema oficial.**
   - Nenhum produto confirmado gera planilhas STR (RP, DO, DE), "Planilha II" do PRONON/PRONAS, relação de pagamentos da LIE ou anexos MROSC prontos.
   - Hoje o proponente redigita.
3. **Começar pelo extrato da conta vinculada.**
   - O padrão oficial (Salic Compliance, BB Gestão Ágil) é "débito → item → documento". Os concorrentes do nicho começam pelo comprovante.
   - Conciliação existe só em ferramentas genéricas (Bússola, HYB, Nibo) ou no ISP (Simbi).
4. **Captura automática de NF-e e NFS-e por CNPJ ligada ao projeto.** Comum em ERP (Qive); ausente no nicho.
5. **Diligências e glosas.**
   - Ninguém oferece gestão item a item das diligências: prazo, resposta, anexos, histórico, reapresentação, cálculo de valor glosado, devolução corrigida.
   - A análise pode chegar anos depois (passivo de cerca de 30 mil processos), e a memória do projeto se perde quando a equipe muda.
6. **Ciclo único captação → contrato e recibo → contrapartidas → execução → prestação → renovação.**
   - Os dados se repetem entre marketplace, CRM, planilha e sistema oficial.
   - Só o IncentiVou (LIE) tenta juntar CRM e execução.
7. **Carteira para consultorias e captadores.**
   - Uma consultoria cuida de dezenas de projetos de clientes diferentes.
   - Falta painel de saúde da prestação por projeto e cliente, com fila de pendências, SLAs e prazos oficiais.
   - PROJETE e Capitaai aceitam várias contas ou clientes, mas sem essa visão.
8. **Evidência verificável e conformidade de marca.**
   - Fotos e listas existem (Incentiv, Bússola), sem metadados confiáveis.
   - Ninguém confere automaticamente a aplicação das marcas: manuais de marca Rouanet e LIE, **defeso eleitoral de 2026**.
9. **Assistente de IA ancorado na norma e no projeto.**
   - IA hoje: seleção (Simbi), métricas (Incentiv), redação (Capitaai, AprovAI), Q&A normativo genérico (Cine Bot) e validação horizontal (Dynadok).
   - Falta o "pré-auditor" que explica, para cada pendência, a regra e a correção.
10. **Portal do patrocinador emitido pelo proponente.**
    - Os portais existentes pertencem às plataformas do patrocinador (Incentiv, Simbi, Prosas, Incentivo Certo).
    - O proponente que atende vários patrocinadores com plataformas diferentes acaba redigitando.
    - Um link de transparência que o proponente controla, com marcos, contrapartidas, fotos e execução resumida, é diferencial e ferramenta de renovação.

---

## 5. Dez funcionalidades e padrões de UX recomendados (priorizados)

> Contexto: o Jards já tem as rotas `prestacoes/[id]/{orcamento, comprovantes, atividades, divulgacao, distribuicao, relatorio}`, `ativacoes`, `contas-patrocinio` e `entregas`. As recomendações abaixo são evoluções desses módulos.

| # | Funcionalidade / padrão | Por quê (evidência) | Inspiração | Onde no Jards |
|---|---|---|---|---|
| 1 | **Conciliação da conta do projeto, começando pelo extrato.** Importar OFX, CSV e PDF (API BB depois). Tela em duas colunas: extrato à esquerda, lançamentos à direita. Sugestão automática por valor, data e favorecido. Um débito pode ter N comprovantes. Status por débito: sem comprovante, comprovado, divergente. | É o modelo do Salic Compliance e do BB Gestão Ágil. Nenhum concorrente do nicho faz isso para leis de incentivo. | Salic Compliance, BB Gestão Ágil, Nibo, Conta Azul (e as reclamações dela) | `contas-patrocinio` + `prestacoes/[id]/comprovantes` |
| 2 | **Captura inteligente de comprovantes.** Foto, PDF ou XML; QR da NFC-e; leitura de XML de NF-e e NFS-e; OCR de recibo e RPA; captura automática por CNPJ (fase 2). Pré-preenche fornecedor, CNPJ, número, data, valor e retenções. | Elimina digitação, que é a maior carga operacional. | VExpenses, Espresso, Qive | `comprovantes` |
| 3 | **Motor de regras por lei com semáforo por despesa.** Perfis Rouanet (IN 29/2026), LIE (Decreto 12.861/2026), ANCINE, PRONON/PRONAS (Anexo LXXXVI-A), MROSC. Checa período, rubrica, tetos %, meio de pagamento (sem espécie), identificação do projeto no documento, duplicidade, parte relacionada, certidão vigente. Cada alerta explica a regra e cita o artigo. | É a lacuna 1. As causas de glosa mais citadas são checáveis. | Espresso (política), Dynadok, Capitaai (o que falta para 100%), PROJETE (classificação por instrumento) | Transversal: `orcamento` + `comprovantes` + `relatorio` |
| 4 | **Rastreabilidade despesa → rubrica → meta/atividade → evidência.** Matriz navegável nos dois sentidos ("o que comprova a Meta 2?" e "a que meta serve a NF 4471?"). Rateio de uma despesa entre rubricas, metas ou fontes. | É "o vínculo que o avaliador cobra" (PROJETE). Também atende o relatório técnico coerente com o financeiro. | PROJETE, HYB (rateio), Bússola (fonte × rubrica) | `atividades` + `orcamento` |
| 5 | **Prontidão para envio e checklist do botão Enviar.** Percentual por projeto, lista do que falta (extratos de todos os meses, notas sem Pronac, metas sem evidência, contrapartidas não comprovadas). Gera o **pacote final**: índice, PDFs nomeados e planilhas no formato oficial (RP/DO/DE da ANCINE, Planilha II do PRONON/PRONAS, relação de pagamentos da LIE, anexos MROSC). | Lacunas 2 e 9. O dossiê único é pedido explicitamente no mercado (IncentiVou). | Capitaai (fit score), IncentiVou (dossiê único), Manuais Módulo II e III (requisitos do botão Enviar) | `relatorio` |
| 6 | **Calendário de obrigações e prazos oficiais com contagem regressiva.** PCP e PCF (LIE 60 dias), Rouanet (60 + 30 dias), MROSC (90 dias), relatórios trimestrais ao patrocinador, vencimento de certidões, defeso eleitoral. Integrado ao Google e Outlook, que o Jards já tem. | PROJETE, IncentiVou e Gestor de Convênios vendem alertas de prazo. Prazo perdido é causa de inadimplência. | PROJETE, Gestor de Convênios | `notificacoes` + `atividades` |
| 7 | **Evidências e contrapartidas verificáveis.** Coleta mobile com data, hora e local; lista de presença com QR ou assinatura; clipping de divulgação; checklist de marcas (Rouanet, LIE, defeso 2026); **aprovação de materiais e logomarca pelo patrocinador**. | Lacuna 8. A Incentiv já mostra que patrocinador quer prova de contrapartida e aprovação de logomarca. | Incentiv (Monitore Premium), Incentivo Certo (aprovar materiais), Bússola (App do Educador) | `divulgacao` + `ativacoes` + `entregas` |
| 8 | **Portal ou relatório do patrocinador emitido pelo proponente.** Link somente leitura por patrocinador: marcos, contrapartidas entregues, fotos, execução financeira resumida. Relatório trimestral gerado automaticamente. Aceite do patrocinador registrado. Alimenta a renovação no CRM. | Lacuna 10. Converte a prestação em ativo comercial, o que é diferencial do Jards. | Incentiv (relatórios trimestrais), Prosas (página pública), Smart Capta (auditável) | `contas-patrocinio` + `relatorio` + CRM |
| 9 | **Carteira para consultorias e captadores.** Painel multi-projeto e multi-cliente com saúde da prestação (semáforo), filas ("12 comprovantes a revisar"), responsáveis, SLAs e prazos oficiais. Papéis distintos (cliente envia, consultor valida, controller aprova) e **trilha de auditoria** por item. | Lacuna 7. O preço por projeto ativo (PROJETE) e a conta por cliente (Capitaai) mostram que o mercado pensa em carteira. Trilha de auditoria é pedida (IncentiVou). | IncentiVou (trilha de auditoria), VExpenses (aprovação em lote), Gestor de Convênios (continuidade quando o responsável sai) | `workspace-captador` + `prestacoes` (lista e kanban conforme `docs/LISTAS_PADRAO_OURO.md`) |
| 10 | **Dados públicos para pré-preencher e um assistente ancorado.** (a) Importar da API Salic (pública, no ar) o PRONAC, valores aprovado e captado, datas e incentivadores; DOU e Transferegov depois. (b) Assistente de IA que responde com base no manual da lei e no estado do projeto ("por que esta nota está amarela?"), sempre citando a fonte. (c) Due diligence de regularidade (certidões, CAUC, CEIS). | Lacuna 9 e redução de digitação. O próprio governo lançou o Cine Bot. Simbi e Prosas usam dados públicos. Bússola faz due diligence em 20+ bases. | Simbi, Prosas BIP, ANCINE Cine Bot, Bússola (due diligence), Gestor de Convênios (dados diários) | `projetos` + `prestacoes` |

**Também considerar (fora do top 10)**
- Módulo de **diligências e glosas**: resposta item a item, cálculo de devolução e reapresentação. É a lacuna 5. Entra logo após o item 5.
- **Versionamento do orçamento aprovado**: aprovado, remanejado, readequado, com histórico, como no 2Movie.
- **Fluxo intenção → contrato → recibo**, como na Bee The Change.
- **Simulador de dedução** para o patrocinador, como Bee The Change, IncentiVou e Smart Capta.

**Padrões de UX transversais** (coerentes com o `DESIGN.md` do Jards)
- **Semáforo de conformidade.** Não usar só cor: ícone, texto e motivo juntos. "Cores não podem ser o único meio de transmitir estado."
- **Explicação na própria linha.** Cada alerta tem "Por quê" (regra e artigo) e "Como resolver" (ação). Nada de alerta sem ação.
- **Aceitação em lote** na conciliação e na revisão de comprovantes, com desfazer.
- **Linguagem de gestor, não de contador** (padrão Bússola). Termos oficiais aparecem como rótulo secundário.
- **Celular primeiro na captura** (foto, QR) e desktop na revisão e conciliação.
- **Estados vazios que ensinam.** Exemplo: "Importe o extrato de março para começar a conciliação".

---

## 6. Riscos competitivos

1. **PROJETE lançar primeiro com base instalada (400+ organizações) e reputação de "quem presta contas".**
   - É o risco mais direto.
   - Mitigação: entregar conciliação, captura de NF, exportação no formato oficial e CRM. Nenhum desses está no roadmap público do PROJETE.
2. **Plataformas de patrocinador ditarem a ferramenta.**
   - Simbi, Incentiv, Prosas e Bússola Investimento Social podem exigir que o proponente preste contas dentro delas. A Simbi já faz isso no ISP.
   - O proponente com vários patrocinadores redigitaria, e o Jards viraria "mais um lugar".
   - Mitigação:
     - exportações e relatórios no formato desses portais;
     - portal do proponente (item 8);
     - integração ou API no futuro.
3. **Bússola Financeiro adicionar regras de leis de incentivo.**
   - Tem 1.500 OSCs, produto novo com teste grátis e já fala em "Rouanet, LIE, Pronas/Pronon" no lado investidor.
   - Mitigação: profundidade por lei e foco em proponente e consultoria.
4. **IncentiVou ampliar para Rouanet.** Já tem o desenho CRM + execução + dossiê.
5. **O governo absorver parte do valor.**
   - Salic Compliance, BB Gestão Ágil (RP pré-preenchida, DE automático), Cine Bot e Cadastro Único da ANCINE, migração para o Transferegov.
   - Funções de conciliação podem virar commodity dentro do sistema oficial.
   - Mitigação: o valor do Jards fica antes do envio (validação, dossiê, carteira) e depois dele (diligências, histórico, renovação).
6. **Mudança normativa frequente.**
   - Exemplos: IN 29/2026 e IN 34/2026 (Rouanet), LC 222/2025, Decreto 12.861/2026 e Portaria MESP 10/2026 (LIE), Anexo LXXXVI-A (PRONON/PRONAS), manuais da ANCINE v2.10 e v2.11 em 2026.
   - O motor de regras precisa de manutenção contínua, com regras versionadas por data de aprovação do projeto. É custo e também barreira de entrada.
7. **Compressão de preço por ferramentas horizontais e captação barata.**
   - Capitaai custa R$ 97 por ano.
   - Uma consultoria pode juntar Qive, Nibo e Dynadok com planilhas.
   - Mitigação: vender redução de risco (glosa e devolução) e horas de equipe, com métrica visível ("R$ X em despesas validadas, Y pendências evitadas").
8. **Quem paga pelo software.**
   - A ABCR alerta que serviços prestados ao patrocinador não devem ser pagos com recurso incentivado.
   - Se a assinatura do Jards entrar no orçamento do projeto como custo administrativo (teto de 15% na LIE, segundo trecho de busca), a elegibilidade precisa ser verificada por lei. [?]
9. **Confiança e LGPD.**
   - PRONON e PRONAS envolvem dados de saúde.
   - Concorrentes exibem ISO 27001/27701 (HYB) e hospedagem no Brasil (HYB, Capitaai).
   - Instituições grandes vão exigir isso.
10. **Instabilidade das integrações bancárias.** As reclamações de Conta Azul e Qive mostram que integração quebrada vira reclamação pública. Ter fallback manual (OFX, CSV, PDF) é obrigatório.

---

## 7. O que evitar

- **Chamar monitoramento de impacto de "prestação de contas".** É o que fazem Prosas e Incentiv. O proponente percebe a diferença.
- **Depender de uma única integração bancária ou fiscal**, sem importação manual.
- **Alertas sem explicação e sem ação.**
- **Jargão contábil como linguagem principal.**
- **Exigir cadastro manual do que já é público** (PRONAC, valores, incentivadores).
- **Prometer IA genérica** ("IA & Dados para prever e proteger") sem mostrar o que ela faz. O mercado já está saturado dessa promessa.
- **Suporte só por robô.** É reclamação recorrente (VExpenses, Prosas). Para o público de OSC, implantação assistida faz diferença (HYB, Bússola).

---

## 8. Fontes

### Plataformas e produtos (sites lidos com `curl` em 01/10/2026, salvo indicação)

1. Prosas, home: https://prosas.com.br/
2. Prosas, Empresas: https://prosas.com.br/empresas
3. Prosas, Organizações Públicas: https://prosas.com.br/organizacoes-publicas
4. Prosas, Portal da Lei Rouanet, BIP e Programa de Dados: https://produtos.prosas.com.br/lei-rouanet
5. Prosas, blog sobre prestação de contas (trecho de busca): https://blog.prosas.com.br/beneficios-do-acompanhamento-e-prestacao-de-contas-de-projetos-para-o-investimento-social-da-sua-empresa/
6. Reclame Aqui, Prosas (trecho de busca): https://www.reclameaqui.com.br/empresa/prosas/ · https://www.reclameaqui.com.br/prosas/plataforma-prosas-nao-funciona_AeMB8-wwXDa9UYPL/
7. Simbi, home: https://simbi.social/
8. Simbi, Plataforma: https://simbi.social/plataforma/
9. Simbi, Para Organizações Sociais: https://simbi.social/para-organizacoes-sociais/
10. Artemisia, Simbiose (R$ 350 mi, 18 legislações, +1 mil auditorias; trecho de busca): https://artemisia.org.br/empresa-destrava-mais-de-r-350-milhoes-em-incentivos-fiscais-para-projetos-de-impacto/
11. Incentiv, Plataforma de investimento: https://incentiv.me/plataforma-de-investimento/
12. Incentiv, Monitoramento de Resultados: https://incentiv.me/monitoramento-de-resultado/
13. Incentiv, atualização do Monitoramento (2024): https://incentiv.me/blog/2024/06/03/incentiv-divulga-atualizacao-no-monitoramento-de-projetos/
14. Incentiv, marcos e contrapartidas (trecho de busca): https://incentiv.me/blog/2022/09/22/monitoramento-qualitativo-o-que-sao-marcos-e-contrapartidas/
15. Incentiv, guia de prestação de contas (04/08/2026): https://incentiv.me/blog/2026/08/04/prestacao-de-contas-projetos-incentivados/
16. Incentiv, modelo de taxa (trecho de busca; fonte provável Projeto Draft ou blog Incentiv) [?]: https://www.projetodraft.com/a-incentiv-conecta-empresas-e-pessoas-para-fortalecer-a-destinacao-de-impostos-a-projetos-culturais/ · Sitawi: https://emprestimocoletivo.com.br/portfolio/incentiv-me/
17. Bússola Social, home: https://www.bussolasocial.com.br/
18. Bússola Financeiro: https://www.bussolasocial.com.br/bussola-financeiro
19. Bússola Gestão: https://www.bussolasocial.com.br/bussola-gestao
20. Bússola Investimento Social: https://www.bussolasocial.com.br/investidores-sociais
21. Bússola, Preços (FAQ no HTML): https://www.bussolasocial.com.br/precos
22. PROJETE: https://projete.org/ · Forbes Under 30 (Victor Santana / Projetus): https://forbes.com.br/under-30/2024/empreendedorismo-social-terceiro-setor-u30-2024/victor-santana/
23. IncentiVou: https://www.incentivou.com.br/ · https://www.incentivou.com.br/plataforma · https://www.incentivou.com.br/executores
24. Valorize Projetos: https://www.valorizeprojetos.com.br/ · https://www.valorizeprojetos.com.br/como-centralizar-a-gestao-de-projetos-incentivados-e-reduzir-retrabalho-nas-empresas/
25. Bee The Change: https://www.beethechange.com.br/plataforma-bee-the-change
26. Smart Capta: https://smartcapta.com.br/
27. Incentivo Certo (Think Projetos): https://incentivocerto.com.br/
28. Muda Cultural (trecho de busca): https://observatorio3setor.org.br/muda-cultural-disponibiliza-solucao-online-que-agiliza-envio-de-projetos-incentivados-aptos-a-captarem-recursos-em-2025-via-leis-municipais/
29. Capitaai: https://capitaai.com.br/
30. Brada / AprovAI (Startupi, 07/06/2024): https://startupi.com.br/startup-facilitar-captacao-leis-de-incentivo/
31. Conecta LIR (trecho de busca): https://www.conectalir.com/quero-captar
32. HYB: https://www.hyb.com.br/ · blog MROSC: https://blog.hyb.com.br/novo-manual-mrosc-do-planejamento-a-prestacao-de-contas/
33. Reclame Aqui, HYB/Conplan (trecho de busca): https://www.reclameaqui.com.br/conplan-sistemas-de-informatica/software-hyb-nao-entrega-as-funcionalidades-do-programa_EvHvpEwA9gEsxFVb/
34. Gestor de Convênios: https://gestordeconvenios.com.br/ · https://gestordeconvenios.com.br/blog/mrosc-lei-13019
35. PSTGov: https://www.pstgov.com.br/terceiro_setor.html
36. OSC Fácil (trecho de busca): https://oscivil.org/
37. Softagon, Plataforma Cultural: https://softagon.com.br/blog/lei-rouanet-municipios-como-funciona
38. Placarsoft, Projetos de Incentivo: https://placarsoft.com.br/modulos/13/projetos-de-incentivo
39. 2Movie: https://www.2movie.com.br/
40. Profilme.NET: https://www.profilme.net/funcionalidade.html
41. Dynadok, validação de prestação de contas com IA (25/09/2026): https://blog.dynadok.com/uncategorized/leis-de-incentivo-como-validar-documentos-de-prestacao-de-contas-com-ia/
42. VExpenses, IA e cobrança por usuário (trechos de busca): https://vexpenses.com.br/ia-vexpenses · https://suporte.vexpenses.com.br/hc/pt-br/articles/5413029175188-Como-funciona-o-nosso-m%C3%A9todo-de-cobran%C3%A7a-por-usu%C3%A1rio
43. Reclame Aqui, VExpenses (trecho de busca): https://www.reclameaqui.com.br/empresa/vexpenses/
44. Espresso: https://www.espressoapp.com.br/funcionalidades/lancamento-automatico-de-despesas
45. Paytrack: https://paytrack.com.br/gestao-de-despesas-corporativas/
46. Qive: https://qive.com.br/blog/como-funciona-o-arquivei · https://ajuda.qive.com.br/pt-BR/articles/1538164-visao-geral-da-plataforma · comparativo de preço de terceiro (trecho de busca) [?]: https://gaxweb.com.br/guias/gaxweb-vs-qive/
47. Reclame Aqui, Qive (trecho de busca): https://www.reclameaqui.com.br/empresa/qive/
48. Nibo, Conciliador Open Finance: https://www.nibo.com.br/conciliador-open-finance · https://ajuda.nibo.com.br/pt-BR/articles/11364850-saiba-tudo-sobre-o-nibo-conciliador-open-finance
49. Conta Azul, conciliação: https://contaazul.com/funcionalidades/conciliacao-bancaria/ · Reclame Aqui (trechos de busca): https://www.reclameaqui.com.br/contaazul/conciliacao-bancaria-automatica-nao-funciona_amXt3vgXVmALGTjF/ · https://www.reclameaqui.com.br/contaazul/integracao-com-itau-conciliacao-bancaria_u6oGnm7c6VJKeBoq/
50. Omie, extrato e integração com o BB: https://ajuda.omie.com.br/pt-BR/articles/499175-conciliacao-bancaria-importando-o-extrato-no-omie · https://ajuda.omie.com.br/pt-BR/articles/11132503-configurando-a-integracao-com-o-banco-do-brasil-extrato-via-api
51. Granatum (trecho de busca) [?]: https://www.infinitepay.io/blog/sistema-de-fluxo-de-caixa

### Sistemas oficiais e contexto

52. ANCINE, BB Gestão Ágil: https://www.gov.br/ancine/pt-br/assuntos/noticias/ancine-implementa-plataforma-do-banco-do-brasil-para-acompanhamento-e-prestacao-de-contas-de-projetos-audiovisuais · FAQ 18.2: https://www.gov.br/ancine/pt-br/acesso-a-informacao/perguntas-frequentes1/superintendencia-de-prestacao-de-contas-spr/18-2-como-o-bb-gestao-agil-impacta-a-submissao-de-planilhas-no-str
53. ANCINE, Cine Bot (Tela Viva, 06/08/2026): https://telaviva.com.br/06/08/2026/ancine-lanca-assistente-virtual-para-orientar-usuarios-sobre-prestacao-de-contas-e-fiscalizacao/
54. ANCINE, Cadastro Único de Projetos (Instituto Tijuipe): https://www.institutotijuipe.org.br/post/plataforma-facilita-gestao-de-projetos-junto-a-ancine
55. Salic, remodelação e aba Compliance (Elaborando Projetos, 2024): https://www.elaborandoprojetos.com.br/remodelacao-do-salic-2024/
56. SalicMobile (Squadra; trecho de busca): https://consultoriasquadra.com.br/saiba-utilizar-o-aplicativo-salicmobile-lei-de-incentivo-a-cultura/
57. API Salic (testada em 01/10/2026): https://api.salic.cultura.gov.br/docs · endpoint `https://api.salic.cultura.gov.br/api/v1/projetos` · GitHub: https://github.com/culturagovbr/salic-api
58. "Prestação de contas da Lei Rouanet nos tempos do Novo SALIC" (Jusbrasil; trecho de busca, página bloqueada): https://www.jusbrasil.com.br/artigos/prestacao-de-contas-da-lei-rouanet-nos-tempos-do-novo-salic/535191240
59. Passivo do MinC (TCU, via imprensa): https://www.folhadoestado.com.br/economia/tcu-identifica-r-22-bilhoes-sem-prestacao-de-contas-no-ministerio-da-cultura/631347 · https://www.tribunadoagreste.com.br/geral/2025/04/12/87572-minc-divulga-informacao-falsa-ao-falar-de-fim-do-passivo-de-prestacao-de-contas
60. IN 29/2026, prazo de análise (Instituto DEA; trecho de busca) [?]: https://institutodea.com/artigo/o-que-muda-na-lei-rouanet-com-a-in-no-29-26/
61. Salic fora do ar (Cultura e Mercado) e queda no último dia (Poder360): https://culturaemercado.com.br/minc-retira-salic-do-ar-apos-tentativa-de-ataque-hacker/ · https://www.poder360.com.br/poder-governo/site-do-governo-cai-no-ultimo-dia-de-inscricao-para-lei-rouanet/
62. Transferegov, LIE: https://www.gov.br/transferegov/pt-br/sobre/internalizados/parcerias/lei-incentivo-esporte
63. Squadra, erros comuns na prestação de contas da LIE: https://consultoriasquadra.com.br/erros-comuns-na-prestacao-de-contas-da-lei-de-incentivo-ao-esporte/
64. Orzil, curso de Transferegov para o Terceiro Setor (indicador de complexidade): https://orzil.org/curso/%20mrosc-no-transferegov-execucao-monitoramento-avaliacao-e-prestacao-de-contas
65. Guia LPG para o agente cultural (Americana/SP; Mapa Cultural): https://www.americana.sp.gov.br/download/cultura/leipaulogustavo/guia-pratico-prestacao-contas.pdf
66. ABCR, alerta sobre remuneração com recurso incentivado: https://captadores.org.br/abcr/alerta-abcr-empresas-que-prestam-servicos-aos-patrocinadores-devem-ser-remuneradas-por-eles-nao-com-recursos-de-incentivo-fiscal/

### Notas internas desta pesquisa (mesma pasta)

- `lie-federal-2026-web.md`: SLI, Transferegov, Decreto 12.861/2026, Portaria MESP 10/2026.
- `ancine-str-logomarca-fsa-web.md`: STR, BB Gestão Ágil, planilhas RP, DO e DE.
- `saude-pronon-pronas-manual-2019.md` e `saude-regras-vigentes-2026-web.md`: Transferegov, SIPAR e SEI, Planilha II.
- `rouanet-in29-manual-olivieri.md` e `rouanet-in29-texto-normativo-web.md`: regras da IN 29/2026.
- Código do Jards consultado só para mapear módulos existentes: `app/(dashboard)/prestacoes/[id]/*`, `ativacoes`, `contas-patrocinio`, `entregas`, `workspace-captador`, e `README.md`.
