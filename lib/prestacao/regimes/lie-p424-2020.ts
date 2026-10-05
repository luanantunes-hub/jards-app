// Lei de Incentivo ao Esporte (federal), projetos protocolados antes de
// 04/03/2026: Portaria 424/2020, com as alterações até a Portaria MESP
// 33/2025, e a LC 222/2025 (Portaria MESP 10/2026, art. 102).
//
// A fonte conferiu, no texto da P424, as diferenças para a P10 (tabela 1.2 de
// docs/acoes-futuras/estudos/prestacao-de-contas-fontes/lie-federal-2026-oficial.md).
// O resto vem da P10 marcado "a confirmar": a regra é a mesma na prática, mas
// o dispositivo da P424 não foi conferido.

import { herdarRegime } from "./herdar";
import { LIE_P10_2026 } from "./lie-p10-2026";
import { definida, type AlteracoesRegime, type RegimeNormativo } from "./tipos";

const P424 = "Portaria 424/2020";
const P424_33 = "Portaria 424/2020, na redação da Portaria MESP 33/2025";
const TUTORIAL = "Tutorial de remanejamento e readequação (MESP, 2023)";

const base = herdarRegime(LIE_P10_2026, "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.");
const baseAlteracoes = definida(base.alteracoes) as AlteracoesRegime;
const baseOrcamento = definida(base.orcamento)!;
const baseContas = definida(base.contas)!;
const baseDespesas = definida(base.despesas)!;
const baseEnvio = definida(base.envio)!;
const basePosEnvio = definida(base.posEnvio)!;

// A P424 tem só a reconsideração de 30 dias; o recurso administrativo de 10 dias é da P10.
const prazosHerdados = Object.fromEntries(Object.entries(base.prazos).filter(([chave]) => chave !== "recursoAdministrativo"));

