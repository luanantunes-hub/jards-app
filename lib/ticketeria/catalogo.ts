// O catálogo do evento (T3 do plano em docs/acoes-futuras/estudos/plano-modulo-ticketeria.md): os ingressos (tipo e setor) e os
// lotes (preço, quantidade por sessão e janela de venda). A leitura do que a pessoa digita, as contas dos lugares e as frases da
// tela. Sem tela e sem banco. Dinheiro sempre em centavos inteiros.

import { emCentavos, formatarReais, lerValorEmReais } from "@/lib/producao/dinheiro";
import type { CategoriaDoIngresso } from "@/lib/ticketeria/estados";
import { instanteNoFuso } from "@/lib/ticketeria/eventos";

export { formatarReais };

export const ROTULO_DA_CATEGORIA: Record<CategoriaDoIngresso, string> = {
  inteira: "Inteira", meia: "Meia-entrada", social: "Social", gratuito: "Gratuito", cortesia: "Cortesia", outra: "Outra",
};

/** O nome com que o ingresso nasce, pela categoria (a pessoa pode trocar). */
export const NOME_PADRAO: Record<CategoriaDoIngresso, string> = {
  inteira: "Inteira", meia: "Meia-entrada", social: "Ingresso social", gratuito: "Entrada gratuita", cortesia: "Cortesia", outra: "",
};

/** Gratuito e cortesia custam zero; as outras categorias, mais que zero (o banco confere: preco_incoerente). */
export const semPreco = (categoria: CategoriaDoIngresso) => categoria === "gratuito" || categoria === "cortesia";

/** A cortesia é distribuída pela produção: por padrão, não aparece ao público. */
export const publicoPorPadrao = (categoria: CategoriaDoIngresso) => categoria !== "cortesia";

const texto = (valor: string | null | undefined) => (valor ?? "").trim();

export type LeituraDoIngresso =
  | { ok: true; valor: { nome: string; categoria: CategoriaDoIngresso; limite_por_pedido: number; publico: boolean } }
  | { ok: false; erro: string; campo: string };

export function lerIngresso(campos: { nome: string; categoria: string; limite: string; publico: boolean }): LeituraDoIngresso {
  if (!(campos.categoria in ROTULO_DA_CATEGORIA)) return { ok: false, erro: "Escolha a categoria do ingresso.", campo: "categoria" };
  const categoria = campos.categoria as CategoriaDoIngresso;
  const nome = texto(campos.nome);
  if (nome === "" || nome.length > 120) return { ok: false, erro: "Dê um nome ao ingresso (até 120 letras).", campo: "nome" };
  const limite = /^\d+$/.test(texto(campos.limite)) ? Number(texto(campos.limite)) : Number.NaN;
  if (!Number.isInteger(limite) || limite < 1 || limite > 50) return { ok: false, erro: "O limite por pedido vai de 1 a 50 ingressos.", campo: "limite" };
  return { ok: true, valor: { nome, categoria, limite_por_pedido: limite, publico: campos.publico } };
}

export type LeituraDoLote =
  | { ok: true; valor: { nome: string; preco_centavos: number; quantidade: number; vendas_inicio: string | null; vendas_fim: string | null } }
  | { ok: false; erro: string; campo: string };

/**
 * O lote como a pessoa digita: o nome, o preço em reais (zero, ou vazio, em gratuito e cortesia), a quantidade por sessão e a janela
 * de venda (dia e hora no fuso do local; sem início, abre quando o evento é publicado; sem fim, vai até a sessão).
 */
