// Grade semanal de atividades e calendário de eventos (P8.6).
//
// O formulário PCP/PCF da Lei de Incentivo ao Esporte traz duas abas de
// atividades programadas: GRADE, com um bloco por núcleo (nome, endereço,
// responsável e telefone) e, em cada turma, a modalidade, a quantidade de
// alunos, os dias da semana, o horário e a equipe; e EVENTOS, com o nome, as
// datas, o local e o número de beneficiários previstos. O núcleo é o local de
// execução (P3.1); as turmas ficam em prestacao_turmas e os eventos saem das
// atividades. Sem React e sem Supabase.

import { definida, type RegimeNormativo } from "./regimes";
import type { PrestacaoAtividade, PrestacaoLocal, PrestacaoTurma } from "@/lib/supabase/types";

export const DIAS_DA_SEMANA = [
  { dia: 1, curto: "Seg", nome: "segunda" },
  { dia: 2, curto: "Ter", nome: "terça" },
  { dia: 3, curto: "Qua", nome: "quarta" },
  { dia: 4, curto: "Qui", nome: "quinta" },
  { dia: 5, curto: "Sex", nome: "sexta" },
  { dia: 6, curto: "Sáb", nome: "sábado" },
  { dia: 7, curto: "Dom", nome: "domingo" },
] as const;

export type TurmaDaGrade = Pick<PrestacaoTurma, "id" | "local_id" | "nome" | "modalidade" | "alunos" | "dias" | "hora_inicio" | "hora_fim" | "equipe">
  & Partial<Pick<PrestacaoTurma, "observacoes" | "ordem">>;

export type NucleoDoLocal = Pick<PrestacaoLocal, "id" | "pais" | "uf" | "municipio" | "status">
  & Partial<Pick<PrestacaoLocal, "espaco" | "endereco" | "responsavel" | "telefone">>;

export type AtividadeDoEvento = Pick<PrestacaoAtividade, "id" | "titulo" | "data_realizacao" | "data_inicio" | "data_fim" | "local_id">
  & Partial<Pick<PrestacaoAtividade, "local" | "cidade" | "estado" | "meta_prevista" | "status_realizacao">>;

/** "Seg, Qua e Sex", na ordem da semana. */
export function rotuloDosDias(dias: readonly number[]): string {
  const curtos = DIAS_DA_SEMANA.filter(d => dias.includes(d.dia)).map(d => d.curto);
  return curtos.length > 1 ? `${curtos.slice(0, -1).join(", ")} e ${curtos[curtos.length - 1]}` : curtos[0] ?? "";
}

/** "08:00" a partir de "08:00:00". */
export const hora = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

/** "08:00 às 09:30", ou o que houver. */
export function rotuloDoHorario(t: Pick<TurmaDaGrade, "hora_inicio" | "hora_fim">): string {
  const [a, b] = [hora(t.hora_inicio), hora(t.hora_fim)];
  return a && b ? `${a} às ${b}` : a ? `a partir das ${a}` : b ? `até as ${b}` : "";
}

/** Nome do núcleo: o espaço, ou a cidade e a UF. */
export function nomeDoNucleo(l: Pick<NucleoDoLocal, "espaco" | "municipio" | "uf" | "pais">): string {
  const espaco = l.espaco?.trim();
  if (espaco) return espaco;
  const cidade = [l.municipio, l.uf].filter(Boolean).join("/");
  return cidade || l.pais || "Local";
}

export type BlocoDaGrade<T extends TurmaDaGrade = TurmaDaGrade> = {
  local: NucleoDoLocal | null;
  nucleo: string;
  endereco: string;
  responsavel: string;
  telefone: string;
  turmas: T[];
};

/** As turmas por núcleo, na ordem dos locais; as sem núcleo vão num bloco à parte, no fim. */
export function gradePorNucleo<T extends TurmaDaGrade>(turmas: readonly T[], locais: readonly NucleoDoLocal[]): BlocoDaGrade<T>[] {
  const ordenadas = [...turmas].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
  const blocos: BlocoDaGrade<T>[] = [];
  for (const l of locais) {
    const doLocal = ordenadas.filter(t => t.local_id === l.id);
    if (!doLocal.length) continue;
    const cidade = [l.municipio, l.uf].filter(Boolean).join("/");
    blocos.push({
      local: l,
      nucleo: nomeDoNucleo(l),
      endereco: [l.endereco?.trim(), cidade].filter(Boolean).join(", "),
      responsavel: l.responsavel?.trim() ?? "",
      telefone: l.telefone?.trim() ?? "",
      turmas: doLocal,
    });
  }
  const ids = new Set(locais.map(l => l.id));
  const semNucleo = ordenadas.filter(t => !t.local_id || !ids.has(t.local_id));
  if (semNucleo.length) blocos.push({ local: null, nucleo: "", endereco: "", responsavel: "", telefone: "", turmas: semNucleo });
  return blocos;
}

export type LinhaDeEvento = { nome: string; de: string; ate: string; endereco: string; cidade: string; pais: string; previstos: number | null };

const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

/** Os eventos da aba EVENTOS a partir das atividades, em ordem de data; as não realizadas ficam de fora. */
export function eventosDasAtividades(atividades: readonly AtividadeDoEvento[], locais: readonly NucleoDoLocal[]): LinhaDeEvento[] {
  const porId = new Map(locais.map(l => [l.id, l]));
  return [...atividades]
    .filter(a => a.status_realizacao !== "nao_realizado")
    .sort((a, b) => (a.data_inicio ?? a.data_realizacao).localeCompare(b.data_inicio ?? b.data_realizacao))
    .map(a => {
      const l = a.local_id ? porId.get(a.local_id) : undefined;
      return {
        nome: a.titulo,
        de: dataBr(a.data_inicio ?? a.data_realizacao),
        ate: dataBr(a.data_fim ?? a.data_inicio ?? a.data_realizacao),
        endereco: [l?.endereco?.trim() || l?.espaco?.trim() || a.local?.trim()].filter(Boolean).join(""),
        cidade: [l?.municipio ?? a.cidade, l?.uf ?? a.estado].filter(Boolean).join("/"),
        pais: l?.pais ?? "Brasil",
        previstos: a.meta_prevista ?? null,
      };
    });
}

/** O que falta numa turma para a grade sair completa. */
export function faltasDaTurma(t: TurmaDaGrade): string[] {
  return [
    !t.local_id ? "o núcleo" : null,
    !t.dias.length ? "os dias da semana" : null,
    !t.hora_inicio || !t.hora_fim ? "o horário" : null,
    t.alunos === null ? "a quantidade de alunos" : null,
  ].filter((x): x is string => Boolean(x));
}

/** O regime pede a grade semanal no envio (a LIE, com o documento "grade"). */
export function regimePedeGrade(regime: RegimeNormativo | null | undefined): boolean {
  return Boolean(regime && definida(regime.envio)?.documentos.some(d => d.codigo === "grade"));
}
