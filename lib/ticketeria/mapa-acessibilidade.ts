// Os tipos de lugar do mapa de assentos e a conta de referência de acessibilidade (M2 do estudo ticketeria-mapa-de-assentos-avancado.md).
// Só lógica: sem banco, sem tela e sem import de servidor (tests/ticketeria-mapa-acessibilidade.test.ts).
//
// A regra de referência vem do texto do Decreto 9.404/2018, que deu nova redação ao art. 23 do Decreto 5.296/2004 (lido em
// https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/d9404.htm em 23/11/2026; ver o estudo, seção 4):
//   - até 1.000 lugares: 2% de espaços para cadeira de rodas e 2% de assentos para pessoas com deficiência ou mobilidade reduzida, cada um com no mínimo 1;
//   - acima de 1.000: 20 de cada mais 1% do que passar de mil;
//   - 50% dos assentos reservados para mobilidade reduzida devem ser para uso de pessoa obesa, no mínimo 1;
//   - número fracionado: o primeiro inteiro acima (art. 23, § 9º);
//   - esses lugares devem estar IDENTIFICADOS no mapa de assentos de toda venda e divulgação (art. 23-B).
// É uma referência para o produtor, informativa como o resto do produto: avisa, não impede. Um texto consolidado mais novo, a norma ABNT e regras
// estaduais ou municipais (o estudo cita o Paraná, com 3%) podem pedir mais: confira com quem entende da lei antes de prometer "em conformidade".

export type TipoDeLugar = "comum" | "cadeira_rodas" | "acompanhante" | "mobilidade_reduzida" | "obeso";

export const TIPOS_DE_LUGAR: readonly TipoDeLugar[] = ["comum", "cadeira_rodas", "acompanhante", "mobilidade_reduzida", "obeso"];

/** O nome de cada tipo, como o produtor e o comprador leem. */
export const TIPO_EM_TEXTO: Record<TipoDeLugar, string> = {
  comum: "Lugar comum",
  cadeira_rodas: "Espaço para cadeira de rodas",
  acompanhante: "Lugar para acompanhante",
  mobilidade_reduzida: "Assento para deficiência ou mobilidade reduzida",
  obeso: "Assento para pessoa obesa",
};

/** O nome curto, para a fala do leitor de tela e para a legenda. */
export const TIPO_CURTO: Record<TipoDeLugar, string> = {
  comum: "comum",
  cadeira_rodas: "cadeira de rodas",
  acompanhante: "acompanhante",
  mobilidade_reduzida: "mobilidade reduzida",
  obeso: "pessoa obesa",
};

/** O selo desenhado no canto do lugar: uma letra (a cor sozinha não basta) e a cor. */
export const SELO_DO_TIPO: Record<Exclude<TipoDeLugar, "comum">, { letra: string; cor: string }> = {
  cadeira_rodas: { letra: "R", cor: "#1D4ED8" },
  acompanhante: { letra: "A", cor: "#6450D2" },
  mobilidade_reduzida: { letra: "M", cor: "#0F766E" },
  obeso: { letra: "O", cor: "#B45309" },
};

export const ehTipoDeLugar = (v: unknown): v is TipoDeLugar => typeof v === "string" && (TIPOS_DE_LUGAR as readonly string[]).includes(v);

// ─── A referência ───────────────────────────────────────────────────────────

export type ReferenciaDeAcessibilidade = { total: number; cadeiraRodas: number; mobilidadeReduzida: number; obesos: number };

/** Quantos espaços e assentos a referência pede para uma lotação de `total` lugares. Total inválido ou zero: nada. */
export function referenciaDeAcessibilidade(total: number): ReferenciaDeAcessibilidade {
  if (!Number.isFinite(total) || total <= 0) return { total: 0, cadeiraRodas: 0, mobilidadeReduzida: 0, obesos: 0 };
  const lugares = Math.floor(total);
  // Em centésimos (inteiros) para não errar o "primeiro inteiro acima" com ponto flutuante: 2% de 150 = 3, não 3,0000000000000004.
  const reservados = lugares <= 1000 ? Math.max(1, Math.ceil((lugares * 2) / 100)) : 20 + Math.ceil((lugares - 1000) / 100);
  return { total: lugares, cadeiraRodas: reservados, mobilidadeReduzida: reservados, obesos: Math.max(1, Math.ceil(reservados / 2)) };
}

