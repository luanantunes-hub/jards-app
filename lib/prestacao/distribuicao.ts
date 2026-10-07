// Plano de distribuição (P3.4): cada linha é uma parte do plano de um produto,
// na categoria do regime. Na Rouanet (IN 29/2026, art. 41), por produto: até
// 10% para patrocinadores (I), até 10% promocional do proponente (II), ao
// menos 10% gratuito social ou educativo (III) e ao menos 20% vendido a até
// R$ 50 (IV); fora das cotas, preço médio do inteiro até R$ 250 (§ 3º), meia
// para estudantes em ao menos 40% dos vendidos (§ 2º) e receita prevista até o
// valor do projeto (§ 4º). Os números vêm das regras do regime. Sem React e
// sem Supabase.

import { cnpjValido, cpfValido, limparDocumento } from "./fornecedores";
import { regraDoRegime, type RegimeNormativo } from "./regimes";
import type { PrestacaoDistribuicao } from "@/lib/supabase/types";

export type CategoriaDistribuicao = PrestacaoDistribuicao["categoria"];
export type Cota = "patrocinador" | "proponente" | "social" | "popular";

export const LIMITE_JUSTIFICATIVA_DISTRIBUICAO = 2000;

export const CATEGORIAS_DISTRIBUICAO: readonly {
  id: CategoriaDistribuicao;
  rotulo: string;
  descricao: string;
  /** Tem preço e pode ter meia-entrada. */
  venda: boolean;
  /** A cota do art. 41 em que a categoria conta. */
  cota: Cota | null;
  /** Quem recebe é uma entidade ou escola (art. 43). */
  pedeBeneficiario: boolean;
}[] = [
  { id: "patrocinador", rotulo: "Patrocinador", descricao: "Gratuita, promocional dos patrocinadores", venda: false, cota: "patrocinador", pedeBeneficiario: false },
  { id: "proponente", rotulo: "Proponente", descricao: "Gratuita, promocional do proponente (divulgação)", venda: false, cota: "proponente", pedeBeneficiario: false },
  { id: "social", rotulo: "Social", descricao: "Gratuita, por entidade representativa do público", venda: false, cota: "social", pedeBeneficiario: true },
  { id: "educativo", rotulo: "Educativo", descricao: "Gratuita, por escola pública, com os professores", venda: false, cota: "social", pedeBeneficiario: true },
  // Acesso livre conta na cota social: a IN fala em distribuição gratuita de caráter social.
  { id: "gratuita", rotulo: "Gratuita ao público", descricao: "Acesso gratuito e aberto à população", venda: false, cota: "social", pedeBeneficiario: false },
  { id: "popular", rotulo: "Preço popular", descricao: "Venda até o preço popular do regime", venda: true, cota: "popular", pedeBeneficiario: false },
  { id: "venda", rotulo: "Venda", descricao: "Venda a preço livre", venda: true, cota: null, pedeBeneficiario: false },
];

export const categoriaDistribuicao = (id: string) => CATEGORIAS_DISTRIBUICAO.find(c => c.id === id);
export const rotuloDaCategoria = (id: string) => categoriaDistribuicao(id)?.rotulo ?? id;

export const COTAS: readonly { id: Cota; rotulo: string; dispositivo: string }[] = [
  { id: "patrocinador", rotulo: "Patrocinadores", dispositivo: "art. 41, I" },
  { id: "proponente", rotulo: "Proponente", dispositivo: "art. 41, II" },
  { id: "social", rotulo: "Social e educativa", dispositivo: "art. 41, III" },
  { id: "popular", rotulo: "Preço popular", dispositivo: "art. 41, IV" },
];

export type LinhaDistribuicao = Pick<PrestacaoDistribuicao,
  "id" | "produto" | "categoria" | "quantidade" | "quantidade_meia" | "preco" | "quantidade_realizada" | "beneficiario" | "beneficiario_documento" | "justificativa">;

// ─── Limites do regime ──────────────────────────────────────────────────────

export type LimitesDistribuicao = {
  /** Em % do total do produto; null quando o regime não define. */
  patrocinadoresMax: number | null;
  proponenteMax: number | null;
  socialMin: number | null;
  popularMin: number | null;
  /** Teto do ingresso inteiro na cota popular, em reais. */
  precoPopular: number | null;
  /** Preço médio do inteiro fora das cotas, em reais. */
  precoMedioMax: number | null;
  /** Meia-entrada de estudantes, em % dos vendidos. */
  meiaMin: number | null;
  /** O regime limita a receita prevista ao valor do projeto. */
  receitaAteOValor: boolean;
};

