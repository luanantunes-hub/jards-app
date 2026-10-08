// Carteira (P5.1): a lista de prestações vista pela consultoria, com o
// cliente (proponente), quem conduz, o valor em risco e o captado contra o
// executado. Os números por prestação vêm da visão prestacao_carteira; aqui
// ficam o resumo, as opções dos filtros e o quadro por situação. Sem React e
// sem Supabase.

import type { PrestacaoCarteira, StatusPrestacao } from "@/lib/supabase/types";

export type LinhaDaCarteira = {
  id: string;
  status: StatusPrestacao;
  cliente: { id: string; nome: string } | null;
  responsavelId: string | null;
  carteira: Pick<PrestacaoCarteira, "valor_em_risco" | "achados_em_risco" | "captado" | "executado"> | null;
};

const centavos = (v: unknown) => Math.round((Number(v) || 0) * 100);

/** O topo da carteira: quanto está em risco, em quantas prestações, e quantos clientes. */
export function resumoDaCarteira(linhas: readonly LinhaDaCarteira[]) {
  const emRisco = linhas.filter(l => centavos(l.carteira?.valor_em_risco) > 0);
  return {
    valorEmRisco: emRisco.reduce((s, l) => s + centavos(l.carteira?.valor_em_risco), 0) / 100,
    prestacoesEmRisco: emRisco.length,
    clientes: new Set(linhas.filter(l => l.cliente).map(l => l.cliente!.id)).size,
  };
}

/** Clientes da carteira, pelo nome, para o filtro; "sem" quando alguma prestação não tem. */
export function clientesDaCarteira(linhas: readonly LinhaDaCarteira[]): { id: string; nome: string; quantas: number }[] {
  const mapa = new Map<string, { id: string; nome: string; quantas: number }>();
  for (const l of linhas) {
    if (!l.cliente) continue;
    const atual = mapa.get(l.cliente.id) ?? { ...l.cliente, quantas: 0 };
    atual.quantas++;
    mapa.set(l.cliente.id, atual);
  }
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Filtro de cliente e de responsável: "todos", "sem" (vazio) ou o id. */
export function filtrarCarteira<T extends LinhaDaCarteira>(linhas: readonly T[], filtro: { cliente: string; responsavel: string }): T[] {
  return linhas.filter(l =>
    (filtro.cliente === "todos" || (filtro.cliente === "sem" ? !l.cliente : l.cliente?.id === filtro.cliente)) &&
    (filtro.responsavel === "todos" || (filtro.responsavel === "sem" ? !l.responsavelId : l.responsavelId === filtro.responsavel)));
}

/** Quanto do captado já foi executado; null sem captado. */
export function execucaoDoCaptado(c: Pick<PrestacaoCarteira, "captado" | "executado"> | null): { percentual: number | null; acima: boolean } {
  const captado = centavos(c?.captado);
  const executado = centavos(c?.executado);
  if (!captado) return { percentual: null, acima: false };
  return { percentual: Math.floor((executado / captado) * 100), acima: executado > captado };
}

/** As colunas do quadro, na ordem do fluxo; arquivadas só quando há alguma. */
export const COLUNAS_DO_QUADRO: readonly StatusPrestacao[] = ["rascunho", "revisao_interna", "ajuste_solicitado", "enviado", "aprovado", "arquivado"];

export function quadroDaCarteira<T extends LinhaDaCarteira>(linhas: readonly T[]): { status: StatusPrestacao; linhas: T[] }[] {
  return COLUNAS_DO_QUADRO
    .map(status => ({ status, linhas: linhas.filter(l => l.status === status) }))
    .filter(c => c.status !== "arquivado" || c.linhas.length > 0);
}
