// Produção no CMD (P9.5). No Pronon e no Pronas/PCD, o projeto de serviços
// médico-assistenciais registra a produção só no Conjunto Mínimo de Dados
// (Anexo LXXXVI-A da PRC 5/2017, art. 74, § 2º; Portaria GM/MS 8.031/2025,
// art. 3º), e a prestação final leva as informações lançadas (minuta do Termo
// de Compromisso, cl. 6ª, subcl. 5ª, XII). Aqui fica a contagem por
// competência, ligada à meta quando houver: nenhum dado de paciente. Os
// projetos de formação e de pesquisa não registram no CMD. Sem React e sem
// Supabase.

import type { ModalidadeSaude, PrestacaoMeta, PrestacaoProducaoCmd } from "@/lib/supabase/types";

export const MODALIDADES_SAUDE: readonly { valor: ModalidadeSaude; rotulo: string; descricao: string }[] = [
  { valor: "assistencial", rotulo: "Serviços médico-assistenciais", descricao: "Registra a produção no CMD." },
  { valor: "formacao", rotulo: "Formação e aperfeiçoamento", descricao: "Formação, treinamento e aperfeiçoamento de recursos humanos; sem produção no CMD." },
  { valor: "pesquisa", rotulo: "Pesquisa", descricao: "Pesquisa clínica, epidemiológica ou experimental; sem produção no CMD." },
];

/** Só o projeto médico-assistencial registra no CMD; sem a modalidade informada, vale ele. */
export const registraCmd = (modalidade: ModalidadeSaude | null | undefined) => (modalidade ?? "assistencial") === "assistencial";

export type ProducaoDoCmd = Pick<PrestacaoProducaoCmd, "id" | "competencia" | "meta_id" | "quantidade"> & Partial<Pick<PrestacaoProducaoCmd, "protocolo" | "observacoes">>;

/** "2026-09-01" vira "09/2026". */
export function rotuloDaCompetencia(competencia: string): string {
  const [ano, mes] = competencia.slice(0, 7).split("-");
  return `${mes}/${ano}`;
}

/** "09/2026", "9/2026" ou "2026-09" viram "2026-09-01"; o resto, null. */
export function competenciaDoTexto(texto: string): string | null {
  const t = texto.trim();
  const br = /^(\d{1,2})\/(\d{4})$/.exec(t);
  const iso = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(t);
  const [ano, mes] = br ? [Number(br[2]), Number(br[1])] : iso ? [Number(iso[1]), Number(iso[2])] : [0, 0];
  if (!ano || mes < 1 || mes > 12 || ano < 2000 || ano > 2100) return null;
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

/** O primeiro dia do mês de uma data "AAAA-MM-DD". */
export const mesDe = (data: string) => `${data.slice(0, 7)}-01`;

/** O mesmo que o banco confere antes de gravar. */
export function erroDaProducao(p: { competencia: string | null; quantidade: number | null; protocolo?: string | null; observacoes?: string | null }): string | null {
  if (!p.competencia) return "Informe a competência, no formato MM/AAAA.";
  if (p.quantidade === null || !Number.isInteger(p.quantidade) || p.quantidade < 1) return "Informe a quantidade registrada, um número inteiro a partir de 1.";
  if (p.quantidade > 10_000_000) return "A quantidade vai até 10 milhões por linha.";
  if ((p.protocolo ?? "").length > 120) return "O protocolo tem até 120 caracteres.";
  if ((p.observacoes ?? "").length > 1000) return "As observações têm até 1.000 caracteres.";
  return null;
}

export type MetaDoCmd = Pick<PrestacaoMeta, "id" | "descricao" | "unidade" | "previsto" | "realizado">;

export type ResumoDoCmd = {
  total: number;
  /** Competências distintas, da mais antiga à mais recente. */
  competencias: string[];
  /** Por meta ligada: o registrado no CMD e o realizado informado na meta. */
  porMeta: { meta: MetaDoCmd; registrado: number; linhas: number }[];
  /** O registrado sem meta ligada. */
  semMeta: number;
};

export function resumoDoCmd(producao: readonly ProducaoDoCmd[], metas: readonly MetaDoCmd[]): ResumoDoCmd {
  const porMeta = new Map<string, { registrado: number; linhas: number }>();
  let total = 0;
  let semMeta = 0;
  for (const p of producao) {
    const q = Number(p.quantidade) || 0;
    total += q;
    const meta = p.meta_id ? metas.find(m => m.id === p.meta_id) : undefined;
    if (!meta) { semMeta += q; continue; }
    const atual = porMeta.get(meta.id) ?? { registrado: 0, linhas: 0 };
    porMeta.set(meta.id, { registrado: atual.registrado + q, linhas: atual.linhas + 1 });
  }
  return {
    total,
    competencias: [...new Set(producao.map(p => p.competencia.slice(0, 10)))].sort(),
    porMeta: metas.filter(m => porMeta.has(m.id)).map(meta => ({ meta, ...porMeta.get(meta.id)! })),
    semMeta,
  };
}

/** As competências fora dos meses da execução, com a quantidade de cada uma. */
export function competenciasForaDaExecucao(
  producao: readonly ProducaoDoCmd[],
  execucao: { data_inicio_execucao?: string | null; data_fim_execucao?: string | null },
): { competencia: string; quantidade: number; antes: boolean }[] {
  const inicio = execucao.data_inicio_execucao ? mesDe(execucao.data_inicio_execucao) : null;
  const fim = execucao.data_fim_execucao ? mesDe(execucao.data_fim_execucao) : null;
  const fora = new Map<string, { quantidade: number; antes: boolean }>();
  for (const p of producao) {
    const c = p.competencia.slice(0, 10);
    const antes = inicio !== null && c < inicio;
    if (!antes && !(fim !== null && c > fim)) continue;
    const atual = fora.get(c) ?? { quantidade: 0, antes };
    fora.set(c, { quantidade: atual.quantidade + (Number(p.quantidade) || 0), antes });
  }
  return [...fora].sort(([a], [b]) => a.localeCompare(b)).map(([competencia, v]) => ({ competencia, ...v }));
}
