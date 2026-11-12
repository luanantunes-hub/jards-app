// Os convidados e as cortesias de uma sessão (plano do módulo, PD7.2, primeiro corte): tipos de credencial com cota por sessão, o saldo
// de cada tipo, a conferência do que a produção digita e o texto dos erros do banco. Sem tela e sem banco.

import type { SituacaoDoConvidado } from "@/lib/producao/estados";

export const ROTULO_DA_SITUACAO_DO_CONVIDADO: Record<SituacaoDoConvidado, string> = { pedido: "Pedido", confirmado: "Confirmado", recusado: "Recusado" };

export type TipoDeCredencial = { id: string; nome: string; cota_por_sessao: number | null; arquivado: boolean };
export type ConvidadoDaSessao = { id: string; tipo_id: string; nome: string; afiliacao: string | null; quantidade: number; situacao: SituacaoDoConvidado };

/** Como está a cota de um tipo numa sessão: sem cota, com lugar livre, cheia ou estourada (a cota baixou depois de dar os lugares). */
export type EstadoDaCota = "sem_cota" | "livre" | "cheia" | "estourada";
export type SaldoDoTipo = { tipoId: string; nome: string; arquivado: boolean; cota: number | null; usados: number; saldo: number | null; estado: EstadoDaCota };

/**
 * O saldo de cada tipo na sessão: os lugares que contam são os de pedidos e confirmados (recusado não conta, como no banco). Tipo arquivado
 * só aparece se ainda tem lugar dado na sessão. Ordem alfabética.
 */
export function saldoDosTipos(tipos: readonly TipoDeCredencial[], convidados: readonly ConvidadoDaSessao[]): SaldoDoTipo[] {
  const usadosPorTipo = new Map<string, number>();
  for (const convidado of convidados) {
    if (convidado.situacao === "recusado") continue;
    usadosPorTipo.set(convidado.tipo_id, (usadosPorTipo.get(convidado.tipo_id) ?? 0) + convidado.quantidade);
  }
  return tipos
    .filter(tipo => !tipo.arquivado || (usadosPorTipo.get(tipo.id) ?? 0) > 0)
    .map((tipo): SaldoDoTipo => {
      const usados = usadosPorTipo.get(tipo.id) ?? 0;
      const cota = tipo.cota_por_sessao;
      const saldo = cota === null ? null : cota - usados;
      const estado: EstadoDaCota = saldo === null ? "sem_cota" : saldo < 0 ? "estourada" : saldo === 0 ? "cheia" : "livre";
      return { tipoId: tipo.id, nome: tipo.nome, arquivado: tipo.arquivado, cota, usados, saldo, estado };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Quantos lugares estão confirmados, pedidos e recusados, e quantas pessoas (linhas) foram convidadas. */
export function resumoDosConvidados(convidados: readonly ConvidadoDaSessao[]): { confirmados: number; pedidos: number; recusados: number; linhas: number } {
  const soma = (situacao: SituacaoDoConvidado) => convidados.filter(c => c.situacao === situacao).reduce((total, c) => total + c.quantidade, 0);
  return { confirmados: soma("confirmado"), pedidos: soma("pedido"), recusados: soma("recusado"), linhas: convidados.length };
}

const texto = (valor: string) => valor.trim();

export type LeituraDoTipo = { ok: true; valor: { nome: string; cota_por_sessao: number | null } } | { ok: false; erro: string; campo: string };

/** O tipo como o banco confere: nome de 1 a 60 letras; cota vazia (sem limite) ou um inteiro de 0 a 5.000. */
export function lerTipo(campos: { nome: string; cota: string }): LeituraDoTipo {
  const nome = texto(campos.nome);
  if (nome === "") return { ok: false, erro: "Escreva o nome do tipo.", campo: "nome" };
  if (nome.length > 60) return { ok: false, erro: "O nome pode ter até 60 letras.", campo: "nome" };
  const cota = texto(campos.cota);
  if (cota === "") return { ok: true, valor: { nome, cota_por_sessao: null } };
  const numero = Number(cota);
  if (!/^\d+$/.test(cota) || numero > 5000) return { ok: false, erro: "A cota é um número de 0 a 5.000, ou deixe vazio para não limitar.", campo: "cota" };
  return { ok: true, valor: { nome, cota_por_sessao: numero } };
}

export type LeituraDoConvidado =
  | { ok: true; valor: { nome: string; afiliacao: string | null; quantidade: number; tipo_id: string } }
  | { ok: false; erro: string; campo: string };

/** O convidado como o banco confere: nome de 1 a 120, afiliação até 120, de 1 a 20 lugares e um tipo escolhido. */
export function lerConvidado(campos: { nome: string; afiliacao: string; quantidade: string; tipoId: string }): LeituraDoConvidado {
  const nome = texto(campos.nome), afiliacao = texto(campos.afiliacao);
  if (nome === "") return { ok: false, erro: "Escreva o nome do convidado.", campo: "nome" };
  if (nome.length > 120) return { ok: false, erro: "O nome pode ter até 120 letras.", campo: "nome" };
  if (afiliacao.length > 120) return { ok: false, erro: "A afiliação pode ter até 120 letras.", campo: "afiliacao" };
  if (campos.tipoId === "") return { ok: false, erro: "Escolha o tipo de credencial.", campo: "tipo" };
  const quantidade = Number(texto(campos.quantidade));
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 20) return { ok: false, erro: "Os lugares são de 1 a 20 (a pessoa e os acompanhantes).", campo: "quantidade" };
  return { ok: true, valor: { nome, afiliacao: afiliacao === "" ? null : afiliacao, quantidade, tipo_id: campos.tipoId } };
}

/** O texto para o erro que o banco devolve ao gravar tipo ou convidado. */
export function mensagemDoErroDeConvidado(erro: { code?: string; message?: string }): string {
  if (erro.code === "42501") return "Você não pode alterar convidados aqui.";
  if (erro.code === "23505") return "Já existe um tipo com esse nome.";
  if (erro.code === "23503") return "Esse tipo tem convidados. Arquive em vez de apagar.";
  if ((erro.message ?? "").includes("cota_excedida")) return "A cota desse tipo já está cheia nesta sessão. Aumente a cota ou escolha outro tipo.";
  if ((erro.message ?? "").includes("tipo_arquivado")) return "Esse tipo está arquivado. Escolha outro.";
  return "Não foi possível salvar. Tente de novo.";
}
