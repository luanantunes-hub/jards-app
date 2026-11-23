// A regra de quem pode comprar os lugares reservados de acessibilidade (art. 23-A do Decreto 5.296/2004, na redação do Decreto 9.404/2018; estudo
// ticketeria-mapa-de-assentos-avancado.md, seção 4). PROPOSTA a conferir com quem entende da lei, escrita como função pura para ser testada: ainda NÃO está ligada à venda.
//
// O que o decreto diz (lido em https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/d9404.htm em 23/11/2026; os trechos entre aspas são curtos, o resto é paráfrase):
//   - os espaços e assentos reservados são para cadeirantes e pessoas com deficiência ou mobilidade reduzida (art. 23);
//   - a reserva vale do início das vendas "até vinte e quatro horas antes de cada evento", em todos os pontos de venda, físicos ou virtuais (art. 23-A, § 1º);
//   - em locais com capacidade acima de dez mil pessoas, "até setenta e duas horas antes" (§ 2º); em cinemas, "até meia hora antes de cada sessão" (§ 4º);
//   - se não houver "procura comprovada", os lugares podem, "excepcionalmente", ser ocupados por pessoas sem deficiência (caput), mas só "depois de esgotados os demais assentos daquele
//     setor" e depois do prazo (§ 3º). A expressão "procura comprovada" não é definida no texto: não há critério nem procedimento.
// O decreto não traz sanção nem fiscalização, e não fala de preço dos lugares reservados.

import { ehTipoDeLugar, type TipoDeLugar } from "@/lib/ticketeria/mapa-acessibilidade";
import type { FileiraDoMapa } from "@/lib/ticketeria/mapa";

/** Os tipos que a lei reserva (o lugar de acompanhante não é um deles: o decreto manda acomodar o acompanhante AO LADO, art. 23, § 3º). */
export const TIPOS_RESERVADOS: readonly TipoDeLugar[] = ["cadeira_rodas", "mobilidade_reduzida", "obeso"];

export const ehLugarReservado = (tipo: unknown): boolean => ehTipoDeLugar(tipo) && TIPOS_RESERVADOS.includes(tipo);

/** Local com mais de dez mil pessoas: 72 horas (art. 23-A, § 2º). */
export const CAPACIDADE_DE_GRANDE_PORTE = 10000;

export type EspacoDoEvento = {
  /** A capacidade do local (todos os lugares dele), para saber se passa de dez mil pessoas. */
  capacidade: number;
  /** O espaço é um cinema (sessões, meia hora). */
  cinema?: boolean;
};

/** Quantas horas antes da sessão a reserva termina: 0,5 no cinema, 72 acima de dez mil pessoas, 24 nos demais. */
export function horasDeReserva(espaco: EspacoDoEvento): number {
  if (espaco.cinema) return 0.5;
  return espaco.capacidade > CAPACIDADE_DE_GRANDE_PORTE ? 72 : 24;
}

/** Quando a reserva termina (a partir daí, e só então, os lugares podem ser abertos a quem não é pessoa com deficiência). */
export function reservaTerminaEm(inicio: Date, espaco: EspacoDoEvento): Date {
  return new Date(inicio.getTime() - horasDeReserva(espaco) * 3600 * 1000);
}

export type SituacaoDoLugarReservado =
  | { pode: true; motivo: "declarou" | "liberado" }
  | { pode: false; motivo: "reservado_ate_o_prazo" | "ainda_ha_outros_lugares" };

/**
 * Esta pessoa pode comprar um lugar reservado, agora?
 *  - Quem declara precisar do lugar (`declarou`: ela ou quem ela acompanha tem deficiência ou mobilidade reduzida) pode a qualquer momento.
 *  - Quem não declara só pode depois que a reserva termina E esgotados os demais lugares do setor nesta sessão (`outrosLivres`: quantos lugares NÃO reservados ainda estão livres).
 */
export function podeComprarLugarReservado(entrada: { agora: Date; inicio: Date; espaco: EspacoDoEvento; outrosLivres: number; declarou: boolean }): SituacaoDoLugarReservado {
  if (entrada.declarou) return { pode: true, motivo: "declarou" };
  if (entrada.agora.getTime() < reservaTerminaEm(entrada.inicio, entrada.espaco).getTime()) return { pode: false, motivo: "reservado_ate_o_prazo" };
  if (entrada.outrosLivres > 0) return { pode: false, motivo: "ainda_ha_outros_lugares" };
  return { pode: true, motivo: "liberado" };
}

/** A frase para quem tentou comprar um lugar reservado sem poder. */
export function fraseDoLugarReservado(motivo: Extract<SituacaoDoLugarReservado, { pode: false }>["motivo"]): string {
  return motivo === "reservado_ate_o_prazo"
    ? "Este lugar é reservado para pessoas com deficiência ou mobilidade reduzida. Ele só é aberto a outras pessoas perto do evento, se sobrar."
    : "Este lugar é reservado para pessoas com deficiência ou mobilidade reduzida. Só abrimos os reservados depois que os demais lugares do setor se esgotam.";
}

/**
 * O mapa do comprador com os lugares reservados de acessibilidade ainda livres marcados como `reservado` (não escolhíveis): para quem NÃO declarou a necessidade e enquanto a reserva do setor
 * não foi liberada (`liberada`, de fn_ticketeria_reserva_do_setor). Quem declarou, ou com a reserva liberada, vê o mapa como veio. A conferência de verdade é do banco, na reserva.
 */
export function marcarReservados(fileiras: readonly FileiraDoMapa[], situacao: { declarou: boolean; liberada: boolean }): FileiraDoMapa[] {
  if (situacao.declarou || situacao.liberada) return fileiras.map(f => ({ ...f, assentos: [...f.assentos] }));
  return fileiras.map(f => ({ ...f, assentos: f.assentos.map(a => (a.estado === "livre" && ehLugarReservado(a.tipo) ? { ...a, estado: "reservado" as const } : a)) }));
}
