import assert from "node:assert/strict";
import test from "node:test";
import { consumoReal, kmRodados, lerRegistroDaViagem, textoDaViagem, TEXTO_DO_MOTIVO } from "../lib/producao/viagem-motorista";

const base = { odometroSaida: "", odometroChegada: "", litros: "", combustivel: "", posto: "" };

test("registro: odômetro com ponto de milhar, litros com vírgula, combustível da lista, posto aparado", () => {
  const leitura = lerRegistroDaViagem({ odometroSaida: "10.000", odometroChegada: "10412", litros: "45,3", combustivel: "diesel_s10", posto: "  Posto Estrela " });
  assert.ok(leitura.ok);
  assert.deepEqual(leitura.ok && leitura.args, { p_odometro_saida: 10000, p_odometro_chegada: 10412, p_litros: 45.3, p_combustivel: "diesel_s10", p_posto: "Posto Estrela" });
  const soChegada = lerRegistroDaViagem({ ...base, odometroChegada: "500" });
  assert.deepEqual(soChegada.ok && soChegada.args, { p_odometro_saida: null, p_odometro_chegada: 500, p_litros: null, p_combustivel: null, p_posto: null });
});

test("registro: exige ao menos um valor, combustível com litros e odômetros coerentes", () => {
  const erro = (campos: Partial<typeof base>, gravado?: { saida: number | null; chegada: number | null }) => {
    const leitura = lerRegistroDaViagem({ ...base, ...campos }, gravado);
    return leitura.ok ? null : leitura.erro;
  };
  assert.match(erro({}) ?? "", /odômetro ou o abastecimento/);
  assert.match(erro({ odometroSaida: "10,5" }) ?? "", /saída/);
  assert.match(erro({ odometroChegada: "abc" }) ?? "", /chegada/);
  assert.match(erro({ odometroSaida: "10000000" }) ?? "", /saída/);
  assert.match(erro({ litros: "0" }) ?? "", /litros/i);
  assert.match(erro({ litros: "45,333" }) ?? "", /litros/i);
  assert.match(erro({ litros: "10000" }) ?? "", /litros/i);
  assert.match(erro({ litros: "10" }) ?? "", /combustível/);
  assert.match(erro({ litros: "10", combustivel: "agua" }) ?? "", /combustível/);
  assert.match(erro({ odometroSaida: "1000", odometroChegada: "900" }) ?? "", /menor/);
  assert.match(erro({ odometroChegada: "900" }, { saida: 1000, chegada: null }) ?? "", /menor/, "vale contra a saída que já estava gravada");
  assert.equal(erro({ odometroChegada: "1500" }, { saida: 1000, chegada: null }), null);
  assert.match(erro({ litros: "10", combustivel: "flex", posto: "x".repeat(201) }) ?? "", /posto/);
});

test("distância e consumo", () => {
  assert.equal(kmRodados(10000, 10412), 412);
  assert.equal(kmRodados(null, 10412), null);
  assert.equal(kmRodados(10500, 10412), null);
  assert.equal(consumoReal(412, 45.3), 9.1);
  assert.equal(consumoReal(null, 45.3), null);
  assert.equal(consumoReal(0, 10), null);
  assert.equal(consumoReal(100, 0), null);
});

test("texto da viagem: só o que existe", () => {
  assert.equal(textoDaViagem({ odometro_saida_km: 10000, odometro_chegada_km: 10412, litros: 45.3 }), "412 km rodados · 45,3 L · 9,1 km/l");
  assert.equal(textoDaViagem({ odometro_saida_km: 10000, odometro_chegada_km: 10412, litros: 0 }), "412 km rodados");
  assert.equal(textoDaViagem({ odometro_saida_km: null, odometro_chegada_km: null, litros: 20 }), "20 L");
  assert.equal(textoDaViagem({ odometro_saida_km: null, odometro_chegada_km: null, litros: 0 }), "");
});

test("todo motivo da função do banco tem texto para a pessoa", () => {
  for (const motivo of ["sem_acesso", "nao_e_motorista", "data_cancelada", "odometro_invalido", "litros_invalidos", "combustivel_invalido", "nada_a_registrar"]) {
    assert.ok(TEXTO_DO_MOTIVO[motivo], motivo);
  }
});
