// A escolha do lugar no onboarding da Ticketeria: o estado pelo mapa e a cidade da lista do IBGE (public/dados/municipios.json), ou digitando.
// Sem React e sem imports de servidor: roda nos testes (tests/ticketeria-comecar.test.ts).

import type { Municipio } from "@/lib/prestacao/municipios";

type Tabela = { municipios: readonly Municipio[] };

/** Sem acento, sem caixa e sem pontuação: "São José" casa com "sao jose". */
export const normalizar = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** As cidades do estado: sem texto, as primeiras em ordem alfabética; com texto, as que começam com ele e depois as que o contêm. */
export function cidadesDoEstado(tabela: Tabela, uf: string, trecho: string, limite = 80): Municipio[] {
  const alvo = normalizar(trecho);
  const doEstado = tabela.municipios.filter(m => m[2] === uf);
  if (!alvo) return doEstado.slice(0, limite);
  const comeca = doEstado.filter(m => normalizar(m[1]).startsWith(alvo));
  const contem = doEstado.filter(m => !normalizar(m[1]).startsWith(alvo) && normalizar(m[1]).includes(alvo));
  return [...comeca, ...contem].slice(0, limite);
}

/** Sem estado escolhido, quem digita a cidade acha em todo o Brasil (a partir de 2 letras): "Sorocaba, SP". */
export function cidadesDoBrasil(tabela: Tabela, trecho: string, limite = 8): Municipio[] {
  const alvo = normalizar(trecho);
  if (alvo.length < 2) return [];
  const comeca = tabela.municipios.filter(m => normalizar(m[1]).startsWith(alvo));
  const contem = tabela.municipios.filter(m => !normalizar(m[1]).startsWith(alvo) && normalizar(m[1]).includes(alvo));
  return [...comeca, ...contem].slice(0, limite);
}

/** A cidade do estado com exatamente esse nome (sem ligar para acento e caixa), ou null: o que sobra é nome digitado à mão. */
export function cidadeExata(tabela: Tabela, uf: string, nome: string): Municipio | null {
  const alvo = normalizar(nome);
  return alvo ? tabela.municipios.find(m => m[2] === uf && normalizar(m[1]) === alvo) ?? null : null;
}