// ─── A contagem e a conferência ─────────────────────────────────────────────

export type ContagemDeTipos = Record<TipoDeLugar, number>;

export const contagemVazia = (): ContagemDeTipos => ({ comum: 0, cadeira_rodas: 0, acompanhante: 0, mobilidade_reduzida: 0, obeso: 0 });

/** Quantos lugares há de cada tipo, entre as chaves de TODOS os lugares (o que não está em `tipos` é comum). */
export function contarTipos(chaves: Iterable<string>, tipos: ReadonlyMap<string, TipoDeLugar>): ContagemDeTipos {
  const c = contagemVazia();
  for (const chave of chaves) c[tipos.get(chave) ?? "comum"]++;
  return c;
}

export type ItemDaReferencia = "cadeira_rodas" | "mobilidade_reduzida" | "obesos";
export type SituacaoDoItem = { item: ItemDaReferencia; tem: number; precisa: number; ok: boolean };

/**
 * O que há contra o que a referência pede. Os assentos para pessoa obesa contam também como assentos de mobilidade reduzida (são esses mesmos lugares,
 * maiores), e a referência para obesos é metade dos assentos que a referência pede de mobilidade reduzida.
 */
export function conferirAcessibilidade(contagem: ContagemDeTipos): SituacaoDoItem[] {
  const total = Object.values(contagem).reduce((a, b) => a + b, 0);
  const ref = referenciaDeAcessibilidade(total);
  const itens: SituacaoDoItem[] = [
    { item: "cadeira_rodas", tem: contagem.cadeira_rodas, precisa: ref.cadeiraRodas, ok: false },
    { item: "mobilidade_reduzida", tem: contagem.mobilidade_reduzida + contagem.obeso, precisa: ref.mobilidadeReduzida, ok: false },
    { item: "obesos", tem: contagem.obeso, precisa: ref.obesos, ok: false },
  ];
  return itens.map(i => ({ ...i, ok: i.precisa === 0 || i.tem >= i.precisa }));
}

const NOME_DO_ITEM: Record<ItemDaReferencia, { um: string; varios: string }> = {
  cadeira_rodas: { um: "espaço para cadeira de rodas", varios: "espaços para cadeira de rodas" },
  mobilidade_reduzida: { um: "assento para deficiência ou mobilidade reduzida", varios: "assentos para deficiência ou mobilidade reduzida" },
  obesos: { um: "assento para pessoa obesa", varios: "assentos para pessoa obesa" },
};

/** Frases para o produtor, uma por item que está abaixo da referência; lista vazia quando tudo bate. Informativo. */
export function frasesDaAcessibilidade(situacao: readonly SituacaoDoItem[], total: number): string[] {
  return situacao.filter(s => !s.ok).map(s => {
    const falta = s.precisa - s.tem;
    const nome = NOME_DO_ITEM[s.item];
    return `Faltam ${falta} ${falta === 1 ? nome.um : nome.varios}: a referência para ${total} lugares é ${s.precisa} e há ${s.tem}.`;
  });
}

// ─── Mudar o tipo ───────────────────────────────────────────────────────────

/** Um mapa novo de tipos com o tipo de um lugar trocado; "comum" tira o lugar do mapa (comum é o padrão). */
export function comTipo(tipos: ReadonlyMap<string, TipoDeLugar>, chave: string, tipo: TipoDeLugar): Map<string, TipoDeLugar> {
  const novo = new Map(tipos);
  if (tipo === "comum") novo.delete(chave);
  else novo.set(chave, tipo);
  return novo;
}

/** Os tipos que aparecem no mapa, na ordem de sempre, sem o comum: é o que a legenda mostra. */
export function tiposPresentes(tipos: ReadonlyMap<string, TipoDeLugar>): Exclude<TipoDeLugar, "comum">[] {
  const vistos = new Set(tipos.values());
  return TIPOS_DE_LUGAR.filter((t): t is Exclude<TipoDeLugar, "comum"> => t !== "comum" && vistos.has(t));
}
