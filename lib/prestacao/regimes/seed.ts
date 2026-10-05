// Gera o seed SQL de prestacao_regimes e calendario_regulatorio a partir do
// código (P1.1). O script scripts/prestacao-gerar-seed-regimes.ts grava o
// resultado em ARQUIVO_SEED, e um teste confere que o arquivo está igual.
//
// Mudou um parâmetro publicado? Suba `versao` no regime, aponte ARQUIVO_SEED
// para uma migration nova e rode o script: a versão anterior vira obsoleta.

import { entradasDoCalendario } from "../calendario-regulatorio";
import { REGIMES } from "./index";
import { validarRegime } from "./schema";
import type { RegimeNormativo } from "./tipos";

export const ARQUIVO_SEED = "supabase/migrations/20261005150100_prestacao_regimes_seed.sql";

function texto(valor: string | null): string {
  return valor === null ? "null" : `'${valor.replace(/'/g, "''")}'`;
}

function json(valor: unknown, marca: string): string {
  const conteudo = JSON.stringify(valor, null, 2);
  if (conteudo.includes(`$${marca}$`)) throw new Error(`O texto contém o delimitador $${marca}$`);
  return `$${marca}$${conteudo}$${marca}$::jsonb`;
}

function sqlDoRegime(regime: RegimeNormativo): string {
  return [
    `-- ${regime.nome} (versão ${regime.versao})`,
    `update public.prestacao_regimes set status = 'obsoleto'`,
    `where codigo = ${texto(regime.codigo)} and versao < ${regime.versao} and status = 'publicado';`,
    ``,
    `insert into public.prestacao_regimes`,
    `  (codigo, versao, nome, area, mecanismo, esfera, orgao, sistema_oficial, norma_referencia,`,
    `   vigente_desde, status, parametros, fontes, publicado_em)`,
    `values (`,
    `  ${texto(regime.codigo)}, ${regime.versao}, ${texto(regime.nome)}, ${texto(regime.area)}, ${texto(regime.mecanismo)},`,
    `  ${texto(regime.esfera)}, ${texto(regime.orgao)}, ${texto(regime.sistemaOficial)}, ${texto(regime.normaReferencia)},`,
    `  ${regime.vigenteDesde === null ? "null" : `${texto(regime.vigenteDesde)}::date`}, 'publicado',`,
    `  ${json(regime, "regime")},`,
    `  ${json(regime.fontes, "fontes")},`,
    `  now()`,
    `)`,
    `on conflict (codigo, versao) do nothing;`,
  ].join("\n");
}

function sqlDoCalendario(): string {
  const linhas = entradasDoCalendario().map(e =>
    `  (${texto(e.tipo)}, ${texto(e.esfera)}, ${texto(e.uf)}, ${texto(e.municipio)}, '${e.inicio}', '${e.fim}', ${texto(e.descricao)}, ${texto(e.fonte)})`);
  return [
    `insert into public.calendario_regulatorio (tipo, esfera, uf, municipio, inicio, fim, descricao, fonte)`,
    `values`,
    linhas.join(",\n"),
    `on conflict (tipo, esfera, coalesce(uf, ''), coalesce(municipio, ''), inicio) do nothing;`,
  ].join("\n");
}

export function gerarSeedRegimes(): string {
  for (const regime of REGIMES) {
    const resultado = validarRegime(regime);
    if (!resultado.ok) throw new Error(`Regime ${regime.codigo} inválido:\n${resultado.erros.join("\n")}`);
  }
  return [
    `-- Gerado por scripts/prestacao-gerar-seed-regimes.ts a partir de lib/prestacao/regimes`,
    `-- e lib/prestacao/calendario-regulatorio.ts. Não edite à mão: mude o código e`,
    `-- gere de novo. Idempotente.`,
    ``,
    ...REGIMES.map(regime => sqlDoRegime(regime) + "\n"),
    `-- Calendário: feriados nacionais e defeso eleitoral`,
    sqlDoCalendario(),
    ``,
  ].join("\n");
}