export function lerLote(
  campos: { nome: string; preco: string; quantidade: string; inicioDia: string; inicioHora: string; fimDia: string; fimHora: string },
  categoria: CategoriaDoIngresso,
  fuso: string,
): LeituraDoLote {
  const nome = texto(campos.nome);
  if (nome === "" || nome.length > 60) return { ok: false, erro: "Dê um nome ao lote (até 60 letras), como 1º lote.", campo: "nome" };
  let preco_centavos = 0;
  if (semPreco(categoria)) {
    const digitado = texto(campos.preco) === "" ? 0 : lerValorEmReais(campos.preco);
    if (digitado !== 0) return { ok: false, erro: `${ROTULO_DA_CATEGORIA[categoria]} não tem preço.`, campo: "preco" };
  } else {
    const reais = lerValorEmReais(campos.preco);
    if (reais === null || reais <= 0) return { ok: false, erro: "Escreva o preço em reais, como 50 ou 25,50.", campo: "preco" };
    if (reais > 100000) return { ok: false, erro: "O preço vai até R$ 100.000.", campo: "preco" };
    preco_centavos = emCentavos(reais);
  }
  const bruto = texto(campos.quantidade).replace(/\./g, "");
  const quantidade = /^\d+$/.test(bruto) ? Number(bruto) : Number.NaN;
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 200000) return { ok: false, erro: "A quantidade por sessão vai de 1 a 200.000.", campo: "quantidade" };
  const momento = (dia: string, hora: string, campo: string): { ok: true; iso: string | null } | { ok: false; erro: string; campo: string } => {
    if (texto(dia) === "" && texto(hora) === "") return { ok: true, iso: null };
    if (texto(dia) === "") return { ok: false, erro: "Escolha o dia.", campo };
    const iso = instanteNoFuso(texto(dia), texto(hora) || "00:00", fuso);
    return iso ? { ok: true, iso } : { ok: false, erro: "Esse dia ou essa hora não existem.", campo };
  };
  const inicio = momento(campos.inicioDia, campos.inicioHora, "inicio");
  if (!inicio.ok) return inicio;
  const fim = momento(campos.fimDia, campos.fimHora, "fim");
  if (!fim.ok) return fim;
  if (inicio.iso && fim.iso && Date.parse(fim.iso) <= Date.parse(inicio.iso)) return { ok: false, erro: "O fim das vendas tem de ser depois do começo.", campo: "fim" };
  return { ok: true, valor: { nome, preco_centavos, quantidade, vendas_inicio: inicio.iso, vendas_fim: fim.iso } };
}

/** A meia-entrada: metade da inteira, arredondada ao centavo (Lei 12.933/2013). */
export const precoDaMeia = (inteiraCentavos: number) => Math.round(inteiraCentavos / 2);

/** O nome do lote seguinte: "1º lote", "2º lote"... */
export const nomeDoProximoLote = (quantosJaTem: number) => `${quantosJaTem + 1}º lote`;

export type SituacaoDoLote = "antes" | "na_janela" | "encerrado";

/** Onde o lote está na janela de venda, agora (sem contar o que já foi vendido, que é da T5). */
export function situacaoDoLote(lote: { vendas_inicio: string | null; vendas_fim: string | null }, agora: number = Date.now()): SituacaoDoLote {
  if (lote.vendas_inicio && Date.parse(lote.vendas_inicio) > agora) return "antes";
  if (lote.vendas_fim && Date.parse(lote.vendas_fim) <= agora) return "encerrado";
  return "na_janela";
}

/**
 * O lote da vez de um ingresso: o primeiro, na ordem, cuja janela está aberta agora. Os lotes seguem em sequência; o seguinte só abre
 * quando o anterior esgota (conta da venda, T5) ou a janela dele fecha.
 */
export function loteDaVez<T extends { ordem: number; vendas_inicio: string | null; vendas_fim: string | null }>(lotes: readonly T[], agora: number = Date.now()): T | null {
  return [...lotes].sort((a, b) => a.ordem - b.ordem).find(lote => situacaoDoLote(lote, agora) === "na_janela") ?? null;
}

/** O preço para mostrar: "R$ 50,00", ou "Grátis". */
export const precoParaMostrar = (centavos: number) => (centavos === 0 ? "Grátis" : formatarReais(centavos));

/** O erro do banco numa frase. */
export function mensagemDoErroDoCatalogo(erro: { code?: string; message?: string }): string {
  const m = erro.message ?? "";
  if (erro.code === "42501") return "Você não pode mudar a Ticketeria desta organização.";
  if (m.includes("lugares_excedidos")) return "Passa dos lugares do setor. Diminua a quantidade ou aumente os lugares do setor em Espaços.";
  if (m.includes("preco_incoerente")) return "O preço não combina com a categoria: gratuito e cortesia custam zero; as outras, mais que zero.";
  if (m.includes("setor_arquivado")) return "Esse setor está arquivado. Escolha outro.";
  if (m.includes("evento_cancelado")) return "O evento está cancelado e não muda mais.";
  if (m.includes("ticketeria_ingressos_setor_id_fkey")) return "Esse setor tem ingressos e não se apaga: arquive-o.";
  return "Não foi possível salvar. Tente de novo.";
}
