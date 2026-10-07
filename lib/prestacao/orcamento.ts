// Orçamento em árvore (P1.6): versões, nós, somas e tetos do regime.
//
// O banco (supabase/migrations/20261005180000_prestacao_orcamento_arvore.sql)
// guarda as versões e a árvore e confere a estrutura; aqui ficam a montagem
// da árvore, as somas por nó e os tetos por grupo de custo, para a tela e os
// testes. Valores somam em centavos para não acumular erro de ponto flutuante.

import { limparCnaesAceitos } from "./cnae";
import { definida, type RegimeNormativo } from "./regimes";
import { BASES_DO_ORCAMENTO, type BaseCalculo, type BaseDefinida, type BaseDoOrcamento, type Severidade } from "./regimes/tipos";

export const TIPOS_VERSAO = [
  { id: "solicitada", rotulo: "Solicitada" },
  { id: "aprovada", rotulo: "Aprovada para captar" },
  { id: "adequada", rotulo: "Adequada" },
  { id: "homologada", rotulo: "Homologada" },
  { id: "readequada", rotulo: "Readequada" },
] as const;
export type TipoVersao = (typeof TIPOS_VERSAO)[number]["id"];

export const TIPOS_NO = [
  { id: "item", rotulo: "Item" },
  { id: "produto", rotulo: "Produto" },
  { id: "etapa", rotulo: "Etapa" },
  { id: "meta", rotulo: "Meta" },
  { id: "grupo", rotulo: "Grupo" },
  { id: "local", rotulo: "Local" },
] as const;
export type TipoNo = (typeof TIPOS_NO)[number]["id"];

/**
 * Vocabulário dos grupos de custo: os mesmos códigos da coluna grupo_custo no
 * banco. Cada regime escolhe os seus e dá o nome que a norma usa (na LIE,
 * "administracao" é a atividade-meio; na saúde, os custos indiretos).
 */
export const GRUPOS_CUSTO = [
  { id: "execucao", rotulo: "Execução" },
  { id: "administracao", rotulo: "Administração" },
  { id: "divulgacao", rotulo: "Divulgação e acessibilidade" },
  { id: "captacao", rotulo: "Captação" },
  { id: "elaboracao", rotulo: "Elaboração" },
  { id: "agenciamento", rotulo: "Agenciamento" },
  { id: "gerenciamento", rotulo: "Gerenciamento" },
  { id: "colocacao", rotulo: "Coordenação e colocação" },
  { id: "direitos", rotulo: "Direitos autorais e conexos" },
  { id: "recolhimentos", rotulo: "Recolhimentos" },
] as const;
/** Código de grupo; o regime pode usar qualquer um do vocabulário. */
export type GrupoCusto = string;

export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
  "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

export function rotuloTipoVersao(tipo: string): string {
  return TIPOS_VERSAO.find(t => t.id === tipo)?.rotulo ?? tipo;
}

export function rotuloTipoNo(tipo: string): string {
  return TIPOS_NO.find(t => t.id === tipo)?.rotulo ?? tipo;
}

/** Nome do grupo: o da norma do regime, quando há, senão o geral. */
export function rotuloGrupo(grupo: string | null | undefined, regime?: RegimeNormativo | null): string {
  if (!grupo) return "Sem grupo de custo";
  const daNorma = regime ? definida(regime.orcamento)?.grupos.find(g => g.codigo === grupo)?.rotulo : undefined;
  return daNorma ?? GRUPOS_CUSTO.find(g => g.id === grupo)?.rotulo ?? grupo;
}

export type VersaoOrcamento = {
  id: string;
  prestacao_id: string;
  tipo: TipoVersao;
  nome: string | null;
  ativa: boolean;
  ato: string | null;
  data_ato: string | null;
  origem: string;
  copiada_de: string | null;
  created_at: string;
};

export type NoOrcamento = {
  id: string;
  versao_id: string;
  parent_id: string | null;
  tipo: TipoNo;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  uf: string | null;
  municipio: string | null;
  grupo_custo: GrupoCusto | null;
  unidade: string | null;
  quantidade: number | null;
  ocorrencias: number | null;
  valor_unitario: number | null;
  valor_total: number;
  valor_remanejado: number;
  ordem: number;
  /** CNAEs aceitos (P2.4), só algarismos; vazio ou null herda do agrupador. */
  cnaes_aceitos?: string[] | null;
  /** Item da planilha que é bem permanente (P3.5; art. 30 da IN 29). */
  bem_permanente?: boolean;
};

