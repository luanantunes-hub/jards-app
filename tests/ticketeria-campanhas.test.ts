import assert from "node:assert/strict";
import test from "node:test";
import { canalDaMarca, canalDosEventos, partesDoCanal, separarMarca, sugerirMarcacao } from "../lib/ticketeria/campanhas";
import { rotuloDoCanalDeGasto } from "../lib/ticketeria/modelo";

const EVENTOS = [{ id: "h", titulo: "Hamlet" }, { id: "hr", titulo: "Hamlet Reprise" }, { id: "r", titulo: "Retratos do Litoral" }, { id: "x", titulo: "Ex" }];

test("a sugestão pelo nome: o evento mais longo ganha, palavra de marca ou nome da loja vira marca, o resto fica sem", () => {
  assert.deepEqual(sugerirMarcacao("Hamlet · temporada março", EVENTOS, "Teatro Municipal"), { marcacao: "evento", eventoId: "h" });
  assert.deepEqual(sugerirMarcacao("[Conversão] HAMLET REPRISE - SP", EVENTOS, "Teatro Municipal"), { marcacao: "evento", eventoId: "hr" });
  assert.deepEqual(sugerirMarcacao("retratos do litoral", EVENTOS, "Teatro Municipal"), { marcacao: "evento", eventoId: "r" });
  assert.deepEqual(sugerirMarcacao("Teatro Municipal · institucional", EVENTOS, "Teatro Municipal"), { marcacao: "marca", eventoId: null });
  assert.deepEqual(sugerirMarcacao("Pesquisa · nome do teatro municipal", EVENTOS, "Teatro Municipal"), { marcacao: "marca", eventoId: null });
  assert.deepEqual(sugerirMarcacao("Branding 2027", EVENTOS, "Loja"), { marcacao: "marca", eventoId: null });
  assert.equal(sugerirMarcacao("Remarketing site", EVENTOS, "Teatro Municipal"), null);
  assert.equal(sugerirMarcacao("Expansão", EVENTOS, "Loja"), null, "nome curto (Ex) não conta");
  assert.equal(sugerirMarcacao("Hamletiano", EVENTOS, "Loja"), null, "pedaço de palavra não conta");
});

test("os nomes dos canais separados", () => {
  assert.equal(canalDaMarca("meta-ads"), "meta-ads-marca");
  assert.equal(canalDosEventos("google-ads"), "google-ads-eventos");
  assert.deepEqual(partesDoCanal("meta-ads-marca"), { base: "meta-ads", parte: "marca" });
  assert.deepEqual(partesDoCanal("meta-ads"), { base: "meta-ads", parte: null });
  assert.equal(rotuloDoCanalDeGasto("meta-ads-marca"), "Meta Ads · marca");
  assert.equal(rotuloDoCanalDeGasto("google-ads-eventos"), "Google Ads · eventos");
  assert.equal(rotuloDoCanalDeGasto("meta-ads"), "Meta Ads");
});

const semanas = (n: number) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2027, 0, 4) + i * 7 * 86400000).toISOString().slice(0, 10));

test("separarMarca: com 8 semanas de cada lado, o canal vira marca e eventos; a soma não muda", () => {
  const ss = semanas(20);
  const tabela = ss.map((semana, i) => ({ semana, ingressos: 10, gasto: { "meta-ads": 1000 + i * 10, "google-ads": 500 } as Record<string, number> }));
  // Marca no Meta em 10 semanas (300 por semana, na terça); o resto do Meta é de eventos.
  const marca = ss.slice(0, 10).map(s => ({ dia: new Date(Date.parse(`${s}T00:00:00Z`) + 86400000).toISOString().slice(0, 10), canal: "meta-ads", centavos: 300 }));
  const { tabela: nova, separados } = separarMarca(tabela, marca);
  assert.deepEqual(separados, ["meta-ads"]);
  assert.equal(nova[0].gasto["meta-ads-marca"], 300);
  assert.equal(nova[0].gasto["meta-ads-eventos"], 700);
  assert.equal(nova[15].gasto["meta-ads-marca"], undefined);
  assert.equal(nova[15].gasto["meta-ads-eventos"], 1150);
  assert.equal(nova[0].gasto["meta-ads"], undefined);
  assert.equal(nova[0].gasto["google-ads"], 500, "canal sem marca fica como está");
  for (let i = 0; i < 20; i++) assert.equal(Object.values(nova[i].gasto).reduce((s, x) => s + x, 0), Object.values(tabela[i].gasto).reduce((s, x) => s + x, 0));
});

test("separarMarca: poucas semanas de marca (ou marca maior que o canal) deixam o canal inteiro e nunca criam gasto", () => {
  const ss = semanas(20);
  const tabela = ss.map(semana => ({ semana, ingressos: 10, gasto: { "meta-ads": 1000 } as Record<string, number> }));
  const pouca = ss.slice(0, 5).map(s => ({ dia: s, canal: "meta-ads", centavos: 300 }));
  assert.deepEqual(separarMarca(tabela, pouca).separados, []);
  assert.deepEqual(separarMarca(tabela, pouca).tabela, tabela);
  // Marca em todas as semanas e maior que o canal: o resto fica zero, então não há "eventos" para separar.
  const tudo = ss.map(s => ({ dia: s, canal: "meta-ads", centavos: 5000 }));
  assert.deepEqual(separarMarca(tabela, tudo).separados, []);
  // Marca de um canal que não tem gasto na tabela não aparece.
  assert.deepEqual(separarMarca(tabela, ss.map(s => ({ dia: s, canal: "radio", centavos: 100 }))).separados, []);
});
