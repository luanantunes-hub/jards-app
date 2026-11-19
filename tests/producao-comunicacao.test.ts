import assert from "node:assert/strict";
import test from "node:test";
import { kitDeImprensa, lerItemDaComunicacao, ordenarComunicacao, type CamposDaComunicacao, type ItemDaComunicacao } from "../lib/producao/comunicacao";

const campos: CamposDaComunicacao = { tipo: "release", titulo: " Release de estreia ", texto: " Sobe o pano em Santos. ", url: "", ordem: "" };
const item = (campos: Partial<ItemDaComunicacao>): ItemDaComunicacao => ({ id: "x", tipo: "arte", titulo: "Cartaz", texto: null, url: "https://casa.com.br/cartaz.pdf", ordem: 0, ...campos });

test("o item lido tem o formato do banco (vazio vira nulo) e a ordem padrão é zero", () => {
  const leitura = lerItemDaComunicacao(campos);
  assert.ok(leitura.ok);
  assert.deepEqual(leitura.valor, { tipo: "release", titulo: "Release de estreia", texto: "Sobe o pano em Santos.", url: null, ordem: 0 });
  const comEndereco = lerItemDaComunicacao({ ...campos, texto: "", url: " https://casa.com.br/kit.zip ", ordem: "3" });
  assert.ok(comEndereco.ok);
  assert.deepEqual(comEndereco.valor, { tipo: "release", titulo: "Release de estreia", texto: null, url: "https://casa.com.br/kit.zip", ordem: 3 });
});

test("o item sem título, sem conteúdo, com endereço errado ou fora dos limites é recusado", () => {
  for (const mudanca of [
    { titulo: "  " },
    { titulo: "a".repeat(201) },
    { texto: "", url: "" },
    { texto: "", url: "http://casa.com.br/cartaz.pdf" },
    { texto: "", url: "https://casa.com.br/com espaco.pdf" },
    { texto: "a".repeat(5001) },
    { ordem: "1000" },
  ] as Partial<CamposDaComunicacao>[]) {
    assert.equal(lerItemDaComunicacao({ ...campos, ...mudanca }).ok, false, JSON.stringify(mudanca).slice(0, 60));
  }
});

test("os itens saem na ordem escolhida, depois por tipo e título", () => {
  const lista = [
    item({ id: "b", tipo: "clipping", titulo: "Jornal", ordem: 1 }),
    item({ id: "a", tipo: "release", titulo: "Estreia", texto: "texto", url: null, ordem: 1 }),
    item({ id: "c", tipo: "arte", titulo: "Banner", ordem: 0 }),
  ];
  assert.deepEqual(ordenarComunicacao(lista).map(i => i.id), ["c", "a", "b"]);
});

test("o kit junta os releases por extenso e o material como lista de endereços", () => {
  const kit = kitDeImprensa("Apresentação de 05/12/2026", [
    item({ id: "a", tipo: "release", titulo: "Estreia", texto: "Sobe o pano em Santos.", url: null, ordem: 0 }),
    item({ id: "b", tipo: "arte", titulo: "Cartaz", ordem: 1 }),
    item({ id: "c", tipo: "foto", titulo: "Ensaio", url: "https://casa.com.br/fotos", ordem: 2 }),
  ]);
  assert.equal(kit, [
    "Apresentação de 05/12/2026",
    "",
    "RELEASE · Estreia",
    "Sobe o pano em Santos.",
    "",
    "Material:",
    "- Arte · Cartaz: https://casa.com.br/cartaz.pdf",
    "- Foto · Ensaio: https://casa.com.br/fotos",
  ].join("\n"));
  assert.equal(kitDeImprensa("Dia", []), null, "sem item não há kit");
});
