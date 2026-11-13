import assert from "node:assert/strict";
import test from "node:test";
import {
  CODIGO_DO_LINK_DE_VISITAS, lerAgendamento, lerHorario, lerPedidoDeVisita, mensagemDoErroDeVisita, mensagemDoLinkDeVisitas, ocupacaoDosHorarios, publicoPorDia,
  type AgendamentoDeVisita, type HorarioDeVisita,
} from "../lib/producao/visitas";

const horario = (id: string, dia: string, capacidade: number, publico_avulso: number | null = null): HorarioDeVisita => ({ id, dia, inicio: "10:00", fim: "11:00", capacidade, publico_avulso, notas: null });
const agendamento = (id: string, horario_id: string, pessoas: number, situacao: AgendamentoDeVisita["situacao"], presentes: number | null = null): AgendamentoDeVisita => ({
  id, horario_id, grupo: id, responsavel: "R", email: "a@b.com", telefone: null, pessoas, situacao, presentes, observacao: null,
});

test("ocupação: pedido e confirmado contam; recusado e cancelado não; cheio e estourado", () => {
  const horarios = [horario("h1", "2026-12-10", 30), horario("h2", "2026-12-10", 10), horario("h3", "2026-12-11", 10)];
  const lista = [agendamento("a", "h1", 20, "confirmado"), agendamento("b", "h1", 5, "pedido"), agendamento("c", "h1", 9, "recusado"), agendamento("d", "h2", 10, "confirmado"), agendamento("e", "h3", 12, "confirmado"), agendamento("f", "h3", 3, "cancelado")];
  const ocupacao = ocupacaoDosHorarios(horarios, lista);
  assert.deepEqual([ocupacao.get("h1")?.usados, ocupacao.get("h1")?.livres, ocupacao.get("h1")?.estado], [25, 5, "livre"]);
  assert.equal(ocupacao.get("h2")?.estado, "cheio");
  assert.deepEqual([ocupacao.get("h3")?.livres, ocupacao.get("h3")?.estado], [-2, "estourado"]);
});

test("público por dia: agendados, vieram (só confirmados), avulso e total", () => {
  const horarios = [horario("h1", "2026-12-10", 30, 4), horario("h2", "2026-12-10", 10, null), horario("h3", "2026-12-11", 10, 7)];
  const lista = [agendamento("a", "h1", 20, "confirmado", 18), agendamento("b", "h1", 5, "pedido", 5), agendamento("c", "h2", 8, "confirmado", null), agendamento("d", "h3", 3, "cancelado", 3)];
  assert.deepEqual(publicoPorDia(horarios, lista), [
    { dia: "2026-12-10", agendados: 33, vieram: 18, avulso: 4, total: 22 },
    { dia: "2026-12-11", agendados: 0, vieram: 0, avulso: 7, total: 7 },
  ]);
});

test("horário: dia, horas, capacidade, avulso e nota", () => {
  const base = { dia: "2026-12-10", inicio: "10:00", fim: "11:00", capacidade: "30", avulso: "", notas: "  " };
  assert.deepEqual(lerHorario(base), { ok: true, valor: { dia: "2026-12-10", inicio: "10:00", fim: "11:00", capacidade: 30, publico_avulso: null, notas: null } });
  assert.deepEqual(lerHorario({ ...base, avulso: "0", notas: " Visita guiada " }), { ok: true, valor: { dia: "2026-12-10", inicio: "10:00", fim: "11:00", capacidade: 30, publico_avulso: 0, notas: "Visita guiada" } });
  const campo = (extra: Partial<typeof base>) => { const l = lerHorario({ ...base, ...extra }); return l.ok ? null : l.campo; };
  assert.equal(campo({ dia: "" }), "dia");
  assert.equal(campo({ inicio: "" }), "inicio");
  assert.equal(campo({ fim: "10:00" }), "fim");
  assert.equal(campo({ capacidade: "0" }), "capacidade");
  assert.equal(campo({ capacidade: "5001" }), "capacidade");
  assert.equal(campo({ capacidade: "abc" }), "capacidade");
  assert.equal(campo({ avulso: "-1" }), "avulso");
  assert.equal(campo({ avulso: "100001" }), "avulso");
  assert.equal(campo({ notas: "x".repeat(301) }), "notas");
});

