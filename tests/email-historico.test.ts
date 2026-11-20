import assert from "node:assert/strict";
import test from "node:test";
import { consultasDeContatos, enderecosParaBusca, filtroDesde } from "../lib/email/historico";
import { enderecosDoCabecalho } from "../lib/email/mensagem";

test("endereços para busca: minúsculos, sem repetição e só os válidos", () => {
  assert.deepEqual(
    enderecosParaBusca(["Ana@Exemplo.com.br", " ana@exemplo.com.br ", "bia@exemplo.com.br", "sem-arroba", "", null, undefined, "x@y", "c d@e.com"]),
    ["ana@exemplo.com.br", "bia@exemplo.com.br"],
  );
});

test("uma consulta cobre vários endereços e leva o período na frente", () => {
  const consultas = consultasDeContatos(["a@x.com", "b@x.com"], "newer_than:180d");
  assert.equal(consultas.length, 1);
  assert.equal(consultas[0], "newer_than:180d (from:a@x.com OR to:a@x.com OR cc:a@x.com OR from:b@x.com OR to:b@x.com OR cc:b@x.com)");
});

test("as consultas ficam abaixo do tamanho máximo e nenhum endereço se perde", () => {
  const enderecos = Array.from({ length: 120 }, (_, i) => `contato${i}@empresa${i}.com.br`);
  const consultas = consultasDeContatos(enderecos, "after:1763380800", 900);
  assert.ok(consultas.length > 1);
  for (const consulta of consultas) assert.ok(consulta.length <= 900, `consulta de ${consulta.length} caracteres`);
  const usados = new Set(consultas.flatMap((consulta) => [...consulta.matchAll(/from:(\S+)/g)].map((m) => m[1])));
  assert.deepEqual([...usados].sort(), [...enderecos].sort());
});

test("sem endereços não há consulta", () => {
  assert.deepEqual(consultasDeContatos([], "newer_than:180d"), []);
});

test("filtro desde: o Gmail lê segundos desde 1970", () => {
  assert.equal(filtroDesde(new Date("2025-11-17T12:00:00Z")), "after:1763380800");
});

test("endereços de um cabeçalho: aguenta vírgula no nome e repetição", () => {
  assert.deepEqual(
    enderecosDoCabecalho('"Silva, João" <Joao@Empresa.com>, Maria <maria@empresa.com>, joao@empresa.com'),
    ["joao@empresa.com", "maria@empresa.com"],
  );
  assert.deepEqual(enderecosDoCabecalho(null), []);
  assert.deepEqual(enderecosDoCabecalho(""), []);
});
