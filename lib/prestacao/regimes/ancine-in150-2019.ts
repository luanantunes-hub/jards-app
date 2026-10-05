// Audiovisual (ANCINE), projetos aprovados antes de 17/01/2022: IN ANCINE
// 150/2019 (despesas a partir de 01/01/2020; antes, IN 125/2015).
//
// O Manual de Prestação de Contas v2.11 registra as diferenças para a IN 159
// (marco inicial das despesas, folha de pessoal, aplicação obrigatória,
// documento fiscal depois do débito, prazo dos documentos digitalizados). O
// resto vem da IN 159 marcado "a confirmar".

import { ANCINE_IN159_2021 } from "./ancine-in159-2021";
import { herdarRegime } from "./herdar";
import { definida, type RegimeNormativo } from "./tipos";

const MANUAL = "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)";

const base = herdarRegime(ANCINE_IN159_2021, "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida.");
const baseContas = definida(base.contas)!;
const baseDespesas = definida(base.despesas)!;
const basePagamentos = definida(base.pagamentos)!;
const baseEnvio = definida(base.envio)!;

export const ANCINE_IN150_2019: RegimeNormativo = {
  ...base,
  codigo: "ancine_in150_2019",
  versao: 1,
  nome: "Audiovisual (ANCINE) — IN 150/2019",
  normaReferencia: "Lei 8.685/1993; Lei 8.313/1991, arts. 18 e 25; MP 2.228-1/2001; IN ANCINE 150/2019 (IN 125/2015 para despesas até 2019)",
  vigenteDesde: "2020-01-01",
  fontes: [
    { documento: "Manuais de prestação de contas (ANCINE)", url: "https://www.gov.br/ancine/pt-br/assuntos/atribuicoes-ancine/fomento/prestacao-de-contas/manuais" },
    { documento: "IN ANCINE 159/2021, art. 63 (transição)", url: "https://www.gov.br/ancine/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-159" },
  ],

  aplicabilidade: {
    criterio: "aprovacao_projeto",
    desde: null,
    ate: "2022-01-16",
    descricao: "Projetos aprovados antes de 17/01/2022, com despesas a partir de 01/01/2020 pela IN 150; despesas anteriores seguem a IN 125/2015.",
    sucede: [],
    fonte: { documento: MANUAL, dispositivo: "p. 4; IN 159, art. 63" },
  },

  contas: {
    ...baseContas,
    rendimentos: {
      aplicacao: "obrigatoria",
      contamComoCaptado: null,
      uso: "Aplicação obrigatória; sem ela, advertência e aprovação com ressalvas. Os rendimentos são aporte complementar, sujeitos às mesmas regras.",
      fonte: { documento: MANUAL, dispositivo: "p. 25" },
    },
  },

  pagamentos: {
    ...basePagamentos,
    documentoFiscal: basePagamentos.documentoFiscal.map(regra => regra.codigo !== "emissao_30_dias" ? regra : {
      ...regra,
      descricao: "A IN 150 não admitia nota emitida depois do débito; por retroatividade benéfica, aceitam-se até 30 dias.",
      fonte: { documento: MANUAL, dispositivo: "p. 4 e 29–30" },
    }),
  },

  despesas: {
    ...baseDespesas,
    periodo: {
      descricao: "Despesas depois da publicação da aprovação no DOU; direitos autorais ou roteiro até 1 ano antes, se pagos como contrapartida ou por outras fontes, até 5% do orçamento global.",
      fonte: { documento: MANUAL, dispositivo: "p. 28 e 64" },
    },
    vedadas: baseDespesas.vedadas.filter(vedada => vedada.codigo !== "folha_da_proponente"),
    regras: [
      ...baseDespesas.regras,
      { codigo: "folha_de_pessoal", descricao: "Folha de pessoal admitida, com contracheque (bruto na RP), lista de funcionários, encargos, folha do projeto, recibo de reembolso e relatório de tempo dedicado.", severidade: "alerta", fonte: { documento: MANUAL, dispositivo: "p. 39" } },
    ],
  },

  envio: {
    ...baseEnvio,
    regras: [
      ...baseEnvio.regras,
      { codigo: "documentos_em_180_dias", descricao: "Os documentos fiscais digitalizados podem ser enviados em até 180 dias da diligência.", severidade: "info", parametros: { dias: 180 }, fonte: { documento: "IN ANCINE 159/2021", dispositivo: "Anexo, art. 2º, § 2º" } },
    ],
  },
};
