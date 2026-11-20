import assert from "node:assert/strict";
import test from "node:test";
import { lerHospedagem, lerQuarto, listaDeQuartos, movimentoDeQuarto, periodoDaHospedagem, pessoasSemQuarto, rotuloDaCama, vagasDoQuarto } from "../lib/producao/hospedagem";

test("mover pessoa: vaga no destino; mesmo lugar não muda nada; tirar sempre vale", () => {
  const q = [{ id: "q1", nome: "101", capacidade: 2 }, { id: "q2", nome: "102", capacidade: 1 }];
  const o = [{ quarto_id: "q1", pessoa_id: "p1" }, { quarto_id: "q1", pessoa_id: "p2" }, { quarto_id: "q2", pessoa_id: "p3" }];
  assert.deepEqual(movimentoDeQuarto(q, o, "p1", "q1"), { ok: true, acao: "nada" });
  assert.deepEqual(movimentoDeQuarto(q, o, "p1", null), { ok: true, acao: "tirar" });
  assert.deepEqual(movimentoDeQuarto(q, o, "p4", null), { ok: true, acao: "nada" }, "quem já está sem quarto e fica sem quarto não muda");
  assert.deepEqual(movimentoDeQuarto(q, o, "p4", "q1"), { ok: false, motivo: "O quarto 101 está completo." });
  assert.deepEqual(movimentoDeQuarto(q, o, "p1", "q2"), { ok: false, motivo: "O quarto 102 está completo." });
  const folga = [{ quarto_id: "q1", pessoa_id: "p1" }];
  assert.deepEqual(movimentoDeQuarto(q, folga, "p4", "q1"), { ok: true, acao: "pôr" });
  assert.deepEqual(movimentoDeQuarto(q, folga, "p1", "q2"), { ok: true, acao: "trocar" });
  assert.equal(movimentoDeQuarto(q, o, "p1", "q9").ok, false);
});

const base = { hotel: "Hotel Central", endereco: "", entrada: "", saida: "", localizador: "", notas: "" };

test("hospedagem: o mínimo é o hotel; saída só com entrada e não antes dela", () => {
  const minimo = lerHospedagem(base);
  assert.ok(minimo.ok);
  assert.equal(minimo.ok && minimo.hospedagem.endereco, null);
  const erro = (campos: Partial<typeof base>) => { const leitura = lerHospedagem({ ...base, ...campos }); return leitura.ok ? null : leitura.erro; };
  assert.match(erro({ hotel: " " }) ?? "", /hotel/);
  assert.match(erro({ saida: "2026-12-06" }) ?? "", /entrada/);
  assert.match(erro({ entrada: "2026-12-06", saida: "2026-12-04" }) ?? "", /antes/);
  assert.match(erro({ entrada: "06/12/2026" }) ?? "", /datas/);
  assert.match(erro({ localizador: "x".repeat(81) }) ?? "", /localizador/);
  assert.equal(erro({ entrada: "2026-12-04", saida: "2026-12-04" }), null, "entrar e sair no mesmo dia vale");
});

test("quarto: nome e capacidade de 1 a 12 (vazio vira 2)", () => {
  const padrao = lerQuarto({ nome: " 101 ", capacidade: "" });
  assert.ok(padrao.ok);
  assert.deepEqual(padrao.ok && padrao.quarto, { nome: "101", capacidade: 2, cama: null });
  assert.ok(!lerQuarto({ nome: "", capacidade: "2" }).ok);
  assert.ok(!lerQuarto({ nome: "101", capacidade: "0" }).ok);
  assert.ok(!lerQuarto({ nome: "101", capacidade: "13" }).ok);
  assert.ok(!lerQuarto({ nome: "101", capacidade: "1,5" }).ok);
});

const quartos = [{ id: "q1", nome: "101", capacidade: 2 }, { id: "q2", nome: "102", capacidade: 1 }, { id: "q10", nome: "20", capacidade: 3 }];
const ocupantes = [{ quarto_id: "q1", pessoa_id: "p2" }, { quarto_id: "q1", pessoa_id: "p1" }, { quarto_id: "q2", pessoa_id: "p3" }];
const nomes = new Map([["p1", "Ana"], ["p2", "Bruno"], ["p3", "Carla"], ["p4", "Davi"]]);

test("vagas e pessoas sem quarto", () => {
  assert.equal(vagasDoQuarto(quartos[0], ocupantes), 0);
  assert.equal(vagasDoQuarto(quartos[2], ocupantes), 3);
  assert.deepEqual(pessoasSemQuarto([{ id: "p1" }, { id: "p4" }], ocupantes), [{ id: "p4" }]);
});

test("período", () => {
  assert.equal(periodoDaHospedagem(null, null), "");
  assert.equal(periodoDaHospedagem("2026-12-04", null), "a partir de 04 dez");
  assert.equal(periodoDaHospedagem("2026-12-04", "2026-12-06"), "04 dez a 06 dez");
  assert.equal(periodoDaHospedagem("2026-12-04", "2026-12-04"), "a partir de 04 dez");
});

test("lista de quartos: ordem numérica, nomes em ordem alfabética, vago", () => {
  const texto = listaDeQuartos({ hotel: "Hotel Central", entrada: "2026-12-04", saida: "2026-12-06" }, quartos, ocupantes, nomes);
  assert.equal(texto, [
    "Hotel Central (04 dez a 06 dez)",
    "Quarto 20 (3 lugares): vago",
    "Quarto 101 (2 lugares): Ana, Bruno",
    "Quarto 102 (1 lugar): Carla",
  ].join("\n"));
});

test("cama do quarto: lista fechada, vazia vira nenhuma e o rótulo sai em português", () => {
  const sem = lerQuarto({ nome: "101", capacidade: "2" });
  assert.ok(sem.ok && sem.quarto.cama === null);
  const casal = lerQuarto({ nome: "101", capacidade: "2", cama: "casal" });
  assert.ok(casal.ok && casal.quarto.cama === "casal");
  assert.ok(!lerQuarto({ nome: "101", capacidade: "2", cama: "king" }).ok);
  assert.equal(rotuloDaCama("duas_solteiro"), "Duas camas de solteiro");
  assert.equal(rotuloDaCama(null), "");
  assert.equal(rotuloDaCama("king"), "");
});

test("a lista de quartos em texto diz a cama quando ela foi dita", () => {
  const texto = listaDeQuartos(
    { hotel: "Hotel Central", entrada: null, saida: null },
    [{ id: "q1", nome: "101", capacidade: 2, cama: "casal" }, { id: "q2", nome: "102", capacidade: 1 }],
    [], new Map(),
  );
  assert.match(texto, /Quarto 101 \(2 lugares, cama de casal\): vago/);
  assert.match(texto, /Quarto 102 \(1 lugar\): vago/);
});
