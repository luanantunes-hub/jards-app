// MARCA x EVENTO no gasto de divulgação: a marcação das campanhas (Meta e Google) e a separação do gasto da marca no modelo de marketing. A marca (a instituição: o teatro, o
// zoológico, a banda) rende devagar e por meses, em todos os eventos; o anúncio de um evento rende em poucas semanas. Misturados no mesmo canal, o modelo não vê nenhum dos dois direito.
// Sem banco e sem imports de servidor: roda nos testes (tests/ticketeria-campanhas.test.ts).

import { inicioDaSemana } from "@/lib/ticketeria/modelo";

export type Marcacao = "marca" | "evento";
/** Palavras que, no nome da campanha, dizem que ela é da marca. */
export const PALAVRAS_DA_MARCA = ["institucional", "marca", "branding", "brand", "awareness", "reconhecimento"];
/** Marca e eventos só viram canais separados no modelo se cada lado tiver gasto em pelo menos tantas semanas (o mesmo mínimo de um canal em modelo/mmm.py). */
export const MIN_SEMANAS_PARA_SEPARAR = 8;
export const SUFIXO_DA_MARCA = "-marca";
export const SUFIXO_DOS_EVENTOS = "-eventos";

const normalizar = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const contem = (texto: string, trecho: string): boolean => trecho.length >= 4 && ` ${texto} `.includes(` ${trecho} `);

/**
 * A sugestão de marcação pelo nome da campanha: o nome de um evento da loja → aquele evento (o nome mais longo ganha, para "Hamlet Reprise" não cair em "Hamlet"); uma palavra de marca ou o
 * nome da loja → marca; senão nenhuma (o produtor escolhe). Nomes de até 3 letras não contam (seriam coincidência).
 */
export function sugerirMarcacao(nome: string, eventos: { id: string; titulo: string }[], nomeDaLoja: string): { marcacao: Marcacao; eventoId: string | null } | null {
  const n = normalizar(nome);
  const evento = eventos.map(e => ({ ...e, t: normalizar(e.titulo) })).filter(e => contem(n, e.t)).sort((a, b) => b.t.length - a.t.length)[0];
  if (evento) return { marcacao: "evento", eventoId: evento.id };
  if (PALAVRAS_DA_MARCA.some(p => contem(n, p)) || contem(n, normalizar(nomeDaLoja))) return { marcacao: "marca", eventoId: null };
  return null;
}

/** O canal do modelo para a parte da marca e para a parte dos eventos de um canal ("meta-ads" → "meta-ads-marca" e "meta-ads-eventos"). */
export const canalDaMarca = (canal: string): string => `${canal}${SUFIXO_DA_MARCA}`;
export const canalDosEventos = (canal: string): string => `${canal}${SUFIXO_DOS_EVENTOS}`;
/** O canal original de um canal separado ("meta-ads-marca" → "meta-ads"), e se é a parte da marca. */
export function partesDoCanal(canal: string): { base: string; parte: "marca" | "eventos" | null } {
  if (canal.endsWith(SUFIXO_DA_MARCA)) return { base: canal.slice(0, -SUFIXO_DA_MARCA.length), parte: "marca" };
  if (canal.endsWith(SUFIXO_DOS_EVENTOS)) return { base: canal.slice(0, -SUFIXO_DOS_EVENTOS.length), parte: "eventos" };
  return { base: canal, parte: null };
}

/**
 * Separa, na tabela semanal, o gasto da marca do resto de cada canal. `marca` são os gastos de marca por dia e canal (campanhas marcadas como marca, ações sem evento). Por canal: a marca
 * da semana (até o gasto do canal na semana) vai para "<canal>-marca" e o resto para "<canal>-eventos", MAS só quando cada lado tem gasto em MIN_SEMANAS_PARA_SEPARAR semanas ou mais; senão
 * o canal fica inteiro, como antes. Devolve a tabela nova e os canais que foram separados.
 */
export function separarMarca<T extends { semana: string; gasto: Record<string, number> }>(tabela: T[], marca: { dia: string; canal: string; centavos: number }[], minSemanas: number = MIN_SEMANAS_PARA_SEPARAR): { tabela: T[]; separados: string[] } {
  const porCanal = new Map<string, Map<string, number>>();
  for (const m of marca) {
    if (m.centavos <= 0) continue;
    const semanas = porCanal.get(m.canal) ?? new Map<string, number>();
    const s = inicioDaSemana(m.dia);
    semanas.set(s, (semanas.get(s) ?? 0) + m.centavos);
    porCanal.set(m.canal, semanas);
  }
  const separados: string[] = [];
  for (const [canal, semanas] of porCanal) {
    let comMarca = 0, comResto = 0;
    for (const linha of tabela) {
      const total = linha.gasto[canal] ?? 0;
      const daMarca = Math.min(total, semanas.get(linha.semana) ?? 0);
      if (daMarca > 0) comMarca++;
      if (total - daMarca > 0) comResto++;
    }
    if (comMarca >= minSemanas && comResto >= minSemanas) separados.push(canal);
  }
  const nova = tabela.map(linha => {
    const gasto: Record<string, number> = {};
    for (const [canal, total] of Object.entries(linha.gasto)) {
      if (!separados.includes(canal)) { gasto[canal] = total; continue; }
      const daMarca = Math.min(total, porCanal.get(canal)?.get(linha.semana) ?? 0);
      if (daMarca > 0) gasto[canalDaMarca(canal)] = daMarca;
      if (total - daMarca > 0) gasto[canalDosEventos(canal)] = total - daMarca;
    }
    return { ...linha, gasto };
  });
  return { tabela: nova, separados: separados.sort() };
}
