// Bens permanentes (P3.5). A IN 29/2026 só aceita bem permanente previsto na
// planilha, com a destinação declarada (art. 30), e pede no relatório final a
// relação de bens móveis e obras de arte com o comprovante da cotação, a de
// imóveis e o recibo de quem recebeu o bem doado (art. 69, VI, VII e X). O
// item da planilha marcado como bem permanente diz quais despesas compram bens.
// Sem React e sem Supabase.

import { cnpjValido, cpfValido, limparDocumento } from "./fornecedores";
import type { CotacaoDoBem, PrestacaoBem } from "@/lib/supabase/types";

export type TipoBem = PrestacaoBem["tipo"];
export type DestinacaoBem = NonNullable<PrestacaoBem["destinacao"]>;

export const MAXIMO_COTACOES = 3;
export const LIMITE_OBSERVACOES_BEM = 1000;

export const TIPOS_BEM: readonly { id: TipoBem; rotulo: string; pedeCotacao: boolean }[] = [
  { id: "equipamento", rotulo: "Equipamento", pedeCotacao: true },
  { id: "movel", rotulo: "Móvel", pedeCotacao: true },
  { id: "obra_de_arte", rotulo: "Obra de arte", pedeCotacao: true },
  { id: "imovel", rotulo: "Imóvel", pedeCotacao: false },
];

export const DESTINACOES_BEM: readonly { id: DestinacaoBem; rotulo: string; descricao: string }[] = [
  { id: "doacao", rotulo: "Doação", descricao: "Doado a uma entidade (na Rouanet, pública e cultural), com o recibo de quem recebeu" },
  { id: "proponente", rotulo: "Fica com o proponente", descricao: "Segue em uso pelo proponente, para fins culturais" },
  { id: "outra", rotulo: "Outra", descricao: "Descreva o destino do bem" },
];

export const rotuloDoTipoBem = (id: string) => TIPOS_BEM.find(t => t.id === id)?.rotulo ?? id;
export const rotuloDaDestinacao = (id: string | null | undefined) => (id ? DESTINACOES_BEM.find(d => d.id === id)?.rotulo ?? id : "Sem destinação");

/** As cotações gravadas, só as bem formadas (o banco já confere; isto protege a tela). */
export function lerCotacoes(valor: unknown): CotacaoDoBem[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap(c => {
    if (!c || typeof c !== "object") return [];
    const { fornecedor, valor: preco } = c as Record<string, unknown>;
    if (typeof fornecedor !== "string" || typeof preco !== "number" || !(preco > 0)) return [];
    return [c as CotacaoDoBem];
  });
}

/** A cotação de menor valor; null sem cotação. */
export function menorCotacao(cotacoes: readonly CotacaoDoBem[]): CotacaoDoBem | null {
  return cotacoes.reduce<CotacaoDoBem | null>((menor, c) => (menor === null || c.valor < menor.valor ? c : menor), null);
}

export type BemParaChecar = Pick<PrestacaoBem,
  "id" | "no_id" | "despesa_id" | "tipo" | "descricao" | "valor" | "registro_imovel" | "cotacoes" | "destinacao"
  | "beneficiario" | "doacao_storage_path" | "aceite_storage_path" | "justificativa">;

export type DespesaComItem = { id: string; no_id: string | null; status: string };

/**
 * A despesa que comprou bem está coberta quando um bem aponta para ela, ou
 * quando um bem foi registrado no item sem despesa (um bem feito de várias
 * despesas, por exemplo).
 */
export function despesaTemBem(despesa: DespesaComItem, bens: readonly Pick<BemParaChecar, "no_id" | "despesa_id">[]): boolean {
  return bens.some(b => b.despesa_id === despesa.id || (!b.despesa_id && b.no_id !== null && b.no_id === despesa.no_id));
}

/** Despesas (não recusadas) de itens marcados como bem permanente que ainda não têm bem. */
export function despesasSemBem<D extends DespesaComItem>(
  despesas: readonly D[],
  itensDeBem: ReadonlySet<string>,
  bens: readonly Pick<BemParaChecar, "no_id" | "despesa_id">[],
): D[] {
  return despesas.filter(d => d.status !== "rejeitado" && d.no_id !== null && itensDeBem.has(d.no_id) && !despesaTemBem(d, bens));
}

/** O que falta na doação para o recibo do art. 69, X (quem recebeu, o termo e o aceite). */
export function faltaNaDoacao(b: Pick<BemParaChecar, "destinacao" | "beneficiario" | "doacao_storage_path" | "aceite_storage_path">): string[] {
  if (b.destinacao !== "doacao") return [];
  return [
    !b.beneficiario?.trim() ? "quem recebeu" : null,
    !b.doacao_storage_path ? "o termo de doação" : null,
    !b.aceite_storage_path ? "o aceite de quem recebeu" : null,
  ].filter((x): x is string => x !== null);
}

/** "quem recebeu, o termo e o aceite" */
export function listaEmTexto(itens: readonly string[]): string {
  return itens.length <= 1 ? itens.join("") : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

export type CamposDoBem = Pick<PrestacaoBem,
  "tipo" | "descricao" | "quantidade" | "valor" | "numero_patrimonio" | "registro_imovel" | "cotacoes" | "destinacao"
  | "destinacao_descricao" | "beneficiario" | "beneficiario_documento" | "justificativa" | "observacoes">;

/** O mesmo que o banco confere, para a tela avisar antes de salvar. */
export function erroDoBem(b: CamposDoBem): string | null {
  if (!b.descricao.trim()) return "Descreva o bem.";
  if (b.descricao.trim().length > 300) return "A descrição tem até 300 caracteres.";
  if (!Number.isInteger(b.quantidade) || b.quantidade <= 0) return "A quantidade é um número inteiro maior que zero.";
  if (b.valor !== null && (!Number.isFinite(b.valor) || b.valor < 0)) return "O valor é um número a partir de zero.";
  if (b.cotacoes.length > MAXIMO_COTACOES) return `Registre até ${MAXIMO_COTACOES} cotações.`;
  for (const c of b.cotacoes) {
    if (!c.fornecedor.trim()) return "Cada cotação tem o fornecedor.";
    if (!Number.isFinite(c.valor) || c.valor <= 0) return `A cotação de ${c.fornecedor.trim()} precisa de um valor.`;
  }
  if (b.destinacao === "outra" && !b.destinacao_descricao?.trim()) return "Descreva o destino do bem.";
  if (b.beneficiario_documento) {
    const doc = limparDocumento(b.beneficiario_documento);
    if (!cpfValido(doc) && !cnpjValido(doc)) return "O CPF ou CNPJ de quem recebeu não confere.";
  }
  if ((b.observacoes?.length ?? 0) > LIMITE_OBSERVACOES_BEM) return `As observações têm até ${LIMITE_OBSERVACOES_BEM} caracteres, como no Salic.`;
  return null;
}
