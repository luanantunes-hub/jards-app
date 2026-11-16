import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { fraseDoHistorico, rotuloDaEntidade } from "../lib/producao/historico";
import { nomeDeQuemFez, pessoasDoFiltro, agruparPorDia, AREAS_DA_LINHA_DO_TEMPO, entidadesDaArea, inicioDoPeriodo, intervaloDaPagina, recortarPagina, TAMANHO_DA_PAGINA } from "../lib/producao/linha-do-tempo";

/** As tabelas da produção com gatilho de histórico, lidas das migrations (uma tabela nova sem área nem frase reprova aqui). */
async function tabelasComHistorico(): Promise<string[]> {
  const pasta = "supabase/migrations";
  const tabelas = new Set<string>();
  for (const arquivo of await readdir(pasta)) {
    if (!arquivo.endsWith(".sql")) continue;
    for (const achado of (await readFile(`${pasta}/${arquivo}`, "utf8")).matchAll(/after insert or update or delete on public\.(producao_[a-z_]+)/g)) tabelas.add(achado[1]);
  }
  return [...tabelas].sort();
}

test("toda tabela da produção com histórico está em exatamente uma área e tem frase própria", async () => {
  const tabelas = await tabelasComHistorico();
  assert.ok(tabelas.length >= 40, "leu as migrations");
  const todas = AREAS_DA_LINHA_DO_TEMPO.flatMap(area => [...area.entidades]);
  assert.equal(new Set(todas).size, todas.length, "nenhuma entidade em duas áreas");
  for (const tabela of tabelas) {
    assert.ok(todas.includes(tabela), `${tabela}: tabela com histórico sem área na linha do tempo (lib/producao/linha-do-tempo.ts)`);
    assert.notEqual(rotuloDaEntidade(tabela), "um registro", `${tabela}: sem frase própria (COISA em lib/producao/historico.ts)`);
  }
  for (const entidade of todas) assert.ok(tabelas.includes(entidade), `${entidade} está numa área mas não tem gatilho de histórico`);
});

test("frases das tabelas novas", () => {
  assert.equal(fraseDoHistorico({ entidade: "producao_matriculas", acao: "alterou", campo: "certificado_emitido_em", antes: null, depois: "2026-11-20" }), "Mudou o certificado em uma matrícula de vazio para 20/11/2026");
  assert.equal(fraseDoHistorico({ entidade: "producao_convidados", acao: "criou", campo: null, antes: null, depois: "Rita" }), "Criou um convidado: Rita");
});

test("área e período: filtro por entidades e início do período", () => {
  assert.ok(entidadesDaArea("equipe")?.includes("producao_pessoas"));
  assert.equal(entidadesDaArea(""), null);
  assert.equal(entidadesDaArea("nao-existe"), null);
  const agora = new Date("2026-11-20T12:00:00Z").getTime();
  assert.equal(inicioDoPeriodo("7", agora), "2026-11-13T12:00:00.000Z");
  assert.equal(inicioDoPeriodo("tudo", agora), null);
  assert.equal(inicioDoPeriodo("qualquer", agora), null);
});

test("página: intervalo com uma linha a mais, e o recorte diz se há mais", () => {
  assert.deepEqual(intervaloDaPagina(0), { de: 0, ate: TAMANHO_DA_PAGINA });
  assert.deepEqual(intervaloDaPagina(2), { de: 2 * TAMANHO_DA_PAGINA, ate: 3 * TAMANHO_DA_PAGINA });
  assert.deepEqual(intervaloDaPagina(-1), { de: 0, ate: TAMANHO_DA_PAGINA });
  const cheia = Array.from({ length: TAMANHO_DA_PAGINA + 1 }, (_, i) => i);
  assert.deepEqual([recortarPagina(cheia).mostrar.length, recortarPagina(cheia).temMais], [TAMANHO_DA_PAGINA, true]);
  assert.deepEqual([recortarPagina([1, 2, 3]).mostrar.length, recortarPagina([1, 2, 3]).temMais], [3, false]);
  assert.deepEqual([recortarPagina(cheia.slice(0, TAMANHO_DA_PAGINA)).temMais], [false]);
});

test("agrupar por dia mantém a ordem e junta o mesmo dia", () => {
  const linhas = [{ quando: "2026-11-20T15:00:00", id: 1 }, { quando: "2026-11-20T09:00:00", id: 2 }, { quando: "2026-11-19T22:00:00", id: 3 }];
  const grupos = agruparPorDia(linhas);
  assert.deepEqual(grupos.map(grupo => [grupo.dia, grupo.linhas.map(linha => linha.id)]), [["2026-11-20", [1, 2]], ["2026-11-19", [3]]]);
  assert.deepEqual(agruparPorDia([]), []);
});

test("quem fez: o nome vem dos membros da organização; sem quem, ou de quem saiu, fica vazio", () => {
  const membros = [{ user_id: "u1", full_name: " Marina Alves " }, { user_id: "u2", full_name: null }];
  assert.equal(nomeDeQuemFez("u1", membros), "Marina Alves");
  assert.equal(nomeDeQuemFez("u2", membros), "");
  assert.equal(nomeDeQuemFez("saiu", membros), "");
  assert.equal(nomeDeQuemFez(null, membros), "");
  assert.equal(nomeDeQuemFez(undefined, membros), "");
});

test("o filtro por pessoa lista só quem tem nome, em ordem alfabética", () => {
  const membros = [{ user_id: "u3", full_name: "Zé Lima" }, { user_id: "u2", full_name: null }, { user_id: "u1", full_name: "Ana Souza" }, { user_id: "u4", full_name: "   " }];
  assert.deepEqual(pessoasDoFiltro(membros), [{ id: "u1", nome: "Ana Souza" }, { id: "u3", nome: "Zé Lima" }]);
});
