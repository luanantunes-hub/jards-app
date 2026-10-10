// Metas e locais do objeto (P3.1). O relatório do objeto compara as metas
// propostas com os resultados e diz, para cada local de realização, se ele
// foi realizado, não realizado ou realizado com outras fontes. Sem React e
// sem Supabase.

import type { PrestacaoAtividade, PrestacaoLocal, PrestacaoMeta } from "@/lib/supabase/types";

/** Limite da justificativa do local no Salic. */
export const LIMITE_JUSTIFICATIVA_LOCAL = 500;
export const LIMITE_JUSTIFICATIVA_META = 2000;

export const UFS = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"], ["BA", "Bahia"], ["CE", "Ceará"],
  ["DF", "Distrito Federal"], ["ES", "Espírito Santo"], ["GO", "Goiás"], ["MA", "Maranhão"], ["MT", "Mato Grosso"],
  ["MS", "Mato Grosso do Sul"], ["MG", "Minas Gerais"], ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"],
  ["PE", "Pernambuco"], ["PI", "Piauí"], ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"], ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"], ["SP", "São Paulo"],
  ["SE", "Sergipe"], ["TO", "Tocantins"],
] as const;

export type StatusLocal = PrestacaoLocal["status"];

export const STATUS_LOCAL: readonly { id: StatusLocal; rotulo: string; cor: string; pedeJustificativa: boolean }[] = [
  { id: "previsto", rotulo: "Previsto", cor: "#2D72B0", pedeJustificativa: false },
  { id: "realizado", rotulo: "Realizado", cor: "#2E8932", pedeJustificativa: false },
  { id: "nao_realizado", rotulo: "Não realizado", cor: "#D94A4A", pedeJustificativa: true },
  { id: "outras_fontes", rotulo: "Realizado com outras fontes", cor: "#B07A14", pedeJustificativa: true },
];

export const ehBrasil = (pais: string | null | undefined) => !pais || pais.trim().toLowerCase() === "brasil";

/** "São Paulo/SP" no Brasil; "Buenos Aires, Argentina" fora dele. */
export function rotuloDoLocal(local: Pick<PrestacaoLocal, "pais" | "uf" | "municipio">): string {
  if (ehBrasil(local.pais)) return [local.municipio, local.uf].filter(Boolean).join("/") || "Local sem município";
  return [local.municipio, local.pais].filter(Boolean).join(", ");
}

const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** "10/03/2026 a 12/03/2026", "a partir de 10/03/2026", "até 12/03/2026" ou null. */
export function periodoDoLocal(local: Pick<PrestacaoLocal, "inicio" | "fim">): string | null {
  if (local.inicio && local.fim) return local.inicio === local.fim ? dataBr(local.inicio) : `${dataBr(local.inicio)} a ${dataBr(local.fim)}`;
  if (local.inicio) return `a partir de ${dataBr(local.inicio)}`;
  if (local.fim) return `até ${dataBr(local.fim)}`;
  return null;
}

export type CamposDoLocal = Pick<PrestacaoLocal, "pais" | "uf" | "municipio" | "espaco" | "inicio" | "fim" | "status" | "justificativa">;

/** O mesmo que o banco confere, para a tela avisar antes de salvar. */
export function erroDoLocal(l: CamposDoLocal): string | null {
  if (!l.pais?.trim()) return "Informe o país.";
  if (ehBrasil(l.pais) && (!l.uf || !l.municipio?.trim())) return "No Brasil, informe a UF e o município.";
  if (l.inicio && l.fim && l.fim < l.inicio) return "O fim vem antes do início.";
  const regra = STATUS_LOCAL.find(s => s.id === l.status);
  const justificativa = l.justificativa?.trim() ?? "";
  if (regra?.pedeJustificativa && !justificativa) return `"${regra.rotulo}" pede justificativa.`;
  if (justificativa.length > LIMITE_JUSTIFICATIVA_LOCAL) return `A justificativa tem até ${LIMITE_JUSTIFICATIVA_LOCAL} caracteres, como no Salic.`;
  return null;
}

export type CamposDaMeta = Pick<PrestacaoMeta, "descricao" | "unidade" | "previsto" | "realizado" | "justificativa">;

export function erroDaMeta(m: CamposDaMeta): string | null {
  if (!m.descricao?.trim()) return "Descreva a meta.";
  if (!Number.isFinite(m.previsto) || m.previsto < 0) return "O previsto é um número a partir de zero.";
  if (m.realizado !== null && (!Number.isFinite(m.realizado) || m.realizado < 0)) return "O realizado é um número a partir de zero.";
  if ((m.justificativa?.length ?? 0) > LIMITE_JUSTIFICATIVA_META) return `A justificativa tem até ${LIMITE_JUSTIFICATIVA_META} caracteres.`;
  return null;
}

export type SituacaoDaMeta = "sem_resultado" | "atingida" | "abaixo" | "acima";

export type ResumoDaMeta = {
  situacao: SituacaoDaMeta;
  /** Realizado sobre previsto, em %, arredondado; null sem resultado ou com previsto zero. */
  percentual: number | null;
  /** Abaixo do previsto sem justificativa escrita. */
  faltaJustificativa: boolean;
  atividades: number;
  realizadas: number;
  publico: number;
};

