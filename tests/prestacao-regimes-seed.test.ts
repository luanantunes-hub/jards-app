import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DEFESO_ELEITORAL_2026, entradasDoCalendario } from "../lib/prestacao/calendario-regulatorio";
import { REGIMES } from "../lib/prestacao/regimes";
import { validarRegime } from "../lib/prestacao/regimes/schema";
import { ARQUIVO_SEED, gerarSeedRegimes } from "../lib/prestacao/regimes/seed";
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

test("os regimes do código passam no schema", () => {
  for (const regime of REGIMES) assert.deepEqual(erros(regime), [], regime.codigo);
});

test("o schema recusa parâmetro faltando ou fora do tipo", () => {
  const semPrazos: Partial<typeof ROUANET_IN29_2026> = structuredClone(ROUANET_IN29_2026);
  delete semPrazos.prazos;
  assert.match(erros(semPrazos).join("\n"), /^prazos:/m);

  const prazoTexto = structuredClone(ROUANET_IN29_2026) as unknown as { prazos: { prestacaoFinal: { quantidade: unknown } } };
  prazoTexto.prazos.prestacaoFinal.quantidade = "60";
  assert.match(erros(prazoTexto).join("\n"), /prazos\.prestacaoFinal\.quantidade/);

  const percentual = structuredClone(ROUANET_IN29_2026);
  percentual.limites.fornecedor.percentual = 120;
  assert.match(erros(percentual).join("\n"), /limites\.fornecedor\.percentual/);

  const semFonte = structuredClone(ROUANET_IN29_2026) as unknown as { limites: { fornecedor: { fonte?: unknown } } };
  delete semFonte.limites.fornecedor.fonte;
  assert.match(erros(semFonte).join("\n"), /limites\.fornecedor\.fonte/);

  const pagamento = { ...structuredClone(ROUANET_IN29_2026), pagamentos: { meiosPermitidos: ["pix"], fonte: null } };
  assert.match(erros(pagamento).join("\n"), /precisa de fonte/);

  assert.match(erros({ ...ROUANET_IN29_2026, vigenteDesde: "30/01/2026" }).join("\n"), /vigenteDesde/);
  assert.match(erros({ ...ROUANET_IN29_2026, versao: 0 }).join("\n"), /versao/);
  assert.match(erros({ ...ROUANET_IN29_2026, fontes: [{ documento: "x", url: "não é url" }] }).join("\n"), /fontes\.0\.url/);
});

test("cada valor da Rouanet tem fonte com dispositivo", () => {
  const valores = [
    ...Object.values(ROUANET_IN29_2026.prazos),
    ...Object.values(ROUANET_IN29_2026.limites),
    ROUANET_IN29_2026.contas,
    ROUANET_IN29_2026.guarda,
    ROUANET_IN29_2026.porte,
    { fonte: ROUANET_IN29_2026.pagamentos.fonte },
  ];
  for (const valor of valores) assert.ok(valor?.fonte?.dispositivo, JSON.stringify(valor).slice(0, 80));
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
