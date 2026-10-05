# Mercado internacional: análogos para o módulo de Prestação de Contas do Jards (pesquisa web, 01/10/2026)

O objetivo é levantar o que os melhores produtos fora do Brasil fazem e escolher padrões de produto que o Jards possa copiar no módulo de prestação de contas. O módulo cobre orçamento aprovado, extrato, notas e pagamentos (conciliação), evidências de entrega, verificação de regras e pacote de envio aos sistemas do governo.

---

## 0. Método e limitações (leia antes)

1. **Ferramentas.** A descoberta foi feita com WebSearch (cerca de 60 buscas). A leitura de páginas foi feita com `curl` e o script `busca.py`. As páginas lidas por inteiro incluem:
   - Instrumentl (Manage, Pricing e o post de lançamento do Spenddown);
   - guia de instruções do Euna/AmpliFund da California State Library;
   - guia externo do Fluxx do Metropolitan Council (maio/2026);
   - SmartyGrants (Close the Grant, Pricing, Standardised acquittals e factsheet de evidências do R4R);
   - formulário Producer Offset Final Certificate da Screen Australia;
   - GreenSlate (Tax Credit Summary, Incentives Dashboard, Coding e Weekly Reports);
   - EP (SmartAccounting e Moneypenny);
   - Ramp (Policy Agent Overview, post de GA e Pricing);
   - Brex (Compliance rating e Intelligent Finance);
   - Good Grants (Pricing);
   - Blackbaud FE NXT (Grant & Program Accounting);
   - EMDESK (Lump sum e Features);
   - FAQ do Arachne v2.0;
   - Wrapbook (Help Center).
2. **Fontes bloqueadas.**
   - sage.com e dtsc.ca.gov devolveram bloqueio do Cloudflare. G2 e Capterra não foram lidos diretamente.
   - Por isso, **os pontos fracos tirados de reviews vêm dos resumos do buscador** sobre páginas do G2, Capterra e Software Advice. Esses resumos podem misturar reviews antigos e novos.
3. **Marcações.**
   - **[?]** indica um ponto não confirmado em fonte primária ou uma inferência minha.
   - **[fornecedor]** indica uma afirmação de marketing do próprio vendedor.
   - **[concorrente]** indica uma afirmação de um concorrente, como a Plinth sobre o SmartyGrants ou a Saturation sobre EP e GreenSlate.
   - **[trecho]** indica um dado que veio só do resumo do buscador.
4. **Tabela comparativa.** Na tabela da seção 7, "—" significa **"não encontrado nas fontes"**, e não "o produto comprovadamente não faz".
5. **Contexto do Jards.** O repositório já tem a rota `app/(dashboard)/prestacoes/[id]/` com as abas Visão geral, Orçamento, Comprovantes, Atividades, Relatório, Distribuição e Divulgação. Tem também a função `supabase/functions/extrair-comprovante/index.ts`, que extrai dados do comprovante com IA e devolve um nível de risco (ALTO, MÉDIO ou BAIXO) e os "motivos_glosa". As sugestões da seção 8 partem dessa base.

---

## 1. Resumo executivo

- **Ninguém lá fora faz exatamente o que o Jards quer fazer:** um módulo do lado do beneficiário que junte orçamento, conciliação, evidências, regras e pacote de envio.
  - O mercado está partido em quatro grupos:
    - portais de financiador: Fluxx, SmartyGrants, Submittable, Good Grants, Euna;
    - contabilidade por fundos: Sage Intacct, Blackbaud FE NXT, MIP, Aplos;
    - contabilidade de produção audiovisual: GreenSlate, EP, Cast & Crew;
    - gestão de despesas: Ramp, Brex, Expensify, Pleo, Dext, Hubdoc.
  - A única tentativa explícita de "sistema operacional do beneficiário" é o **Instrumentl Spenddown**, lançado em abril/2026 [2], e ainda sem conciliação bancária nem evidências.
- **O análogo mais próximo da ANCINE e das leis de incentivo é a contabilidade de produção com incentivo fiscal.** Três peças desse mundo se transpõem quase diretamente para "rubrica aprovada × despesa comprovada":
  - o **Tax Credit Summary** do GreenSlate: plano de contas × códigos de incentivo, com a coluna "Unassigned" e a pendência que some ao ser resolvida [41];
  - o **EFC Change Report**: histórico de mudanças de custo final com motivo [44];
  - o **pacote de auditoria sob demanda** [52].
- **O padrão de IA mais maduro e transponível é o Ramp Policy Agent** [56][57]. Ele lê a política escrita e cita o trecho exato que usou. Dá três desfechos (aprovar, revisar, rejeitar), puxa para "revisar" quando há ambiguidade e aponta lacunas na própria política. É o desenho certo para um motor de regras de glosa com justificativa normativa.
- **Conciliação:** o melhor padrão é a regra explícita de auto-match do Expensify. Ele só concilia automaticamente quando valor, data e moeda batem e **existe um único par possível** [61]. Combina com a exigência de "nota + comprovante de pagamento + extrato" vista nos guias australianos [19] e com o vínculo documento → rubrica dentro da solicitação de reembolso do Fluxx [12].
- **Relatório e pacote de envio:**
  - no Horizon Europe, o módulo de *continuous reporting* fica aberto o tempo todo e **gera automaticamente** a Parte A do relatório periódico [66];
  - na Screen Australia, o envio final exige um **conjunto padronizado de planilhas**: subconjunto do razão, transações com partes relacionadas, moeda estrangeira, voos etc. Exige também **nomenclatura de arquivos** e proíbe ZIP [22].
  - Os dois são modelos diretos de "relatório gerado a partir de dados vivos" e de "pacote com manifesto".
- **Antipadrões recorrentes nos reviews:**
  - formulário que não salva sozinho (Euna/AmpliFund) [9];
  - total plurianual sem quebra por período (AmpliFund, Instrumentl) [5][11];
  - portal do beneficiário tratado como cidadão de segunda classe (Fluxx) [14];
  - relatório que obriga a exportar para o Excel (Submittable) [30];
  - add-ons cobrados à parte (Sage Intacct) [34];
  - feeds bancários que quebram (Hubdoc) [64].

---

## 2. Gestão pós-concessão do lado do beneficiário (grantee)

### 2.1 Instrumentl: plano Full Lifecycle (Spenddown, Award Assistant)

- **URL:** https://www.instrumentl.com
- **Para quem:** ONGs e consultorias de captação dos EUA. O site tem a solução "Grant Consultants" [1]. Começou na prospecção de editais e, em 2026, se reposicionou como "sistema operacional de grants" [2].
- **Recursos relevantes:**
  - **Orçado × real por rubrica (Spenddown, lançado em 23/04/2026):**
    - o usuário arrasta o orçamento aprovado pelo financiador, que é convertido em tabela editável;
    - as contas do razão são mapeadas **uma única vez** às categorias do financiador;
    - a partir daí as despesas entram automaticamente pela integração contábil;
    - é possível registrar **despesas planejadas**, para ver "alocado × lançado" no meio do mês [2];
    - exporta budget-vs-actual por janela de tempo e manda e-mail quando o gasto está fora da trilha [2][3].
    - Pelo help center (via [trecho]), também importa CSV/XLSX de QuickBooks, Sage, MIP e Financial Edge NXT [4].
  - **Extração de obrigações (Award Assistant):** o usuário sobe a carta de concessão, MOU ou contrato. A IA extrai valores, cronograma de pagamentos, prazos de relatório e requisitos de conformidade [1][3].
  - **Calendário e tarefas:** atribuição de tarefas com prazo, coleta de requisitos e lembretes automáticos por e-mail ou Slack. Há uma visão "Awards" com todas as entregas pós-concessão [1].
  - **Relatórios ao financiador:** templates específicos por financiador estão no **roadmap**, ainda não lançados [2].
  - **Remanejamento com aprovação, regras de elegibilidade, OCR, conciliação bancária, evidências e portal do financiador:** não encontrados.
- **Preço (público) [3]:**

  | Plano | Anual | Mensal | Usuários | Observação |
  |---|---|---|---|---|
  | Discover | US$ 299/mês | — | — | — |
  | Pre-Award | US$ 499/mês | — | — | Inclui Award Assistant |
  | Full Lifecycle | US$ 999/mês | US$ 1.159/mês | até 15 | Único plano com pós-concessão |
  | Enterprise | Sob consulta | Sob consulta | — | — |

- **UX notável:**
  - "arraste o orçamento" como ponto de partida, sem cadastrar rubrica por rubrica;
  - mapeamento único conta → rubrica;
  - camada de "planejado" sobre o realizado;
  - alertas de sub ou superexecução.
- **Fraquezas (reviews) [5]:**
  - não há forma simples de registrar concessões plurianuais por valor anual, porque o total é lançado de uma vez;
  - reviews antigos reclamavam da falta de integração contábil, o que o Spenddown pretende resolver;
  - preço alto para organizações pequenas;
  - curva de aprendizado de semanas.
- **O que o Jards deve copiar:**
  - importar o orçamento aprovado a partir do arquivo ou PDF da proposta;
  - mapeamento "conta/categoria → rubrica" reaproveitável;
  - coluna "comprometido/planejado";
  - extração de obrigações do instrumento (portaria, termo de compromisso, contrato de patrocínio) para gerar o calendário.

### 2.2 Euna Grants "powered by AmpliFund" (ex-AmpliFund e eCivis)

- **URL:** https://www.amplifund.com, que hoje redireciona para a Euna Solutions [6].
- **Para quem:** setor público dos EUA, tanto quem concede quanto quem recebe. Os beneficiários de órgãos estaduais usam o portal do órgão.
  - A Euna comprou a AmpliFund em março/2025 [7].
  - Segundo fonte de terceiros, a marca virou "Euna Grants Powered by AmpliFund" em outubro/2025 [8] [trecho].
- **Recursos relevantes:**
  - **Orçado × real:** o relatório "Grant Budget Variance" mostra orçado, executado e saldo por item de despesa e por categoria [10]. Há também Grant Expense Detail, Performance Plan Detail/Summary (metas planejadas × alcançadas), Payment Request Detail e Post-Award Status [10].
  - **Lançamento de despesa:**
    - categoria e item da linha;
    - custo direto;
    - descrição "com detalhe suficiente para verificar a elegibilidade", com itens, fornecedores e quantidades;
    - divisão em **contrapartida financeira, contrapartida econômica (in-kind) e outras fontes** [9].
  - **Períodos de relatório como objeto:**
    - o "Reporting Period Report" é montado a partir das despesas do período;
    - depois de aprovado, o período **fica fechado**;
    - para lançar despesa num período fechado, o gestor do financiador precisa reabrir o período [9].
  - **Papéis:** um "Recipient Manager" (único, recebe as notificações) e vários "Additional Users" por concessão [9].
  - **Auditoria e calendário:** a Euna anuncia "FOIA-ready audit trails", notificações automáticas de prazo e integração com ERP [6] [fornecedor].
  - **IA:** "Euna AI", com agentes genéricos para a suíte financeira [6] [fornecedor]. Não há detalhe específico de prestação de contas.
