import assert from "node:assert/strict";
import test from "node:test";
import { CODIGO_DO_LINK_DE_PEDIDOS, lerConvidado, lerCorte, lerPedido, lerTipo, mensagemDoErroDeConvidado, mensagemDoLinkDePedidos, resumoDosConvidados, saldoDosTipos, type ConvidadoDaSessao, type TipoDeCredencial } from "../lib/producao/convidados";

const tipos: TipoDeCredencial[] = [
  { id: "t1", nome: "Imprensa", cota_por_sessao: 3, arquivado: false },
  { id: "t2", nome: "Elenco", cota_por_sessao: null, arquivado: false },
  { id: "t3", nome: "Antigo", cota_por_sessao: 5, arquivado: true },
  { id: "t4", nome: "Parceiros", cota_por_sessao: 2, arquivado: false },
];
const convidado = (id: string, tipo_id: string, quantidade: number, situacao: ConvidadoDaSessao["situacao"]): ConvidadoDaSessao => ({ id, tipo_id, nome: id, afiliacao: null, quantidade, situacao });

test("saldo: recusado não conta; cota cheia, livre, estourada e sem cota; arquivado só se em uso; ordem alfabética", () => {
  const lista = [convidado("a", "t1", 2, "confirmado"), convidado("b", "t1", 1, "recusado"), convidado("c", "t4", 3, "pedido"), convidado("d", "t2", 9, "confirmado"), convidado("e", "t3", 1, "pedido")];
  const saldos = saldoDosTipos(tipos, lista);
  assert.deepEqual(saldos.map(s => [s.nome, s.usados, s.saldo, s.estado]), [
    ["Antigo", 1, 4, "livre"], ["Elenco", 9, null, "sem_cota"], ["Imprensa", 2, 1, "livre"], ["Parceiros", 3, -1, "estourada"],
  ]);
  const cheia = saldoDosTipos(tipos, [convidado("a", "t1", 3, "pedido")]).find(s => s.nome === "Imprensa");
  assert.equal(cheia?.estado, "cheia");
  assert.equal(saldoDosTipos(tipos, []).some(s => s.nome === "Antigo"), false, "tipo arquivado sem uso some");
});

test("resumo: lugares por situação, não só pessoas", () => {
  assert.deepEqual(resumoDosConvidados([convidado("a", "t1", 2, "confirmado"), convidado("b", "t1", 1, "pedido"), convidado("c", "t2", 4, "recusado")]), { confirmados: 2, pedidos: 1, recusados: 4, linhas: 3 });
});

test("tipo: nome obrigatório, cota vazia é sem limite, e só inteiros de 0 a 5000", () => {
  assert.deepEqual(lerTipo({ nome: "  Imprensa ", cota: "" }), { ok: true, valor: { nome: "Imprensa", cota_por_sessao: null } });
  assert.deepEqual(lerTipo({ nome: "Elenco", cota: "0" }), { ok: true, valor: { nome: "Elenco", cota_por_sessao: 0 } });
  const erro = (campos: { nome: string; cota: string }) => { const l = lerTipo(campos); return l.ok ? null : l.campo; };
  assert.equal(erro({ nome: " ", cota: "" }), "nome");
  assert.equal(erro({ nome: "x".repeat(61), cota: "" }), "nome");
  assert.equal(erro({ nome: "ok", cota: "-1" }), "cota");
  assert.equal(erro({ nome: "ok", cota: "2,5" }), "cota");
  assert.equal(erro({ nome: "ok", cota: "5001" }), "cota");
});

