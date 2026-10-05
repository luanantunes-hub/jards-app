import assert from "node:assert/strict";
import test from "node:test";
import { PASSOS, comEstado, ordemDosPassos, proximoPasso, type PassoId } from "../lib/onboarding/primeiros-passos";

const ids = (objetivo: string | null) => ordemDosPassos(objetivo).map(passo => passo.id);

test("o objetivo do questionário define a ordem dos passos", () => {
  assert.deepEqual(ids("captar_patrocinio"), ["projeto", "empresa", "negociacao", "atividade", "edital"]);
  assert.equal(ids("encontrar_editais")[1], "edital");
  assert.equal(ids("organizar_pipeline")[0], "empresa");
});

test("objetivo ausente ou sem ordem própria usa a ordem de captação", () => {
  assert.deepEqual(ids(null), ids("captar_patrocinio"));
  assert.deepEqual(ids("prestar_contas"), ids("captar_patrocinio"));
});

test("toda ordem tem os cinco passos, sem repetir", () => {
  for (const objetivo of ["captar_patrocinio", "encontrar_editais", "organizar_pipeline", "gerir_projetos"]) {
    assert.deepEqual([...ids(objetivo)].sort(), Object.keys(PASSOS).sort(), objetivo);
  }
});

test("o próximo passo é o primeiro pendente na ordem sugerida, mesmo feito fora de ordem", () => {
  const passos = comEstado(ordemDosPassos("captar_patrocinio"), new Set<PassoId>(["projeto", "negociacao"]));
  assert.equal(proximoPasso(passos)?.id, "empresa");
  assert.equal(passos.filter(passo => passo.feito).length, 2);
});

test("com tudo feito não há próximo passo", () => {
  const passos = comEstado(ordemDosPassos(null), new Set(Object.keys(PASSOS) as PassoId[]));
  assert.equal(proximoPasso(passos), null);
});

test("passo pendente abre o cadastro; passo feito leva à lista", () => {
  assert.equal(PASSOS.negociacao.href, "/captacoes?novo=1");
  assert.equal(PASSOS.negociacao.hrefFeito, "/captacoes");
  for (const passo of Object.values(PASSOS)) assert.ok(!passo.hrefFeito.includes("novo=1"), passo.id);
});
