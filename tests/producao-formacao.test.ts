import assert from "node:assert/strict";
import test from "node:test";
import { frequenciaDaMatricula, lerAula, lerMatricula, lerTurma, mensagemDoErroDeFormacao, podeCertificar, vagasDaTurma, type AulaDaTurma, type Presenca } from "../lib/producao/formacao";

const aula = (id: string, dia: string): AulaDaTurma => ({ id, dia, inicio: "10:00", fim: "12:00", tema: null });
const aulas = [aula("a1", "2026-11-01"), aula("a2", "2026-11-08"), aula("a3", "2026-11-15"), aula("a4", "2026-12-01")];
const presencas: Presenca[] = [
  { aula_id: "a1", matricula_id: "m1", presente: true }, { aula_id: "a2", matricula_id: "m1", presente: true }, { aula_id: "a3", matricula_id: "m1", presente: false }, { aula_id: "a4", matricula_id: "m1", presente: true },
  { aula_id: "a1", matricula_id: "m2", presente: true },
];

test("frequência: só conta aulas até hoje (a de hoje conta) e presenças marcadas como presente", () => {
  const f = frequenciaDaMatricula(aulas, presencas, "m1", "2026-11-20");
  assert.deepEqual(f, { realizadas: 3, presentes: 2, percentual: (100 * 2) / 3 });
  assert.equal(frequenciaDaMatricula(aulas, presencas, "m1", "2026-11-15").realizadas, 3, "a aula de hoje conta, como no banco");
  assert.deepEqual(frequenciaDaMatricula(aulas, presencas, "m2", "2026-11-20"), { realizadas: 3, presentes: 1, percentual: (100 * 1) / 3 });
  assert.deepEqual(frequenciaDaMatricula(aulas, presencas, "m1", "2026-10-01"), { realizadas: 0, presentes: 0, percentual: null });
});

test("certificado: a mesma regra do banco, com o motivo em palavras", () => {
  const turma = { situacao: "em_andamento" as const, frequencia_minima: 75 };
  const bom = { realizadas: 4, presentes: 3, percentual: 75 };
  assert.deepEqual(podeCertificar(turma, { situacao: "confirmado", certificado_emitido_em: null }, bom), { ok: true });
  const motivo = (t: typeof turma | { situacao: "cancelada"; frequencia_minima: number }, m: { situacao: "inscrito" | "confirmado" | "desistente"; certificado_emitido_em: string | null }, f: typeof bom | { realizadas: number; presentes: number; percentual: number | null }) => { const r = podeCertificar(t, m, f); return r.ok ? "ok" : r.motivo; };
  assert.equal(motivo(turma, { situacao: "confirmado", certificado_emitido_em: "2026-11-20T10:00:00Z" }, bom), "ja_emitido");
  assert.equal(motivo({ situacao: "cancelada", frequencia_minima: 75 }, { situacao: "confirmado", certificado_emitido_em: null }, bom), "turma_cancelada");
  assert.equal(motivo(turma, { situacao: "inscrito", certificado_emitido_em: null }, bom), "nao_confirmada");
  assert.equal(motivo(turma, { situacao: "confirmado", certificado_emitido_em: null }, { realizadas: 0, presentes: 0, percentual: null }), "sem_aulas");
  assert.equal(motivo(turma, { situacao: "confirmado", certificado_emitido_em: null }, { realizadas: 4, presentes: 2, percentual: 50 }), "frequencia_insuficiente");
});

test("vagas: desistente não ocupa; turma sem limite não tem livres", () => {
  const lista = [{ situacao: "confirmado" as const }, { situacao: "inscrito" as const }, { situacao: "desistente" as const }];
  assert.deepEqual(vagasDaTurma({ vagas: 5 }, lista), { ocupadas: 2, livres: 3 });
  assert.deepEqual(vagasDaTurma({ vagas: null }, lista), { ocupadas: 2, livres: null });
});

test("turma, aula e matrícula: o que o banco confere", () => {
  const base = { nome: " Oficina ", inicio: "2026-11-01", fim: "2026-12-01", vagas: "", frequencia: "75", situacao: "aberta" as const, notas: " " };
  assert.deepEqual(lerTurma(base), { ok: true, valor: { nome: "Oficina", inicio: "2026-11-01", fim: "2026-12-01", vagas: null, frequencia_minima: 75, situacao: "aberta", notas: null } });
  const campoT = (extra: Partial<typeof base>) => { const l = lerTurma({ ...base, ...extra }); return l.ok ? null : l.campo; };
  assert.equal(campoT({ nome: "" }), "nome");
  assert.equal(campoT({ fim: "2026-10-01" }), "fim");
  assert.equal(campoT({ vagas: "0" }), "vagas");
  assert.equal(campoT({ frequencia: "101" }), "frequencia");
  assert.equal(campoT({ frequencia: "" }), "frequencia");
  assert.equal(campoT({ notas: "x".repeat(301) }), "notas");
  assert.deepEqual(lerAula({ dia: "2026-11-01", inicio: "10:00", fim: "12:00", tema: "" }), { ok: true, valor: { dia: "2026-11-01", inicio: "10:00", fim: "12:00", tema: null } });
  assert.equal(lerAula({ dia: "", inicio: "10:00", fim: "12:00", tema: "" }).ok, false);
  assert.equal(lerAula({ dia: "2026-11-01", inicio: "12:00", fim: "10:00", tema: "" }).ok, false);
  assert.deepEqual(lerMatricula({ nome: " Ana ", email: " ANA@x.test ", telefone: "", situacao: "inscrito" }), { ok: true, valor: { nome: "Ana", email: "ana@x.test", telefone: null, situacao: "inscrito" } });
  const campoM = (extra: Partial<{ nome: string; email: string; telefone: string }>) => { const l = lerMatricula({ nome: "Ana", email: "", telefone: "", situacao: "inscrito", ...extra }); return l.ok ? null : l.campo; };
  assert.equal(campoM({ nome: " " }), "nome");
  assert.equal(campoM({ email: "sem-arroba" }), "email");
  assert.equal(campoM({ telefone: "123" }), "telefone");
});

test("erros do banco viram frases claras", () => {
  assert.match(mensagemDoErroDeFormacao({ message: "vagas_esgotadas" }), /vagas da turma acabaram/);
  assert.match(mensagemDoErroDeFormacao({ message: "frequencia_insuficiente" }), /abaixo da mínima/);
  assert.match(mensagemDoErroDeFormacao({ message: "matricula_nao_confirmada" }), /confirmada/);
  assert.match(mensagemDoErroDeFormacao({ message: "turma_cancelada" }), /cancelada/);
  assert.match(mensagemDoErroDeFormacao({ message: "sem_aulas_realizadas" }), /Ainda não houve aula/);
  assert.match(mensagemDoErroDeFormacao({ code: "23505", message: 'duplicate key value violates unique constraint "producao_matriculas_email_idx"' }), /e-mail/);
  assert.match(mensagemDoErroDeFormacao({ code: "23505", message: "producao_turma_aulas_unica_key" }), /aula neste dia/);
  assert.match(mensagemDoErroDeFormacao({ code: "42501" }), /Você não pode/);
});
