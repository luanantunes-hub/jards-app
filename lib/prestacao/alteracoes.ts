// Alterações de orçamento (P1.7): pedido, cálculo contra as regras do regime
// e minuta do pedido formal.
//
// O banco (supabase/migrations/20261005190000_prestacao_alteracoes.sql) guarda
// o pedido e aplica os valores no remanejado dos itens quando a alteração é
// aprovada; aqui fica o cálculo que a tela mostra antes de salvar e que vai
// junto do pedido.
//
// Desde a P1.11 as regras vêm do regime (dimensão `alteracoes`): a janela em
// que a alteração cabe e, para cada tipo (remanejamento, complementação,
// redução, inclusão), se é permitido, se dispensa o órgão e em que condições,
// os requisitos (captado mínimo, acumulado máximo, tetos, número de pedidos,
// antecedência), as orientações e os alertas por item. Este arquivo só
// interpreta; não há regra de lei aqui. Regime sem a dimensão deixa a
// classificação com a pessoa.

import { calcularVencimento } from "./prazos";
import {
  basesDoOrcamento,
  grupoNoRegime,
  itensDaArvore,
  montarArvore,
  rotuloGrupo,
  tetosPorGrupo,
  type BasesDoOrcamento,
  type GrupoCusto,
  type NoOrcamento,
} from "./orcamento";
import { definida, prazoDoRegime, type RegimeNormativo } from "./regimes";
import type { BaseCalculo, CondicaoAdministrativa, Fonte, RequisitoAlteracao } from "./regimes/tipos";

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
  /** Assinatura do termo (LIE, saúde); a janela de alguns regimes começa nela. */
  dataTermo?: string | null;
  fimExecucao: string | null;
  /**
   * Total aprovado da versão homologada (ou, sem ela, da versão em uso). É a
   * base dos limites acumulados: não encolhe a cada pedido.
   */
  homologado: number;
  /** Informado no pedido; pesa na complementação. */
  captado: number | null;
  /** Soma das complementações e das reduções já aprovadas. */
  complementadoAntes: number;
  reduzidoAntes: number;
  /** Soma do que já foi movido em alterações administrativas aplicadas. */
  movidoAntes?: number;
  /** Pedidos de cada tipo já feitos (pedidos ou aprovados), para o nº de ordem. */
  pedidosAnteriores?: Partial<Record<TipoAlteracao, number>>;
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

const ROTULO_DA_BASE: Record<BaseCalculo, string> = {
  valor_captado: "do valor captado",
  valor_projeto: "do valor do projeto",
  valor_total_projeto: "do valor total do projeto",
  valor_aprovado_execucao: "do valor aprovado para execução",
  valor_homologado_execucao: "do valor homologado para execução",
  valor_autorizado_captacao: "do valor autorizado para captação",
  valor_atividade_fim: "da atividade-fim",
  orcamento_producao: "do orçamento de produção",
};

const NOME_DO_TIPO: Record<TipoAlteracao, string> = {
  remanejamento: "remanejamento",
  complementacao: "complementação",
  reducao: "redução",
  inclusao: "inclusão de item",
};

function citar(fonte: Fonte): string {
  return `${fonte.documento}, ${fonte.dispositivo}`;
}

function somarMeses(data: string, meses: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimo));
  return alvo.toISOString().slice(0, 10);
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Baixa a primeira letra de palavra comum; mantém siglas (MinC, ATO). */
function minuscula(texto: string): string {
  return /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]/.test(texto) ? texto.charAt(0).toLowerCase() + texto.slice(1) : texto;
}

