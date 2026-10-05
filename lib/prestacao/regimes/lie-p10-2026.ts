// Lei de Incentivo ao Esporte (federal), projetos protocolados a partir de
// 04/03/2026: LC 222/2025, Decreto 12.861/2026 e Portaria MESP 10/2026.
// Valores conferidos no texto integral e nos modelos oficiais:
// docs/acoes-futuras/estudos/prestacao-de-contas-fontes/lie-federal-2026-oficial.md
// Projetos protocolados antes seguem a Portaria 424/2020 (lie-p424-2020.ts).

import type { RegimeNormativo } from "./tipos";

const P10 = "Portaria MESP 10/2026";
const DEC = "Decreto 12.861/2026";
const LC = "LC 222/2025";
const PLANILHA = "Planilha Orçamentária (modelo oficial do MESP)";
const FORM = "Formulário PCP/PCF 2026 (modelo oficial do MESP)";
const RCO = "Modelo RCO 2026 (MESP)";
const CARIMBOS = "Modelo de carimbos (MESP, 2023)";
const MANUAL_LIE = "Manual de Divulgação da LIE, versão defeso (jul/2026)";
const SICOM = "Manual de assinatura no período eleitoral (SICOM, jun/2026)";
const GRU = "Orientações para recolhimento de valores ao Tesouro (MESP, 2023)";

