// Alterações de orçamento (P1.7): pedido, cálculo contra as regras do regime
// e minuta do pedido formal.
//
// O banco (supabase/migrations/20261005190000_prestacao_alteracoes.sql) guarda
// o pedido e aplica os valores no remanejado dos itens quando a alteração é
// aprovada; aqui fica o cálculo que a tela mostra antes de salvar e que vai
// junto do pedido. A classificação (administrativa ou formal) segue a norma do
// regime; regime sem regras de alteração deixa a escolha com a pessoa.
//
// Rouanet (IN MinC 29/2026, art. 64; texto em docs/acoes-futuras/estudos/
// prestacao-de-contas-fontes/rouanet-in29-texto-integral.md):
// - § 3º: remanejamento que não muda o valor do projeto nem o valor aprovado
//   dos custos vinculados e da captação dispensa autorização;
// - § 4º: complementação exige captado >= 50% do homologado e soma até 50%;
// - § 5º: redução soma até 50% do valor total do projeto;
// - §§ 7º a 9º: o MinC tem 30 dias; sem resposta, a alteração pode ser executada.
// O "50% do item" do Manual Módulo II (p. 36) não está na IN: vira alerta.

import { calcularVencimento } from "./prazos";
import {
  basesDoOrcamento,
  itensDaArvore,
  montarArvore,
  rotuloGrupo,
  tetosPorGrupo,
  type BasesDoOrcamento,
  type GrupoCusto,
  type NoOrcamento,
} from "./orcamento";
import type { RegimeNormativo } from "./regimes";

export const TIPOS_ALTERACAO = [
  { id: "remanejamento", rotulo: "Remanejamento" },
  { id: "complementacao", rotulo: "Complementação" },
  { id: "reducao", rotulo: "Redução" },
  { id: "inclusao", rotulo: "Inclusão de item" },
] as const;
export type TipoAlteracao = (typeof TIPOS_ALTERACAO)[number]["id"];

export type ClassificacaoAlteracao = "administrativa" | "formal";
export type StatusAlteracao = "rascunho" | "solicitada" | "aprovada" | "negada";

export function rotuloTipoAlteracao(tipo: string): string {
  return TIPOS_ALTERACAO.find(t => t.id === tipo)?.rotulo ?? tipo;
}

/** Rótulo e cor do status; aprovada sem pedido ao órgão é "aplicada". */
export function situacaoDaAlteracao(status: StatusAlteracao, classificacao: ClassificacaoAlteracao | null): { rotulo: string; cor: string } {
  switch (status) {
    case "rascunho": return { rotulo: "Rascunho", cor: "#6B6B6B" };
    case "solicitada": return { rotulo: "Aguardando o órgão", cor: "#B07A14" };
    case "aprovada": return { rotulo: classificacao === "administrativa" ? "Aplicada" : "Aprovada", cor: "#2E8932" };
    case "negada": return { rotulo: "Negada", cor: "#D94A4A" };
  }
}

export type MovimentoAlteracao = {
  /** null: item novo, criado quando a alteração é aplicada. */
  no_id: string | null;
  nome: string;
  /** Agrupador do item novo. */
  parent_id: string | null;
  /** Grupo de custo do item novo. */
  grupo_custo: GrupoCusto | null;
  /** Vigente quando o pedido foi montado (0 no item novo). */
  de: number;
  /** Vigente proposto. */
  para: number;
};

export type ContextoAlteracao = {
  hoje: string;
  dataLiberacao: string | null;
  fimExecucao: string | null;
  /** Total aprovado da versão homologada (ou, sem ela, da versão em uso). */
  homologado: number;
  /** Informado no pedido; pesa na complementação. */
  captado: number | null;
  /** Soma das complementações e das reduções já aprovadas. */
  complementadoAntes: number;
  reduzidoAntes: number;
};

export type NivelVerificacao = "bloqueio" | "formal" | "alerta" | "ok" | "info";
export type Verificacao = { codigo: string; nivel: NivelVerificacao; texto: string; fonte: string | null };

export type FotoDoOrcamento = BasesDoOrcamento & { porGrupo: Record<string, number> };

