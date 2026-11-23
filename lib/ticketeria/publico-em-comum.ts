// O PÚBLICO EM COMUM entre eventos da mesma casa e o HISTÓRICO DO ARTISTA na casa. O que é "parecido" vem do público de cada casa (quem comprou um evento também comprou o outro), e não
// de rótulo de gênero: numa casa de rock, "rock" não diz nada; o que importa é a rede daquela casa (decisão do dono, 23/11/2026). Tudo dentro de uma loja: nada passa de um cliente para outro.
// Sem banco e sem imports de servidor: roda nos testes (tests/ticketeria-publico-em-comum.test.ts).

/** Entra como parecido quem divide pelo menos esta parte do público do evento. */
export const MIN_PARTE_EM_COMUM = 0.1;
/** Com menos compradores que isto, a parte em comum não diz nada (vale a regra antiga: mesmo local e preço na faixa). */
export const MIN_COMPRADORES_PARA_COMPARAR = 20;
/** Eventos com público em comum a menos de tantos dias um do outro tendem a dividir a venda. */
export const DIAS_QUE_DIVIDEM_A_VENDA = 21;

/** Os compradores (e-mail) de cada evento. */
export function compradoresPorEvento(pedidos: { comprador_email: string; sessao_id: string }[], eventoIdDaSessao: Record<string, string>): Map<string, Set<string>> {
  const porEvento = new Map<string, Set<string>>();
  for (const p of pedidos) {
    const evento = eventoIdDaSessao[p.sessao_id];
    const email = p.comprador_email.trim().toLowerCase();
    if (!evento || !email) continue;
    (porEvento.get(evento) ?? porEvento.set(evento, new Set()).get(evento)!).add(email);
  }
  return porEvento;
}

export type EmComum = { eventoId: string; emComum: number; parte: number };

/** Os eventos que dividem público com `eventoId`: de quem comprou ele, a parte que também comprou cada outro (da maior para a menor). Só quem tem alguém em comum. */
export function eventosEmComum(compradores: Map<string, Set<string>>, eventoId: string): EmComum[] {
  const base = compradores.get(eventoId);
  if (!base || base.size === 0) return [];
  const saida: EmComum[] = [];
  for (const [outro, emails] of compradores) {
    if (outro === eventoId) continue;
    let emComum = 0;
    for (const e of emails) if (base.has(e)) emComum++;
    if (emComum > 0) saida.push({ eventoId: outro, emComum, parte: Math.round((emComum / base.size) * 1000) / 1000 });
  }
  return saida.sort((a, b) => b.parte - a.parte || b.emComum - a.emComum);
}

/** O nome do artista para comparar: sem acento, sem maiúscula, sem espaço sobrando ("Cia.  Atores de Mar" = "cia atores de mar"). Vazio se não há. */
export const normalizarArtista = (nome: string | null | undefined): string => (nome ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export type ApresentacaoNaCasa = { eventoId: string; titulo: string; ultimoDia: string; lotacao: number | null };

/** As apresentações anteriores do mesmo artista na casa (já aconteceram), da mais recente para a mais antiga, com a lotação final (parte dos lugares vendidos). */
export function historicoDoArtista(eventos: (ApresentacaoNaCasa & { artista: string | null })[], artista: string | null | undefined, excluir: string | null, hoje: string): ApresentacaoNaCasa[] {
  const alvo = normalizarArtista(artista);
  if (!alvo) return [];
  return eventos.filter(e => e.eventoId !== excluir && normalizarArtista(e.artista) === alvo && e.ultimoDia < hoje)
    .sort((a, b) => b.ultimoDia.localeCompare(a.ultimoDia))
    .map(({ eventoId, titulo, ultimoDia, lotacao }) => ({ eventoId, titulo, ultimoDia, lotacao }));
}

/** O segmento de envio "quem comprou A e não comprou B" (aceitaram novidades e não saíram da lista). */
export const segmentoEmComum = (comprouA: string, naoComprouB: string): string => `evento:${comprouA}:sem:${naoComprouB}`;