test("agendamento: grupo, responsável, um contato, de 1 a 500 pessoas", () => {
  const base = { grupo: " Escola Rosa ", responsavel: " Ana ", email: " ANA@Escola.Exemplo ", telefone: "", pessoas: "25", observacao: " " };
  assert.deepEqual(lerAgendamento(base), { ok: true, valor: { grupo: "Escola Rosa", responsavel: "Ana", email: "ana@escola.exemplo", telefone: null, pessoas: 25, observacao: null } });
  assert.deepEqual(lerAgendamento({ ...base, email: "", telefone: "(11) 99999-0001", pessoas: 3 }), { ok: true, valor: { grupo: "Escola Rosa", responsavel: "Ana", email: null, telefone: "(11) 99999-0001", pessoas: 3, observacao: null } });
  const campo = (extra: Partial<typeof base>) => { const l = lerAgendamento({ ...base, ...extra }); return l.ok ? null : l.campo; };
  assert.equal(campo({ grupo: " " }), "grupo");
  assert.equal(campo({ responsavel: "" }), "responsavel");
  assert.equal(campo({ email: "", telefone: "" }), "email");
  assert.equal(campo({ email: "sem-arroba" }), "email");
  assert.equal(campo({ email: "", telefone: "123" }), "telefone");
  assert.equal(campo({ pessoas: "0" }), "pessoas");
  assert.equal(campo({ pessoas: "501" }), "pessoas");
  assert.equal(campo({ observacao: "x".repeat(301) }), "observacao");
});

test("pedido pelo link: horário escolhido, concordância marcada e o campo escondido é robô", () => {
  const base = { grupo: "Escola Rosa", responsavel: "Ana", email: "ana@escola.exemplo", telefone: "", pessoas: "25", observacao: "", horario_id: "h1", concordou: true, site: "" };
  const ok = lerPedidoDeVisita(base);
  assert.equal(ok.ok === true && ok.valor.horario_id, "h1");
  assert.deepEqual(lerPedidoDeVisita({ ...base, site: "http://spam.example" }), { ok: "armadilha" });
  const campo = (extra: Record<string, unknown>) => { const l = lerPedidoDeVisita({ ...base, ...extra }); return l.ok === false ? l.campo : null; };
  assert.equal(campo({ horario_id: "" }), "horario");
  assert.equal(campo({ concordou: false }), "concordou");
  assert.equal(campo({ concordou: "true" }), "concordou", "só o booleano verdadeiro vale");
  assert.equal(campo({ grupo: "" }), "grupo");
  assert.ok(CODIGO_DO_LINK_DE_VISITAS.test("A".repeat(43)) && !CODIGO_DO_LINK_DE_VISITAS.test("A".repeat(42)));
});

test("mensagens", () => {
  assert.equal(mensagemDoLinkDeVisitas({ espaco: "Museu Central", url: "https://x.test/visita/abc" }), "Oi! Para agendar a visita do seu grupo em Museu Central, escolha o dia e o horário neste link: https://x.test/visita/abc\nA produção confirma depois.");
  assert.match(mensagemDoErroDeVisita({ code: "23514", message: "capacidade_excedida" }), /capacidade deste horário já está cheia/);
  assert.match(mensagemDoErroDeVisita({ code: "23505" }), /Já existe um horário/);
  assert.match(mensagemDoErroDeVisita({ code: "42501" }), /Você não pode/);
  assert.match(mensagemDoErroDeVisita({}), /Tente de novo/);
});