export type ComprovanteDoOrcamento = {
  /** Liga a despesa aos pagamentos (P2.5); sem ele, a despesa fica toda comprometida. */
  id?: string;
  no_id: string | null;
  status: string;
  valor_extraido: number | null;
  /** Bruto menos retenções (P2.4), calculado pelo banco; sem ele, vale o bruto. */
  valor_liquido?: number | null;
};

/** Pagamento da despesa (P2.5). Só o que está ligado a um lançamento do extrato (P2.6) conta como pago. */
export type PagamentoDoOrcamento = {
  despesa_id: string;
  valor: number;
  lancamento_id: string | null;
};

export type Totais = {
  aprovado: number;
  remanejado: number;
  vigente: number;
  /** Despesas não recusadas, na parte ainda sem pagamento conciliado com o extrato. */
  comprometido: number;
  /** Despesas na parte paga e conciliada com o extrato (P2.6). */
  pago: number;
  saldo: number;
  itens: number;
};

export type LinhaOrcamento = {
  no: NoOrcamento;
  nivel: number;
  /** Nomes dos agrupadores acima, do mais alto ao mais próximo. */
  caminho: string[];
  /** Grupo de custo que vale para o nó: o próprio ou o do agrupador mais próximo. */
  grupo: GrupoCusto | null;
  grupoHerdado: boolean;
  /** CNAEs aceitos que valem para o nó: os próprios ou os do agrupador mais próximo que definir. */
  cnaes: string[];
  /** Nó que definiu os CNAEs (o próprio, quando não herdou). */
  cnaesDe: { id: string; nome: string } | null;
  filhos: LinhaOrcamento[];
  totais: Totais;
};

export type Arvore = {
  raizes: LinhaOrcamento[];
  total: Totais;
  /** Despesas sem item desta versão (sem rubrica ou de item de outra versão). */
  foraDaVersao: { pago: number; comprometido: number; quantidade: number };
};

/**
 * Quanto da despesa está pago e quanto está comprometido, em centavos do valor
 * bruto. A fração do líquido coberta por pagamentos conciliados vale a mesma
 * fração do bruto: as retenções acompanham o pagamento ao fornecedor. Sem valor
 * no documento, conta o que saiu da conta. Recusada não entra. `conciliado`
 * vem em reais; o resultado sai em centavos, como as somas da árvore.
 */
export function execucaoDaDespesa(
  despesa: Pick<ComprovanteDoOrcamento, "status" | "valor_extraido" | "valor_liquido">,
  conciliado: number,
): { pago: number; comprometido: number } | null {
  if (despesa.status !== "aceito" && despesa.status !== "pendente") return null;
  const bruto = Math.max(centavos(despesa.valor_extraido), 0);
  const pagoCentavos = Math.max(centavos(conciliado), 0);
  if (!bruto) return { pago: pagoCentavos, comprometido: 0 };
  const liquido = despesa.valor_liquido === null || despesa.valor_liquido === undefined ? bruto : centavos(despesa.valor_liquido);
  const pago = liquido > 0 ? Math.round((bruto * Math.min(pagoCentavos, liquido)) / liquido) : 0;
  return { pago, comprometido: bruto - pago };
}

/** Soma, por despesa, dos pagamentos ligados a um lançamento do extrato. */
export function conciliadoPorDespesa(pagamentos: readonly PagamentoDoOrcamento[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const p of pagamentos) {
    if (!p.lancamento_id) continue;
    mapa.set(p.despesa_id, (mapa.get(p.despesa_id) ?? 0) + centavos(p.valor));
  }
  return new Map([...mapa].map(([id, total]) => [id, total / 100]));
}

type Centavos = { aprovado: number; remanejado: number; comprometido: number; pago: number; itens: number };

