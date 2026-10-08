// Conjunto de teste do agente normativo (P6.5).
//
// Cada caso dá à IA um regime e um documento, como na leitura de verdade
// (P6.2), e compara a proposta conferida com o gabarito:
//   - as mudanças de 2026 que já viraram regime conferido à mão: dado o
//     regime antigo e a norma nova, a proposta precisa chegar aos valores do
//     regime novo (Portaria 424/2020 → Portaria MESP 10/2026; Anexo LXXXVI →
//     Anexo LXXXVI-A da PRC 5). A Rouanet entrou direto na IN 29/2026, sem
//     regime da IN 23/2025 para servir de ponto de partida; no lugar dela vai
//     uma alteração simulada da IN 29, com as respostas conhecidas;
//   - documentos que não mudam nada: a norma que o regime já reflete e um
//     ato sem relação. Neles, toda mudança proposta é falso alarme.
// O gabarito lista só parâmetros com valor estruturado (número, sim ou não,
// opção, lista) que o próprio documento traz; mudança de redação não entra na
// nota. A citação de cada mudança é conferida no texto antes da nota
// (conferirLeitura): a que não se acha no documento é descartada e conta como
// falta.

// A nota (avaliarLeitura) fica em proposta-regime.ts, junto da conferência;
// daqui só saem os casos.
import type { GabaritoDaLeitura } from "./proposta-regime.ts";

export type DocumentoDoCaso = {
  titulo: string;
  tipo: string;
  orgao: string;
  publicadoEm: string;
  url?: string;
} & (
  /** A última versão guardada de uma fonte vigiada, a partir de um trecho. */
  | { fonte: string; aPartirDe?: string }
  /** Texto escrito para o caso. */
  | { texto: string }
);

export type CasoDoConjunto = {
  codigo: string;
  titulo: string;
  /** O regime que a IA recebe. */
  regime: string;
  /** O documento substitui a norma do regime: a IA propõe o regime que segue o documento. */
  substitui?: string;
  documento: DocumentoDoCaso;
  esperado: GabaritoDaLeitura & {
    /** Regime conferido à mão que segue o documento: os valores esperados saem dele. */
    regime?: string;
  };
};

// Ato fictício que altera a IN 29 (o mesmo dos testes da P6.2).
const IN_40_SIMULADA = [
  "INSTRUÇÃO NORMATIVA MINC Nº 40, DE 1º DE DEZEMBRO DE 2026",
  "Altera a Instrução Normativa MinC nº 29, de 29 de janeiro de 2026.",
  "A MINISTRA DE ESTADO DA CULTURA, no uso das atribuições que lhe conferem o art. 87, parágrafo único, incisos I e II, da Constituição, resolve:",
  "Art. 1º A Instrução Normativa MinC nº 29, de 29 de janeiro de 2026, passa a vigorar com as seguintes alterações:",
  "\"Art. 22. A previsão dos custos de administração não poderá ultrapassar o limite de 12% (doze por cento) do valor do projeto.\" (NR)",
  "\"Art. 69. No período improrrogável de 90 (noventa) dias após o término da vigência do projeto, o proponente deverá concluir os pagamentos e apresentar o relatório final no Salic.\" (NR)",
  "Art. 2º Esta Instrução Normativa entra em vigor em 1º de janeiro de 2027 e aplica-se aos projetos aprovados a partir dessa data.",
  "MARGARETH MENEZES",
].join("\n");

// Ato fictício do mesmo ministério, sem relação com a prestação de contas.
const ATO_SEM_RELACAO = [
  "PORTARIA MESP Nº 215, DE 2 DE OUTUBRO DE 2026",
  "Institui o Comitê de Governança Digital do Ministério do Esporte.",
  "O MINISTRO DE ESTADO DO ESPORTE, no uso das atribuições que lhe confere o art. 87, parágrafo único, incisos I e II, da Constituição, resolve:",
  "Art. 1º Fica instituído o Comitê de Governança Digital do Ministério do Esporte, de caráter deliberativo, com a finalidade de aprovar o Plano de Transformação Digital e acompanhar a sua execução.",
  "Art. 2º O Comitê será composto pelo Secretário-Executivo, que o coordenará, e por um representante de cada secretaria finalística.",
  "Art. 3º O Comitê se reunirá ordinariamente a cada trimestre e, extraordinariamente, por convocação do coordenador.",
  "Art. 4º Esta Portaria entra em vigor na data de sua publicação.",
].join("\n");

