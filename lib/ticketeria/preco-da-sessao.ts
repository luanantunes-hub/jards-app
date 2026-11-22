// O preço que vale para um lote numa sessão (plano da Ticketeria, seção 11, fase P0). Só lógica, sem banco e sem import de servidor.
//
// O preço do lote vale em todas as sessões do evento, a menos que a sessão tenha um preço próprio para ele (ticketeria_precos_da_sessao). A meia
// não tem preço próprio por sessão: o lote dela é o espelho da inteira (espelho_de) e, numa sessão em que a inteira tem preço próprio, a meia vale a
// metade dele (arredondada, nunca abaixo de 1 centavo: a mesma conta do espelho e de fn_ticketeria_preco_do_lote, no banco).
// Esta conta tem de dar o mesmo resultado que a função do banco: a vitrine mostra por aqui, e a reserva cobra por lá.

export type LoteParaPreco = { id: string; preco_centavos: number; espelho_de?: string | null };

/** O preço próprio de cada lote na sessão: lote_id → preço em centavos. */
export type PrecosDaSessao = ReadonlyMap<string, number>;

/** A metade de um preço, arredondada e nunca abaixo de 1 centavo. */
export function metadeDoPreco(centavos: number): number {
  return Math.max(1, Math.round(centavos / 2));
}

/** O preço que vale para o lote na sessão: o da sessão; senão, para a meia, a metade do da inteira na sessão; senão o do lote. */
export function precoDoLoteNaSessao(lote: LoteParaPreco, precos: PrecosDaSessao): number {
  const proprio = precos.get(lote.id);
  if (proprio !== undefined) return proprio;
  if (lote.espelho_de) {
    const daInteira = precos.get(lote.espelho_de);
    if (daInteira !== undefined) return metadeDoPreco(daInteira);
  }
  return lote.preco_centavos;
}

/** Os mesmos lotes, cada um com o preço que vale na sessão. */
export function aplicarPrecosDaSessao<T extends LoteParaPreco>(lotes: readonly T[], precos: PrecosDaSessao): T[] {
  return lotes.map(lote => ({ ...lote, preco_centavos: precoDoLoteNaSessao(lote, precos) }));
}