function semPonto(texto: string): string {
  return texto.replace(/\.$/, "");
}

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

  const validos = efetivos.filter(m => !m.no_id || itens.has(m.no_id));
  const antes = foto(nos, regime);
  const depois = foto(nosDepois(nos, validos), regime);
  const diferenca = (centavos(depois.valorTotalProjeto) - centavos(antes.valorTotalProjeto)) / 100;
  const movido = efetivos.reduce((soma, m) => soma + Math.max(0, centavos(m.para) - centavos(m.de)), 0) / 100;
  const novos = efetivos.filter(m => !m.no_id);
  const tipo: TipoAlteracao = diferenca > 0 ? "complementacao" : diferenca < 0 ? "reducao" : novos.length ? "inclusao" : "remanejamento";

  const regras = regime ? definida(regime.alteracoes) : null;
  let classificacao: ClassificacaoAlteracao | null = null;

  if (efetivos.length === 0) {
    // Nada a classificar.
  } else if (!regime || !regras) {
    add("regime_sem_regra", "info",
      regime
        ? `${regime.nome} não traz regras de alteração no Jards. Siga o termo, o convênio ou o edital e escolha se a alteração é administrativa ou precisa de pedido ao órgão.`
        : "Escolha o regime da prestação para conferir a alteração. Enquanto isso, indique se ela é administrativa ou precisa de pedido ao órgão.");
  } else {
    const orgao = regime.orgao;
    const regra = regras.tipos[tipo];
    const anteriores = contexto.pedidosAnteriores?.[tipo] ?? 0;

    // Bases dos limites. As acumuladas usam o aprovado (homologado), que não
    // encolhe a cada pedido; o valor do projeto e as demais saem do orçamento antes da alteração.
    const base = (b: BaseCalculo): number | null => {
      switch (b) {
        case "valor_homologado_execucao":
        case "valor_total_projeto":
        case "valor_aprovado_execucao":
          return contexto.homologado;
        case "valor_projeto":
          return antes.valorProjeto;
        case "valor_captado":
          return contexto.captado;
        case "valor_autorizado_captacao":
          return null;
        default:
          return antes.porBase[b] ?? null;
      }
    };
    const movidoTotal = (acumulado: boolean) => centavos(movido) + (acumulado ? centavos(contexto.movidoAntes ?? 0) : 0);

    const condicaoVale = (c: CondicaoAdministrativa): boolean => {
      switch (c.tipo) {
        case "mantem_grupos":
          return c.grupos.every(g => centavos(antes.porGrupo[g] ?? 0) === centavos(depois.porGrupo[g] ?? 0));
        case "movido_ate": {
          const b = base(c.base);
          return b !== null && movidoTotal(c.acumulado) * 100 <= centavos(b) * c.percentual;
        }
        case "pedido_numero":
          return c.numeros.includes(anteriores + 1);
      }
    };

    const explicarFalha = (c: CondicaoAdministrativa) => {
      switch (c.tipo) {
        case "mantem_grupos": {
          const mudados = c.grupos.filter(g => centavos(antes.porGrupo[g] ?? 0) !== centavos(depois.porGrupo[g] ?? 0));
          add("muda_grupos", "formal",
            `Muda o valor aprovado de ${mudados.map(g => minuscula(rotuloGrupo(g, regime))).join(" e ")}: precisa de autorização do ${orgao}.`,
            citar(c.fonte));
          break;
        }
        case "movido_ate": {
          const b = base(c.base);
          add("movido_acima", "formal",
            b === null
              ? `Sem a base ${ROTULO_DA_BASE[c.base]} para conferir o limite de ${c.percentual}%: trate como pedido ao ${orgao}.`
              : `${c.acumulado ? "Somado às alterações já feitas, o movido chega a" : "Move"} ${fmt(movidoTotal(c.acumulado) / 100)}, acima de ${c.percentual}% ${ROTULO_DA_BASE[c.base]} (${fmt(Math.round(centavos(b) * c.percentual / 100) / 100)}): precisa de autorização do ${orgao}.`,
            citar(c.fonte));
          break;
        }
        case "pedido_numero":
          add("pedido_numero", "formal",
            `Este é o ${anteriores + 1}º pedido de ${NOME_DO_TIPO[tipo]}: só o ${c.numeros.map(n => `${n}º`).join(" ou o ")} dispensa a anuência prévia do ${orgao}.`,
            citar(c.fonte));
          break;
      }
    };

    const textoDoPedido = (): string => {
      switch (tipo) {
        case "complementacao":
          return `Aumenta o valor total do projeto em ${fmt(diferenca)}: pedido de complementação ao ${orgao}.`;
        case "reducao":
          return `Diminui o valor total do projeto em ${fmt(-diferenca)}: pedido de redução ao ${orgao}.`;
        case "inclusao":
          return `Item novo: pedido de inclusão ao ${orgao}.`;
        case "remanejamento":
          return `Remanejamento com autorização prévia do ${orgao}.`;
      }
    };

    const verificarRequisito = (req: RequisitoAlteracao) => {
      const fonte = citar(req.fonte);
      switch (req.tipo) {
        case "captado_minimo": {
          const b = base(req.base);
          if (b === null) break;
          const minimo = Math.round(centavos(b) * req.percentual / 100) / 100;
          if (contexto.captado === null) {
            add("informe_captado", "alerta", `Informe o valor captado: exige ${minuscula(semPonto(req.descricao))} (${fmt(minimo)}).`, fonte);
          } else if (centavos(contexto.captado) < centavos(minimo)) {
            add("captacao_insuficiente", req.severidade, `Captado ${fmt(contexto.captado)}, menos que ${req.percentual}% ${ROTULO_DA_BASE[req.base]} (${fmt(minimo)}).`, fonte);
          }
          break;
        }
        case "acumulado_maximo": {
          const b = base(req.base);
          if (b === null || (tipo !== "complementacao" && tipo !== "reducao")) break;
          const maximo = Math.round(centavos(b) * req.percentual / 100) / 100;
          const jaFeito = tipo === "complementacao" ? contexto.complementadoAntes : contexto.reduzidoAntes;
          const acumulado = (centavos(jaFeito) + Math.abs(centavos(diferenca))) / 100;
          if (centavos(acumulado) > centavos(maximo)) {
            add(`${tipo}_acima`, req.severidade,
              `Com esta, as ${tipo === "complementacao" ? "complementações" : "reduções"} somam ${fmt(acumulado)}, acima de ${req.percentual}% ${ROTULO_DA_BASE[req.base]} (${fmt(maximo)}).`, fonte);
          }
          break;
        }
        case "tetos": {
          // Teto que a mudança estoura ou piora; excesso que já existia e não piora não é desta alteração.
          const excesso = (t: { limite: { maximo: number | null; valorLimitado: number } | null }) =>
            t.limite && t.limite.maximo !== null ? centavos(t.limite.valorLimitado) - centavos(t.limite.maximo) : Number.NEGATIVE_INFINITY;
          const tetosAntes = new Map(tetosPorGrupo(montarArvore(nos, []).raizes, regime).map(t => [t.grupo, excesso(t)]));
          const excedidos = tetosPorGrupo(montarArvore(nosDepois(nos, validos), []).raizes, regime)
            .filter(t => excesso(t) > 0 && excesso(t) > (tetosAntes.get(t.grupo) ?? Number.NEGATIVE_INFINITY));
          if (excedidos.length) {
            add("teto_depois", req.severidade,
              `Depois da alteração, ${excedidos.map(t => `${minuscula(t.rotulo)} (${fmt(t.limite?.valorLimitado ?? t.valor)}, máximo ${fmt(t.limite?.maximo ?? 0)})`).join(" e ")} passa do teto.`,
              req.severidade === "bloqueio" ? fonte : excedidos[0].limite?.norma ?? fonte);
          }
          break;
        }
        case "maximo_pedidos":
          if (anteriores + 1 > req.quantidade) {
            add("pedidos_esgotados", req.severidade,
              `Já ${anteriores === 1 ? "houve 1 pedido" : `houve ${anteriores} pedidos`} de ${NOME_DO_TIPO[tipo]}; a norma admite ${req.quantidade}.`, fonte);
          }
          break;
        case "antecedencia": {
          if (!contexto.fimExecucao) {
            add("sem_fim_execucao", "alerta", `Informe o fim da execução: ${minuscula(semPonto(req.descricao))}.`, fonte);
            break;
          }
          const limite = req.unidade === "meses"
            ? somarMeses(contexto.fimExecucao, -req.quantidade)
            : new Date(Date.parse(`${contexto.fimExecucao}T00:00:00Z`) - req.quantidade * 86_400_000).toISOString().slice(0, 10);
          if (contexto.hoje > limite) {
            add("fora_da_antecedencia", req.severidade, `${semPonto(req.descricao)}: o limite era ${dataBR(limite)}.`, fonte);
          }
          break;
        }
      }
    };

    // Janela: quando a alteração cabe.
    const fonteJanela = citar(regras.janela.fonte);
    if (regras.janela.aPartirDe === "liberacao") {
      if (!contexto.dataLiberacao) {
        add("sem_liberacao", "alerta", "Sem a data de liberação para execução na prestação: a alteração só cabe depois dela.", fonteJanela);
      } else if (contexto.hoje < contexto.dataLiberacao) {
        add("antes_da_liberacao", "alerta", `A liberação para execução é em ${dataBR(contexto.dataLiberacao)}: a alteração só cabe depois dela.`, fonteJanela);
      }
    } else if (regras.janela.aPartirDe === "assinatura_termo") {
      if (!contexto.dataTermo) {
        add("sem_termo", "alerta", "Sem a data do termo na prestação: a alteração só cabe depois da assinatura.", fonteJanela);
      } else if (contexto.hoje < contexto.dataTermo) {
        add("antes_do_termo", "alerta", `O termo é de ${dataBR(contexto.dataTermo)}: a alteração só cabe depois dele.`, fonteJanela);
      }
    }
    if (regras.janela.ate === "fim_execucao" && contexto.fimExecucao && contexto.hoje > contexto.fimExecucao) {
      add("apos_execucao", "alerta", `A execução terminou em ${dataBR(contexto.fimExecucao)}: a alteração cabe até o fim do período de execução.`, fonteJanela);
    }

    // Classificação: proibido, administrativo (quando as condições valem) ou formal.
    if (!regra.permitido) {
      classificacao = "formal";
      add("tipo_nao_permitido", "bloqueio", `${regime.nome} não admite ${NOME_DO_TIPO[tipo]}.`, citar(regra.fonte));
    } else if (regra.classificacao === "administrativa") {
      const falhas = regra.condicoes.filter(c => !condicaoVale(c));
      if (falhas.length === 0) {
        classificacao = "administrativa";
        add("dispensa_pedido", "ok",
          `${capitalizar(NOME_DO_TIPO[tipo])} que dispensa autorização do ${orgao}${regra.condicoes.length ? `: ${regra.condicoes.map(c => minuscula(semPonto(c.descricao))).join("; ")}` : ""}.`,
          citar(regra.fonte));
      } else {
        classificacao = "formal";
        for (const c of falhas) explicarFalha(c);
      }
    } else {
      classificacao = "formal";
      add(tipo, "formal", textoDoPedido(), citar(regra.fonte));
    }

    if (regra.permitido) {
      for (const req of regra.requisitos) verificarRequisito(req);
      for (const o of regra.orientacoes) add(o.codigo, o.severidade, o.descricao, citar(o.fonte));
    }

    if (novos.length && tipo !== "inclusao") {
      add("inclui_item", "info", `Inclui ${novos.length === 1 ? "1 item novo" : `${novos.length} itens novos`}, que entram no mesmo pedido.`);
    }

    // Alertas por item, nos tipos que mexem em itens sem mudar o total.
    if (tipo === "remanejamento" || tipo === "inclusao") {
      for (const alerta of regras.alertasPorItem) {
        if (alerta.tipo === "variacao_item") {
          const acima = efetivos.filter(m => {
            const no = m.no_id ? itens.get(m.no_id) : null;
            return no && centavos(no.valor_total) > 0
              && Math.abs(centavos(m.para) - centavos(no.valor_total)) * 100 > centavos(no.valor_total) * alerta.percentual;
          });
          if (acima.length) {
            add("variacao_item", "alerta", `${listaDeNomes(acima.map(m => m.nome))} muda mais de ${alerta.percentual}% do valor aprovado. ${alerta.descricao}`, citar(alerta.fonte));
          }
        } else {
          const ja = efetivos.filter(m => m.no_id && centavos(itens.get(m.no_id)?.valor_remanejado ?? 0) !== 0);
          if (ja.length) add("item_ja_alterado", "alerta", `${listaDeNomes(ja.map(m => m.nome))} já foi alterado antes. ${alerta.descricao}`, citar(alerta.fonte));
        }
      }
    }

    // Itens sem grupo do regime, quando as condições ou os tetos dependem do grupo.
    const dependeDeGrupo = regra.condicoes.some(c => c.tipo === "mantem_grupos") || regra.requisitos.some(r => r.tipo === "tetos");
    const semGrupo = efetivos.filter(m => {
      const grupo = m.no_id ? grupoDe(nos, m.no_id) : m.grupo_custo ?? (m.parent_id ? grupoDe(nos, m.parent_id) : null);
      return !grupoNoRegime(grupo, regime);
    });
    if (dependeDeGrupo && semGrupo.length) {
      add("itens_sem_grupo", "alerta",
        `${semGrupo.length === 1 ? "1 item alterado está" : `${semGrupo.length} itens alterados estão`} sem grupo de custo do regime: classifique para a conferência valer.`);
    }

    if (classificacao === "formal") {
      const prazo = regras.prazoAnalise ? prazoDoRegime(regime, regras.prazoAnalise) : null;
      const unidade = prazo ? { dias_corridos: "dias", dias_uteis: "dias úteis", meses: "meses", anos: "anos" }[prazo.unidade] : "";
      add("prazo_orgao", "info",
        prazo
          ? [
              `O ${orgao} tem ${prazo.quantidade} ${unidade} para analisar, a contar do protocolo.`,
              prazo.fonte.nota,
              regras.silencioAprova ? "Sem resposta no prazo, a alteração pode ser executada." : "Sem resposta, a alteração não pode ser executada.",
            ].filter(Boolean).join(" ")
          : regras.silencioAprova
            ? "Sem resposta do órgão no prazo, a alteração pode ser executada."
            : "A norma não fixa prazo de resposta do órgão, e a alteração só pode ser executada depois da autorização.",
        prazo ? citar(prazo.fonte) : citar(regras.fonte));
    }
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

export type Acumulado = {
  complementado: number;
  reduzido: number;
  /** Movido em alterações administrativas aplicadas. */
  movido: number;
  /** Pedidos feitos ou aprovados, por tipo. */
  pedidos: Partial<Record<TipoAlteracao, number>>;
};

/**
 * Soma das complementações e das reduções já aprovadas (pela diferença
 * gravada em cada cálculo), do que já foi movido sem pedido e quantos pedidos
 * de cada tipo já houve. Rascunho e negado não contam.
 */
export function acumuladoAprovado(alteracoes: readonly { status: string; tipo: string; classificacao?: string | null; calculo: Partial<CalculoAlteracao> | null }[]): Acumulado {
  let complementado = 0;
  let reduzido = 0;
  let movido = 0;
  const pedidos: Partial<Record<TipoAlteracao, number>> = {};
  for (const alt of alteracoes) {
    if (alt.status === "solicitada" || alt.status === "aprovada") {
      const tipo = alt.tipo as TipoAlteracao;
      pedidos[tipo] = (pedidos[tipo] ?? 0) + 1;
    }
    if (alt.status !== "aprovada") continue;
    const diferenca = centavos(alt.calculo?.diferenca ?? 0);
    if (alt.tipo === "complementacao" && diferenca > 0) complementado += diferenca;
    if (alt.tipo === "reducao" && diferenca < 0) reduzido -= diferenca;
    if ((alt.classificacao ?? alt.calculo?.classificacao) === "administrativa") movido += centavos(alt.calculo?.movido ?? 0);
  }
  return { complementado: complementado / 100, reduzido: reduzido / 100, movido: movido / 100, pedidos };
}

/** Data em que vence a análise do órgão, pela regra do regime; null sem regra ou sem protocolo. */
export function prazoDaAnalise(regime: RegimeNormativo | null, solicitadaEm: string | null): string | null {
  const alteracoes = regime ? definida(regime.alteracoes) : null;
  const regra = alteracoes?.prazoAnalise ? prazoDoRegime(regime, alteracoes.prazoAnalise) : null;
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