- **Preço:** não público ("Request Pricing") [6].
- **UX notável:**
  - a prestação financeira é feita em duas etapas: lançar despesas e depois "fechar" o período em relatório;
  - existe um plano de desempenho com metas planejadas × alcançadas.
- **Fraquezas:**
  - **o formulário não salva sozinho**: o guia oficial manda rolar a página e clicar "Save as Draft" [9];
  - nos reviews [11]: é difícil dividir valores plurianuais, a curva é íngreme ("pensar em elementos de dado em vez de formulários"), as tabelas internas são confusas para montar relatórios, a busca é ruim e o suporte é lento.
- **O que o Jards deve copiar:**
  - período de prestação de contas fechável, com reabertura rastreada;
  - campo de contrapartida (financeira ou econômica) por despesa;
  - "descrição suficiente para verificar a elegibilidade" como validação, que a IA pode sugerir.
  - **Não copiar:** a falta de auto-save.

### 2.3 Fluxx: Grantee Portal, solicitações de reembolso e aditivos

- **URL:** https://www.fluxx.io
- **Para quem:** financiadores (fundações e governo). O beneficiário usa o **Grantee Portal** fornecido pelo financiador [13].
- **Recursos relevantes.** O fluxo abaixo é o da configuração do Metropolitan Council, que é configurável por financiador [12].
  - **Orçamento:** o "Grant Budget Tracker" é uma tabela dinâmica editada pelo próprio beneficiário [13][12].
  - **Solicitação de reembolso (claim):**
    - o beneficiário informa o período da despesa, se é parcial ou final, e o valor;
    - anexa notas detalhadas, **comprovantes de pagamento**, contratos com fornecedores e o formulário;
    - **distribui as despesas pelas rubricas do orçamento e vincula cada documento à rubrica** [12].
    - Estados: Draft → Clarification Requested, que **deixa de contar como enviado** até ser reenviado → Submitted → aprovado vira Payment (Scheduled → Paid) [12].
  - **Aditivos (amendments), incluindo remanejamento orçamentário:**
    - o beneficiário escolhe os tipos de aditivo e anexa documentos, como uma carta assinada em papel timbrado;
    - para remanejar, edita o próprio Budget Tracker.
    - Estados: Draft, Returned, Submitted, Approved, "Assign Signatories" (assinatura via Adobe Sign) e Executed.
    - O financiador classifica o aditivo como **administrativo**, aplicado de imediato, ou **formal**, que exige termo e às vezes comitê. Fica um histórico de todos os aditivos [12].
  - **Relatórios:** relatórios de progresso periódicos. Alguns financiadores ainda usam **planilha Excel como template de relatório fiscal** dentro do portal [15].
  - **Regras automáticas, OCR e IA:** não encontrados.
- **Preço:** não público.
- **UX notável:**
  - a solicitação de reembolso é um "pacote" com documentos ligados a rubricas;
  - o status "esclarecimento solicitado" explicita a ação pendente do beneficiário;
  - o pagamento fica visível para o beneficiário, inclusive como "agendado".
- **Fraquezas (reviews) [14]:**
  - portal do beneficiário "um pouco desajeitado", com nova interface prometida para 2026;
  - limite de pessoas do lado do beneficiário com acesso;
  - caixas de texto pequenas;
  - mudar formulários exige código Liquid;
  - lentidão e suporte demorado.
- **O que o Jards deve copiar:**
  - fluxo de **remanejamento como objeto com estados e histórico**;
  - distinção entre remanejamento "administrativo" (dentro do limite da norma) e "formal" (precisa de aprovação do órgão);
  - vínculo documento → rubrica dentro de cada lote enviado;
  - estado "devolvido para esclarecimento" com contador de pendências.

### 2.4 SmartyGrants (Our Community, Austrália)

- **URL:** https://www.smartygrants.com.au
- **Para quem:** financiadores australianos (governos, prefeituras, fundações). Beneficiários prestam contas ("acquittal") pelo portal.
  - Ponto importante: a **Screen Australia usa SmartyGrants para o pedido de certificado final do Producer Offset**, o incentivo federal ao audiovisual [22]. Isso o torna um análogo direto de ANCINE no lado do formulário.
- **Recursos relevantes:**
  - **Formulários de acquittal e progresso:**
    - modelos customizáveis com "standard fields" comuns a todos os programas, o que permite relatório transversal [17];
    - o acquittal fica ligado ao registro da proposta original (registro único) [16];
    - lembretes automáticos por e-mail [16];
    - dados de progresso entram em campos estruturados e podem ser resumidos entre beneficiários [16].
  - **Orçado × real com justificativa:** os formulários pedem que o beneficiário **explique as divergências** entre o orçamento da proposta e o gasto real, e que informe valores sem GST [20] [trecho].
  - **Evidência de despesa (factsheet de um programa no SmartyGrants) [19]:**
    - aceita extratos com data, valor e descrição clara, ou **nota + comprovante de pagamento correspondente**, ou um razão (ledger) detalhado;
    - o razão deve trazer o ABN (equivalente ao CNPJ) e o nome do fornecedor em cada linha;
    - o razão deve ser **assinado pelo responsável financeiro** ou acompanhado de declaração estatutária;
    - planilha sem referências de transação, ABN ou assinatura "levará a novos pedidos de evidência";
    - **a próxima parcela só é liberada com a evidência aceita**;
    - a evidência de execução física costuma ser **fotografia** ou visita técnica.
  - **Envio no padrão Screen Australia [22]:**
    - planilha QAPE com abas obrigatórias: capa; QAPE; **subconjunto do razão geral**; temporada; **moeda estrangeira**; **transações com partes interessadas**; desenvolvimento; empresa estrangeira; voos; viagens no exterior; residentes e não residentes trabalhando dentro e fora da Austrália;
    - auditor registrado;
    - **convenção de nome para cada anexo**, numeração sequencial quando há vários arquivos, "não combine materiais num único documento", **ZIP não aceito**, máximo de 25 MB.
  - **Resultados:** o "Outcomes Engine" é um quadro padronizado de resultados incluído na assinatura [18]. O detalhamento é [?].
- **Preço:** taxa anual por faixa de **valor desembolsado por instância**. Usuários, propostas e armazenamento são ilimitados, sem taxa de implantação na maioria dos casos [18].
- **Fraquezas:** segundo um concorrente (Plinth) [21] [concorrente], é calibrado para a Austrália, tem IA limitada e interface "funcional, mas menos moderna".
- **O que o Jards deve copiar:**
  - campo obrigatório de **justificativa de variação** por rubrica quando passar de um limiar;
  - razão (ledger) exportável com CNPJ ou CPF do fornecedor por linha e assinatura do responsável financeiro;
  - regra "documento fiscal + comprovante de pagamento" como unidade mínima de evidência;
  - **convenções de nome, tamanho e formato por destino** no pacote de envio;
  - cobrança por volume em vez de por usuário (ideia comercial).

### 2.5 Foundant + SmartSimple (GrantHub, GrantHub Pro, SmartSimple Cloud)

- **URL:** https://www.foundant.com e https://www.smartsimple.com. As duas empresas se fundiram em agosto/2024 [23].
- **Para quem:**
  - o **GrantHub** atende ONGs que buscam recursos (beneficiárias);
  - o **SmartSimple Cloud** atende financiadores complexos (governo, pesquisa, saúde) e é altamente configurável [25].
- **Recursos relevantes:**
  - **GrantHub:** prazos, tarefas e lembretes automáticos por e-mail.
  - **GrantHub Pro** [?] [trecho]: receitas e despesas por concessão, relatórios de spend-down, alertas de KPI e dashboards. O preço do GrantHub parte de US$ 995/ano [24] [trecho].
  - **SmartSimple:**
    - desembolsos e orçamento;
    - formulários "Standard Form" federais dos EUA dentro do sistema;
    - trilha de auditoria e alertas [25].
    - **IA:** o "SmartSimple Cloud +AI" (2023) faz resumos, tradução, cadernos para comitê e ajuda o proponente a escrever [26]. Em fevereiro/2026 veio a análise de propostas com IA: critérios configuráveis, pesos, resumo, **pontuação de confiança** e ranking [27] [trecho].
- **Preço:** SmartSimple sob consulta.
- **Fraquezas (SmartSimple) [28]:**
  - a configuração exige um administrador com noção de código;
  - muitos cliques;
  - não há botão "voltar";
  - recursos difíceis de achar.
- **O que o Jards deve copiar:**
  - "pontuação de confiança" exibida junto de cada sugestão da IA;
  - alerta de KPI quando a execução física ou financeira desvia.
  - **Evitar:** configuração que depende de administrador técnico.

### 2.6 Submittable, Good Grants e Bonterra (portais de financiador, resumo)

