import assert from "node:assert/strict";
import test from "node:test";
import { PROPORCAO_DA_FAIXA, posicaoNaPasta } from "../lib/projetos/capa";

// Fração da altura da imagem visível na moldura e o centro dela, para conferir o enquadramento.
function janela(posicao: number, proporcaoImagem: number, proporcaoMoldura: number) {
  const altura = Math.min(1, proporcaoImagem / proporcaoMoldura);
  const topo = (posicao / 100) * (1 - altura);
  return { topo, base: topo + altura, centro: topo + altura / 2 };
}

test("capa na pasta: a faixa escolhida na página fica no centro da pasta e inteira", () => {
  const foto = 16 / 9, pasta = 4;
  for (const y of [35, 47, 65]) {
    const faixa = janela(y, foto, PROPORCAO_DA_FAIXA);
    const naPasta = janela(posicaoNaPasta(y, foto, pasta), foto, pasta);
    assert.ok(Math.abs(naPasta.centro - faixa.centro) < 1e-9, `centro igual em ${y}%`);
  }
  // perto das pontas a pasta encosta na borda da imagem, mas a faixa escolhida continua inteira
  for (const y of [0, 10, 47, 90, 100]) {
    const faixa = janela(y, foto, PROPORCAO_DA_FAIXA);
    const naPasta = janela(posicaoNaPasta(y, foto, pasta), foto, pasta);
    assert.ok(naPasta.topo <= faixa.topo + 1e-9 && naPasta.base >= faixa.base - 1e-9, `faixa inteira em ${y}%`);
  }
});

test("capa na pasta: nas pontas não sai da imagem e imagem larga demais fica centralizada", () => {
  assert.equal(posicaoNaPasta(0, 16 / 9, 4), 0);
  assert.equal(posicaoNaPasta(100, 16 / 9, 4), 100);
  assert.equal(posicaoNaPasta(30, 6, 4), 50, "imagem mais larga que a pasta: preenche pela altura");
});