export type CalculoAlteracao = {
  tipo: TipoAlteracao;
  /** null: o regime não traz regra de alteração e a pessoa escolhe. */
  classificacao: ClassificacaoAlteracao | null;
  antes: FotoDoOrcamento;
  depois: FotoDoOrcamento;
  /** Valor total depois menos antes. */
  diferenca: number;
  /** Soma dos aumentos dos itens (no remanejamento, igual à soma das reduções). */
  movido: number;
  itensAlterados: number;
  verificacoes: Verificacao[];
  bloqueado: boolean;
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d: string) => d.split("-").reverse().join("/");

function centavos(valor: unknown): number {
  const numero = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

function listaDeNomes(nomes: string[]): string {
  const unicos = [...new Set(nomes)];
  if (unicos.length <= 3) return unicos.map(n => `“${n}”`).join(", ");
  return `${unicos.slice(0, 3).map(n => `“${n}”`).join(", ")} e mais ${unicos.length - 3}`;
}

/** Movimentos que mudam algo: item existente com valor novo, ou item novo com valor. */
export function movimentosEfetivos(movimentos: readonly MovimentoAlteracao[]): MovimentoAlteracao[] {
  return movimentos.filter(m => (m.no_id === null ? centavos(m.para) > 0 || m.nome.trim() !== "" : centavos(m.para) !== centavos(m.de)));
}

/** Nós da versão como ficam depois da alteração (itens novos com id provisório). */
export function nosDepois(nos: readonly NoOrcamento[], movimentos: readonly MovimentoAlteracao[]): NoOrcamento[] {
  const porItem = new Map(movimentos.filter(m => m.no_id).map(m => [m.no_id as string, m]));
  const existentes = nos.map(no => {
    const m = porItem.get(no.id);
    if (!m || no.tipo !== "item") return no;
    return { ...no, valor_remanejado: (centavos(no.valor_remanejado) + centavos(m.para) - centavos(m.de)) / 100 };
  });
  const novos = movimentos.filter(m => !m.no_id).map((m, i): NoOrcamento => ({
    id: `novo-${i}`, versao_id: nos[0]?.versao_id ?? "", parent_id: m.parent_id, tipo: "item", codigo: null,
    nome: m.nome.trim() || "Item novo", descricao: null, uf: null, municipio: null, grupo_custo: m.grupo_custo,
    unidade: null, quantidade: null, ocorrencias: null, valor_unitario: null,
    valor_total: 0, valor_remanejado: m.para, ordem: Number.MAX_SAFE_INTEGER,
  }));
  return [...existentes, ...novos];
}

function foto(nos: readonly NoOrcamento[], regime: RegimeNormativo | null): FotoDoOrcamento {
  const { raizes } = montarArvore(nos, []);
  const porGrupo: Record<string, number> = {};
  for (const linha of itensDaArvore(raizes)) {
    const chave = linha.grupo ?? "sem_grupo";
    porGrupo[chave] = (centavos(porGrupo[chave] ?? 0) + centavos(linha.totais.vigente)) / 100;
  }
  return { ...basesDoOrcamento(raizes, regime), porGrupo };
}

const IN29 = "IN MinC 29/2026";
const MODULO_II = "Manual do Proponente, Módulo II (ago/2026), p. 36";
const VINCULADOS_E_CAPTACAO: GrupoCusto[] = ["administracao", "divulgacao", "captacao"];

/**
 * Calcula o pedido: o que muda, o tipo, a classificação e as verificações do
 * regime, cada uma com a fonte. Bloqueio impede aplicar ou pedir.
 */
export function calcularAlteracao(
  nos: readonly NoOrcamento[],
  movimentos: readonly MovimentoAlteracao[],
  regime: RegimeNormativo | null,
  contexto: ContextoAlteracao,
): CalculoAlteracao {
  const efetivos = movimentosEfetivos(movimentos);
  const itens = new Map(nos.filter(no => no.tipo === "item").map(no => [no.id, no]));
  const verificacoes: Verificacao[] = [];
  const add = (codigo: string, nivel: NivelVerificacao, texto: string, fonte: string | null = null) =>
    verificacoes.push({ codigo, nivel, texto, fonte });

  // Estrutura do pedido.
  if (efetivos.length === 0) add("sem_mudanca", "bloqueio", "Nenhum valor mudou. Informe o novo valor de ao menos um item.");
  if (efetivos.some(m => centavos(m.para) < 0)) add("valor_negativo", "bloqueio", "Valor proposto não pode ser negativo.");
  if (efetivos.some(m => !m.no_id && !m.nome.trim())) add("item_novo_sem_nome", "bloqueio", "Dê um nome ao item novo.");
  if (efetivos.some(m => !m.no_id && centavos(m.para) <= 0)) add("item_novo_sem_valor", "bloqueio", "Informe o valor do item novo.");
  const fora = efetivos.filter(m => m.no_id && !itens.has(m.no_id));
  if (fora.length) add("item_fora_da_versao", "bloqueio", `${listaDeNomes(fora.map(m => m.nome))} não está na versão em uso. Refaça o pedido.`);
  const desatualizados = efetivos.filter(m => {
    const no = m.no_id ? itens.get(m.no_id) : null;
    return no && centavos(no.valor_total) + centavos(no.valor_remanejado) !== centavos(m.de);
  });
  if (desatualizados.length) {
    add("desatualizada", "bloqueio", `O vigente de ${listaDeNomes(desatualizados.map(m => m.nome))} mudou desde que o pedido foi montado. Revise os valores.`);
  }

  const antes = foto(nos, regime);
  const depois = foto(nosDepois(nos, efetivos.filter(m => !m.no_id || itens.has(m.no_id))), regime);
  const diferenca = (centavos(depois.valorTotalProjeto) - centavos(antes.valorTotalProjeto)) / 100;
  const movido = efetivos.reduce((soma, m) => soma + Math.max(0, centavos(m.para) - centavos(m.de)), 0) / 100;
  const novos = efetivos.filter(m => !m.no_id);
  const tipo: TipoAlteracao = diferenca > 0 ? "complementacao" : diferenca < 0 ? "reducao" : novos.length ? "inclusao" : "remanejamento";

  let classificacao: ClassificacaoAlteracao | null = null;

  if (efetivos.length === 0) {
    // Nada a classificar.
  } else if (regime?.codigo === "rouanet_in29_2026") {
    // Período: depois da liberação para execução e até o fim da execução (caput).
    if (!contexto.dataLiberacao) {
      add("sem_liberacao", "alerta", "Sem a data de liberação para execução na prestação: a readequação só cabe depois dela.", `${IN29}, art. 64, caput`);
    } else if (contexto.hoje < contexto.dataLiberacao) {
      add("antes_da_liberacao", "alerta", `A liberação para execução é em ${dataBR(contexto.dataLiberacao)}: a readequação só cabe depois dela.`, `${IN29}, art. 64, caput`);
    }
    if (contexto.fimExecucao && contexto.hoje > contexto.fimExecucao) {
      add("apos_execucao", "alerta", `A execução terminou em ${dataBR(contexto.fimExecucao)}: a readequação cabe até o fim do período de execução.`, `${IN29}, art. 64, caput`);
    }

    const mudados = VINCULADOS_E_CAPTACAO.filter(g => centavos(antes.porGrupo[g] ?? 0) !== centavos(depois.porGrupo[g] ?? 0));
    const semGrupo = efetivos.filter(m => (m.no_id ? !grupoDe(nos, m.no_id) : !m.grupo_custo && !(m.parent_id && grupoDe(nos, m.parent_id))));

    if (tipo === "remanejamento") {
      if (mudados.length) {
        classificacao = "formal";
        add("muda_vinculados", "formal",
          `Muda o valor aprovado de ${mudados.map(g => rotuloGrupo(g).toLowerCase()).join(" e ")}${mudados.some(g => g !== "captacao") ? " (custos vinculados)" : ""}: precisa de autorização do MinC.`,
          `${IN29}, art. 64, § 3º, II`);
      } else {
        classificacao = "administrativa";
        add("remanejamento_livre", "ok",
          "Remanejamento entre itens que mantém o valor do projeto, os custos vinculados e a captação: dispensa autorização do MinC.",
          `${IN29}, art. 64, § 3º, I e II`);
      }
    } else if (tipo === "inclusao") {
      classificacao = "formal";
      add("inclusao", "formal",
        "Item novo entra por readequação no Salic, com análise do MinC: o remanejamento sem autorização vale só para itens da planilha aprovada.",
        `${MODULO_II}–37`);
    } else if (tipo === "complementacao") {
      classificacao = "formal";
      add("complementacao", "formal", `Aumenta o valor total do projeto em ${fmt(diferenca)}: pedido de complementação ao MinC, com o detalhamento das ações e dos custos adicionais.`, `${IN29}, art. 64, § 4º`);
      const metade = Math.round(centavos(contexto.homologado) / 2) / 100;
      if (contexto.captado === null) {
        add("informe_captado", "alerta", `Informe o valor captado: a complementação exige ter captado ao menos 50% do homologado (${fmt(metade)}).`, `${IN29}, art. 64, § 4º`);
      } else if (centavos(contexto.captado) < centavos(metade)) {
        add("captacao_insuficiente", "bloqueio", `Captado ${fmt(contexto.captado)}, menos que 50% do homologado (${fmt(metade)}).`, `${IN29}, art. 64, § 4º`);
      }
      const acumulado = (centavos(contexto.complementadoAntes) + centavos(diferenca)) / 100;
      if (centavos(acumulado) > centavos(metade)) {
        add("complementacao_acima", "bloqueio", `Com esta, as complementações somam ${fmt(acumulado)}, acima de 50% do homologado (${fmt(metade)}).`, `${IN29}, art. 64, § 4º, I`);
      }
      add("reinclusao", "info", "Não reinclua itens retirados na análise do MinC.", `${IN29}, art. 64, § 4º, III`);
    } else {
      classificacao = "formal";
      add("reducao", "formal", `Diminui o valor total do projeto em ${fmt(-diferenca)}: pedido de redução ao MinC, com a lista dos itens e o redimensionamento do escopo.`, `${IN29}, art. 64, § 5º`);
      const metade = Math.round(centavos(contexto.homologado) / 2) / 100;
      const acumulado = (centavos(contexto.reduzidoAntes) - centavos(diferenca)) / 100;
      if (centavos(acumulado) > centavos(metade)) {
        add("reducao_acima", "bloqueio", `Com esta, as reduções somam ${fmt(acumulado)}, acima de 50% do valor total do projeto (${fmt(metade)}).`, `${IN29}, art. 64, § 5º, II`);
      }
      add("execucao_proporcional", "info", "Para só executar menos, sem itens novos, a execução proporcional dispensa o pedido de redução.", `${IN29}, art. 64, § 6º`);
      add("selecao_publica", "info", "Projeto de seleção pública homologada não pode ser reduzido.", `${IN29}, art. 64, § 5º, V`);
    }

    if (novos.length && tipo !== "inclusao") {
      add("inclui_item", "info", `Inclui ${novos.length === 1 ? "1 item novo" : `${novos.length} itens novos`}, que entram no mesmo pedido.`);
    }

    // Tetos que a mudança estoura ou piora: bloqueio na complementação (§ 4º, IV),
    // alerta nas demais. Excesso que já existia e não piora não é desta alteração.
    const excesso = (t: { valor: number; limite: { maximo: number } | null }) =>
      t.limite ? centavos(t.valor) - centavos(t.limite.maximo) : Number.NEGATIVE_INFINITY;
    const tetosAntes = new Map(tetosPorGrupo(montarArvore(nos, []).raizes, regime).map(t => [t.grupo, excesso(t)]));
    const excedidos = tetosPorGrupo(montarArvore(nosDepois(nos, efetivos.filter(m => !m.no_id || itens.has(m.no_id))), []).raizes, regime)
      .filter(t => excesso(t) > 0 && excesso(t) > (tetosAntes.get(t.grupo) ?? Number.NEGATIVE_INFINITY));
    if (excedidos.length) {
      add("teto_depois", tipo === "complementacao" ? "bloqueio" : "alerta",
        `Depois da alteração, ${excedidos.map(t => `${t.rotulo.toLowerCase()} (${fmt(t.valor)}, máximo ${fmt(t.limite?.maximo ?? 0)})`).join(" e ")} passa do teto.`,
        tipo === "complementacao" ? `${IN29}, art. 64, § 4º, IV` : excedidos[0].limite?.norma ?? null);
    }

    if (tipo === "remanejamento" || tipo === "inclusao") {
      const acimaDe50 = efetivos.filter(m => {
        const no = m.no_id ? itens.get(m.no_id) : null;
        return no && centavos(no.valor_total) > 0 && Math.abs(centavos(m.para) - centavos(no.valor_total)) * 2 > centavos(no.valor_total);
      });
      if (acimaDe50.length) {
        add("salic_50", "alerta",
          `No Salic, ${listaDeNomes(acimaDe50.map(m => m.nome))} muda mais de 50% do valor aprovado: o sistema pode exigir readequação. A IN 29 não fixa esse limite.`,
          MODULO_II);
      }
      const jaRemanejados = efetivos.filter(m => m.no_id && centavos(itens.get(m.no_id)?.valor_remanejado ?? 0) !== 0);
      if (jaRemanejados.length) {
        add("ja_remanejado", "alerta", `${listaDeNomes(jaRemanejados.map(m => m.nome))} já foi alterado antes; o Salic não deixa remanejar de novo item readequado.`, MODULO_II);
      }
    }

    if (semGrupo.length) {
      add("itens_sem_grupo", "alerta",
        `${semGrupo.length === 1 ? "1 item alterado está" : `${semGrupo.length} itens alterados estão`} sem grupo de custo: classifique para a conferência de custos vinculados e captação valer.`);
    }

    if (classificacao === "formal") {
      const prazo = regime.prazos.analiseAlteracao;
      add("prazo_orgao", "info",
        prazo
          ? [`O MinC tem ${prazo.quantidade} dias para analisar, a contar do protocolo.`, prazo.fonte.nota, "Sem resposta no prazo, a alteração pode ser executada."].filter(Boolean).join(" ")
          : "Sem resposta do órgão no prazo, confira na norma se a alteração pode ser executada.",
        prazo ? `${prazo.fonte.documento}, ${prazo.fonte.dispositivo}` : null);
    }
  } else {
    add("regime_sem_regra", "info",
      regime
        ? `${regime.nome} não traz regras de alteração no Jards. Siga o termo, o convênio ou o edital e escolha se a alteração é administrativa ou precisa de pedido ao órgão.`
        : "Escolha o regime da prestação para conferir a alteração. Enquanto isso, indique se ela é administrativa ou precisa de pedido ao órgão.");
  }

  return {
    tipo,
    classificacao,
    antes,
    depois,
    diferenca,
    movido,
    itensAlterados: efetivos.length,
    verificacoes,
    bloqueado: verificacoes.some(v => v.nivel === "bloqueio"),
  };
}

/** Grupo de custo que vale para o nó: o próprio ou o do agrupador mais próximo. */
function grupoDe(nos: readonly NoOrcamento[], noId: string): GrupoCusto | null {
  const porId = new Map(nos.map(no => [no.id, no]));
  let atual: string | null = noId;
  for (let passos = 0; atual && passos < 100; passos++) {
    const no = porId.get(atual);
    if (!no) return null;
    if (no.grupo_custo) return no.grupo_custo;
    atual = no.parent_id;
  }
  return null;
}

/** Soma das complementações e das reduções já aprovadas, pela diferença gravada em cada cálculo. */
export function acumuladoAprovado(alteracoes: readonly { status: string; tipo: string; calculo: Partial<CalculoAlteracao> | null }[]): { complementado: number; reduzido: number } {
  let complementado = 0;
  let reduzido = 0;
  for (const alt of alteracoes) {
    if (alt.status !== "aprovada") continue;
    const diferenca = centavos(alt.calculo?.diferenca ?? 0);
    if (alt.tipo === "complementacao" && diferenca > 0) complementado += diferenca;
    if (alt.tipo === "reducao" && diferenca < 0) reduzido -= diferenca;
  }
  return { complementado: complementado / 100, reduzido: reduzido / 100 };
}

/** Data em que vence a análise do órgão, pela regra do regime; null sem regra ou sem protocolo. */
export function prazoDaAnalise(regime: RegimeNormativo | null, solicitadaEm: string | null): string | null {
  const regra = regime?.prazos.analiseAlteracao;
  if (!regra || !solicitadaEm) return null;
  return calcularVencimento(solicitadaEm, regra).data;
}

// ─── Ações por status (as mesmas da função do banco) ────────────────────────

export type AcaoAlteracao = "editar" | "excluir" | "aplicar" | "solicitar" | "aprovar" | "negar" | "reabrir" | "minuta";

export function acoesDaAlteracao(
  alteracao: { status: StatusAlteracao; classificacao: ClassificacaoAlteracao | null },
  permissoes: { editar: boolean; decidir: boolean },
): AcaoAlteracao[] {
  const acoes: AcaoAlteracao[] = [];
  const formal = alteracao.classificacao === "formal";
  if (alteracao.status === "rascunho") {
    if (permissoes.editar) acoes.push("editar", "excluir");
    if (permissoes.decidir && alteracao.classificacao === "administrativa") acoes.push("aplicar");
    if (permissoes.decidir && formal) acoes.push("solicitar");
  }
  if (alteracao.status === "solicitada" && permissoes.decidir) acoes.push("aprovar", "negar", "reabrir");
  if (formal) acoes.push("minuta");
  return acoes;
}

// ─── Minuta do pedido ───────────────────────────────────────────────────────

export type DadosMinuta = {
  prestacaoTitulo: string;
  identificador: { rotulo: string; valor: string } | null;
  regime: RegimeNormativo | null;
  numero: number;
  data: string;
  justificativa: string;
  movimentos: MovimentoAlteracao[];
  calculo: CalculoAlteracao;
};

export type Minuta = {
  titulo: string;
  destinatario: string;
  abertura: string;
  justificativa: string;
  linhas: { item: string; de: number; para: number; diferenca: number }[];
  totais: { antes: number; depois: number; diferenca: number };
  fundamentos: string[];
  fecho: string;
};

const NOME_DO_PEDIDO: Record<TipoAlteracao, { artigo: "o" | "a"; nome: string }> = {
  remanejamento: { artigo: "o", nome: "remanejamento de itens do orçamento" },
  complementacao: { artigo: "a", nome: "complementação do orçamento" },
  reducao: { artigo: "a", nome: "redução do orçamento" },
  inclusao: { artigo: "a", nome: "inclusão de item no orçamento" },
};

/** Texto-base do pedido ao órgão: a pessoa revisa e leva ao sistema oficial. */
export function minutaDoPedido(dados: DadosMinuta): Minuta {
  const { calculo, identificador, regime } = dados;
  const projeto = `“${dados.prestacaoTitulo}”${identificador?.valor ? ` (${identificador.rotulo} ${identificador.valor})` : ""}`;
  const fundamentos = [...new Set(calculo.verificacoes
    .filter(v => v.fonte && (v.nivel === "formal" || v.nivel === "ok"))
    .map(v => v.fonte as string))];
  return {
    titulo: `Pedido nº ${dados.numero}: ${NOME_DO_PEDIDO[calculo.tipo].nome}`,
    destinatario: regime?.orgao ?? "Órgão concedente",
    abertura: `Solicitamos ${NOME_DO_PEDIDO[calculo.tipo].artigo} ${NOME_DO_PEDIDO[calculo.tipo].nome} do projeto ${projeto}, conforme a justificativa e os itens abaixo${fundamentos.length ? `, nos termos de ${fundamentos.join("; ")}` : ""}.`,
    justificativa: dados.justificativa.trim() || "(preencher a justificativa)",
    linhas: movimentosEfetivos(dados.movimentos).map(m => ({
      item: m.no_id ? m.nome : `${m.nome} (item novo)`,
      de: m.de,
      para: m.para,
      diferenca: (centavos(m.para) - centavos(m.de)) / 100,
    })),
    totais: { antes: calculo.antes.valorTotalProjeto, depois: calculo.depois.valorTotalProjeto, diferenca: calculo.diferenca },
    fundamentos,
    fecho: `${dataBR(dados.data)}. Responsável pelo projeto: ____________________`,
  };
}

/** A minuta em texto simples, para colar no sistema oficial ou num e-mail. */
export function minutaEmTexto(minuta: Minuta): string {
  const linhas = minuta.linhas.map(l => `- ${l.item}: de ${fmt(l.de)} para ${fmt(l.para)} (${l.diferenca > 0 ? "+" : ""}${fmt(l.diferenca)})`);
  return [
    minuta.titulo.toUpperCase(),
    `Ao ${minuta.destinatario}`,
    "",
    minuta.abertura,
    "",
    "Justificativa",
    minuta.justificativa,
    "",
    "Itens",
    ...linhas,
    "",
    `Valor total do projeto: de ${fmt(minuta.totais.antes)} para ${fmt(minuta.totais.depois)} (${minuta.totais.diferenca > 0 ? "+" : ""}${fmt(minuta.totais.diferenca)}).`,
    "",
    minuta.fecho,
  ].join("\n");
}
