// Nível da manifestação esportiva (P8.4). Na Lei de Incentivo ao Esporte o
// nível do projeto muda o limite de elaboração e captação (10%, 7% ou 5% de
// fim + meio, ou 15% com o projeto todo no N, NE ou CO, até R$ 100 mil), o
// limite de captação e quem pode receber bolsa. A Portaria 10/2026 fala em
// formação, toda a vida e excelência; a 424/2020, em educacional, participação
// e rendimento. A prestação guarda os nomes novos e cada regime lê os seus.
// Sem React e sem Supabase: serve às checagens e às telas.

import { ROTULO_DA_BASE, type BasesDoOrcamento, type TetoDoGrupo } from "./orcamento";
import { regraDoRegime, type RegimeNormativo } from "./regimes";
import type { Regra } from "./regimes/tipos";
import type { ManifestacaoEsportiva, PrestacaoLocal } from "@/lib/supabase/types";

export const NIVEIS_ESPORTIVOS: readonly ManifestacaoEsportiva[] = ["formacao", "toda_vida", "excelencia"];

export const ROTULO_DO_NIVEL: Record<ManifestacaoEsportiva, string> = {
  formacao: "formação esportiva",
  toda_vida: "esporte para toda a vida",
  excelencia: "excelência esportiva",
};

/** Nomes da Portaria 424/2020, que o regime antigo usa nos parâmetros. */
const ROTULO_ANTIGO: Record<ManifestacaoEsportiva, string> = {
  formacao: "desporto educacional",
  toda_vida: "desporto de participação",
  excelencia: "desporto de rendimento",
};

/** Parâmetro de cada nível nas regras: o nome da P10 e, depois, o da P424. */
const PARAMETROS_DO_NIVEL: Record<ManifestacaoEsportiva, readonly string[]> = {
  formacao: ["formacao", "educacional"],
  toda_vida: ["todaVida", "participacao"],
  excelencia: ["excelencia", "rendimento"],
};

/** Norte, Nordeste e Centro-Oeste, onde o limite de elaboração e captação sobe para 15%. */
const UFS_NNECO = new Set(["AC", "AP", "AM", "PA", "RO", "RR", "TO", "AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE", "DF", "GO", "MT", "MS"]);

const numero = (v: unknown): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/** O valor da regra para o nível, pelo nome novo ou pelo antigo; null quando a regra não fala do nível. */
export function parametroDoNivel(regra: Pick<Regra, "parametros"> | null, nivel: ManifestacaoEsportiva): number | null {
  const p = regra?.parametros ?? {};
  for (const chave of PARAMETROS_DO_NIVEL[nivel]) {
    const valor = numero(p[chave]);
    if (valor !== null) return valor;
  }
  return null;
}

/** O regime pede o nível quando alguma regra depende dele. */
export const regimePedeNivel = (regime: RegimeNormativo | null | undefined) =>
  Boolean(regraDoRegime(regime, "elaboracao_por_nivel") || regraDoRegime(regime, "limite_de_captacao"));

/** Os nomes dos níveis no texto do regime: os antigos quando os parâmetros são os da P424. */
export function rotulosDoNivel(regime: RegimeNormativo | null | undefined): Record<ManifestacaoEsportiva, string> {
  const p = regraDoRegime(regime, "elaboracao_por_nivel")?.parametros ?? {};
  return "educacional" in p && !("formacao" in p) ? ROTULO_ANTIGO : ROTULO_DO_NIVEL;
}

type LocalDoNivel = Pick<PrestacaoLocal, "pais" | "uf" | "status">;

/** O projeto todo executado no N, NE ou CO: todo local no Brasil, realizado ou previsto, está numa dessas UFs. */
export function soNorteNordesteCentroOeste(locais: readonly LocalDoNivel[] | null | undefined): boolean {
  const considerados = (locais ?? []).filter(l => l.status !== "nao_realizado" && (l.pais ?? "Brasil") === "Brasil");
  return considerados.length > 0 && considerados.every(l => Boolean(l.uf && UFS_NNECO.has(l.uf)));
}

export type LimiteDeElaboracao = {
  percentual: number;
  /** Em reais. */
  teto: number | null;
  /** O percentual é o do N, NE e CO, não o do nível. */
  regional: boolean;
  regra: Regra;
};

export type DadosDoNivel = {
  regime: RegimeNormativo | null;
  manifestacaoEsportiva?: ManifestacaoEsportiva | null;
  locais?: readonly LocalDoNivel[] | null;
};

/** Percentual de elaboração e captação do nível (ou do N, NE e CO) e o teto em reais; null sem o nível ou sem a regra. */
export function limiteDeElaboracao(dados: DadosDoNivel): LimiteDeElaboracao | null {
  const regra = regraDoRegime(dados.regime, "elaboracao_por_nivel");
  const nivel = dados.manifestacaoEsportiva;
  if (!regra || !nivel) return null;
  const regionalPct = numero(regra.parametros?.norteNordesteCentroOeste);
  const regional = regionalPct !== null && soNorteNordesteCentroOeste(dados.locais);
  const percentual = regional ? regionalPct : parametroDoNivel(regra, nivel);
  return percentual === null ? null : { percentual, teto: numero(regra.parametros?.teto), regional, regra };
}

/**
 * O painel de tetos do orçamento com o limite de elaboração do nível no lugar
 * do percentual geral do regime. Sem o nível, os tetos voltam como estão.
 */
export function tetosComONivel(tetos: readonly TetoDoGrupo[], bases: BasesDoOrcamento, dados: DadosDoNivel): TetoDoGrupo[] {
  const limite = limiteDeElaboracao(dados);
  const nivel = dados.manifestacaoEsportiva;
  if (!limite || !nivel) return [...tetos];
  const base = bases.porBase.valor_projeto;
  return tetos.map(t => {
    if (t.grupo !== "elaboracao" || !t.limite) return t;
    const porPercentual = base === undefined ? null : Math.round(base * limite.percentual) / 100;
    const maximo = porPercentual === null ? limite.teto : limite.teto === null ? porPercentual : Math.min(porPercentual, limite.teto);
    const criterio = limite.regional ? "projeto todo no N, NE ou CO" : rotulosDoNivel(dados.regime)[nivel];
    return {
      ...t,
      limite: {
        ...t.limite,
        percentual: limite.percentual,
        teto: limite.teto,
        maximo,
        base: `${ROTULO_DA_BASE.valor_projeto} (${criterio})`,
        severidade: limite.regra.severidade,
        proporcionalAoCaptado: false,
        norma: `${limite.regra.fonte.documento}, ${limite.regra.fonte.dispositivo}`,
      },
      excedido: maximo !== null && Math.round(t.limite.valorLimitado * 100) > Math.round(maximo * 100),
    };
  });
}
