import assert from "node:assert/strict";
import test from "node:test";
import { bateComOFiltro, itensParaALocadora, transfersParaATransportadora } from "@/lib/producao/tabelas-publicas";

const datas = [{ id: "d1", data: "2026-12-04", fuso: "America/Sao_Paulo" }, { id: "d2", data: "2026-12-05", fuso: "America/Sao_Paulo" }];
const pessoas = [{ id: "p1", nome: "Marina Alves" }, { id: "p2", nome: "Bruno Lima" }];
const deslocamentos = [
  { id: "t2", data_id: "d2", tipo: "van" as const, origem: "Hotel", destino: "Teatro", saida: "2026-12-05T13:00:00Z", chegada: "2026-12-05T13:40:00Z", companhia: "Viação Central", localizador: "L2" },
  { id: "t1", data_id: "d1", tipo: "onibus" as const, origem: "Rodoviária", destino: "Hotel", saida: "2026-12-04T11:30:00Z", chegada: null, companhia: "Viação Central", localizador: null },
  { id: "t3", data_id: "d1", tipo: "carro" as const, origem: "Aeroporto", destino: "Hotel", saida: null, chegada: null, companhia: "Táxi Rápido", localizador: null },
];
const vinculos = [{ deslocamento_id: "t1", pessoa_id: "p1" }, { deslocamento_id: "t1", pessoa_id: "p2" }, { deslocamento_id: "t2", pessoa_id: "p2" }];

test("o filtro ignora maiúsculas, acentos e espaços nas pontas, e só deixa passar o que é do parceiro", () => {
  assert.equal(bateComOFiltro("Viação Central", " viacao central "), true);
  assert.equal(bateComOFiltro("Viação Central", "Táxi Rápido"), false);
  assert.equal(bateComOFiltro(null, "Viação Central"), false);
  assert.equal(bateComOFiltro(null, null), true);
  assert.equal(bateComOFiltro("Qualquer", "   "), true);
});

test("os transfers saem em ordem de saída (sem hora, no fim do dia), com a hora no fuso da data e os passageiros em ordem alfabética", () => {
  const lista = transfersParaATransportadora(datas, deslocamentos, vinculos, pessoas, null);
  assert.deepEqual(lista.map(item => item.origem), ["Rodoviária", "Aeroporto", "Hotel"]);
  const primeiro = lista.find(item => item.origem === "Rodoviária");
  assert.equal(primeiro?.dia, "2026-12-04");
  assert.equal(primeiro?.saida, "08:30");
  assert.deepEqual(primeiro?.passageiros, ["Bruno Lima", "Marina Alves"]);
  assert.equal(primeiro?.tipo, "Ônibus");
});

test("o transfer sem saída fica no dia da data, sem hora, e o filtro deixa só a companhia pedida", () => {
  const todos = transfersParaATransportadora(datas, deslocamentos, vinculos, pessoas, null);
  const semSaida = todos.find(item => item.origem === "Aeroporto");
  assert.equal(semSaida?.dia, "2026-12-04");
  assert.equal(semSaida?.saida, null);
  const soUma = transfersParaATransportadora(datas, deslocamentos, vinculos, pessoas, "Viacao Central");
  assert.deepEqual(soUma.map(item => item.companhia), ["Viação Central", "Viação Central"]);
});

test("a tabela da transportadora só carrega o que ela precisa: nada de contato, nota, odômetro ou id", () => {
  const lista = transfersParaATransportadora(
    datas,
    [{ ...deslocamentos[1], notas: "ligar para o motorista 11 99999-0000", odometro_saida_km: 1200, motorista_id: "m1" } as unknown as (typeof deslocamentos)[number]],
    vinculos, [{ id: "p1", nome: "Marina Alves", telefone: "11 98888-1111", email: "m@x.com" } as { id: string; nome: string }, pessoas[1]], null,
  );
  const texto = JSON.stringify(lista);
  for (const proibido of ["99999", "98888", "m@x.com", "1200", "\"m1\"", "\"p1\"", "\"t1\""]) assert.equal(texto.includes(proibido), false, proibido);
  assert.deepEqual(Object.keys(lista[0]).sort(), ["chegada", "companhia", "destino", "dia", "localizador", "origem", "passageiros", "saida", "tipo"]);
});

const itens = [
  { nome: "Refletor LED", categoria: "luz" as const, quantidade: 12, fornecedor: "Locadora Som & Luz", locacao_inicio: "2026-12-03", locacao_fim: "2026-12-07", comprimento_cm: 30, largura_cm: 20, altura_cm: 25, peso_kg: 4.5 },
  { nome: "Praticável 2x1", categoria: "praticavel" as const, quantidade: 6, fornecedor: "Palcos Brasil", locacao_inicio: "2026-12-02", locacao_fim: null, comprimento_cm: 200, largura_cm: 100, altura_cm: 40, peso_kg: null },
  { nome: "Mesa de som", categoria: "som" as const, quantidade: 1, fornecedor: null, locacao_inicio: null, locacao_fim: null, comprimento_cm: null, largura_cm: null, altura_cm: null, peso_kg: null },
];

test("os itens locados saem por início da locação e depois por nome, e o filtro deixa só o fornecedor pedido", () => {
  assert.deepEqual(itensParaALocadora(itens, null).map(item => item.nome), ["Praticável 2x1", "Refletor LED", "Mesa de som"]);
  assert.deepEqual(itensParaALocadora(itens, "locadora som & luz").map(item => item.nome), ["Refletor LED"]);
  assert.equal(itensParaALocadora(itens, "Locadora Que Não Existe").length, 0);
});

test("a tabela da locadora só carrega o que ela precisa: nada de fornecedor, série, nota ou valor", () => {
  const lista = itensParaALocadora(
    [{ ...itens[0], serie: "SN-123", notas: "emprestar só com seguro", valor_locacao: 9999 } as unknown as (typeof itens)[number]], null,
  );
  const texto = JSON.stringify(lista);
  for (const proibido of ["SN-123", "seguro", "9999", "Locadora Som"]) assert.equal(texto.includes(proibido), false, proibido);
  assert.deepEqual(Object.keys(lista[0]).sort(), ["altura_cm", "categoria", "comprimento_cm", "largura_cm", "locacao_fim", "locacao_inicio", "nome", "peso_kg", "quantidade"]);
  assert.equal(lista[0].categoria, "Luz");
});
