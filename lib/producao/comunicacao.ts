// A comunicação de uma data (plano do módulo, PD9.5, primeiro corte): o kit de imprensa — o release, as artes, as
// fotos e o clipping —, a leitura do formulário com as regras do banco e o texto para copiar. Sem tela e sem banco.
//
// O credenciamento de imprensa, que o plano previa aqui, saiu com os ingressos (T1 da Ticketeria): as credenciais
// não existem mais na Produção.

import type { TipoDeComunicacao } from "@/lib/producao/estados";

export const ROTULO_DA_COMUNICACAO: Record<TipoDeComunicacao, string> = {
  release: "Release", arte: "Arte", foto: "Foto", clipping: "Clipping", outro: "Outro",
};

/** A ordem em que os tipos aparecem no kit: o release primeiro, o resto como material. */
export const ORDEM_DOS_TIPOS: readonly TipoDeComunicacao[] = ["release", "arte", "foto", "clipping", "outro"];

export type ItemDaComunicacao = { id: string; tipo: TipoDeComunicacao; titulo: string; texto: string | null; url: string | null; ordem: number };

export type CamposDaComunicacao = { tipo: TipoDeComunicacao; titulo: string; texto: string; url: string; ordem: string };
export type LeituraDaComunicacao = { ok: true; valor: { tipo: TipoDeComunicacao; titulo: string; texto: string | null; url: string | null; ordem: number } } | { ok: false; erro: string };

/** O item como o banco aceita: título até 200 letras, texto até 5.000, endereço https até 500, e ao menos um dos dois. */
export function lerItemDaComunicacao(campos: CamposDaComunicacao): LeituraDaComunicacao {
  const titulo = campos.titulo.trim();
  if (titulo === "") return { ok: false, erro: "Dê um título ao item." };
  if (titulo.length > 200) return { ok: false, erro: "O título pode ter até 200 letras." };
  const texto = campos.texto.trim() === "" ? null : campos.texto.trim();
  if (texto && texto.length > 5000) return { ok: false, erro: "O texto pode ter até 5.000 letras." };
  const url = campos.url.trim() === "" ? null : campos.url.trim();
  if (url && (url.length > 500 || !/^https:\/\/\S+$/.test(url))) return { ok: false, erro: "O endereço começa com https:// e não tem espaços." };
  if (!texto && !url) return { ok: false, erro: "Escreva o texto ou ponha o endereço do material." };
  const ordem = campos.ordem.trim() === "" ? 0 : Number(campos.ordem.trim());
  if (!Number.isInteger(ordem) || ordem < 0 || ordem > 999) return { ok: false, erro: "A ordem é um número de 0 a 999." };
  return { ok: true, valor: { tipo: campos.tipo, titulo, texto, url, ordem } };
}

/** Os itens na ordem em que se mostram: a ordem escolhida, depois o tipo e o título. */
export function ordenarComunicacao<T extends Pick<ItemDaComunicacao, "ordem" | "tipo" | "titulo">>(itens: readonly T[]): T[] {
  return [...itens].sort((a, b) =>
    a.ordem - b.ordem
    || ORDEM_DOS_TIPOS.indexOf(a.tipo) - ORDEM_DOS_TIPOS.indexOf(b.tipo)
    || a.titulo.localeCompare(b.titulo, "pt-BR"));
}

/**
 * O kit de imprensa em texto, para colar num e-mail: o cabeçalho com a data, os releases por extenso e o resto como
 * lista de endereços. Sem item, devolve nada.
 */
export function kitDeImprensa(titulo: string, itens: readonly ItemDaComunicacao[]): string | null {
  const ordenados = ordenarComunicacao(itens);
  if (ordenados.length === 0) return null;
  const linhas: string[] = [titulo, ""];
  for (const item of ordenados.filter(item => item.texto)) {
    linhas.push(`${ROTULO_DA_COMUNICACAO[item.tipo].toUpperCase()} · ${item.titulo}`, item.texto as string, "");
  }
  const comEndereco = ordenados.filter(item => item.url);
  if (comEndereco.length > 0) {
    linhas.push("Material:");
    for (const item of comEndereco) linhas.push(`- ${ROTULO_DA_COMUNICACAO[item.tipo]} · ${item.titulo}: ${item.url}`);
  }
  return linhas.join("\n").trim();
}

/** A mensagem do erro do banco, em português. */
export function mensagemDoErroDaComunicacao(erro: { code?: string; message?: string } | null): string {
  if (!erro) return "Não foi possível salvar. Tente de novo.";
  if (erro.code === "42501") return "Você não pode mudar a comunicação desta data.";
  if (erro.code === "23514") return "Confira o título, o texto e o endereço (começa com https://).";
  return "Não foi possível salvar. Tente de novo.";
}
