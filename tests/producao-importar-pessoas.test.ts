import assert from "node:assert/strict";
import test from "node:test";
import { lerTabela, lerTipoDePessoa, LIMITE_DE_LINHAS, prepararImportacao } from "../lib/producao/importar-pessoas";

test("lê tabulação (colado do Excel), ponto e vírgula e vírgula, com aspas e BOM", () => {
  assert.deepEqual(lerTabela("Nome\tE-mail\nAna\tana@x.com"), [["Nome", "E-mail"], ["Ana", "ana@x.com"]]);
  assert.deepEqual(lerTabela("﻿Nome;Telefone\r\nBia;11 99999-0000\r\n"), [["Nome", "Telefone"], ["Bia", "11 99999-0000"]]);
  assert.deepEqual(lerTabela('Nome,Nome artístico\n"Silva, João","Joãozinho ""Jota"""\n\n'), [["Nome", "Nome artístico"], ["Silva, João", 'Joãozinho "Jota"']]);
  assert.deepEqual(lerTabela("   "), []);
});

test("o tipo: id, rótulo com ou sem acento, vazio vale equipe, o resto não é reconhecido", () => {
  assert.equal(lerTipoDePessoa("elenco"), "elenco");
  assert.equal(lerTipoDePessoa("Técnica"), "tecnica");
  assert.equal(lerTipoDePessoa("tecnica"), "tecnica");
  assert.equal(lerTipoDePessoa(""), "equipe");
  assert.equal(lerTipoDePessoa("diretor"), null);
});

test("a importação separa novas, repetidas e com erro, e as colunas vêm do título em qualquer ordem", () => {
  const tabela = lerTabela([
    "E-mail;Nome;Tipo;Celular;Apelido",
    "ana@x.com;Ana Souza;elenco;11 90000-0001;Aninha",
    ";Bruno Lima;;;",
    "carla@x.com;ana souza;;;",
    "ana@x.com;Outra Pessoa;;;",
    "invalido;Davi Rocha;;;",
    ";Eva Alves;diretor;;",
    ";Fábio Nunes;apoio;;",
  ].join("\n"));
  const existentes = [{ nome: "Gil Santos", email: "gil@x.com" }];
  const preparo = prepararImportacao(tabela, existentes);
  assert.ok(preparo.ok);
  assert.deepEqual(preparo.linhas.map(l => [l.linha, l.situacao]), [[2, "nova"], [3, "nova"], [4, "repetida"], [5, "repetida"], [6, "erro"], [7, "erro"], [8, "nova"]]);
  assert.deepEqual(preparo.novas[0], { nome: "Ana Souza", nome_artistico: "Aninha", email: "ana@x.com", telefone: "11 90000-0001", tipo: "elenco" });
  assert.equal(preparo.novas[1].tipo, "equipe");
  assert.equal(preparo.novas.length, 3);
});

test("quem já está cadastrado (nome sem acento ou e-mail) não entra de novo", () => {
  const preparo = prepararImportacao(lerTabela("Nome,Email\nJosé Alves,\nMaria,gil@x.com"), [{ nome: "Jose Alves", email: null }, { nome: "Gil Santos", email: "GIL@x.com" }]);
  assert.ok(preparo.ok);
  assert.deepEqual(preparo.linhas.map(l => l.situacao), ["repetida", "repetida"]);
  assert.equal(preparo.novas.length, 0);
});

test("recusa o que não dá para ler: sem coluna de nome, sem linhas e acima do limite", () => {
  assert.equal(prepararImportacao([], []).ok, false);
  assert.equal(prepararImportacao(lerTabela("Telefone\n11"), []).ok, false);
  assert.equal(prepararImportacao(lerTabela("Nome"), []).ok, false);
  const grande = ["Nome", ...Array.from({ length: LIMITE_DE_LINHAS + 1 }, (_, i) => `Pessoa ${i}`)].join("\n");
  assert.equal(prepararImportacao(lerTabela(grande), []).ok, false);
});
