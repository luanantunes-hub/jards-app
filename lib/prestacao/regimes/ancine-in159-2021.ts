// Audiovisual (ANCINE): IN ANCINE 159/2021 (prestação de contas), com as
// alterações das INs 160/2022, 164/2022, 167/2023 e 176/2026, a IN 158/2021
// (aprovação e acompanhamento) e a IN 130/2016 com a IN 152/2020 (logomarca).
// Fontes: docs/acoes-futuras/estudos/prestacao-de-contas-fontes/
// ancine-oficial-str-logomarca.md (texto da IN, modelos do STR, manual de
// logomarca) e ancine-manual-pc-v2.11-e-lie-divulgacao.md (Manual de
// Prestação de Contas v2.11, de 23/09/2026).
//
// Vale para fomento indireto e direto geridos pela ANCINE. No FSA, edital e
// contrato mandam, e a IN 159 vale de forma subsidiária.

import type { RegimeNormativo } from "./tipos";

const IN159 = "IN ANCINE 159/2021";
const IN158 = "IN ANCINE 158/2021";
const IN130 = "IN ANCINE 130/2016, com a IN 152/2020";
const MANUAL = "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)";
const STR = "Manual STR – Planilhas v2.2 (30/09/2025)";
const DOCS_FISCAIS = "Manual de Envio de Documentos Fiscais – STR (04/05/2021)";
const LOGOMARCA = "Manual de Aplicação da Logomarca v3.0 (24/08/2022)";
const BRDE = "Guia de Acompanhamento de Projetos do FSA (BRDE, jan/2025)";