test("convidado: nome, tipo e de 1 a 20 lugares; afiliação vazia vira nulo", () => {
  assert.deepEqual(lerConvidado({ nome: " Rita ", afiliacao: " ", quantidade: "2", tipoId: "t1" }), { ok: true, valor: { nome: "Rita", afiliacao: null, quantidade: 2, tipo_id: "t1" } });
  const erro = (campos: { nome: string; afiliacao: string; quantidade: string; tipoId: string }) => { const l = lerConvidado(campos); return l.ok ? null : l.campo; };
  const base = { nome: "Rita", afiliacao: "Jornal", quantidade: "1", tipoId: "t1" };
  assert.equal(erro({ ...base, nome: "" }), "nome");
  assert.equal(erro({ ...base, nome: "x".repeat(121) }), "nome");
  assert.equal(erro({ ...base, afiliacao: "x".repeat(121) }), "afiliacao");
  assert.equal(erro({ ...base, tipoId: "" }), "tipo");
  assert.equal(erro({ ...base, quantidade: "0" }), "quantidade");
  assert.equal(erro({ ...base, quantidade: "21" }), "quantidade");
  assert.equal(erro({ ...base, quantidade: "1,5" }), "quantidade");
});

test("pedido por link: quem pede, o convidado, o tipo e os lugares; o campo escondido é robô", () => {
  const base = { solicitante: " Marta ", nome: " Rita ", afiliacao: " ", quantidade: 2, tipo_id: "t1", site: "" };
  assert.deepEqual(lerPedido(base), { ok: true, valor: { solicitante: "Marta", nome: "Rita", afiliacao: null, quantidade: 2, tipo_id: "t1" } });
  assert.deepEqual(lerPedido({ ...base, site: "http://spam.example" }), { ok: "armadilha" });
  const campo = (extra: Record<string, unknown>) => { const l = lerPedido({ ...base, ...extra }); return l.ok === true ? null : l.ok === false ? l.campo : "armadilha"; };
  assert.equal(campo({ solicitante: " " }), "solicitante");
  assert.equal(campo({ solicitante: "x".repeat(121) }), "solicitante");
  assert.equal(campo({ nome: "" }), "nome");
  assert.equal(campo({ tipo_id: "" }), "tipo");
  assert.equal(campo({ quantidade: 0 }), "quantidade");
  assert.equal(campo({ quantidade: "abc" }), "quantidade");
  assert.ok(CODIGO_DO_LINK_DE_PEDIDOS.test("A".repeat(43)) && !CODIGO_DO_LINK_DE_PEDIDOS.test("A".repeat(44)));
});

test("corte: formato, futuro e até um ano", () => {
  const agora = new Date("2026-12-01T12:00:00").getTime();
  assert.equal(lerCorte("", agora).ok, false);
  assert.equal(lerCorte("2026-12-03", agora).ok, false);
  assert.equal(lerCorte("2026-12-01T11:00", agora).ok, false);
  assert.equal(lerCorte("2028-01-01T10:00", agora).ok, false);
  const ok = lerCorte("2026-12-03T18:00", agora);
  assert.equal(ok.ok, true);
  assert.equal(ok.ok && ok.iso, new Date("2026-12-03T18:00").toISOString());
});

test("mensagem do link de pedidos", () => {
  assert.equal(mensagemDoLinkDePedidos({ sessao: "Peça de abertura, 05/12", corte: "03/12 às 18:00", url: "https://x.test/convidar/abc" }),
    "Oi! Para pedir convidados para Peça de abertura, 05/12, use este link até 03/12 às 18:00: https://x.test/convidar/abc\nEscolha o tipo de credencial e escreva o nome de cada convidado; a produção confirma depois.");
});

test("erros do banco viram frases claras", () => {
  assert.match(mensagemDoErroDeConvidado({ code: "23514", message: "cota_excedida" }), /cota desse tipo já está cheia/);
  assert.match(mensagemDoErroDeConvidado({ code: "23514", message: "tipo_arquivado" }), /arquivado/);
  assert.match(mensagemDoErroDeConvidado({ code: "23505" }), /Já existe um tipo/);
  assert.match(mensagemDoErroDeConvidado({ code: "23503" }), /Arquive/);
  assert.match(mensagemDoErroDeConvidado({ code: "42501" }), /Você não pode/);
  assert.match(mensagemDoErroDeConvidado({}), /Tente de novo/);
});