- **Submittable** (https://www.submittable.com):
  - construtor de formulários de arrastar e soltar;
  - **relatórios de progresso agendáveis**;
  - categorias de orçamento com **cálculo automático de custos indiretos**;
  - cronogramas de pagamento (módulo opcional);
  - logs de auditoria e de acesso [29].
  - Preço a partir de cerca de US$ 2.500/ano [30] [trecho][?].
  - Fraquezas: relatórios rasos ("para cruzar dados é preciso exportar para o Excel"), saltos de plano e custos extras [30].
- **Good Grants** (https://goodgrants.com):
  - formulários de relatório ilimitados (programáticos, financeiros, KPI);
  - **uploads multimídia**;
  - **configurações de privacidade para dados sensíveis**;
  - visão dedicada de relatórios com "solicitado, vencendo e enviado";
  - status da concessão refletindo marcos de conformidade [31].
  - Preço público, sem cobrança por usuário: plano Intro a US$ 3.950/ano ou € 3.200/ano; Premium a partir de AUD 10.700/ano [31].
- **Bonterra** (CyberGrants, Grantmaker): lançou o "Grantmaker" em fevereiro/2026, com pontuação de propostas por IA [32]. O foco é o financiador e não há nada específico de prestação de contas do beneficiário.
- **O que o Jards deve copiar:**
  - privacidade por campo e por anexo em evidências sensíveis, como listas de presença com CPF de menores;
  - visão "solicitado, vencendo e enviado" por obrigação;
  - cálculo automático de rubricas derivadas, como custos administrativos e indiretos sobre a base.

> Não aprofundados por falta de diferencial para o lado do beneficiário: Blackbaud Grantmaking, WizeHive/Zengine e eCivis como produto separado (hoje é o módulo grantee da Euna [8]).

---

## 3. Contabilidade por fundos (nonprofit fund accounting)

### 3.1 Sage Intacct (Nonprofit)

- **URL:** https://www.sage.com/en-us/sage-business-cloud/intacct/ (bloqueada pelo Cloudflare; dados via buscador e consultorias) [33].
- **Para quem:** ONGs de médio e grande porte.
- **Recursos relevantes:**
  - **dimensões em cada lançamento:** fundo, programa, departamento, local, grant e dimensões personalizadas;
  - a restrição é aplicada **no razão, no momento do lançamento**, e não reconciliada depois [33];
  - existem a "Grant dimension" (básica) e o módulo "Grant Tracking & Billing" (cobrança por reembolso);
  - o relatório **Grant Budget vs. Actual destaca despesas não orçadas**;
  - o Spend Management ajuda a impedir gastos não permitidos [33] [trecho].
- **Preço:** cerca de US$ 10 mil/ano mais US$ 10 mil a 37,5 mil de implantação [34] [trecho][?].
- **Fraquezas [34]:**
  - relatórios personalizados trabalhosos;
  - cada novidade vem como SKU à parte e o custo total "sobe aos poucos";
  - precisa de consultor.
- **O que o Jards deve copiar:**
  - a ideia de que **cada despesa nasce classificada** em várias dimensões ao mesmo tempo: projeto, rubrica, fonte (incentivo ou contrapartida), etapa e meta;
  - a pendência "despesa sem rubrica orçada" como alerta de primeira classe.

### 3.2 Blackbaud Financial Edge NXT

- **URL:** https://www.blackbaud.com/products/blackbaud-financial-edge-nxt/grant-and-program-accounting
- **Para quem:** ONGs dos EUA com muitos recursos de uso restrito.
- **Recursos relevantes [35]:**
  - **grant e projeto são registros completos, e não apenas etiquetas:** têm histórico, notas, padrões, segurança, orçamento, alocações e reembolso;
  - orçamentos por grant **em períodos próprios, independentes do ano fiscal**, com **cenários ilimitados**;
  - **regras de gasto embutidas** calculam o reembolso;
  - custos indiretos aplicados por taxa permitida;
  - **drill-down do registro até a transação** para auditoria;
  - em maio/2026 ganhou o tile "Project Budget vs Actual" [36].
- **Preço:** não público.
- **Fraquezas [37]:**
  - lentidão;
  - consultas e relatórios difíceis, com dados "difíceis de extrair num formato usável";
  - funcionalidades prometidas na venda e não entregues.
- **O que o Jards deve copiar:**
  - o projeto incentivado como **objeto com calendário próprio**: vigência de captação e de execução, independente do ano fiscal;
  - drill-down de qualquer total até o documento.

### 3.3 MIP Fund Accounting (Momentive, ex-Abila MIP)

- **URL:** https://www.mip.com
- **Recursos relevantes [38]:**
  - plano de contas segmentado (fundo, grant, programa, departamento, conta);
  - módulo **Grants Administration**, que liga a cada código de grant:
    - nº do instrumento;
    - responsável;
    - tipo e estágio;
    - **período do grant**;
    - valor;
    - forma de pagamento;
    - **% de contrapartida**;
    - **taxa de custos indiretos**;
    - **datas de relatório**;
    - **exigências de auditoria**;
    - dados do concedente;
  - orçamentos ilimitados e plurianuais, com controle orçamentário "com um clique".
- **Preço e fraquezas:** não levantados.
- **O que o Jards deve copiar:** a **"ficha do instrumento"** com metadados normativos: % de contrapartida, limites, datas de relatório e exigência de auditoria. Esses metadados alimentam as regras e o calendário.

### 3.4 Aplos

- **URL:** https://www.aplos.com
- **Recursos relevantes [39]:**
  - contabilidade por fundos;
  - "Tags" com até 5 dimensões (US$ 30/mês cada);
  - orçamento por fundo e/ou tag (Advanced Budgeting);
  - relatórios de grant com saldo, despesas e orçamento.
- **Preço:** Lite US$ 79, Core US$ 129 e Advanced US$ 229 por mês [39] [trecho].
- **O que o Jards deve copiar:** pouco além do básico. O **antipadrão** é cobrar cada dimensão de análise à parte.

### 3.5 QuickBooks com "classes" (padrão comum entre ONGs pequenas)

- **Padrão:** uma classe por grant e orçamento por classe, no relatório Budget vs. Actuals by Class [40].
- **Limites [40]:**
  - uma única dimensão não representa ao mesmo tempo programa, função, grant e restrição;
  - fica **inviável com mais de 20 fundos**.
  - Integrações de terceiros (Ramp) falham ao exportar transações com classe [59].
- **Lição para o Jards:** o cliente brasileiro típico (produtora, associação esportiva) também usa ERP simples ou planilha. O Jards não deve depender da estrutura contábil do cliente. Deve **manter o próprio razão do projeto**, alimentado pelo extrato da conta vinculada, e oferecer exportação.

---

## 4. Contabilidade de produção audiovisual e incentivos fiscais

> Este é o segmento mais parecido com ANCINE e com as leis de incentivo, por quatro razões:
>
> - o orçamento é aprovado e "travado";
> - os custos são classificados como qualificáveis ou não;
> - as regras mudam por jurisdição;
> - há auditoria obrigatória antes do benefício.

### 4.1 GreenSlate

- **URL:** https://greenslate.com
- **Para quem:** produções de cinema e TV nos EUA (folha de pagamento e contabilidade de produção, tudo na nuvem).
- **Recursos relevantes:**
  - **Tax Credit Summary [41]:**
    - para cada incentivo e versão (vários estados no mesmo projeto), carrega **o plano de contas cruzado com os códigos de incentivo**;
    - **marca as contas com transações sem código** e mostra quantidade e valor "em jogo";
    - um clique abre o razão da conta dentro da tela, o usuário atribui o código, salva, e **a marca some**;
    - a coluna **"Unassigned"** filtra só o que está pendente, para "limpar uma produção inteira numa sessão";
    - estima o crédito com base no gasto real;
    - exporta relatórios no formato de estados como NY e GA.
  - **Incentives Dashboard [42]:**
    - todos os incentivos de todos os projetos;
    - linha do tempo da solicitação;
    - status e totais estimados;
    - **gasto qualificado estimado × final aprovado pelo órgão**;
    - contato do auditor, CPA ou film office;
    - **visões por papel**: produtor, contador, executivo e financiador;
    - fluxos de aprovação configuráveis.
  - **Codificação [43]:**
    - mais tipos de código e campos livres;
    - **edição em lote**;
    - validação de código e checagens de conformidade em tempo real.
  - **Relatórios semanais recomendados [44]:**
    - cost report (real × orçamento travado);
    - top sheet;
    - balancete;
    - razão;
    - **EFC Change Report**: custo final estimado original × novo, **data e motivo de cada mudança**;
    - POs em aberto;
    - contas a pagar por idade;
    - registro de pagamentos;
    - resumo de crédito fiscal.
- **Preço:** não público.
- **Fraquezas:** quase não há reviews públicos do produto. O material é sobretudo do fornecedor [fornecedor].
- **O que o Jards deve copiar (alta prioridade):**
  - a tela **"Pendências de enquadramento"** ao estilo Tax Credit Summary: rubricas × lançamentos sem rubrica, sem comprovante ou sem enquadramento, com contagem e valor, resolvidos em linha;
  - o **log de remanejamento com motivo**, no modelo do EFC Change Report;
  - o **dashboard de portfólio por papel** para consultorias.

### 4.2 Entertainment Partners (SmartAccounting, Moneypenny, Production Incentives)

- **URL:** https://www.ep.com
- **Para quem:**
  - grandes produções nos EUA, Reino Unido e Canadá (SmartAccounting);
  - produções independentes no Reino Unido, Austrália e Nova Zelândia (Moneypenny).
- **Recursos relevantes:**
  - **SmartAccounting [45]:**
    - mais de 250 relatórios-modelo;
    - **"one-click audit reports"** e "Reports Packages" para compartilhar com stakeholders;
    - **importa contas e valores do orçamento do Movie Magic Budgeting** para montar o cost report;
    - upload ou scan de notas;
    - papéis e permissões;
    - integração com POs digitais (SmartPO) e com o cartão e pagamentos CASHét (despesas de cartão importadas automaticamente);
    - no Reino Unido, passou pelo reconhecimento do HMRC.
  - **Moneypenny [46]:**
    - **revisão lado a lado** entre a nota digital e o lançamento;
    - **notas explicativas de variação que passam para os períodos seguintes**;
    - aprovações de PO, nota e caixa pequeno por produção, em lote e com documentos anexos;
    - arquivamento automático;
    - "registro seguro de todos os documentos para **sustentar o pedido de incentivo**";
    - **acesso direto do auditor à plataforma**;
    - conciliação de VAT/GST.
  - **Production Incentives [47]:**
    - base de mais de 120 jurisdições com percentual, o que qualifica, prazos e links para a legislação;
    - estimador de incentivo;
    - comparação de até 3 jurisdições;
    - **serviço** de administração do incentivo: monitoram o razão durante a produção "para manter a qualificação" e cuidam da comunicação com o órgão;
    - financiamento com o crédito como garantia.
- **Preço:** não público.
- **Fraquezas:**
  - concorrentes acusam a EP de ter "vários produtos desconectados" [43] [concorrente];
  - a Saturation diz que o SmartAccounting registra o gasto mas não carrega as regras de cada jurisdição [52] [concorrente].
- **O que o Jards deve copiar:**
  - **portal do auditor e do contador** com acesso de leitura;
  - **notas de variação que persistem entre períodos**;
  - revisão lado a lado entre documento e dados extraídos, que já é natural no Jards com a extração por IA;
  - **base de conhecimento por lei** com link para a norma, como serviço de confiança.

### 4.3 Cast & Crew (PSL+, DPO e PO+, Hot Budget, Sargent-Disc)

- **URL:** https://www.castandcrew.com
- **Recursos relevantes:**
  - **PSL+ [48]:** orçamento, custos diários, pagamento de fornecedores e relatórios, com MFA.
  - **DPO e PO+ [48]:** pedidos de compra digitais com **fluxos de aprovação customizáveis e aprovação direto pelo e-mail**. O plano de contas é importado do PSL+.
  - **Hot Budget [49] [trecho]:** orçamento de publicidade e videoclipe no formato AICP exigido pelas agências; **importa wrap reports**; "running budget" comparado ao orçamento original.
  - **Sargent-Disc [50]:** braço do Reino Unido, com o "Digital Production Office".
- **Preço:** não público.
- **O que o Jards deve copiar:**
  - **aprovação por e-mail ou WhatsApp com link mágico** para o proponente aprovar despesa ou remanejamento sem entrar no sistema;
  - o conceito de **compromisso (PO/contrato) antes do pagamento**, para mostrar o "comprometido".

### 4.4 Wrapbook

- **URL:** https://www.wrapbook.com
- **Recursos relevantes [51]:**
  - folha de pagamento com retenções pelo estado onde o trabalho ocorreu;
  - relatórios de fim de produção;
  - suporte específico a incentivos de Illinois e Novo México.
  - **Production Incentives Center:** buscador de incentivos elegíveis, mapa, comparador, **"AI Production Incentives Expert"** (perguntas em linguagem natural) e **base de formulários governamentais**.
- **O que o Jards deve copiar:** a **central normativa com assistente**. Perguntas como "posso pagar cachê a sócio do proponente?" teriam resposta citando IN, portaria ou manual, e cada regra do motor apontaria para o trecho da norma.

### 4.5 Saturation (orçamento, banco e incentivos; fonte é o blog do próprio fornecedor)

- **URL:** https://saturation.io
- **O que o fornecedor afirma [52] [fornecedor]:**
  - classifica cada transação de cartão, nota ou folha segundo as regras da jurisdição;
  - painel de gasto qualificado em tempo real;
  - controle de residência da equipe;
  - **pacote de auditoria sob demanda** com relatório por categoria e fornecedor, notas, **comprovantes de pagamento**, documentos de residência, contratos e cadastro de fornecedor, e folhas de ponto.
  - Recomendações do mesmo texto:
    - "**gere um pacote de auditoria rascunho na metade da produção**, não no fim";
    - exigir o cadastro do fornecedor antes de pagar;
    - "planilhas perdem a trilha de auditoria assim que duas pessoas editam".
  - Lista armadilhas típicas de glosa:
    - tetos acima da linha;
    - não residentes;
    - empresas de fachada (loan-outs);
    - **partes relacionadas**;
    - salários acima do mercado.
- **O que o Jards deve copiar:**
  - o **"pré-pacote" no meio da execução**;
  - checagens de **partes relacionadas**: fornecedor com sócio em comum com o proponente, a partir do QSA do CNPJ [?];
  - checagens de **preço acima do mercado**.

### 4.6 Como os órgãos estrangeiros recebem a prestação (referência para o "pacote")

- **Reino Unido (BFI e HMRC, AVEC) [53]:**
  - no certificado final é obrigatório enviar o **final cost report**;
  - se o projeto pontua nas seções C e D do teste cultural, também é obrigatório o **relatório de auditor**;
  - desde 01/07/2025, o auditor precisa ser registrado e há **um template obrigatório** [trecho].
- **Austrália (Screen Australia, Producer Offset) [22]:**
  - o envio é feito por formulário SmartyGrants com planilha QAPE de várias abas e auditor registrado;
  - há regras de nome de arquivo e de formato (ver 2.4).
- **Canadá (CAVCO e Telefilm) [54] [trecho]:**
  - orçamento travado no formato Telefilm;
  - **demonstrativo auditado** de custos para produções com custo final a partir de CAD 500 mil;
  - **revisão** para produções entre CAD 200 mil e 500 mil;
  - final cost report detalhado.
- **Lição:** em todos os casos, o pacote final reúne quatro peças: (1) relatório de custo final no layout do órgão, (2) subconjunto do razão, (3) anexos com nomenclatura definida e (4) atestação de terceiro. Para o Jards, isso equivale a "relatório de execução + relação de pagamentos + comprovantes nomeados + parecer ou declaração do contador quando exigido".

---

## 5. Captura de despesas e conciliação

### 5.1 Ramp (captura de recibos e Policy Agent)

- **URL:** https://ramp.com
- **Para quem:** empresas dos EUA (cartão corporativo, contas a pagar, despesas).
- **Recursos relevantes:**
  - **Captura de recibos [55]:**
    - SMS, e-mail, Slack, WhatsApp e **integração com a caixa do Gmail ou Outlook**, que captura e anexa recibos recebidos por e-mail;
    - OCR de estabelecimento, valor, data e itens;
    - **casamento automático com a transação** ("90%+ de acerto"; "95% casados no mesmo dia") [fornecedor];
    - sugestão de categoria contábil e memorando.
  - **Policy Agent [56][57]:**
    - aplica a **política escrita** a toda transação e reembolso;
    - interpreta a política semanticamente;
    - usa RAG para **citar o trecho exato da política** que fundamenta a recomendação (ícone "i" no rótulo);
    - avalia o contexto completo: estabelecimento, itens, recibo, memorando, participantes, viagem e dados do funcionário.
    - **Três desfechos:**
      - "Aprovação recomendada";
      - "Requer revisão", quando há incerteza, falta de contexto ou a política exige humano;
      - "Rejeição recomendada".
    - **Tende ao conservador**: na dúvida, escala para um humano.
    - Aponta **lacunas na política**: por exemplo, um upgrade de assento não previsto é escalado e o controller atualiza a regra.
    - Aceita **notas ocultas**, que orientam o agente sem aparecer para o funcionário.
    - Mostra métricas de **onde as violações se concentram e quanto os revisores discordam do agente**.
    - **O revisor humano sempre tem a palavra final.**
    - Não julga se a codificação contábil está correta [56].
    - Números do fornecedor: menos 85% de revisões manuais e 99%+ de acerto [fornecedor].
- **Preço [58]:** Free a US$ 0, com captura e conciliação automática de recibos. Plus a US$ 15 por usuário/mês mais taxa de plataforma, com o Policy Agent.
- **Fraquezas [59]:**
  - sincronização com o QuickBooks Online falha às vezes, sobretudo em transações com classe;
  - atraso no upload de recibos;
  - aplicativo móvel atrás da versão web;
  - limitações de permissões e aprovação.
- **O que o Jards deve copiar (alta prioridade):**
  - o desenho do motor de regras: **três desfechos, citação literal da norma, viés conservador, humano decide, lacunas da norma registradas e métricas de discordância**;
  - a captura por **WhatsApp e e-mail encaminhado**.
  - Hoje o `extrair-comprovante` do Jards devolve risco e "motivos_glosa" **sem citar a norma**. O passo seguinte é anexar a cada motivo o dispositivo normativo (IN, portaria ou manual, com artigo e item) e os dados usados na avaliação.

### 5.2 Brex (Assistant, audit agent e review agent)

- **URL:** https://www.brex.com
- **Recursos relevantes [60]:**
  - o **Assistant** preenche recibo, memorando e participantes e **comenta na despesa pedindo informação** quando a política exige;
  - o **audit agent** monitora gastos segundo os processos internos e **classifica possíveis violações por nível de risco**;
  - o **review agent** aprova automaticamente o que é de baixo risco, escala exceções e cobra quem está fora de conformidade;
  - a política pode ser enviada e editada a qualquer momento;
  - **orçamentos com exigências documentais**, em que o admin escolhe entre **bloquear** a despesa não conforme ou **permitir marcando como não conforme**;
  - **"compliance rating" por pessoa** (alto, médio ou baixo), calculado pela presença da documentação exigida e comparado ao histórico, visível nas tarefas do próprio usuário.
- **Preço:** não levantado.
- **O que o Jards deve copiar:**
  - escolha **"bloquear × permitir com marca"** por regra;
  - **índice de conformidade por responsável ou fornecedor** (por exemplo, "o produtor X tem 30% de comprovantes incompletos").

### 5.3 Expensify (SmartScan)

- **URL:** https://www.expensify.com
- **Recursos relevantes [61]:**
  - o OCR do SmartScan lê estabelecimento, data e valor;
  - detecta recibos duplicados, borrados ou suspeitos;
  - verifica a política e o câmbio.
  - **Regra explícita de casamento automático** entre recibo e transação de cartão. O casamento só acontece quando:
    - o valor bate (ou fica dentro da tolerância);
    - a data bate;
    - a moeda bate, com diferença de câmbio de no máximo 5%;
    - **existe um único par possível**;
    - a transação entra até 7 dias depois do scan;
    - o recibo não foi editado à mão nem usado em outro casamento.
- **Fraquezas [61]:**
  - bugs e erros de sincronização;
  - **duplicação de despesa** quando o usuário edita durante o scan;
  - preço;
  - suporte limitado;
  - fácil para o usuário, difícil para o administrador.
- **O que o Jards deve copiar:** **regras de auto-conciliação documentadas e conservadoras**, em que só há auto-match quando o casamento é inequívoco. Quando houver mais de um candidato, o sistema sugere e o humano escolhe. A tela deve mostrar *por que* o sistema casou: valor, data, CNPJ e descrição.

### 5.4 Pleo

- **URL:** https://www.pleo.io
- **Recursos relevantes [62]:**
  - pede o recibo **no momento da compra**;
  - OCR e categorização automática;
  - **e-mail semanal ao admin com os recibos faltantes**;
  - o admin pode marcar um recibo como "faltante" em nome do usuário;
  - checklist antes da exportação (categoria, imposto, notas);
  - **despesa exportada fica travada para edição**;
  - mais de 20 integrações contábeis e CSV personalizável.
- **O que o Jards deve copiar:**
  - **resumo semanal de pendências** por projeto e responsável;
  - **travamento após envio**, em que o lote enviado ao órgão vira um retrato imutável.

### 5.5 Dext (ex-Receipt Bank) e Hubdoc (Xero)

- **Dext** (https://dext.com) [63]:
  - captura por e-mail, WhatsApp, Dropbox, upload e feeds bancários;
  - extrai fornecedor, valor, imposto e vencimento;
  - **regras por fornecedor**: categoria, imposto e moeda padrão;
  - **auto-publish** por fornecedor ou forma de pagamento, combinado com regras e "Smart Split".
  - Preço: de US$ 27 a 80+ por mês para PMEs e de US$ 235 a 850 por mês para escritórios [63] [trecho]. A principal crítica é o preço.
- **Hubdoc** (incluído no ecossistema Xero) [64]:
  - **"Fetch"** busca documentos em portais de bancos, concessionárias e fornecedores;
  - OCR e regras por fornecedor;
  - publica no Xero e **anexa o documento original à transação bancária conciliada**.
  - Fraquezas: feeds que quebram e exigem nova credencial; extração fraca em extratos; relatos de remoção do fetch de extratos [64] [?].
- **O que o Jards deve copiar:**
  - **regras por fornecedor ou CNPJ**: rubrica padrão, enquadramento e retenções;
  - **documento anexado à linha do extrato** como unidade de conciliação.
  - Equivalente brasileiro do "Fetch": importar automaticamente XML de NF-e e NFS-e pelo CNPJ do proponente [?] (a viabilidade depende de convênios e APIs municipais; não verificado aqui).

### 5.6 DataSnipper (prontidão para auditoria)

- **URL:** https://www.datasnipper.com
- **Para quem:** auditores e times financeiros (suplemento do Excel).
- **Recursos relevantes [65]:**
  - **Document Matching**: o usuário seleciona células e o sistema acha o valor, a data ou o texto nos documentos importados (notas, extratos) e cria a referência;
  - **Snips**: cada número da planilha fica **ligado à região destacada do documento-fonte**, e o revisor clica para ver de onde veio.
- **Preço:** não público [?].
- **O que o Jards deve copiar:** **"número → fonte" em todo o relatório.** Cada valor na relação de pagamentos ou no relatório de execução abre o comprovante com o campo destacado (valor, CNPJ, data). A extração por IA já sabe onde está cada campo e pode guardar as coordenadas [?].

---

## 6. Fundos públicos na UE e no Reino Unido e prontidão para auditoria

### 6.1 Funding & Tenders Portal (Comissão Europeia, Horizon Europe)

- **URL:** https://ec.europa.eu/info/funding-tenders/opportunities/portal
- **Recursos relevantes:**
  - **Continuous Reporting** [66]:
    - módulo **sempre aberto** para enviar entregáveis e reportar marcos durante todo o projeto;
    - **alimenta automaticamente a Parte A** do relatório técnico periódico.
  - **Relatório financeiro:**
    - é **gerado pelo sistema** a partir dos dados do módulo de relatório periódico;
    - o relatório periódico vence em até 60 dias após o fim do período e é **condição para o pagamento** [66][67].
  - **Certificado de auditoria (CFS) [68]:** é exigido do beneficiário cuja contribuição solicitada é de pelo menos € 430 mil (ou € 725 mil para quem passou na auditoria de sistemas). É entregue com o relatório final e é **condição para o pagamento final**.
  - **Lump sum:** o pagamento é feito quando o pacote de trabalho é concluído, em vez de por custo comprovado. Isso desloca a prestação para **evidência de entrega** [69].
- **O que o Jards deve copiar:**
  - **metas, entregas e evidências registradas continuamente**, com o relatório **montado a partir delas**;
  - **gatilhos de exigência por valor**, como "acima de X, exige parecer de auditor", configurados por norma.

### 6.2 EMDESK (Alemanha, coordenação de projetos Horizon)

- **URL:** https://www.emdesk.com
- **Recursos relevantes [69]:**
  - orçamento **ligado a pacotes de trabalho, tarefas e entregáveis**;
  - custo e esforço por parceiro, categoria de custo e período de relatório;
  - perfis financeiros com custo de pessoal e overhead por participante;
  - dashboard ao vivo de orçado × real "até a atividade";
  - **visão de portfólio** com saúde financeira e prazos de todos os projetos;
  - a mesma base de dados em **tabela, Gantt e Kanban**;
  - aditivos ao plano de trabalho e ao orçamento;
  - **começar o projeto a partir de template** (estrutura de orçamento, painéis, permissões).
- **Preço:** não levantado.
- **O que o Jards deve copiar:**
  - **rubrica ligada a meta ou etapa**, porque a prestação física e a financeira contam a mesma história;
  - **template por lei e programa** que já cria rubricas, metas, calendário e regras;
  - visão de portfólio para consultorias.
  - Isso combina com o padrão do DESIGN.md: lista e kanban sobre a mesma fonte.

### 6.3 Arachne (Comissão Europeia, fundos estruturais)

- **URL:** sem página pública de produto; documentação em https://archive.interact.eu/download/file/fid/13160 (FAQ) e no Anti-Fraud Knowledge Centre da Comissão
- **Para quem:** autoridades de gestão dos fundos estruturais da UE. É gratuito para elas.
- **Recursos relevantes [70]:**
  - até **102 indicadores de risco em 7 categorias**: contratação, gestão de contratos, elegibilidade, desempenho, **concentração**, razoabilidade, e reputação e alertas de fraude;
  - pontuação por projeto, beneficiário, contrato e contratado;
  - os riscos de despesa (**pagamento em duplicidade**, **pagamento antes do início do período elegível**) **só são calculados se os dados necessários forem enviados**;
  - cada indicador tem um **pop-up com descrição e dados necessários**;
  - **não detecta conluio** (limite declarado).
- **O que o Jards deve copiar:**
  - **catálogo de verificações agrupado em categorias**, por exemplo: elegibilidade temporal, limites por grupo, concentração em fornecedor, duplicidade, partes relacionadas e razoabilidade de preço;
  - cada verificação traz **descrição, dados necessários e estado "não calculável: falta X"**, em vez de silenciar;
  - declarar abertamente o que o sistema **não** detecta.

### 6.4 Reino Unido: GovS 015 (padrão funcional de grants) e Spotlight

- **GovS 015 [71]:**
  - todo grant tem **KPIs e/ou marcos e resultados de longo prazo como parte vinculante do acordo**;
  - o monitoramento é contínuo, com vários checkpoints;
  - há **revisão de desempenho e conciliação financeira anuais** nos esquemas plurianuais e no fim de todos.
- **Spotlight [72]:**
  - ferramenta de due diligence automatizada do Cabinet Office;
  - cruza registro de empresas (Companies House), grants anteriores, **pedidos duplicados** e plágio;
  - usada por departamentos e por mais de 250 conselhos locais [trecho].
- **O que o Jards deve copiar:**
  - **checkpoints intermediários** obrigatórios: conciliação mensal ou trimestral, em vez de só no fim;
  - **checagem cadastral do fornecedor** (situação do CNPJ, CNAE compatível com o serviço, sócios) como regra automática [?];
  - a viabilidade depende de fonte de dados pública ou API.

### 6.5 Banco Mundial: GEMS (evidência de campo georreferenciada)

- **URL:** https://www.worldbank.org/en/topic/fragilityconflictviolence/brief/geo-enabling-initiative-for-monitoring-and-supervision-gems
- **Recursos relevantes [73]:**
  - coleta de campo estruturada com ferramentas abertas (KoBoToolbox);
  - indicadores, **fotos, áudio e vídeo com data, hora e GPS**, que alimentam automaticamente um sistema central de monitoramento e avaliação com mapa;
  - mais de 1.000 projetos em mais de 100 países entre 2018 e 2022.
- **O que o Jards deve copiar:**
  - **evidência de entrega com metadados capturados na origem** (EXIF, geolocalização, data e hora), por exemplo uma foto de oficina ou de jogo ligada à meta, ao local e à data da atividade;
  - **mapa e linha do tempo das ações** como evidência agregada.

---

## 7. Tabela comparativa

Legenda: **Sim** = encontrado nas fontes; **Parcial** = existe de forma limitada; **—** = não encontrado nas fontes; **[?]** = indício não confirmado.

| Produto | Segmento | Orçado × real por rubrica | Remanejamento com aprovação | Regras ou motor de política | OCR + conciliação | Evidência de entrega | Calendário e prazos | Gerador de relatório | Trilha de auditoria | Portal externo (financiador, auditor) | IA |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Instrumentl (Full Lifecycle) | Beneficiário | Sim [2] | — | — | Parcial (sync contábil, sem OCR) [2] | Parcial (requisitos e tarefas) [1] | Sim [1] | Parcial (export BvA; templates por financiador em roadmap) [2] | [?] | — | Sim (Award Assistant) [1] |
| Euna Grants (AmpliFund) | Órgão e beneficiário | Sim [10] | Parcial [?] | Parcial (descrição para elegibilidade) [9] | — | Sim (Performance Plan) [10] | Sim [6] | Sim [10] | Sim [6] | Sim (portal do órgão) [9] | Parcial (genérica) [6] |
| Fluxx (Grantee Portal) | Financiador | Sim (Budget Tracker) [12] | Sim (aditivos com estados) [12] | — | Parcial (docs ligados à rubrica, sem OCR) [12] | Parcial (relatórios de progresso) [12] | Sim [12] | Parcial [15] | Sim (histórico de aditivos) [12] | Sim [13] | — |
| SmartyGrants | Financiador | Parcial (justificativa de variação) [20] | — | — | — | Parcial (fotos, campos, Outcomes Engine) [16][19] | Sim [16] | Sim (formulários e modelos) [17] | [?] | Sim | — (limitada) [21] |
| Foundant / SmartSimple | Ambos | Parcial (GrantHub Pro) [?] | [?] | — | — | Parcial | Sim | Sim (Standard Forms) [25] | Sim [25] | Sim | Sim [26][27] |
| Submittable / Good Grants | Financiador | Parcial [29] | — | — | — | Sim (multimídia) [31] | Sim [29][31] | Sim | Sim (logs) [29] | Sim | Parcial [31] |
| Sage Intacct | Contabilidade por fundos | Sim (dimensões) [33] | [?] | Parcial (spend management) [33] | [?] | — | — | Sim | Sim | — | [?] |
| Blackbaud FE NXT | Contabilidade por fundos | Sim [35][36] | [?] | Sim (regras de gasto e reembolso) [35] | [?] | — | — | Sim | Sim (drill-down) [35] | — | [?] |
| MIP Fund Accounting | Contabilidade por fundos | Sim [38] | Parcial (controle orçamentário) [38] | Parcial (contrapartida %, taxa indireta) [38] | — | — | Parcial (datas no registro) [38] | Sim | Sim [38] | — | — |
| GreenSlate | Produção audiovisual | Sim (cost report, EFC) [44] | Sim (EFC Change com motivo) [44] | Sim (códigos de incentivo, validação) [41][43] | [?] | — | Parcial (linha do tempo do incentivo) [42] | Sim (relatórios estaduais) [41] | Sim | Sim (dashboard por papel) [42] | [?] |
| EP SmartAccounting / Moneypenny | Produção audiovisual | Sim [45][46] | Parcial (notas de variação) [46] | Parcial (serviço de incentivos) [47] | Parcial (scan e cartão) [45] | — | — | Sim (one-click audit) [45] | Sim [46] | Sim (acesso do auditor) [46] | [?] |
| Cast & Crew PSL+ / Hot Budget | Produção audiovisual | Sim [48][49] | Parcial | Parcial (aprovação de PO) [48] | Parcial | — | — | Parcial | [?] | — | [?] |
| Wrapbook | Folha de produção | — | — | Parcial (retenções por estado) [51] | — | — | — | Parcial (fim de produção) [51] | [?] | — | Sim (assistente de incentivos) [51] |
| Ramp | Gestão de despesas | Parcial (funds) | — | Sim (Policy Agent) [56] | Sim [55] | — | Parcial (cobrança de recibo) | — | Sim [57] | — | Sim [56] |
| Brex | Gestão de despesas | Parcial (budgets com exigências) [60] | — | Sim [60] | Sim [60] | — | Parcial | — | [?] | — | Sim [60] |
| Expensify | Gestão de despesas | — | — | Parcial [61] | Sim (regras explícitas) [61] | — | — | — | [?] | — | Parcial |
| Pleo | Gestão de despesas | — | — | Parcial | Sim [62] | — | Sim (resumo semanal) [62] | — | Parcial (trava após export) [62] | — | Parcial |
| Dext / Hubdoc | Captura de documentos | — | — | Parcial (regras por fornecedor) [63][64] | Sim [63][64] | — | — | — | Parcial (doc anexado à transação) [64] | — | Parcial |
| DataSnipper | Auditoria | — | — | — | Parcial (doc ↔ planilha) [65] | — | — | — | Sim (snips) [65] | — | [?] |
| EU F&T Portal | Órgão (UE) | Sim [67] | [?] | Sim (CFS por valor) [68] | — | Sim (continuous reporting) [66] | Sim (60 dias) [66] | Sim (Parte A gerada) [66] | Sim | Sim (é o portal) | — |
| EMDESK | Consórcio beneficiário | Sim [69] | Sim (aditivos) [69] | Parcial (perfis de custo) [69] | — | Sim (entregáveis) [69] | Sim [69] | Sim [69] | Parcial | Parcial (consórcio) | [?] |
| Arachne | Órgão (UE) | — | — | Sim (102 indicadores) [70] | — | — | — | — | Parcial | Sim (autoridades) | Parcial (scores preditivos de terceiros) [70] |
| GEMS / KoBo | Órgão / campo | — | — | — | — | Sim (foto, GPS, hora) [73] | — | Parcial | Parcial | Sim | — |

**Leitura da tabela:**

1. Nenhum produto cobre ao mesmo tempo as colunas "Regras", "OCR + conciliação" e "Evidência de entrega".
2. Os portais de financiador fazem bem a coluna de evidências e prazos, mas são fracos em conciliação.
3. As ferramentas de despesa fazem bem regras e conciliação, mas não conhecem orçamento aprovado nem metas.
4. A contabilidade audiovisual é a que melhor junta orçamento travado, classificação de qualificação e pacote de auditoria.

---

## 8. Doze padrões para o Jards copiar, em ordem de prioridade

Prioridade: **P0** = base do módulo; **P1** = diferencial forte; **P2** = depois. As telas citadas seguem o DESIGN.md:

- raio de 4px;
- verde só para salvar e confirmar;
- roxo para seleção e navegação;
- etiquetas de status com borda leve e cor semântica: coral para "não conforme", âmbar para "revisar", verde ou teal para "conforme".

### P0-1. Árvore orçamentária viva (aprovado → remanejado → comprometido → pago → saldo)

- **Origem:**
  - Spenddown do Instrumentl, com planejado × lançado [2];
  - cost report e EFC do GreenSlate [44];
  - Budget Tracker do Fluxx [12];
  - grant como objeto com período próprio no Blackbaud [35];
  - dimensões do Sage Intacct [33].
- **No Jards (aba Orçamento):**
  - árvore Grupo/Etapa → Rubrica → Item;
  - colunas: Aprovado, Remanejado (±), Vigente, **Comprometido** (contratos e pedidos firmados ainda não pagos), Pago, Saldo, % executado e **% do limite da norma** para grupos com teto;
  - cada linha mostra um pequeno indicador de pendências: lançamentos sem comprovante, sem conciliação ou com regra violada;
  - a fonte (incentivo, contrapartida ou outros) é uma dimensão filtrável;
  - a importação do orçamento aprovado é feita a partir da planilha ou PDF do sistema do órgão;
  - o mapeamento "categoria do cliente → rubrica" é salvo para os próximos lançamentos;
  - números em algarismos tabulares;
  - o drill-down abre os lançamentos da rubrica numa sheet lateral.

### P0-2. Conciliação em três vias com auto-match apenas quando inequívoco

- **Origem:**
  - regras explícitas de casamento do Expensify, incluindo "único par possível" [61];
  - captura e casamento do Ramp [55];
  - documento anexado à transação no Hubdoc [64];
  - "nota + comprovante de pagamento correspondente" do SmartyGrants [19];
  - documentos ligados à rubrica na solicitação de reembolso do Fluxx [12].
- **No Jards (nova aba "Conciliação", ou sub-visão de Comprovantes):**
  - tela dividida, com as **linhas do extrato da conta vinculada** à esquerda (importadas de OFX ou CSV) e os **documentos fiscais e recibos** à direita;
  - estados por linha:
    - "Conciliado automaticamente";
    - "Sugerido (2 candidatos)";
    - "Divergente (valor ou data)";
    - "Sem documento";
    - "Documento sem pagamento";
  - o auto-match só acontece quando valor, data (com tolerância configurável) e CNPJ batem e **há um só candidato**;
  - cada casamento mostra "por que casou" (valor igual, CNPJ igual, data a menos de 3 dias);
  - ações em lote;
  - atalhos de teclado para quem concilia centenas de linhas.

### P0-3. Motor de regras com justificativa normativa citada e três desfechos

- **Origem:**
  - Ramp Policy Agent: cita o trecho, dá três desfechos, é conservador, tem notas ocultas, aponta lacunas da política e mede discordância [56][57];
  - Arachne: catálogo por categoria, pop-up com descrição e dados necessários, "só calcula se houver dados" [70];
  - Brex: bloquear × permitir com marca, risco por nível [60].
- **No Jards:**
  - cada regra (por exemplo, "despesa fora do período de execução", "teto do grupo X excedido", "concentração em um fornecedor acima de Y%", "pagamento em espécie", "fornecedor com sócio em comum com o proponente") tem:
    - código;
    - categoria;
    - **dispositivo normativo** (lei, IN, portaria ou manual, com artigo ou item e link);
    - severidade;
    - comportamento (bloquear ou marcar);
  - o resultado de cada verificação é **Conforme**, **Revisar** ou **Não conforme**, junto com:
    - "Por quê", em uma frase;
    - "Fonte", com o trecho citado;
    - "Dados usados";
    - ou o estado "Não calculável: falta o CPF do prestador";
  - quando o humano aceita uma exceção, ele **justifica por escrito** e a justificativa entra no relatório e na trilha;
  - um painel mostra onde as violações se concentram e quanto a equipe discorda da sugestão automática.
- **Evolução natural do `extrair-comprovante`:** cada "motivo_glosa" passa a apontar para uma regra do catálogo, em vez de texto livre.

### P0-4. Fila "Não atribuído": pendências de enquadramento resolvidas em linha

- **Origem:**
  - Tax Credit Summary do GreenSlate: coluna "Unassigned", clique abre o razão, a pendência some ao salvar [41];
  - destaque de despesa não orçada do Sage Intacct [33];
  - recibos faltantes do Pleo [62].
- **No Jards (Visão geral e Comprovantes):**
  - uma tabela-resumo por rubrica com as colunas "Sem rubrica", "Sem comprovante", "Sem conciliação", "Regra pendente" e "Sem evidência de meta", com contagem e valor;
  - o filtro "só pendentes" permite **zerar o projeto numa sessão**;
  - a ação acontece na própria linha: atribuir rubrica, anexar documento ou justificar;
  - edição em lote [43];
  - **o percentual de prontidão** do projeto vira o KPI principal da Visão geral.

### P0-5. Trilha "número → fonte" e períodos travados

- **Origem:**
  - snips do DataSnipper [65];
  - drill-down do Blackbaud [35];
  - trava após exportação do Pleo [62];
  - períodos fechados do Euna/AmpliFund, com reabertura pelo gestor [9];
  - "FOIA-ready audit trails" [6].
- **No Jards:**
  - todo valor no relatório, na relação de pagamentos e no balancete é clicável e abre o comprovante com **o campo de origem destacado**;
  - toda alteração gera um evento (quem, quando, antes, depois, motivo);
  - ao "fechar período" ou "enviar lote", forma-se um **retrato imutável**;
  - reabrir exige um pedido com motivo e fica registrado.

### P1-6. Remanejamento como objeto com workflow e log de motivos

- **Origem:**
  - aditivos do Fluxx: tipos; Draft, Returned, Submitted, Approved, Signatories e Executed; administrativo × formal [12];
  - EFC Change Report: valor original × novo, data e motivo [44];
  - notas de variação do Moneypenny que passam para os períodos seguintes [46];
  - justificativa de divergência do SmartyGrants [20].
- **No Jards:**
  - botão "Solicitar remanejamento" na aba Orçamento;
  - o usuário escolhe as rubricas de origem e destino e o sistema **calcula na hora o percentual movido contra o limite da norma do programa**;
  - se estiver dentro do limite, o remanejamento é **"administrativo"**: aplica com justificativa e entra no relatório;
  - se estiver acima, é **"formal"**: gera a minuta do pedido ao órgão e fica "Aguardando órgão" até o upload da aprovação;
  - linha do tempo de versões do orçamento (v1 aprovado, v2 remanejado...) com diff por rubrica.

### P1-7. Pacote de envio com manifesto, nomenclatura e "pré-pacote" no meio da execução

- **Origem:**
  - formulário da Screen Australia: abas obrigatórias, subconjunto do razão, partes relacionadas, nome de arquivo, sem ZIP, 25 MB [22];
  - audit packet sob demanda e rascunho na metade da produção (Saturation) [52];
  - one-click audit reports e Reports Packages (EP) [45];
  - CFS acima de um valor no Horizon [68];
  - final cost report e auditor no BFI e no CAVCO [53][54].
- **No Jards (aba Relatório → "Pacote"):**
  - o usuário escolhe o destino (por exemplo, o sistema federal da lei de cultura, ANCINE, esporte ou saúde);
  - o sistema mostra **um checklist** de documentos exigidos, com estado de cada um;
  - os arquivos são renomeados pelo padrão do destino;
  - o sistema valida tamanho e formato e gera a relação de pagamentos e o razão do projeto no layout do órgão;
  - a declaração ou parecer do contador é exigida quando a norma pede, por gatilho de valor ou tipo;
  - um **manifesto** lista arquivo por arquivo com hash;
  - o botão **"Gerar pré-pacote"** fica disponível a qualquer momento e mostra o que falta hoje;
  - cada envio gera uma versão travada (ver P0-5).

### P1-8. Biblioteca de evidências por meta, com metadados capturados na origem

- **Origem:**
  - Continuous Reporting do Horizon, que alimenta o relatório [66];
  - GEMS e KoBo, com foto, GPS e hora [73];
  - uploads multimídia e privacidade por campo do Good Grants [31];
  - Performance Plan (planejado × alcançado) do Euna/AmpliFund [10];
  - KPIs e marcos vinculantes do GovS 015 [71].
- **No Jards (abas Atividades, Distribuição e Divulgação):**
  - cada evidência (foto, vídeo, lista de presença, peça de divulgação com aplicação de logomarcas, borderô) é ligada a **meta, produto, atividade, data e local**;
  - EXIF, geolocalização e data são lidos automaticamente;
  - um indicador mostra a **cobertura por meta** (por exemplo, "Meta 3: 4 de 6 oficinas com evidência");
  - listas de presença com dados pessoais ficam com acesso restrito;
  - o relatório de execução física é montado a partir da biblioteca.

### P1-9. Extração de obrigações do instrumento para gerar calendário e regras

- **Origem:**
  - Award Assistant do Instrumentl [1];
  - "ficha do grant" do MIP com contrapartida %, taxa indireta, datas de relatório e exigência de auditoria [38];
  - templates de projeto do EMDESK [69].
- **No Jards:**
  - o usuário sobe a portaria de aprovação, o termo de compromisso ou o contrato de patrocínio;
  - a IA propõe prazos, vigência, conta vinculada, limites, contrapartida e periodicidade de relatórios;
  - **o usuário confirma campo a campo** antes que isso vire calendário e regras ativas;
  - um template por lei e programa pré-carrega rubricas, metas e regras.

### P1-10. Painel de portfólio multiprojeto por papel (consultorias e captadores)

- **Origem:**
  - Incentives Dashboard do GreenSlate: status, estimado × aprovado, auditor e visões por papel [42];
  - portfólio do EMDESK [69];
  - visão Awards do Instrumentl [1].
- **No Jards:**
  - lista e kanban de todas as prestações da carteira, com colunas para:
    - prazo da próxima obrigação;
    - % de prontidão (P0-4);
    - valor em risco de glosa (soma dos "Não conforme" e "Revisar");
    - captado × executado;
    - responsável;
  - filtros por proponente, lei e status, usando o `ColumnManager`.

### P2-11. Acesso de convidado para contador, auditor ou patrocinador (somente leitura)

- **Origem:**
  - "acesso direto do auditor à plataforma" do Moneypenny [46];
  - visão de financiadores no GreenSlate [42];
  - portal do beneficiário no Fluxx, como contraexemplo de experiência ruim [14].
- **No Jards:**
  - link de convite com escopo por projeto e por seção (Visão geral, Conciliação, Evidências, Pacote) e prazo de expiração;
  - o convidado comenta e marca itens como "verificado";
  - tudo fica na trilha.
- Útil para o contador que assina a declaração e para o patrocinador que quer acompanhar a contrapartida.

### P2-12. Captura multicanal, regras por fornecedor e cobrança de pendências

- **Origem:**
  - WhatsApp, e-mail e integração com a caixa postal do Ramp [55];
  - regras por fornecedor e auto-publish do Dext [63];
  - e-mail semanal de recibos faltantes do Pleo [62];
  - compliance rating por pessoa da Brex [60];
  - aprovação por e-mail do Cast & Crew DPO [48].
- **No Jards:**
  - um número de WhatsApp ou e-mail por projeto para receber notas e recibos, que caem na fila de conciliação;
  - **regras por CNPJ** (rubrica padrão, enquadramento, retenções);
  - **resumo semanal** por responsável ("faltam 7 comprovantes no Projeto X");
  - índice de completude por fornecedor ou produtor;
  - aprovação de despesas por link sem login.

> Fora da lista, mas vale registrar: uma **central normativa com assistente** (Wrapbook, EP [47][51]) em que cada regra do motor (P0-3) aponta para o trecho da norma e o usuário pode perguntar em linguagem natural. Também uma **checagem cadastral automática de fornecedor** (Spotlight [72]; situação do CNPJ e sócios) [?].

---

## 9. Antipadrões a evitar

1. **Formulário sem salvamento automático.** O guia do Euna/AmpliFund avisa "não salva sozinho; role e clique Save as Draft" [9]. Em prestação de contas longa, isso significa perder trabalho.
2. **Planilha-modelo como relatório financeiro.** Alguns financiadores no Fluxx pedem relatório fiscal em Excel anexado [15]. Os dados morrem no anexo e a conferência vira manual.
3. **Total plurianual sem quebra por período.** É a reclamação recorrente no AmpliFund e no Instrumentl [5][11]. Projetos incentivados têm captação e execução em anos diferentes.
4. **Relatório que obriga a exportar para o Excel para cruzar dados.** Acontece no Submittable [30] e no Blackbaud ("difícil extrair num formato usável") [37]. Tudo que a pessoa precisa conferir deve dar para filtrar e cruzar na tela.
5. **Classificar só no fim.** O cenário do "wrap" descrito pelo GreenSlate [41] mostra o problema: descobrir na véspera do envio centenas de lançamentos sem código. Pendência tem que aparecer no dia em que nasce (P0-4).
6. **IA que decide sem citar a norma ou que aprova sozinha na dúvida.** O Ramp mostra o contrário: cita a política, tende ao conservador e deixa a palavra final ao humano [56]. Um nível de risco sem fundamentação, como o retorno atual do `extrair-comprovante`, não se sustenta diante do órgão.
7. **Auto-conciliação "otimista".** Casar quando há mais de um candidato gera erro silencioso. A regra do Expensify só casa com par único [61].
8. **Portal externo de segunda classe.** O portal do Fluxx é "desajeitado" e limita o número de pessoas do beneficiário [14]. O mesmo vale para os convidados do Jards: contador, auditor e patrocinador.
9. **Configuração que exige código ou administrador técnico.** Acontece com o Liquid no Fluxx [14] e com a configuração do SmartSimple [28]. As regras e templates por lei devem vir prontos e ser editáveis por formulário.
10. **Ecossistema fragmentado em vários aplicativos.** Há críticas a "vários produtos desconectados" na produção audiovisual [43] [concorrente]. Orçamento, conciliação, evidências e pacote devem ser um único fluxo.
11. **Cobrar cada dimensão ou módulo à parte.** É o caso das tags pagas do Aplos [39] e dos SKUs que "fazem o custo subir" no Sage Intacct [34]. Isso afasta proponentes pequenos.
12. **Depender de integrações bancárias frágeis sem plano B.** O Hubdoc tem feeds que quebram [64]. A importação de OFX ou CSV do extrato deve ser sempre possível e a conexão automática, um extra.
13. **Uma única dimensão para tudo.** Classes no QuickBooks ficam inviáveis com mais de 20 fundos [40]. É preciso separar rubrica, fonte, meta e período desde o modelo de dados.
14. **Status "devolvido" que não deixa claro que o envio foi anulado.** No Fluxx, "Clarification Requested" deixa de contar como enviado e, se não houver reenvio, nada é analisado [12]. O Jards deve mostrar explicitamente "ação sua pendente: reenviar".

---

## 10. Fontes

Acessos em 01/10/2026. **(L)** = página lida diretamente; **(B)** = conteúdo obtido via resumo do buscador.

1. Instrumentl, "Grant Tracking Software for Nonprofits" (Manage), https://www.instrumentl.com/capability/manage (L)
2. Instrumentl, "Spring Launch 2026: Instrumentl Spenddown and Your New Grant Operating System" (23/04/2026), https://www.instrumentl.com/blog/spring-launch-instrumentl-spenddown-and-your-new-grant-operating-system (L)
3. Instrumentl, Pricing, https://www.instrumentl.com/pricing (L)
4. Instrumentl Help Center, "Budget Spenddown Tracking", https://help.instrumentl.com/en/articles/9114092-budget-spenddown-tracking (B; exige login)
5. Capterra, Instrumentl Reviews, https://www.capterra.com/p/233384/Instrumentl/reviews/ (B)
6. Euna Solutions, Grants Management Software (amplifund.com/features), https://www.amplifund.com/features/ (L)
7. GovTech, "Euna Solutions Buys Grant Management Tech Firm AmpliFund", https://www.govtech.com/biz/euna-solutions-buys-grant-management-tech-firm-amplifund (B)
8. ERP Research, "Euna Grants (eCivis) Review (2026)", https://www.erpresearch.com/erp-add-ons/nonprofit/euna-grants ; Indiana SBA, AmpliFund FAQ (19/02/2026), https://www.in.gov/sba/files/Amplifund_FAQ.pdf (B)
9. California State Library, "Euna Award Management Instructions", https://www.library.ca.gov/grants/manage/amplifund-award-management/ (L)
10. Nebraska DED, "Grant Budget Variance Report – AmpliFund", https://dednebraska.zendesk.com/hc/en-us/articles/6659870496923-Grant-Budget-Variance-Report-AmpliFund-Report-to-Track-Expenses (B)
11. Capterra, AmpliFund/Euna Grants Reviews, https://www.capterra.com/p/122370/AmpliFund/reviews/ (B)
12. Metropolitan Council, "Fluxx Grant Management System – External User Guide" (maio/2026), https://metrocouncil.org/getattachment/About-Us/why-we-matter/Grants/Fluxx-Information/Fluxx-User-Guide_Final-5-5-26-(1).pdf.aspx?lang=en-US (L)
13. Fluxx, Grant Management Software for Foundations, https://www.fluxx.io/grants-management-software-foundations (B)
14. G2, Fluxx Grantmaker Reviews, https://www.g2.com/products/fluxx-io-fluxx-grantmaker/reviews ; Capterra, https://www.capterra.com/p/146625/Fluxx-Software-for-Grantmakers/ (B)
15. Hogg Foundation, "Fluxx Report Submission Guidance", https://hogg.utexas.edu/wp-content/uploads/2019/04/Fluxx_Report_Submission_Guidance.pdf (B)
16. SmartyGrants, "Close the Grant", https://www.smartygrants.com/grantmaking-features/close-the-grant (L)
17. SmartyGrants, "Standardised acquittals", https://www.smartygrants.com/help-sheets/standardised-acquittals (L)
18. SmartyGrants, "Pricing and Inclusions", https://www.smartygrants.com.au/pricing/smartygrants (L)
19. SmartyGrants (R4R / Grants Management Office), "Factsheet – Providing Acquittal Evidence for Project Claims", https://r4r.smartygrants.com.au/s/site/r4r/files/Acquittal_Evidence_Fact_Sheet.pdf (L)
20. City of Casey, "Tell us how your grant was used", https://www.casey.vic.gov.au/tell-us-how-your-grant-was-used (B)
21. Plinth (concorrente), "Best SmartyGrants Alternatives for Grantmakers 2026", https://www.plinth.org.uk/complete-guide/best-smartygrants-alternatives (B)
22. Screen Australia, "Producer Offset: Final Certificate Application – Form Preview" (SmartyGrants), https://screenaustralia.smartygrants.com.au/finalapplication/197981/download.pdf (L)
23. Business Wire, "Foundant Technologies and SmartSimple Software Announce Strategic Merger" (13/08/2024), https://www.businesswire.com/news/home/20240813514222/en/Foundant-Technologies-and-SmartSimple-Software-Announce-Strategic-Merger-to-Revolutionize-Philanthropic-and-Grant-Management-Solutions (B)
24. Capterra, GrantHub Reviews, https://www.capterra.com/p/154557/GrantHub/reviews/ ; Foundant, "Post-Award Grant Management Guide", https://www.foundant.com/blog/post-award-grant-management/ (B)
25. SmartSimple, Government and Federal Grants Management Software, https://www.smartsimple.com/solution/government-grants-management-software (B)
26. PR Newswire, "SmartSimple Software Launches SmartSimple Cloud +AI", https://www.prnewswire.com/news-releases/smartsimple-software-launches-smartsimple-cloud-ai-revolutionizing-the-grants-management-lifecycle-with-advanced-artificial-intelligence-ai-301767573.html (B)
27. Re-Solved, "SmartSimple Software February 2026 upgrades", https://re-solved.ca/blog/smartsimple-software-february-2026-upgrades/ (B)
28. Capterra, SmartSimple Cloud Reviews, https://www.capterra.com/p/166429/SmartSimple-Cloud/reviews/ (B)
29. Submittable, Social Impact Reporting Software, https://www.submittable.com/features/reporting ; TechImpact, "Submittable – Consumers Guide to GMS", https://guides.techimpact.org/grants-management-systems/system/submittable/ (B)
30. Capterra, Submittable, https://www.capterra.com/p/158382/Submittable/ (B)
31. Good Grants, "Grant reports", https://goodgrants.com/features/post-award-features/grant-reports/ (B) ; Good Grants, Pricing, https://goodgrants.com/pricing/ (L)
32. Business Wire, "Bonterra Launches Grantmaker…" (19/02/2026), https://www.businesswire.com/news/home/20260219591892/en/Bonterra-Launches-Grantmaker-to-Modernize-Grantmaking-From-Intake-to-Insight (B)
33. Sage, "Sage Intacct Grant Tracking & Management Software for Nonprofits", https://www.sage.com/en-us/sage-business-cloud/intacct/product-capabilities/extended-capabilities/grants-tracking-billing/ (B; bloqueado no curl) ; Cherry Bekaert, "How Sage Intacct Dimensions Benefits Nonprofit Chart of Accounts", https://www.cbh.com/insights/articles/how-sage-intacct-dimensions-benefits-nonprofit-chart-of-accounts/ (B)
34. Capterra, Sage Intacct Reviews, https://www.capterra.com/p/76/Intacct/reviews/ ; One Hundred Nights, "Sage Intacct for Nonprofits", https://onehundrednights.com/ai-tools-for-nonprofits/accounting-finance/sage-intacct/ (B)
35. Blackbaud, "Post-award Grant and Program Accounting Software", https://www.blackbaud.com/products/blackbaud-financial-edge-nxt/grant-and-program-accounting (L)
36. Capital Business Solutions, "Financial Edge NXT Software Update May 2026", https://www.capitalbusiness.net/resources/financial-edge-software-update-may-2026/ (B)
37. Capterra, Blackbaud Financial Edge NXT Reviews, https://www.capterra.com/p/27468/Financial-Edge-NXT/reviews/ (B)
38. McGovern Consulting, "MIP Grant Module: What MIP Actually Handles" (01/09/2026), https://mcgoverncg.com/2026/09/01/mip-grant-module-grant-management/ ; MIP, Core Accounting Modules, https://www.mip.com/product/core-modules/ (B)
39. Aplos, Pricing & Features, https://www.aplos.com/pricing ; Aplos Help, "Accounting Tags", https://help.aplos.com/hc/en-us/articles/30708031208845-Accounting-Tags (B)
40. Purple Margins, "Nonprofit Accounting: 2 Ways of Grant Budgeting in QuickBooks Online", https://purplemargins.com/nonprofit-accounting-grant-budgeting-qbo/ ; ActuallyFi, "Grant Management for QuickBooks", https://actuallyfi.com/post/grant-management-for-quickbooks-complete-guide-for-nonprofits (B)
41. GreenSlate, "Real-Time Tax Credit Visibility, Start To Finish" (Tax Credit Summary, atualizado em 11/05/2026), https://greenslate.com/blog/tax-credit-summary-production-accounting (L)
42. GreenSlate, "Incentives Dashboard", https://greenslate.com/incentives-dashboard (L)
43. GreenSlate, "A Smarter Way to Code: More Fields, Fewer Frustrations", https://greenslate.com/blog/coding-greenslate-platform (L)
44. GreenSlate, "9 Essential Weekly Accounting Reports for Production Accountants" (14/08/2026), https://greenslate.com/blog/essential-weekly-reports-for-production-accountants (L)
45. Entertainment Partners, SmartAccounting, https://www.ep.com/smartaccounting/ (L)
46. Entertainment Partners, Moneypenny Accounting, https://www.ep.com/moneypenny/ (L)
47. Entertainment Partners, "EP Launches New Production Incentive Tools", https://www.ep.com/news/entertainment-partners-launches-new-production-incentive-tools/ (L) ; "Film & TV Production Incentives Administration", https://www.ep.com/incentives-administration/ (B)
48. Cast & Crew, PSL+, https://www.castandcrew.com/products/accounting-and-financial/psl/ ; DPO, https://www.castandcrew.com/products/accounting-and-financial/dpo/ ; "Cast & Crew Announces Suite of 'Plus' Digital Accounting Products", https://blog.castandcrew.com/newsroom/digital-accounting-product-suite (B)
49. Hot Budget, Overview, https://hotbudget.com/overview/ ; CMS Productions, "Best Film & Commercial Production Budgeting Software (2026)", https://cmsproductions.com/blog/best-film-commercial-production-budgeting-software-2026/ (B)
50. Sargent-Disc, https://www.sargent-disc.com/ (B)
51. Wrapbook Help, "Understanding production incentives and how Wrapbook supports them", https://help.wrapbook.com/docs/understanding-production-incentives-and-how-wrapbook-supports-them (L) ; Wrapbook, "Smarter Tax Incentive Support…", https://www.wrapbook.com/blog/smarter-tax-incentive-support-wrapbook-product-updates (B)
52. Saturation (fornecedor), "Film Tax Incentive Tracking Software (2026)", https://saturation.io/blog/best-tools-for-film-tax-incentive-tracking-and-compliance (L)
53. BFI, "British certification and tax relief FAQ", https://www.bfi.org.uk/about-bfi/help-faq/tax-relief-certification ; "About UK creative industry expenditure credits", https://www.bfi.org.uk/apply-british-certification-expenditure-credits/about-uk-creative-industry-expenditure-credits (B)
54. Canada.ca, "Canadian Film or Video Production Tax Credit" (CAVCO), https://www.canada.ca/en/canadian-heritage/services/funding/cavco-tax-credits/canadian-film-video-production.html ; Ontario Creates, "OFTTC Guidelines", https://www.ontariocreates.ca/tax-incentives/ofttc/ofttc-guidelines (B)
55. Ramp, "Automated Receipt Capture & Tracking", https://ramp.com/receipt-automation ; "Introducing: Ramp receipt automation", https://ramp.com/blog/ramp-receipt-automation (B)
56. Ramp Help Center, "Policy Agent Overview", https://support.ramp.com/policy-agent-overview (L)
57. Ramp, "Policy Agent now available to all Ramp Plus customers" (13/01/2026), https://ramp.com/blog/ramp-policy-agent-ga-launch (L)
58. Ramp, Pricing, https://ramp.com/pricing (L)
59. G2, Ramp Pros and Cons, https://www.g2.com/products/ramp-financial-ramp/reviews?qs=pros-and-cons (B)
60. Brex, "Agents on Brex: Welcome to intelligent finance", https://www.brex.com/platform/intelligent-finance (L) ; "Brex Assistant", https://www.brex.com/support/brex-assistant (B) ; "Compliance rating", https://www.brex.com/support/compliance-rating (L)
61. Expensify Help, "Why Expenses Duplicate", https://help.expensify.com/articles/new-expensify/reports-and-expenses/Why-Expenses-Duplicate ; "Receipt Scanning App", https://use.expensify.com/receipt-scanning-app ; Capterra, Expensify, https://www.capterra.com/p/97594/Expensify/ (B)
62. Pleo, "Mastering month-end", https://blog.pleo.io/en/mastering-month-end ; Pleo FAQ, https://www.pleo.io/en/faq (B)
63. Dext Help, "Getting started with Dext for accountants and bookkeepers", https://help.dext.com/en/articles/416727-getting-started-with-dext-for-accountants-and-bookkeepers ; App Advisory Plus, "When and How should you use Automatic Publishing in Dext", https://www.appadvisoryplus.com/resources/news/when-and-how-should-you-use-automatic-publishing-in-dext ; Capterra, Dext, https://www.capterra.com/p/160189/Dext/ (B)
64. Xero, "Partner Guide to Using Hubdoc", https://www.xero.com/us/partner-toolkit/switch-to-xero/start-using-hubdoc/ ; Capterra, Hubdoc Reviews, https://www.capterra.com/p/165724/Hubdoc/ (B)
65. DataSnipper, "Match with DataSnipper", https://www.datasnipper.com/features/match ; DataSnipper KB, "How to add a Validation Snip", https://knowledge.datasnipper.com/how-to-validate-data-on-a-document (B)
66. EU Funding & Tenders Portal, Online Manual, "Continuous reporting on milestones & deliverables", https://webgate.ec.europa.eu/funding-tenders-opportunities/spaces/OM/pages/1867968/Continuous+reporting+on+milestones+deliverables ; "Reports and payment requests", https://webgate.ec.europa.eu/funding-tenders-opportunities/spaces/OM/pages/1867970/Reports+and+payment+requests (B)
67. European Commission, Horizon Europe Periodic Report template, https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/common/temp-form/report/periodic-report_horizon-euratom_en.pdf (B)
68. NCP Flanders, "Infosheet – CFS Certificates", https://ncpflanders.be/infosheets/cfs-certificates (B)
69. EMDESK, "Managing Lump Sum Projects in Horizon Europe", https://www.emdesk.com/solutions/emdesk-for-horizon-europe/lump-sum-project-management (L) ; "EMDESK Features", https://www.emdesk.com/product/emdesk-features-the-leading-horizon-europe-software-solution (L)
70. European Commission, "Arachne – Frequently asked questions" v2.0 (07/08/2017), https://archive.interact.eu/download/file/fid/13160 (L) ; European Parliament, "ARACHNE Briefing", https://www.europarl.europa.eu/cmsdata/259102/ARACHNE%20Briefing.pdf (B)
71. GOV.UK, "Government Functional Standard GovS 015: Grants – 8: Performance and Monitoring", https://www.gov.uk/government/publications/government-functional-standard-govs-015-grants/8-performance-and-monitoring-html (B)
72. Arts Professional, "Due diligence checks on emergency grants were automated", https://www.artsprofessional.co.uk/news/exclusive-due-diligence-checks-emergency-grants-were-automated ; GOV.UK, "Grants Management Function", https://www.gov.uk/government/collections/grants-management-function (B)
73. World Bank, "Geo-Enabling initiative for Monitoring and Supervision (GEMS)", https://www.worldbank.org/en/topic/fragilityconflictviolence/brief/geo-enabling-initiative-for-monitoring-and-supervision-gems (B)

Arquivos auxiliares salvos nesta pasta (texto bruto extraído, para conferência):

- `_screenaus_final.txt`: formulário da Screen Australia;
- `_fluxx_metro.txt`: guia do Fluxx do Metropolitan Council;
- `_arachne_faq.txt`: FAQ do Arachne.