export const ANCINE_IN159_2021 = {
  codigo: "ancine_in159_2021",
  versao: 1,
  nome: "Audiovisual (ANCINE) — IN 159/2021",
  area: "audiovisual",
  mecanismo: "audiovisual",
  esfera: "federal",
  orgao: "ANCINE",
  sistemaOficial: "STR e Protocolo Digital",
  normaReferencia: "Lei 8.685/1993; Lei 8.313/1991, arts. 18 e 25; MP 2.228-1/2001; IN ANCINE 159/2021 (alterada pelas INs 160, 164, 167 e 176); IN ANCINE 158/2021; IN ANCINE 130/2016",
  vigenteDesde: "2022-01-17",
  identificadorOficial: { tipo: "salic", rotulo: "SALIC" },
  fontes: [
    { documento: "IN ANCINE 159/2021 (consolidada)", url: "https://www.gov.br/ancine/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-159" },
    { documento: "IN ANCINE 176/2026", url: "https://www.gov.br/ancine/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-176" },
    { documento: "Manuais de prestação de contas (ANCINE)", url: "https://www.gov.br/ancine/pt-br/assuntos/atribuicoes-ancine/fomento/prestacao-de-contas/manuais" },
    { documento: "Manual STR v2.2", url: "https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/ManualdoSTRVerso2.2v_30_09_2025.pdf/@@display-file/file" },
    { documento: "Manual de Aplicação da Logomarca v3.0", url: "https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/ManualdeAplicacaodeLogomarcav.0324agosto22.pdf/@@display-file/file" },
    { documento: "FAQ da Superintendência de Prestação de Contas", url: "https://www.gov.br/ancine/pt-br/acesso-a-informacao/perguntas-frequentes1/superintendencia-de-prestacao-de-contas-spr" },
  ],

  aplicabilidade: {
    criterio: "aprovacao_projeto",
    desde: "2022-01-17",
    ate: null,
    descricao: "Projetos aprovados a partir de 17/01/2022; no fomento direto sem aprovação inicial, marco inicial de despesas a partir dessa data. Antes, IN 150/2019 e IN 125/2015. No FSA, edital e contrato, com a IN 159 subsidiária.",
    sucede: ["ancine_in150_2019"],
    fonte: { documento: IN159, dispositivo: "art. 63; Manual de Prestação de Contas v2.11, p. 4", nota: "FSA: IN 159, art. 57, e FAQ SPR 1.3." },
  },

  prazos: {
    prestacaoFinal: {
      descricao: "Prestação de contas final, contada da conclusão do objeto (CPB, lançamento comercial, último dia do festival ou entrega do desenvolvimento)",
      responsavel: "proponente",
      marco: "conclusao_objeto",
      quantidade: 180,
      unidade: "dias_corridos",
      fonte: {
        documento: IN159,
        dispositivo: "arts. 3º a 5º",
        nota: "Se a 1ª liberação for posterior à conclusão, conta da liberação. Vários processos do mesmo objeto: vale o último prazo, com uma prestação por processo. No FSA, o prazo do contrato.",
      },
    },
    fimExecucaoFinanceira: {
      descricao: "Última despesa do projeto (fim da execução financeira)",
      responsavel: "proponente",
      marco: "conclusao_objeto",
      quantidade: 180,
      unidade: "dias_corridos",
      fonte: { documento: IN158, dispositivo: "art. 57; FAQ SPR 2.10" },
    },
    respostaDiligencia: {
      descricao: "Atender diligência, da confirmação de recebimento; prorrogável uma vez por 30 dias a pedido justificado",
      responsavel: "proponente",
      marco: "ciencia_diligencia",
      quantidade: 30,
      unidade: "dias_corridos",
      fonte: { documento: IN159, dispositivo: "art. 45 e § 3º", nota: "Omissão leva a inadimplência; mais 30 dias sem saneamento, a proposta de não aprovação." },
    },
    notificacaoOmissao: {
      descricao: "Apresentar a prestação omitida depois da notificação, sob pena de TCE ou cobrança",
      responsavel: "proponente",
      marco: "ciencia_diligencia",
      quantidade: 30,
      unidade: "dias_corridos",
      fonte: { documento: IN159, dispositivo: "art. 6º" },
    },
    analisePrestacao: {
      lacuna: "norma_silente",
      motivo: "A IN 159 não fixa prazo para a ANCINE analisar a prestação; o de 90 dias da IN 158 vale para os pedidos de acompanhamento.",
      fonte: { documento: IN159, dispositivo: "texto integral; FAQ SPR" },
    },
    analiseAcompanhamento: {
      descricao: "Análise de pedido de acompanhamento (remanejamento, prorrogação), interrompida por diligência",
      responsavel: "orgao",
      marco: "protocolo_alteracao",
      quantidade: 90,
      unidade: "dias_corridos",
      fonte: { documento: IN158, dispositivo: "art. 3º, II e § 3º" },
    },
    recurso: {
      descricao: "Recurso com efeito suspensivo, do recebimento da notificação; última instância é a Diretoria Colegiada",
      responsavel: "proponente",
      marco: "ciencia_decisao",
      quantidade: 30,
      unidade: "dias_corridos",
      fonte: { documento: IN159, dispositivo: "arts. 48 a 50" },
    },
    devolucao: {
      descricao: "Pagar a GRU da glosa ou do débito, calculada pela ANCINE",
      responsavel: "proponente",
      marco: "ciencia_decisao",
      quantidade: 30,
      unidade: "dias_corridos",
      fonte: { documento: MANUAL, dispositivo: "p. 69; IN 159, arts. 31 e 32", nota: "Sem pagamento, recurso ou parcelamento, a prestação é não aprovada e incide multa." },
    },
    correcaoLogomarcaInfraestrutura: {
      descricao: "Corrigir a placa de infraestrutura depois da decisão",
      responsavel: "proponente",
      marco: "ciencia_decisao",
      quantidade: 30,
      unidade: "dias_corridos",
      fonte: { documento: IN130, dispositivo: "art. 9º" },
    },
  },

  prestacaoParcial: {
    modalidades: ["a_criterio_do_orgao"],
    descricao: "A ANCINE pode pedir prestação parcial conforme o regramento (avaliação da execução parcial da IN 158): documentos do Anexo sem os incisos IV e V e extratos da abertura até a data da prestação. Despesas aprovadas na parcial podem ser reanalisadas na final.",
    prazo: null,
    regras: [
      { codigo: "sem_gru_nem_encerramento", descricao: "A parcial dispensa os comprovantes de recolhimento e de encerramento das contas.", severidade: "info", fonte: { documento: IN159, dispositivo: "Anexo, art. 2º, § 3º" } },
      { codigo: "extratos_ate_a_data", descricao: "Na parcial, os extratos vão da abertura da conta até a data da prestação.", severidade: "alerta", fonte: { documento: MANUAL, dispositivo: "p. 18, nota 3" } },
      { codigo: "reanalise_na_final", descricao: "Despesas aprovadas na parcial podem ser reanalisadas na final.", severidade: "info", fonte: { documento: IN159, dispositivo: "arts. 54 a 56" } },
      { codigo: "fsa_especial", descricao: "A prestação especial do contrato FSA segue as regras da parcial.", severidade: "info", fonte: { documento: IN159, dispositivo: "art. 57" } },
    ],
    fonte: { documento: IN159, dispositivo: "arts. 54 a 57" },
  },

  orcamento: {
    estrutura: {
      niveis: ["Item orçamentário (IV.a e IV.b do DO)", "Item"],
      descricao: "Orçamento analítico aprovado por item; o DO compara o aprovado com o captado por fonte e com o executado. Tributos retidos e encargos entram na rubrica do fato gerador.",
      fonte: { documento: MANUAL, dispositivo: "p. 12 e 60; Demonstrativo Orçamentário e Financeiro, seção IV" },
    },
    grupos: [
      { codigo: "execucao", rotulo: "Itens do projeto", descricao: "Itens financiáveis de desenvolvimento, produção, distribuição ou da modalidade.", fonte: { documento: IN158, dispositivo: "art. 31" } },
      { codigo: "gerenciamento", rotulo: "Gerenciamento", descricao: "Gerenciamento da produção, com toda a infraestrutura; só produtora brasileira.", fonte: { documento: IN158, dispositivo: "art. 31, I" } },
      { codigo: "agenciamento", rotulo: "Agenciamento", descricao: "Agenciamento de captação pela Lei 8.313 e pelo art. 1º-A da Lei 8.685.", fonte: { documento: IN158, dispositivo: "art. 31, II" } },
      { codigo: "colocacao", rotulo: "Coordenação e colocação", descricao: "Coordenação e colocação de certificados do art. 1º da Lei 8.685 (taxas, prospecto, agente divulgador).", fonte: { documento: IN158, dispositivo: "art. 31, III" } },
    ],
    bases: {
      orcamento_producao: {
        descricao: "Orçamento de produção: os itens do projeto, sem gerenciamento, agenciamento e colocação.",
        soma: "todos",
        exceto: ["gerenciamento", "agenciamento", "colocacao"],
        fonte: { documento: IN158, dispositivo: "art. 31, I", aConfirmar: true, nota: "A fonte não detalha o que entra no orçamento de produção; o limite também se prende ao executado com recursos ANCINE." },
      },
      valor_total_projeto: {
        descricao: "Orçamento global aprovado.",
        soma: "todos",
        exceto: [],
        fonte: { documento: MANUAL, dispositivo: "p. 27–28" },
      },
    },
    tetos: [
      {
        codigo: "gerenciamento",
        descricao: "Gerenciamento",
        grupos: ["gerenciamento"],
        percentual: 10,
        base: "orcamento_producao",
        severidade: "bloqueio",
        fonte: { documento: IN158, dispositivo: "art. 31, I; Lei 11.437/2006, art. 12", nota: "Limitado ao executado com recursos ANCINE; na coprodução internacional, só a parte brasileira. O excesso é glosado (IN 159, art. 18, VI)." },
      },
      {
        codigo: "agenciamento",
        descricao: "Agenciamento",
        grupos: ["agenciamento"],
        percentual: 10,
        base: "valor_autorizado_captacao",
        proporcionalAoCaptado: true,
        severidade: "bloqueio",
        fonte: { documento: IN158, dispositivo: "art. 31, II", nota: "Proporcional ao captado: R$ 100 mil autorizados e R$ 80 mil captados dão teto de R$ 8 mil." },
      },
      {
        codigo: "colocacao",
        descricao: "Coordenação e colocação",
        grupos: ["colocacao"],
        percentual: 10,
        base: "valor_autorizado_captacao",
        proporcionalAoCaptado: true,
        severidade: "bloqueio",
        fonte: { documento: IN158, dispositivo: "art. 31, III", nota: "Sobre o autorizado pelo art. 1º da Lei 8.685, limitado ao captado." },
      },
    ],
    regras: [
      {
        codigo: "contrapartida_minima",
        descricao: "Contrapartida de ao menos 5% do orçamento global aprovado quando há mecanismo da Lei do Audiovisual (ou 5% das fontes brasileiras integralizadas, se menor).",
        severidade: "bloqueio",
        parametros: { percentual: 5 },
        fonte: { documento: "Lei 8.685/1993", dispositivo: "art. 4º, § 2º, I; IN 159, art. 16, § 1º" },
      },
      { codigo: "agenciamento_vedado", descricao: "Agenciamento vedado em editais, FSA, programas internacionais e seleções de estatais, e a proponente, coprodutores, grupo econômico ou sócios.", severidade: "bloqueio", fonte: { documento: IN159, dispositivo: "art. 18, IV" } },
      { codigo: "colocacao_autorizada", descricao: "Coordenação e colocação só por agente autorizado na CVM e para o art. 1º da Lei 8.685.", severidade: "bloqueio", fonte: { documento: IN159, dispositivo: "art. 18, V" } },
      { codigo: "gerenciamento_por_quem", descricao: "Gerenciamento não pode ser pago a radiodifusoras, programadoras, distribuidoras ou telefônicas.", severidade: "bloqueio", fonte: { documento: IN159, dispositivo: "art. 18, XIX" } },
    ],
  },

  alteracoes: {
    janela: {
      aPartirDe: null,
      ate: "fim_execucao",
      descricao: "Durante a execução; o pedido prévio vai à Superintendência de Fomento (SFO).",
      fonte: { documento: MANUAL, dispositivo: "p. 27–28" },
    },
    tipos: {
      remanejamento: {
        permitido: true,
        classificacao: "administrativa",
        condicoes: [
          {
            tipo: "movido_ate",
            percentual: 20,
            base: "valor_total_projeto",
            acumulado: true,
            descricao: "O conjunto de alterações (extrapolações mais rubricas novas) fica abaixo de 20% do orçamento global aprovado.",
            fonte: { documento: MANUAL, dispositivo: "p. 27–28", nota: "Vale para projetos fora dos limites de grandes itens da IN 158 (arts. 49 e 50)." },
          },
        ],
        requisitos: [
          { tipo: "tetos", severidade: "bloqueio", descricao: "Gerenciamento, agenciamento e colocação continuam dentro dos limites.", fonte: { documento: IN159, dispositivo: "art. 18, VI" } },
        ],
        orientacoes: [
          { codigo: "justificar_na_pc", descricao: "Toda alteração é justificada na prestação, mesmo abaixo de 20%; nada é aprovado automaticamente e a não acatada é glosada.", severidade: "alerta", fonte: { documento: IN159, dispositivo: "art. 20; Manual v2.11, p. 20 e 28" } },
          { codigo: "aporte_nao_financeiro", descricao: "Itens comprovados com aporte não financeiro de terceiros para a captação mínima não são remanejados nem pagos com recursos ANCINE.", severidade: "bloqueio", fonte: { documento: IN159, dispositivo: "art. 18, XXXII" } },
        ],
        fonte: { documento: MANUAL, dispositivo: "p. 27–28" },
      },
      complementacao: {
        permitido: true,
        classificacao: "formal",
        condicoes: [],
        requisitos: [
          { tipo: "tetos", severidade: "bloqueio", descricao: "O redimensionamento respeita os limites.", fonte: { documento: IN159, dispositivo: "art. 18, VI" } },
        ],
        orientacoes: [],
        fonte: { documento: BRDE, dispositivo: "§ 4.10; IN 158, arts. 49 e 50", aConfirmar: true, nota: "Redimensionamento do orçamento depende de aprovação prévia; o texto da IN 158 não foi lido." },
      },
      reducao: {
        permitido: true,
        classificacao: "formal",
        condicoes: [],
        requisitos: [
          { tipo: "tetos", severidade: "alerta", descricao: "Depois da redução, os grupos continuam dentro dos limites.", fonte: { documento: IN159, dispositivo: "art. 18, VI" } },
        ],
        orientacoes: [],
        fonte: { documento: BRDE, dispositivo: "§ 4.10; IN 158, arts. 49 e 50", aConfirmar: true, nota: "Redimensionamento do orçamento depende de aprovação prévia; o texto da IN 158 não foi lido." },
      },
      inclusao: {
        permitido: true,
        classificacao: "administrativa",
        condicoes: [
          {
            tipo: "movido_ate",
            percentual: 20,
            base: "valor_total_projeto",
            acumulado: true,
            descricao: "Rubricas novas e extrapolações, somadas, ficam abaixo de 20% do orçamento global aprovado.",
            fonte: { documento: MANUAL, dispositivo: "p. 27–28" },
          },
        ],
        requisitos: [
          { tipo: "tetos", severidade: "bloqueio", descricao: "Com a rubrica nova, os limites continuam respeitados.", fonte: { documento: IN159, dispositivo: "art. 18, VI" } },
        ],
        orientacoes: [
          { codigo: "justificar_na_pc", descricao: "A rubrica nova é justificada na prestação; a não acatada é glosada.", severidade: "alerta", fonte: { documento: IN159, dispositivo: "art. 20" } },
        ],
        fonte: { documento: MANUAL, dispositivo: "p. 27–28" },
      },
    },
    alertasPorItem: [],
    prazoAnalise: "analiseAcompanhamento",
    silencioAprova: false,
    regras: [
      { codigo: "projeto_tecnico", descricao: "Alterar o projeto técnico sem autorização prévia leva a inabilitação.", severidade: "bloqueio", fonte: { documento: IN159, dispositivo: "art. 28, X; art. 42, II" } },
      { codigo: "fsa", descricao: "No FSA: abaixo de 20%, sem aprovação prévia e justificado na prestação; acima ou redimensionamento, pela CUP (grandes itens) ou protocolo digital (orçamento detalhado).", severidade: "info", fonte: { documento: BRDE, dispositivo: "§ 4.10" } },
    ],
    fonte: { documento: MANUAL, dispositivo: "p. 20 e 27–28" },
  },

  fornecedores: {
    limites: [
      {
        codigo: "concentracao",
        descricao: "Concentração em um mesmo fornecedor ou grupo, somando as RPs de todos os processos da mesma obra e objeto (produção)",
        escopo: "fornecedor",
        base: "valor_executado",
        faixas: [
          { percentual: 25, severidade: "alerta", consequencia: "Advertência e aprovação com ressalvas" },
          { percentual: 50, severidade: "bloqueio", consequencia: "Inabilitação por até 2 anos" },
        ],
        excecoes: [
          { descricao: "Animação", fonte: { documento: IN159, dispositivo: "art. 28, VI" } },
          { descricao: "Jogos eletrônicos", fonte: { documento: IN159, dispositivo: "art. 28, VI" } },
          { descricao: "Orçamento abaixo de R$ 500 mil", fonte: { documento: IN159, dispositivo: "art. 28, VI" } },
        ],
        fonte: { documento: IN159, dispositivo: "art. 28, VI; art. 42" },
      },
    ],
    partesRelacionadas: {
      descricao: "Agenciamento não é pago à proponente, a coprodutores, a empresas com sócios em comum ou do mesmo grupo; bens da proponente, do grupo ou do coprodutor exigem 3 orçamentos de fora do grupo e pagamento até o menor.",
      fonte: { documento: IN159, dispositivo: "art. 18, IV, c; Manual v2.11, p. 56" },
    },
    regras: [
      { codigo: "cnae_compativel", descricao: "Prestador com objeto social ou CNAE compatível com o serviço.", severidade: "alerta", fonte: { documento: MANUAL, dispositivo: "p. 26" } },
      { codigo: "vinculo_com_emitente", descricao: "Quem presta o serviço tem vínculo societário ou empregatício com a empresa que emite a nota.", severidade: "bloqueio", fonte: { documento: IN159, dispositivo: "art. 18, XXVI" } },
      { codigo: "agente_de_artista", descricao: "Agente de artista não é pago com recursos do projeto; o artista emite RPA ou nota.", severidade: "bloqueio", fonte: { documento: MANUAL, dispositivo: "p. 26–27" } },
      { codigo: "reincidencia", descricao: "Reincidência na mesma regra, em outro projeto, leva a inabilitação.", severidade: "alerta", fonte: { documento: IN159, dispositivo: "art. 42, II" } },
    ],
    fonte: { documento: IN159, dispositivo: "arts. 18, 28 e 42" },
  },

  contas: {
    contas: [
      { tipo: "captacao", descricao: "Conta de captação, do proponente, só para incentivos fiscais (fomento indireto)", abertaPor: "orgao" },
      { tipo: "movimento", descricao: "Conta de movimentação, exclusiva do projeto, conforme o orçamento aprovado", abertaPor: "orgao" },
      { tipo: "recolhimento", descricao: "Conta de recolhimento do investidor (arts. 3º e 3º-A da Lei 8.685; art. 39, X, da MP 2.228-1)", abertaPor: "orgao" },
      { tipo: "aplicacao", descricao: "Aplicação financeira vinculada", abertaPor: "orgao" },
    ],
    bancos: ["Banco do Brasil"],
    descricao: "Contas abertas exclusivamente pela ANCINE no Banco do Brasil; os recursos ficam indisponíveis até a ANCINE autorizar a liberação; fomento direto e FSA não têm conta de captação.",
    tarifas: {
      regra: "so_manutencao",
      descricao: "Tarifas bancárias são glosadas, salvo a de manutenção da conta; a proponente cobre as tarifas antes da incidência ou no mesmo mês.",
      fonte: { documento: IN159, dispositivo: "art. 18, VII (red. IN 167/2023); Manual v2.11, p. 24–25" },
    },
    liberacao: {
      descricao: "Os recursos de captação e os reservados de fomento direto ficam indisponíveis até a ANCINE autorizar a liberação.",
      percentualMinimo: null,
      base: null,
      fonte: { documento: MANUAL, dispositivo: "p. 22" },
    },
    rendimentos: {
      aplicacao: "automatica",
      contamComoCaptado: null,
      uso: "Aplicação automática pelo convênio ANCINE–BB; os rendimentos são aporte complementar, sujeitos às mesmas regras, e entram no total a comprovar do STR.",
      fonte: { documento: MANUAL, dispositivo: "p. 25; Manual STR v2.2, § 5.3.3" },
    },
    saldo: {
      descricao: "O saldo da captação é recolhido pela ANCINE; o da movimentação e das aplicações, pela proponente, por GRU, com saldo final zero e comprovante de encerramento das contas abertas pela proponente.",
      prazo: null,
      fonte: { documento: MANUAL, dispositivo: "p. 14 e 18; IN 159, Anexo, art. 1º, IV e V" },
    },
    regras: [
      { codigo: "sem_outras_contas", descricao: "É proibido transferir recursos para outras contas, mesmo administrativas, salvo as hipóteses de reembolso.", severidade: "bloqueio", fonte: { documento: IN159, dispositivo: "art. 18, XXX; Manual v2.11, p. 23" } },
      { codigo: "creditos_permitidos", descricao: "A movimentação só recebe liberação da captação ou conta bloqueada, resgate de aplicação e depósitos próprios ou de terceiros para pagar o projeto.", severidade: "alerta", fonte: { documento: MANUAL, dispositivo: "p. 23" } },
      { codigo: "emprestimo_e_ressarcimento", descricao: "Recurso próprio depositado antes da liberação é ressarcido da mesma conta de movimentação; no DE, em OUTROS DEPÓSITOS e PAGAMENTOS.", severidade: "alerta", fonte: { documento: MANUAL, dispositivo: "p. 25" } },
      { codigo: "movimentos_sem_finalidade", descricao: "Depósitos ou retiradas de recursos próprios sem finalidade de pagamento e transferências que não sejam pagamento levam a ressalva.", severidade: "alerta", fonte: { documento: IN159, dispositivo: "art. 28, VIII e XII" } },
      { codigo: "contas_inativas", descricao: "Contas abertas pela ANCINE são encerradas automaticamente depois de 2 anos sem saldo.", severidade: "info", parametros: { anos: 2 }, fonte: { documento: MANUAL, dispositivo: "p. 18" } },
    ],
    fonte: { documento: MANUAL, dispositivo: "p. 22 a 25" },
  },

  pagamentos: {
    meiosPermitidos: ["ted", "doc", "pix", "boleto", "cambio"],
    meiosVedados: ["cheque", "saque"],
    descricao: "Só transferência eletrônica (TED, DOC, PIX) direto ao real credor, que é o emissor do documento; boleto nos casos listados; câmbio para o exterior; cheque e saque são glosados.",
    documentoFiscal: [
      { codigo: "titulo_e_salic", descricao: "Documento com título e SALIC do projeto e discriminação do serviço ou bem; em cupom, carimbo no anverso.", severidade: "bloqueio", fonte: { documento: IN159, dispositivo: "arts. 9º e 10; Manual v2.11, p. 27 e 56" } },
      { codigo: "proponente_tomadora", descricao: "A proponente é a tomadora; contrapartida em nome de coprodutor ou distribuidor só com o contrato.", severidade: "bloqueio", fonte: { documento: IN159, dispositivo: "art. 18, XXI" } },
      { codigo: "emissao_30_dias", descricao: "Documento emitido até 30 dias depois do débito na conta.", severidade: "bloqueio", parametros: { dias: 30 }, fonte: { documento: IN159, dispositivo: "art. 18, XXIX" } },
      { codigo: "documento_habil", descricao: "Documento fiscal hábil, válido, legível e sem rasuras.", severidade: "bloqueio", fonte: { documento: IN159, dispositivo: "art. 18, XXII a XXIV" } },
      { codigo: "dispensa_de_nota", descricao: "Sem retenção nem nota, recibo com a fundamentação da dispensa (ex.: lei municipal).", severidade: "alerta", fonte: { documento: IN159, dispositivo: "art. 11" } },
      { codigo: "rpa", descricao: "RPA com SALIC, título, proponente, período, natureza do serviço, IRRF, INSS patronal, ISS, líquido, total, CPF e assinatura.", severidade: "alerta", fonte: { documento: MANUAL, dispositivo: "p. 41–42" } },
      { codigo: "tributos_na_rubrica", descricao: "Tributos lançados em nome do credor da despesa, na rubrica do fato gerador, com tipo DARF ou GPS; IRRF em linha própria.", severidade: "alerta", fonte: { documento: MANUAL, dispositivo: "p. 60" } },
      { codigo: "exterior", descricao: "Pagamento ao exterior com invoice em nome da proponente e contrato de câmbio ou SWIFT; valor convertido em reais.", severidade: "alerta", fonte: { documento: MANUAL, dispositivo: "p. 49–50" } },
      { codigo: "arquivo_por_documento", descricao: "Documentos fiscais em PDF, um por arquivo, até 15 MB, nomeados pela linha da RP (00012_P.pdf), enviados pelo STR quando pedidos.", severidade: "alerta", parametros: { mb: 15 }, fonte: { documento: DOCS_FISCAIS, dispositivo: "§§ 2 e 6" } },
    ],
    regras: [
      {
        codigo: "reembolso",
        descricao: "Reembolso só nas hipóteses do art. 15 (diária, figurante até R$ 1.000 por mês, tributos, mercadoria até R$ 1.000 por documento, locação até R$ 1.000, compra no exterior com cartão, aluguel por temporada em plataforma), com recibo de reembolso e despesa anterior ao débito.",
        severidade: "bloqueio",
        parametros: { figuranteMes: 1_000, mercadoria: 1_000, locacao: 1_000 },
        fonte: { documento: IN159, dispositivo: "art. 15; art. 18, X; DDC 1965-E/2023" },
      },
      { codigo: "real_credor", descricao: "Pagamento à conta da empresa credora, nunca à de sócios ou funcionários (MEI pode receber em conta de pessoa física).", severidade: "bloqueio", fonte: { documento: MANUAL, dispositivo: "p. 23–24, 27 e 49" } },
      { codigo: "sem_caixa", descricao: "Proibidos caixa pequeno, cartões pré-pagos, pagamento por conta particular e empréstimo do projeto a contas particulares.", severidade: "bloqueio", fonte: { documento: MANUAL, dispositivo: "p. 4 e 24" } },
      { codigo: "cartao_internacional", descricao: "Cartão de crédito internacional só para compras de mercadorias no exterior, por reembolso; anuidade e taxas não ligadas ao câmbio com recursos próprios.", severidade: "alerta", fonte: { documento: IN159, dispositivo: "art. 15, VI; art. 18, VIII e IX" } },
    ],
    fonte: { documento: MANUAL, dispositivo: "p. 22–24" },
  },

  despesas: {
    periodo: {
      descricao: "Da aprovação inicial do projeto para captação (no fomento direto, o marco do edital) até 180 dias da conclusão do objeto; vale a data da prestação do serviço ou da entrega do bem.",
      fonte: { documento: IN159, dispositivo: "art. 18, XX; IN 158, art. 57; Manual v2.11, p. 28–30" },
    },
    vedadas: [
      { codigo: "sem_documento", descricao: "Despesa sem documento fiscal", fonte: { documento: IN159, dispositivo: "art. 18, I" } },
      { codigo: "duplicidade", descricao: "Documento em duplicidade ou apresentado em outro projeto", fonte: { documento: IN159, dispositivo: "art. 18, II e III" } },
      { codigo: "acima_dos_limites", descricao: "Pagamento acima dos limites de gerenciamento, agenciamento e colocação", fonte: { documento: IN159, dispositivo: "art. 18, VI" } },
      { codigo: "juros_multas_tarifas", descricao: "Juros, multas, IOC, IOF, tarifas (salvo manutenção) e encargos contratuais", fonte: { documento: IN159, dispositivo: "art. 18, VII" } },
      { codigo: "sem_vinculo", descricao: "Passagens, hospedagem e diárias sem vínculo comprovado com o projeto", fonte: { documento: IN159, dispositivo: "art. 18, XI" } },
      { codigo: "auditoria", descricao: "Serviço de auditoria independente", fonte: { documento: IN159, dispositivo: "art. 18, XII" } },
      { codigo: "condecine_certificados", descricao: "CONDECINE, classificação indicativa, CPB e CRT", fonte: { documento: IN159, dispositivo: "art. 18, XIII" } },
      { codigo: "rubrica_glosada", descricao: "Despesa em rubrica glosada ou não autorizada antes da prestação", fonte: { documento: IN159, dispositivo: "art. 18, XIV" } },
      { codigo: "copias_no_exterior", descricao: "Cópias e matrizes feitas no exterior para exploração no Brasil", fonte: { documento: IN159, dispositivo: "art. 18, XV" } },
      { codigo: "material_permanente", descricao: "Material permanente, salvo infraestrutura técnica ou com justificativa e doação a entidade sem fins lucrativos ou pública", fonte: { documento: IN159, dispositivo: "art. 18, XVI" } },
      { codigo: "bebida_cigarro", descricao: "Bebidas alcoólicas e cigarros (salvo objeto de cena)", fonte: { documento: IN159, dispositivo: "art. 18, XVII e XVIII" } },
      { codigo: "fora_dos_marcos", descricao: "Despesa fora dos marcos inicial e final", fonte: { documento: IN159, dispositivo: "art. 18, XX" } },
      { codigo: "nao_financiavel", descricao: "Itens não financiáveis pela IN 158 ou pelo regramento de fomento direto", fonte: { documento: IN159, dispositivo: "art. 18, XXVII" } },
      { codigo: "contrapartida_publica", descricao: "Contrapartida paga com recurso público ou do coprodutor estrangeiro", fonte: { documento: IN159, dispositivo: "art. 18, XXVIII" } },
      { codigo: "infraestrutura_na_producao", descricao: "Despesas de infraestrutura em projetos de produção (ficam no gerenciamento)", fonte: { documento: IN159, dispositivo: "art. 18, XXXV" } },
      { codigo: "folha_da_proponente", descricao: "Folha de pessoal da proponente", fonte: { documento: IN159, dispositivo: "art. 18, XXXVI" } },
      { codigo: "estranhas_ao_projeto", descricao: "Despesas pessoais, inconsistentes com o projeto ou tributos sobre resultado, lucro ou receita da proponente", fonte: { documento: IN159, dispositivo: "art. 19" } },
      { codigo: "conteudo_nao_financiavel", descricao: "Conteúdo religioso, político, esportivo, publicitário, jornalístico ou de auditório", fonte: { documento: MANUAL, dispositivo: "p. 20; Lei 12.485/2011, art. 2º, XII" } },
    ],
    regras: [
      { codigo: "aderencia_por_modalidade", descricao: "Comercialização sem pós-produção nem aluguel de câmera; desenvolvimento sem mídia nem cartazes.", severidade: "alerta", fonte: { documento: MANUAL, dispositivo: "p. 28" } },
      { codigo: "classe_economica", descricao: "Passagens em classe econômica, sem remarcação, cancelamento ou no-show.", severidade: "alerta", fonte: { documento: MANUAL, dispositivo: "p. 34–35" } },
      { codigo: "diarias_so_autonomo", descricao: "Diária só para autônomo com RPA e vínculo, fora da sede.", severidade: "alerta", fonte: { documento: MANUAL, dispositivo: "p. 33–34" } },
      { codigo: "glosa_dentro_dos_20", descricao: "Item não previsto, acima do pactuado ou inconsistente com o objeto pode ser glosado mesmo dentro dos 20% de remanejamento.", severidade: "info", fonte: { documento: IN159, dispositivo: "art. 20" } },
    ],
    fonte: { documento: IN159, dispositivo: "arts. 18 a 20" },
  },

  porte: {
    lacuna: "nao_se_aplica",
    motivo: "A IN 159 não classifica projetos por porte; o orçamento abaixo de R$ 500 mil só afasta a regra de concentração por fornecedor.",
    fonte: { documento: IN159, dispositivo: "art. 28, VI" },
  },

  objeto: {
    descricao: "Material de cumprimento do objeto e da finalidade por modalidade (Anexo, art. 1º, VII): roteiro no desenvolvimento, CPB e cópia vinculada na produção, CRT e lançamento na distribuição, catálogo no festival, alvará e fotos na infraestrutura, laudos na infraestrutura técnica, listas na formação.",
    regras: [
      { codigo: "desenvolvimento", descricao: "Desenvolvimento: roteiro, concepção visual na animação e materiais da pesquisa orçada.", severidade: "bloqueio", fonte: { documento: IN159, dispositivo: "Anexo, art. 1º, VII, a" } },
      { codigo: "producao", descricao: "Produção: número do CPB e cópia vinculada enviada pela Central de Conteúdo, com as logomarcas obrigatórias.", severidade: "bloqueio", fonte: { documento: IN159, dispositivo: "Anexo, art. 1º, VII, b; art. 3º" } },
      { codigo: "distribuicao", descricao: "Distribuição ou comercialização: número do CRT e data do lançamento comercial.", severidade: "bloqueio", fonte: { documento: IN159, dispositivo: "Anexo, art. 1º, VII, c" } },
      { codigo: "festival", descricao: "Festival internacional: catálogo oficial e fotos, vídeo ou clipping.", severidade: "bloqueio", fonte: { documento: IN159, dispositivo: "Anexo, art. 1º, VII, d" } },
      { codigo: "infraestrutura", descricao: "Infraestrutura de sala: alvará, memorial do engenheiro ou arquiteto quando for o caso, fotos antes e depois e da logomarca.", severidade: "bloqueio", fonte: { documento: IN159, dispositivo: "Anexo, art. 1º, VII, e (red. IN 176/2026)" } },
      { codigo: "infraestrutura_tecnica", descricao: "Infraestrutura técnica: fotos do equipamento, laudos da instaladora e fotos da logomarca.", severidade: "bloqueio", fonte: { documento: IN159, dispositivo: "Anexo, art. 1º, VII, f" } },
      { codigo: "formacao", descricao: "Formação de público ou qualificação: listas de presença, avaliações, obras exibidas, material didático, relatórios de impacto e de resultados.", severidade: "bloqueio", fonte: { documento: IN159, dispositivo: "Anexo, art. 1º, VII, g e h" } },
      { codigo: "contrapartida_por_doacao", descricao: "Contrapartida por doação só até o saldo do item depois da execução pública; desconto e contrato sozinho não comprovam.", severidade: "alerta", fonte: { documento: IN159, dispositivo: "art. 18, XXXIV; Manual v2.11, p. 65–66" } },
      { codigo: "contrapartida_nao_compensa", descricao: "Contrapartida acima do mínimo, fora da conta, não compensa glosas nem recursos não comprovados.", severidade: "info", fonte: { documento: IN159, dispositivo: "art. 21, parágrafo único" } },
      { codigo: "deposito_legal", descricao: "Depósito legal na Cinemateca, com legendagem, audiodescrição e LIBRAS, comprovado até o fim da execução financeira; multa de R$ 2 mil a R$ 50 mil.", severidade: "alerta", fonte: { documento: "IN ANCINE 109/2012", dispositivo: "art. 26; Manual v2.11, p. 11" } },
      { codigo: "prazo_do_objeto", descricao: "Objeto concluído em 36 meses (animação acima de 70 min), 24 (demais produções) ou 12 (desenvolvimento, distribuição e festival), da 1ª liberação.", severidade: "info", parametros: { animacao: 36, producao: 24, outros: 12 }, fonte: { documento: IN158, dispositivo: "art. 53" } },
    ],
    fonte: { documento: IN159, dispositivo: "Anexo, art. 1º, VII; art. 3º" },
  },

  divulgacao: {
    marcas: ["ANCINE", "FSA e agente financeiro (com FSA)", "Bandeira Nacional"],
    aprovacaoPrevia: {
      exigida: false,
      prazo: null,
      silencioAprova: false,
      descricao: "Não é preciso aprovar antes: a aplicação da logomarca é verificada na análise do objeto.",
      fonte: { documento: LOGOMARCA, dispositivo: "aprovação prévia" },
    },
    defeso: null,
    regras: [
      { codigo: "onde_aplicar", descricao: "Logomarca nos créditos iniciais e no cartaz (desenvolvimento, produção, finalização), no cartaz (distribuição), em cartazes, vinheta e catálogo (festival) e na placa (infraestrutura).", severidade: "bloqueio", fonte: { documento: IN130, dispositivo: "art. 4º (red. IN 152/2020)" } },
      { codigo: "bandeira", descricao: "Bandeira Nacional em todo material de divulgação impresso, virtual ou audiovisual, salvo memes e vídeos curtos.", severidade: "bloqueio", fonte: { documento: "Lei 5.700/1971", dispositivo: "art. 3º-A; IN 152/2020" } },
      { codigo: "cartela_ancine", descricao: "Cartela ANCINE de ao menos 3 s nos créditos iniciais, antes das demais; FSA e agente financeiro com ao menos 2 s, sem outras marcas.", severidade: "alerta", parametros: { ancineSegundos: 3, fsaSegundos: 2 }, fonte: { documento: LOGOMARCA, dispositivo: "créditos" } },
      { codigo: "ordem_e_visibilidade", descricao: "Ordem agente financeiro, FSA, ANCINE; visibilidade igual ou maior que a da marca mais visível da peça; só colorida ou monocromática.", severidade: "alerta", fonte: { documento: LOGOMARCA, dispositivo: "conjunto, visibilidade e cor" } },
      { codigo: "placa_infraestrutura", descricao: "Placa de aço escovado de 40 × 26 cm, ao lado da bilheteria, a 1,5 m do piso, com a frase obrigatória.", severidade: "alerta", fonte: { documento: LOGOMARCA, dispositivo: "placa de infraestrutura" } },
      { codigo: "sancoes", descricao: "Marca em desacordo: advertência. Marca não aplicada: devolução de 2% (créditos, vinheta, placa) ou 0,5% (cartaz) dos recursos públicos federais, com rendimentos.", severidade: "bloqueio", parametros: { creditos: 2, cartaz: 0.5 }, fonte: { documento: IN130, dispositivo: "art. 6º" } },
      { codigo: "ressalva_e_debito", descricao: "Descumprir a logomarca leva a aprovação com ressalvas e gera débito.", severidade: "info", fonte: { documento: IN159, dispositivo: "art. 28, XI; art. 31, III" } },
      { codigo: "defeso_nao_tratado", descricao: "Os manuais da ANCINE não tratam do defeso eleitoral.", severidade: "info", fonte: { documento: MANUAL, dispositivo: "parte B.8 da conferência" } },
    ],
    fonte: { documento: IN130, dispositivo: "arts. 2º a 6º; Manual de Aplicação da Logomarca v3.0" },
  },

  envio: {
    sistema: "STR (planilhas e documentos fiscais) e Protocolo Digital",
    descricao: "RP, DE e DO em .xls (Excel 97-2003) pelo STR, com críticas automáticas; demais documentos pelo Protocolo Digital; documentos fiscais digitalizados pelo STR quando pedidos. Uma prestação por projeto (SALIC) e fonte.",
    documentos: [
      { codigo: "rp", descricao: "Relação de Pagamentos, uma por conta de movimentação e uma de contrapartida fora da conta", em: ["parcial", "final"], obrigatorio: true, fonte: { documento: IN159, dispositivo: "Anexo, art. 1º, I" } },
      { codigo: "de", descricao: "Demonstrativo do Extrato da Conta Corrente, um por conta", em: ["parcial", "final"], obrigatorio: true, fonte: { documento: IN159, dispositivo: "Anexo, art. 1º, II" } },
      { codigo: "do", descricao: "Demonstrativo Orçamentário e Financeiro, um por SALIC", em: ["parcial", "final"], obrigatorio: true, fonte: { documento: IN159, dispositivo: "Anexo, art. 1º, III" } },
      { codigo: "gru_saldos", descricao: "Comprovantes de recolhimento dos saldos da movimentação e das aplicações (GRU)", em: ["final"], obrigatorio: false, fonte: { documento: IN159, dispositivo: "Anexo, art. 1º, IV; art. 2º, § 3º" } },
      { codigo: "encerramento_contas", descricao: "Comprovantes de encerramento das contas abertas pela proponente (emitidos pelo banco)", em: ["final"], obrigatorio: false, fonte: { documento: IN159, dispositivo: "Anexo, art. 1º, V; art. 2º, § 3º" } },
      { codigo: "extratos", descricao: "Extratos de todas as contas, inclusive de aplicação, da abertura ao encerramento", em: ["parcial", "final"], obrigatorio: true, fonte: { documento: IN159, dispositivo: "Anexo, art. 1º, VI" } },
      { codigo: "objeto", descricao: "Material de cumprimento do objeto e da finalidade, pela modalidade", em: ["final"], obrigatorio: true, fonte: { documento: IN159, dispositivo: "Anexo, art. 1º, VII" } },
      { codigo: "documentos_fiscais", descricao: "Cópias digitalizadas dos documentos fiscais e auxiliares, quando pedidas", em: ["parcial", "final"], obrigatorio: false, fonte: { documento: IN159, dispositivo: "Anexo, art. 1º, VIII; art. 2º, § 1º" } },
      { codigo: "junta_comercial", descricao: "Registro na junta comercial, em projetos de aquisição de ações", em: ["final"], obrigatorio: false, fonte: { documento: IN159, dispositivo: "Anexo, art. 1º, parágrafo único" } },
      { codigo: "confirmacao_str", descricao: "E-mail de confirmação do envio pelo STR, impresso e juntado (enviar pelo STR não é entregar a prestação)", em: ["parcial", "final"], obrigatorio: true, fonte: { documento: STR, dispositivo: "§§ 6.1 e 6.3" } },
    ],
    modelos: [
      { codigo: "rp", nome: "Relação de Pagamentos (RP)", formato: "xls (Excel 97-2003)", arquivo: "ancine/IN_159_Relacao_de_Pagamentos.xls", fonte: { documento: IN159, dispositivo: "Anexo, formulário I" } },
      { codigo: "de", nome: "Demonstrativo do Extrato da Conta Corrente (DE)", formato: "xls (Excel 97-2003)", arquivo: "ancine/IN_159_Demonstrativo_do_Extrato.xls", fonte: { documento: IN159, dispositivo: "Anexo, formulário II" } },
      { codigo: "do", nome: "Demonstrativo Orçamentário e Financeiro (DO)", formato: "xls (Excel 97-2003)", arquivo: "ancine/IN_159_Demonstrativo_Orcamentario_e_Financeiro.xls", fonte: { documento: IN159, dispositivo: "Anexo, formulário III" } },
    ],
    regras: [
      { codigo: "xls_97", descricao: "O STR só carrega planilha salva como Pasta de Trabalho do Excel 97-2003 (.xls), com nome de mais de 5 caracteres.", severidade: "bloqueio", fonte: { documento: STR, dispositivo: "§§ 3.1 e 3.2" } },
      { codigo: "salic_nas_planilhas", descricao: "Nas planilhas, só o SALIC no formato NN-NNNN.", severidade: "bloqueio", fonte: { documento: STR, dispositivo: "§§ 2.3 e 3.2.1" } },
      { codigo: "criticas_de_cruzamento", descricao: "RP casa com o DE (histórico e data) e com o DO (item orçamentário com o mesmo texto); o comprovado não pode ser menor que o a comprovar.", severidade: "bloqueio", fonte: { documento: STR, dispositivo: "§ 5.3" } },
      { codigo: "uma_por_fonte", descricao: "Uma prestação por projeto e fonte (incentivo, fomento direto, FSA), com SALIC e processo próprios.", severidade: "bloqueio", fonte: { documento: MANUAL, dispositivo: "p. 10" } },
      { codigo: "bb_gestao_agil", descricao: "Em contas do BB Gestão Ágil, o DE é gerado pelo STR e a RP vem pré-preenchida para revisar.", severidade: "info", fonte: { documento: STR, dispositivo: "§§ 3.1 e 4.1.1" } },
      { codigo: "reabrir_envio", descricao: "Depois do envio, as planilhas do SALIC travam; reabrir pede e-mail à ANCINE, que apaga todas.", severidade: "info", fonte: { documento: STR, dispositivo: "§ 6.3" } },
    ],
    fonte: { documento: IN159, dispositivo: "Anexo, arts. 1º a 4º" },
  },

  posEnvio: {
    resultados: [
      { resultado: "aprovada", descricao: "Objeto e finalidade cumpridos e contas regulares.", fonte: { documento: MANUAL, dispositivo: "p. 20 e 68" } },
      { resultado: "aprovada_ressalvas", descricao: "Concentração de 25% ou mais, depósitos sem finalidade, formulários errados, logomarca, transferências indevidas, glosa recolhida e outras hipóteses.", fonte: { documento: IN159, dispositivo: "arts. 22 e 28" } },
      { resultado: "reprovada", descricao: "Omissão, objeto não entregue, glosa não ressarcida, valores não comprovados, gestão fraudulenta, CPB não emitido, diligência não atendida ou objeto reprovado (não aprovação).", fonte: { documento: IN159, dispositivo: "art. 29" } },
    ],
    devolucao: {
      descricao: "GRU pelo PagTesouro, pela fonte do recurso, com o SALIC como referência e só o valor principal preenchido.",
      atualizacao: "SELIC a partir do mês seguinte ao vencimento e 1% no mês do pagamento; mora de 0,33% ao dia até 20% (IN 164/2022); data-base pelo art. 32 da IN 159.",
      gru: [
        { unidadeGestora: "340002", gestao: null, codigo: "019401", referencia: "SALIC só com dígitos", fonte: { documento: MANUAL, dispositivo: "p. 14–17", nota: "Lei 8.313/1991, arts. 18 e 25: órgão 34902 (Fundo Nacional de Cultura)." } },
        { unidadeGestora: "203003", gestao: null, codigo: "026642", referencia: "SALIC só com dígitos", fonte: { documento: MANUAL, dispositivo: "p. 14–17", nota: "Lei 8.685/1993, arts. 1º, 1º-A, 3º e 3º-A: órgão 20203 (ANCINE)." } },
        { unidadeGestora: "203003", gestao: null, codigo: "026667", referencia: "SALIC só com dígitos", fonte: { documento: MANUAL, dispositivo: "p. 14–17", nota: "PAR/PAQ, orçamento da ANCINE." } },
        { unidadeGestora: "203003", gestao: null, codigo: "026674", referencia: "SALIC só com dígitos", fonte: { documento: MANUAL, dispositivo: "p. 14–17", nota: "Editais FSA, MP 2.228-1 (art. 39, X) e Funcines." } },
      ],
      fonte: { documento: MANUAL, dispositivo: "p. 14–17 e 69" },
    },
    regras: [
      { codigo: "multa_na_nao_aprovacao", descricao: "Na não aprovação, multa de 50% (Lei 8.685) ou 20% (FSA e Funcines) sobre o débito atualizado; pagar antes evita a multa.", severidade: "alerta", parametros: { leiAudiovisual: 50, fsaFuncines: 20 }, fonte: { documento: IN159, dispositivo: "arts. 31 a 36" } },
      { codigo: "inadimplencia", descricao: "Atraso na prestação, parcela não paga ou diligência sem resposta geram inadimplência, que trava novos projetos da proponente e do grupo até a regularização.", severidade: "alerta", fonte: { documento: MANUAL, dispositivo: "p. 68" } },
      { codigo: "sancoes", descricao: "Advertência ou inabilitação por até 2 anos, aplicadas depois do prazo recursal, alcançando empresas do mesmo grupo.", severidade: "alerta", parametros: { anos: 2 }, fonte: { documento: IN159, dispositivo: "art. 42" } },
      { codigo: "parcelamento", descricao: "Parcelamento em até 60 vezes, parcela mínima de R$ 200 (PJ) ou R$ 50 (PF).", severidade: "info", parametros: { parcelas: 60 }, fonte: { documento: "IN ANCINE 164/2022", dispositivo: "parcelamento" } },
      { codigo: "tce", descricao: "TCE dispensada abaixo de R$ 120 mil ou depois de 10 anos; abaixo disso, cobrança extrajudicial.", severidade: "info", parametros: { valor: 120_000 }, fonte: { documento: "IN TCU 98/2024", dispositivo: "art. 6º, I; Manual v2.11, p. 71–73" } },
      { codigo: "prescricao", descricao: "Prescrição de 5 anos e intercorrente de 3 anos com o processo parado.", severidade: "info", fonte: { documento: "Res. TCU 344/2022", dispositivo: "arts. 2º e 8º; DDC ANCINE 110-E/2023" } },
      { codigo: "inspecao", descricao: "Inspeção in loco agendada com 10 dias de antecedência; impedi-la leva a inadimplência.", severidade: "info", parametros: { dias: 10 }, fonte: { documento: IN159, dispositivo: "arts. 58 a 60" } },
    ],
    fonte: { documento: IN159, dispositivo: "arts. 22 a 50" },
  },

  guarda: {
    marco: "registro_decisao",
    quantidade: 5,
    unidade: "anos",
    prorrogaParaDiaUtil: false,
    descricao: "Originais por 5 anos a partir da decisão final, em ordem cronológica ou da RP; papel termossensível guardado com cópia.",
    fonte: { documento: IN159, dispositivo: "art. 8º" },
  },
} satisfies RegimeNormativo;
