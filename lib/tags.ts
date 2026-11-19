// Tags livres de empresas, contatos e projetos: regras de limpeza e comparação, sem React, para testar.

export const MAX_TAGS = 20;
export const MAX_CARACTERES_DA_TAG = 40;

/** Tira espaços sobrando e corta no limite. "  Patrocinador   anual " → "Patrocinador anual". */
export function limparTag(texto: string): string {
  return texto.replace(/\s+/g, " ").trim().slice(0, MAX_CARACTERES_DA_TAG).trim();
}

/** Compara sem diferenciar maiúscula, minúscula ou acento: "Música" e "musica" são a mesma tag. */
export function chaveDaTag(tag: string): string {
  return limparTag(tag).toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Acrescenta uma tag à lista, sem repetir. Se ela já existe no vocabulário do time com outra grafia
 * ("musica" quando o time usa "Música"), entra a grafia do time.
 */
export function acrescentarTag(lista: string[], texto: string, vocabulario: string[] = []): string[] {
  const tag = limparTag(texto);
  if (!tag || lista.length >= MAX_TAGS) return lista;
  const chave = chaveDaTag(tag);
  if (lista.some(t => chaveDaTag(t) === chave)) return lista;
  const doTime = vocabulario.find(t => chaveDaTag(t) === chave);
  return [...lista, doTime ?? tag];
}

/** Sugestões para o que está sendo digitado: as do time que contêm o texto e ainda não estão na lista. */
export function sugerirTags(texto: string, vocabulario: string[], escolhidas: string[], limite = 8): string[] {
  const busca = chaveDaTag(texto);
  const ja = new Set(escolhidas.map(chaveDaTag));
  const livres = vocabulario.filter(t => !ja.has(chaveDaTag(t)));
  if (!busca) return livres.slice(0, limite);
  const comeca = livres.filter(t => chaveDaTag(t).startsWith(busca));
  const contem = livres.filter(t => !chaveDaTag(t).startsWith(busca) && chaveDaTag(t).includes(busca));
  return [...comeca, ...contem].slice(0, limite);
}

/** O registro tem alguma das tags do filtro? Filtro vazio deixa passar tudo. */
export function temAlgumaTag(tags: string[] | null | undefined, filtro: string[]): boolean {
  if (!filtro.length) return true;
  const chaves = new Set((tags ?? []).map(chaveDaTag));
  return filtro.some(t => chaves.has(chaveDaTag(t)));
}