function centavos(valor: unknown): number {
  const numero = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

function emReais(c: Centavos): Totais {
  const vigente = c.aprovado + c.remanejado;
  return {
    aprovado: c.aprovado / 100,
    remanejado: c.remanejado / 100,
    vigente: vigente / 100,
    comprometido: c.comprometido / 100,
    pago: c.pago / 100,
    saldo: (vigente - c.comprometido - c.pago) / 100,
    itens: c.itens,
  };
}

function somar(a: Centavos, b: Centavos): Centavos {
  return {
    aprovado: a.aprovado + b.aprovado,
    remanejado: a.remanejado + b.remanejado,
    comprometido: a.comprometido + b.comprometido,
    pago: a.pago + b.pago,
    itens: a.itens + b.itens,
  };
}

const ZERO: Centavos = { aprovado: 0, remanejado: 0, comprometido: 0, pago: 0, itens: 0 };

function porOrdem(a: NoOrcamento, b: NoOrcamento): number {
  return a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR");
}

/**
 * Monta a árvore de uma versão com as somas de cada nó. Nó cujo pai não está
 * na lista vira raiz, e um ciclo (que o banco já impede) é cortado.
 */
export function montarArvore(
  nos: readonly NoOrcamento[],
  comprovantes: readonly ComprovanteDoOrcamento[],
  pagamentos: readonly PagamentoDoOrcamento[] = [],
): Arvore {
  const ids = new Set(nos.map(no => no.id));
  const itens = new Set(nos.filter(no => no.tipo === "item").map(no => no.id));
  const filhosDe = new Map<string | null, NoOrcamento[]>();
  for (const no of nos) {
    const pai = no.parent_id && ids.has(no.parent_id) && no.parent_id !== no.id ? no.parent_id : null;
    filhosDe.set(pai, [...(filhosDe.get(pai) ?? []), no]);
  }

  const conciliado = conciliadoPorDespesa(pagamentos);
  const movimento = new Map<string, { comprometido: number; pago: number }>();
  const fora = { pago: 0, comprometido: 0, quantidade: 0 };
  for (const c of comprovantes) {
    const execucao = execucaoDaDespesa(c, (c.id && conciliado.get(c.id)) || 0);
    if (!execucao) continue;
    if (!c.no_id || !itens.has(c.no_id)) {
      fora.quantidade += 1;
      fora.pago += execucao.pago;
      fora.comprometido += execucao.comprometido;
      continue;
    }
    const atual = movimento.get(c.no_id) ?? { comprometido: 0, pago: 0 };
    atual.pago += execucao.pago;
    atual.comprometido += execucao.comprometido;
    movimento.set(c.no_id, atual);
  }

  const visitados = new Set<string>();
  type CnaesAcima = { cnaes: string[]; de: { id: string; nome: string } | null };
  function montar(no: NoOrcamento, nivel: number, caminho: string[], grupoAcima: GrupoCusto | null, cnaesAcima: CnaesAcima): [LinhaOrcamento, Centavos] {
    visitados.add(no.id);
    const grupo = no.grupo_custo ?? grupoAcima;
    const proprios = limparCnaesAceitos(no.cnaes_aceitos ?? []);
    const cnaes: CnaesAcima = proprios.length ? { cnaes: proprios, de: { id: no.id, nome: no.nome } } : cnaesAcima;
    let soma: Centavos = ZERO;
    if (no.tipo === "item") {
      const mov = movimento.get(no.id);
      soma = {
        aprovado: centavos(no.valor_total),
        remanejado: centavos(no.valor_remanejado),
        comprometido: mov?.comprometido ?? 0,
        pago: mov?.pago ?? 0,
        itens: 1,
      };
    }
    const filhos: LinhaOrcamento[] = [];
    for (const filho of [...(filhosDe.get(no.id) ?? [])].sort(porOrdem)) {
      if (visitados.has(filho.id)) continue;
      const [linha, somaFilho] = montar(filho, nivel + 1, [...caminho, no.nome], grupo, cnaes);
      filhos.push(linha);
      soma = somar(soma, somaFilho);
    }
    return [{
      no, nivel, caminho, grupo,
      grupoHerdado: !no.grupo_custo && grupo !== null,
      cnaes: cnaes.cnaes,
      cnaesDe: cnaes.de,
      filhos,
      totais: emReais(soma),
    }, soma];
  }

  const raizes: LinhaOrcamento[] = [];
  let total: Centavos = ZERO;
  for (const no of [...(filhosDe.get(null) ?? [])].sort(porOrdem)) {
    const [linha, soma] = montar(no, 0, [], null, { cnaes: [], de: null });
    raizes.push(linha);
    total = somar(total, soma);
  }

  return {
    raizes,
    total: emReais(total),
    foraDaVersao: { pago: fora.pago / 100, comprometido: fora.comprometido / 100, quantidade: fora.quantidade },
  };
}

/** Linhas na ordem da tela; os agrupadores em `fechados` não mostram os filhos. */
export function linhasVisiveis(raizes: readonly LinhaOrcamento[], fechados: ReadonlySet<string> = new Set()): LinhaOrcamento[] {
  const saida: LinhaOrcamento[] = [];
  const visitar = (linha: LinhaOrcamento) => {
    saida.push(linha);
    if (!fechados.has(linha.no.id)) linha.filhos.forEach(visitar);
  };
  raizes.forEach(visitar);
  return saida;
}

/** Todos os itens (folhas com valor), com o caminho e o grupo efetivo. */
export function itensDaArvore(raizes: readonly LinhaOrcamento[]): LinhaOrcamento[] {
  return linhasVisiveis(raizes).filter(linha => linha.no.tipo === "item");
}

/** Ids dos agrupadores acima do nó, do mais alto ao mais próximo (P3.3: a meta da despesa). */
export function ancestraisDoNo(noId: string, nos: readonly Pick<NoOrcamento, "id" | "parent_id">[]): string[] {
  const porId = new Map(nos.map(n => [n.id, n]));
  const saida: string[] = [];
  const vistos = new Set<string>([noId]);
  for (let atual = porId.get(noId)?.parent_id ?? null; atual && !vistos.has(atual); atual = porId.get(atual)?.parent_id ?? null) {
    vistos.add(atual);
    saida.unshift(atual);
  }
  return saida;
}

/** Agrupadores onde um nó pode ficar: nem ele mesmo nem o que está abaixo dele. */
export function paisPossiveis(raizes: readonly LinhaOrcamento[], noId: string | null): LinhaOrcamento[] {
  const saida: LinhaOrcamento[] = [];
  const visitar = (linha: LinhaOrcamento) => {
    if (linha.no.id === noId) return;
    if (linha.no.tipo !== "item") saida.push(linha);
    linha.filhos.forEach(visitar);
  };
  raizes.forEach(visitar);
  return saida;
}

/** Percentual inteiro do pago sobre o vigente; null sem vigente. */
export function percentualPago(totais: Pick<Totais, "pago" | "vigente">): number | null {
  if (!totais.vigente || totais.vigente <= 0) return null;
  return Math.round((totais.pago / totais.vigente) * 100);
}

/** Valor total do item como o banco calcula: quantidade × ocorrências × unitário. */
export function valorDoItem(campos: {
  quantidade: number | null;
  ocorrencias: number | null;
  valor_unitario: number | null;
  valor_total: number;
}): number {
  if (campos.valor_unitario === null) return campos.valor_total;
  return Math.round((campos.quantidade ?? 1) * (campos.ocorrencias ?? 1) * campos.valor_unitario * 100) / 100;
}

// ─── Grupos, bases e tetos do regime ────────────────────────────────────────
// Desde a P1.11, o regime traz os grupos de custo da lei (com o nome que a
// norma usa), as bases de cálculo (que grupos somam o "valor do projeto", a
// "atividade-fim"...) e os tetos. Aqui ficam só as contas.

/** Grupos que a prestação usa: os do regime ou, sem regime, todos. */
export function gruposDoRegime(regime: RegimeNormativo | null | undefined): { id: string; rotulo: string; descricao: string | null }[] {
  const orcamento = regime ? definida(regime.orcamento) : null;
  if (!orcamento) return GRUPOS_CUSTO.map(g => ({ id: g.id, rotulo: g.rotulo, descricao: null }));
  return orcamento.grupos.map(g => ({ id: g.codigo, rotulo: g.rotulo, descricao: g.descricao }));
}

/** O grupo está entre os do regime (sem regime, entre todos)? */
export function grupoNoRegime(grupo: string | null | undefined, regime: RegimeNormativo | null | undefined): boolean {
  return Boolean(grupo) && gruposDoRegime(regime).some(g => g.id === grupo);
}

/** Item resumido: o grupo de custo que vale para ele e o vigente. */
export type ItemResumido = { grupo: GrupoCusto | null; vigente: number };

/** Itens da árvore no formato resumido, para as contas que não precisam da hierarquia. */
export function itensResumidos(raizes: readonly LinhaOrcamento[]): ItemResumido[] {
  return itensDaArvore(raizes).map(linha => ({ grupo: linha.grupo, vigente: linha.totais.vigente }));
}

export type BasesDoOrcamento = {
  /** Valor do projeto do regime; sem a base no regime, igual ao total. */
  valorProjeto: number;
  valorTotalProjeto: number;
  /** Todas as bases que o regime define, em reais. */
  porBase: Partial<Record<BaseDoOrcamento, number>>;
};

function somaDaBase(itens: readonly ItemResumido[], definicao: BaseDefinida): number {
  const exceto = new Set(definicao.exceto);
  const soma = definicao.soma === "todos" ? null : new Set(definicao.soma);
  let total = 0;
  for (const item of itens) {
    if (item.grupo && exceto.has(item.grupo)) continue;
    // Item sem grupo entra só nas bases que somam tudo.
    if (soma && (!item.grupo || !soma.has(item.grupo))) continue;
    total += centavos(item.vigente);
  }
  return total;
}

function bases(itens: readonly ItemResumido[], regime: RegimeNormativo | null): BasesDoOrcamento {
  const total = itens.reduce((soma, item) => soma + centavos(item.vigente), 0);
  const definicoes = regime ? definida(regime.orcamento)?.bases ?? {} : {};
  const porBase: Partial<Record<BaseDoOrcamento, number>> = {};
  for (const chave of BASES_DO_ORCAMENTO) {
    const definicao = definicoes[chave];
    if (definicao) porBase[chave] = somaDaBase(itens, definicao) / 100;
  }
  return {
    valorProjeto: porBase.valor_projeto ?? total / 100,
    valorTotalProjeto: porBase.valor_total_projeto ?? total / 100,
    porBase,
  };
}

/** Bases de cálculo dos limites, sobre o vigente dos itens. */
export function basesDoOrcamento(raizes: readonly LinhaOrcamento[], regime: RegimeNormativo | null): BasesDoOrcamento {
  return bases(itensResumidos(raizes), regime);
}

/** "do valor do projeto", "da atividade-fim"... para o texto do limite. */
export const ROTULO_DA_BASE: Record<BaseCalculo, string> = {
  valor_captado: "do valor captado",
  valor_projeto: "do valor do projeto",
  valor_total_projeto: "do valor total do projeto",
  valor_aprovado_execucao: "do valor aprovado para execução",
  valor_homologado_execucao: "do valor homologado para execução",
  valor_autorizado_captacao: "do valor autorizado para captação",
  valor_atividade_fim: "da atividade-fim",
  orcamento_producao: "do orçamento de produção",
  valor_executado: "do total executado",
};

/** Bases que não saem do orçamento (captado, autorizado), quando a tela as conhece. */
export type BasesExternas = Partial<Record<BaseCalculo, number | null>>;

export type TetoDoGrupo = {
  grupo: GrupoCusto | null;
  rotulo: string;
  valor: number;
  itens: number;
  /** Percentual do total do orçamento vigente. */
  percentual: number | null;
  limite: {
    descricao: string;
    percentual: number;
    teto: number | null;
    /** O menor entre o percentual sobre a base e o teto em reais; null sem o valor da base. */
    maximo: number | null;
    /** "do valor do projeto", "da atividade-fim"... */
    base: string;
    /** Soma dos grupos que o teto limita (igual a `valor` quando é um grupo só). */
    valorLimitado: number;
    severidade: Severidade;
    proporcionalAoCaptado: boolean;
    norma: string;
  } | null;
  excedido: boolean;
};

/**
 * Valor de cada grupo de custo no orçamento vigente, com o limite do regime
 * quando há um. "Sem grupo de custo" aparece por último, para ser classificado.
 */
export function tetosPorGrupo(raizes: readonly LinhaOrcamento[], regime: RegimeNormativo | null, externas: BasesExternas = {}): TetoDoGrupo[] {
  return tetosDosItens(itensResumidos(raizes), regime, externas);
}

/** O mesmo de tetosPorGrupo, a partir dos itens resumidos. */
export function tetosDosItens(itens: readonly ItemResumido[], regime: RegimeNormativo | null, externas: BasesExternas = {}): TetoDoGrupo[] {
  const total = itens.reduce((soma, item) => soma + centavos(item.vigente), 0);
  const porGrupo = new Map<GrupoCusto | null, { valor: number; itens: number }>();
  for (const item of itens) {
    const atual = porGrupo.get(item.grupo) ?? { valor: 0, itens: 0 };
    atual.valor += centavos(item.vigente);
    atual.itens += 1;
    porGrupo.set(item.grupo, atual);
  }

  const calculadas = bases(itens, regime);
  const baseEmCentavos = (base: BaseCalculo): number | null => {
    const doOrcamento = calculadas.porBase[base as BaseDoOrcamento];
    if (doOrcamento !== undefined) return centavos(doOrcamento);
    const externa = externas[base];
    return externa === null || externa === undefined ? null : centavos(externa);
  };
  const tetos = regime ? definida(regime.orcamento)?.tetos ?? [] : [];
  const daLista = gruposDoRegime(regime);
  const comTeto = new Set(tetos.flatMap(t => t.grupos));
  const grupos: (GrupoCusto | null)[] = [
    ...daLista.map(g => g.id).filter(id => porGrupo.has(id) || comTeto.has(id)),
    // Grupo fora do regime (de outro regime ou antigo) aparece para ser reclassificado.
    ...[...porGrupo.keys()].filter((id): id is string => id !== null && !daLista.some(g => g.id === id)),
    ...(porGrupo.has(null) ? [null] : []),
  ];

  return grupos.map(grupo => {
    const soma = porGrupo.get(grupo) ?? { valor: 0, itens: 0 };
    // Com mais de um teto no grupo, vale o mais apertado.
    const candidatos = grupo ? tetos.filter(t => t.grupos.includes(grupo)) : [];
    const limites = candidatos.map(regra => {
      const base = baseEmCentavos(regra.base);
      const valorLimitado = regra.grupos.reduce((s, g) => s + (porGrupo.get(g)?.valor ?? 0), 0);
      const porPercentual = base === null ? null : Math.round(base * regra.percentual / 100);
      const emReais = regra.teto !== undefined ? Math.round(regra.teto * 100) : null;
      const maximo = porPercentual === null ? emReais : emReais === null ? porPercentual : Math.min(porPercentual, emReais);
      return {
        descricao: regra.descricao,
        percentual: regra.percentual,
        teto: regra.teto ?? null,
        maximo: maximo === null ? null : maximo / 100,
        base: ROTULO_DA_BASE[regra.base],
        valorLimitado: valorLimitado / 100,
        severidade: regra.severidade,
        proporcionalAoCaptado: regra.proporcionalAoCaptado ?? false,
        norma: `${regra.fonte.documento}, ${regra.fonte.dispositivo}`,
      };
    });
    const limite = limites.sort((a, b) => (a.maximo ?? Infinity) - (b.maximo ?? Infinity))[0] ?? null;
    return {
      grupo,
      rotulo: grupo === null ? "Sem grupo de custo" : rotuloGrupo(grupo, regime),
      valor: soma.valor / 100,
      itens: soma.itens,
      percentual: total > 0 ? Math.round((soma.valor / total) * 1000) / 10 : null,
      limite,
      excedido: limite !== null && limite.maximo !== null && centavos(limite.valorLimitado) > centavos(limite.maximo),
    };
  });
}

// ─── Importação ─────────────────────────────────────────────────────────────

export type LinhaImportada = {
  nome: string;
  descricao: string | null;
  valor: number;
  /** Agrupador onde o item entra (etapa, produto...). Igual nome = mesmo agrupador. */
  etapa: string | null;
  grupo_custo: GrupoCusto | null;
};

function semAcento(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const PISTAS_DE_GRUPO: [GrupoCusto, RegExp][] = [
  ["direitos", /\bdireitos? (autora|conexo)|\becad\b/],
  ["administracao", /\b(administra|custos? adm|taxa adm|adm\.)/],
  ["divulgacao", /\b(divulga|comunica|acessib|imprensa|publicidade|midia)/],
  ["captacao", /\b(captac|captador)/],
  // Elaboração do projeto ou da proposta, não o verbo ("elaboração de peças").
  ["elaboracao", /\belaboracao (do|da|de) (projeto|proposta)|\belaboracao e captacao/],
  ["agenciamento", /\bagencia(mento|dor)/],
  ["gerenciamento", /\bgerencia(mento)?\b/],
  ["colocacao", /\bcoloca(cao)?\b|\bcoordenad(or|ora) lider/],
  ["recolhimentos", /\b(recolhimento|tributo|imposto|encargo)/],
];

/** Grupo de custo sugerido pelo nome (do item ou da etapa); null quando não há pista. */
export function sugerirGrupoCusto(...textos: (string | null | undefined)[]): GrupoCusto | null {
  const alvo = semAcento(textos.filter(Boolean).join(" "));
  return PISTAS_DE_GRUPO.find(([, pista]) => pista.test(alvo))?.[0] ?? null;
}

/** A primeira pista que leva a um grupo do regime (na LIE, "elaboração e captação" é um grupo só). */
export function sugerirGrupoDoRegime(regime: RegimeNormativo | null | undefined, ...textos: (string | null | undefined)[]): GrupoCusto | null {
  const alvo = semAcento(textos.filter(Boolean).join(" "));
  return PISTAS_DE_GRUPO.find(([grupo, pista]) => pista.test(alvo) && grupoNoRegime(grupo, regime))?.[0] ?? null;
}

/**
 * Valor em reais escrito de várias formas: "R$ 1.234,56", "1234,56",
 * "1,234.56", "1234.56", "15.000". Texto sem número vale 0.
 */
export function lerValor(texto: string | number | null | undefined): number {
  if (typeof texto === "number") return Number.isFinite(texto) ? texto : 0;
  let limpo = String(texto ?? "").replace(/[^\d.,-]/g, "");
  if (!limpo) return 0;
  const virgula = limpo.lastIndexOf(",");
  const ponto = limpo.lastIndexOf(".");
  if (virgula >= 0 && ponto >= 0) {
    limpo = virgula > ponto
      ? limpo.replace(/\./g, "").replace(",", ".")
      : limpo.replace(/,/g, "");
  } else if (virgula >= 0) {
    limpo = /^-?\d{1,3}(,\d{3})+$/.test(limpo) && !/,\d{1,2}$/.test(limpo)
      ? limpo.replace(/,/g, "")
      : limpo.replace(/\./g, "").replace(",", ".");
  } else if (ponto >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(limpo)) {
    limpo = limpo.replace(/\./g, "");
  }
  const numero = Number(limpo);
  return Number.isFinite(numero) ? Math.round(numero * 100) / 100 : 0;
}

export type TabelaLida = { cabecalho: string[]; linhas: string[][] };

/** Lê CSV ou TSV com separador detectado pela primeira linha e campos entre aspas. */
export function lerTabela(texto: string): TabelaLida | null {
  const linhas = texto.replace(/^﻿/, "").trim().split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) return null;
  const contagem: Record<string, number> = { "\t": 0, ";": 0, ",": 0, "|": 0 };
  let entreAspas = false;
  for (const ch of linhas[0]) {
    if (ch === '"') entreAspas = !entreAspas;
    else if (!entreAspas && ch in contagem) contagem[ch]++;
  }
  const separador = Object.entries(contagem).sort((a, b) => b[1] - a[1])[0][0];
  const dividir = (linha: string) => {
    const campos: string[] = [];
    let atual = "";
    let aspas = false;
    for (let i = 0; i < linha.length; i++) {
      const ch = linha[i];
      if (ch === '"') {
        if (aspas && linha[i + 1] === '"') { atual += '"'; i++; continue; }
        aspas = !aspas;
        continue;
      }
      if (ch === separador && !aspas) { campos.push(atual.trim()); atual = ""; continue; }
      atual += ch;
    }
    campos.push(atual.trim());
    return campos;
  };
  const cabecalho = dividir(linhas[0]);
  if (cabecalho.length < 2) return null;
  return { cabecalho, linhas: linhas.slice(1).map(dividir) };
}

/** Índice (como texto, para o Select) da primeira coluna cujo título contém uma das pistas. */
export function adivinharColuna(cabecalho: readonly string[], pistas: readonly string[], evitar: readonly string[] = []): string {
  for (const pista of pistas) {
    const indice = cabecalho.findIndex((titulo, i) => !evitar.includes(String(i)) && semAcento(titulo).includes(semAcento(pista)));
    if (indice >= 0) return String(indice);
  }
  return "";
}

export type MapaDeColunas = { nome: string; valor: string; descricao: string; etapa: string };

/** Linhas da tabela pelo mapa de colunas; sem nome ou sem valor ficam de fora, assim como totais. */
export function linhasDaTabela(tabela: TabelaLida, mapa: MapaDeColunas): LinhaImportada[] {
  const indice = (coluna: string) => (coluna === "" ? -1 : Number(coluna));
  const [iNome, iValor, iDescricao, iEtapa] = [mapa.nome, mapa.valor, mapa.descricao, mapa.etapa].map(indice);
  if (iNome < 0 || iValor < 0) return [];
  return tabela.linhas.flatMap(colunas => {
    const nome = (colunas[iNome] ?? "").trim();
    const valor = lerValor(colunas[iValor]);
    if (!nome || valor <= 0 || /^(sub)?total\b/.test(semAcento(nome))) return [];
    const etapa = iEtapa >= 0 ? (colunas[iEtapa] ?? "").trim() || null : null;
    const descricao = iDescricao >= 0 ? (colunas[iDescricao] ?? "").trim() || null : null;
    return [{ nome, descricao, valor, etapa, grupo_custo: sugerirGrupoCusto(nome, etapa) }];
  });
}

/** Itens vindos da leitura do PDF pela IA (formato antigo ou novo), já normalizados. */
export function linhasDaLeitura(itens: unknown): LinhaImportada[] {
  if (!Array.isArray(itens)) return [];
  return itens.flatMap(bruto => {
    if (!bruto || typeof bruto !== "object") return [];
    const item = bruto as Record<string, unknown>;
    const nome = String(item.nome ?? item.rubrica ?? "").trim();
    const valor = lerValor((item.valor ?? item.valor_aprovado) as string | number | null | undefined);
    if (!nome || valor <= 0) return [];
    const etapa = typeof item.etapa === "string" && item.etapa.trim() ? item.etapa.trim() : null;
    const grupoLido = GRUPOS_CUSTO.find(g => g.id === item.grupo_custo)?.id ?? null;
    return [{
      nome,
      descricao: typeof item.descricao === "string" && item.descricao.trim() ? item.descricao.trim() : null,
      valor,
      etapa,
      grupo_custo: grupoLido ?? sugerirGrupoCusto(nome, etapa),
    }];
  });
}

/** Linhas importadas com o grupo de custo trocado pelo do regime (ou nenhum) quando não pertence a ele. */
export function ajustarAoRegime(linhas: readonly LinhaImportada[], regime: RegimeNormativo | null | undefined): LinhaImportada[] {
  return linhas.map(linha => grupoNoRegime(linha.grupo_custo, regime)
    ? linha
    : { ...linha, grupo_custo: sugerirGrupoDoRegime(regime, linha.nome, linha.etapa) });
}

/**
 * Etapas que a importação precisa criar: as que não existem como agrupador
 * na raiz da versão (comparando o nome sem acento e sem caixa).
 */
export function etapasParaCriar(linhas: readonly LinhaImportada[], existentes: readonly NoOrcamento[]): string[] {
  const naRaiz = new Set(existentes.filter(no => no.tipo !== "item" && !no.parent_id).map(no => semAcento(no.nome.trim())));
  const novas = new Map<string, string>();
  for (const linha of linhas) {
    if (!linha.etapa) continue;
    const chave = semAcento(linha.etapa);
    if (!naRaiz.has(chave) && !novas.has(chave)) novas.set(chave, linha.etapa);
  }
  return [...novas.values()];
}

/** Agrupador da raiz com o mesmo nome (sem acento e sem caixa), ou null. */
export function agrupadorPorNome(nos: readonly NoOrcamento[], nome: string): NoOrcamento | null {
  const chave = semAcento(nome.trim());
  return nos.find(no => no.tipo !== "item" && !no.parent_id && semAcento(no.nome.trim()) === chave) ?? null;
}
