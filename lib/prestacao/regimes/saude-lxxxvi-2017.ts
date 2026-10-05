// PRONON e PRONAS/PCD (saúde), regime anterior: Anexo LXXXVI da PRC GM/MS
// 5/2017 (origem na PRT GM/MS 1.550/2014), revogado pela Portaria GM/MS
// 8.031/2025. Serve aos atos praticados antes de 08/09/2025 e às obrigações dos
// Termos de Compromisso assinados nele.
//
// As diferenças para o Anexo LXXXVI-A foram conferidas no quadro "Antes ×
// agora" de saude-anexo-lxxxvi-a-oficial.md (seção 11) e no manual do FNS de
// 2019 (saude-pronon-pronas-manual-2019.md, roteiro da PRC 5); o resto vem do
// anexo novo marcado "a confirmar".

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

// Prazos que só existem no anexo novo.
const SO_NO_NOVO = new Set(["saneamento", "complementacaoAlteracao"]);
const prazosHerdados = Object.fromEntries(Object.entries(base.prazos).filter(([chave]) => !SO_NO_NOVO.has(chave)));

export const SAUDE_LXXXVI_2017: RegimeNormativo = {
  ...base,
  codigo: "pronon_pronas_lxxxvi_2017",
  versao: 1,
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
    grupos: baseOrcamento.grupos.filter(grupo => grupo.codigo !== "administracao").map(grupo => grupo.codigo !== "execucao" ? grupo : {
      ...grupo,
      rotulo: "Custos do projeto",
      descricao: "Custos de execução do projeto; o regime não previa custos indiretos.",
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
      { codigo: "sem_custos_indiretos", descricao: "O regime não previa custos indiretos, e a taxa de administração era vedada.", severidade: "alerta", fonte: { documento: "Anexo LXXXVI-A da PRC 5/2017", dispositivo: "seção 11 da conferência (antes × agora)", aConfirmar: true } },
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
    regras: [
      ...baseAlteracoes.regras.filter(regra => regra.codigo !== "prorrogacao"),
      { codigo: "prorrogacao", descricao: "Pedido de prorrogação até 60 dias antes do fim do prazo.", severidade: "alerta", parametros: { diasAntes: 60 }, fonte: { documento: ANTIGO, dispositivo: "art. 86" } },
      { codigo: "remanejamento_entre_projetos", descricao: "No remanejamento entre projetos, o ganho do beneficiário ficava limitado a 20% do aprovado.", severidade: "alerta", parametros: { percentual: 20 }, fonte: { documento: ANTIGO, dispositivo: "art. 75, § 3º" } },
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
      contamComoCaptado: null,
      uso: "Aplicação obrigatória em fundo de curto prazo ou em operação de mercado aberto lastreada em título público federal; os rendimentos somam no total de recursos e voltam com o saldo.",
      fonte: { documento: ANTIGO, dispositivo: "art. 82" },
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
    vedadas: baseDespesas.vedadas.filter(vedada => vedada.codigo !== "obras"),
    regras: [
      ...baseDespesas.regras,
      { codigo: "obras_com_requisitos", descricao: "Obras e reformas eram admitidas com requisitos (vedadas só no anexo novo).", severidade: "info", fonte: { documento: "Anexo LXXXVI-A da PRC 5/2017", dispositivo: "seção 11 da conferência (antes × agora)", aConfirmar: true } },
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
      atualizacao: "O regime anterior não fixa índice; o roteiro do FNS soma recursos iniciais e rendimentos.",
      gru: [],
      fonte: { documento: ANTIGO, dispositivo: "art. 88, V a VII e §§ 1º e 2º" },
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
