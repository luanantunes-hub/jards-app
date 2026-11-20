import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { desenhoDaPlanta, medidaDaPlanta, svgDaPlanta, type PlantaParaPdf } from "../lib/producao/planta-desenho";
import { documentoDaFicha } from "../lib/producao/ficha-pdf";
import { montarPdf } from "../lib/producao/pdf-texto";

const objeto = (campos: Partial<PlantaParaPdf["objetos"][number]> = {}) => ({
  rotulo: "Praticável", x_m: 0, y_m: 0, largura_m: 2, profundidade_m: 1, rotacao_graus: 0, ...campos,
});
const planta: PlantaParaPdf = { nome: "Palco", largura_m: 10, profundidade_m: 8, objetos: [objeto({ x_m: 1, y_m: 2 })] };
const perto = (a: number, b: number, folga = 0.01) => assert.ok(Math.abs(a - b) <= folga, `${a} ≠ ${b}`);

test("a escala faz a planta caber na largura e na altura, sem passar do limite", () => {
  // 10 m de largura em 400 pt: 40 pt/m cabe na altura (8 m × 40 = 320 ≤ 330).
  const largo = desenhoDaPlanta(planta, 400, 330);
  perto(largo.escala, 40);
  perto(largo.largura, 400);
  perto(largo.altura, 320);
  // Planta funda: quem manda é a altura.
  const fundo = desenhoDaPlanta({ ...planta, profundidade_m: 20 }, 400, 300);
  perto(fundo.escala, 15);
  perto(fundo.altura, 300);
  // Planta pequena não vira um desenho gigante.
  perto(desenhoDaPlanta({ ...planta, largura_m: 1, profundidade_m: 1 }, 400, 330).escala, 60);
});

test("o objeto sem giro fica no lugar, com o y virado para cima", () => {
  const desenho = desenhoDaPlanta(planta, 400, 330); // 40 pt/m, altura 320
  const [forma] = desenho.formas;
  perto(forma.x, 40); // x_m 1 × 40
  perto(forma.largura, 80);
  perto(forma.altura, 40);
  // y_m 2 é o topo do objeto: no PDF, 320 − (2 + 1) × 40 = 200 na base.
  perto(forma.y, 200);
  perto(forma.centroX, 80);
  perto(forma.centroY, 220);
  assert.equal(forma.rotacao, 0);
});

test("o objeto girado gira em volta do próprio centro e o sentido é o do PDF", () => {
  const desenho = desenhoDaPlanta({ ...planta, objetos: [objeto({ x_m: 1, y_m: 2, rotacao_graus: 90 })] }, 400, 330);
  const [forma] = desenho.formas;
  assert.equal(forma.rotacao, -90, "a planta gira no sentido da tela, o PDF no contrário");
  // O centro não se move com o giro.
  perto(forma.centroX, 80);
  perto(forma.centroY, 220);
  // Girado 90° no sentido da tela, o retângulo de 80 × 40 pt ocupa 40 de largura e 80 de altura: o canto que o
  // PDF gira fica 20 pt à esquerda do centro e 40 pt acima dele.
  perto(forma.x, 60);
  perto(forma.y, 260);
});

test("a medida sai em português e o SVG usa as próprias medidas da planta", () => {
  assert.equal(medidaDaPlanta({ largura_m: 10.5, profundidade_m: 8 }), "10,5 m de largura × 8 m de profundidade");
  const svg = svgDaPlanta(planta);
  assert.equal(svg.viewBox, "0 0 10 8");
  assert.equal(svg.objetos[0].giro, "");
  assert.equal(svg.objetos[0].rotulo, "Praticável");
  assert.equal(svgDaPlanta({ ...planta, objetos: [objeto({ rotacao_graus: 45 })] }).objetos[0].giro, "rotate(45 1 0.5)");
  // Rótulo comprido num objeto pequeno fica de fora do desenho.
  assert.equal(svgDaPlanta({ ...planta, objetos: [objeto({ largura_m: 0.3, profundidade_m: 0.3, rotulo: "Caixa de retorno do palco" })] }).objetos[0].rotulo, null);
});

test("a planta da sala entra no PDF da ficha e a seção sem linhas não fica vazia", async () => {
  const espaco = { nome: "Teatro", tipo: "Teatro", uf: "SP", endereco: null, capacidade: 300 };
  const documento = documentoDaFicha(espaco, null, [{ nome: "Sala Principal", capacidade: 300, ficha: null, planta }]);
  assert.equal(documento.secoes[1].planta?.nome, "Palco");
  const comPlanta = await montarPdf(documento);
  const semPlanta = await montarPdf(documentoDaFicha(espaco, null, [{ nome: "Sala Principal", capacidade: 300, ficha: null }]));
  assert.ok(comPlanta.byteLength > semPlanta.byteLength, "o desenho pesa mais que a seção sem ele");
  assert.equal((await PDFDocument.load(comPlanta)).getPageCount(), 1);
});
