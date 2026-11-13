import assert from "node:assert/strict";
import test from "node:test";
import { chaveDaPraca, montarRelatorio, textoDoRelatorio, type DataDoRelatorio } from "../lib/producao/relatorio-temporada";

const data = (id: string, dia: string, situacao: DataDoRelatorio["situacao"], extra: Partial<DataDoRelatorio> = {}): DataDoRelatorio => ({ id, data: dia, tipo: "apresentacao", situacao, uf: null, municipio_ibge: null, espaco_id: null, ...extra });

const datas = [
  data("d1", "2026-11-05", "realizada", { uf: "SP", municipio_ibge: "3550308" }),
  data("d2", "2026-11-06", "realizada", { uf: "SP", municipio_ibge: "3550308" }),
  data("d3", "2026-11-08", "realizada", { uf: "RJ", espaco_id: "e1" }),
  data("d4", "2026-11-10", "confirmada", { uf: "MG" }),
  data("d5", "2026-11-12", "opcao", { tipo: "viagem" }),
  data("d6", "2026-11-14", "cancelada", { uf: "BA", municipio_ibge: "2927408" }),
];

test("praça: município, senão espaço, senão estado; sem nenhum não conta", () => {
  assert.equal(chaveDaPraca({ municipio_ibge: "3550308", espaco_id: "e1", uf: "SP" }), "m:3550308");
  assert.equal(chaveDaPraca({ municipio_ibge: null, espaco_id: "e1", uf: "RJ" }), "e:e1");
  assert.equal(chaveDaPraca({ municipio_ibge: null, espaco_id: null, uf: "MG" }), "u:MG");
  assert.equal(chaveDaPraca({ municipio_ibge: null, espaco_id: null, uf: null }), null);
});

test("relatório: datas, praças sem as canceladas, equipe, estrada, convites e ocorrências", () => {
  const r = montarRelatorio({
    datas,
    ocorrencias: [{ data_id: "d1", gravidade: "alta", resolvida: true }, { data_id: "d2", gravidade: "media", resolvida: false }, { data_id: "d6", gravidade: "alta", resolvida: false }],
    escalas: [{ pessoa_id: "p1", data_id: "d1" }, { pessoa_id: "p1", data_id: "d2" }, { pessoa_id: "p2", data_id: "d1" }, { pessoa_id: "p3", data_id: "d6" }],
    deslocamentos: [{ odometro_saida_km: 100, odometro_chegada_km: 460 }, { odometro_saida_km: 10, odometro_chegada_km: null }, { odometro_saida_km: 500, odometro_chegada_km: 400 }],
    convites: [{ resposta: "vou" }, { resposta: "vou" }, { resposta: "nao_vou" }, { resposta: "pendente" }],
    voluntarios: [{ situacao: "aprovado" }, { situacao: "inscrito" }, { situacao: "recusado" }],
  });
  assert.deepEqual(r.periodo, { inicio: "2026-11-05", fim: "2026-11-12" });
  assert.deepEqual(r.datas, { total: 6, realizadas: 3, confirmadas: 1, opcoes: 1, canceladas: 1, apresentacoes: 4, apresentacoesRealizadas: 3 });
  assert.deepEqual(r.pracas, { total: 3, estados: 3 }, "SP (duas datas, um município), RJ (espaço) e MG (só o estado); a opção sem lugar não conta e a cancelada de BA fica fora");
  assert.deepEqual(r.equipe, { pessoas: 2, escalas: 3 });
  assert.deepEqual(r.estrada, { deslocamentos: 3, km: 360, comOdometro: 1 });
  assert.deepEqual(r.convites, { vao: 2, naoVao: 1, semResposta: 1 });
  assert.deepEqual(r.voluntarios, { aprovados: 1, inscritos: 1 });
  assert.deepEqual(r.ocorrencias, { total: 2, abertas: 1, altas: 1, medias: 1, baixas: 0 });
});

test("relatório vazio não quebra", () => {
  const r = montarRelatorio({ datas: [], ocorrencias: [], escalas: [], deslocamentos: [], convites: [], voluntarios: [] });
  assert.deepEqual(r.periodo, { inicio: null, fim: null });
  assert.equal(r.pracas.total, 0);
  assert.match(textoDoRelatorio("Vazia", r), /Ocorrências: nenhuma registrada/);
});

test("texto: só o que foi registrado", () => {
  const r = montarRelatorio({
    datas, ocorrencias: [{ data_id: "d1", gravidade: "alta", resolvida: false }], escalas: [{ pessoa_id: "p1", data_id: "d1" }],
    deslocamentos: [{ odometro_saida_km: 100, odometro_chegada_km: 460 }], convites: [{ resposta: "vou" }], voluntarios: [],
  });
  const texto = textoDoRelatorio("Circulação 2026", r);
  assert.match(texto, /^Relatório de temporada: Circulação 2026\nPeríodo: 05\/11\/2026 a 12\/11\/2026\n/);
  assert.match(texto, /Apresentações: 3 realizadas de 4 previstas/);
  assert.match(texto, /Praças: 3 praças em 3 estados/);
  assert.match(texto, /Equipe: 1 pessoa escalada em 1 escala/);
  assert.match(texto, /Estrada: 360 km rodados em 1 deslocamento com odômetro registrado/);
  assert.match(texto, /Convites: 1 confirmou presença, 0 não vão, 0 sem resposta/);
  assert.doesNotMatch(texto, /Voluntários/);
  assert.match(texto, /Ocorrências: 1 \(1 de gravidade alta, 1 ainda em aberto\)/);
});