export const LIE_P10_2026 = {
  codigo: "lie_p10_2026",
  versao: 1,
  nome: "Lei de Incentivo ao Esporte — Portaria MESP 10/2026",
  area: "esporte",
  mecanismo: "esporte",
  esfera: "federal",
  orgao: "Ministério do Esporte",
  sistemaOficial: "SLI e SEI",
  normaReferencia: "LC 222/2025; Decreto 12.861/2026; Portaria MESP 10/2026",
  vigenteDesde: "2026-03-04",
  identificadorOficial: { tipo: "sli", rotulo: "Nº do projeto no SLI" },
  fontes: [
    { documento: "LC 222/2025 (Planalto)", url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/Lcp222.htm" },
    { documento: "Decreto 12.861/2026 (Planalto)", url: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/D12861.htm" },
    { documento: "Portaria MESP 10/2026 (DOU de 04/03/2026)", url: "https://www.in.gov.br/web/dou/-/portaria-mesp-n-10-de-3-de-marco-de-2026-690209578" },
    { documento: "Modelos e manuais da LIE (MESP)", url: "https://www.gov.br/esporte/pt-br/acoes-e-programas-1/lei-de-incentivo-ao-esporte/modelos-e-manuais-3" },
  ],

  aplicabilidade: {
    criterio: "protocolo_projeto",
    desde: "2026-03-04",
    ate: null,
    descricao: "Projetos protocolados no SLI a partir de 04/03/2026, data de publicação e vigência da Portaria 10. Os protocolados antes seguem a Portaria 424/2020.",
    sucede: ["lie_p424_2020"],
    fonte: {
      documento: P10,
      dispositivo: "arts. 102 a 104",
      citacao: "Os projetos protocolados sob a égide da Portaria MC nº 424, de 22 de junho de 2020, terão sua análise, acompanhamento e prestação de contas regidos pelas disposições nela previstas",
      aConfirmar: true,
      nota: "O corte em 04/03/2026 é leitura dos arts. 102 a 104; a portaria não escreve a data.",
    },
  },

  prazos: {
    prestacaoFinal: {
      descricao: "Apresentar a prestação de contas final (PCF) por protocolo digital",
      responsavel: "proponente",
      marco: "fim_vigencia",
      quantidade: 60,
      unidade: "dias_corridos",
      fonte: {
        documento: P10,
        dispositivo: "art. 67; Decreto 12.861/2026, art. 33",
        citacao: "Até 60 dias contados do término da vigência do Termo de Compromisso ou do Termo Aditivo",
        nota: "Dias corridos, do dia seguinte à cientificação, com prorrogação para o primeiro dia útil (arts. 99 e 101).",
      },
    },
    respostaDiligencia: {
      descricao: "Suprir documentos ou informações pedidos em diligência da PCF (improrrogável)",
      responsavel: "proponente",
      marco: "ciencia_diligencia",
      quantidade: 30,
      unidade: "dias_corridos",
      fonte: { documento: P10, dispositivo: "art. 68, §§ 3º e 4º", nota: "A diligência chega por e-mail e o recebimento é confirmado em 1 dia útil." },
    },
    analisePrestacao: {
      descricao: "Análise técnica e análise financeira da PCF (cada uma)",
      responsavel: "orgao",
      marco: "envio_prestacao",
      quantidade: 360,
      unidade: "dias_corridos",
      fonte: { documento: P10, dispositivo: "art. 82", nota: "360 dias para a técnica (DPPIE) e 360 para a financeira (CGPC), contados do recebimento." },
    },
    analisePrestacaoParcial: {
      descricao: "Relatório de acompanhamento da prestação parcial (PCP)",
      responsavel: "orgao",
      marco: "envio_prestacao",
      quantidade: 60,
      unidade: "dias_corridos",
      fonte: { documento: P10, dispositivo: "art. 66", nota: "O prazo para durante a diligência; a PCP não julga o mérito nem a parte financeira." },
    },
    recurso: {
      descricao: "Pedido de reconsideração (único) da rejeição do objeto ou da parte financeira",
      responsavel: "proponente",
      marco: "ciencia_decisao",
      quantidade: 5,
      unidade: "dias_corridos",
      fonte: { documento: P10, dispositivo: "art. 71, §§ 2º e 3º; art. 80, §§ 5º e 6º" },
    },
    recursoAdministrativo: {
      descricao: "Recurso administrativo depois da reconsideração indeferida (Lei 9.784/1999)",
      responsavel: "proponente",
      marco: "ciencia_decisao",
      quantidade: 10,
      unidade: "dias_corridos",
      fonte: { documento: P10, dispositivo: "art. 71, § 3º; art. 80, § 6º" },
    },
    devolucao: {
      descricao: "Recolher os valores depois da reprovação, com rendimentos e atualização",
      responsavel: "proponente",
      marco: "ciencia_decisao",
      quantidade: 45,
      unidade: "dias_corridos",
      fonte: { documento: P10, dispositivo: "art. 80", nota: "Atualização pela IN TCU 71/2012 (§ 3º); sem recolhimento, TCE." },
    },
    devolucaoRessalva: {
      descricao: "Recolher os remanescentes na aprovação com ressalva por cumprimento parcial ou no arquivamento",
      responsavel: "proponente",
      marco: "ciencia_decisao",
      quantidade: 30,
      unidade: "dias_corridos",
      fonte: { documento: P10, dispositivo: "art. 80, § 4º" },
    },
    transferenciaSaldo: {
      descricao: "Pedir a transferência do saldo remanescente para outro projeto da entidade",
      responsavel: "proponente",
      marco: "fim_vigencia",
      quantidade: 60,
      unidade: "dias_corridos",
      fonte: { documento: P10, dispositivo: "art. 57, § 2º", nota: "Uma única vez, para projeto da mesma entidade em captação; senão, GRU." },
    },
    esclarecimentoDivulgacao: {
      descricao: "Esclarecer descumprimento do plano de divulgação (PDLIE)",
      responsavel: "proponente",
      marco: "ciencia_diligencia",
      quantidade: 5,
      unidade: "dias_corridos",
      fonte: { documento: P10, dispositivo: "art. 93" },
    },
  },

  prestacaoParcial: {
    modalidades: ["a_criterio_do_orgao", "por_parcela"],
    descricao: "A PCP é pedida a critério da DPPIE e é obrigatória antes de cada parcela quando a liberação é parcelada; vai pelo SEI, nos formulários da DPPIE.",
    prazo: "analisePrestacaoParcial",
    regras: [
      { codigo: "pcp_por_parcela", descricao: "Com liberação parcelada, a PCP do período é condição para a parcela seguinte.", severidade: "bloqueio", fonte: { documento: P10, dispositivo: "art. 37; art. 65, § 2º" } },
      { codigo: "pcp_pelo_sei", descricao: "PCP pelo SEI, com nº do processo, nome do projeto e os documentos I a XI; itens I a VII nos formulários da DPPIE.", severidade: "bloqueio", fonte: { documento: P10, dispositivo: "art. 65 e § 1º" } },
      { codigo: "pcp_sem_merito", descricao: "A análise da PCP não aprova o projeto nem julga a parte financeira, que fica para a PCF.", severidade: "info", fonte: { documento: P10, dispositivo: "art. 66" } },
    ],
    fonte: { documento: P10, dispositivo: "arts. 64 a 66; Decreto 12.861/2026, art. 33, § 3º" },
  },

  orcamento: {
    estrutura: {
      niveis: ["Atividade-fim ou atividade-meio", "Ação", "Item"],
      descricao: "Orçamento analítico por ação (1, 2...; atividade-meio com prefixo M) e item, cada um com quantidade × duração × valor unitário; elaboração e captação em linha própria, fora da atividade-meio.",
      fonte: { documento: PLANILHA, dispositivo: "colunas A a H e rodapé (H47, H63 a H68)" },
    },
    grupos: [
      { codigo: "execucao", rotulo: "Atividade-fim", descricao: "Ações da atividade-fim, inclusive o pessoal indispensável a ela.", fonte: { documento: DEC, dispositivo: "art. 12, § 1º" } },
      { codigo: "administracao", rotulo: "Atividade-meio", descricao: "Despesas administrativas da atividade-meio, inclusive os encargos delas.", fonte: { documento: DEC, dispositivo: "art. 12, caput e §§ 1º e 2º" } },
      { codigo: "elaboracao", rotulo: "Elaboração e captação", descricao: "Despesas de produção (elaboração do projeto e captação), fora da atividade-meio.", fonte: { documento: P10, dispositivo: "art. 26" } },
    ],
    bases: {
      valor_atividade_fim: {
        descricao: "Total da atividade-fim, a base que os modelos oficiais usam para os 15% de atividade-meio.",
        soma: ["execucao"],
        exceto: [],
        fonte: { documento: PLANILHA, dispositivo: "H64 = H63/H47 (\"Porcentagem da Atividade Meio x Fim (Até 15%)\")" },
      },
      valor_projeto: {
        descricao: "Atividade-fim mais atividade-meio, a base de elaboração e captação.",
        soma: ["execucao", "administracao"],
        exceto: [],
        fonte: { documento: P10, dispositivo: "art. 26 e §§ 1º a 3º" },
      },
      valor_total_projeto: {
        descricao: "Total geral: fim, meio e elaboração e captação.",
        soma: "todos",
        exceto: [],
        fonte: { documento: PLANILHA, dispositivo: "D68 \"TOTAL GERAL\"" },
      },
    },
    tetos: [
      {
        codigo: "atividade_meio",
        descricao: "Despesas administrativas (atividade-meio)",
        grupos: ["administracao"],
        percentual: 15,
        base: "valor_atividade_fim",
        severidade: "bloqueio",
        fonte: {
          documento: DEC,
          dispositivo: "art. 12; Planilha Orçamentária, H64",
          citacao: "ficam limitadas a 15% (quinze por cento) do orçamento total",
          nota: "O Decreto fala em orçamento total; os modelos oficiais calculam meio ÷ fim, o critério da área técnica e o mais restritivo.",
        },
      },
      {
        codigo: "elaboracao_captacao",
        descricao: "Elaboração e captação",
        grupos: ["elaboracao"],
        percentual: 10,
        base: "valor_projeto",
        teto: 100_000,
        severidade: "alerta",
        fonte: {
          documento: P10,
          dispositivo: "art. 26 e §§ 1º a 3º",
          nota: "10% na formação esportiva; 7% no esporte para toda a vida, 5% na excelência e 15% no projeto todo no N, NE ou CO (regra elaboracao_por_nivel). Até a prestação guardar o nível, a tela confere os 10%.",
        },
      },
    ],
    regras: [
      {
        codigo: "elaboracao_por_nivel",
        descricao: "Elaboração e captação até 10% (formação), 7% (toda a vida), 5% (excelência) ou 15% (projeto executado só no N, NE ou CO) de fim + meio, até R$ 100 mil.",
        severidade: "bloqueio",
        parametros: { formacao: 10, todaVida: 7, excelencia: 5, norteNordesteCentroOeste: 15, teto: 100_000 },
        fonte: { documento: P10, dispositivo: "art. 26 e §§ 1º a 3º" },
      },
      { codigo: "sem_valor_fechado", descricao: "Todo item tem quantidade × duração × valor unitário; é proibido lançar valor fechado.", severidade: "bloqueio", fonte: { documento: P10, dispositivo: "art. 7º, V" } },
      { codigo: "encargos_proprios", descricao: "Encargos em item próprio e salário marcado como bruto ou líquido; encargo não autorizado na admissibilidade não entra.", severidade: "alerta", fonte: { documento: P10, dispositivo: "art. 7º, IX; art. 44, §§ 2º e 3º" } },
      { codigo: "media_de_orcamentos", descricao: "Na proposta, cada despesa até a média de 3 orçamentos ou a tabela de referência.", severidade: "info", fonte: { documento: P10, dispositivo: "art. 7º, § 4º" } },
      { codigo: "receitas_no_orcamento", descricao: "Receitas do projeto (bilheteria, inscrições) entram no orçamento e revertem ao projeto.", severidade: "alerta", fonte: { documento: DEC, dispositivo: "art. 15; Portaria MESP 10/2026, art. 7º, § 3º" } },
      { codigo: "limite_de_captacao", descricao: "Captação por projeto: até R$ 5 milhões (excelência) e R$ 2,5 milhões (toda a vida); formação sem limite; até 6 projetos por ano por CNPJ raiz.", severidade: "info", parametros: { excelencia: 5_000_000, todaVida: 2_500_000, projetosPorAno: 6 }, fonte: { documento: P10, dispositivo: "art. 14; Decreto 12.861/2026, art. 23" } },
    ],
  },

  alteracoes: {
    janela: {
      aPartirDe: "assinatura_termo",
      ate: "fim_execucao",
      descricao: "Durante a vigência do Termo de Compromisso; a conta movimento só é usada depois da assinatura.",
      fonte: { documento: P10, dispositivo: "art. 20, § 3º; arts. 52 e 53" },
    },
    tipos: {
      remanejamento: {
        permitido: true,
        classificacao: "administrativa",
        condicoes: [
          {
            tipo: "pedido_numero",
            numeros: [2],
            descricao: "É o segundo pedido de remanejamento: só ele pode ser feito sem anuência prévia.",
            fonte: { documento: P10, dispositivo: "art. 52, § 1º", aConfirmar: true, nota: "Leitura de \"somente no segundo remanejamento sem a necessidade de prévia anuência\": o primeiro pede aprovação." },
          },
          {
            tipo: "movido_ate",
            percentual: 20,
            base: "valor_total_projeto",
            acumulado: false,
            descricao: "Move até 20% do valor total do projeto, sem passar do total aprovado na ATO.",
            fonte: { documento: P10, dispositivo: "art. 52, §§ 1º e 2º" },
          },
        ],
        requisitos: [
          { tipo: "maximo_pedidos", quantidade: 2, severidade: "bloqueio", descricao: "Até dois pedidos de remanejamento.", fonte: { documento: P10, dispositivo: "art. 52, caput" } },
          { tipo: "tetos", severidade: "bloqueio", descricao: "O remanejamento respeita os 15% de atividade-meio aprovados na ATO.", fonte: { documento: P10, dispositivo: "art. 52, § 5º" } },
        ],
        orientacoes: [
          { codigo: "comunicar_em_5_dias", descricao: "Feito sem anuência, comunique à DPPIE em 5 dias e envie a documentação atualizada.", severidade: "alerta", parametros: { dias: 5 }, fonte: { documento: P10, dispositivo: "art. 52, § 1º" } },
          { codigo: "encargos_fixos", descricao: "É proibido mudar o percentual de encargos.", severidade: "bloqueio", fonte: { documento: P10, dispositivo: "art. 52, § 7º" } },
          { codigo: "tres_orcamentos", descricao: "Se o valor unitário de um item subir, junte 3 orçamentos novos.", severidade: "alerta", fonte: { documento: P10, dispositivo: "art. 46, § 3º" } },
          { codigo: "documentos_do_pedido", descricao: "Ofício com justificativa, Descrição do Plano de Trabalho, planilha de remanejamento e planilha orçamentária atualizada.", severidade: "info", fonte: { documento: P10, dispositivo: "art. 54" } },
          { codigo: "justificar_na_pcf", descricao: "Na PCF, junte comprovantes e justificativas de toda alteração; o mérito é analisado ali.", severidade: "info", fonte: { documento: P10, dispositivo: "art. 52, § 8º" } },
        ],
        fonte: { documento: P10, dispositivo: "art. 52" },
      },
      complementacao: {
        permitido: true,
        classificacao: "formal",
        condicoes: [],
        requisitos: [
          { tipo: "maximo_pedidos", quantidade: 1, severidade: "bloqueio", descricao: "Uma única readequação (captação depois de iniciada a execução).", fonte: { documento: P10, dispositivo: "art. 53" } },
          { tipo: "antecedencia", quantidade: 90, unidade: "dias_corridos", severidade: "bloqueio", descricao: "Pedido até 90 dias antes do fim do Termo de Compromisso.", fonte: { documento: P10, dispositivo: "art. 53, § 1º" } },
          { tipo: "tetos", severidade: "bloqueio", descricao: "A readequação respeita os tetos.", fonte: { documento: P10, dispositivo: "art. 52, § 5º; art. 26" } },
        ],
        orientacoes: [
          { codigo: "termo_aditivo", descricao: "Depende de parecer técnico e da CTLIE, e é formalizada por Termo Aditivo assinado antes do fim do Termo.", severidade: "info", fonte: { documento: P10, dispositivo: "art. 53" } },
          { codigo: "sem_item_nao_autorizado", descricao: "É proibido incluir item que não foi autorizado.", severidade: "alerta", fonte: { documento: P10, dispositivo: "art. 53" } },
        ],
        fonte: { documento: P10, dispositivo: "art. 53" },
      },
      reducao: {
        permitido: true,
        classificacao: "formal",
        condicoes: [],
        requisitos: [
          { tipo: "tetos", severidade: "alerta", descricao: "Depois da redução, os grupos continuam dentro dos tetos.", fonte: { documento: DEC, dispositivo: "art. 12" } },
        ],
        orientacoes: [],
        fonte: { documento: P10, dispositivo: "art. 43", nota: "A P10 não trata de redução; qualquer outra alteração do plano de trabalho depende de autorização prévia da DPPIE." },
      },
      inclusao: {
        permitido: true,
        classificacao: "formal",
        condicoes: [],
        requisitos: [
          { tipo: "tetos", severidade: "alerta", descricao: "Com o item novo, os grupos continuam dentro dos tetos.", fonte: { documento: DEC, dispositivo: "art. 12" } },
        ],
        orientacoes: [],
        fonte: { documento: P10, dispositivo: "art. 43; art. 52, § 3º", nota: "O remanejamento só mexe em itens já previstos; item novo é alteração do plano de trabalho." },
      },
    },
    alertasPorItem: [],
    prazoAnalise: null,
    silencioAprova: false,
    regras: [
      { codigo: "local_de_execucao", descricao: "O local de execução só muda com anuência prévia; sem ela, é inexecução.", severidade: "bloqueio", fonte: { documento: P10, dispositivo: "art. 42" } },
      { codigo: "outra_alteracao", descricao: "Qualquer outra alteração do plano de trabalho precisa de autorização prévia da DPPIE.", severidade: "bloqueio", fonte: { documento: P10, dispositivo: "art. 43" } },
      { codigo: "prorrogacao", descricao: "Prorrogação pedida até 30 dias antes do fim do Termo, no máximo duas, cada uma por Termo Aditivo assinado antes do vencimento.", severidade: "alerta", parametros: { diasAntes: 30, maximo: 2 }, fonte: { documento: P10, dispositivo: "art. 56" } },
      { codigo: "uso_de_rendimentos", descricao: "Usar a aplicação financeira pede pedido formal com o valor exato a sair da conta captação.", severidade: "alerta", fonte: { documento: P10, dispositivo: "art. 55" } },
    ],
    fonte: { documento: P10, dispositivo: "arts. 42 a 56" },
  },

  fornecedores: {
    limites: [],
    partesRelacionadas: {
      descricao: "Patrocínio ou doação a projeto que beneficie pessoa vinculada ao incentivador não é dedutível; membros da entidade só recebem por função específica aprovada.",
      fonte: { documento: LC, dispositivo: "art. 3º, § 2º, e art. 5º; Decreto 12.861/2026, art. 2º, §§ 5º e 6º; Portaria MESP 10/2026, art. 58, V" },
    },
    regras: [
      { codigo: "credor_ligado_ao_incentivador", descricao: "Credor ligado ao incentivador (sócio, parente até o 3º grau, coligada) gera alerta.", severidade: "alerta", fonte: { documento: LC, dispositivo: "art. 5º; Decreto 12.861/2026, art. 2º, §§ 5º e 6º" } },
      { codigo: "intermediacao", descricao: "É vedado transferir a execução do objeto a terceiros; a sanção é a rescisão do Termo.", severidade: "bloqueio", fonte: { documento: DEC, dispositivo: "art. 13; Portaria MESP 10/2026, art. 59, III" } },
      { codigo: "subcontratacao", descricao: "Subcontratação só de atividade acessória prevista no plano, sob supervisão direta; nunca gestão, coordenação ou direção.", severidade: "alerta", fonte: { documento: DEC, dispositivo: "art. 13, §§ 3º e 6º" } },
      { codigo: "contratacao_de_pessoal", descricao: "Pessoal por RPA, CLT ou PJ especializada não exclusiva, com remuneração pela pesquisa de mercado ou pela tabela de referência da DPPIE.", severidade: "info", fonte: { documento: P10, dispositivo: "art. 44 e § 1º" } },
    ],
    fonte: { documento: P10, dispositivo: "arts. 44, 58 e 59", nota: "A LIE não fixa limite percentual por fornecedor nem por parte relacionada." },
  },

  contas: {
    contas: [
      { tipo: "captacao", descricao: "Conta CAPTAÇÃO, bloqueada, só para os aportes dos incentivadores", abertaPor: "orgao" },
      { tipo: "movimento", descricao: "Conta MOVIMENTO, sob a gerência do MESP, usada depois do Termo de Compromisso", abertaPor: "orgao" },
    ],
    bancos: ["Banco do Brasil", "Caixa Econômica Federal"],
    descricao: "Duas contas abertas pela DPPIE em nome do proponente, exclusivas do projeto; só conta como incentivo o que foi depositado na CAPTAÇÃO.",
    tarifas: {
      regra: "norma_silente",
      descricao: "A LC, o Decreto, a Portaria e os modelos não dizem se tarifa bancária é despesa elegível.",
      fonte: { documento: "LC 222/2025, Decreto 12.861/2026 e Portaria MESP 10/2026", dispositivo: "texto integral, sem regra sobre tarifas" },
    },
    liberacao: {
      descricao: "Da CAPTAÇÃO para a MOVIMENTO, integral ou em parcelas, conforme a DPPIE, depois do Termo de Compromisso; cada parcela nova depende da PCP.",
      percentualMinimo: null,
      base: null,
      fonte: { documento: P10, dispositivo: "art. 20, § 3º; art. 37; art. 65, § 2º" },
    },
    rendimentos: {
      aplicacao: "obrigatoria",
      contamComoCaptado: false,
      uso: "Só em ações do projeto, com pedido formal e justificativa no RCO; o proponente repõe o rendimento do período sem aplicação.",
      fonte: { documento: P10, dispositivo: "art. 28 e §§ 1º a 5º; arts. 54 e 55" },
    },
    saldo: {
      descricao: "Transferência única, em 60 dias do encerramento, para outro projeto da entidade em captação; senão, GRU. Proibida se a PCF não for apresentada ou for rejeitada.",
      prazo: "transferenciaSaldo",
      fonte: { documento: P10, dispositivo: "art. 57, §§ 1º a 3º; art. 67, §§ 4º a 6º" },
    },
    regras: [
      { codigo: "conta_exclusiva", descricao: "Conta exclusiva do projeto, por onde circulam todos os recursos captados.", severidade: "bloqueio", fonte: { documento: DEC, dispositivo: "arts. 30 e 31, §§ 1º a 3º; LC 222/2025, art. 11" } },
      { codigo: "deposito_identificado", descricao: "Aporte só com CPF ou CNPJ do depositante, direto na CAPTAÇÃO, com recibo emitido no SLI.", severidade: "bloqueio", fonte: { documento: P10, dispositivo: "art. 20, §§ 2º e 10; art. 27" } },
      { codigo: "captar_acima", descricao: "É proibido captar mais que o autorizado; o excedente vai ao Tesouro.", severidade: "bloqueio", fonte: { documento: LC, dispositivo: "art. 10, parágrafo único; Portaria MESP 10/2026, art. 22, § 2º" } },
      { codigo: "estorno", descricao: "Depósito feito por engano: estorno ou correção em até 60 dias do depósito, senão GRU.", severidade: "alerta", parametros: { dias: 60 }, fonte: { documento: P10, dispositivo: "arts. 23 e 25" } },
      { codigo: "bloqueio_judicial", descricao: "Bloqueio judicial é informado de imediato, sob pena de arquivamento; a reposição cabe ao proponente.", severidade: "alerta", fonte: { documento: P10, dispositivo: "art. 20, §§ 7º e 8º" } },
      { codigo: "autorizacao_ao_banco", descricao: "Autorização irrevogável ao banco para cumprir as determinações da DPPIE.", severidade: "info", fonte: { documento: P10, dispositivo: "art. 20, § 1º; art. 21" } },
    ],
    fonte: { documento: P10, dispositivo: "arts. 20 a 28" },
  },

  pagamentos: {
    meiosPermitidos: null,
    meiosVedados: ["saque"],
    descricao: "Qualquer operação bancária autorizada pelo Banco Central que identifique a destinação e o credor; saque em dinheiro é proibido em qualquer hipótese.",
    documentoFiscal: [
      { codigo: "em_nome_da_entidade", descricao: "Comprovantes emitidos única e exclusivamente em nome da entidade proponente.", severidade: "bloqueio", fonte: { documento: P10, dispositivo: "art. 41" } },
      { codigo: "numero_sli", descricao: "Número do projeto no SLI em todos os comprovantes de despesa.", severidade: "bloqueio", fonte: { documento: P10, dispositivo: "art. 41, § 1º" } },
      {
        codigo: "carimbo_e_atesto",
        descricao: "Carimbo na frente da nota (Nº SLI, Ministério do Esporte) e atesto de recebimento no verso, com data e assinatura.",
        severidade: "alerta",
        fonte: { documento: CARIMBOS, dispositivo: "frente e verso; Portaria MESP 10/2026, art. 49, III", nota: "O carimbo publicado ainda cita a Lei 11.438/2006, revogada; o texto da lei fica configurável." },
      },
      { codigo: "nota_discriminada", descricao: "Nota, fatura ou recibo discriminando o serviço ou produto, guardados frente e verso.", severidade: "alerta", fonte: { documento: P10, dispositivo: "art. 78" } },
      { codigo: "recibo_de_diarias", descricao: "Diárias comprovadas por recibo assinado pelo usuário, com identificação e CPF.", severidade: "bloqueio", fonte: { documento: P10, dispositivo: "art. 41, § 2º" } },
      { codigo: "retencoes", descricao: "Pagamento a pessoa física com IR, INSS e ISS retidos e recolhidos.", severidade: "alerta", fonte: { documento: P10, dispositivo: "art. 76; Formulário PCP/PCF, aba PAGAMENTOS, instrução 5" } },
      { codigo: "traducao", descricao: "Documento em língua estrangeira com tradução juramentada.", severidade: "alerta", fonte: { documento: P10, dispositivo: "art. 98" } },
    ],
    regras: [
      { codigo: "um_comprovante_por_debito", descricao: "Cada débito na conta MOVIMENTO tem um comprovante.", severidade: "bloqueio", fonte: { documento: P10, dispositivo: "art. 39" } },
      { codigo: "ate_o_aprovado", descricao: "Compra ou contratação sem novos orçamentos até o valor aprovado por item ou ação; acima, remanejamento.", severidade: "alerta", fonte: { documento: P10, dispositivo: "art. 46" } },
      { codigo: "processo_de_compra", descricao: "Cada compra com cotação ou justificativa, escolha do fornecedor e do preço, comprovante de recebimento e documento contábil.", severidade: "alerta", fonte: { documento: P10, dispositivo: "art. 49" } },
      { codigo: "contrato", descricao: "Contrato com objeto, regime, prazos, preço, pagamento, reajuste, direitos e multas, início e fim.", severidade: "alerta", fonte: { documento: P10, dispositivo: "art. 50" } },
      { codigo: "pregao", descricao: "Entidade pública segue a Lei 14.133, com pregão para bens e serviços comuns.", severidade: "alerta", fonte: { documento: P10, dispositivo: "art. 51" } },
    ],
    fonte: { documento: P10, dispositivo: "arts. 38 e 39", citacao: "Saque em dinheiro é proibido em qualquer hipótese" },
  },

  despesas: {
    periodo: {
      descricao: "Da assinatura do Termo de Compromisso ao fim da vigência; despesa fora dela é ressarcida com multa adicional de 5%, por GRU.",
      fonte: { documento: P10, dispositivo: "art. 40; art. 80, § 7º; Decreto 12.861/2026, art. 29, § 3º" },
    },
    vedadas: [
      { codigo: "taxa_administracao", descricao: "Taxa de administração, de gerência ou similar", fonte: { documento: P10, dispositivo: "art. 58, I" } },
      { codigo: "agente_publico", descricao: "Pagamento a agente público da ativa por serviço, inclusive consultoria", fonte: { documento: P10, dispositivo: "art. 58, II" } },
      { codigo: "clube_de_servidores", descricao: "Despesa em favor de clubes ou associações de servidores públicos", fonte: { documento: P10, dispositivo: "art. 58, III" } },
      { codigo: "vantagem_ao_patrocinador", descricao: "Despesa que gere vantagem financeira ou material ao patrocinador", fonte: { documento: P10, dispositivo: "art. 58, IV; Decreto 12.861/2026, art. 34, I; LC 222/2025, art. 20, I" } },
      { codigo: "membros_da_entidade", descricao: "Despesa em benefício de membros da entidade, salvo função específica aprovada", fonte: { documento: P10, dispositivo: "art. 58, V" } },
      { codigo: "imovel", descricao: "Compra de imóvel", fonte: { documento: P10, dispositivo: "art. 58, VI" } },
      { codigo: "atleta_profissional", descricao: "Remuneração de atleta profissional", fonte: { documento: LC, dispositivo: "art. 6º, § 2º; Decreto 12.861/2026, art. 6º; Portaria MESP 10/2026, art. 59, I" } },
      { codigo: "equipe_profissional", descricao: "Manutenção ou organização de equipes profissionais de alto rendimento e de competições profissionais", fonte: { documento: DEC, dispositivo: "art. 6º, § 2º; Portaria MESP 10/2026, art. 59, II" } },
      { codigo: "espaco_publicitario", descricao: "Compra de espaço publicitário em qualquer meio", fonte: { documento: DEC, dispositivo: "art. 14" } },
      { codigo: "cobranca_de_beneficiarios", descricao: "Cobrar qualquer valor dos beneficiários em projeto de atividade regular", fonte: { documento: DEC, dispositivo: "art. 16" } },
      { codigo: "so_manutencao", descricao: "Projeto só de despesas administrativas de manutenção da entidade", fonte: { documento: P10, dispositivo: "art. 32, I" } },
      { codigo: "beneficio_de_convencao", descricao: "Benefícios de convenção coletiva não aprovados na admissibilidade", fonte: { documento: P10, dispositivo: "art. 44, § 4º" } },
    ],
    regras: [
      { codigo: "pessoal_na_vigencia", descricao: "Remuneração de pessoal limitada ao período de vigência, segregada no plano e aprovada antes.", severidade: "alerta", fonte: { documento: P10, dispositivo: "art. 45" } },
      { codigo: "bolsa_auxilio", descricao: "Bolsa auxílio só para beneficiários do nível excelência.", severidade: "bloqueio", fonte: { documento: P10, dispositivo: "art. 13" } },
      { codigo: "crc_excelencia", descricao: "No nível excelência, CRC válida durante toda a execução; vencida, 30 dias para a nova, senão pagamentos suspensos e ressarcimento.", severidade: "bloqueio", fonte: { documento: P10, dispositivo: "art. 31" } },
      { codigo: "tabela_de_referencia", descricao: "Remuneração e diárias pela tabela de referência da DPPIE (a publicada é de 2020).", severidade: "alerta", fonte: { documento: P10, dispositivo: "art. 44, § 1º", aConfirmar: true, nota: "Não se sabe se as tabelas de 2020 continuam a referência vigente." } },
    ],
    fonte: { documento: P10, dispositivo: "arts. 40, 58 e 59" },
  },

  porte: {
    lacuna: "nao_se_aplica",
    motivo: "A LIE não classifica projetos por porte. O que muda regras é o nível da manifestação esportiva (formação, toda a vida, excelência), que define o limite de elaboração e captação e o de captação por projeto.",
    fonte: { documento: P10, dispositivo: "arts. 14 e 26" },
  },

  objeto: {
    descricao: "Relatório de Cumprimento do Objeto (RCO) com metas qualitativas e quantitativas da ATO, indicadores, instrumentos de verificação e percentual de atingimento; beneficiados, grade de atividades, eventos e fotos, inclusive de acessibilidade.",
    regras: [
      { codigo: "metas_da_ato", descricao: "As metas são as aprovadas na Análise Técnica e Orçamentária; não as altere no relatório.", severidade: "alerta", fonte: { documento: RCO, dispositivo: "seção III" } },
      { codigo: "percentual_de_atingimento", descricao: "Cada meta com indicador, instrumento de verificação, resultado e percentual de atingimento.", severidade: "alerta", fonte: { documento: RCO, dispositivo: "seção III" } },
      { codigo: "rede_publica", descricao: "Na formação esportiva regular, ao menos 50% de alunos da rede pública.", severidade: "bloqueio", parametros: { percentual: 50 }, fonte: { documento: DEC, dispositivo: "art. 18" } },
      { codigo: "acessibilidade", descricao: "Acessibilidade para idosos e pessoas com deficiência, com fotos nos locais aprovados.", severidade: "bloqueio", fonte: { documento: DEC, dispositivo: "art. 17; Portaria MESP 10/2026, arts. 11 e 68, XV" } },
      { codigo: "beneficiados", descricao: "Relação de beneficiados, com total feminino e masculino igual ao número listado.", severidade: "alerta", fonte: { documento: FORM, dispositivo: "aba BENEFICIADOS" } },
      { codigo: "ingressos_nao_distribuidos", descricao: "O valor de ingressos não distribuídos (doação do tipo b) é restituído na PCF.", severidade: "alerta", fonte: { documento: DEC, dispositivo: "art. 11, § 2º" } },
      { codigo: "receitas_revertidas", descricao: "Inscrições e outras receitas revertidas integralmente ao projeto e mostradas no relatório de receita e despesa.", severidade: "alerta", fonte: { documento: P10, dispositivo: "art. 68, § 5º; art. 7º, § 3º" } },
      { codigo: "avaliacao_de_resultados", descricao: "O MESP verifica resultados, custos estimados × reais e repercussão, e pode usar peritos.", severidade: "info", fonte: { documento: DEC, dispositivo: "art. 32" } },
      { codigo: "visita_tecnica", descricao: "Visita técnica, presencial ou virtual, a qualquer tempo.", severidade: "info", fonte: { documento: P10, dispositivo: "arts. 61 e 62" } },
    ],
    fonte: { documento: P10, dispositivo: "arts. 65 e 68" },
  },

  divulgacao: {
    marcas: ["Selo da Lei de Incentivo ao Esporte", "Ministério do Esporte", "Governo Federal", "Bandeira Nacional"],
    aprovacaoPrevia: {
      exigida: true,
      prazo: null,
      silencioAprova: false,
      descricao: "O plano de divulgação (PDLIE) é aprovado pela ASCOM antes do Termo de Compromisso, e as peças finalizadas vão à ASCOM por e-mail, em PDF ou JPG, nomeadas pela peça.",
      fonte: { documento: P10, dispositivo: "art. 35, I; art. 91, § 4º; modelo PDLIE 2026" },
    },
    defeso: {
      descricao: "De 04/07/2026 ao primeiro turno (04/10) ou ao segundo (25/10): sem a marca do Governo Federal; a assinatura é o selo LIE, \"MINISTÉRIO DO ESPORTE\" e a Bandeira.",
      fonte: { documento: SICOM, dispositivo: "p. 2 a 6; Manual de Divulgação da LIE, versão defeso", aConfirmar: true, nota: "Nenhuma norma da DPPIE trata da análise do PDLIE no defeso; é leitura dos dois manuais." },
    },
    regras: [
      { codigo: "exposicao_equivalente", descricao: "Selo e marca do Governo Federal com exposição equivalente à do maior patrocinador.", severidade: "bloqueio", fonte: { documento: P10, dispositivo: "art. 90, § 2º" } },
      { codigo: "selo_a_cada_insercao", descricao: "Para cada inserção de nome, marca ou produto de patrocinador, o selo LIE e as marcas do MESP e do Governo Federal com igual exposição.", severidade: "bloqueio", fonte: { documento: P10, dispositivo: "art. 92" } },
      { codigo: "marcas_sem_distorcao", descricao: "Proibido distorcer marcas, alterar cores ou posições e desobedecer a proporção.", severidade: "alerta", fonte: { documento: P10, dispositivo: "art. 93" } },
      { codigo: "comprovacao", descricao: "Comprovação da divulgação por fotos, filmagens, gravações e peças.", severidade: "bloqueio", fonte: { documento: P10, dispositivo: "art. 94" } },
      { codigo: "reincidencia", descricao: "Descumprir o PDLIE leva a esclarecimento em 5 dias; reincidência pode impedir novos projetos por até 24 meses.", severidade: "alerta", parametros: { meses: 24 }, fonte: { documento: P10, dispositivo: "art. 93" } },
      { codigo: "expressao_apresenta", descricao: "\"O Governo Federal por meio do Ministério do Esporte via Lei de Incentivo ao Esporte apresenta:\" em primeiro lugar.", severidade: "alerta", fonte: { documento: MANUAL_LIE, dispositivo: "p. 14" } },
      { codigo: "tamanho_minimo", descricao: "Selo de no mínimo 2,3 × 1,6 cm no impresso e 63 × 45 px no digital; uniforme com selo de 8 cm no peito e assinatura de 20 cm nas costas; boné com 5 cm.", severidade: "alerta", parametros: { cmLargura: 2.3, cmAltura: 1.6, px: 63, uniformeCm: 8, costasCm: 20, beneCm: 5 }, fonte: { documento: MANUAL_LIE, dispositivo: "p. 6 e 15 a 18" } },
      { codigo: "patrocinador_no_titulo", descricao: "Patrocinador no título do projeto só se o MESP aparecer como apresentador em todos os meios; não vale para doador.", severidade: "info", fonte: { documento: P10, dispositivo: "art. 12" } },
    ],
    fonte: { documento: P10, dispositivo: "arts. 90 a 94; LC 222/2025, art. 18" },
  },

  envio: {
    sistema: "SEI (PCP) e protocolo digital (PCF)",
    descricao: "PCP pelo SEI e PCF por protocolo digital, com o formulário PCP/PCF de 10 abas e o Relatório de Cumprimento do Objeto; o Transferegov não recebe a prestação da LIE.",
    documentos: [
      { codigo: "rco", descricao: "Relatório de Cumprimento do Objeto (modelo RCO)", em: ["parcial", "final"], obrigatorio: true, fonte: { documento: P10, dispositivo: "art. 65, I; art. 68, I" } },
      { codigo: "recursos_humanos", descricao: "Relação de pessoal contratado (aba RECURSOS HUMANOS)", em: ["parcial", "final"], obrigatorio: true, fonte: { documento: P10, dispositivo: "art. 65, II; art. 68, II" } },
      { codigo: "beneficiados", descricao: "Relação de beneficiários (aba BENEFICIADOS)", em: ["parcial", "final"], obrigatorio: true, fonte: { documento: P10, dispositivo: "art. 65, III; art. 68, III" } },
      { codigo: "receita_e_despesa", descricao: "Relatório de receitas e despesas, execução físico-financeira e pagamentos (abas RECEITA E DESPESA, EXECUTADO e PAGAMENTOS)", em: ["parcial", "final"], obrigatorio: true, fonte: { documento: P10, dispositivo: "art. 65, IV; art. 68, IV" } },
      { codigo: "eventos", descricao: "Calendário de eventos (aba EVENTOS)", em: ["parcial", "final"], obrigatorio: true, fonte: { documento: P10, dispositivo: "art. 65, V; art. 68, XI" } },
      { codigo: "grade", descricao: "Grade horária das atividades de cada núcleo (aba GRADE)", em: ["parcial", "final"], obrigatorio: true, fonte: { documento: P10, dispositivo: "art. 65, VI; art. 68, XII" } },
      { codigo: "grade_rh", descricao: "Grade horária dos recursos humanos (modelo próprio)", em: ["parcial"], obrigatorio: true, fonte: { documento: P10, dispositivo: "art. 65, VII" } },
      { codigo: "divulgacao", descricao: "Comprovação da divulgação (PDLIE) e da execução", em: ["parcial", "final"], obrigatorio: true, fonte: { documento: P10, dispositivo: "art. 65, VIII; art. 68, X" } },
      { codigo: "fotos_materiais", descricao: "Fotos dos materiais e equipamentos adquiridos", em: ["parcial", "final"], obrigatorio: true, fonte: { documento: P10, dispositivo: "art. 65, IX; art. 68, XIII" } },
      { codigo: "fotos_reportagens", descricao: "Fotos e reportagens do andamento ou da realização", em: ["parcial", "final"], obrigatorio: true, fonte: { documento: P10, dispositivo: "art. 65, X; art. 68, XIV" } },
      { codigo: "certidoes", descricao: "Certidões de regularidade fiscal, tributária e trabalhista", em: ["parcial"], obrigatorio: true, fonte: { documento: P10, dispositivo: "art. 65, XI" } },
      { codigo: "a_executar", descricao: "Cronograma físico-financeiro a executar (aba A EXECUTAR)", em: ["parcial"], obrigatorio: true, fonte: { documento: FORM, dispositivo: "aba A EXECUTAR" } },
      { codigo: "extratos", descricao: "Extratos das contas CAPTAÇÃO e MOVIMENTO, do recebimento ao último pagamento", em: ["final"], obrigatorio: true, fonte: { documento: P10, dispositivo: "art. 68, V" } },
      { codigo: "rendimentos", descricao: "Demonstrativo de rendimentos das duas contas", em: ["final"], obrigatorio: true, fonte: { documento: P10, dispositivo: "art. 68, VI", nota: "O modelo RCO pede o demonstrativo também na PCP." } },
      { codigo: "gru_ou_transferencia", descricao: "Comprovante de GRU ou do pedido de transferência do saldo", em: ["final"], obrigatorio: true, fonte: { documento: P10, dispositivo: "art. 68, VII" } },
      { codigo: "comprovantes_despesa", descricao: "Cópia dos comprovantes de despesa, com a documentação de compras e contratos", em: ["final"], obrigatorio: true, fonte: { documento: P10, dispositivo: "art. 68, VIII" } },
      { codigo: "bens", descricao: "Relação de bens permanentes adquiridos, produzidos ou construídos (aba BENS ADQUIRIDOS)", em: ["parcial", "final"], obrigatorio: true, fonte: { documento: P10, dispositivo: "art. 68, IX" } },
      { codigo: "fotos_acessibilidade", descricao: "Fotos que comprovem a acessibilidade nos locais aprovados", em: ["final"], obrigatorio: true, fonte: { documento: P10, dispositivo: "art. 68, XV" } },
      { codigo: "diarias", descricao: "Demonstrativo de diárias e passagens, um por evento (aba DIÁRIAS)", em: ["parcial", "final"], obrigatorio: false, fonte: { documento: RCO, dispositivo: "item IV, n" } },
    ],
    modelos: [
      { codigo: "formulario_pcp_pcf", nome: "Formulário PCP/PCF 2026 (10 abas)", formato: "xls", arquivo: "lie/formulario-pcp-pcf-2026.xls", fonte: { documento: FORM, dispositivo: "abas RECEITA E DESPESA a DIÁRIAS" } },
      { codigo: "rco", nome: "Relatório de Cumprimento do Objeto 2026", formato: "docx", arquivo: "lie/modelo-rco-2026.docx", fonte: { documento: RCO, dispositivo: "seções I a VI" } },
      { codigo: "carimbos", nome: "Carimbo da nota fiscal (frente e verso)", formato: "doc", arquivo: "lie/modelo-carimbos-2023.doc", fonte: { documento: CARIMBOS, dispositivo: "frente e verso" } },
      { codigo: "planilha_orcamentaria", nome: "Planilha Orçamentária", formato: "xls", arquivo: "lie/planilha-orcamentaria.xls", fonte: { documento: PLANILHA, dispositivo: "aba Planilha Orçamentária" } },
      { codigo: "planilha_remanejamento", nome: "Planilha de remanejamento e readequação (Modelo I)", formato: "xls", arquivo: "lie/planilha-remanejamento-readequacao.xls", fonte: { documento: P10, dispositivo: "art. 54" } },
      { codigo: "gru", nome: "Orientações para recolhimento ao Tesouro (GRU)", formato: "pdf", arquivo: "lie/orientacoes-recolhimento-tesouro.pdf", fonte: { documento: GRU, dispositivo: "p. 1 a 3" } },
    ],
    regras: [
      { codigo: "formularios_obrigatorios", descricao: "Itens I a IV da PCF e I a VII da PCP nos formulários da DPPIE.", severidade: "bloqueio", fonte: { documento: P10, dispositivo: "art. 65, § 1º; art. 68, § 2º" } },
      { codigo: "marcador_parcial_final", descricao: "Marcador PARCIAL/FINAL coerente em todas as abas que o têm; A EXECUTAR só na PCP.", severidade: "alerta", fonte: { documento: FORM, dispositivo: "células E1/E2, J1/J2, H1/H2, I1/I2, M1/M2, G1/G2 e K1/K2" } },
      { codigo: "numeracao_do_plano", descricao: "Ações numeradas como no Plano de Trabalho; atividade-meio com prefixo M.", severidade: "alerta", fonte: { documento: FORM, dispositivo: "instruções das abas" } },
      { codigo: "responsabilidade_do_contador", descricao: "Contador e proponente respondem civil, penal e administrativamente pelas informações.", severidade: "info", fonte: { documento: P10, dispositivo: "art. 68, § 1º" } },
      { codigo: "arquivos", descricao: "PDF pesquisável com OCR, até 25 MB, com assinatura manual ou digital válida.", severidade: "alerta", parametros: { mb: 25 }, fonte: { documento: P10, dispositivo: "arts. 5º e 6º, §§ 3º e 4º", aConfirmar: true, nota: "Regra escrita para a apresentação do projeto; estendida à prestação por cautela." } },
    ],
    fonte: { documento: P10, dispositivo: "arts. 65 a 68" },
  },

  posEnvio: {
    resultados: [
      { resultado: "aprovada", descricao: "Aplicação regular e avaliação técnica satisfatória.", fonte: { documento: P10, dispositivo: "art. 79" } },
      { resultado: "aprovada_ressalvas", descricao: "Contas regulares e avaliação técnica insatisfatória, sem prejuízo ao erário nem descumprimento do objeto.", fonte: { documento: P10, dispositivo: "art. 79" } },
      { resultado: "aprovada_parcialmente", descricao: "Avaliação técnica satisfatória, com irregularidades nas contas e prejuízo ao erário.", fonte: { documento: P10, dispositivo: "art. 79" } },
      { resultado: "reprovada", descricao: "Contas irregulares no Parecer de Avaliação Final, qualquer que seja o resultado técnico.", fonte: { documento: P10, dispositivo: "art. 79" } },
    ],
    devolucao: {
      descricao: "GRU paga só no Banco do Brasil: saldo na PCF, reprovação em 45 dias, ressalva por cumprimento parcial em 30 dias e despesa fora da vigência com multa de 5%.",
      atualizacao: "IN TCU 71/2012, com os índices do TCU; pagamento em atraso com mora, multa e juros calculados pelo MESP.",
      gru: [
        {
          unidadeGestora: "180076",
          gestao: "00001",
          codigo: "18004-1",
          referencia: "Número do processo, sem caracteres especiais",
          fonte: { documento: GRU, dispositivo: "p. 1 a 3", aConfirmar: true, nota: "O exemplo do próprio PDF mostra UG 180002; não há orientação de 2026. UG e código ficam configuráveis." },
        },
      ],
      fonte: { documento: P10, dispositivo: "art. 80 e §§ 3º, 4º e 7º" },
    },
    regras: [
      { codigo: "duas_analises", descricao: "Análise técnica pela DPPIE (objeto, divulgação, acessibilidade) e financeira pela CGPC (Parecer de Avaliação Final).", severidade: "info", fonte: { documento: P10, dispositivo: "arts. 71 a 74" } },
      { codigo: "diligencia_por_email", descricao: "Diligência por e-mail, com confirmação de recebimento em 1 dia útil; descumprida, leva a arquivamento ou indeferimento.", severidade: "alerta", fonte: { documento: P10, dispositivo: "art. 68, § 4º; art. 100" } },
      { codigo: "pcf_fora_do_prazo", descricao: "PCF fora do prazo: a DPPIE recolhe o saldo e recomenda TCE, o SLI é suspenso e os outros projetos ficam paralisados.", severidade: "bloqueio", fonte: { documento: P10, dispositivo: "art. 67, §§ 3º e 4º; art. 83; Decreto 12.861/2026, art. 33, § 2º" } },
      { codigo: "tce", descricao: "TCE por PC não apresentada, inexecução, desvio, despesa impugnada, uso indevido de rendimentos, saldo não devolvido ou falta de documentos; CADIN e envio ao TCU em 180 dias.", severidade: "info", fonte: { documento: P10, dispositivo: "arts. 84 e 88" } },
      { codigo: "prescricao", descricao: "Sanções prescrevem em 5 anos da apresentação da PCF; o ressarcimento não prescreve.", severidade: "info", fonte: { documento: P10, dispositivo: "art. 81" } },
      { codigo: "multa_vantagem", descricao: "Vantagem indevida: multa de 2 vezes o valor e rescisão com devolução integral.", severidade: "info", fonte: { documento: LC, dispositivo: "arts. 20 e 21; Decreto 12.861/2026, arts. 34 e 35" } },
    ],
    fonte: { documento: P10, dispositivo: "arts. 71 a 88" },
  },

  guarda: {
    marco: "registro_decisao",
    quantidade: 10,
    unidade: "anos",
    prorrogaParaDiaUtil: false,
    descricao: "Originais na sede, à disposição do MESP e dos órgãos de controle, contados da avaliação da PCF.",
    fonte: { documento: P10, dispositivo: "arts. 46, § 1º, 69, 70 e 77; IN RFB 1.131/2011, art. 36" },
  },
} satisfies RegimeNormativo;
