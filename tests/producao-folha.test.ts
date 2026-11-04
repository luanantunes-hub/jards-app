import assert from "node:assert/strict";
import test from "node:test";
import { agoraEProximo } from "../lib/producao/folha";

const bloco = (id: string, inicio: string | null, fim: string | null) => ({ id, inicio, fim });
const blocos = [
  bloco("carga", "2026-12-05T12:00:00.000Z", "2026-12-05T15:00:00.000Z"),
  bloco("montagem", "2026-12-05T15:00:00.000Z", "2026-12-05T20:00:00.000Z"),
  bloco("jantar", "2026-12-05T22:00:00.000Z", null),
  bloco("sessao", "2026-12-06T00:00:00.000Z", "2026-12-06T01:30:00.000Z"),
  bloco("a-definir", null, null),
];
const em = (iso: string) => Date.parse(iso);

test("antes do primeiro bloco: nada agora, o primeiro é o próximo", () => {
  const { agora, proximo } = agoraEProximo(blocos, em("2026-12-05T10:00:00.000Z"));
  assert.equal(agora, null);
  assert.equal(proximo?.id, "carga");
});

test("dentro de um bloco: ele é o agora, o seguinte é o próximo; o início conta e o fim não", () => {
  assert.deepEqual([agoraEProximo(blocos, em("2026-12-05T13:00:00.000Z")).agora?.id, agoraEProximo(blocos, em("2026-12-05T13:00:00.000Z")).proximo?.id], ["carga", "montagem"]);
  assert.equal(agoraEProximo(blocos, em("2026-12-05T15:00:00.000Z")).agora?.id, "montagem", "no instante em que um termina e outro começa, vale o que começa");
});

test("entre dois blocos, ou depois de um sem fim, não há agora; o próximo é o seguinte", () => {
  const entre = agoraEProximo(blocos, em("2026-12-05T21:00:00.000Z"));
  assert.equal(entre.agora, null);
  assert.equal(entre.proximo?.id, "jantar");
  const depoisDoJantar = agoraEProximo(blocos, em("2026-12-05T22:30:00.000Z"));
  assert.equal(depoisDoJantar.agora, null, "bloco sem fim nunca é 'agora'");
  assert.equal(depoisDoJantar.proximo?.id, "sessao");
});

test("depois do último bloco: nada agora, nada a seguir; o 'a definir' não entra", () => {
  const { agora, proximo } = agoraEProximo(blocos, em("2026-12-06T03:00:00.000Z"));
  assert.equal(agora, null);
  assert.equal(proximo, null);
  assert.deepEqual(agoraEProximo([bloco("so-a-definir", null, null)], em("2026-12-05T10:00:00.000Z")), { agora: null, proximo: null });
});

test("a página Minha folha só fala com o banco pelas funções da pessoa convidada, nunca por uma tabela", async () => {
  const { readFile } = await import("node:fs/promises");
  const pagina = await readFile("app/minha-folha/page.tsx", "utf8");
  assert.doesNotMatch(pagina, /\.from\(/, "a pessoa convidada não é membro: tabela nenhuma lhe responde, só as funções fn_equipe_*");
  const funcoes = [...pagina.matchAll(/chamar\("(\w+)"/g)].map(m => m[1]).sort();
  assert.deepEqual([...new Set(funcoes)], ["fn_equipe_aceitar", "fn_equipe_folha", "fn_equipe_minhas_datas", "fn_equipe_responder"]);
});
