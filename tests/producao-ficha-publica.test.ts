import assert from "node:assert/strict";
import test from "node:test";
import { fichaDoEspacoParaOLink } from "../lib/producao/ficha";
import { documentoDaFicha } from "../lib/producao/ficha-pdf";

const espaco = { nome: "Teatro Central", tipo: "Teatro", uf: "SP", endereco: "Rua A, 10", capacidade: 300 };
const ficha = { funcionamento: "terça a domingo", acessibilidade: "rampa na entrada", carga_descarga: "pela rua dos fundos", doca_altura_m: 1.2, veiculo_max_m: 9, contato_nome: "Marina", contato_telefone: "11 99999-0000", contato_email: "m@teatro.com" };
const salas = [{ nome: "Sala Grande", capacidade: 300, ficha: { palco_boca_m: 12, palco_profundidade_m: 8, notas: "camarim no subsolo" } }];

test("o link sem contato: o documento não leva nome, telefone nem e-mail de quem cuida do espaço", () => {
  const documento = documentoDaFicha(espaco, fichaDoEspacoParaOLink(ficha, false), salas, []);
  const texto = JSON.stringify(documento);
  for (const proibido of ["Marina", "99999", "m@teatro.com", "Contato"]) assert.equal(texto.includes(proibido), false, proibido);
  assert.match(texto, /terça a domingo/, "o resto da ficha continua");
  assert.match(texto, /Sala Grande/);
});

test("o link com contato: o documento leva o contato; a ficha original não é alterada", () => {
  const documento = documentoDaFicha(espaco, fichaDoEspacoParaOLink(ficha, true), salas, []);
  assert.match(JSON.stringify(documento), /Contato: Marina · 11 99999-0000 · m@teatro\.com/);
  fichaDoEspacoParaOLink(ficha, false);
  assert.equal(ficha.contato_nome, "Marina", "mascarar para o link não mexe na ficha da casa");
});

test("sem ficha do espaço, o link devolve nada e não quebra", () => {
  assert.equal(fichaDoEspacoParaOLink(null, false), null);
  assert.equal(fichaDoEspacoParaOLink(null, true), null);
  const documento = documentoDaFicha(espaco, null, salas, []);
  assert.equal(documento.titulo, "Ficha técnica · Teatro Central");
});
