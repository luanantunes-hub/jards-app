// PRONON e PRONAS/PCD (saúde): Anexo LXXXVI-A da PRC GM/MS 5/2017, instituído
// pela Portaria GM/MS 8.031/2025, com a Lei 12.715/2012 e o Decreto 7.988/2013.
// Texto lido por inteiro: docs/acoes-futuras/estudos/prestacao-de-contas-fontes/
// saude-anexo-lxxxvi-a-oficial.md. A lista de documentos e a guarda não estão
// no anexo: vêm da minuta do Termo de Compromisso dos editais de 2025.

import type { RegimeNormativo } from "./tipos";

const ANEXO = "Anexo LXXXVI-A da PRC 5/2017";
const PORTARIA = "Portaria GM/MS 8.031/2025";
const TC = "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)";
const DECRETO = "Decreto 7.988/2013";
const LEI = "Lei 12.715/2012";
const EDITAL = "Edital de Chamamento MS 3/2025";

export const SAUDE_LXXXVI_A_2025 = {
  codigo: "pronon_pronas_lxxxvi_a_2025",
  versao: 1,
  nome: "PRONON e PRONAS/PCD — Anexo LXXXVI-A",
  area: "saude",
  mecanismo: "saude",
  esfera: "federal",
  orgao: "Ministério da Saúde",
  sistemaOficial: "Transferegov",
  normaReferencia: "Lei 12.715/2012; Decreto 7.988/2013; Anexo LXXXVI-A da PRC GM/MS 5/2017 (Portaria GM/MS 8.031/2025)",
  vigenteDesde: "2025-09-08",
  identificadorOficial: { tipo: "nup", rotulo: "NUP do processo" },
  fontes: [
    { documento: "Portaria GM/MS 8.031/2025 (DOU de 08/09/2025)", url: "https://www.in.gov.br/web/dou/-/portaria-gm/ms-n-8.031-de-5-de-setembro-de-2025-653608142" },
    { documento: "PRC GM/MS 5/2017 compilada (Saúde Legis)", url: "https://bvsms.saude.gov.br/bvs/saudelegis/gm/2017/prc0005_03_10_2017_comp.html" },
    { documento: "Lei 12.715/2012 (Planalto)", url: "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12715.htm" },
    { documento: "Decreto 7.988/2013 (Planalto)", url: "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7988.htm" },
    { documento: "Edital 3/2025 (Pronon), com a minuta do Termo de Compromisso", url: "https://www.gov.br/saude/pt-br/acesso-a-informacao/participacao-social/chamamentos-publicos/2025/chamamento-publico-no-03-2025-se-pronon/edital" },
  ],

  aplicabilidade: {
    criterio: "ato_praticado",
    desde: "2025-09-08",
    ate: null,
    descricao: "Vale desde a publicação da Portaria 8.031/2025, que revogou o Anexo LXXXVI. Desde abr/2026 o MS aplica o novo anexo também aos atos de projetos aprovados em 2024 e 2025 (readequações e a prestação de 2025); as obrigações do Termo de Compromisso assinado continuam.",
    sucede: ["pronon_pronas_lxxxvi_2017"],
    fonte: { documento: PORTARIA, dispositivo: "arts. 3º a 5º", nota: "A única regra de transição escrita é a do CMD (art. 3º); a aplicação aos projetos antigos é prática do MS (Portarias SE/MS 922 a 983/2026 e 928/2026)." },
  },

  prazos: {
    prestacaoFinal: {
      descricao: "Prestação de contas final, até 30/04 do ano seguinte ao último exercício com execução",
      responsavel: "proponente",
      marco: "fim_exercicio",
      quantidade: 4,
      unidade: "meses",
      fonte: {
        documento: ANEXO,
        dispositivo: "art. 81",
        nota: "Quatro meses depois de 31/12 do ano em que a execução terminou dão 30/04. O anexo não trata de dia sem expediente; vale a regra geral de prorrogação.",
      },
    },
    prestacaoAnual: {
      descricao: "Prestação anual de cada exercício com execução, até 30/04 do ano seguinte",
      responsavel: "proponente",
      marco: "fim_exercicio",
      quantidade: 4,
      unidade: "meses",
      fonte: { documento: ANEXO, dispositivo: "art. 81", nota: "A de 2025 foi prorrogada para 31/05/2026 (Portaria SE/MS 928/2026)." },
    },
    respostaDiligencia: {
      descricao: "Responder diligência da análise da prestação (por e-mail); o silêncio pode levar à reprovação",
      responsavel: "proponente",
      marco: "ciencia_diligencia",
      quantidade: 15,
      unidade: "dias_corridos",
      fonte: { documento: ANEXO, dispositivo: "art. 86, §§ 2º e 3º", nota: "A diligência suspende o prazo do MS." },
    },
    saneamento: {
      descricao: "Sanar irregularidade ou omissão na prestação depois da notificação",
      responsavel: "proponente",
      marco: "ciencia_diligencia",
      quantidade: 15,
      unidade: "dias_corridos",
      fonte: { documento: ANEXO, dispositivo: "art. 82" },
    },
    analisePrestacao: {
      descricao: "Análise da prestação pelo MS, prorrogável por igual período",
      responsavel: "orgao",
      marco: "envio_prestacao",
      quantidade: 150,
      unidade: "dias_corridos",
      fonte: { documento: ANEXO, dispositivo: "arts. 83 e 86" },
    },
    recurso: {
      descricao: "Recurso a quem decidiu, que tem 10 dias para reconsiderar; última instância é o Secretário-Executivo",
      responsavel: "proponente",
      marco: "ciencia_decisao",
      quantidade: 5,
      unidade: "dias_corridos",
      fonte: { documento: ANEXO, dispositivo: "arts. 94 e 95" },
    },
    devolucao: {
      descricao: "Recolher por GRU depois da reprovação, atualizado pela poupança desde a captação",
      responsavel: "proponente",
      marco: "ciencia_decisao",
      quantidade: 30,
      unidade: "dias_corridos",
      fonte: { documento: ANEXO, dispositivo: "art. 90", nota: "Sem pagamento nem pedido de parcelamento, segue para TCE." },
    },
    devolucaoSaldo: {
      descricao: "Devolver saldo e rendimentos ao término, sob pena de TCE imediata (improrrogável)",
      responsavel: "proponente",
      marco: "fim_vigencia",
      quantidade: 30,
      unidade: "dias_corridos",
      fonte: { documento: ANEXO, dispositivo: "art. 71" },
    },
    readequacaoCaptacao: {
      descricao: "Apresentar a readequação para menor (60% a 99,99% captado) ou para maior (até 20%)",
      responsavel: "proponente",
      marco: "fim_captacao",
      quantidade: 30,
      unidade: "dias_corridos",
      fonte: { documento: ANEXO, dispositivo: "arts. 58 e 59" },
    },
    notificacaoMonitoramento: {
      descricao: "Esclarecer, cumprir ou justificar o que o monitoramento apontar",
      responsavel: "proponente",
      marco: "ciencia_diligencia",
      quantidade: 30,
      unidade: "dias_corridos",
      fonte: { documento: ANEXO, dispositivo: "art. 76, § 5º" },
    },
    complementacaoAlteracao: {
      descricao: "Complementar o pedido de alteração do plano de trabalho",
      responsavel: "proponente",
      marco: "ciencia_diligencia",
      quantidade: 10,
      unidade: "dias_corridos",
      fonte: { documento: ANEXO, dispositivo: "art. 72, § 2º" },
    },
    certidoes: {
      descricao: "Enviar as certidões que o MS não conseguiu consultar",
      responsavel: "proponente",
      marco: "ciencia_diligencia",
      quantidade: 20,
      unidade: "dias_corridos",
      fonte: { documento: TC, dispositivo: "cláusula 3ª", nota: "Com irregularidade, o MS pode bloquear as contas." },
    },
    recursoInabilitacao: {
      descricao: "Recorrer ao Ministro da inabilitação",
      responsavel: "proponente",
      marco: "ciencia_decisao",
      quantidade: 15,
      unidade: "dias_corridos",
      fonte: { documento: DECRETO, dispositivo: "art. 15" },
    },
  },

  prestacaoParcial: {
    modalidades: ["periodica"],
    descricao: "Prestação anual de cada exercício com execução, até 30/04 do ano seguinte, com relatório de execução do objeto, relatório de execução financeira, demonstrações contábeis e parecer de auditoria independente; a final vem no ano seguinte ao último exercício.",
    prazo: "prestacaoAnual",
    regras: [
      { codigo: "auditoria_anual", descricao: "Demonstrações contábeis e financeiras com parecer conclusivo de auditoria independente registrada no CRC, todo ano.", severidade: "bloqueio", fonte: { documento: DECRETO, dispositivo: "art. 22, parágrafo único; Anexo LXXXVI-A, art. 88, III; minuta do TC, cl. 6ª, subcl. 4ª e 5ª" } },
      { codigo: "excecao_2025", descricao: "A prestação do exercício 2025 vai até 31/05/2026; os demais exercícios seguem 30/04.", severidade: "info", fonte: { documento: "Portaria SE/MS 928/2026", dispositivo: "art. 4º" } },
      { codigo: "monitoramento_anual", descricao: "Relatórios de monitoramento anuais da secretaria finalística, homologados em 45 dias, com resultados, impactos, satisfação e sustentabilidade.", severidade: "info", fonte: { documento: ANEXO, dispositivo: "arts. 78 e 79" } },
    ],
    fonte: { documento: ANEXO, dispositivo: "art. 81" },
  },

  orcamento: {
    estrutura: {
      niveis: ["Custos diretos ou capital", "Rubrica", "Item"],
      descricao: "Orçamento analítico com todos os itens, etapas e custos, matriz lógica e cronograma em meses; no modelo dos editais, custeio (custos diretos) e capital (equipamentos e material permanente), com o percentual de cada linha.",
      fonte: { documento: ANEXO, dispositivo: "art. 17, § 1º, IX a XI; Editais 2/2025 e 3/2025, Anexo IV" },
    },
    grupos: [
      { codigo: "execucao", rotulo: "Custos diretos", descricao: "Equipe com encargos, consumo, serviços de terceiros, diárias, passagens, equipamentos e material permanente essenciais.", fonte: { documento: ANEXO, dispositivo: "art. 21, I, II e V" } },
      { codigo: "administracao", rotulo: "Custos indiretos", descricao: "Internet, transporte, combustível, aluguel, telefone, água, energia, gás e contabilidade.", fonte: { documento: ANEXO, dispositivo: "art. 21, III" } },
      { codigo: "elaboracao", rotulo: "Elaboração e captação", descricao: "Elaboração da proposta e captação de recursos.", fonte: { documento: ANEXO, dispositivo: "art. 21, IV" } },
    ],
    bases: {
      valor_projeto: {
        descricao: "Valor do projeto: o orçamento inteiro.",
        soma: "todos",
        exceto: [],
        fonte: { documento: ANEXO, dispositivo: "art. 21, III", nota: "O anexo não tira grupos do valor do projeto." },
      },
      valor_total_projeto: {
        descricao: "Montante global do projeto.",
        soma: "todos",
        exceto: [],
        fonte: { documento: ANEXO, dispositivo: "art. 21, IV" },
      },
    },
    tetos: [
      {
        codigo: "custos_indiretos",
        descricao: "Custos indiretos",
        grupos: ["administracao"],
        percentual: 15,
        base: "valor_projeto",
        severidade: "bloqueio",
        fonte: { documento: ANEXO, dispositivo: "art. 21, III" },
      },
      {
        codigo: "elaboracao_captacao",
        descricao: "Elaboração da proposta e captação",
        grupos: ["elaboracao"],
        percentual: 5,
        base: "valor_total_projeto",
        teto: 50_000,
        severidade: "bloqueio",
        fonte: { documento: ANEXO, dispositivo: "art. 21, IV" },
      },
    ],
    regras: [
      { codigo: "precos_de_referencia", descricao: "Preços pelo SIGTAP, SIGEM, BPS, PNCP ou outras fontes, ou 3 cotações; equipe pela convenção coletiva e pelos conselhos profissionais.", severidade: "alerta", fonte: { documento: ANEXO, dispositivo: "art. 41 e § 3º" } },
      { codigo: "equipamentos", descricao: "Equipamentos com viabilidade e sustentabilidade, normas da Anvisa e preço pelo SIGEM.", severidade: "alerta", fonte: { documento: ANEXO, dispositivo: "arts. 27 a 29" } },
      { codigo: "medicamentos", descricao: "Medicamentos da RENAME; oncológicos com registro na Anvisa.", severidade: "alerta", fonte: { documento: ANEXO, dispositivo: "art. 30, § 1º" } },
      { codigo: "opm", descricao: "Órteses, próteses e meios auxiliares de locomoção só com ações de habilitação e reabilitação.", severidade: "alerta", fonte: { documento: ANEXO, dispositivo: "art. 31" } },
      { codigo: "prazo_de_execucao", descricao: "Execução em até 24 meses; pesquisa em até 36.", severidade: "alerta", parametros: { meses: 24, mesesPesquisa: 36 }, fonte: { documento: ANEXO, dispositivo: "art. 18" } },
      { codigo: "reserva_de_contingencia", descricao: "O edital pode prever reserva de contingência entre 5% e 15% do valor global.", severidade: "info", parametros: { minimo: 5, maximo: 15 }, fonte: { documento: ANEXO, dispositivo: "art. 16" } },
    ],
  },

  alteracoes: {
    janela: {
      aPartirDe: "assinatura_termo",
      ate: "fim_execucao",
      descricao: "Durante a execução, que começa com o Termo de Compromisso publicado e o desbloqueio da conta; é vedado executar qualquer alteração antes da autorização formal.",
      fonte: { documento: ANEXO, dispositivo: "arts. 50 e 72" },
    },
    tipos: {
      remanejamento: {
        permitido: true,
        classificacao: "formal",
        condicoes: [],
        requisitos: [
          { tipo: "tetos", severidade: "bloqueio", descricao: "Depois do remanejamento, os custos indiretos e a elaboração continuam dentro dos tetos.", fonte: { documento: ANEXO, dispositivo: "art. 21, III e IV" } },
        ],
        orientacoes: [
          { codigo: "termo_de_apostilamento", descricao: "Remanejamento sem alterar o valor global vai por Termo de Apostilamento, sempre com aprovação prévia.", severidade: "bloqueio", fonte: { documento: ANEXO, dispositivo: "art. 69, § 2º" } },
        ],
        fonte: { documento: ANEXO, dispositivo: "arts. 69, § 2º, e 72", nota: "O anexo não tem remanejamento livre: toda mudança exige autorização prévia." },
      },
      complementacao: {
        permitido: true,
        classificacao: "formal",
        condicoes: [],
        requisitos: [
          { tipo: "acumulado_maximo", percentual: 20, base: "valor_homologado_execucao", severidade: "bloqueio", descricao: "Readequação para maior de até 20% do aprovado, a critério do MS.", fonte: { documento: ANEXO, dispositivo: "art. 59" } },
          { tipo: "tetos", severidade: "bloqueio", descricao: "A readequação respeita os tetos.", fonte: { documento: ANEXO, dispositivo: "art. 21, III e IV" } },
        ],
        orientacoes: [
          { codigo: "pedido_em_30_dias", descricao: "Pedido em 30 dias do fim da captação ou do aviso antecipado de conclusão.", severidade: "alerta", parametros: { dias: 30 }, fonte: { documento: ANEXO, dispositivo: "art. 59" } },
          { codigo: "excedente_recolhido", descricao: "O que passar de 120% do aprovado é recolhido.", severidade: "alerta", fonte: { documento: TC, dispositivo: "cl. 2ª, subcl. 2ª" } },
          { codigo: "termo_aditivo", descricao: "Mudar valores, metas ou prazo durante a execução exige termo aditivo.", severidade: "info", fonte: { documento: ANEXO, dispositivo: "art. 72, § 1º" } },
        ],
        fonte: { documento: ANEXO, dispositivo: "art. 59" },
      },
      reducao: {
        permitido: true,
        classificacao: "formal",
        condicoes: [],
        requisitos: [
          { tipo: "captado_minimo", percentual: 60, base: "valor_homologado_execucao", severidade: "bloqueio", descricao: "Ter captado ao menos 60% do aprovado; abaixo disso, o projeto é indeferido e o saldo recolhido.", fonte: { documento: ANEXO, dispositivo: "arts. 58 e 60, III" } },
          { tipo: "tetos", severidade: "alerta", descricao: "Depois da redução, os grupos continuam dentro dos tetos.", fonte: { documento: ANEXO, dispositivo: "art. 21, III e IV" } },
        ],
        orientacoes: [
          { codigo: "pedido_em_30_dias", descricao: "Readequação para menor em 30 dias do fim da captação; a execução só começa depois de aprovada (SE em 10 dias, secretaria em 30, portaria em 10).", severidade: "alerta", parametros: { dias: 30 }, fonte: { documento: ANEXO, dispositivo: "art. 58" } },
        ],
        fonte: { documento: ANEXO, dispositivo: "art. 58" },
      },
      inclusao: {
        permitido: true,
        classificacao: "formal",
        condicoes: [],
        requisitos: [
          { tipo: "tetos", severidade: "alerta", descricao: "Com o item novo, os grupos continuam dentro dos tetos.", fonte: { documento: ANEXO, dispositivo: "art. 21, III e IV" } },
        ],
        orientacoes: [],
        fonte: { documento: ANEXO, dispositivo: "art. 72" },
      },
    },
    alertasPorItem: [],
    prazoAnalise: null,
    silencioAprova: false,
    regras: [
      { codigo: "rendimentos_por_apostilamento", descricao: "Usar rendimentos ou saldos antes do término exige aprovação prévia e Termo de Apostilamento.", severidade: "bloqueio", fonte: { documento: ANEXO, dispositivo: "art. 69, § 2º" } },
      { codigo: "prorrogacao", descricao: "Prorrogação a pedido uma única vez, protocolada até 90 dias antes do fim; de ofício quando o atraso é da administração.", severidade: "alerta", parametros: { diasAntes: 90 }, fonte: { documento: ANEXO, dispositivo: "arts. 65, § 2º, e 73" } },
      { codigo: "suspensao", descricao: "Suspensão a pedido por até 120 dias; depois, o projeto é encerrado.", severidade: "info", parametros: { dias: 120 }, fonte: { documento: ANEXO, dispositivo: "art. 77" } },
      { codigo: "remanejamento_entre_projetos", descricao: "Remanejamento entre Contas Captação: mesmo CNPJ, programa e ano fiscal, depois do fim da captação e antes da readequação e do Termo.", severidade: "info", fonte: { documento: ANEXO, dispositivo: "arts. 61 a 64" } },
    ],
    fonte: { documento: ANEXO, dispositivo: "arts. 58, 59, 69 e 72" },
  },

  fornecedores: {
    limites: [],
    partesRelacionadas: {
      descricao: "É vedado captar de entidades vinculadas à proponente; exposição de marca do doador é vantagem indevida.",
      fonte: { documento: ANEXO, dispositivo: "arts. 51 e 96, parágrafo único" },
    },
    regras: [
      { codigo: "vantagem_ao_doador", descricao: "Despesa que gere vantagem ao doador é vedada; com dolo, multa de 2 vezes a vantagem.", severidade: "bloqueio", fonte: { documento: ANEXO, dispositivo: "art. 22, IV; Lei 12.715/2012, art. 13" } },
      { codigo: "unidade_executora", descricao: "A instituição executa o projeto e não transfere as atividades principais.", severidade: "bloqueio", fonte: { documento: ANEXO, dispositivo: "art. 76, § 3º; minuta do TC, cl. 9ª" } },
      { codigo: "intermediacao", descricao: "Intermediação é vedada, salvo a contratação de elaboração do projeto e de captação.", severidade: "bloqueio", fonte: { documento: LEI, dispositivo: "art. 11; minuta do TC, cl. 1ª, subcl. 2ª" } },
      { codigo: "equipe_ligada_a_acao", descricao: "Equipe do quadro ou contratada só para ações do plano, com relação direta com o objeto.", severidade: "alerta", fonte: { documento: ANEXO, dispositivo: "art. 20, § 1º" } },
    ],
    fonte: { documento: ANEXO, dispositivo: "arts. 20, 51 e 76", nota: "O anexo não fixa limite percentual por fornecedor nem por parte relacionada." },
  },

  contas: {
    contas: [
      { tipo: "captacao", descricao: "Conta Captação, bloqueada, que recebe as doações", abertaPor: "orgao" },
      { tipo: "movimento", descricao: "Conta Movimento, de livre movimentação, só para despesas do projeto", abertaPor: "orgao" },
    ],
    bancos: ["Instituição financeira oficial (na prática, Banco do Brasil)"],
    descricao: "Duas contas por projeto, abertas pelo MS em instituição financeira oficial; a instituição autoriza o banco, de forma irrevogável, a cumprir as ordens do MS.",
    tarifas: {
      regra: "isentas",
      descricao: "A conta é isenta de tarifa, e taxas bancárias, multas e juros são despesas vedadas.",
      fonte: { documento: ANEXO, dispositivo: "art. 66; art. 22, VII" },
    },
    liberacao: {
      descricao: "A execução só começa com 100% captado e o Termo de Compromisso assinado e publicado; de 60% a 99,99%, readequação para menor; abaixo de 60%, indeferimento. Rendimentos não contam.",
      percentualMinimo: 100,
      base: "valor_aprovado_execucao",
      fonte: { documento: ANEXO, dispositivo: "arts. 50, 56, 58, 60, III, e 69, § 3º" },
    },
    rendimentos: {
      aplicacao: "automatica",
      contamComoCaptado: false,
      uso: "Aplicação automática em fundo de baixo risco nas duas contas; uso no objeto com autorização prévia e Termo de Apostilamento; devolvidos com o saldo no fim.",
      fonte: { documento: ANEXO, dispositivo: "arts. 57, 69, §§ 1º a 3º, 71 e 91" },
    },
    saldo: {
      descricao: "Saldo e rendimentos da Conta Movimento devolvidos por GRU em 30 dias improrrogáveis ao término, sob pena de TCE; a Conta Captação é recolhida pela SE.",
      prazo: "devolucaoSaldo",
      fonte: { documento: ANEXO, dispositivo: "art. 60, §§ 1º e 3º; art. 71" },
    },
    regras: [
      { codigo: "captacao_depois_da_publicacao", descricao: "Captação só depois da publicação da aprovação e da notificação de abertura da Conta Captação, dentro do período do ato MF/MS.", severidade: "bloqueio", fonte: { documento: ANEXO, dispositivo: "arts. 39, 47, § 2º, e 48" } },
      { codigo: "doacao_em_bens", descricao: "Doações em bens, comodato ou insumos exigem recibos antes da liberação; insumos de doador PJ, com nota, validade de 12 meses e preço até o orçado.", severidade: "bloqueio", fonte: { documento: ANEXO, dispositivo: "arts. 52 a 56, § 3º" } },
      { codigo: "recibo_por_deposito", descricao: "Recibo por depósito, em 3 vias, com envio ao MS em 20 dias; desde mar/2026 o doador também emite pelo Transferegov.", severidade: "alerta", fonte: { documento: TC, dispositivo: "cl. 2ª, II, c" } },
      { codigo: "captacao_acima", descricao: "Acima de 120% do aprovado, o excedente é desconsiderado e recolhido.", severidade: "alerta", fonte: { documento: TC, dispositivo: "cl. 2ª, subcl. 2ª" } },
      { codigo: "contas_bloqueadas", descricao: "A Conta Captação é bloqueada no fim da captação ou com 100%; as contas são encerradas depois da vigência do Termo.", severidade: "info", fonte: { documento: ANEXO, dispositivo: "art. 47, §§ 3º e 4º" } },
      { codigo: "recursos_publicos", descricao: "Os recursos são públicos, impenhoráveis e não integram o patrimônio da entidade.", severidade: "info", fonte: { documento: ANEXO, dispositivo: "art. 67" } },
      { codigo: "regularidade", descricao: "Regularidade fiscal mantida o tempo todo (CRF/FGTS, CND, CEPIM, CADIN, CNDT); com irregularidade, o MS pode bloquear as contas.", severidade: "alerta", fonte: { documento: ANEXO, dispositivo: "art. 65, §§ 1º e 3º; minuta do TC, cl. 3ª" } },
      { codigo: "aplicacao_pelo_termo", descricao: "A minuta do Termo fala em aplicação a pedido, em fundo de curto prazo; vale a regra do Termo assinado.", severidade: "alerta", fonte: { documento: TC, dispositivo: "cl. 5ª", aConfirmar: true, nota: "Diverge do anexo (arts. 57 e 69)." } },
    ],
    fonte: { documento: ANEXO, dispositivo: "arts. 47 a 69" },
  },

  pagamentos: {
    meiosPermitidos: null,
    meiosVedados: ["saque"],
    descricao: "Qualquer operação bancária autorizada pelo Banco Central que identifique destinação e credor, a partir da Conta Movimento; saque em espécie é vedado.",
    documentoFiscal: [
      { codigo: "em_nome_da_instituicao", descricao: "Comprovantes emitidos exclusivamente em nome da instituição.", severidade: "bloqueio", fonte: { documento: ANEXO, dispositivo: "art. 70" } },
      { codigo: "nup_em_todos", descricao: "Número do processo administrativo (NUP) em todos os comprovantes.", severidade: "bloqueio", fonte: { documento: ANEXO, dispositivo: "art. 70, parágrafo único; minuta do TC, cl. 2ª, II, k" } },
      { codigo: "relacao_de_pagamentos", descricao: "Relação de pagamentos com credor, número da nota e data, conferida com os comprovantes.", severidade: "bloqueio", fonte: { documento: ANEXO, dispositivo: "art. 88, IV" } },
      { codigo: "discriminacao", descricao: "Discriminação de serviços e produtos e nome do projeto no documento, ou declaração do dirigente nele.", severidade: "alerta", fonte: { documento: "Anexo LXXXVI da PRC 5/2017 (revogado)", dispositivo: "art. 95, § 1º", aConfirmar: true, nota: "Exigência do regime anterior, mantida como boa prática." } },
    ],
    regras: [
      { codigo: "conciliacao", descricao: "Cada débito da Conta Movimento casado com um pagamento da relação.", severidade: "bloqueio", fonte: { documento: ANEXO, dispositivo: "art. 88, II" } },
      { codigo: "conta_exclusiva", descricao: "A Conta Movimento serve exclusivamente às despesas do projeto aprovado.", severidade: "bloqueio", fonte: { documento: ANEXO, dispositivo: "art. 68" } },
    ],
    fonte: { documento: ANEXO, dispositivo: "art. 68" },
  },

  despesas: {
    periodo: {
      descricao: "Fato gerador a partir da vigência do Termo de Compromisso (salvo elaboração e captação, ressarcíveis) e até o fim do prazo de execução.",
      fonte: { documento: ANEXO, dispositivo: "art. 22, IX; art. 56, § 1º" },
    },
    vedadas: [
      { codigo: "taxa_administracao", descricao: "Taxa de administração", fonte: { documento: ANEXO, dispositivo: "art. 22, I" } },
      { codigo: "consultoria_de_servidor", descricao: "Pagamento a servidor público por consultoria", fonte: { documento: ANEXO, dispositivo: "art. 22, II" } },
      { codigo: "clube_de_servidores", descricao: "Clubes e associações de servidores", fonte: { documento: ANEXO, dispositivo: "art. 22, III" } },
      { codigo: "vantagem_ao_doador", descricao: "Vantagem ao doador", fonte: { documento: ANEXO, dispositivo: "art. 22, IV" } },
      { codigo: "festas_bufe", descricao: "Festas e bufê, salvo refeições de profissionais e ações educativas", fonte: { documento: ANEXO, dispositivo: "art. 22, V" } },
      { codigo: "primeira_classe", descricao: "Passagem de primeira classe ou executiva", fonte: { documento: ANEXO, dispositivo: "art. 22, VI" } },
      { codigo: "taxas_multas_juros", descricao: "Taxas bancárias, multas, juros e correção", fonte: { documento: ANEXO, dispositivo: "art. 22, VII" } },
      { codigo: "acao_ja_no_sus", descricao: "Ações médico-assistenciais que a instituição já executa pelo SUS", fonte: { documento: ANEXO, dispositivo: "art. 22, VIII; art. 24" } },
      { codigo: "antes_do_termo", descricao: "Fato gerador anterior à vigência do Termo, salvo elaboração e captação", fonte: { documento: ANEXO, dispositivo: "art. 22, IX" } },
      { codigo: "custeio_duplo", descricao: "Despesa já custeada por outro instrumento", fonte: { documento: ANEXO, dispositivo: "art. 22, X" } },
      { codigo: "obras", descricao: "Obras, reformas, ampliações e construções", fonte: { documento: ANEXO, dispositivo: "art. 26" } },
      { codigo: "compra_centralizada", descricao: "Medicamentos de compra centralizada pelo MS", fonte: { documento: ANEXO, dispositivo: "art. 30, § 3º" } },
      { codigo: "procedimentos_com_equipamentos", descricao: "Custear os procedimentos feitos com os equipamentos adquiridos (salvo o previsto no edital)", fonte: { documento: EDITAL, dispositivo: "item 7.4.13" } },
    ],
    regras: [
      { codigo: "encargos_da_instituicao", descricao: "Encargos trabalhistas da equipe são responsabilidade exclusiva da instituição, sem vínculo com a administração.", severidade: "info", fonte: { documento: ANEXO, dispositivo: "arts. 19 e 20, § 2º" } },
      { codigo: "sem_sobreposicao_sus", descricao: "Metas e produção não repetem o que é contratado pelo SUS ou usado para o CEBAS.", severidade: "alerta", fonte: { documento: ANEXO, dispositivo: "art. 24" } },
    ],
    fonte: { documento: ANEXO, dispositivo: "arts. 21 a 31" },
  },

  porte: {
    lacuna: "nao_se_aplica",
    motivo: "O anexo não classifica projetos por porte: a análise é por resultados, e o financeiro só é examinado quando uma meta falha ou por amostragem.",
    fonte: { documento: ANEXO, dispositivo: "art. 81, § 3º; art. 88" },
  },

  objeto: {
    descricao: "Análise por resultados: documentos do plano, resultados esperados × atingidos, metas do período × resultados, ações, comprovantes do objeto, satisfação do público e sustentabilidade; produção médico-assistencial registrada só no CMD.",
    regras: [
      { codigo: "metas_resultados", descricao: "Resultados esperados × atingidos e metas do período × resultados, com justificativa das metas não cumpridas.", severidade: "bloqueio", fonte: { documento: ANEXO, dispositivo: "art. 87, II, III e VII" } },
      { codigo: "evidencias", descricao: "Comprovantes do objeto: listas de presença, fotos e vídeos.", severidade: "bloqueio", fonte: { documento: ANEXO, dispositivo: "art. 87, V" } },
      { codigo: "docentes", descricao: "Em projetos de educação, relação de docentes e lista nominal dos profissionais qualificados, assinada pelo coordenador e pelo dirigente.", severidade: "alerta", fonte: { documento: ANEXO, dispositivo: "art. 87, VI" } },
      { codigo: "satisfacao", descricao: "Pesquisa de satisfação do público-alvo ou declaração de entidade local ou do conselho de saúde.", severidade: "alerta", fonte: { documento: ANEXO, dispositivo: "art. 79, § 4º; art. 87, IX" } },
      { codigo: "sustentabilidade", descricao: "Sustentabilidade, quando a instituição fica com os bens.", severidade: "alerta", fonte: { documento: ANEXO, dispositivo: "art. 87, X" } },
      { codigo: "cmd", descricao: "Produção médico-assistencial registrada exclusivamente no CMD, sem registro em outros sistemas do MS.", severidade: "bloqueio", fonte: { documento: ANEXO, dispositivo: "art. 74, § 2º; Portaria GM/MS 8.031/2025, art. 3º" } },
      { codigo: "pesquisa_autorizada", descricao: "Pesquisa com aprovação de CEP, Anvisa e CTNBio antes de começar.", severidade: "bloqueio", fonte: { documento: ANEXO, dispositivo: "art. 17, § 1º, VIII" } },
      { codigo: "insumos_remanescentes", descricao: "Insumos não usados vão ao ente que deu a anuência; para mantê-los, pedir ao gestor 30 dias antes do fim.", severidade: "alerta", parametros: { diasAntes: 30 }, fonte: { documento: ANEXO, dispositivo: "art. 54" } },
      { codigo: "bens_permanentes", descricao: "Equipamentos e material permanente com identificação do projeto, inventário e destino no fim.", severidade: "alerta", fonte: { documento: ANEXO, dispositivo: "art. 80; minuta do TC, documento XI" } },
      { codigo: "dados_de_pacientes", descricao: "Dados de saúde são sensíveis: sem prontuário no sistema, dados criptografados e destruídos ou devolvidos a pedido do MS.", severidade: "alerta", fonte: { documento: TC, dispositivo: "cl. 8ª" } },
      { codigo: "contrapartida", descricao: "Contrapartida é facultativa; em bens e serviços, com valor identificado no Termo.", severidade: "info", fonte: { documento: ANEXO, dispositivo: "art. 14, § 5º" } },
    ],
    fonte: { documento: ANEXO, dispositivo: "arts. 74, 79 e 87" },
  },

  divulgacao: {
    marcas: ["Ministério da Saúde"],
    aprovacaoPrevia: {
      exigida: false,
      prazo: null,
      silencioAprova: false,
      descricao: "Nem o anexo nem a minuta do Termo exigem aprovação prévia das peças; o material leva o logotipo e a menção ao MS.",
      fonte: { documento: TC, dispositivo: "cl. 2ª, II, s e t", aConfirmar: true },
    },
    defeso: null,
    regras: [
      { codigo: "logotipo_do_ms", descricao: "Material de comunicação com o logotipo e a menção ao Ministério da Saúde.", severidade: "alerta", fonte: { documento: TC, dispositivo: "cl. 2ª, II, s e t" } },
      { codigo: "sem_marca_de_doador", descricao: "Exposição de material publicitário dos doadores pela instituição ou pelos usuários é vantagem indevida.", severidade: "bloqueio", fonte: { documento: ANEXO, dispositivo: "art. 96, parágrafo único" } },
      { codigo: "patrocinio_promocional", descricao: "Patrocínio com finalidade promocional depende de ato do Ministro, ainda não publicado.", severidade: "info", fonte: { documento: ANEXO, dispositivo: "art. 100" } },
    ],
    fonte: { documento: ANEXO, dispositivo: "art. 96; minuta do TC, cl. 2ª" },
  },

  envio: {
    sistema: "Transferegov",
    descricao: "Prestação anual e final pelo Transferegov, com o relatório de execução financeira extraído do sistema e o parecer de auditoria independente; o Manual Orientativo com os modelos ainda não foi publicado.",
    documentos: [
      { codigo: "relatorio_objeto", descricao: "Relatório de cumprimento do objeto (execução do objeto)", em: ["parcial", "final"], obrigatorio: true, fonte: { documento: ANEXO, dispositivo: "art. 81; minuta do TC, cl. 6ª, I" } },
      { codigo: "relatorio_financeiro", descricao: "Relatório de execução financeira (extraído do Transferegov)", em: ["parcial", "final"], obrigatorio: true, fonte: { documento: ANEXO, dispositivo: "arts. 81 e 88" } },
      { codigo: "auditoria", descricao: "Demonstrações contábeis e financeiras com parecer conclusivo de auditoria independente (CRC)", em: ["parcial", "final"], obrigatorio: true, fonte: { documento: ANEXO, dispositivo: "art. 88, III; Decreto 7.988/2013, art. 22, parágrafo único" } },
      { codigo: "fisico_financeiro", descricao: "Relatório final de execução físico-financeira", em: ["final"], obrigatorio: true, fonte: { documento: TC, dispositivo: "cl. 6ª, subcl. 5ª, II" } },
      { codigo: "receitas_despesas", descricao: "Relatório de execução de receitas e despesas", em: ["final"], obrigatorio: true, fonte: { documento: TC, dispositivo: "cl. 6ª, subcl. 5ª, III" } },
      { codigo: "relacao_pagamentos", descricao: "Relação de pagamentos", em: ["final"], obrigatorio: true, fonte: { documento: TC, dispositivo: "cl. 6ª, subcl. 5ª, IV" } },
      { codigo: "extrato", descricao: "Extrato da conta, do recebimento ao último pagamento", em: ["final"], obrigatorio: true, fonte: { documento: TC, dispositivo: "cl. 6ª, subcl. 5ª, V" } },
      { codigo: "rendimentos", descricao: "Demonstrativo de rendimentos", em: ["final"], obrigatorio: true, fonte: { documento: TC, dispositivo: "cl. 6ª, subcl. 5ª, VI" } },
      { codigo: "gru", descricao: "Comprovante de GRU do saldo", em: ["final"], obrigatorio: true, fonte: { documento: TC, dispositivo: "cl. 6ª, subcl. 5ª, VII; Anexo LXXXVI-A, art. 60, § 2º" } },
      { codigo: "comprovantes_despesa", descricao: "Cópias dos comprovantes de despesa", em: ["final"], obrigatorio: true, fonte: { documento: TC, dispositivo: "cl. 6ª, subcl. 5ª, VIII" } },
      { codigo: "bens", descricao: "Relação de bens adquiridos ou produzidos", em: ["final"], obrigatorio: true, fonte: { documento: TC, dispositivo: "cl. 6ª, subcl. 5ª, IX" } },
      { codigo: "fotos", descricao: "Fotografias e reportagens", em: ["final"], obrigatorio: true, fonte: { documento: TC, dispositivo: "cl. 6ª, subcl. 5ª, X" } },
      { codigo: "equipamentos", descricao: "Relação de equipamentos e materiais permanentes, com identificação do projeto e inventário físico", em: ["final"], obrigatorio: true, fonte: { documento: TC, dispositivo: "cl. 6ª, subcl. 5ª, XI" } },
      { codigo: "cmd", descricao: "Informações lançadas no CMD", em: ["final"], obrigatorio: true, fonte: { documento: TC, dispositivo: "cl. 6ª, subcl. 5ª, XII" } },
      { codigo: "encerramento_conta", descricao: "Comprovante de encerramento da Conta Movimento", em: ["final"], obrigatorio: true, fonte: { documento: TC, dispositivo: "cl. 6ª, subcl. 5ª, XIII" } },
      { codigo: "doacao_de_insumos", descricao: "Documentação da doação de insumos remanescentes", em: ["final"], obrigatorio: false, fonte: { documento: ANEXO, dispositivo: "art. 54, § 1º" } },
    ],
    modelos: [],
    regras: [
      { codigo: "manual_nao_publicado", descricao: "O Manual Orientativo, com os modelos, não foi publicado até 01/10/2026; seguir o anexo, a minuta do Termo e os atos SE/MS.", severidade: "info", fonte: { documento: PORTARIA, dispositivo: "art. 2º" } },
      { codigo: "impropriedades_registradas", descricao: "Impropriedades que levam à rejeição ficam registradas no Transferegov e pesam em parcerias futuras.", severidade: "info", fonte: { documento: ANEXO, dispositivo: "art. 81, § 2º" } },
    ],
    fonte: { documento: ANEXO, dispositivo: "arts. 81, 85, 87 e 88" },
  },

  posEnvio: {
    resultados: [
      { resultado: "aprovada", descricao: "Objeto e metas cumpridos integralmente.", fonte: { documento: ANEXO, dispositivo: "art. 84" } },
      { resultado: "aprovada_ressalvas", descricao: "Objeto e metas cumpridos, com impropriedade ou falta formal sem dano ao erário.", fonte: { documento: ANEXO, dispositivo: "art. 84" } },
      { resultado: "reprovada", descricao: "Omissão, descumprimento injustificado de objetivos ou metas, dano por ato de gestão ilegítimo ou antieconômico, desfalque ou desvio.", fonte: { documento: ANEXO, dispositivo: "art. 84" } },
    ],
    devolucao: {
      descricao: "GRU para a Conta Única do Tesouro, sem prejuízo ao benefício fiscal do doador: 30 dias da notificação; no término, 30 dias improrrogáveis sob pena de TCE; na aprovação com ressalva por execução parcial, remanescente e rendimentos em 30 dias.",
      atualizacao: "Na reprovação, índice oficial da poupança desde a captação.",
      gru: [],
      fonte: { documento: ANEXO, dispositivo: "arts. 60, 71, 90 e 91" },
    },
    regras: [
      { codigo: "analise_por_resultados", descricao: "O financeiro só é examinado quando uma meta não é cumprida ou por amostragem da secretaria finalística.", severidade: "info", fonte: { documento: ANEXO, dispositivo: "art. 81, § 3º; art. 88" } },
      { codigo: "diligencia_por_email", descricao: "Diligência por e-mail com 15 dias, que suspende o prazo do MS; o silêncio pode levar à reprovação.", severidade: "alerta", fonte: { documento: ANEXO, dispositivo: "art. 86, §§ 2º e 3º" } },
      { codigo: "inabilitacao", descricao: "Inabilitação por até 3 anos, inclusive por prestação anual ou final não apresentada, final reprovada nos últimos 24 meses ou diligência sem resposta.", severidade: "alerta", parametros: { anos: 3 }, fonte: { documento: ANEXO, dispositivo: "arts. 97 e 98, XI" } },
      { codigo: "tce", descricao: "TCE por não aplicação ou aplicação incorreta, inclusive antes do fim da parceria, com registro no SIAFI.", severidade: "info", fonte: { documento: ANEXO, dispositivo: "arts. 76, § 1º, 81, § 1º, 92 e 93" } },
      { codigo: "omissao_sanavel", descricao: "A omissão pode ser sanada até o julgamento da TCE.", severidade: "info", fonte: { documento: ANEXO, dispositivo: "art. 87, § 2º" } },
      { codigo: "rescisao", descricao: "Na rescisão do Termo, restituição integral com atualização, inclusive em aprovação com ressalvas.", severidade: "alerta", fonte: { documento: TC, dispositivo: "cl. 12ª", aConfirmar: true, nota: "Redação mais dura que a do anexo." } },
    ],
    fonte: { documento: ANEXO, dispositivo: "arts. 81 a 95" },
  },

  guarda: {
    marco: "registro_decisao",
    quantidade: 5,
    unidade: "anos",
    prorrogaParaDiaUtil: false,
    descricao: "Originais na sede, à disposição do MS e dos órgãos de controle, por no mínimo 5 anos depois da aprovação da prestação de contas.",
    fonte: { documento: TC, dispositivo: "cl. 6ª, subcl. 6ª; cl. 2ª, II, u", nota: "O anexo não trata da guarda; vale o prazo mais longo do Termo." },
  },
} satisfies RegimeNormativo;