export const LIE_P424_2020: RegimeNormativo = {
  ...base,
  codigo: "lie_p424_2020",
  versao: 1,
  nome: "Lei de Incentivo ao Esporte — Portaria 424/2020",
  sistemaOficial: "SLI",
  normaReferencia: "LC 222/2025; Portaria MC 424/2020, com as alterações até a Portaria MESP 33/2025",
  vigenteDesde: "2020-06-23",
  fontes: [
    { documento: "Portaria 424/2020 (DOU de 23/06/2020)", url: "https://www.in.gov.br/web/dou/-/portaria-n-424-de-22-de-junho-de-2020-262970445" },
    { documento: "Portaria MESP 33/2025 (altera a P424)", url: "https://www.in.gov.br/web/dou/-/portaria-mesp-n-33-de-10-de-abril-de-2025-623708571" },
    { documento: "Portaria MESP 10/2026, art. 102 (transição)", url: "https://www.in.gov.br/web/dou/-/portaria-mesp-n-10-de-3-de-marco-de-2026-690209578" },
    { documento: "LC 222/2025 (Planalto)", url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/Lcp222.htm" },
  ],

  aplicabilidade: {
    criterio: "protocolo_projeto",
    desde: "2020-06-23",
    ate: "2026-03-03",
    descricao: "Projetos protocolados no SLI antes de 04/03/2026: análise, acompanhamento e prestação de contas pela P424, observado o normativo vigente no protocolo e a LC 222/2025.",
    sucede: [],
    fonte: {
      documento: "Portaria MESP 10/2026",
      dispositivo: "art. 102",
      citacao: "terão sua análise, acompanhamento e prestação de contas regidos pelas disposições nela previstas",
      aConfirmar: true,
      nota: "O corte em 03/03/2026 é leitura dos arts. 102 a 104 da P10.",
    },
  },

  prazos: {
    ...prazosHerdados,
    respostaDiligencia: {
      descricao: "Suprir documentos ou informações pedidos em diligência da PCF (improrrogável)",
      responsavel: "proponente",
      marco: "ciencia_diligencia",
      quantidade: 30,
      unidade: "dias_corridos",
      fonte: { documento: P424, dispositivo: "art. 72, § 3º" },
    },
    recurso: {
      descricao: "Pedido de reconsideração à CGPC, do dia seguinte ao recebimento da decisão",
      responsavel: "proponente",
      marco: "ciencia_decisao",
      quantidade: 30,
      unidade: "dias_corridos",
      fonte: { documento: P424, dispositivo: "art. 84, § 5º" },
    },
    transferenciaSaldo: {
      descricao: "Pedir a transferência do saldo remanescente para outro projeto da entidade",
      responsavel: "proponente",
      marco: "fim_vigencia",
      quantidade: 120,
      unidade: "dias_corridos",
      fonte: { documento: P424, dispositivo: "art. 60, § 2º" },
    },
    notificacaoOmissao: {
      descricao: "Apresentar a PCF ou recolher depois da notificação do DIFE por omissão, sob pena de TCE",
      responsavel: "proponente",
      marco: "ciencia_diligencia",
      quantidade: 30,
      unidade: "dias_corridos",
      fonte: { documento: P424, dispositivo: "art. 71, § 3º" },
    },
    analisePrestacao: {
      descricao: "Análise técnica e análise financeira da PCF (cada uma)",
      responsavel: "orgao",
      marco: "envio_prestacao",
      quantidade: 360,
      unidade: "dias_corridos",
      fonte: {
        documento: P424_33,
        dispositivo: "prazo de análise da PCF",
        aConfirmar: true,
        nota: "A redação original dava 360 dias para a técnica e 180 para a financeira; a fonte não registra o artigo.",
      },
    },
  },

  orcamento: {
    ...baseOrcamento,
    tetos: baseOrcamento.tetos.map(teto => teto.codigo !== "elaboracao_captacao" ? teto : {
      ...teto,
      base: "valor_captado",
      fonte: {
        documento: P424,
        dispositivo: "art. 26 e § 1º",
        nota: "Mesmos percentuais por manifestação (educacional 10%, participação 7%, rendimento 5%, N/NE/CO 15%) e teto de R$ 100 mil, sobre o valor efetivamente captado, sem rendimentos.",
      },
    }),
    regras: baseOrcamento.regras.map(regra => regra.codigo !== "elaboracao_por_nivel" ? regra : {
      ...regra,
      descricao: "Elaboração e captação até 10% (educacional), 7% (participação), 5% (rendimento) ou 15% (projeto só no N, NE ou CO) do valor efetivamente captado, sem rendimentos, até R$ 100 mil.",
      parametros: { educacional: 10, participacao: 7, rendimento: 5, norteNordesteCentroOeste: 15, teto: 100_000 },
      fonte: { documento: P424, dispositivo: "art. 26 e § 1º" },
    }),
  },

  alteracoes: {
    ...baseAlteracoes,
    tipos: {
      ...baseAlteracoes.tipos,
      remanejamento: {
        permitido: true,
        classificacao: "administrativa",
        condicoes: [
          {
            tipo: "movido_ate",
            percentual: 20,
            base: "valor_total_projeto",
            acumulado: false,
            descricao: "Move até 20%, em qualquer um dos dois pedidos, comunicando em 5 dias.",
            fonte: { documento: P424_33, dispositivo: "art. 57" },
          },
          {
            tipo: "mantem_grupos",
            grupos: ["elaboracao"],
            descricao: "Não muda o valor de elaboração e captação, que exige aprovação prévia.",
            fonte: { documento: P424_33, dispositivo: "art. 57" },
          },
        ],
        requisitos: [
          { tipo: "maximo_pedidos", quantidade: 2, severidade: "bloqueio", descricao: "Até dois remanejamentos.", fonte: { documento: P424_33, dispositivo: "art. 57" } },
          { tipo: "tetos", severidade: "bloqueio", descricao: "O remanejamento respeita os 15% de atividade-meio.", fonte: { documento: P424_33, dispositivo: "art. 57" } },
        ],
        orientacoes: [
          { codigo: "comunicar_em_5_dias", descricao: "Feito sem anuência, comunique em 5 dias.", severidade: "alerta", parametros: { dias: 5 }, fonte: { documento: P424_33, dispositivo: "art. 57" } },
          { codigo: "tres_orcamentos", descricao: "Se o valor unitário de um item subir, junte 3 orçamentos novos.", severidade: "alerta", fonte: { documento: TUTORIAL, dispositivo: "valor unitário" } },
        ],
        fonte: { documento: P424_33, dispositivo: "art. 57" },
      },
      complementacao: {
        ...baseAlteracoes.tipos.complementacao,
        requisitos: [
          { tipo: "maximo_pedidos", quantidade: 1, severidade: "bloqueio", descricao: "Uma única readequação.", fonte: { documento: TUTORIAL, dispositivo: "art. 57-A, § 1º (citado)", aConfirmar: true } },
          {
            tipo: "antecedencia",
            quantidade: 60,
            unidade: "dias_corridos",
            severidade: "alerta",
            descricao: "Pedido até 60 dias antes do fim do Termo.",
            fonte: { documento: TUTORIAL, dispositivo: "art. 57-A, § 1º (citado)", aConfirmar: true, nota: "Não foi achado no DOU o ato que incluiu o art. 57-A." },
          },
          { tipo: "tetos", severidade: "bloqueio", descricao: "A readequação respeita os tetos.", fonte: { documento: P424, dispositivo: "art. 26; art. 57" } },
        ],
      },
    },
  },

  contas: {
    ...baseContas,
    rendimentos: {
      aplicacao: "obrigatoria",
      contamComoCaptado: false,
      uso: "Poupança se o uso for em um mês ou mais, fundo de curto prazo se em menos; rendimentos não pagam despesa administrativa, elaboração e captação nem pessoal sem autorização.",
      fonte: { documento: P424, dispositivo: "art. 29, §§ 1º a 3º" },
    },
    saldo: {
      descricao: "Transferência do saldo para outro projeto da entidade em até 120 dias; senão, GRU.",
      prazo: "transferenciaSaldo",
      fonte: { documento: P424, dispositivo: "art. 60, § 2º" },
    },
    regras: [
      ...baseContas.regras.filter(regra => regra.codigo !== "deposito_identificado"),
      { codigo: "recibo_aprovado", descricao: "Recibo de captação em 3 vias; o DIFE aprova o recibo e só então o recurso é liberado; captação informada em 3 dias úteis.", severidade: "bloqueio", fonte: { documento: P424, dispositivo: "art. 27" } },
      { codigo: "extratos_mensais", descricao: "Extratos mensais das contas.", severidade: "alerta", fonte: { documento: P424, dispositivo: "art. 21, § 6º" } },
    ],
  },

  despesas: {
    ...baseDespesas,
    periodo: {
      descricao: "Da assinatura do Termo de Compromisso ao fim da vigência; despesa fora dela é ressarcida (sem a multa de 5% da P10).",
      fonte: { documento: P424, dispositivo: "art. 46" },
    },
  },

  envio: {
    ...baseEnvio,
    sistema: "Sistema eletrônico, remessa postal ou e-mail",
    descricao: "PCF com as peças do art. 72 (13 incisos) por sistema eletrônico, remessa postal ou e-mail; os modelos oficiais são os mesmos da P10.",
    documentos: baseEnvio.documentos.filter(doc => doc.codigo !== "fotos_acessibilidade"),
    fonte: { documento: P424, dispositivo: "arts. 69, 71 e 72" },
  },

  posEnvio: {
    ...basePosEnvio,
    regras: [
      ...basePosEnvio.regras.filter(regra => regra.codigo !== "pcf_fora_do_prazo"),
      { codigo: "pcf_fora_do_prazo", descricao: "PCF não apresentada: o DIFE dá 30 dias para apresentar ou recolher, sob pena de TCE.", severidade: "bloqueio", fonte: { documento: P424, dispositivo: "art. 71, § 3º" } },
    ],
  },
};
