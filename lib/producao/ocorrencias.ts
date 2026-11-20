// As ocorrências do dia (plano do módulo, PD7.8, primeiro corte): conferência do formulário com as regras do banco e o resumo do
// que ainda está em aberto. Sem tela e sem banco.

import { GRAVIDADES_DA_OCORRENCIA, TIPOS_DE_OCORRENCIA, type GravidadeDaOcorrencia, type TipoDeOcorrencia } from "@/lib/producao/estados";

export const ROTULO_DO_TIPO_DE_OCORRENCIA: Record<TipoDeOcorrencia, string> = {
  seguranca: "Segurança", saude: "Saúde", tecnica: "Técnica", publico: "Público", atraso: "Atraso", equipamento: "Equipamento", outro: "Outro",
};
export const ROTULO_DA_GRAVIDADE: Record<GravidadeDaOcorrencia, string> = { baixa: "Baixa", media: "Média", alta: "Alta" };

export type OcorrenciaLida = { tipo: TipoDeOcorrencia; gravidade: GravidadeDaOcorrencia; descricao: string; providencia: string | null };
export type LeituraDaOcorrencia = { ok: true; ocorrencia: OcorrenciaLida } | { ok: false; erro: string };

/** A ocorrência como o banco aceita (descrição de 1 a 2.000 letras; providência até 1.000; tipo e gravidade da lista). */
export function lerOcorrencia(c: { tipo: string; gravidade: string; descricao: string; providencia: string }): LeituraDaOcorrencia {
  if (!(TIPOS_DE_OCORRENCIA as readonly string[]).includes(c.tipo)) return { ok: false, erro: "Escolha o tipo da ocorrência." };
  if (!(GRAVIDADES_DA_OCORRENCIA as readonly string[]).includes(c.gravidade)) return { ok: false, erro: "Escolha a gravidade." };
  const descricao = c.descricao.trim();
  if (descricao === "") return { ok: false, erro: "Conte o que aconteceu." };
  if (descricao.length > 2000) return { ok: false, erro: "A descrição pode ter até 2.000 letras." };
  const providencia = c.providencia.trim();
  if (providencia.length > 1000) return { ok: false, erro: "A providência pode ter até 1.000 letras." };
  return { ok: true, ocorrencia: { tipo: c.tipo as TipoDeOcorrencia, gravidade: c.gravidade as GravidadeDaOcorrencia, descricao, providencia: providencia === "" ? null : providencia } };
}

const PESO: Record<GravidadeDaOcorrencia, number> = { alta: 0, media: 1, baixa: 2 };

/** As ocorrências em aberto primeiro (a mais grave antes), depois as resolvidas; dentro de cada grupo, da mais recente para a mais antiga. */
export function ordenarOcorrencias<T extends { gravidade: GravidadeDaOcorrencia; resolvida: boolean; ocorreu_em: string }>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => Number(a.resolvida) - Number(b.resolvida) || (a.resolvida ? 0 : PESO[a.gravidade] - PESO[b.gravidade]) || b.ocorreu_em.localeCompare(a.ocorreu_em));
}

/** Quantas ocorrências estão em aberto e quantas delas são de gravidade alta. */
export function resumoDasOcorrencias(lista: readonly { gravidade: GravidadeDaOcorrencia; resolvida: boolean }[]): { abertas: number; altasAbertas: number; total: number } {
  const abertas = lista.filter(item => !item.resolvida);
  return { abertas: abertas.length, altasAbertas: abertas.filter(item => item.gravidade === "alta").length, total: lista.length };
}
