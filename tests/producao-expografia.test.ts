import assert from "node:assert/strict";
import test from "node:test";
import {
  lerObraNaSala, medidasDaObra, mensagemDoErroDeExpografia, ordenarMontagem, pendenciasDaObra, progressoDaMontagem, type ObraNaSala, tamanhoNaPlanta, lugarDaObra, obrasNaPlanta, LADO_MINIMO_M,
} from "../lib/producao/expografia";

const obra = (id: string, ordem: number, instalada: string | null = null, extra: Partial<ObraNaSala> = {}): ObraNaSala => ({ id, item_id: id, posicao: "parede", altura_instalacao_cm: 150, ordem_montagem: ordem, luz: "difusa", lux: null, notas: null, instalada_em: instalada, ...extra });

test("montagem: ordem, progresso e a próxima a instalar", () => {
  const lista = [obra("c", 3), obra("a", 1, "2026-11-20T10:00:00Z"), obra("b", 2), obra("d", 2)];
  assert.deepEqual(ordenarMontagem(lista).map(o => o.id), ["a", "b", "d", "c"]);
  const progresso = progressoDaMontagem(lista);
  assert.deepEqual([progresso.total, progresso.instaladas, progresso.proxima?.id], [4, 1, "b"]);
  assert.equal(progressoDaMontagem([obra("x", 1, "2026-11-20T10:00:00Z")]).proxima, null);
  assert.deepEqual(progressoDaMontagem([]), { total: 0, instaladas: 0, proxima: null });
});

test("medidas: só o que o inventário tem", () => {
  assert.equal(medidasDaObra({ altura_cm: 120, largura_cm: 80, comprimento_cm: 5.5 }), "120 × 80 × 5,5 cm");
  assert.equal(medidasDaObra({ altura_cm: 120, largura_cm: null, comprimento_cm: null }), "120 cm");
  assert.equal(medidasDaObra({ altura_cm: null, largura_cm: null, comprimento_cm: null }), null);
});

test("pendências: altura para parede e teto, lux para luz pontual", () => {
  assert.deepEqual(pendenciasDaObra({ posicao: "parede", altura_instalacao_cm: null, luz: "difusa", lux: null }), ["Falta a altura de instalação"]);
  assert.deepEqual(pendenciasDaObra({ posicao: "teto", altura_instalacao_cm: 300, luz: "pontual", lux: null }), ["Falta o nível de luz (lux)"]);
  assert.deepEqual(pendenciasDaObra({ posicao: "piso", altura_instalacao_cm: null, luz: "sem_luz", lux: null }), []);
  assert.equal(pendenciasDaObra({ posicao: "parede", altura_instalacao_cm: null, luz: "pontual", lux: null }).length, 2);
});

test("obra na sala: o que o banco confere", () => {
  const base = { itemId: "i1", posicao: "parede" as const, altura: " 150 ", ordem: "", luz: "difusa" as const, lux: "", notas: " " };
  assert.deepEqual(lerObraNaSala(base), { ok: true, valor: { item_id: "i1", posicao: "parede", altura_instalacao_cm: 150, ordem_montagem: 0, luz: "difusa", lux: null, notas: null } });
  assert.deepEqual(lerObraNaSala({ ...base, altura: "", lux: "50", ordem: "3", notas: " Longe da janela " }), { ok: true, valor: { item_id: "i1", posicao: "parede", altura_instalacao_cm: null, ordem_montagem: 3, luz: "difusa", lux: 50, notas: "Longe da janela" } });
  const campo = (extra: Partial<typeof base>) => { const l = lerObraNaSala({ ...base, ...extra }); return l.ok ? null : l.campo; };
  assert.equal(campo({ itemId: "" }), "item");
  assert.equal(campo({ altura: "2001" }), "altura");
  assert.equal(campo({ altura: "abc" }), "altura");
  assert.equal(campo({ ordem: "1000" }), "ordem");
  assert.equal(campo({ lux: "100001" }), "lux");
  assert.equal(campo({ notas: "x".repeat(301) }), "notas");
});

test("erros do banco viram frases claras", () => {
  assert.match(mensagemDoErroDeExpografia({ message: "item_nao_e_obra_de_arte" }), /não é uma obra de arte/);
  assert.match(mensagemDoErroDeExpografia({ code: "23505" }), /já está nesta sala/);
  assert.match(mensagemDoErroDeExpografia({ code: "42501" }), /Você não pode/);
  assert.match(mensagemDoErroDeExpografia({}), /Tente de novo/);
});

test("o tamanho da obra na planta vem das medidas do inventário, com um lado mínimo", () => {
  assert.deepEqual(tamanhoNaPlanta({ largura_cm: 120, comprimento_cm: 8 }), { largura_m: 1.2, profundidade_m: 0.4 });
  assert.deepEqual(tamanhoNaPlanta({ largura_cm: null, comprimento_cm: null }), { largura_m: LADO_MINIMO_M, profundidade_m: LADO_MINIMO_M });
  assert.deepEqual(tamanhoNaPlanta({ largura_cm: 250, comprimento_cm: 60 }), { largura_m: 2.5, profundidade_m: 0.6 });
});

test("o lugar da obra encaixa no passo da planta e não sai dela", () => {
  const planta = { largura_m: 10, profundidade_m: 6 };
  const tamanho = { largura_m: 2, profundidade_m: 1 };
  assert.deepEqual(lugarDaObra({ x: 3.34, y: 2.26 }, tamanho, planta), { x_m: 3.3, y_m: 2.3 });
  // Puxada para fora, a obra encosta na borda.
  assert.deepEqual(lugarDaObra({ x: 30, y: 30 }, tamanho, planta), { x_m: 8, y_m: 5 });
  assert.deepEqual(lugarDaObra({ x: -5, y: -5 }, tamanho, planta), { x_m: 0, y_m: 0 });
});

test("as obras se separam entre as que estão na planta e as que ainda não foram postas", () => {
  const obra = (id: string, ordem: number, x: number | null) => ({ id, ordem_montagem: ordem, x_m: x, y_m: x });
  const { postas, fora } = obrasNaPlanta([obra("c", 3, null), obra("a", 1, 2), obra("b", 2, 0)]);
  assert.deepEqual(postas.map(o => o.id), ["a", "b"], "na ordem de montagem");
  assert.deepEqual(fora.map(o => o.id), ["c"]);
  // x_m = 0 é um lugar de verdade (o canto), não "sem lugar".
  assert.equal(obrasNaPlanta([obra("b", 2, 0)]).postas.length, 1);
});
