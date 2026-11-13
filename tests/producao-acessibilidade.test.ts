import assert from "node:assert/strict";
import test from "node:test";
import { coberturaDaSessao, lerRecurso, mensagemDoErroDeAcessibilidade, type RecursoDeAcessibilidade } from "../lib/producao/acessibilidade";

const recurso = (id: string, tipo: RecursoDeAcessibilidade["tipo"], situacao: RecursoDeAcessibilidade["situacao"], lugares: number | null = null): RecursoDeAcessibilidade => ({ id, tipo, situacao, pessoa_id: null, lugares, notas: null });

test("cobertura: confirmado, só planejado e sem recurso; cancelado não conta; lugares reservados somam", () => {
  const lista = [recurso("a", "libras", "confirmado"), recurso("b", "audiodescricao", "planejado"), recurso("c", "legendagem", "cancelado"), recurso("d", "lugares_reservados", "planejado", 4), recurso("e", "lugares_reservados", "cancelado", 10), recurso("f", "outro", "confirmado")];
  assert.deepEqual(coberturaDaSessao(lista), { confirmados: ["libras"], planejados: ["audiodescricao", "lugares_reservados"], semRecurso: ["legendagem"], lugaresReservados: 4 });
  assert.deepEqual(coberturaDaSessao([]), { confirmados: [], planejados: [], semRecurso: ["libras", "audiodescricao", "legendagem", "lugares_reservados"], lugaresReservados: 0 });
  assert.deepEqual(coberturaDaSessao([recurso("a", "libras", "planejado"), recurso("b", "libras", "confirmado")]).confirmados, ["libras"], "dois recursos do mesmo tipo: basta um confirmado");
});

test("recurso: tipo obrigatório; lugares só e obrigatórios em lugares reservados; nota até 500", () => {
  const base = { tipo: "libras" as const, situacao: "planejado" as const, pessoaId: "", lugares: "", notas: "  " };
  assert.deepEqual(lerRecurso(base), { ok: true, valor: { tipo: "libras", situacao: "planejado", pessoa_id: null, lugares: null, notas: null } });
  assert.deepEqual(lerRecurso({ ...base, lugares: "7", pessoaId: "p1", notas: " Das 18h " }), { ok: true, valor: { tipo: "libras", situacao: "planejado", pessoa_id: "p1", lugares: null, notas: "Das 18h" } }, "lugares digitados em outro tipo são ignorados");
  assert.deepEqual(lerRecurso({ ...base, tipo: "lugares_reservados", lugares: "4" }), { ok: true, valor: { tipo: "lugares_reservados", situacao: "planejado", pessoa_id: null, lugares: 4, notas: null } });
  const campo = (extra: Partial<Parameters<typeof lerRecurso>[0]>) => { const l = lerRecurso({ ...base, ...extra }); return l.ok ? null : l.campo; };
  assert.equal(campo({ tipo: "" }), "tipo");
  assert.equal(campo({ tipo: "lugares_reservados", lugares: "" }), "lugares");
  assert.equal(campo({ tipo: "lugares_reservados", lugares: "0" }), "lugares");
  assert.equal(campo({ tipo: "lugares_reservados", lugares: "501" }), "lugares");
  assert.equal(campo({ tipo: "lugares_reservados", lugares: "2,5" }), "lugares");
  assert.equal(campo({ notas: "x".repeat(501) }), "notas");
});

test("erros do banco viram frases claras", () => {
  assert.match(mensagemDoErroDeAcessibilidade({ code: "42501" }), /Você não pode/);
  assert.match(mensagemDoErroDeAcessibilidade({ code: "23514", message: "pessoa_de_outra_organizacao" }), /não é da equipe/);
  assert.match(mensagemDoErroDeAcessibilidade({}), /Tente de novo/);
});
