import assert from "node:assert/strict";
import test from "node:test";
import { conflitosDeDeslocamentos, lerDeslocamento, type CamposDoDeslocamento, type DeslocamentoParaConflito } from "../lib/producao/deslocamentos";

const base: CamposDoDeslocamento = { tipo: "van", origem: "", destino: "", saida: "", chegada: "", veiculoId: "", motoristaId: "", companhia: "", localizador: "", notas: "" };

test("deslocamento: o mínimo é o tipo; textos aparados; vazio vira nulo", () => {
  const minimo = lerDeslocamento(base);
  assert.ok(minimo.ok);
  assert.equal(minimo.ok && minimo.deslocamento.origem, null);
  const completo = lerDeslocamento({ ...base, origem: " São Paulo ", destino: "Campinas", veiculoId: "v1", motoristaId: "p1", localizador: "ABC123" });
  assert.ok(completo.ok);
  if (completo.ok) {
    assert.equal(completo.deslocamento.origem, "São Paulo");
    assert.equal(completo.deslocamento.veiculo_id, "v1");
    assert.equal(completo.deslocamento.localizador, "ABC123");
  }
});

test("deslocamento: recusa o que o banco recusaria, com texto pronto", () => {
  const erro = (campos: Partial<CamposDoDeslocamento>) => { const leitura = lerDeslocamento({ ...base, ...campos }); return leitura.ok ? null : leitura.erro; };
  assert.match(erro({ tipo: "foguete" }) ?? "", /tipo/);
  assert.match(erro({ chegada: "11:00" }) ?? "", /saída/);
  assert.match(erro({ origem: "x".repeat(201) }) ?? "", /origem/);
  assert.match(erro({ destino: "x".repeat(201) }) ?? "", /destino/);
  assert.match(erro({ localizador: "x".repeat(81) }) ?? "", /localizador/);
  assert.match(erro({ notas: "x".repeat(2001) }) ?? "", /notas/);
  assert.equal(erro({ saida: "09:00", chegada: "11:00" }), null);
});

const nomes = { veiculos: new Map([["v1", "Van da produção"]]), pessoas: new Map([["p1", "Davi"]]) };
const d = (id: string, saida: string | null, chegada: string | null, extra: Partial<DeslocamentoParaConflito> = {}): DeslocamentoParaConflito =>
  ({ id, saida, chegada, veiculo_id: null, motorista_id: null, origem: null, destino: null, ...extra });

test("conflito: o mesmo veículo em horários que se cruzam avisa os dois", () => {
  const avisos = conflitosDeDeslocamentos([
    d("a", "2026-12-05T12:00:00Z", "2026-12-05T14:00:00Z", { veiculo_id: "v1", origem: "SP", destino: "Campinas" }),
    d("b", "2026-12-05T13:00:00Z", "2026-12-05T15:00:00Z", { veiculo_id: "v1", origem: "Campinas", destino: "Sorocaba" }),
  ], nomes);
  assert.equal(avisos.get("a")?.[0], "Van da produção também está em outro deslocamento nesse horário (Campinas → Sorocaba).");
  assert.equal(avisos.get("b")?.[0], "Van da produção também está em outro deslocamento nesse horário (SP → Campinas).");
});

test("conflito: o mesmo motorista avisa; veículos ou motoristas diferentes não", () => {
  const mesmoMotorista = conflitosDeDeslocamentos([
    d("a", "2026-12-05T12:00:00Z", "2026-12-05T14:00:00Z", { motorista_id: "p1" }),
    d("b", "2026-12-05T13:00:00Z", "2026-12-05T15:00:00Z", { motorista_id: "p1", veiculo_id: "v2" }),
  ], nomes);
  assert.match(mesmoMotorista.get("a")?.[0] ?? "", /^Davi também dirige outro deslocamento/);
  const diferentes = conflitosDeDeslocamentos([
    d("a", "2026-12-05T12:00:00Z", "2026-12-05T14:00:00Z", { motorista_id: "p1", veiculo_id: "v1" }),
    d("b", "2026-12-05T13:00:00Z", "2026-12-05T15:00:00Z", { motorista_id: "p2", veiculo_id: "v2" }),
  ], nomes);
  assert.equal(diferentes.size, 0);
});

test("conflito: um que começa quando o outro termina não conflita; sem chegada vale um minuto; sem saída não entra", () => {
  assert.equal(conflitosDeDeslocamentos([
    d("a", "2026-12-05T12:00:00Z", "2026-12-05T14:00:00Z", { veiculo_id: "v1" }),
    d("b", "2026-12-05T14:00:00Z", "2026-12-05T16:00:00Z", { veiculo_id: "v1" }),
  ], nomes).size, 0);
  assert.equal(conflitosDeDeslocamentos([
    d("a", "2026-12-05T12:00:00Z", null, { veiculo_id: "v1" }),
    d("b", "2026-12-05T12:00:00Z", null, { veiculo_id: "v1" }),
  ], nomes).size, 2);
  assert.equal(conflitosDeDeslocamentos([
    d("a", "2026-12-05T12:00:00Z", null, { veiculo_id: "v1" }),
    d("b", "2026-12-05T12:30:00Z", null, { veiculo_id: "v1" }),
  ], nomes).size, 0);
  assert.equal(conflitosDeDeslocamentos([
    d("a", null, null, { veiculo_id: "v1" }),
    d("b", "2026-12-05T12:00:00Z", "2026-12-05T13:00:00Z", { veiculo_id: "v1" }),
  ], nomes).size, 0);
});