const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Os limites das regras de distribuição do regime; null quando o regime não tem cotas. */
export function limitesDoRegime(regime: RegimeNormativo | null | undefined): LimitesDistribuicao | null {
  const cotas = regraDoRegime(regime, "cotas_distribuicao");
  if (!cotas) return null;
  const p = cotas.parametros ?? {};
  return {
    patrocinadoresMax: numero(p.patrocinadoresMax),
    proponenteMax: numero(p.proponenteMax),
    socialMin: numero(p.socialMin),
    popularMin: numero(p.popularMin),
    precoPopular: numero(p.precoPopular),
    precoMedioMax: numero(regraDoRegime(regime, "preco_medio")?.parametros?.valor),
    meiaMin: numero(regraDoRegime(regime, "meia_entrada")?.parametros?.estudantesMin),
    receitaAteOValor: Boolean(regraDoRegime(regime, "receita_prevista")),
  };
}

// ─── Resumo por produto ─────────────────────────────────────────────────────

/** "Espetáculo Raízes" e "espetaculo  raizes" são o mesmo produto. */
export function chaveDoProduto(produto: string): string {
  return produto.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, "-");
}

const centavos = (v: number) => Math.round(v * 100);

/** Receita da linha: inteiras ao preço e meias à metade, em reais. */
export function receitaDaLinha(l: Pick<LinhaDistribuicao, "categoria" | "quantidade" | "quantidade_meia" | "preco">): number {
  if (!categoriaDistribuicao(l.categoria)?.venda || !l.preco) return 0;
  const meias = Math.min(l.quantidade_meia ?? 0, l.quantidade);
  return (centavos(Number(l.preco)) * (l.quantidade - meias) + Math.round(centavos(Number(l.preco)) / 2) * meias) / 100;
}

export type BaseDaDistribuicao = "previsto" | "realizado";

export type ResumoDoProduto<L extends LinhaDistribuicao = LinhaDistribuicao> = {
  chave: string;
  produto: string;
  linhas: L[];
  /** Realizado quando todas as linhas do produto têm a quantidade realizada. */
  base: BaseDaDistribuicao;
  total: number;
  porCota: Record<Cota, number>;
  /** Vendidos e meias do plano (a meia é parametrizada no plano). */
  vendidos: number;
  meias: number;
  /** Preço médio do inteiro na venda a preço livre, ponderado pela quantidade. */
  precoMedio: number | null;
  /** Receita prevista, sempre do plano. */
  receita: number;
};

const quantidadeNaBase = (l: LinhaDistribuicao, base: BaseDaDistribuicao) =>
  base === "realizado" ? l.quantidade_realizada ?? 0 : l.quantidade;

/** Produtos na ordem em que aparecem, com os totais por cota na base certa. */
export function resumosPorProduto<L extends LinhaDistribuicao>(linhas: readonly L[], limites?: LimitesDistribuicao | null): ResumoDoProduto<L>[] {
  const grupos = new Map<string, L[]>();
  for (const l of linhas) {
    const chave = chaveDoProduto(l.produto);
    grupos.set(chave, [...(grupos.get(chave) ?? []), l]);
  }
  return [...grupos.entries()].map(([chave, doProduto]) => {
    const base: BaseDaDistribuicao = doProduto.every(l => l.quantidade_realizada !== null && l.quantidade_realizada !== undefined) ? "realizado" : "previsto";
    const porCota: Record<Cota, number> = { patrocinador: 0, proponente: 0, social: 0, popular: 0 };
    let total = 0, vendidos = 0, meias = 0, livres = 0, somaLivres = 0, receita = 0;
    for (const l of doProduto) {
      const q = quantidadeNaBase(l, base);
      total += q;
      const categoria = categoriaDistribuicao(l.categoria);
      // Acima do teto, o ingresso não conta como preço popular.
      const acimaDoTeto = l.categoria === "popular" && limites?.precoPopular != null && Number(l.preco) > limites.precoPopular;
      if (categoria?.cota && !acimaDoTeto) porCota[categoria.cota] += q;
      if (categoria?.venda) {
        vendidos += l.quantidade;
        meias += Math.min(l.quantidade_meia ?? 0, l.quantidade);
        receita += receitaDaLinha(l);
      }
      if (l.categoria === "venda" && l.preco) {
        livres += q;
        somaLivres += q * Number(l.preco);
      }
    }
    return {
      chave,
      produto: doProduto[0].produto.trim(),
      linhas: doProduto,
      base,
      total,
      porCota,
      vendidos,
      meias,
      precoMedio: livres > 0 ? Math.round((somaLivres / livres) * 100) / 100 : null,
      receita: Math.round(receita * 100) / 100,
    };
  });
}

