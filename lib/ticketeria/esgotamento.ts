// SESSÕES ESGOTADAS: quando cada sessão esgotou e os avisos de anúncio gastando com o evento esgotado ou quase. (O modelo ainda não trata as semanas esgotadas: ver
// modelo/ESTUDO-DA-LOTACAO.md.) Putler & Lele (Marketing Letters, 2003): a sessão que esgota esconde a procura (a venda bate no teto da sala, não no do anúncio). Sem banco e sem imports de servidor:
// roda nos testes (tests/ticketeria-esgotamento.test.ts).

/** A sessão conta como esgotada quando vende esta parte da lotação (sobra de 2% costuma ser lugar ruim, cortesia ou bloqueio). */
export const PARTE_QUE_ESGOTA = 0.98;
/** "Quase esgotado": esta parte vendida e a sessão a até DIAS_DO_QUASE dias. */
export const PARTE_DO_QUASE = 0.9;
export const DIAS_DO_QUASE = 14;
const DIA = 86400000;
const somarDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DIA).toISOString().slice(0, 10);

/** O dia em que a sessão esgotou (a venda acumulada chegou a PARTE_QUE_ESGOTA da lotação), ou null se não esgotou (ou não tem lotação). */
export function quandoEsgotou(vendas: { dia: string; quantidade: number }[], lugares: number): string | null {
  if (lugares <= 0) return null;
  let acumulado = 0;
  for (const v of [...vendas].sort((a, b) => a.dia.localeCompare(b.dia))) {
    acumulado += v.quantidade;
    if (acumulado >= PARTE_QUE_ESGOTA * lugares) return v.dia;
  }
  return null;
}

// ─── Os avisos: anúncio gastando com o evento esgotado, e o evento quase esgotado ─

export type SessaoDoEvento = { dia: string; lugares: number; vendidos: number; esgotouEm: string | null };
export type EventoParaAvisar = { eventoId: string; evento: string; sessoes: SessaoDoEvento[] };
export type GastoDeCampanha = { eventoId: string; canal: string; dia: string; centavos: number };

export type EventoEsgotado = {
  eventoId: string; evento: string; sessoes: number; esgotouEm: string;
  /** O gasto das campanhas marcadas com o evento depois que ele esgotou, por canal, e a média por dia dos últimos 7 dias. */ gastoDepois: Record<string, number>; totalDepois: number; porDia: number;
};
export type EventoQuaseEsgotado = { eventoId: string; evento: string; parteVendida: number; diasAteASessao: number };

/**
 * Os eventos esgotados (todas as sessões que ainda vêm, ou a última delas, esgotaram) com gasto de campanha depois disso, e os quase esgotados (90% vendido, sessão a até 14 dias).
 * Só entram no "esgotado" os eventos com gasto depois: o aviso é para parar o anúncio, não para comemorar.
 */
export function avisosDeEsgotamento(eventos: EventoParaAvisar[], gastos: GastoDeCampanha[], hoje: string): { esgotados: EventoEsgotado[]; quase: EventoQuaseEsgotado[] } {
  const esgotados: EventoEsgotado[] = [];
  const quase: EventoQuaseEsgotado[] = [];
  const semanaPassada = somarDias(hoje, -6);
  for (const e of eventos) {
    const comLugar = e.sessoes.filter(s => s.lugares > 0);
    const futuras = comLugar.filter(s => s.dia >= hoje);
    if (futuras.length === 0) continue;
    if (futuras.every(s => s.esgotouEm)) {
      const esgotouEm = futuras.map(s => s.esgotouEm as string).sort().at(-1) as string;
      const gastoDepois: Record<string, number> = {};
      let ultimaSemana = 0;
      for (const g of gastos) {
        if (g.eventoId !== e.eventoId || g.dia <= esgotouEm || g.centavos <= 0) continue;
        gastoDepois[g.canal] = (gastoDepois[g.canal] ?? 0) + g.centavos;
        if (g.dia >= semanaPassada) ultimaSemana += g.centavos;
      }
      const totalDepois = Object.values(gastoDepois).reduce((s, x) => s + x, 0);
      if (totalDepois > 0) esgotados.push({ eventoId: e.eventoId, evento: e.evento, sessoes: comLugar.length, esgotouEm, gastoDepois, totalDepois, porDia: Math.round(ultimaSemana / 7) });
      continue;
    }
    const proximas = futuras.filter(s => !s.esgotouEm && Date.parse(`${s.dia}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`) <= DIAS_DO_QUASE * DIA);
    const lugares = proximas.reduce((s, x) => s + x.lugares, 0);
    const vendidos = proximas.reduce((s, x) => s + Math.min(x.vendidos, x.lugares), 0);
    if (lugares > 0 && vendidos / lugares >= PARTE_DO_QUASE) {
      const dia = proximas.map(s => s.dia).sort()[0];
      quase.push({ eventoId: e.eventoId, evento: e.evento, parteVendida: Math.round((vendidos / lugares) * 100) / 100, diasAteASessao: Math.round((Date.parse(`${dia}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / DIA) });
    }
  }
  return { esgotados: esgotados.sort((a, b) => b.totalDepois - a.totalDepois), quase: quase.sort((a, b) => a.diasAteASessao - b.diasAteASessao) };
}
