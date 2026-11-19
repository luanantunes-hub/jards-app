import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { documentoDaFicha, logoParaOPdf } from "../lib/producao/ficha-pdf";
import { montarPdf } from "../lib/producao/pdf-texto";

const espaco = { nome: "Teatro Municipal", tipo: "Teatro", uf: "SP", endereco: "Rua das Flores, 100", capacidade: 450 };

test("o documento traz o espaço, o contato e uma seção por sala, só com o que está preenchido", () => {
  const documento = documentoDaFicha(
    espaco,
    { funcionamento: "Terça a domingo", acessibilidade: null, carga_descarga: "Doca nos fundos", doca_altura_m: 1.2, veiculo_max_m: 12, contato_nome: "Ana", contato_telefone: "11 90000-0001", contato_email: null },
    [
      { nome: "Sala Principal", capacidade: 450, ficha: { palco_boca_m: 10.5, palco_profundidade_m: 8, energia_kva: 30, energia_tensao_v: 220, energia_fases: 3, notas: "Piso preto" } },
      { nome: "Foyer", capacidade: null, ficha: null },
    ],
  );
  assert.equal(documento.titulo, "Ficha técnica · Teatro Municipal");
  assert.equal(documento.subtitulo, "Teatro · SP · 450 lugares · Rua das Flores, 100");
  assert.deepEqual(documento.secoes[0], {
    titulo: "O espaço",
    linhas: ["Funcionamento: Terça a domingo", "Carga e descarga: Doca nos fundos", "Altura da doca: 1,2 m", "Veículo máximo: 12 m de comprimento", "Contato: Ana · 11 90000-0001"],
  });
  assert.deepEqual(documento.secoes[1], { titulo: "Sala Principal · 450 lugares", linhas: ["Palco: boca 10,5 m × profundidade 8 m", "Energia: 30 kVA, 220 V, 3 fases", "Notas: Piso preto"] });
  assert.deepEqual(documento.secoes[2], { titulo: "Foyer", linhas: [] });
});

test("sem ficha nenhuma o documento ainda sai, com seções vazias", async () => {
  const documento = documentoDaFicha(espaco, null, []);
  assert.deepEqual(documento.secoes, [{ titulo: "O espaço", linhas: [] }]);
  const bytes = await montarPdf(documento);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1);
});

test("os equipamentos em uso entram no PDF, com a quantidade e a sala", () => {
  const documento = documentoDaFicha(espaco, null, [], [{ nome: "Refletor LED", quantidade: 24, sala: "Sala Principal" }, { nome: "Mesa de som", quantidade: 1, sala: null }]);
  assert.deepEqual(documento.secoes.at(-1), { titulo: "Equipamentos da casa (em uso)", linhas: ["24 × Refletor LED (Sala Principal)", "Mesa de som"] });
  assert.equal(documentoDaFicha(espaco, null, []).secoes.length, 1, "sem equipamentos não há seção");
});

test("o logo da ficha entra no documento e o PDF sai mesmo com imagem quebrada", async () => {
  assert.equal(documentoDaFicha(espaco, { logo_url: "https://casa.com.br/logo.png" }, []).logoUrl, "https://casa.com.br/logo.png");
  assert.equal(documentoDaFicha(espaco, null, []).logoUrl, undefined);
  const bytes = await montarPdf(documentoDaFicha(espaco, null, []), { bytes: new Uint8Array([1, 2, 3]), tipo: "png" });
  assert.ok(bytes.byteLength > 500, "o PDF sai sem o logo quando a imagem não presta");
});

test("o logo só é baixado quando o endereço é de PNG ou JPEG", async () => {
  assert.equal(await logoParaOPdf(null), undefined);
  assert.equal(await logoParaOPdf("https://casa.com.br/logo.webp"), undefined);
  assert.equal(await logoParaOPdf("https://casa.com.br/sem-extensao"), undefined);
});
