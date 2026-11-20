// As contas do editor do site (construtor, passo 3; desenho aprovado pelo dono em 20/11/2026): mover (arrastar), duplicar um bloco, o título e o endereço da cópia de uma página, e as medidas
// da prévia ao lado (celular e computador). Só lógica, sem banco e sem tela (roda no navegador e nos testes).

import { MAX_BLOCOS_POR_PAGINA, slugDaPagina, type Bloco } from "@/lib/ticketeria/site";

/** A lista com o bloco da posição `de` levado para a posição `para` (arrastar). Posição fora da lista ou igual: a mesma lista, sem mudança. */
export function moverBloco<T>(lista: readonly T[], de: number, para: number): T[] {
  const copia = [...lista];
  if (!Number.isInteger(de) || !Number.isInteger(para) || de === para || de < 0 || para < 0 || de >= copia.length || para >= copia.length) return copia;
  const [item] = copia.splice(de, 1);
  copia.splice(para, 0, item);
  return copia;
}

/** A lista com uma cópia do bloco logo depois dele; null se a página já está cheia ou o bloco não existe. */
export function duplicarBloco(lista: readonly Bloco[], indice: number, maximo: number = MAX_BLOCOS_POR_PAGINA): Bloco[] | null {
  if (!Number.isInteger(indice) || indice < 0 || indice >= lista.length || lista.length >= maximo) return null;
  const copia = [...lista];
  copia.splice(indice + 1, 0, structuredClone(lista[indice]));
  return copia;
}

/** O título da cópia de uma página: "Elenco (cópia)", e se já existe, "Elenco (cópia 2)"; cabe nos 120 letras que o banco aceita (o nome original é cortado, não a marca). */
export function tituloDaCopia(titulo: string, existentes: readonly string[]): string {
  const usados = new Set(existentes.map(t => t.trim().toLowerCase()));
  for (let n = 1; n < 100; n++) {
    const marca = n === 1 ? " (cópia)" : ` (cópia ${n})`;
    const candidato = `${titulo.trim().slice(0, 120 - marca.length).trimEnd()}${marca}`;
    if (!usados.has(candidato.toLowerCase())) return candidato;
  }
  return `${titulo.trim().slice(0, 100)} (cópia)`;
}

/** O título e o endereço da cópia de uma página, sem repetir os que já existem. */
export function copiaDeUmaPagina(titulo: string, paginas: readonly { titulo: string; slug: string }[]): { titulo: string; slug: string } {
  const novo = tituloDaCopia(titulo, paginas.map(p => p.titulo));
  return { titulo: novo, slug: slugDaPagina(novo, new Set(paginas.map(p => p.slug))) };
}

export type ModoDaPrevia = "celular" | "computador";

/** As medidas do quadro da prévia (o iframe e a escala que o encaixa na coluna de 440 pixels): o celular em tamanho natural, o computador reduzido. */
export function medidasDaPrevia(modo: ModoDaPrevia, alturaDaColuna = 640): { largura: number; altura: number; escala: number; larguraVista: number; alturaVista: number } {
  const larguraVista = 440;
  if (modo === "celular") return { largura: 390, altura: alturaDaColuna, escala: 1, larguraVista, alturaVista: alturaDaColuna };
  const escala = 0.4;
  return { largura: Math.round(larguraVista / escala), altura: Math.round(alturaDaColuna / escala), escala, larguraVista, alturaVista: alturaDaColuna };
}

/** O endereço da prévia de uma página do site, para o iframe (o mesmo do link "Ver a prévia"). */
export const enderecoDaPrevia = (siteId: string, slug: string) => `/previa-site/${siteId}${slug === "inicio" ? "" : `/${slug}`}`;
