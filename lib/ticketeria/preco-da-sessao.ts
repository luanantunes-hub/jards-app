// O preço que vale para um lote numa sessão (plano da Ticketeria, seção 11, fases P0 e P2). Só lógica, sem banco e sem import de servidor.
//
// O preço do lote vale em todas as sessões do evento, a menos que a sessão tenha um preço próprio para ele (ticketeria_precos_da_sessao, P0). Com a adesão ao preço dinâmico ativa (P2), o preço da sessão
// (ou do lote) é multiplicado pelo FATOR da sessão (10000 = sem mudança). A meia não tem preço próprio por sessão: o lote dela é o espelho da inteira (espelho_de) e, numa sessão em que a inteira tem preço
// próprio ou fator, a meia vale a metade do preço que vale da inteira (arredondada, nunca abaixo de 1 centavo: a mesma conta do espelho e de fn_ticketeria_preco_do_lote, no banco).
// Esta conta tem de dar o mesmo resultado que a função do banco: a vitrine mostra por aqui, e a reserva cobra por lá.

import { FATOR_BASE, aplicarFator } from "@/lib/ticketeria/preco-dinamico";

export type LoteParaPreco = { id: string; preco_centavos: number; espelho_de?: string | null };

/** O preço próprio de cada lote na sessão: lote_id → preço em centavos. */
export type PrecosDaSessao = ReadonlyMap<string, number>;

/** A metade de um preço, arredondada e nunca abaixo de 1 centavo. */
export function metadeDoPreco(centavos: number): number {
  return Math.max(1, Math.round(centavos / 2));
}

/**
 * O preço que vale para o lote na sessão. Sem fator (10000) é a conta da P0: o da sessão; senão, para a meia, a metade do da inteira na sessão; senão o do lote.
 * Com fator, o da sessão (ou do lote) vezes o fator; e a meia, a metade do que vale da inteira. `daInteira` é o lote que a meia espelha (preciso só com fator ativo).
 */
export function precoDoLoteNaSessao(lote: LoteParaPreco, precos: PrecosDaSessao, fatorBps: number = FATOR_BASE, daInteira?: LoteParaPreco | null): number {
  if (lote.espelho_de) {
    if (fatorBps !== FATOR_BASE && daInteira) return metadeDoPreco(precoDoLoteNaSessao(daInteira, precos, fatorBps));
    const proprioDaInteira = precos.get(lote.espelho_de);
    if (proprioDaInteira !== undefined) return metadeDoPreco(fatorBps !== FATOR_BASE ? aplicarFator(proprioDaInteira, fatorBps) : proprioDaInteira);
    return lote.preco_centavos;
  }
  return aplicarFator(precos.get(lote.id) ?? lote.preco_centavos, fatorBps);
}

/** Os mesmos lotes, cada um com o preço que vale na sessão (com o fator da sessão, se houver). */
export function aplicarPrecosDaSessao<T extends LoteParaPreco>(lotes: readonly T[], precos: PrecosDaSessao, fatorBps: number = FATOR_BASE): T[] {
  const porId = new Map(lotes.map(lote => [lote.id, lote] as const));
  return lotes.map(lote => ({ ...lote, preco_centavos: precoDoLoteNaSessao(lote, precos, fatorBps, lote.espelho_de ? porId.get(lote.espelho_de) ?? null : null) }));
}