export const CONJUNTO: readonly CasoDoConjunto[] = [
  {
    codigo: "lie_portaria_10_2026",
    titulo: "LIE: Portaria 424/2020 → Portaria MESP 10/2026",
    regime: "lie_p424_2020",
    substitui: "Portaria MC 424/2020",
    documento: {
      fonte: "mesp_portaria_10_2026", titulo: "Portaria MESP 10/2026", tipo: "Portaria",
      orgao: "Ministério do Esporte/Gabinete do Ministro", publicadoEm: "2026-03-04",
      url: "https://www.in.gov.br/web/dou/-/portaria-mesp-n-10-de-3-de-marco-de-2026-690209578",
    },
    esperado: {
      classificacoes: ["altera_regra"],
      regime: "lie_p10_2026",
      mudancas: [
        { caminho: "prazos.recurso.quantidade" },
        { caminho: "prazos.transferenciaSaldo.quantidade" },
        { caminho: "alteracoes.tipos.complementacao.requisitos[1].quantidade" },
        { caminho: "alteracoes.tipos.inclusao.permitido" },
        { caminho: "envio.documentos[codigo=grade].obrigatorio" },
        { caminho: "envio.documentos[codigo=bens].em" },
        { caminho: "envio.regras[codigo=arquivos].parametros.mb" },
      ],
    },
  },
  {
    codigo: "saude_anexo_lxxxvi_a",
    titulo: "Saúde: Anexo LXXXVI → Anexo LXXXVI-A (Portaria GM/MS 8.031/2025)",
    regime: "pronon_pronas_lxxxvi_2017",
    substitui: "Anexo LXXXVI da PRC GM/MS 5/2017",
    documento: {
      fonte: "saude_prc5_anexo_lxxxvi", aPartirDe: "ANEXO LXXXVI-A", titulo: "PRC GM/MS 5/2017, Anexo LXXXVI-A",
      tipo: "Portaria", orgao: "Ministério da Saúde/Gabinete do Ministro", publicadoEm: "2025-09-08",
    },
    esperado: {
      classificacoes: ["altera_regra"],
      regime: "pronon_pronas_lxxxvi_a_2025",
      mudancas: [
        { caminho: "prazos.respostaDiligencia.quantidade" },
        { caminho: "prazos.analisePrestacao.quantidade" },
        { caminho: "prazos.recurso.quantidade" },
        { caminho: "prazos.devolucaoSaldo.marco" },
        { caminho: "prazos.notificacaoMonitoramento.quantidade" },
        { caminho: "alteracoes.regras[codigo=prorrogacao].parametros.diasAntes" },
        { caminho: "contas.tarifas.regra" },
        { caminho: "contas.rendimentos.aplicacao" },
        { caminho: "pagamentos.meiosVedados" },
        { caminho: "envio.documentos[codigo=gru].obrigatorio" },
      ],
    },
  },
  {
    codigo: "rouanet_in40_simulada",
    titulo: "Rouanet: alteração simulada da IN 29 (prazo final e teto de administração)",
    regime: "rouanet_in29_2026",
    documento: {
      texto: IN_40_SIMULADA, titulo: "Instrução Normativa MinC 40/2026 (simulada)", tipo: "Instrução Normativa",
      orgao: "Ministério da Cultura/Gabinete da Ministra", publicadoEm: "2026-12-02",
    },
    esperado: {
      classificacoes: ["altera_regra"],
      mudancas: [
        { caminho: "prazos.prestacaoFinal.quantidade", valor: 90 },
        { caminho: "orcamento.tetos[codigo=administracao].percentual", valor: 12 },
      ],
    },
  },
  {
    codigo: "lie_decreto_ja_refletido",
    titulo: "LIE: Decreto 12.861/2026, que o regime já reflete",
    regime: "lie_p10_2026",
    documento: {
      fonte: "planalto_decreto_12861", titulo: "Decreto 12.861/2026", tipo: "Decreto",
      orgao: "Presidência da República", publicadoEm: "2026-02-27",
      url: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/D12861.htm",
    },
    esperado: { classificacoes: ["informativo"], mudancas: [] },
  },
  {
    codigo: "ato_sem_relacao",
    titulo: "Ato do Ministério do Esporte sem relação com a prestação de contas",
    regime: "lie_p10_2026",
    documento: {
      texto: ATO_SEM_RELACAO, titulo: "Portaria MESP 215/2026 (simulada)", tipo: "Portaria",
      orgao: "Ministério do Esporte/Gabinete do Ministro", publicadoEm: "2026-10-05",
    },
    esperado: { classificacoes: ["irrelevante"], mudancas: [] },
  },
];

/** O trecho do documento que a IA lê: a partir do marcador, quando há. */
export function textoDoCaso(texto: string, aPartirDe?: string): string {
  if (!aPartirDe) return texto;
  const inicio = texto.indexOf(aPartirDe);
  return inicio >= 0 ? texto.slice(inicio) : texto;
}
