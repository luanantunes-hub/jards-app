import assert from "node:assert/strict";
import test from "node:test";
import {
  capacidadeDoLocal, instanteNoFuso, lerEvento, lerLocal, lerSessao, lerSetor, mensagemDoErroDoEvento, partesNoFuso, proximaSessao, quandoDaSessao, situacaoDaSessao,
} from "../lib/ticketeria/eventos";

test("local: nome obrigatório, UF da lista, fuso do Brasil; vazio é \"sem\"", () => {
  assert.deepEqual(lerLocal({ nome: " Teatro Central ", endereco: "", cidade: "Sorocaba", uf: "sp", fuso: "" }),
    { ok: true, valor: { nome: "Teatro Central", endereco: null, cidade: "Sorocaba", uf: "SP", fuso: "America/Sao_Paulo" } });
  assert.equal(lerLocal({ nome: " ", endereco: "", cidade: "", uf: "", fuso: "" }).ok, false);
  assert.equal(lerLocal({ nome: "x", endereco: "", cidade: "", uf: "XX", fuso: "" }).ok, false);
  assert.equal(lerLocal({ nome: "x", endereco: "", cidade: "", uf: "", fuso: "Europe/Lisbon" }).ok, false, "só os fusos do Brasil");
});

test("setor: nome e lugares de 1 a 200.000 (aceita o ponto de milhar)", () => {
  assert.deepEqual(lerSetor({ nome: "Pista", lugares: "1.500" }), { ok: true, valor: { nome: "Pista", lugares: 1500 } });
  for (const ruim of ["0", "-3", "2,5", "abc", "200001", ""]) assert.equal(lerSetor({ nome: "Pista", lugares: ruim }).ok, false, ruim);
  assert.equal(lerSetor({ nome: "", lugares: "10" }).ok, false);
});

test("capacidade do local: a soma dos setores em uso", () => {
  assert.equal(capacidadeDoLocal([{ lugares: 300, arquivado: false }, { lugares: 80, arquivado: false }, { lugares: 50, arquivado: true }]), 380);
  assert.equal(capacidadeDoLocal([]), 0);
});

test("evento: título, descrição, imagem só em https e a classificação da lista", () => {
  assert.deepEqual(lerEvento({ titulo: " Hamlet ", descricao: "", imagem: "", classificacao: "14" }),
    { ok: true, valor: { titulo: "Hamlet", descricao: null, imagem_url: null, classificacao: "14" } });
  assert.equal(lerEvento({ titulo: "x", descricao: "", imagem: "http://a.com/b.jpg", classificacao: "" }).ok, false);
  assert.equal(lerEvento({ titulo: "x", descricao: "", imagem: "", classificacao: "13" }).ok, false);
  assert.equal(lerEvento({ titulo: "", descricao: "", imagem: "", classificacao: "" }).ok, false);
});

test("a hora digitada é a do local: Brasília, Manaus e Noronha", () => {
  assert.equal(instanteNoFuso("2026-12-05", "20:00", "America/Sao_Paulo"), "2026-12-05T23:00:00.000Z");
  assert.equal(instanteNoFuso("2026-12-05", "20:00", "America/Manaus"), "2026-12-06T00:00:00.000Z");
  assert.equal(instanteNoFuso("2026-12-05", "20:00", "America/Noronha"), "2026-12-05T22:00:00.000Z");
  assert.equal(instanteNoFuso("2026-02-30", "20:00", "America/Sao_Paulo"), null, "dia que não existe");
  assert.equal(instanteNoFuso("2026-12-05", "24:00", "America/Sao_Paulo"), null);
  assert.deepEqual(partesNoFuso("2026-12-06T00:00:00.000Z", "America/Manaus"), { dia: "2026-12-05", hora: "20:00" });
  assert.deepEqual(partesNoFuso("2026-12-06T00:00:00.000Z", "America/Sao_Paulo"), { dia: "2026-12-05", hora: "21:00" });
});

test("sessão: fim que passa da meia-noite, portas antes do início e o limite de 12 horas", () => {
  const fuso = "America/Sao_Paulo";
  assert.deepEqual(lerSessao({ dia: "2026-12-05", hora: "20:00", fim: "22:30", portas: "19:00" }, fuso),
    { ok: true, valor: { inicio: "2026-12-05T23:00:00.000Z", fim: "2026-12-06T01:30:00.000Z", abertura_portas: "2026-12-05T22:00:00.000Z" } });
  const madrugada = lerSessao({ dia: "2026-12-05", hora: "23:00", fim: "02:00", portas: "" }, fuso);
  assert.ok(madrugada.ok && madrugada.valor.fim === "2026-12-06T05:00:00.000Z", "termina no dia seguinte");
  const meiaNoite = lerSessao({ dia: "2026-12-06", hora: "00:30", fim: "", portas: "23:30" }, fuso);
  assert.ok(meiaNoite.ok && meiaNoite.valor.abertura_portas === "2026-12-06T02:30:00.000Z", "as portas abrem na véspera");
  assert.equal(lerSessao({ dia: "2026-12-05", hora: "20:00", fim: "", portas: "07:00" }, fuso).ok, false, "13 horas antes");
  assert.equal(lerSessao({ dia: "2026-12-05", hora: "20:00", fim: "20:00", portas: "" }, fuso).ok, false);
  assert.equal(lerSessao({ dia: "", hora: "20:00", fim: "", portas: "" }, fuso).ok, false);
  assert.equal(lerSessao({ dia: "2026-12-05", hora: "8h", fim: "", portas: "" }, fuso).ok, false);
});

test("situação da sessão, a próxima e o dia por extenso", () => {
  const agora = Date.parse("2026-12-06T12:00:00Z");
  const passada = { inicio: "2026-12-05T23:00:00Z", fim: null, cancelada_em: null };
  const futura = { inicio: "2026-12-07T23:00:00Z", fim: "2026-12-08T01:00:00Z", cancelada_em: null };
  const depois = { inicio: "2026-12-09T23:00:00Z", fim: null, cancelada_em: null };
  const cancelada = { inicio: "2026-12-06T23:00:00Z", fim: null, cancelada_em: "2026-12-01T00:00:00Z" };
  assert.deepEqual([passada, futura, cancelada].map(s => situacaoDaSessao(s, agora)), ["realizada", "agendada", "cancelada"]);
  assert.equal(proximaSessao([depois, passada, cancelada, futura], agora), futura);
  assert.equal(proximaSessao([passada], agora), null);
  assert.match(quandoDaSessao("2026-12-05T23:00:00Z", "America/Sao_Paulo"), /^sáb\., 5 de dez\. de 2026 · 20:00$/);
});

test("os erros do banco viram frases", () => {
  assert.match(mensagemDoErroDoEvento({ message: "local_arquivado" }), /arquivado/);
  assert.match(mensagemDoErroDoEvento({ message: "evento_publicado" }), /cancele-o/);
  assert.match(mensagemDoErroDoEvento({ code: "23503", message: "update or delete on table \"ticketeria_locais\" violates foreign key constraint \"ticketeria_sessoes_local_id_fkey\"" }), /arquive-o/);
  assert.match(mensagemDoErroDoEvento({ code: "42501" }), /não pode/);
});
