import assert from "node:assert/strict";
import test from "node:test";
import { lerMarca, marcaPublicaDaSessao } from "@/lib/producao/marcas";

test("a marca: nome de 1 a 120 letras; site e logo são opcionais e só https", () => {
  assert.deepEqual(lerMarca({ nome: "  Banco Central ", site: "", logo: "" }), { ok: true, marca: { nome: "Banco Central", site_url: null, logo_url: null } });
  assert.deepEqual(lerMarca({ nome: "Marca", site: " https://www.exemplo.com.br/apoio ", logo: "https://cdn.exemplo.com/logo.svg" }),
    { ok: true, marca: { nome: "Marca", site_url: "https://www.exemplo.com.br/apoio", logo_url: "https://cdn.exemplo.com/logo.svg" } });
  assert.equal(lerMarca({ nome: "   ", site: "", logo: "" }).ok, false);
  assert.equal(lerMarca({ nome: "x".repeat(121), site: "", logo: "" }).ok, false);
});

test("a marca recusa o que o banco recusaria: endereço sem https, com espaço, ou grande demais", () => {
  for (const ruim of ["http://exemplo.com", "exemplo.com", "https://exemplo .com", "javascript:alert(1)", "https://"]) {
    assert.equal(lerMarca({ nome: "Marca", site: ruim, logo: "" }).ok, false, ruim);
    assert.equal(lerMarca({ nome: "Marca", site: "", logo: ruim }).ok, false, ruim);
  }
  assert.equal(lerMarca({ nome: "Marca", site: `https://exemplo.com/${"a".repeat(290)}`, logo: "" }).ok, false);
  assert.equal(lerMarca({ nome: "Marca", site: "", logo: `https://exemplo.com/${"a".repeat(470)}` }).ok, true);
});

test("o público vê só nome, site e logo da marca; marca arquivada, que sumiu ou sem marca não aparece", () => {
  const marcas = new Map([
    ["m1", { nome: "Marca", site_url: "https://m.example.com", logo_url: null, arquivada: false }],
    ["m2", { nome: "Velha", site_url: null, logo_url: null, arquivada: true }],
  ]);
  assert.deepEqual(marcaPublicaDaSessao("m1", marcas), { nome: "Marca", site: "https://m.example.com", logo: null });
  assert.equal(marcaPublicaDaSessao("m2", marcas), null);
  assert.equal(marcaPublicaDaSessao("nao-existe", marcas), null);
  assert.equal(marcaPublicaDaSessao(null, marcas), null);
  assert.equal(marcaPublicaDaSessao(undefined, marcas), null);
});
