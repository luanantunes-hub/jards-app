// PRONON e PRONAS/PCD (saúde), regime anterior: Anexo LXXXVI da PRC GM/MS
// 5/2017 (origem na PRT GM/MS 1.550/2014), revogado pela Portaria GM/MS
// 8.031/2025. Serve aos atos praticados antes de 08/09/2025 e às obrigações dos
// Termos de Compromisso assinados nele.
//
// As diferenças para o Anexo LXXXVI-A foram conferidas no quadro "Antes ×
// agora" de saude-anexo-lxxxvi-a-oficial.md (seção 11) e no manual do FNS de
// 2019 (saude-pronon-pronas-manual-2019.md, roteiro da PRC 5); o resto vem do
// anexo novo e passou pela conferência regra a regra no anexo anterior
// (conferencias/saude-lxxxvi-2017.ts, versão 2).

import { aplicarConferencia } from "./conferencia";
import { CONFERENCIA_SAUDE_LXXXVI_2017 } from "./conferencias/saude-lxxxvi-2017";
import { herdarRegime } from "./herdar";
import { SAUDE_LXXXVI_A_2025 } from "./saude-lxxxvi-a-2025";
import { definida, type AlteracoesRegime, type RegimeNormativo } from "./tipos";

const ANTIGO = "Anexo LXXXVI da PRC 5/2017 (revogado)";
const MANUAL = "Manual de análise contábil e financeira PRONON e PRONAS/PCD (FNS, 2019), Anexo III";

const base = herdarRegime(SAUDE_LXXXVI_A_2025, "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.");
const baseOrcamento = definida(base.orcamento)!;
const baseAlteracoes = definida(base.alteracoes) as AlteracoesRegime;
const baseContas = definida(base.contas)!;
const basePagamentos = definida(base.pagamentos)!;
const baseDespesas = definida(base.despesas)!;
const baseObjeto = definida(base.objeto)!;
const baseEnvio = definida(base.envio)!;
const basePosEnvio = definida(base.posEnvio)!;
const baseParcial = definida(base.prestacaoParcial)!;

// Prazos que só existem no anexo novo (as certidões em 20 dias vêm da minuta do Termo de 2025).
const SO_NO_NOVO = new Set(["saneamento", "complementacaoAlteracao", "certidoes"]);
const prazosHerdados = Object.fromEntries(Object.entries(base.prazos).filter(([chave]) => !SO_NO_NOVO.has(chave)));

