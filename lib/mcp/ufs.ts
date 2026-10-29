import { chaveDoNome } from "@/lib/dominio";

export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;
export type Uf = (typeof UFS)[number];

const POR_NOME: Record<string, Uf> = {
  acre: "AC",
  alagoas: "AL",
  amazonas: "AM",
  amapa: "AP",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "minas gerais": "MG",
  "mato grosso do sul": "MS",
  "mato grosso": "MT",
  para: "PA",
  paraiba: "PB",
  pernambuco: "PE",
  piaui: "PI",
  parana: "PR",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  rondonia: "RO",
  roraima: "RR",
  "rio grande do sul": "RS",
  "santa catarina": "SC",
  sergipe: "SE",
  "sao paulo": "SP",
  tocantins: "TO",
};

/** Sigla do estado a partir de "SP", "sp" ou "São Paulo" (sem diferenciar caixa nem acento). Null se não for um estado. */
export function normalizarUf(valor: string | null | undefined): Uf | null {
  if (!valor) return null;
  const limpo = valor.trim();
  const sigla = limpo.toUpperCase();
  if ((UFS as readonly string[]).includes(sigla)) return sigla as Uf;
  return POR_NOME[chaveDoNome(limpo).replace(/\s+/g, " ")] ?? null;
}

/**
 * Separa "Curitiba-PR", "Curitiba - PR", "Curitiba/PR" ou "Curitiba, PR" em cidade e estado (a mesma regra de
 * fn_separar_cidade_uf, no banco). Só a cidade ("Curitiba") volta como cidade; só a sigla ("PR"), como estado. Texto
 * com separador que não termina numa UF válida ("d-D", "Curitiba-XX") é malformado e volta com os dois nulos.
 */
export function separarCidadeUf(texto: string | null | undefined): { cidade: string | null; estado: Uf | null } {
  const limpo = (texto ?? "").trim();
  if (!limpo) return { cidade: null, estado: null };
  const partes = /^(.+?)\s*[-/,–]\s*([A-Za-zÀ-ÿ ]{2,})$/.exec(limpo);
  if (partes) {
    const estado = normalizarUf(partes[2]);
    if (estado && partes[1].trim()) return { cidade: partes[1].trim(), estado };
  }
  if (limpo.length === 2 && normalizarUf(limpo)) return { cidade: null, estado: normalizarUf(limpo) };
  if (limpo.length >= 2 && !/[-/,–]/.test(limpo)) return { cidade: limpo, estado: null };
  return { cidade: null, estado: null };
}