/** 12.5 para 1 de 8; uma casa decimal só quando precisa. */
export function percentual(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 1000) / 10 : 0;
}

export type SituacaoDaCota = {
  cota: Cota;
  rotulo: string;
  dispositivo: string;
  quantidade: number;
  percentual: number;
  /** "max": até o limite; "min": ao menos o limite. */
  sentido: "max" | "min";
  limite: number;
  dentro: boolean;
};

/**
 * As cotas que valem para o produto. A popular só vale quando o produto tem
 * venda: sem venda, não há o que vender a preço popular.
 */
export function cotasDoProduto(resumo: Pick<ResumoDoProduto, "porCota" | "total" | "vendidos">, limites: LimitesDistribuicao): SituacaoDaCota[] {
  const definicoes: [Cota, "max" | "min", number | null][] = [
    ["patrocinador", "max", limites.patrocinadoresMax],
    ["proponente", "max", limites.proponenteMax],
    ["social", "min", limites.socialMin],
    ["popular", "min", resumo.vendidos > 0 ? limites.popularMin : null],
  ];
  return definicoes.flatMap(([cota, sentido, limite]) => {
    if (limite === null || resumo.total <= 0) return [];
    const quantidade = resumo.porCota[cota];
    // Compara sem arredondar: 10% de 501 é 50,1, e 50 fica abaixo.
    const dentro = sentido === "max" ? quantidade * 100 <= limite * resumo.total : quantidade * 100 >= limite * resumo.total;
    const def = COTAS.find(c => c.id === cota)!;
    return [{ cota, rotulo: def.rotulo, dispositivo: def.dispositivo, quantidade, percentual: percentual(quantidade, resumo.total), sentido, limite, dentro }];
  });
}

/** "6%" ou "12,5%". */
export const formatarPercentual = (p: number) => `${p.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

// ─── Formulário ─────────────────────────────────────────────────────────────

export type CamposDaDistribuicao = Omit<LinhaDistribuicao, "id">;

/** O mesmo que o banco confere, para a tela avisar antes de salvar. */
export function erroDaDistribuicao(l: CamposDaDistribuicao): string | null {
  const categoria = categoriaDistribuicao(l.categoria);
  if (!l.produto.trim()) return "Informe o produto: o espetáculo, o livro, a exposição.";
  if (l.produto.trim().length > 200) return "O nome do produto tem até 200 caracteres.";
  if (!categoria) return "Escolha a categoria.";
  if (!Number.isInteger(l.quantidade) || l.quantidade <= 0) return "A quantidade prevista é um número inteiro maior que zero.";
  if (categoria.venda) {
    if (!l.preco || !Number.isFinite(Number(l.preco)) || Number(l.preco) <= 0) return "Informe o preço do ingresso inteiro.";
    if (!Number.isInteger(l.quantidade_meia) || l.quantidade_meia < 0 || l.quantidade_meia > l.quantidade) return "A meia-entrada é parte da quantidade.";
  }
  if (l.quantidade_realizada !== null && (!Number.isInteger(l.quantidade_realizada) || l.quantidade_realizada < 0)) return "A quantidade realizada é um número inteiro a partir de zero.";
  if (l.beneficiario_documento) {
    const doc = limparDocumento(l.beneficiario_documento);
    if (!cpfValido(doc) && !cnpjValido(doc)) return "O CPF ou CNPJ de quem recebeu não confere.";
  }
  if ((l.justificativa?.length ?? 0) > LIMITE_JUSTIFICATIVA_DISTRIBUICAO) return `A justificativa tem até ${LIMITE_JUSTIFICATIVA_DISTRIBUICAO} caracteres.`;
  return null;
}

/** A linha que mudou do plano pede uma explicação (art. 76, II, f, na Rouanet). */
export const linhaAlterada = (l: Pick<LinhaDistribuicao, "quantidade" | "quantidade_realizada">) =>
  l.quantidade_realizada !== null && l.quantidade_realizada !== undefined && l.quantidade_realizada !== l.quantidade;