const montado: RegimeNormativo = {
  ...base,
  codigo: "pronon_pronas_lxxxvi_2017",
  versao: 2,
  nome: "PRONON e PRONAS/PCD — Anexo LXXXVI (anterior)",
  sistemaOficial: "SIPAR (protocolo)",
  normaReferencia: "Lei 12.715/2012; Decreto 7.988/2013; Anexo LXXXVI da PRC GM/MS 5/2017 (origem na PRT GM/MS 1.550/2014), revogado pela Portaria GM/MS 8.031/2025",
  vigenteDesde: "2017-09-28",
  identificadorOficial: { tipo: "nup", rotulo: "Nº do processo (SIPAR)" },
  fontes: [
    { documento: "PRC GM/MS 5/2017 compilada (Anexo LXXXVI, revogado)", url: "https://bvsms.saude.gov.br/bvs/saudelegis/gm/2017/prc0005_03_10_2017_comp.html" },
    { documento: "Portaria GM/MS 8.031/2025 (revoga o Anexo LXXXVI)", url: "https://www.in.gov.br/web/dou/-/portaria-gm/ms-n-8.031-de-5-de-setembro-de-2025-653608142" },
    { documento: "Lei 12.715/2012 (Planalto)", url: "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12715.htm" },
  ],

  aplicabilidade: {
    criterio: "aprovacao_projeto",
    desde: "2017-09-28",
    ate: "2025-09-07",
    descricao: "Projetos aprovados na vigência da PRC 5/2017, para os atos praticados até 07/09/2025. Desde abr/2026 o MS decide os atos desses projetos pelo Anexo LXXXVI-A; as obrigações do Termo de Compromisso assinado continuam. Projetos das Portarias 875/2013 e 1.550/2014 não estão modelados.",
    sucede: [],
    fonte: {
      documento: MANUAL,
      dispositivo: "seção 4.0, p. 6",
      nota: "Corte final pela Portaria GM/MS 8.031/2025, arts. 4º e 5º; a prática posterior está nas Portarias SE/MS 922 a 983/2026.",
    },
  },

  prazos: {
    ...prazosHerdados,
    prestacaoFinal: {
      descricao: "Prestação no ano seguinte ao último exercício com execução, até 30/04, com demonstrações contábeis e auditoria",
      responsavel: "proponente",
      marco: "fim_exercicio",
      quantidade: 4,
      unidade: "meses",
      fonte: { documento: ANTIGO, dispositivo: "art. 92, parágrafo único" },
    },
    prestacaoAnual: {
      descricao: "Demonstrações contábeis, auditoria e relatório de execução até 30/04 de cada ano de execução",
      responsavel: "proponente",
      marco: "fim_exercicio",
      quantidade: 4,
      unidade: "meses",
      fonte: { documento: ANTIGO, dispositivo: "art. 92, parágrafo único" },
    },
    respostaDiligencia: {
      descricao: "Sanar irregularidade ou omissão na prestação (notificação única)",
      responsavel: "proponente",
      marco: "ciencia_diligencia",
      quantidade: 30,
      unidade: "dias_corridos",
      fonte: { documento: ANTIGO, dispositivo: "art. 97, § 3º" },
    },
    analisePrestacao: {
      descricao: "Análise da prestação; o FNS analisava a parte financeira",
      responsavel: "orgao",
      marco: "envio_prestacao",
      quantidade: 90,
      unidade: "dias_corridos",
      fonte: { documento: ANTIGO, dispositivo: "art. 96" },
    },
    devolucao: {
      descricao: "Recolher por GRU, inclusive na reprovação parcial ou final, depois da notificação do MS",
      responsavel: "proponente",
      marco: "ciencia_decisao",
      quantidade: 30,
      unidade: "dias_corridos",
      fonte: { documento: ANTIGO, dispositivo: "art. 88, VII e § 1º" },
    },
    devolucaoSaldo: {
      descricao: "Recolher por GRU os saldos das contas Captação e Movimento, com rendimentos, depois da notificação do MS",
      responsavel: "proponente",
      marco: "ciencia_diligencia",
      quantidade: 30,
      unidade: "dias_corridos",
      fonte: { documento: ANTIGO, dispositivo: "art. 88, V, VI e § 1º" },
    },
    notificacaoMonitoramento: {
      descricao: "Responder a notificação do monitoramento",
      responsavel: "proponente",
      marco: "ciencia_diligencia",
      quantidade: 20,
      unidade: "dias_corridos",
      fonte: { documento: ANTIGO, dispositivo: "art. 89, § 5º" },
    },
  },

  prestacaoParcial: {
    ...baseParcial,
    descricao: "Prestação anual até 30/04 de cada ano de execução, com demonstrações contábeis, relatório de auditoria independente e relatório de execução; a final no ano seguinte ao último exercício.",
    fonte: { documento: ANTIGO, dispositivo: "art. 92, parágrafo único" },
  },

  orcamento: {
    ...baseOrcamento,
    estrutura: {
      niveis: ["Natureza da despesa", "Categoria de gasto", "Item"],
      descricao: "Orçamento detalhado com todos os custos, a natureza das despesas e as categorias dos gastos.",
      fonte: { documento: ANTIGO, dispositivo: "art. 27" },
    },
    // As despesas administrativas eram admitidas, detalhadas e sem teto; o
    // teto de 15% de custos indiretos é do anexo novo.
    grupos: baseOrcamento.grupos.map(grupo => {
      if (grupo.codigo === "execucao") {
        return {
          ...grupo,
          rotulo: "Custos do projeto",
          descricao: "Custos de execução do projeto, por natureza da despesa e categoria de gasto; no modelo, os bens de capital aparecem como custos indiretos.",
          fonte: { documento: ANTIGO, dispositivo: "art. 27; Anexo 6 (modelo de orçamento)" },
        };
      }
      if (grupo.codigo === "administracao") {
        return {
          ...grupo,
          rotulo: "Despesas administrativas",
          descricao: "Escritório, aluguel, correios, transporte administrativo, telefone, água, luz, internet e honorários administrativos, contábeis e advocatícios, detalhados no orçamento.",
          fonte: { documento: ANTIGO, dispositivo: "art. 28", citacao: "Serão admitidas como despesas administrativas:" },
        };
      }
      return grupo;
    }),
    tetos: [
      {
        codigo: "elaboracao_captacao",
        descricao: "Elaboração do projeto e captação",
        grupos: ["elaboracao"],
        percentual: 5,
        base: "valor_total_projeto",
        teto: 50_000,
        severidade: "bloqueio",
        fonte: { documento: ANTIGO, dispositivo: "art. 27, § 3º", nota: "Soma até 5% do valor total previsto, com teto de R$ 50 mil." },
      },
    ],
    regras: [
      ...baseOrcamento.regras,
      { codigo: "despesas_administrativas", descricao: "Despesas administrativas indispensáveis entram detalhadas no orçamento, sem teto percentual; taxa de administração é vedada.", severidade: "info", fonte: { documento: ANTIGO, dispositivo: "art. 28; art. 44, I", citacao: "a título de taxa de administração ou similar" } },
    ],
  },

  alteracoes: {
    ...baseAlteracoes,
    tipos: {
      ...baseAlteracoes.tipos,
      complementacao: {
        ...baseAlteracoes.tipos.complementacao,
        requisitos: [
          { tipo: "acumulado_maximo", percentual: 20, base: "valor_homologado_execucao", severidade: "bloqueio", descricao: "Captação a maior com readequação de até 20% do aprovado.", fonte: { documento: ANTIGO, dispositivo: "art. 70" } },
          { tipo: "tetos", severidade: "bloqueio", descricao: "A readequação respeita os tetos.", fonte: { documento: ANTIGO, dispositivo: "art. 27, § 3º" } },
        ],
        fonte: { documento: ANTIGO, dispositivo: "art. 70" },
      },
      reducao: {
        ...baseAlteracoes.tipos.reducao,
        requisitos: [
          { tipo: "captado_minimo", percentual: 60, base: "valor_homologado_execucao", severidade: "bloqueio", descricao: "Com 60% ou mais captado, readequação para menor; 100% para executar sem readequar.", fonte: { documento: ANTIGO, dispositivo: "arts. 68 e 69" } },
        ],
        fonte: { documento: ANTIGO, dispositivo: "arts. 68 e 69" },
      },
    },
    // O remanejamento entre projetos (art. 75) vem da conferência, sobre a regra herdada.
    regras: [
      ...baseAlteracoes.regras.filter(regra => regra.codigo !== "prorrogacao"),
      { codigo: "prorrogacao", descricao: "Pedido de prorrogação até 60 dias antes do fim do prazo.", severidade: "alerta", parametros: { diasAntes: 60 }, fonte: { documento: ANTIGO, dispositivo: "art. 86" } },
    ],
  },

  contas: {
    ...baseContas,
    bancos: ["Banco do Brasil"],
    tarifas: {
      regra: "norma_silente",
      descricao: "O regime anterior não trata de tarifas bancárias.",
      fonte: { documento: MANUAL, dispositivo: "seção 3 (contas)" },
    },
    rendimentos: {
      aplicacao: "obrigatoria",
      contamComoCaptado: false,
      uso: "Aplicação automática em poupança; na Conta Movimento, opção entre poupança e fundo de curto prazo. Rendimentos da Conta Captação não contam para os 60% nem para os 100% e voltam com o saldo.",
      fonte: {
        documento: ANTIGO,
        dispositivo: "art. 82, caput e § 3º, I, b, na redação da PRT GM/MS 751/2020",
        citacao: "não serão computados no cálculo dos montantes captados para fins de apuração da captação integral ou captação mínima",
        nota: "A redação original pedia fundo de curto prazo ou operação de mercado aberto lastreada em título público federal.",
      },
    },
    saldo: {
      descricao: "Saldos das contas Captação e Movimento, com rendimentos, recolhidos à Conta Única do Tesouro por GRU em 30 dias da notificação, sem prejuízo ao doador; recursos não usados podem voltar da Conta Movimento para a Captação.",
      prazo: "devolucaoSaldo",
      fonte: { documento: ANTIGO, dispositivo: "art. 88 e § 1º; art. 92, VIII" },
    },
    regras: [
      ...baseContas.regras.filter(regra => regra.codigo !== "recibo_por_deposito" && regra.codigo !== "aplicacao_pelo_termo"),
      { codigo: "recibo_por_deposito", descricao: "Recibo por depósito em 3 vias, com ofício ao MS em 20 dias.", severidade: "alerta", parametros: { dias: 20 }, fonte: { documento: ANTIGO, dispositivo: "art. 64" } },
    ],
  },

  pagamentos: {
    ...basePagamentos,
    meiosPermitidos: null,
    meiosVedados: [],
    descricao: "O regime não restringe o meio de pagamento e cita cheques entre os documentos; cada débito da Conta Movimento corresponde a um comprovante.",
    documentoFiscal: [
      { codigo: "em_nome_da_instituicao", descricao: "Documentos emitidos única e exclusivamente em nome da instituição.", severidade: "bloqueio", fonte: { documento: ANTIGO, dispositivo: "art. 95" } },
      { codigo: "sipar_e_projeto", descricao: "Número do processo, registro no SIPAR, nome do projeto e discriminação em faturas, recibos, notas e cheques; sem como incluir, o representante legal declara no próprio documento.", severidade: "bloqueio", fonte: { documento: ANTIGO, dispositivo: "art. 95, §§ 1º e 2º" } },
    ],
    regras: [
      { codigo: "um_comprovante_por_debito", descricao: "Cada débito da Conta Movimento corresponde a um comprovante de regular aplicação.", severidade: "bloqueio", fonte: { documento: ANTIGO, dispositivo: "art. 83" } },
    ],
    fonte: { documento: MANUAL, dispositivo: "seção 3 (meios de pagamento)" },
  },

  despesas: {
    ...baseDespesas,
    periodo: {
      descricao: "Da celebração do Termo de Compromisso ao fim do prazo de execução, sob pena de ressarcimento.",
      fonte: { documento: ANTIGO, dispositivo: "art. 84" },
    },
    // Reforma era admitida com requisitos; ampliação e construção, não.
    vedadas: baseDespesas.vedadas.map(vedada => vedada.codigo !== "obras" ? vedada : {
      codigo: "obras",
      descricao: "Ampliação e construção de imóveis",
      fonte: { documento: ANTIGO, dispositivo: "art. 34", citacao: "ficando vedada a realização de investimentos com ampliação e construção de imóveis" },
    }),
    regras: [
      ...baseDespesas.regras,
      {
        codigo: "obras_com_requisitos",
        descricao: "Reformas (conservação, manutenção e reparos, sem mudar a área) com declaração do responsável técnico e custo pelo SINAPI ou, na falta dele, por 3 propostas.",
        severidade: "alerta",
        fonte: { documento: ANTIGO, dispositivo: "arts. 34 e 35; art. 2º, XX", citacao: "somente será permitida a realização de despesas com obras em imóveis, no âmbito do Pronon e do Pronas/PCD, se referentes a reformas" },
      },
    ],
  },

  objeto: {
    ...baseObjeto,
    regras: baseObjeto.regras.map(regra => regra.codigo !== "cmd" ? regra : {
      ...regra,
      descricao: "Produção médico-assistencial registrada exclusivamente no CMD também nos projetos antigos (antes, no CIHA).",
      fonte: { documento: "Portaria GM/MS 8.031/2025", dispositivo: "art. 3º" },
    }),
  },

  divulgacao: {
    lacuna: "norma_silente",
    motivo: "O anexo anterior não tem regras de divulgação, aprovação de peças nem logotipo; continua vedado dar ao doador vantagem em razão da doação.",
    fonte: {
      documento: ANTIGO,
      dispositivo: "texto integral; arts. 44, IV, 105, X, e 110",
      nota: "O logotipo e a menção ao MS vêm da minuta do Termo de 2025; o Termo que o projeto assinou pode ter cláusula parecida.",
    },
  },

  envio: {
    ...baseEnvio,
    sistema: "AR, Sedex ou protocolo",
    descricao: "Prestação entregue por AR, Sedex ou protocolo, com os documentos do art. 92 e a auditoria independente.",
    documentos: [
      { codigo: "relatorio_objeto", descricao: "Relatório de cumprimento do objeto", em: ["parcial", "final"], obrigatorio: true, fonte: { documento: ANTIGO, dispositivo: "art. 92, I" } },
      { codigo: "fisico_financeiro", descricao: "Relatório final de execução físico-financeira", em: ["final"], obrigatorio: true, fonte: { documento: ANTIGO, dispositivo: "art. 92, II" } },
      { codigo: "receitas_despesas", descricao: "Relatório de execução de receitas e despesas", em: ["final"], obrigatorio: true, fonte: { documento: ANTIGO, dispositivo: "art. 92, III" } },
      { codigo: "relacao_pagamentos", descricao: "Relação de pagamentos", em: ["final"], obrigatorio: true, fonte: { documento: ANTIGO, dispositivo: "art. 92, IV" } },
      { codigo: "extrato", descricao: "Extrato da conta, do recebimento ao último pagamento", em: ["final"], obrigatorio: true, fonte: { documento: ANTIGO, dispositivo: "art. 92, V" } },
      { codigo: "rendimentos", descricao: "Demonstrativo de rendimentos das aplicações", em: ["final"], obrigatorio: true, fonte: { documento: ANTIGO, dispositivo: "art. 92, VI" } },
      { codigo: "gru", descricao: "Comprovante de recolhimento dos recursos não aplicados por GRU, quando houver", em: ["final"], obrigatorio: false, fonte: { documento: ANTIGO, dispositivo: "art. 92, VII" } },
      { codigo: "volta_para_captacao", descricao: "Comprovante de transferência dos recursos não usados da Conta Movimento para a Captação, quando houver", em: ["final"], obrigatorio: false, fonte: { documento: ANTIGO, dispositivo: "art. 92, VIII" } },
      { codigo: "comprovantes_despesa", descricao: "Cópia dos documentos comprobatórios das despesas", em: ["final"], obrigatorio: true, fonte: { documento: ANTIGO, dispositivo: "art. 92, IX" } },
      { codigo: "bens", descricao: "Relação de bens adquiridos ou produzidos", em: ["final"], obrigatorio: true, fonte: { documento: ANTIGO, dispositivo: "art. 92, X" } },
      { codigo: "fotos", descricao: "Fotografias e reportagens da execução", em: ["final"], obrigatorio: true, fonte: { documento: ANTIGO, dispositivo: "art. 92, XI" } },
      { codigo: "equipamentos", descricao: "Relação de equipamentos e materiais permanentes, com identificação do projeto e inventário físico", em: ["final"], obrigatorio: true, fonte: { documento: ANTIGO, dispositivo: "art. 92, XII" } },
      { codigo: "producao", descricao: "Informações de produção (CIHA; hoje, CMD)", em: ["final"], obrigatorio: true, fonte: { documento: ANTIGO, dispositivo: "art. 92, XIII", nota: "A Portaria GM/MS 8.031/2025, art. 3º, levou os projetos antigos para o CMD." } },
      { codigo: "encerramento_conta", descricao: "Comprovante de encerramento da Conta Movimento", em: ["final"], obrigatorio: true, fonte: { documento: ANTIGO, dispositivo: "art. 92, XIV" } },
      { codigo: "auditoria", descricao: "Demonstrações contábeis e financeiras com parecer conclusivo de auditoria independente (CRC)", em: ["parcial", "final"], obrigatorio: true, fonte: { documento: ANTIGO, dispositivo: "art. 92, parágrafo único" } },
    ],
    modelos: [],
    fonte: { documento: ANTIGO, dispositivo: "arts. 91 e 92" },
  },

  posEnvio: {
    ...basePosEnvio,
    devolucao: {
      descricao: "GRU para a Conta Única do Tesouro, sem prejuízo ao benefício fiscal do doador, em 30 dias da notificação: saldo do orçamento, saldo ao fim da execução e reprovação parcial ou final.",
      atualizacao: "Na reprovação, o valor irregular é atualizado desde a captação pelo índice da caderneta de poupança.",
      gru: [],
      fonte: { documento: ANTIGO, dispositivo: "art. 88, V a VII e §§ 1º e 2º; art. 101" },
    },
    regras: [
      ...basePosEnvio.regras.filter(regra => regra.codigo !== "inabilitacao" && regra.codigo !== "analise_por_resultados" && regra.codigo !== "diligencia_por_email"),
      { codigo: "analise_financeira_fns", descricao: "Superintendência Estadual do MS faz a análise contábil e financeira (AACF), que segue ao DESID e à área técnica, para o parecer conclusivo.", severidade: "info", fonte: { documento: MANUAL, dispositivo: "seções 1.0 e 6.0, p. 5 e 7" } },
      { codigo: "inabilitacao", descricao: "Inabilitação pelos critérios do art. 105 do regime anterior.", severidade: "alerta", fonte: { documento: ANTIGO, dispositivo: "art. 105" } },
    ],
  },

  guarda: {
    marco: "registro_decisao",
    quantidade: 5,
    unidade: "anos",
    prorrogaParaDiaUtil: false,
    descricao: "Documentos guardados por 5 anos a partir da aprovação da prestação de contas.",
    fonte: { documento: ANTIGO, dispositivo: "art. 95" },
  },
};

export const SAUDE_LXXXVI_2017: RegimeNormativo = aplicarConferencia(montado, CONFERENCIA_SAUDE_LXXXVI_2017);
