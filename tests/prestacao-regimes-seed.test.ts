import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DEFESO_ELEITORAL_2026, entradasDoCalendario } from "../lib/prestacao/calendario-regulatorio";
import { REGIMES } from "../lib/prestacao/regimes";
import { validarRegime } from "../lib/prestacao/regimes/schema";
import { ARQUIVO_SEED, CODIGOS_DO_SEED, SEED_ANTERIOR, gerarSeedRegimes } from "../lib/prestacao/regimes/seed";
import { ROUANET_IN29_2026 } from "../lib/prestacao/regimes/rouanet-in29-2026";

const MIGRATION = "supabase/migrations/20261005150000_prestacao_regimes.sql";

const erros = (valor: unknown) => {
  const r = validarRegime(valor);
  return r.ok ? [] : r.erros;
};

test("o seed versionado está igual ao código", async () => {
  const arquivo = await readFile(ARQUIVO_SEED, "utf8");
  assert.equal(arquivo, gerarSeedRegimes(), "rode: npx tsx scripts/prestacao-gerar-seed-regimes.ts");
});

test("o regime fora do seed novo está publicado, igual, na migration anterior", async () => {
  const anterior = await readFile(SEED_ANTERIOR, "utf8");
  const publicados = new Map([...anterior.matchAll(/\$regime\$(.*?)\$regime\$/g)].map(m => {
    const regime = JSON.parse(m[1]) as { codigo: string };
    return [regime.codigo, regime];
  }));
  for (const regime of REGIMES) {
    const publicado = publicados.get(regime.codigo) as { versao: number } | undefined;
    if (CODIGOS_DO_SEED.includes(regime.codigo)) {
      assert.ok((publicado?.versao ?? 0) < regime.versao, `${regime.codigo}: suba a versão para publicar de novo`);
    } else {
      assert.deepEqual(publicado, JSON.parse(JSON.stringify(regime)), `${regime.codigo} mudou: suba a versão e inclua em CODIGOS_DO_SEED`);
    }
  }
});

test("os regimes do código passam no schema", () => {
  for (const regime of REGIMES) assert.deepEqual(erros(regime), [], regime.codigo);
});

test("o schema recusa parâmetro faltando, fora do tipo ou sem fonte", () => {
  const semPrazos: Partial<typeof ROUANET_IN29_2026> = structuredClone(ROUANET_IN29_2026);
  delete semPrazos.prazos;
  assert.match(erros(semPrazos).join("\n"), /^prazos:/m);

  const semDimensao: Partial<typeof ROUANET_IN29_2026> = structuredClone(ROUANET_IN29_2026);
  delete semDimensao.contas;
  assert.match(erros(semDimensao).join("\n"), /^contas:/m, "dimensão ausente não passa: precisa das regras ou da lacuna");

  const prazoTexto = structuredClone(ROUANET_IN29_2026) as unknown as { prazos: { prestacaoFinal: { quantidade: unknown } } };
  prazoTexto.prazos.prestacaoFinal.quantidade = "60";
  assert.match(erros(prazoTexto).join("\n"), /prazos\.prestacaoFinal\.quantidade/);

  const percentual = structuredClone(ROUANET_IN29_2026);
  percentual.fornecedores.limites[0].faixas[0].percentual = 120;
  assert.match(erros(percentual).join("\n"), /fornecedores\.limites\.0\.faixas\.0\.percentual/);

  const semFonte = structuredClone(ROUANET_IN29_2026) as unknown as { orcamento: { tetos: { fonte?: unknown }[] } };
  delete semFonte.orcamento.tetos[0].fonte;
  assert.match(erros(semFonte).join("\n"), /orcamento\.tetos\.0\.fonte/);

  const lacunaSemFonte = { ...structuredClone(ROUANET_IN29_2026), porte: { lacuna: "norma_silente", motivo: "não diz" } };
  assert.match(erros(lacunaSemFonte).join("\n"), /^porte\.fonte/m, "lacuna também precisa de fonte");

  const grupoInexistente = structuredClone(ROUANET_IN29_2026);
  grupoInexistente.orcamento.tetos[0].grupos = ["inexistente"];
  assert.match(erros(grupoInexistente).join("\n"), /orcamento\.tetos\.0\.grupos: grupo "inexistente" não está em orcamento\.grupos/);

  const prazoInexistente = structuredClone(ROUANET_IN29_2026) as unknown as { alteracoes: { prazoAnalise: string } };
  prazoInexistente.alteracoes.prazoAnalise = "naoExiste";
  assert.match(erros(prazoInexistente).join("\n"), /alteracoes\.prazoAnalise: prazo "naoExiste" não existe em prazos/);

  assert.match(erros({ ...ROUANET_IN29_2026, vigenteDesde: "30/01/2026" }).join("\n"), /vigenteDesde/);
  assert.match(erros({ ...ROUANET_IN29_2026, versao: 0 }).join("\n"), /versao/);
  assert.match(erros({ ...ROUANET_IN29_2026, fontes: [{ documento: "x", url: "não é url" }] }).join("\n"), /fontes\.0\.url/);
});

test("calendário: feriados nacionais de 2026 e 2027 com fonte, e o defeso de 2026", () => {
  const entradas = entradasDoCalendario();
  for (const ano of ["2026", "2027"]) {
    const doAno = entradas.filter(e => e.tipo !== "defeso_eleitoral" && e.inicio.startsWith(ano));
    assert.equal(doAno.length, 13, ano);
  }
  for (const e of entradas) assert.ok(e.fonte.length > 0, `${e.descricao} sem fonte`);
  const datas = new Set(entradas.map(e => e.inicio));
  for (const data of ["2026-02-16", "2026-04-03", "2026-06-04", "2026-11-20", "2027-02-09", "2027-03-26", "2027-05-27"]) {
    assert.ok(datas.has(data), data);
  }
  assert.deepEqual([DEFESO_ELEITORAL_2026.inicio, DEFESO_ELEITORAL_2026.fim], ["2026-07-04", "2026-10-04"]);
});

test("tabelas: só o super admin escreve, logados leem os publicados", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  assert.match(sql, /alter table public\.prestacao_regimes enable row level security/);
  assert.match(sql, /alter table public\.calendario_regulatorio enable row level security/);
  assert.match(sql, /using \(status = 'publicado' or public\.is_jards_super_admin\(\)\)/);
  assert.equal((sql.match(/using \(public\.is_jards_super_admin\(\)\)\s+with check \(public\.is_jards_super_admin\(\)\)/g) ?? []).length, 2);
  assert.match(sql, /on public\.prestacao_regimes \(codigo\) where status = 'publicado'/);
  assert.match(sql, /revoke all on public\.prestacao_regimes from anon/);
  assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /\bdrop\b/i);
});
