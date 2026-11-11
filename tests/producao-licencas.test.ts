import assert from "node:assert/strict";
import test from "node:test";
import { avisosDaLicenca, lerLicenca, licencaEmAberto, prazoDaLicenca, resumoDasLicencas, textoDoPrazo } from "../lib/producao/licencas";

const campos = { tipo: "alvara", situacao: "a_pedir", responsavelId: "", diasAntes: "30", validade: "", protocolo: "", notas: "" };

test("o prazo é a data do evento mais os dias, e o texto diz antes ou depois", () => {
  assert.equal(prazoDaLicenca("2026-12-05", -30), "2026-11-05");
  assert.equal(prazoDaLicenca("2026-12-05", 0), "2026-12-05");
  assert.equal(prazoDaLicenca("2026-12-05", null), null);
  assert.equal(textoDoPrazo(-30), "30 dias antes da data");
  assert.equal(textoDoPrazo(-1), "1 dia antes da data");
  assert.equal(textoDoPrazo(2), "2 dias depois da data");
  assert.equal(textoDoPrazo(0), "no dia da data");
  assert.equal(textoDoPrazo(null), "sem prazo");
});

test("a licença lida tem o formato do banco: dias antes viram dias negativos", () => {
  assert.deepEqual(lerLicenca({ ...campos, protocolo: " 2026/12 ", responsavelId: "p1", validade: "2027-01-10" }),
    { ok: true, licenca: { tipo: "alvara", situacao: "a_pedir", responsavel_pessoa_id: "p1", prazo_dias: -30, validade: "2027-01-10", protocolo: "2026/12", notas: null } });
  assert.equal(lerLicenca({ ...campos, diasAntes: "" }).ok && (lerLicenca({ ...campos, diasAntes: "" }) as { licenca: { prazo_dias: number | null } }).licenca.prazo_dias, null);
  const zero = lerLicenca({ ...campos, diasAntes: "0" });
  assert.equal(zero.ok && zero.licenca.prazo_dias === 0, true, "zero dias antes é o dia da data, sem -0");
});

test("o que o banco recusaria a tela recusa antes", () => {
  assert.equal(lerLicenca({ ...campos, tipo: "passaporte" }).ok, false);
  assert.equal(lerLicenca({ ...campos, situacao: "talvez" }).ok, false);
  assert.equal(lerLicenca({ ...campos, diasAntes: "-3" }).ok, false);
  assert.equal(lerLicenca({ ...campos, diasAntes: "731" }).ok, false);
  assert.equal(lerLicenca({ ...campos, diasAntes: "730" }).ok, true);
  assert.equal(lerLicenca({ ...campos, validade: "10/01/2027" }).ok, false);
  assert.equal(lerLicenca({ ...campos, protocolo: "x".repeat(101) }).ok, false);
  assert.equal(lerLicenca({ ...campos, notas: "x".repeat(501) }).ok, false);
});

test("os avisos: prazo vencido em aberto, validade que acaba antes da data, negada", () => {
  const data = "2026-12-05";
  assert.deepEqual(avisosDaLicenca({ situacao: "a_pedir", prazo_dias: -30, validade: null }, data, "2026-11-10"), ["O prazo para pedir já passou."]);
  assert.deepEqual(avisosDaLicenca({ situacao: "pedida", prazo_dias: -30, validade: null }, data, "2026-11-10"), ["O prazo já passou e a resposta não chegou."]);
  assert.deepEqual(avisosDaLicenca({ situacao: "a_pedir", prazo_dias: -30, validade: null }, data, "2026-10-01"), []);
  assert.deepEqual(avisosDaLicenca({ situacao: "concedida", prazo_dias: -30, validade: "2026-12-01" }, data, "2026-11-10"), ["A validade acaba antes do dia da data."]);
  assert.deepEqual(avisosDaLicenca({ situacao: "concedida", prazo_dias: null, validade: "2026-12-05" }, data, "2026-11-10"), []);
  assert.deepEqual(avisosDaLicenca({ situacao: "negada", prazo_dias: null, validade: null }, data, "2026-11-10"), ["Negada: resolva antes da data ou mude o plano."]);
  assert.deepEqual(avisosDaLicenca({ situacao: "dispensada", prazo_dias: -30, validade: null }, data, "2026-11-10"), []);
});

test("em aberto e o resumo da data", () => {
  assert.equal(licencaEmAberto("a_pedir"), true);
  assert.equal(licencaEmAberto("pedida"), true);
  assert.equal(licencaEmAberto("concedida"), false);
  assert.equal(resumoDasLicencas([]), "Nenhuma licença cadastrada.");
  assert.equal(resumoDasLicencas([{ situacao: "pedida" }, { situacao: "concedida" }, { situacao: "negada" }]), "3 licenças, 1 em aberto, 1 negada.");
  assert.equal(resumoDasLicencas([{ situacao: "concedida" }]), "1 licença, 0 em aberto.");
});
