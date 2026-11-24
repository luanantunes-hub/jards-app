import { test } from "node:test";
import assert from "node:assert/strict";
import { FATOR_BASE, HORAS_SEM_SUBIR, REGRA_PADRAO, aplicarFator, limitesDoFator, proximoFator, textoDoFator, type RegraDinamica } from "@/lib/ticketeria/preco-dinamico";
import type { DirecaoDoPreco } from "@/lib/ticketeria/precificacao";

// A conta do fator do preço dinâmico (plano da Ticketeria, seção 11, P2).

const REGRA: RegraDinamica = { ativo: true, ...REGRA_PADRAO }; // -20%, +30%, passo 10%, intervalo 360 min
const passo = (direcao: DirecaoDoPreco, fatorAtualBps = FATOR_BASE, extra: { horasAteASessao?: number; minutosDesdeAUltima?: number | null; regra?: RegraDinamica } = {}) =>
  proximoFator({ regra: extra.regra ?? REGRA, fatorAtualBps, direcao, horasAteASessao: extra.horasAteASessao ?? 200, minutosDesdeAUltima: extra.minutosDesdeAUltima ?? null });

test("os limites são o piso e o teto sobre o preço-base", () => {
  assert.deepEqual(limitesDoFator(REGRA), { min: 8000, max: 13000 });
});

test("subir move um passo para cima, baixar um passo para baixo, manter e sem comparação ficam", () => {
  assert.equal(passo("subir").fatorBps, 11000);
  assert.equal(passo("baixar").fatorBps, 9000);
  for (const d of ["manter", "sem_comparacao"] as const) { const r = passo(d, 11000); assert.equal(r.fatorBps, 11000); assert.equal(r.mudou, false); }
});

test("não passa do teto nem do piso", () => {
  assert.equal(passo("subir", 12500).fatorBps, 13000, "o último passo corta no teto");
  const noTeto = passo("subir", 13000);
  assert.equal(noTeto.fatorBps, 13000);
  assert.equal(noTeto.mudou, false);
  assert.match(noTeto.motivo, /teto/);
  assert.equal(passo("baixar", 8500).fatorBps, 8000);
  assert.match(passo("baixar", 8000).motivo, /piso/);
});

test("nas últimas 48 horas o preço não sobe, mas pode baixar", () => {
  const r = passo("subir", 11000, { horasAteASessao: HORAS_SEM_SUBIR });
  assert.equal(r.fatorBps, 11000);
  assert.match(r.motivo, /só pode baixar/);
  assert.equal(passo("subir", 11000, { horasAteASessao: HORAS_SEM_SUBIR + 1 }).fatorBps, 12000, "com 49 horas ainda sobe");
  assert.equal(passo("baixar", 11000, { horasAteASessao: 5 }).fatorBps, 10000, "e baixar vale até o fim");
});

test("só mexe depois do intervalo desde a última mudança", () => {
  assert.equal(passo("subir", 11000, { minutosDesdeAUltima: 359 }).mudou, false);
  assert.equal(passo("subir", 11000, { minutosDesdeAUltima: 360 }).fatorBps, 12000);
  assert.match(passo("subir", 11000, { minutosDesdeAUltima: 10 }).motivo, /Aguardando o intervalo/);
});

test("se o produtor estreita a faixa, o fator entra nela na hora, sem esperar o intervalo", () => {
  const estreita: RegraDinamica = { ...REGRA, tetoBps: 500 };
  const r = passo("manter", 12000, { regra: estreita, minutosDesdeAUltima: 1 });
  assert.equal(r.fatorBps, 10500);
  assert.equal(r.mudou, true);
});

test("o preço com fator: arredonda, nunca abaixo de 1 centavo, e zero fica zero", () => {
  assert.equal(aplicarFator(6000, 11000), 6600);
  assert.equal(aplicarFator(6001, 11000), 6601);
  assert.equal(aplicarFator(5, 1000), 1);
  assert.equal(aplicarFator(0, 13000), 0);
  assert.equal(aplicarFator(6000, FATOR_BASE), 6000);
});

test("o fator em frase", () => {
  assert.deepEqual([FATOR_BASE, 11000, 9000, 10550, 8750].map(textoDoFator), ["preço-base", "+10%", "−10%", "+5,5%", "−12,5%"]);
});

import { PONTOS_DO_ACEITE, lerRegraDaTela } from "@/lib/ticketeria/preco-dinamico";

test("a regra digitada: piso e teto em %, passo em %, intervalo em horas (vira pontos-base e minutos)", () => {
  assert.deepEqual(lerRegraDaTela({ piso: "20", teto: "30", passo: "10", intervaloHoras: "6" }), { ok: true, pisoBps: -2000, tetoBps: 3000, passoBps: 1000, intervaloMinutos: 360 });
  assert.deepEqual(lerRegraDaTela({ piso: "0", teto: "12,5", passo: "2,5", intervaloHoras: "0,5" }), { ok: true, pisoBps: 0, tetoBps: 1250, passoBps: 250, intervaloMinutos: 30 });
});

test("fora dos limites ou em branco, a regra é recusada com a frase do campo", () => {
  const ok = { piso: "20", teto: "30", passo: "10", intervaloHoras: "6" };
  for (const [campo, ruim, frase] of [["piso", "91", /baixar/], ["piso", "", /baixar/], ["teto", "1001", /subir/], ["passo", "0,5", /mudança/], ["passo", "51", /mudança/], ["intervaloHoras", "0,4", /intervalo/], ["intervaloHoras", "25", /intervalo/], ["teto", "abc", /subir/]] as const) {
    const r = lerRegraDaTela({ ...ok, [campo]: ruim });
    assert.ok(!r.ok, `${campo}=${ruim}`);
    assert.match(r.ok ? "" : r.erro, frase);
  }
});

test("o texto do aceite fala de comissão, lei de incentivo, 48 horas e de desligar", () => {
  const texto = PONTOS_DO_ACEITE.join(" ");
  assert.match(texto, /comissão do Jards/);
  assert.match(texto, /lei de incentivo/);
  assert.match(texto, /48 horas/);
  assert.match(texto, /desligar/);
});
