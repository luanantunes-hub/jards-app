// Piloto (P4.8): as medidas da seção 16 do estudo, por prestação e por
// organização. Tempo de montar a prestação final (do cadastro ao primeiro
// envio final registrado), envio no prazo, débitos da conta de movimento
// conciliados, custo de IA e diligências da análise preditiva por erro formal
// que o sistema detecta (os apontamentos da diligência). Sem React e sem
// Supabase: a rota do admin lê as tabelas e passa os dados.

import { CATALOGO_CHECAGENS } from "./checagens/catalogo";
import { resumoDaConciliacao, type LancamentoParaConciliar, type PagamentoParaConciliar } from "./conciliacao";

const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate.slice(0, 10)}T00:00:00Z`) - Date.parse(`${de.slice(0, 10)}T00:00:00Z`)) / 86_400_000);

// ─── Apontamentos ───────────────────────────────────────────────────────────

const GRUPO: Record<string, string> = { despesa: "Documento", fornecedor: "Fornecedor", pagamento: "Pagamento", conciliacao: "Extrato", orcamento: "Orçamento" };

/** Saldo pelo último extrato: o checklist de envio confere (saldo_liquidado), fora do motor de checagens. */
const SALDO = { codigo: "SALDO_NAO_LIQUIDADO", titulo: "Saldo da conta não recolhido", grupo: "Extrato" };

/**
 * O que o órgão aponta e o sistema confere antes do envio: as checagens de
 * documento, fornecedor, pagamento, extrato e orçamento, e o saldo da conta.
 * A diligência guarda os códigos.
 */
export const APONTAMENTOS: readonly { codigo: string; titulo: string; grupo: string }[] = [
  ...Object.entries(CATALOGO_CHECAGENS)
    .filter(([, c]) => c.grupo in GRUPO)
    .map(([codigo, c]) => ({ codigo, titulo: c.titulo, grupo: GRUPO[c.grupo] })),
  SALDO,
];

const POR_CODIGO = new Map(APONTAMENTOS.map(a => [a.codigo, a]));

const inicialBaixa = (t: string) => t.replace(/^\p{Lu}(?=\p{Ll})/u, l => l.toLowerCase());

export function rotuloDoApontamento(codigo: string): string {
  const a = POR_CODIGO.get(codigo);
  return a ? `${a.grupo}: ${inicialBaixa(a.titulo)}` : codigo;
}

/** Só o título, para listas curtas ("pagamento sem número"). */
export function tituloDoApontamento(codigo: string): string {
  const a = POR_CODIGO.get(codigo);
  return a ? inicialBaixa(a.titulo) : codigo;
}

/** O apontamento é de erro formal que o sistema detecta? */
export const sistemaDetecta = (codigo: string) => POR_CODIGO.has(codigo);

// ─── Medidas por prestação ──────────────────────────────────────────────────

export type DadosDaPrestacaoNoPiloto = {
  id: string;
  titulo: string;
  criadaEm: string;
  /** O prazo final que vale (o ajustado, quando há). */
  prazoFinal: string | null;
  enviosFinais: readonly { enviado_em: string }[];
  contas: readonly { id: string; tipo: string }[];
  lancamentos: readonly (LancamentoParaConciliar & { conta_id: string })[];
  pagamentos: readonly PagamentoParaConciliar[];
  chamadasIa: readonly { custo_usd: number | string | null; sucesso: boolean }[];
  diligencias: readonly { preditiva: boolean; apontamentos: readonly string[] }[];
};

export type MedidasDaPrestacao = {
  id: string;
  titulo: string;
  /** Do cadastro ao primeiro envio final registrado; null antes do envio. */
  diasDeMontagem: number | null;
  enviadaEm: string | null;
  /** O primeiro envio final saiu até o prazo final? null sem envio ou sem prazo. */
  noPrazo: boolean | null;
  /** Débitos da conta de movimento que esperam despesa, e quantos estão conciliados. */
  debitos: { total: number; conciliados: number };
  ia: { chamadas: number; falhas: number; custoUsd: number };
  diligencias: { total: number; preditivas: number; porErroFormal: number; codigos: string[] };
};

export function medidasDaPrestacao(d: DadosDaPrestacaoNoPiloto): MedidasDaPrestacao {
  const enviadaEm = d.enviosFinais.map(e => e.enviado_em.slice(0, 10)).sort()[0] ?? null;
  const movimento = new Set(d.contas.filter(c => c.tipo === "movimento" || c.tipo === "unica").map(c => c.id));
  const lancamentos = d.lancamentos.filter(l => movimento.has(l.conta_id));
  const ids = new Set(lancamentos.map(l => l.id));
  const conciliacao = resumoDaConciliacao(lancamentos, d.pagamentos.map(p => (p.lancamento_id && !ids.has(p.lancamento_id) ? { ...p, lancamento_id: null } : p)));
  const preditivas = d.diligencias.filter(x => x.preditiva);
  const formais = preditivas.filter(x => x.apontamentos.some(sistemaDetecta));
  const codigos = [...new Set(formais.flatMap(x => x.apontamentos.filter(sistemaDetecta)))].sort();
  return {
    id: d.id,
    titulo: d.titulo,
    diasDeMontagem: enviadaEm ? Math.max(0, diasEntre(d.criadaEm, enviadaEm)) : null,
    enviadaEm,
    noPrazo: enviadaEm && d.prazoFinal ? enviadaEm <= d.prazoFinal.slice(0, 10) : null,
    debitos: { total: conciliacao.debitos, conciliados: conciliacao.conciliados },
    ia: {
      chamadas: d.chamadasIa.length,
      falhas: d.chamadasIa.filter(c => !c.sucesso).length,
      custoUsd: Math.round(d.chamadasIa.reduce((s, c) => s + (Number(c.custo_usd) || 0), 0) * 1e6) / 1e6,
    },
    diligencias: { total: d.diligencias.length, preditivas: preditivas.length, porErroFormal: formais.length, codigos },
  };
}

// ─── Critérios ──────────────────────────────────────────────────────────────

export type SituacaoDoCriterio = "atendido" | "nao_atendido" | "sem_dados";

/** 100% dos débitos conciliados e o envio final até o prazo. */
export function criterioDaConciliacao(m: MedidasDaPrestacao): SituacaoDoCriterio {
  if (m.debitos.total === 0 || m.noPrazo === null) return "sem_dados";
  return m.debitos.conciliados === m.debitos.total && m.noPrazo ? "atendido" : "nao_atendido";
}

/** Nenhuma diligência preditiva por erro formal que o sistema detecta; antes do envio, sem dados. */
export function criterioDasDiligencias(m: MedidasDaPrestacao): SituacaoDoCriterio {
  if (!m.enviadaEm) return "sem_dados";
  return m.diligencias.porErroFormal === 0 ? "atendido" : "nao_atendido";
}

export type ResumoDaOrganizacao = {
  prestacoes: number;
  enviadas: number;
  /** Média de dias de montagem das prestações enviadas. */
  mediaDeDias: number | null;
  diasAntes: number | null;
  /** Quanto a média caiu em relação ao tempo de antes (0,5 = metade). */
  reducao: number | null;
  /** Meta do piloto: o tempo cai pela metade. */
  tempo: SituacaoDoCriterio;
  custoUsd: number;
  custoMedioUsd: number | null;
  conciliacao: SituacaoDoCriterio;
  diligencias: SituacaoDoCriterio;
};

/** O critério da organização: atendido quando todas as prestações com dados atendem; sem dados quando nenhuma tem. */
function juntar(situacoes: readonly SituacaoDoCriterio[]): SituacaoDoCriterio {
  const com = situacoes.filter(s => s !== "sem_dados");
  if (!com.length) return "sem_dados";
  return com.every(s => s === "atendido") ? "atendido" : "nao_atendido";
}

export function resumoDaOrganizacao(medidas: readonly MedidasDaPrestacao[], diasAntes: number | null): ResumoDaOrganizacao {
  const enviadas = medidas.filter(m => m.diasDeMontagem !== null);
  const mediaDeDias = enviadas.length ? Math.round((enviadas.reduce((s, m) => s + m.diasDeMontagem!, 0) / enviadas.length) * 10) / 10 : null;
  const reducao = mediaDeDias !== null && diasAntes ? Math.round((1 - mediaDeDias / diasAntes) * 1000) / 1000 : null;
  const custoUsd = Math.round(medidas.reduce((s, m) => s + m.ia.custoUsd, 0) * 1e6) / 1e6;
  return {
    prestacoes: medidas.length,
    enviadas: enviadas.length,
    mediaDeDias,
    diasAntes,
    reducao,
    tempo: reducao === null ? "sem_dados" : reducao >= 0.5 ? "atendido" : "nao_atendido",
    custoUsd,
    custoMedioUsd: medidas.length ? Math.round((custoUsd / medidas.length) * 1e6) / 1e6 : null,
    conciliacao: juntar(medidas.map(criterioDaConciliacao)),
    diligencias: juntar(medidas.map(criterioDasDiligencias)),
  };
}

/** O que a tela confere antes de gravar a organização no piloto. */
export function erroDoPiloto(c: { diasAntes: string; observacoes: string }): string | null {
  const t = c.diasAntes.trim();
  if (t && !/^\d{1,4}$/.test(t)) return "Informe os dias em número inteiro.";
  if (t && (Number(t) < 1 || Number(t) > 3650)) return "Os dias de antes vão de 1 a 3.650.";
  if (c.observacoes.length > 2000) return "As observações têm até 2.000 caracteres.";
  return null;
}