type AtividadeDaMeta = Pick<PrestacaoAtividade, "meta_id" | "status_realizacao" | "publico_atingido">;

/** Situação da meta e o que as atividades ligadas a ela já mostram. */
export function resumoDaMeta(meta: Pick<PrestacaoMeta, "id" | "previsto" | "realizado" | "justificativa">, atividades: readonly AtividadeDaMeta[]): ResumoDaMeta {
  const ligadas = atividades.filter(a => a.meta_id === meta.id);
  const realizadas = ligadas.filter(a => a.status_realizacao === "realizado");
  const base = {
    atividades: ligadas.length,
    realizadas: realizadas.length,
    publico: realizadas.reduce((soma, a) => soma + (a.publico_atingido ?? 0), 0),
  };
  if (meta.realizado === null || meta.realizado === undefined) {
    return { ...base, situacao: "sem_resultado", percentual: null, faltaJustificativa: false };
  }
  const previsto = Number(meta.previsto), realizado = Number(meta.realizado);
  const situacao: SituacaoDaMeta = realizado < previsto ? "abaixo" : realizado > previsto ? "acima" : "atingida";
  return {
    ...base,
    situacao,
    percentual: previsto > 0 ? Math.round((realizado / previsto) * 100) : null,
    faltaJustificativa: situacao === "abaixo" && !meta.justificativa?.trim(),
  };
}

/** Número da meta como o relatório escreve: "6 oficinas", "1.500 pessoas". */
export function quantidade(valor: number | null, unidade: string | null): string {
  if (valor === null || valor === undefined) return "—";
  const numero = Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return unidade?.trim() ? `${numero} ${unidade.trim()}` : numero;
}

/** A execução terminou quando hoje passou do fim da execução. */
export function execucaoTerminou(fimDaExecucao: string | null | undefined, hoje: Date): boolean {
  if (!fimDaExecucao) return false;
  const dia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  return fimDaExecucao.slice(0, 10) < dia;
}

/** Número como a pessoa digita: "1.500", "1500", "2,5", "2.5" ou "1.500," (a vírgula sem centavos). Vazio vira null; texto inválido, NaN. */
export function numeroDigitado(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, "").replace(/,$/, "");
  if (!limpo) return null;
  // Com vírgula, ela é a decimal e o ponto separa milhar; sem vírgula, ponto com 3 casas depois é milhar.
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(limpo) ? limpo.replace(/\./g, "") : limpo;
  return /^-?\d+(\.\d+)?$/.test(normal) ? Number(normal) : NaN;
}

// ─── Cobertura por meta e rastreabilidade (P3.3) ────────────────────────────

type AtividadeDaCobertura = Pick<PrestacaoAtividade, "id" | "meta_id" | "status_realizacao">;
type EvidenciaDaCobertura = { atividade_id: string | null; meta_id: string | null };

export type CoberturaDaMeta = {
  /** Evidências da meta: as ligadas a ela e as das atividades dela, sem contar duas vezes. */
  evidencias: number;
  atividadesRealizadas: number;
  atividadesComEvidencia: number;
  /** Tem evidência e, quando há atividades realizadas, todas têm. */
  comprovada: boolean;
  texto: string;
};

/** "Meta 3: 4 de 6 oficinas com evidência": o que comprova a meta. */
export function coberturaDaMeta(
  meta: Pick<PrestacaoMeta, "id">,
  atividades: readonly AtividadeDaCobertura[],
  evidencias: readonly EvidenciaDaCobertura[],
): CoberturaDaMeta {
  const daMeta = atividades.filter(a => a.meta_id === meta.id);
  const idsDaMeta = new Set(daMeta.map(a => a.id));
  const evidenciasDaMeta = evidencias.filter(e => e.meta_id === meta.id || (e.atividade_id !== null && idsDaMeta.has(e.atividade_id)));
  const realizadas = daMeta.filter(a => a.status_realizacao === "realizado");
  const comEvidencia = realizadas.filter(a => evidencias.some(e => e.atividade_id === a.id));
  const n = evidenciasDaMeta.length;
  const comprovada = n > 0 && comEvidencia.length === realizadas.length;
  const texto = realizadas.length > 0
    ? `${comEvidencia.length} de ${realizadas.length} ${realizadas.length === 1 ? "atividade realizada" : "atividades realizadas"} com evidência`
    : n > 0 ? `${n} ${n === 1 ? "evidência" : "evidências"}` : "Sem evidência";
  return { evidencias: n, atividadesRealizadas: realizadas.length, atividadesComEvidencia: comEvidencia.length, comprovada, texto };
}

/**
 * A meta a que serve um item do orçamento: a ligada ao agrupador mais próximo
 * acima dele (meta, produto ou etapa). É por aí que a despesa chega à meta.
 */
export function metaDoItem<M extends Pick<PrestacaoMeta, "no_id">>(ancestrais: readonly string[], metas: readonly M[]): M | null {
  for (let i = ancestrais.length - 1; i >= 0; i--) {
    const meta = metas.find(m => m.no_id === ancestrais[i]);
    if (meta) return meta;
  }
  return null;
}
