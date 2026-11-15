// O fundo da planta vindo de PDF (PD2.3): a validação do que o banco aceita e a escolha do tamanho que cabe.
import test from "node:test";
import assert from "node:assert/strict";
import { fundoValido, LIMITE_DO_FUNDO, opacidadeValida, paginaEscolhida, PREFIXO_DO_FUNDO, primeiroQueCabe, TENTATIVAS_DE_TAMANHO } from "../lib/producao/fundo-da-planta";

test("o fundo válido: JPEG em data URL, dentro do limite", () => {
  assert.equal(fundoValido(PREFIXO_DO_FUNDO + "AAAA"), true);
  assert.equal(fundoValido(PREFIXO_DO_FUNDO), false, "sem imagem");
  assert.equal(fundoValido("data:image/png;base64,AAAA"), false, "só JPEG");
  assert.equal(fundoValido("https://exemplo.com/a.jpg"), false, "nada de endereço de fora");
  assert.equal(fundoValido(PREFIXO_DO_FUNDO + "A".repeat(LIMITE_DO_FUNDO - PREFIXO_DO_FUNDO.length)), true, "no limite");
  assert.equal(fundoValido(PREFIXO_DO_FUNDO + "A".repeat(LIMITE_DO_FUNDO - PREFIXO_DO_FUNDO.length + 1)), false, "passou do limite");
});

test("a opacidade vai de 10 a 100, inteira", () => {
  assert.equal(opacidadeValida(10), true);
  assert.equal(opacidadeValida(100), true);
  assert.equal(opacidadeValida(9), false);
  assert.equal(opacidadeValida(101), false);
  assert.equal(opacidadeValida(40.5), false);
});

test("primeiro que cabe: do maior para o menor, e nulo quando nem o menor cabe", async () => {
  const chamadas: number[] = [];
  const grande = (largura: number) => { chamadas.push(largura); return PREFIXO_DO_FUNDO + "A".repeat(largura > 1500 ? LIMITE_DO_FUNDO : 1000); };
  const achado = await primeiroQueCabe(grande);
  assert.equal(achado?.length, PREFIXO_DO_FUNDO.length + 1000);
  assert.deepEqual(chamadas, [1800, 1800, 1400], "tenta o maior, a qualidade menor, e só então reduz a largura");
  assert.equal(await primeiroQueCabe(() => PREFIXO_DO_FUNDO + "A".repeat(LIMITE_DO_FUNDO)), null, "nenhum cabe");
  let vezes = 0;
  await primeiroQueCabe(async () => { vezes += 1; return PREFIXO_DO_FUNDO + "A".repeat(LIMITE_DO_FUNDO); });
  assert.equal(vezes, TENTATIVAS_DE_TAMANHO.length, "tenta todos antes de desistir");
});

test("a página escolhida fica entre 1 e o total", () => {
  assert.equal(paginaEscolhida("3", 5), 3);
  assert.equal(paginaEscolhida("0", 5), 1);
  assert.equal(paginaEscolhida("9", 5), 5);
  assert.equal(paginaEscolhida("abc", 5), 1);
  assert.equal(paginaEscolhida("2.7", 5), 2);
  assert.equal(paginaEscolhida("1", 0), 1);
});
