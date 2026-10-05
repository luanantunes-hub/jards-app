// Lei Rouanet (Incentivo a Projetos Culturais), IN MinC 29/2026 com a IN 34/2026.
// Valores conferidos no texto integral: docs/acoes-futuras/estudos/
// prestacao-de-contas-fontes/rouanet-in29-texto-integral.md. Manuais do MinC
// (Módulos II e III, Manual de Uso das Marcas) entram onde a IN remete a eles
// ou é omissa, marcados como "a confirmar" quando divergem da IN.
//
// Versão 2 (P1.11): todas as dimensões; grupos de custo, bases, tetos e
// regras de alteração saíram do código e vieram para cá.

import type { RegimeNormativo } from "./tipos";

const IN29 = "IN MinC 29/2026";
const MODULO_II = "Manual do Proponente, Módulo II (MinC, ago/2026)";
const MODULO_III = "Manual do Proponente, Módulo III (MinC, 2026)";
const MARCAS = "Manual de Uso das Marcas do Pronac (jan/2026)";
const MARCAS_DEFESO = "Manual de Uso das Marcas do Pronac, versão defeso (jun/2026)";

export const ROUANET_IN29_2026 = {
  codigo: "rouanet_in29_2026",
  versao: 2,
  nome: "Lei Rouanet — IN MinC 29/2026",
  area: "cultura",
  mecanismo: "rouanet",
  esfera: "federal",
  orgao: "Ministério da Cultura",
  sistemaOficial: "Salic",
  normaReferencia: "Lei 8.313/1991; IN MinC 29/2026, alterada pela IN MinC 34/2026",
  // DOU de 30/01/2026; art. 102: vigência na publicação.
  vigenteDesde: "2026-01-30",
  identificadorOficial: { tipo: "pronac", rotulo: "Pronac" },
  fontes: [
    { documento: "IN MinC 29/2026 (gov.br, com a IN 34)", url: "https://www.gov.br/cultura/pt-br/acesso-a-informacao/legislacao-e-normativas/instrucao-normativa-minc-no-29-de-29-de-janeiro-de-2026" },
    { documento: "IN MinC 29/2026 (DOU de 30/01/2026)", url: "https://www.in.gov.br/web/dou/-/instrucao-normativa-minc-n-29-de-29-de-janeiro-de-2026-684187391" },
    { documento: "IN MinC 34/2026 (DOU de 14/08/2026)", url: "https://www.in.gov.br/web/dou/-/instrucao-normativa-minc-n-34-de-11-de-agosto-de-2026-725487667" },
  ],

  aplicabilidade: {
    criterio: "ato_praticado",
    desde: "2026-01-30",
    ate: null,
    descricao: "Vale desde a publicação e se aplica também aos projetos em andamento, respeitados os direitos adquiridos.",
    sucede: [],
    fonte: { documento: IN29, dispositivo: "arts. 96 e 102", citacao: "entra em vigor na data de sua publicação" },
  },

  prazos: {
    prestacaoFinal: {
      descricao: "Concluir os pagamentos e enviar o relatório final no Salic",
      responsavel: "proponente",
      marco: "fim_vigencia",
      quantidade: 60,
      unidade: "dias_corridos",
      fonte: {
        documento: IN29,
        dispositivo: "art. 69, caput",
        citacao: "No período improrrogável de 60 (sessenta) dias após o término da vigência do projeto",
        nota: "\"Improrrogável\" afasta pedido de prorrogação; a contagem segue a Lei 9.784/1999, art. 66 (art. 98, I).",
      },
    },
    respostaDiligencia: {
      descricao: "Responder diligência",
      responsavel: "proponente",
      marco: "ciencia_diligencia",
      quantidade: 20,
      unidade: "dias_corridos",
      fonte: {
        documento: IN29,
        dispositivo: "art. 95, caput",
        citacao: "com o prazo de 20 (vinte) dias para resposta",
        nota: "Vale também para a notificação por omissão do art. 69, § 1º, que não fixa prazo próprio.",
      },
    },
    analisePrestacao: {
      descricao: "Análise da prestação de contas pelo MinC",
      responsavel: "orgao",
      marco: "envio_prestacao",
      quantidade: 6,
      unidade: "meses",
      fonte: {
        documento: IN29,
        dispositivo: "art. 71 e parágrafo único",
        citacao: "no prazo de 6 (seis) meses, contados da data do envio da prestação de contas",
        nota: "Vencido o prazo, começa a correr a prescrição quinquenal. Diligência suspende o prazo (art. 95, § 1º).",
      },
    },
    recurso: {
      descricao: "Recorrer da decisão (inclusive da aprovação com ressalvas)",
      responsavel: "proponente",
      marco: "ciencia_decisao",
      quantidade: 30,
      unidade: "dias_corridos",
      fonte: { documento: IN29, dispositivo: "art. 78, caput", citacao: "no prazo de 30 (trinta) dias", nota: "Efeito suspensivo (§ 1º). A autoridade decide em 60 dias." },
    },
    devolucao: {
      descricao: "Recolher os valores após a reprovação",
      responsavel: "proponente",
      marco: "registro_decisao",
      quantidade: 20,
      unidade: "dias_corridos",
      fonte: {
        documento: IN29,
        dispositivo: "art. 77",
        citacao: "no prazo de 20 (vinte) dias, a contar do dia seguinte ao registro da decisão",
        nota: "Atualização pela poupança desde o fim do prazo de captação.",
      },
    },
    recolhimentoAposRecurso: {
      descricao: "Recolher ou pedir parcelamento depois do recurso indeferido",
      responsavel: "proponente",
      marco: "ciencia_decisao",
      quantidade: 20,
      unidade: "dias_corridos",
      fonte: { documento: IN29, dispositivo: "art. 78, § 5º", citacao: "recolher os recursos irregularmente aplicados, devidamente corrigidos; ou II - solicitar o parcelamento" },
    },
    aprovacaoPeca: {
      descricao: "Avaliação de peça de divulgação pelo MinC; sem resposta, a peça está aprovada",
      responsavel: "orgao",
      marco: "submissao_peca",
      quantidade: 5,
      unidade: "dias_uteis",
      fonte: { documento: IN29, dispositivo: "art. 21, §§ 2º e 3º", citacao: "terá 5 (cinco) dias úteis para avaliá-los" },
    },
    analiseAlteracao: {
      descricao: "Análise de alteração pelo MinC; sem resposta, a alteração pode ser executada",
      responsavel: "orgao",
      marco: "protocolo_alteracao",
      quantidade: 30,
      unidade: "dias_corridos",
      fonte: {
        documento: IN29,
        dispositivo: "art. 64, §§ 7º a 9º",
        citacao: "Não havendo manifestação do Ministério da Cultura nos prazos estabelecidos, as alterações poderão ser executadas",
        nota: "Mais 30 dias com manifestação da unidade técnica e mais 60 em obras ou restauro.",
      },
    },
  },

  prestacaoParcial: {
    modalidades: ["continua"],
    descricao: "Não há prestação parcial como entrega: a comprovação financeira é contínua no Salic, à medida que os débitos acontecem, e o monitoramento é automatizado.",
    prazo: null,
    regras: [
      {
        codigo: "comprovacao_minima_monitoramento",
        descricao: "Deixar de fazer 30% das comprovações financeiras leva a notificação, sob pena de inadimplência.",
        severidade: "alerta",
        parametros: { percentual: 30 },
        fonte: { documento: IN29, dispositivo: "art. 65, § 3º", citacao: "Quando o proponente deixar de realizar 30% (trinta por cento) das comprovações financeiras" },
      },
      {
        codigo: "comprovado_recomendado",
        descricao: "O manual recomenda manter mais de 80% do gasto comprovado para evitar inadimplência.",
        severidade: "alerta",
        parametros: { percentual: 80 },
        fonte: { documento: MODULO_II, dispositivo: "p. 57", aConfirmar: true, nota: "Régua do manual; a IN usa a de 30% do art. 65, § 3º." },
      },
      {
        codigo: "diligencia_por_indicio",
        descricao: "Denúncia, indício de irregularidade ou de vantagem ao incentivador abre diligência de 20 dias, sob pena de suspensão imediata.",
        severidade: "alerta",
        parametros: { dias: 20 },
        fonte: { documento: IN29, dispositivo: "art. 65, §§ 2º e 4º", citacao: "apresente esclarecimentos no prazo de 20 (vinte) dias, sob pena de imediata suspensão" },
      },
    ],
    fonte: { documento: IN29, dispositivo: "arts. 65, § 1º, e 68", citacao: "As comprovações ocorrerão tempestivamente no [...] (Salic)" },
  },

  orcamento: {
    estrutura: {
      niveis: ["Produto", "Etapa", "UF e município", "Item"],
      descricao: "Planilha por produto e etapa, com local e itens (quantidade, ocorrência e valor unitário). Versões: solicitada, aprovada para captar, adequada, homologada e readequada.",
      fonte: { documento: MODULO_II, dispositivo: "p. 20–21 e 44–48" },
    },
    grupos: [
      {
        codigo: "execucao",
        rotulo: "Pré-produção, produção e pós-produção",
        descricao: "Etapas de execução do produto, com assessoria contábil e jurídica; entram no valor do projeto.",
        fonte: { documento: IN29, dispositivo: "art. 17, I a III e V" },
      },
      {
        codigo: "direitos",
        rotulo: "Direitos autorais e conexos",
        descricao: "Direitos autorais e conexos; entram no valor do projeto e têm limite próprio.",
        fonte: { documento: IN29, dispositivo: "art. 27" },
      },
      {
        codigo: "recolhimentos",
        rotulo: "Recolhimentos",
        descricao: "Tributos e encargos recolhidos pelo projeto; entram no valor do projeto.",
        fonte: { documento: IN29, dispositivo: "art. 17, IV" },
      },
      {
        codigo: "divulgacao",
        rotulo: "Acessibilidade e divulgação",
        descricao: "Custo vinculado: acessibilidade, comunicação e divulgação acessíveis.",
        fonte: { documento: IN29, dispositivo: "art. 17, § 1º, II, e art. 20" },
      },
      {
        codigo: "administracao",
        rotulo: "Custos administrativos",
        descricao: "Custo vinculado: bens e serviços administrativos, tarifas necessárias, pessoal administrativo, elaboração da proposta e prestação de contas.",
        fonte: { documento: IN29, dispositivo: "art. 17, § 1º, I, e art. 22" },
      },
      {
        codigo: "captacao",
        rotulo: "Remuneração de captação",
        descricao: "Remuneração para captação de recursos; fica fora do valor do projeto e tem limite próprio.",
        fonte: { documento: IN29, dispositivo: "art. 19" },
      },
    ],
    bases: {
      valor_projeto: {
        descricao: "Valor do projeto: pré-produção, produção, pós-produção, recolhimentos e assessoria contábil e jurídica, sem custos vinculados e captação.",
        soma: "todos",
        exceto: ["administracao", "divulgacao", "captacao"],
        fonte: { documento: IN29, dispositivo: "art. 17, caput; Anexo I, LXXV", citacao: "sem custos vinculados e captação de recursos" },
      },
      valor_total_projeto: {
        descricao: "Valor total do projeto: o valor do projeto mais os custos vinculados e a captação.",
        soma: "todos",
        exceto: [],
        fonte: { documento: IN29, dispositivo: "Anexo I, LXXVII", citacao: "incluindo os custos vinculados e captação de recursos" },
      },
      valor_aprovado_execucao: {
        descricao: "Valor aprovado para execução: o total da planilha em uso.",
        soma: "todos",
        exceto: [],
        fonte: { documento: IN29, dispositivo: "art. 27", nota: "A IN não define o termo; a planilha homologada (ou readequada) em uso é o aprovado para execução." },
      },
    },
    tetos: [
      {
        codigo: "administracao",
        descricao: "Custos de administração, incluindo tarifas necessárias",
        grupos: ["administracao"],
        percentual: 15,
        base: "valor_projeto",
        proporcionalAoCaptado: true,
        severidade: "bloqueio",
        fonte: { documento: IN29, dispositivo: "art. 22, caput e III", citacao: "tarifas bancárias cujo adimplemento se faz necessário à realização de tais atividades" },
      },
      {
        codigo: "acessibilidade_divulgacao",
        descricao: "Acessibilidade, comunicação e divulgação acessíveis",
        grupos: ["divulgacao"],
        percentual: 20,
        base: "valor_projeto",
        proporcionalAoCaptado: true,
        severidade: "bloqueio",
        fonte: { documento: IN29, dispositivo: "art. 20, caput", citacao: "não poderá ultrapassar o limite de 20% (vinte por cento) do valor do projeto" },
      },
      {
        codigo: "captacao",
        descricao: "Remuneração de captação",
        grupos: ["captacao"],
        percentual: 10,
        base: "valor_projeto",
        teto: 150_000,
        proporcionalAoCaptado: true,
        severidade: "bloqueio",
        fonte: {
          documento: IN29,
          dispositivo: "art. 19, caput e §§ 1º e 2º",
          citacao: "limitada a 10% (dez por cento) do valor do projeto e ao teto de R$ 150.000,00",
          nota: "Paga proporcionalmente às parcelas captadas, sem contar saldo transferido; por ano em planos plurianuais e territórios criativos.",
        },
      },
      {
        codigo: "direitos_autorais",
        descricao: "Direitos autorais e conexos",
        grupos: ["direitos"],
        percentual: 10,
        base: "valor_aprovado_execucao",
        severidade: "alerta",
        fonte: { documento: IN29, dispositivo: "art. 27", citacao: "até o limite de 10% (dez por cento) sobre o valor aprovado para execução" },
      },
    ],
    regras: [
      {
        codigo: "direitos_exibicao",
        descricao: "Direitos de exibição até 20% do valor aprovado para execução (40% em VOD independente).",
        severidade: "alerta",
        parametros: { percentual: 20, percentualVod: 40 },
        fonte: { documento: IN29, dispositivo: "art. 28" },
      },
      {
        codigo: "caches",
        descricao: "Cachê por apresentação: R$ 25 mil (artista individual), R$ 50 mil (grupo), R$ 5 mil por músico e R$ 25 mil para o maestro (orquestra), R$ 5 mil (palestrante). Acima disso, recurso não incentivado ou aprovação da CNIC.",
        severidade: "alerta",
        parametros: { individual: 25_000, grupo: 50_000, musico: 5_000, maestro: 25_000, palestrante: 5_000 },
        fonte: { documento: IN29, dispositivo: "art. 26, I a IV e parágrafo único", citacao: "O limite para previsão de pagamento de cachês com recursos incentivados, por apresentação" },
      },
      {
        codigo: "valor_por_beneficiario",
        descricao: "Valor por pessoa beneficiada até R$ 300, em projetos com bilheteria ou venda.",
        severidade: "alerta",
        parametros: { valor: 300 },
        fonte: { documento: IN29, dispositivo: "art. 16", citacao: "será de até R$ 300,00 (trezentos reais)" },
      },
      {
        codigo: "limite_por_projeto",
        descricao: "Limite por projeto: R$ 500 mil (pessoa física) e R$ 1,5 milhão (pessoa jurídica); R$ 6 milhões ou R$ 15 milhões nas tipologias dos arts. 12 e 13, dentro da carteira; exceções do art. 14.",
        severidade: "info",
        parametros: { pessoaFisica: 500_000, pessoaJuridica: 1_500_000 },
        fonte: { documento: IN29, dispositivo: "arts. 11 a 14" },
      },
      {
        codigo: "tiragem_livro",
        descricao: "Tiragem de livro até 3.000 exemplares; acima disso, decide a CNIC.",
        severidade: "info",
        parametros: { exemplares: 3_000 },
        fonte: { documento: IN29, dispositivo: "art. 25" },
      },
      {
        codigo: "tetos_audiovisual",
        descricao: "Tetos por produto audiovisual (curta R$ 350 mil, games R$ 1,5 milhão, VOD R$ 2 milhões e outros), superáveis com edital ou contrato que assegure 50%.",
        severidade: "alerta",
        fonte: { documento: IN29, dispositivo: "art. 31, caput e §§ 2º e 3º" },
      },
      {
        codigo: "bem_permanente",
        descricao: "Bem permanente só se for mais econômico ou indispensável e estiver previsto na planilha, com a destinação declarada.",
        severidade: "alerta",
        fonte: { documento: IN29, dispositivo: "art. 30" },
      },
      {
        codigo: "custos_artistico_culturais",
        descricao: "Projetos sociais, educativos, ambientais, esportivos e gastronômicos: só os custos artístico-culturais são aprovados.",
        severidade: "info",
        fonte: { documento: IN29, dispositivo: "art. 18" },
      },
    ],
  },

  alteracoes: {
    janela: {
      aPartirDe: "liberacao",
      ate: "fim_execucao",
      descricao: "Depois da liberação para execução e até o fim do período de execução, sem mudar o objeto nem o produto principal.",
      fonte: { documento: IN29, dispositivo: "art. 64, caput", citacao: "Após a liberação para execução e até o final do período de execução" },
    },
    tipos: {
      remanejamento: {
        permitido: true,
        classificacao: "administrativa",
        condicoes: [
          {
            tipo: "mantem_grupos",
            grupos: ["administracao", "divulgacao", "captacao"],
            descricao: "Não muda o valor aprovado dos custos vinculados (administração, acessibilidade e divulgação) nem da captação.",
            fonte: { documento: IN29, dispositivo: "art. 64, § 3º, II", citacao: "não poderá implicar em alteração do valor aprovado para os custos vinculados e remuneração para captação de recursos" },
          },
        ],
        requisitos: [
          { tipo: "tetos", severidade: "alerta", descricao: "Depois do remanejamento, os grupos continuam dentro dos tetos.", fonte: { documento: IN29, dispositivo: "arts. 19, 20 e 22" } },
        ],
        orientacoes: [],
        fonte: { documento: IN29, dispositivo: "art. 64, § 3º, I e II", citacao: "prescindirão da prévia autorização do Ministério da Cultura os remanejamentos [...] que não alterem o valor do projeto" },
      },
      complementacao: {
        permitido: true,
        classificacao: "formal",
        condicoes: [],
        requisitos: [
          {
            tipo: "captado_minimo",
            percentual: 50,
            base: "valor_homologado_execucao",
            severidade: "bloqueio",
            descricao: "Ter captado ao menos 50% do valor homologado para execução.",
            fonte: { documento: IN29, dispositivo: "art. 64, § 4º", citacao: "desde que o projeto tenha captado, no mínimo, 50% (cinquenta por cento) do valor homologado para execução" },
          },
          {
            tipo: "acumulado_maximo",
            percentual: 50,
            base: "valor_homologado_execucao",
            severidade: "bloqueio",
            descricao: "As complementações somam até 50% do valor homologado.",
            fonte: { documento: IN29, dispositivo: "art. 64, § 4º, I" },
          },
          { tipo: "tetos", severidade: "bloqueio", descricao: "A complementação respeita os tetos da IN.", fonte: { documento: IN29, dispositivo: "art. 64, § 4º, IV" } },
        ],
        orientacoes: [
          { codigo: "detalhamento", descricao: "Detalhe as ações e os custos adicionais.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 64, § 4º, II" } },
          { codigo: "reinclusao", descricao: "Não reinclua itens retirados na análise do MinC.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 64, § 4º, III" } },
        ],
        fonte: { documento: IN29, dispositivo: "art. 64, § 4º" },
      },
      reducao: {
        permitido: true,
        classificacao: "formal",
        condicoes: [],
        requisitos: [
          {
            tipo: "acumulado_maximo",
            percentual: 50,
            base: "valor_total_projeto",
            severidade: "bloqueio",
            descricao: "As reduções somam até 50% do valor total do projeto.",
            fonte: {
              documento: IN29,
              dispositivo: "art. 64, § 5º, II",
              citacao: "nem representar diminuição superior a 50% (cinquenta por cento) do valor total do projeto",
              nota: "A IN não diz se o limite é cumulativo; o manual diz que é, e a soma das reduções é a leitura conservadora.",
            },
          },
          { tipo: "tetos", severidade: "alerta", descricao: "Depois da redução, os grupos continuam dentro dos tetos.", fonte: { documento: IN29, dispositivo: "arts. 19, 20 e 22" } },
        ],
        orientacoes: [
          { codigo: "detalhamento", descricao: "Liste os itens retirados ou reduzidos e redimensione o escopo.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 64, § 5º, III e IV" } },
          { codigo: "execucao_proporcional", descricao: "Para só executar menos, sem itens novos, a execução proporcional dispensa o pedido de redução.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 64, § 6º" } },
          { codigo: "selecao_publica", descricao: "Projeto de seleção pública homologada não pode ser reduzido.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 64, § 5º, V" } },
        ],
        fonte: { documento: IN29, dispositivo: "art. 64, § 5º" },
      },
      inclusao: {
        permitido: true,
        classificacao: "formal",
        condicoes: [],
        requisitos: [
          { tipo: "tetos", severidade: "alerta", descricao: "Com o item novo, os grupos continuam dentro dos tetos.", fonte: { documento: IN29, dispositivo: "arts. 19, 20 e 22" } },
        ],
        orientacoes: [],
        fonte: {
          documento: MODULO_II,
          dispositivo: "p. 36–37 e 44–48",
          nota: "O remanejamento sem autorização vale para os itens da planilha aprovada; incluir item é readequação, analisada pelo MinC.",
        },
      },
    },
    alertasPorItem: [
      {
        tipo: "variacao_item",
        percentual: 50,
        descricao: "No Salic, mudar mais de 50% do valor aprovado do item pode exigir readequação. A IN 29 não fixa esse limite.",
        fonte: { documento: MODULO_II, dispositivo: "p. 36", aConfirmar: true },
      },
      {
        tipo: "item_ja_alterado",
        descricao: "O Salic não deixa remanejar de novo item já readequado.",
        fonte: { documento: MODULO_II, dispositivo: "p. 36" },
      },
    ],
    prazoAnalise: "analiseAlteracao",
    silencioAprova: true,
    regras: [
      { codigo: "inadimplencia_trava", descricao: "Inadimplência ou inabilitação cautelar impedem pedidos de alteração.", severidade: "alerta", fonte: { documento: IN29, dispositivo: "art. 83, parágrafo único, II; art. 84, § 1º, III" } },
      { codigo: "mudanca_de_local", descricao: "Mudar o local exige planilha, plano de distribuição, acessibilidade e cronograma atualizados, sem descontinuar a gratuidade.", severidade: "alerta", fonte: { documento: IN29, dispositivo: "art. 64, § 2º" } },
      { codigo: "mudanca_de_nome", descricao: "Mudar o nome do projeto exige anuência do autor da obra, se houver.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 64, § 1º" } },
      { codigo: "uso_de_rendimentos", descricao: "Usar rendimentos dispensa pedido enquanto captado mais rendimentos não passarem do valor aprovado para execução.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 64, § 10" } },
      { codigo: "uma_por_vez", descricao: "No Salic, só uma alteração fica em edição por vez, e uma em análise bloqueia outra do mesmo tipo.", severidade: "info", fonte: { documento: MODULO_II, dispositivo: "p. 32" } },
    ],
    fonte: { documento: IN29, dispositivo: "art. 64" },
  },

  fornecedores: {
    limites: [
      {
        codigo: "fornecedor",
        descricao: "Pagamentos a um mesmo fornecedor",
        escopo: "fornecedor",
        base: "valor_captado",
        faixas: [{ percentual: 20, severidade: "bloqueio", consequencia: "Pagamento acima do limite por fornecedor" }],
        excecoes: [
          { descricao: "Elaboração de projetos executivos", fonte: { documento: IN29, dispositivo: "art. 24, I" } },
          { descricao: "Conservação e restauro de bens tombados, acautelados ou de reconhecido valor cultural", fonte: { documento: IN29, dispositivo: "art. 24, II" } },
          { descricao: "Construção, reforma, requalificação ou adequação de equipamentos culturais", fonte: { documento: IN29, dispositivo: "art. 24, III" } },
          { descricao: "Serviços gráficos de livros artísticos, literários ou humanísticos", fonte: { documento: IN29, dispositivo: "art. 24, IV" } },
          { descricao: "Energia elétrica", fonte: { documento: IN29, dispositivo: "art. 24, V" } },
        ],
        fonte: {
          documento: IN29,
          dispositivo: "art. 24, caput",
          citacao: "Um mesmo fornecedor não poderá ter pagamento acima de 20% (vinte por cento) do valor captado",
          nota: "A IN não define \"mesmo fornecedor\"; agrupar pelo CNPJ raiz. O Módulo II fala em 20% dos valores executados.",
        },
      },
      {
        codigo: "proponente",
        descricao: "Remuneração do proponente e partes relacionadas",
        escopo: "proponente_e_relacionados",
        base: "valor_captado",
        faixas: [{ percentual: 20, severidade: "bloqueio", consequencia: "Remuneração do proponente acima do limite" }],
        excecoes: [
          {
            descricao: "Grupos artísticos familiares, corpos artísticos estáveis e coletivos que atuem na execução: sem limite percentual, com justificativa",
            fonte: { documento: IN29, dispositivo: "art. 23, § 2º, I" },
          },
        ],
        fonte: {
          documento: IN29,
          dispositivo: "art. 23, caput",
          citacao: "os valores das remunerações não ultrapassem 20%",
          nota: "Só por serviço previsto no orçamento analítico.",
        },
      },
      {
        codigo: "proponente_pf_mei",
        descricao: "Remuneração do proponente pessoa física ou MEI",
        escopo: "proponente_pf_mei",
        base: "valor_captado",
        faixas: [{ percentual: 30, severidade: "bloqueio", consequencia: "Remuneração do proponente acima do limite" }],
        excecoes: [],
        fonte: { documento: IN29, dispositivo: "art. 23, § 2º, II", citacao: "limitado a até 30% (trinta por cento) do valor captado" },
      },
    ],
    partesRelacionadas: {
      descricao: "Cônjuge, companheiro, empresa coligada e empresa com sócio em comum entram no limite do proponente.",
      fonte: { documento: IN29, dispositivo: "art. 23, § 1º", citacao: "serão computados no limite do proponente previsto no caput" },
    },
    regras: [
      {
        codigo: "servico_ao_incentivador",
        descricao: "Pagar, com a captação ou outra rubrica, serviço prestado ao incentivador é vantagem indevida.",
        severidade: "bloqueio",
        fonte: { documento: IN29, dispositivo: "art. 19, § 3º; art. 33, IV" },
      },
      {
        codigo: "fornecimento_pelo_incentivador",
        descricao: "Fornecimento pelo incentivador com economicidade ou exclusividade não é vantagem indevida.",
        severidade: "info",
        fonte: { documento: IN29, dispositivo: "art. 66" },
      },
    ],
    fonte: { documento: IN29, dispositivo: "arts. 23 e 24" },
  },

  contas: {
    contas: [
      { tipo: "captacao", descricao: "Conta captação, bloqueada, onde o incentivador deposita", abertaPor: "orgao" },
      { tipo: "movimento", descricao: "Conta movimento, de livre movimentação, para executar o projeto", abertaPor: "orgao" },
    ],
    bancos: ["Banco do Brasil"],
    descricao: "Conta captação e conta movimento, abertas pelo MinC no Banco do Brasil, vinculadas ao CPF ou CNPJ do proponente.",
    tarifas: {
      regra: "isentas",
      descricao: "As contas do projeto são isentas de tarifas; tarifa necessária à atividade administrativa entra nos custos de administração.",
      fonte: { documento: IN29, dispositivo: "art. 53, caput; art. 22, III", citacao: "isentas de tarifas bancárias" },
    },
    liberacao: {
      descricao: "Liberação para execução depois da homologação, ao captar 20% do valor total do projeto, contando rendimentos, recursos de outro projeto e doações em bens ou serviços. Planos anuais e plurianuais: 1/12 a 1/48. Exceções: restauro urgente e contrato de patrocínio.",
      percentualMinimo: 20,
      base: "valor_total_projeto",
      fonte: { documento: IN29, dispositivo: "art. 56, caput e §§ 1º e 2º", citacao: "será liberado para execução quando atingir 20% (vinte por cento) do valor total do projeto" },
    },
    rendimentos: {
      aplicacao: "automatica",
      contamComoCaptado: true,
      uso: "Usados no projeto sem pedido enquanto captado mais rendimentos não passarem do valor aprovado para execução; contam para os 20% da liberação e voltam ao FNC com o saldo.",
      fonte: { documento: IN29, dispositivo: "art. 54, § 2º; art. 56; art. 64, § 10; art. 68, IV", citacao: "serão automaticamente investidos em fundo de aplicação financeira de curto prazo" },
    },
    saldo: {
      descricao: "O saldo remanescente pode ser transferido uma vez para outro projeto do mesmo proponente com captação vigente; sem pedido, aprovação ou efetivação em 20 dias, vai ao FNC.",
      prazo: null,
      fonte: { documento: IN29, dispositivo: "art. 61 e § 2º", citacao: "não seja efetivado no prazo de até 20 (vinte) dias, o saldo remanescente será recolhido ao Fundo Nacional da Cultura" },
    },
    regras: [
      { codigo: "cadin_cnd", descricao: "Cada transferência da captação para o movimento passa pela consulta ao CADIN e à CND.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 57" } },
      { codigo: "captacao_fora_do_prazo", descricao: "Captação depositada fora do prazo da Portaria é desconsiderada.", severidade: "alerta", fonte: { documento: IN29, dispositivo: "art. 54, § 3º" } },
      { codigo: "captacao_acima", descricao: "Captação acima do aprovado admite complementação ou transferência, com anuência dos incentivadores PJ.", severidade: "alerta", fonte: { documento: IN29, dispositivo: "art. 54, § 4º" } },
      { codigo: "doacao_em_bens", descricao: "Doação ou patrocínio em bens e serviços exige rubrica, carta do patrocinador e valor até o aprovado na rubrica.", severidade: "alerta", fonte: { documento: IN29, dispositivo: "art. 54, §§ 7º e 8º" } },
      { codigo: "bloqueio_judicial", descricao: "Bloqueio judicial ou penhora: 20 dias para desbloquear ou restituir, sob pena de inadimplência.", severidade: "alerta", parametros: { dias: 20 }, fonte: { documento: IN29, dispositivo: "art. 55" } },
      { codigo: "contas_inativas", descricao: "Contas sem saldo nem movimento por 36 meses são encerradas.", severidade: "info", parametros: { meses: 36 }, fonte: { documento: IN29, dispositivo: "art. 53, § 3º" } },
      {
        codigo: "bloqueio_fim_execucao",
        descricao: "O MinC bloqueia as contas no fim da execução, mas o art. 69 dá 60 dias para concluir pagamentos: pagamento depois do fim da execução precisa do fato gerador no prazo.",
        severidade: "alerta",
        fonte: { documento: IN29, dispositivo: "arts. 69 e 70", aConfirmar: true },
      },
    ],
    fonte: { documento: IN29, dispositivo: "arts. 53 a 61", citacao: "abertas pelo Ministério da Cultura, exclusivamente no Banco do Brasil" },
  },

  pagamentos: {
    meiosPermitidos: ["pix", "ted", "doc", "boleto", "debito_automatico"],
    meiosVedados: [],
    descricao: "Só mecanismos formais de pagamento, como PIX e TED. A IN não veda saque nem cheque; o Salic ainda lista os dois. Saque, cheque e cartão pedem justificativa.",
    documentoFiscal: [
      { codigo: "documento_anexo", descricao: "Cada débito tem nota fiscal, recibo, RPCI, fatura ou contracheque anexado no Salic, com cotação nos casos exigidos e licitação se o proponente for público.", severidade: "bloqueio", fonte: { documento: IN29, dispositivo: "art. 68, I a III" } },
      { codigo: "consulta_nfe", descricao: "Autorizar o MinC, como terceiro, a consultar documentos fiscais eletrônicos.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 68, parágrafo único" } },
      { codigo: "em_nome_do_proponente", descricao: "Documento em nome do proponente, com descrição igual à da planilha e retenções de ISS, INSS e IR quando houver.", severidade: "alerta", fonte: { documento: MODULO_III, dispositivo: "p. 28–29", nota: "Exigência do manual, não da IN." } },
      { codigo: "data_de_emissao", descricao: "Emissão depois da Portaria de captação e até o fim da execução.", severidade: "alerta", fonte: { documento: MODULO_III, dispositivo: "p. 29" } },
      { codigo: "numero_do_pagamento", descricao: "O número do documento de pagamento no comprovante é igual ao do lançamento no extrato, sem ponto nem vírgula.", severidade: "alerta", fonte: { documento: MODULO_II, dispositivo: "p. 29 e 59" } },
      { codigo: "pronac_na_nota", descricao: "A IN não exige o Pronac na nota fiscal.", severidade: "info", fonte: { documento: IN29, dispositivo: "Anexo I, XIV, b, XV e XVI" } },
    ],
    regras: [
      { codigo: "saque_cheque_cartao", descricao: "Saque, espécie, cheque e cartão não estão previstos: exigir justificativa.", severidade: "alerta", fonte: { documento: IN29, dispositivo: "art. 58; Anexo I, XVI", aConfirmar: true } },
      { codigo: "recurso_proprio", descricao: "Pagar com recurso próprio só sem saldo e para item aprovado; o ressarcimento vai só para conta do próprio proponente.", severidade: "bloqueio", fonte: { documento: IN29, dispositivo: "art. 59 e parágrafo único" } },
      { codigo: "estorno", descricao: "Pagamento equivocado é estornado à conta movimento.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 60" } },
    ],
    fonte: {
      documento: IN29,
      dispositivo: "art. 58",
      citacao: "exclusivamente por meio de mecanismos formais de pagamento, como PIX e TED",
      aConfirmar: true,
      nota: "\"Como PIX e TED\" é exemplificativo: boleto e débito de guia são meios formais. Outros meios geram alerta, não bloqueio.",
    },
  },

  despesas: {
    periodo: {
      descricao: "Despesas entre a publicação da Portaria de captação e o fim da execução; as anteriores à liberação são ressarcíveis, as anteriores à Portaria nunca. Pagamentos até 60 dias depois do fim da vigência; despesa fora do prazo gera ressalva, salvo fato gerador no prazo.",
      fonte: { documento: IN29, dispositivo: "art. 47, §§ 1º a 3º; art. 69; art. 76, II, h" },
    },
    vedadas: [
      { codigo: "taxa_administracao", descricao: "Taxa de administração ou similar", fonte: { documento: IN29, dispositivo: "art. 33, I" } },
      { codigo: "agente_publico", descricao: "Pagamento a agente público ou político, salvo LDO ou lei específica", fonte: { documento: IN29, dispositivo: "art. 33, II" } },
      { codigo: "captacao_vedada", descricao: "Captação em projeto de edital com incentivo exclusivo, de instituição criada pelo incentivador ou em obra de bem tombado do proponente", fonte: { documento: IN29, dispositivo: "art. 33, III, a e b, e § 2º, k" } },
      { codigo: "servico_ao_incentivador", descricao: "Serviços prestados ao incentivador", fonte: { documento: IN29, dispositivo: "art. 33, IV" } },
      { codigo: "sem_relacao_com_objeto", descricao: "Despesa sem relação direta, necessária e comprovada com o objeto", fonte: { documento: IN29, dispositivo: "art. 33, V" } },
      { codigo: "taxi_alimentacao_pessoal", descricao: "Táxi ou aplicativo fora da localidade ou como gasto pessoal; alimentação como gasto pessoal", fonte: { documento: IN29, dispositivo: "art. 33, § 2º, a e b" } },
      { codigo: "produto_de_outro_projeto", descricao: "Compra de produtos de outro projeto incentivado", fonte: { documento: IN29, dispositivo: "art. 33, § 2º, c" } },
      { codigo: "estrutura_permanente", descricao: "Estrutura permanente ou residencial, contas domésticas e locação permanente fora de plano anual", fonte: { documento: IN29, dispositivo: "art. 33, § 2º, d e e" } },
      { codigo: "passagem_nao_aprovada", descricao: "Passagens para trechos não aprovados; primeira classe ou executiva sem recurso não incentivado ou aprovação da CNIC", fonte: { documento: IN29, dispositivo: "art. 33, § 2º, f e h" } },
      { codigo: "festas_vip", descricao: "Convites, camarotes, espaços VIP, festas, coquetéis e bufê", fonte: { documento: IN29, dispositivo: "art. 33, § 2º, g" } },
      { codigo: "midia_audiovisual", descricao: "Espaço de rádio e TV no audiovisual, salvo divulgação do produto principal", fonte: { documento: IN29, dispositivo: "art. 33, § 2º, i" } },
      { codigo: "bem_permanente_administracao", descricao: "Bem permanente do proponente nos custos de administração", fonte: { documento: IN29, dispositivo: "art. 33, § 2º, j" } },
      { codigo: "imagem_agente_politico", descricao: "Difusão da imagem de agente político", fonte: { documento: IN29, dispositivo: "art. 32, I" } },
    ],
    regras: [
      { codigo: "anterior_a_portaria", descricao: "Despesa anterior à Portaria de captação não é ressarcida.", severidade: "bloqueio", fonte: { documento: IN29, dispositivo: "art. 47, § 3º" } },
      { codigo: "onus_da_prova", descricao: "A pertinência das despesas é ônus do proponente.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 33, § 1º; art. 69, § 6º" } },
      { codigo: "cotacoes", descricao: "Cópia das cotações de preços nas hipóteses da IN.", severidade: "alerta", fonte: { documento: IN29, dispositivo: "art. 68, II" } },
      { codigo: "equipe_e_encargos", descricao: "Contador com registro no conselho, advogado pela tabela da OAB, encargos e benefícios do profissional da cultura.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 17, §§ 2º a 4º" } },
    ],
    fonte: { documento: IN29, dispositivo: "arts. 33 e 47" },
  },

  porte: {
    base: "valor_captado",
    faixas: [
      { nome: "pequeno", ate: 750_000 },
      { nome: "medio", ate: 5_000_000 },
      { nome: "grande", ate: null },
    ],
    regras: [
      { codigo: "analise_por_inconformidade", descricao: "Pequeno e médio porte: análise financeira só das inconformidades do Relatório de Execução Financeira; grande porte pode ter verificação ampliada.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 74, §§ 1º e 2º" } },
      { codigo: "verificacao_ampliada", descricao: "Em qualquer porte, verificação ampliada com apontamentos de fiscalização, diligências de controle, denúncias fundadas ou inconformidades não sanadas até o fim da execução.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 75" } },
      {
        codigo: "ate_200_mil",
        descricao: "Até R$ 200 mil, a avaliação do objeto pode ser substituída pela validação in loco do monitoramento, se não houver inconformidade de objeto não sanada.",
        severidade: "info",
        parametros: { valor: 200_000 },
        fonte: { documento: IN29, dispositivo: "art. 73, §§ 3º e 4º", aConfirmar: true, nota: "A IN não diz se a base é o captado ou o aprovado." },
      },
    ],
    fonte: { documento: IN29, dispositivo: "art. 72, parágrafo único", citacao: "pequeno porte: aqueles com captação até R$ 750.000,00" },
  },

  objeto: {
    descricao: "Relatório final com a comprovação do objeto, metas propostas × resultados, produtos, acessibilidade e democratização, peças de divulgação e bens; em captação parcial, a análise considera a proporção entre captado e executado.",
    regras: [
      { codigo: "metas_resultados", descricao: "Comparativo de metas propostas e resultados, a partir do cronograma físico.", severidade: "bloqueio", fonte: { documento: IN29, dispositivo: "art. 69, II" } },
      { codigo: "evidencias", descricao: "Comprovação da realização do objeto com evidências: exemplar, fotos, listas de presença, arquivos digitais, registro audiovisual.", severidade: "bloqueio", fonte: { documento: IN29, dispositivo: "art. 69, I e III" } },
      { codigo: "objetivos_mensuraveis", descricao: "Objetivos específicos mensuráveis e comprovados na prestação de contas.", severidade: "alerta", fonte: { documento: MODULO_II, dispositivo: "p. 37" } },
      { codigo: "captacao_parcial", descricao: "Em captação parcial, a análise considera a proporção entre captado e executado e entre as contrapartidas.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 73, § 1º" } },
      { codigo: "acessibilidade", descricao: "Medidas de acessibilidade comprovadas; sem elas, a prestação é aprovada com ressalvas.", severidade: "alerta", fonte: { documento: IN29, dispositivo: "art. 69, IV; art. 76, II, g" } },
      {
        codigo: "cotas_distribuicao",
        descricao: "Plano de distribuição: até 10% para patrocinadores, até 10% promocional do proponente, no mínimo 10% gratuito social ou educativo e no mínimo 20% vendido a até R$ 50.",
        severidade: "bloqueio",
        parametros: { patrocinadoresMax: 10, proponenteMax: 10, socialMin: 10, popularMin: 20, precoPopular: 50 },
        fonte: { documento: IN29, dispositivo: "art. 41, I a IV", citacao: "mínimo de 20% (vinte por cento) para comercialização em valores que não ultrapassem R$ 50,00" },
      },
      { codigo: "preco_medio", descricao: "Fora das cotas, preço médio do ingresso inteiro até R$ 250.", severidade: "bloqueio", parametros: { valor: 250 }, fonte: { documento: IN29, dispositivo: "art. 41, § 3º" } },
      { codigo: "meia_entrada", descricao: "Meia-entrada de estudantes em ao menos 40% dos ingressos vendidos; idosos, ID Jovem e pessoas com deficiência em todos.", severidade: "alerta", parametros: { estudantesMin: 40 }, fonte: { documento: IN29, dispositivo: "art. 41, § 2º" } },
      { codigo: "receita_prevista", descricao: "Receita prevista até o valor total do projeto.", severidade: "bloqueio", fonte: { documento: IN29, dispositivo: "art. 41, § 4º" } },
      { codigo: "ampliacao_de_acesso", descricao: "Ao menos uma medida de ampliação de acesso.", severidade: "bloqueio", fonte: { documento: IN29, dispositivo: "art. 42" } },
      { codigo: "contrapartida_social", descricao: "Com venda, ações formativas para ao menos 10% do público do produto principal, entre 20 e 500 beneficiários da rede pública.", severidade: "bloqueio", parametros: { percentual: 10, minimo: 20, maximo: 500 }, fonte: { documento: IN29, dispositivo: "art. 44, § 1º" } },
      { codigo: "vale_cultura", descricao: "Atividades permanentes aceitam Vale-Cultura.", severidade: "alerta", fonte: { documento: IN29, dispositivo: "art. 41, § 6º" } },
      { codigo: "alteracao_do_plano", descricao: "Alterar o plano de distribuição sem prejuízo da democratização leva a aprovação com ressalvas.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 76, II, f" } },
      { codigo: "deposito_legal", descricao: "Obra audiovisual e produtos fora do Salic são entregues no suporte original, com depósito na Cinemateca e depósito legal na FBN quando couber.", severidade: "alerta", fonte: { documento: IN29, dispositivo: "art. 69, §§ 2º a 5º" } },
      { codigo: "bens", descricao: "Relação de bens móveis, obras de arte e imóveis, termo de aceitação de obra e recibo do destinatário de bem doado.", severidade: "alerta", fonte: { documento: IN29, dispositivo: "art. 69, VI a X" } },
    ],
    fonte: { documento: IN29, dispositivo: "arts. 41 a 44, 69 e 73" },
  },

  divulgacao: {
    marcas: ["Lei de Incentivo à Cultura (Lei Rouanet)", "Ministério da Cultura", "Governo Federal"],
    aprovacaoPrevia: {
      exigida: true,
      prazo: "aprovacaoPeca",
      silencioAprova: true,
      descricao: "Material de divulgação e leiaute das marcas submetidos ao MinC antes de circular; sem resposta em 5 dias úteis, o material está aprovado.",
      fonte: { documento: IN29, dispositivo: "art. 21, §§ 2º e 3º", citacao: "Previamente à sua circulação, o material de divulgação e o leiaute de aplicação das marcas nos produtos deverão ser submetidos ao Ministério da Cultura" },
    },
    defeso: {
      descricao: "A partir de 04/07/2026 e até as eleições: marca da Lei Rouanet e assinatura do MinC próprias do período, sem a marca do Governo Federal; a expressão \"Ministério da Cultura apresenta\" continua.",
      fonte: { documento: MARCAS_DEFESO, dispositivo: "p. 1 a 8", aConfirmar: true, nota: "O manual não fixa a data de fim; o calendário regulatório guarda o defeso." },
    },
    regras: [
      { codigo: "marcas_em_todas_as_pecas", descricao: "Marcas em todas as peças de divulgação, qualquer que seja a fonte do recurso e quem divulga.", severidade: "bloqueio", fonte: { documento: IN29, dispositivo: "art. 21, §§ 1º e 4º" } },
      { codigo: "expressao_apresenta", descricao: "\"Ministério da Cultura apresenta\" em primeiro lugar, em impressos, mídias digitais, rádio, TV, cinema e espetáculos.", severidade: "alerta", fonte: { documento: MARCAS, dispositivo: "p. 7–8" } },
      { codigo: "posicao_da_marca", descricao: "Marca da Lei Rouanet à esquerda no bloco (ou no topo), sem status de participação; Governo Federal por último.", severidade: "alerta", fonte: { documento: MARCAS, dispositivo: "p. 15, 19, 27 a 29" } },
      { codigo: "reducao_minima", descricao: "Redução mínima de 3,5 cm no impresso e 200 px no digital.", severidade: "alerta", parametros: { cm: 3.5, px: 200 }, fonte: { documento: MARCAS, dispositivo: "p. 39", aConfirmar: true } },
      { codigo: "ressalva_por_marca", descricao: "Não cumprir o Manual de Uso da Marca leva a aprovação com ressalvas.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 76, II, c" } },
      { codigo: "marca_do_patrocinador", descricao: "Marca do patrocinador, conforme as regras do MinC, não é vantagem indevida.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 66, VII" } },
    ],
    fonte: { documento: IN29, dispositivo: "art. 21" },
  },

  envio: {
    sistema: "Salic",
    descricao: "Relatório final do objeto e comprovação financeira enviados juntos no Salic, em até 60 dias do fim da vigência; o botão de envio só libera sem pendências.",
    documentos: [
      { codigo: "relatorio_objeto", descricao: "Relatório de cumprimento do objeto, com evidências, metas × resultados e produtos", em: ["final"], obrigatorio: true, fonte: { documento: IN29, dispositivo: "art. 69, I a III" } },
      { codigo: "acessibilidade_democratizacao", descricao: "Medidas de acessibilidade e de democratização do acesso", em: ["final"], obrigatorio: true, fonte: { documento: IN29, dispositivo: "art. 69, IV" } },
      { codigo: "pecas_divulgacao", descricao: "Amostras ou registros das peças do plano de divulgação", em: ["final"], obrigatorio: true, fonte: { documento: IN29, dispositivo: "art. 69, V" } },
      { codigo: "bens", descricao: "Relação de bens móveis, obras de arte e imóveis, com a cotação do art. 30", em: ["final"], obrigatorio: false, fonte: { documento: IN29, dispositivo: "art. 69, VI e VII" } },
      { codigo: "aceitacao_obra", descricao: "Termo de aceitação definitiva da obra", em: ["final"], obrigatorio: false, fonte: { documento: IN29, dispositivo: "art. 69, VIII" } },
      { codigo: "aprovacao_patrimonio", descricao: "Aprovação dos órgãos de patrimônio, em projetos de restauro", em: ["final"], obrigatorio: false, fonte: { documento: IN29, dispositivo: "art. 69, IX" } },
      { codigo: "recibo_doacao_bem", descricao: "Recibo do destinatário de bem permanente doado a entidade pública cultural", em: ["final"], obrigatorio: false, fonte: { documento: IN29, dispositivo: "art. 69, X" } },
      { codigo: "comprovantes_despesa", descricao: "Notas fiscais, recibos, RPCI, faturas e contracheques de cada débito", em: ["final"], obrigatorio: true, fonte: { documento: IN29, dispositivo: "art. 68, III" } },
      { codigo: "cotacoes", descricao: "Cópias das cotações, nas hipóteses da IN", em: ["final"], obrigatorio: false, fonte: { documento: IN29, dispositivo: "art. 68, II" } },
      { codigo: "licitacao", descricao: "Licitação, dispensa ou inexigibilidade, se o proponente for da administração pública", em: ["final"], obrigatorio: false, fonte: { documento: IN29, dispositivo: "art. 68, I" } },
      { codigo: "recolhimento_fnc", descricao: "Comprovante de recolhimento ao FNC do saldo e dos rendimentos, ou da transferência do saldo", em: ["final"], obrigatorio: true, fonte: { documento: IN29, dispositivo: "art. 68, IV; art. 61" } },
    ],
    modelos: [
      { codigo: "gru_fnc", nome: "GRU de recolhimento ao FNC", formato: "PagTesouro", arquivo: null, fonte: { documento: MODULO_III, dispositivo: "p. 31" } },
    ],
    regras: [
      { codigo: "etapas_lancadas", descricao: "Etapas executadas lançadas em Etapas de Trabalho.", severidade: "bloqueio", fonte: { documento: MODULO_II, dispositivo: "p. 62–63" } },
      { codigo: "locais_comprovados", descricao: "Todos os itens do local de realização comprovados.", severidade: "bloqueio", fonte: { documento: MODULO_II, dispositivo: "p. 62–63" } },
      { codigo: "itens_comprovados", descricao: "Itens orçamentários usados comprovados.", severidade: "bloqueio", fonte: { documento: MODULO_II, dispositivo: "p. 62–63" } },
      { codigo: "sem_diligencia_aberta", descricao: "Nenhuma diligência sem resposta.", severidade: "bloqueio", fonte: { documento: MODULO_II, dispositivo: "p. 62–63" } },
      { codigo: "sem_readequacao_em_analise", descricao: "Nenhuma readequação em análise ou aberta.", severidade: "bloqueio", fonte: { documento: MODULO_II, dispositivo: "p. 62–63" } },
      { codigo: "aportes_validados", descricao: "Todos os aportes validados no Salic.", severidade: "bloqueio", fonte: { documento: MODULO_II, dispositivo: "p. 62–63" } },
      { codigo: "saldo_liquidado", descricao: "Nenhum saldo remanescente: recolhido ao FNC ou transferido.", severidade: "bloqueio", fonte: { documento: MODULO_II, dispositivo: "p. 62–63" } },
      { codigo: "anexos", descricao: "Anexos em PDF de até 5 MB.", severidade: "alerta", parametros: { mb: 5 }, fonte: { documento: MODULO_III, dispositivo: "p. 12 e 44" } },
    ],
    fonte: { documento: IN29, dispositivo: "arts. 68 e 69" },
  },

  posEnvio: {
    resultados: [
      { resultado: "aprovada", descricao: "Execução integral, ampliada ou parcial proporcional à captação; inadequações sanadas.", fonte: { documento: IN29, dispositivo: "art. 76, I, a a e" } },
      { resultado: "aprovada_ressalvas", descricao: "Inadequações financeiras sem dolo, alteração sem anuência, marca fora do manual, falta de cessão de direitos, mudança de conteúdo ou do plano de distribuição, acessibilidade não comprovada ou despesa fora do prazo.", fonte: { documento: IN29, dispositivo: "art. 76, II, a a h" } },
      { resultado: "reprovada", descricao: "Omissão no dever de prestar contas, descumprimento do objeto ou dano ao erário; reprovação por objeto reprova toda a execução financeira.", fonte: { documento: IN29, dispositivo: "art. 76, III e § 1º" } },
    ],
    devolucao: {
      descricao: "Recolhimento ao FNC: saldo e rendimentos no encerramento; valores irregulares em 20 dias do registro da reprovação.",
      atualizacao: "Índice da caderneta de poupança desde o fim do prazo de captação; juros depois da mora.",
      gru: [
        {
          unidadeGestora: "340034",
          gestao: null,
          codigo: "019473",
          referencia: "Número do Pronac",
          fonte: { documento: MODULO_III, dispositivo: "p. 31", nota: "Órgão arrecadador 34902 (Fundo Nacional de Cultura); serviço 019473 – FNC, recursos decorrentes de não aplicação de incentivos fiscais." },
        },
      ],
      fonte: { documento: IN29, dispositivo: "arts. 68, IV, e 77" },
    },
    regras: [
      { codigo: "analise_preditiva", descricao: "No dia seguinte ao envio, a análise preditiva abre diligência de 20 dias com os apontamentos do Compliance.", severidade: "alerta", parametros: { dias: 20 }, fonte: { documento: MODULO_II, dispositivo: "p. 64" } },
      { codigo: "diligencia_suspende", descricao: "Diligência suspende os prazos de análise.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 95, § 1º" } },
      { codigo: "prescricao", descricao: "Análise além de 6 meses do envio inicia a prescrição quinquenal; interrompida, a contagem passa a 3 anos.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 71, parágrafo único; art. 80, § 4º" } },
      { codigo: "acoes_compensatorias", descricao: "Durante o prazo recursal, pedir ações compensatórias implica renúncia ao recurso e suspende a mora.", severidade: "info", fonte: { documento: IN29, dispositivo: "art. 78, § 4º" } },
      { codigo: "inadimplencia", descricao: "Omissão em diligência gera inadimplência, que impede prorrogações, alterações e novos projetos até o recolhimento.", severidade: "alerta", fonte: { documento: IN29, dispositivo: "arts. 83 e 88" } },
      { codigo: "inabilitacao", descricao: "Inabilitação por 3 anos depois do prazo recursal ou do recurso indeferido, extensível a corresponsáveis.", severidade: "info", parametros: { anos: 3 }, fonte: { documento: IN29, dispositivo: "arts. 79 e 86, §§ 1º e 2º" } },
      { codigo: "cobranca", descricao: "CADIN e SIAFI, PGFN em até 90 dias e TCE em até 120 dias (omissão) ou 360 dias (demais).", severidade: "info", parametros: { pgfn: 90, tceOmissao: 120, tceDemais: 360 }, fonte: { documento: IN29, dispositivo: "art. 79; art. 90, § 1º" } },
      { codigo: "reabertura", descricao: "Contas aprovadas podem ser reabertas uma vez, em até 2 anos da aprovação.", severidade: "info", parametros: { anos: 2 }, fonte: { documento: IN29, dispositivo: "art. 81, § 1º" } },
    ],
    fonte: { documento: IN29, dispositivo: "arts. 71 a 91" },
  },

  guarda: {
    marco: "fim_vigencia",
    quantidade: 5,
    unidade: "anos",
    prorrogaParaDiaUtil: false,
    descricao: "Manter a documentação do projeto e apresentá-la ao MinC e aos órgãos de controle; não descartar com análise, recurso, cobrança ou reabertura em curso.",
    fonte: { documento: IN29, dispositivo: "art. 82", citacao: "pelo prazo de 5 (cinco) anos, contados do final da sua vigência" },
  },
} satisfies RegimeNormativo;
