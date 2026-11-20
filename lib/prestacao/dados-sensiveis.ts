// Dado de saúde na prestação (P9.5). Na saúde, dado de paciente é sensível
// (LGPD, art. 5º, II, e art. 11), e a minuta do Termo de Compromisso (cl. 8ª)
// não quer prontuário no sistema. Aqui ficam as pistas de que um texto traz
// dado clínico: o código CID, o prontuário, o laudo e, na relação de
// beneficiados, a doença, a condição ou o tratamento de alguém. A pista diz o
// tipo, nunca o trecho achado, para o achado não copiar o dado. Sem React e
// sem Supabase.

export type PistaClinica = "codigo_cid" | "prontuario" | "laudo" | "diagnostico" | "condicao" | "tratamento";

export const ROTULO_DA_PISTA: Record<PistaClinica, string> = {
  codigo_cid: "código CID",
  prontuario: "prontuário",
  laudo: "laudo, atestado ou receita",
  diagnostico: "diagnóstico",
  condicao: "doença ou condição de saúde",
  tratamento: "tratamento ou medicação",
};

/**
 * Na relação de beneficiados, tudo conta: o texto é sobre a pessoa. Nas
 * evidências, só o que é documento clínico (CID, prontuário, laudo): a
 * descrição de uma ação de saúde fala de doença e de tratamento sem dizer
 * nada de ninguém.
 */
const PISTAS: readonly { pista: PistaClinica; padrao: RegExp; estrita: boolean }[] = [
  { pista: "codigo_cid", padrao: /\bcid[\s.:-]*(?:1[01])?[\s.:-]*[a-z]\d{2}|\b[a-tv-z]\d{2}\.\d{1,2}\b/, estrita: true },
  { pista: "prontuario", padrao: /\bprontuario/, estrita: true },
  { pista: "laudo", padrao: /\blaudo|\batestado medico|\breceita medica|\bficha (?:clinica|de atendimento|medica)/, estrita: true },
  { pista: "diagnostico", padrao: /\bdiagnostic/, estrita: false },
  {
    pista: "condicao",
    padrao: /\b(?:cancer|neoplasia|tumor|leucemia|linfoma|carcinoma|metastase|hiv|aids|soropositiv|autis|tea\b|tdah|transtorno|sindrome|deficiencia|paralisia|esclerose|diabet|hipertens|depressa|esquizofren|epileps|alzheimer|parkinson|avc\b)/,
    estrita: false,
  },
  { pista: "tratamento", padrao: /\b(?:medicac|medicament|quimioterap|radioterap|internad|internacao|cirurgi|tratamento)/, estrita: false },
];

const normalizar = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** As pistas de dado clínico no texto, na ordem da lista; `estrito` olha só o documento clínico. */
export function pistasDeDadoClinico(texto: string | null | undefined, opcoes: { estrito?: boolean } = {}): PistaClinica[] {
  if (!texto?.trim()) return [];
  const t = normalizar(texto);
  return PISTAS.filter(p => (!opcoes.estrito || p.estrita) && p.padrao.test(t)).map(p => p.pista);
}

/** As pistas sem repetir, na ordem da lista. */
export function ordenarPistas(pistas: Iterable<PistaClinica>): PistaClinica[] {
  const achadas = new Set(pistas);
  return PISTAS.map(p => p.pista).filter(p => achadas.has(p));
}

/** As pistas de vários textos juntos. */
export const pistasDosTextos = (textos: readonly (string | null | undefined)[], opcoes: { estrito?: boolean } = {}) =>
  ordenarPistas(textos.flatMap(t => pistasDeDadoClinico(t, opcoes)));

export const descreverPistas = (pistas: readonly PistaClinica[]) => {
  const rotulos = pistas.map(p => ROTULO_DA_PISTA[p]);
  return rotulos.length <= 1 ? (rotulos[0] ?? "") : `${rotulos.slice(0, -1).join(", ")} e ${rotulos.at(-1)}`;
};

/** O que da relação de beneficiados é olhado: as observações, a modalidade e os benefícios. */
export const textosDoBeneficiado = (b: { observacoes?: string | null; modalidade?: string | null; beneficios?: readonly string[] | null }) =>
  [b.observacoes, b.modalidade, ...(b.beneficios ?? [])];

/** O que da evidência é olhado: o nome do arquivo e a descrição. A justificativa fica de fora: é a resposta ao alerta. */
export const textosDaEvidencia = (e: { nome_arquivo?: string | null; descricao?: string | null }) =>
  [e.nome_arquivo?.replace(/[_.-]+/g, " "), e.descricao];

/** O nome já trocado pelo descarte: "Pessoa 12". */
export const nomeAnonimizado = (nome: string) => /^Pessoa \d+$/.test(nome);
