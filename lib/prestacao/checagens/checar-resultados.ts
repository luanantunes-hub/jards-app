// Análise por resultados (P9.2), onde o regime a traz (na saúde, Anexo
// LXXXVI-A, art. 81, § 3º, e art. 88; regra analise_por_resultados): o
// Ministério analisa primeiro as metas, e o financeiro só quando uma meta não
// é cumprida ou por amostragem. Com meta abaixo do previsto, uma pendência
// avisa que o financeiro também vai ser examinado. Cada meta abaixo do
// previsto já tem a sua pendência (META_ABAIXO_DO_PREVISTO).

import { regraDoRegime } from "../regimes";
import { novoAchado, type Achado, type EstadoDaPrestacao } from "./catalogo";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function checarResultados(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const regra = regraDoRegime(regime, "analise_por_resultados");
  if (!regra) return [];
  const abaixo = (estado.metas ?? []).filter(m =>
    m.previsto !== null && m.previsto !== undefined && m.realizado !== null && m.realizado !== undefined && Number(m.realizado) < Number(m.previsto));
  if (!abaixo.length) return [];
  const semJustificativa = abaixo.filter(m => !m.justificativa?.trim()).length;
  const nomes = abaixo.slice(0, 3).map(m => `"${m.descricao}"`).join(", ") + (abaixo.length > 3 ? " e outras" : "");
  return [novoAchado(regime, {
    codigo: "ANALISE_FINANCEIRA_PELA_META",
    severidade: "alerta",
    entidade: { tipo: "prestacao", id: null },
    ref: "metas",
    mensagem: `${plural(abaixo.length, "meta ficou", "metas ficaram")} abaixo do previsto (${nomes}): na análise por resultados, o financeiro também é examinado quando uma meta não é cumprida. Justifique ${abaixo.length === 1 ? "a meta" : "cada meta"}${semJustificativa ? ` (${semJustificativa} sem justificativa)` : ""} e deixe as despesas, os pagamentos e o extrato em ordem.`,
    dados: { metas: abaixo.length, sem_justificativa: semJustificativa },
    fonte: { ...regra.fonte },
  })];
}
