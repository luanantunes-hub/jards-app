import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { gerarRiderDaPlanta, lerLinhaDoRider } from "../lib/producao/rider";
import { montarPdf } from "../lib/producao/pdf-texto";
import type { ObjetoDePalco } from "../lib/producao/palco";

const o = (id: string, rotulo: string, extra: Partial<ObjetoDePalco> = {}): ObjetoDePalco => ({
  id, rotulo, tipo: "instrumento", canais: null, canal_inicial: null, potencia_w: null, circuito: null, fase: null, ...extra,
});

const banda: ObjetoDePalco[] = [
  o("bateria", "Bateria", { canais: 8 }),
  o("baixo", "Baixo", { canais: 1, potencia_w: 600, circuito: "C1", fase: "R" }),
  o("guitarra", "Guitarra", { canais: 2, potencia_w: 800, circuito: "C1", fase: "R" }),
  o("voz", "Voz principal", { tipo: "microfone", canais: 1, potencia_w: 100, circuito: "C2", fase: "S" }),
  o("p1", "Praticável 2x1", { tipo: "praticavel" }),
  o("p2", "Praticável 2x1", { tipo: "praticavel" }),
  o("m1", "Monitor de chão", { tipo: "monitor", potencia_w: 1000, circuito: "C3", fase: "T" }),
  o("tomada", "Ponto de energia", { tipo: "energia" }),
];

test("o rider da banda nasce do mapa: medidas, equipamento, canais e energia", () => {
  const rider = gerarRiderDaPlanta({ nome: "Palco principal", largura_m: 12, profundidade_m: 8 }, banda);
  assert.equal(rider.nome, "Rider · Palco principal");
  assert.deepEqual([rider.palco_largura_min_m, rider.palco_profundidade_min_m], [12, 8]);
  const secao = (nome: string) => rider.itens.filter(item => item.secao === nome);
  assert.deepEqual(secao("palco").map(i => [i.texto, i.quantidade, i.obrigatorio]), [
    ["Palco com no mínimo 12 m de largura por 8 m de profundidade", null, true],
    ["Praticável 2x1", 2, false],
    ["Monitor de chão", 1, false],
    ["Em cena: Bateria, Baixo, Guitarra", null, true],
  ]);
  assert.deepEqual(secao("som").map(i => i.texto), [
    "Mesa de som com no mínimo 12 canais de entrada", "Canais 1 a 8: Bateria", "Canal 9: Baixo", "Canais 10 a 11: Guitarra", "Canal 12: Voz principal",
  ]);
  assert.equal(secao("som")[0].quantidade, null);
  assert.deepEqual(secao("energia").map(i => i.texto), [
    "Carga prevista de 2.500 W (cerca de 11 A a 220 V)", "Fase R: 1.400 W", "Fase S: 100 W", "Fase T: 1.000 W",
    "C1 (fase R): 1.400 W, cerca de 6,4 A", "C2 (fase S): 100 W, cerca de 0,5 A", "C3 (fase T): 1.000 W, cerca de 4,5 A", "Pontos de energia no palco, nas posições da planta",
  ]);
  assert.deepEqual(secao("energia").at(-1)?.quantidade, 1);
  assert.deepEqual(rider.itens.filter(i => i.secao === "camarim" || i.secao === "catering" || i.secao === "luz"), []);
  assert.deepEqual(secao("palco").map(i => i.ordem), [0, 10, 20, 30]);
});

test("planta vazia: só as medidas do palco", () => {
  const rider = gerarRiderDaPlanta({ nome: "Sala", largura_m: 6.5, profundidade_m: 4 }, []);
  assert.deepEqual(rider.itens.map(i => i.texto), ["Palco com no mínimo 6,5 m de largura por 4 m de profundidade"]);
});

test("a linha do rider: seção da lista, texto de 1 a 500 e quantidade inteira", () => {
  assert.deepEqual(lerLinhaDoRider({ secao: "luz", texto: " Seis refletores ", quantidade: "6", obrigatorio: true }), { ok: true, linha: { secao: "luz", texto: "Seis refletores", quantidade: 6, obrigatorio: true } });
  assert.deepEqual(lerLinhaDoRider({ secao: "camarim", texto: "Água", quantidade: "", obrigatorio: false }), { ok: true, linha: { secao: "camarim", texto: "Água", quantidade: null, obrigatorio: false } });
  for (const mudanca of [{ secao: "cozinha" }, { texto: " " }, { texto: "a".repeat(501) }, { quantidade: "0" }, { quantidade: "2,5" }, { quantidade: "10000" }]) {
    assert.equal(lerLinhaDoRider({ secao: "luz", texto: "x", quantidade: "", obrigatorio: true, ...mudanca }).ok, false, JSON.stringify(mudanca));
  }
});

test("o PDF sai com acentos, símbolos que a fonte não tem e quebra de página", async () => {
  const linhas = Array.from({ length: 120 }, (_, i) => `Linha ${i + 1}: mesa de som com ≈ 16 canais, potência ≥ 1.500 W — açaí e café`);
  const bytes = await montarPdf({ titulo: "Rider · Palco principal", subtitulo: "12 × 8 m", secoes: [{ titulo: "Som", linhas }, { titulo: "Camarim", linhas: [] }], rodape: "Jards" });
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() >= 3, `esperava várias páginas, vieram ${pdf.getPageCount()}`);
});
