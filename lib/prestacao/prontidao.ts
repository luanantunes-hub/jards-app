// Prontidão da prestação e próximos prazos (P1.9).
//
// A prontidão diz quanto falta para enviar, em pendências com o que fazer e
// em que aba. Antes do motor de checagens da fase 2, a conta usa o que o
// módulo já guarda: regime, prazo, orçamento em árvore, tetos, comprovantes,
// atividades e alterações. Cada checagem tem peso; a comprovação pesa mais,
// porque é o grosso do trabalho. O percentual só chega a 100 sem pendência.

import type { StatusPrestacao } from "@/lib/supabase/types";
import { prazoDaAnalise } from "./alteracoes";
import { diferencaEmDias } from "./calendario";
import { grupoNoRegime, tetosDosItens, type ItemResumido } from "./orcamento";
import { calcularVencimento } from "./prazos";
import { definida, prazoDoRegime, type RegimeNormativo } from "./regimes";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d: string) => d.split("-").reverse().join("/");

function centavos(valor: unknown): number {
  const numero = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

export type ItemParaProntidao = ItemResumido & { id: string };
export type ComprovanteParaProntidao = { no_id: string | null; status: string; valor_extraido: number | null };

export type DadosProntidao = {
  regime: RegimeNormativo | null;
  identificadorOficial: string | null;
  prazo: string | null;
  /** Itens da versão em uso do orçamento. */
  itens: ItemParaProntidao[];
  comprovantes: ComprovanteParaProntidao[];
  atividades: number;
  alteracoesAguardando: number;
};

/** Aba onde a pendência se resolve. */
export type DestinoPendencia = "visao_geral" | "orcamento" | "comprovantes" | "atividades";

export type Checagem = {
  codigo: string;
  titulo: string;
  peso: number;
  /** De 0 a 1. */
  progresso: number;
  situacao: "ok" | "pendente";
  detalhe: string;
  destino: DestinoPendencia;
};

export type Prontidao = {
  /** Inteiro de 0 a 100; 100 só sem nenhuma pendência. */
  percentual: number;
  checagens: Checagem[];
  /** Pendências, da que mais pesa para a que menos pesa. */
  pendencias: Checagem[];
};

export function avaliarProntidao(dados: DadosProntidao): Prontidao {
  const { regime, itens, comprovantes } = dados;
  const checagens: Checagem[] = [];
  const add = (codigo: string, titulo: string, peso: number, progresso: number, detalhe: string, destino: DestinoPendencia) => {
    const p = Math.max(0, Math.min(1, progresso));
    checagens.push({ codigo, titulo, peso, progresso: p, situacao: p >= 1 ? "ok" : "pendente", detalhe, destino });
  };

  // Regime e identificador oficial.
  const rotuloId = regime?.identificadorOficial?.rotulo;
  if (!regime) add("regime", "Regime e dados oficiais", 1, 0, "Escolha o regime da prestação.", "visao_geral");
  else if (rotuloId && !dados.identificadorOficial?.trim()) add("regime", "Regime e dados oficiais", 1, 0.5, `Informe o ${rotuloId}.`, "visao_geral");
  else add("regime", "Regime e dados oficiais", 1, 1, regime.nome, "visao_geral");

  // Prazo de envio.
  add("prazo", "Prazo de envio", 1, dados.prazo ? 1 : 0,
    dados.prazo ? `Envio até ${dataBR(dados.prazo)}.` : "Informe os marcos (como o fim da execução) para o prazo ser calculado.", "visao_geral");

  // Orçamento.
  const vigente = itens.reduce((soma, item) => soma + centavos(item.vigente), 0);
  add("orcamento", "Orçamento", 1, itens.length > 0 ? 1 : 0,
    itens.length > 0 ? `${plural(itens.length, "item", "itens")}, ${fmt(vigente / 100)} vigente.` : "Cadastre ou importe o orçamento aprovado.", "orcamento");

  // Grupos de custo e tetos, quando o regime tem tetos ou bases por grupo.
  const orcamento = regime ? definida(regime.orcamento) : null;
  const temTetos = Boolean(orcamento && (orcamento.tetos.length > 0 || Object.values(orcamento.bases).some(b => b && (b.soma !== "todos" || b.exceto.length > 0))));
  if (temTetos && itens.length > 0) {
    const semGrupo = itens.filter(item => !grupoNoRegime(item.grupo, regime)).length;
    add("grupos", "Grupos de custo", 1, (itens.length - semGrupo) / itens.length,
      semGrupo ? `${plural(semGrupo, "item está", "itens estão")} sem grupo de custo do regime; os tetos dependem dessa classificação.` : "Todos os itens têm grupo de custo.", "orcamento");
    const excedidos = tetosDosItens(itens, regime).filter(t => t.excedido && t.limite?.maximo !== null && t.limite?.maximo !== undefined);
    add("tetos", "Tetos do regime", 1, excedidos.length ? 0 : 1,
      excedidos.length
        ? `${excedidos.map(t => `${t.rotulo} acima do teto em ${fmt((centavos(t.limite?.valorLimitado ?? t.valor) - centavos(t.limite?.maximo ?? 0)) / 100)}`).join("; ")}.`
        : "Dentro dos tetos.", "orcamento");
  }

  // Comprovação: aceitos ligados a item, sobre o vigente.
  const idsDosItens = new Set(itens.map(item => item.id));
  const aceitos = comprovantes.filter(c => c.status === "aceito");
  const pago = aceitos.filter(c => c.no_id && idsDosItens.has(c.no_id)).reduce((soma, c) => soma + centavos(c.valor_extraido), 0);
  if (vigente > 0) {
    const fracao = pago / vigente;
    add("comprovacao", "Comprovação do orçamento", 4, fracao,
      fracao >= 1
        ? `${fmt(pago / 100)} comprovados, todo o vigente.`
        : `${fmt(pago / 100)} de ${fmt(vigente / 100)} comprovados (${Math.floor(fracao * 100)}%). Faltam ${fmt((vigente - pago) / 100)}.`,
      "comprovantes");
  } else {
    add("comprovacao", "Comprovação do orçamento", 4, 0, "Sem orçamento para comparar o que foi comprovado.", "orcamento");
  }

  // Comprovantes avaliados.
  const pendentes = comprovantes.filter(c => c.status === "pendente").length;
  add("avaliacao", "Comprovantes avaliados", 1, comprovantes.length ? 1 - pendentes / comprovantes.length : 1,
    pendentes ? `${plural(pendentes, "comprovante aguarda", "comprovantes aguardam")} avaliação.` : "Nenhum comprovante aguardando avaliação.", "comprovantes");

  // Comprovantes aceitos ligados a um item.
  const semItem = aceitos.filter(c => !c.no_id || !idsDosItens.has(c.no_id)).length;
  add("vinculo", "Comprovantes ligados ao orçamento", 1, aceitos.length ? 1 - semItem / aceitos.length : 1,
    semItem ? `${plural(semItem, "comprovante aceito está", "comprovantes aceitos estão")} sem item do orçamento.` : "Todos os aceitos estão ligados a um item.", "comprovantes");

  // Objeto.
  add("objeto", "Atividades do objeto", 1, dados.atividades > 0 ? 1 : 0,
    dados.atividades > 0 ? `${plural(dados.atividades, "atividade registrada", "atividades registradas")}.` : "Registre as atividades realizadas, com evidências.", "atividades");

  // Alterações em aberto.
  add("alteracoes", "Alterações do orçamento", 1, dados.alteracoesAguardando ? 0 : 1,
    dados.alteracoesAguardando ? `${plural(dados.alteracoesAguardando, "alteração aguarda", "alterações aguardam")} resposta do órgão.` : "Nenhuma alteração aguardando o órgão.", "orcamento");

  const pesoTotal = checagens.reduce((soma, c) => soma + c.peso, 0);
  const feito = checagens.reduce((soma, c) => soma + c.peso * c.progresso, 0);
  const pendencias = checagens
    .filter(c => c.situacao === "pendente")
    .sort((a, b) => b.peso * (1 - b.progresso) - a.peso * (1 - a.progresso));
  return {
    percentual: pendencias.length ? Math.min(99, Math.floor((feito / pesoTotal) * 100)) : 100,
    checagens,
    pendencias,
  };
}

// ─── Prazos ─────────────────────────────────────────────────────────────────

export type PrazoDaPrestacao = {
  data: string;
  rotulo: string;
  /** Quem cumpre: o proponente (envio) ou o órgão (análises). */
  quem: "proponente" | "orgao";
  /** Dias até a data; negativo quando venceu. */
  dias: number;
};

const EM_PREPARO: StatusPrestacao[] = ["rascunho", "revisao_interna", "ajuste_solicitado"];

/** Prazos em aberto da prestação, do mais cedo para o mais tarde. */
export function prazosDaPrestacao(
  prestacao: { status: StatusPrestacao; prazo: string | null; data_envio?: string | null },
  regime: RegimeNormativo | null,
  alteracoesAguardando: readonly { numero: number; solicitada_em: string | null }[],
  hoje: string,
): PrazoDaPrestacao[] {
  const prazos: Omit<PrazoDaPrestacao, "dias">[] = [];
  if (EM_PREPARO.includes(prestacao.status) && prestacao.prazo) {
    prazos.push({ data: prestacao.prazo, rotulo: "Envio da prestação", quem: "proponente" });
  }
  const analise = prazoDoRegime(regime, "analisePrestacao");
  if (prestacao.status === "enviado" && prestacao.data_envio && analise) {
    prazos.push({ data: calcularVencimento(prestacao.data_envio, analise).data, rotulo: "Análise do órgão", quem: "orgao" });
  }
  for (const alteracao of alteracoesAguardando) {
    const data = prazoDaAnalise(regime, alteracao.solicitada_em);
    if (data) prazos.push({ data, rotulo: `Resposta à alteração nº ${alteracao.numero}`, quem: "orgao" });
  }
  return prazos
    .map(prazo => ({ ...prazo, dias: diferencaEmDias(hoje, prazo.data) }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * O prazo que importa agora: um prazo do proponente já vencido vem primeiro;
 * senão, o próximo a vencer; senão, o último que venceu.
 */
export function proximoPrazo(prazos: readonly PrazoDaPrestacao[]): PrazoDaPrestacao | null {
  return prazos.find(p => p.quem === "proponente" && p.dias < 0)
    ?? prazos.find(p => p.dias >= 0)
    ?? prazos.at(-1)
    ?? null;
}

/** Texto curto do prazo: "em 12 dias", "hoje", "venceu há 3 dias". */
export function quandoVence(dias: number): string {
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias > 0) return `em ${dias} dias`;
  return dias === -1 ? "venceu ontem" : `venceu há ${-dias} dias`;
}
