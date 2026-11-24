import assert from "node:assert/strict";
import test from "node:test";
import { calcularLayout, conferirLayout, type Layout } from "../lib/ticketeria/mapa-layout";
import { layoutDoModelo, maisUmCamarote, maisUmaMesa } from "../lib/ticketeria/mapa-layout-editor";
import { lerPlanta } from "../lib/ticketeria/mapa-sala";
import {
  acrescentarSetorDeFileiras, ajustarPista, atribuirSetor, comCoresCompletas, conferirDesenho, desenhoDaPlanta, desenhoVazio, distribuirPorSetor, lugaresPorSetor, maisUmaPista, plantaDoDesenho,
  acrescentarModelo, comFundoNoDesenho, comPalcoDoDesenho, escalarFundoDoDesenho, fundoNovoDoDesenho, opacidadeDoFundoDoDesenho, posicionarFundoDoDesenho, posicionarPista, tirarPista, type DesenhoDaSala,
} from "../lib/ticketeria/desenho-da-sala";

const PLATEIA = "11111111-1111-1111-1111-111111111111";
const BALCAO = "22222222-2222-2222-2222-222222222222";
const PISTA = "44444444-4444-4444-4444-444444444444";
const setores = [{ id: PLATEIA, nome: "Plateia" }, { id: BALCAO, nome: "Balcão" }, { id: PISTA, nome: "Pista" }];
const doModelo = (m: Parameters<typeof layoutDoModelo>[0]): DesenhoDaSala => ({ ...layoutDoModelo(m), areas: [], cores: {} });
const chaves = (l: Layout) => calcularLayout(l).lugares.map(x => `${x.setor}|${x.fileira}|${x.numero}|${x.x}|${x.y}`).sort();

test("atribuir o setor: os blocos ganham o setor, e blocos que repetiriam lugares ganham fileiras novas", () => {
  const d = doModelo("corredor");
  const dois = { ...d, blocos: [...d.blocos, { ...d.blocos[0], id: "b2", x: 30 }] }; // dois blocos iguais: A..H de 1 a 14, os dois
  const atribuido = atribuirSetor(dois, ["b1", "b2"], PLATEIA);
  assert.deepEqual(atribuido.blocos.map(b => b.setor), [PLATEIA, PLATEIA]);
  assert.deepEqual(atribuido.blocos[0].fileiras.map(f => f.nome), ["A", "B", "C", "D", "E", "F", "G", "H"], "o primeiro bloco fica como estava");
  assert.deepEqual(atribuido.blocos[1].fileiras.map(f => f.nome), ["I", "J", "K", "L", "M", "N", "O", "P"], "o segundo continua as fileiras do setor");
  assert.deepEqual(conferirLayout({ versao: 1, blocos: atribuido.blocos, palco: null }), []);
  // setores diferentes não brigam por nome
  const separado = atribuirSetor(atribuirSetor(dois, ["b1"], PLATEIA), ["b2"], BALCAO);
  assert.deepEqual(separado.blocos[1].fileiras.map(f => f.nome)[0], "A", "a Plateia e o Balcão podem ter, cada um, a sua fileira A");
  assert.equal(atribuirSetor(dois, ["b1"], null).blocos[0].setor, null, "null tira o setor");
});

test("blocos que continuam a mesma fileira com números diferentes (esquerda, centro e direita) ficam como estão", () => {
  const d = doModelo("tres-blocos");
  const atribuido = atribuirSetor(d, d.blocos.map(b => b.id), PLATEIA);
  assert.deepEqual(atribuido.blocos.map(b => b.fileiras[0].nome), d.blocos.map(b => b.fileiras[0].nome), "os nomes não mudam");
  assert.equal(atribuido, atribuirSetor(atribuido, d.blocos.map(b => b.id), PLATEIA), "atribuir de novo o mesmo setor não muda nada");
});

test("mesa e camarote atribuídos a um setor não são renomeados", () => {
  let d = doModelo("corredor");
  d = { ...d, ...maisUmCamarote(maisUmaMesa(d)) };
  const todos = d.blocos.map(b => b.id);
  const atribuido = atribuirSetor(d, todos, PLATEIA);
  assert.deepEqual(atribuido.blocos.slice(1).map(b => b.fileiras[0].nome), ["M1", "C1"]);
});

test("a conferência do desenho: vazio, bloco sem setor, setor que sumiu, setor com lugares e pista, pistas em cima de coisas", () => {
  assert.deepEqual(conferirDesenho(desenhoVazio(), setores), ["vazio"]);
  const d = doModelo("corredor");
  assert.deepEqual(conferirDesenho(d, setores), ["bloco_sem_setor"]);
  const ok = atribuirSetor(d, ["b1"], PLATEIA);
  assert.deepEqual(conferirDesenho(ok, setores), []);
  assert.deepEqual(conferirDesenho(ok, [{ id: BALCAO, nome: "Balcão" }]), ["setor_desconhecido"]);
  const comPista = maisUmaPista(ok, PISTA, 800);
  assert.deepEqual(conferirDesenho(comPista, setores), []);
  assert.deepEqual(conferirDesenho({ ...comPista, areas: [{ ...comPista.areas[0], setor: PLATEIA }] }, setores), ["setor_misto"]);
  const sobre = { ...comPista, areas: [{ ...comPista.areas[0], x: calcularLayout({ versao: 1, blocos: ok.blocos, palco: null }).lugares[0].x - 2, y: calcularLayout({ versao: 1, blocos: ok.blocos, palco: null }).lugares[0].y - 2 }] };
  assert.deepEqual(conferirDesenho(sobre, setores), ["pistas_sobrepostas"]);
  assert.deepEqual(conferirDesenho(maisUmaPista(desenhoVazio(), PISTA, 100), setores), [], "só uma pista também serve");
});

test("a pista: uma por setor, ajustável, movível, e sai quando se tira", () => {
  const d = maisUmaPista(desenhoVazio(), PISTA, 800);
  assert.equal(d.areas.length, 1);
  assert.ok(d.areas[0].largura >= 20 && d.areas[0].altura >= 6);
  assert.equal(maisUmaPista(d, PISTA, 800), d, "o mesmo setor não ganha duas pistas");
  const maior = ajustarPista(d, PISTA, 2, 3).areas[0];
  assert.deepEqual([maior.largura, maior.altura], [d.areas[0].largura + 2, d.areas[0].altura + 3]);
  assert.equal(ajustarPista(d, PISTA, -999, -999).areas[0].largura, 2);
  assert.deepEqual([posicionarPista(d, PISTA, 3.3, -2.2).areas[0].x, posicionarPista(d, PISTA, 3.3, -2.2).areas[0].y], [3.5, -2]);
  assert.equal(tirarPista(d, PISTA).areas.length, 0);
  const abaixo = maisUmaPista(atribuirSetor(doModelo("corredor"), ["b1"], PLATEIA), PISTA, 200).areas[0];
  assert.ok(abaixo.y > Math.max(...calcularLayout({ versao: 1, blocos: atribuirSetor(doModelo("corredor"), ["b1"], PLATEIA).blocos, palco: null }).lugares.map(l => l.y)), "a pista nova vai embaixo do que já está desenhado");
});

test("salvar distribui o desenho: cada setor recebe os seus blocos e as suas fileiras, e a planta leva as pistas e as cores", () => {
  let d = doModelo("tres-blocos");
  d = atribuirSetor(d, d.blocos.map(b => b.id), PLATEIA);
  d = { ...d, ...maisUmCamarote(d) };
  d = atribuirSetor(d, [d.blocos.at(-1)!.id], BALCAO);
  d = maisUmaPista(d, PISTA, 800);
  d = comCoresCompletas(d, setores);
  const partes = distribuirPorSetor(d);
  assert.deepEqual(partes.map(p => p.setor), [PLATEIA, BALCAO]);
  for (const p of partes) {
    assert.deepEqual(conferirLayout(p.layout), [], `o layout de ${p.setor} serve sozinho`);
    assert.ok(p.layout.blocos.every(b => b.setor === null), "o layout do setor não leva o id do setor (é assim que o banco o quer)");
    assert.equal(p.fileiras.flatMap(f => f.assentos).length, calcularLayout(p.layout).lugares.length);
  }
  assert.equal(partes[0].fileiras.flatMap(f => f.assentos).length + partes[1].fileiras.flatMap(f => f.assentos).length, calcularLayout({ versao: 1, blocos: d.blocos, palco: null }).lugares.length, "nenhum lugar se perde nem se repete");
  const planta = plantaDoDesenho(d);
  assert.deepEqual(lerPlanta(JSON.parse(JSON.stringify(planta))), planta, "a planta é lida de volta igual");
  assert.deepEqual(planta.setores.map(e => e.setor), [PISTA, PLATEIA, BALCAO], "a pista primeiro (é a que o desenho pôs primeiro), depois os setores com lugares");
  assert.ok(planta.setores[0].area && !planta.setores[1].area);
  assert.deepEqual(planta.setores.filter(e => !e.area).map(e => [e.x, e.y]), [[0, 0], [0, 0]], "os setores com lugares ficam na origem: os blocos já levam as posições");
  assert.equal(planta.setores.length, 3);
  assert.equal(new Set(planta.setores.map(e => e.cor)).size, 3, "uma cor para cada setor");
});

test("ida e volta: o que se salva e se abre dá o mesmo desenho (mesmos lugares nas mesmas posições, mesmas pistas e cores)", () => {
  let d = doModelo("balcao");
  d = atribuirSetor(d, [d.blocos[0].id], PLATEIA);
  d = atribuirSetor(d, [d.blocos[1].id], BALCAO);
  d = { ...d, ...maisUmaMesa(d) };
  d = atribuirSetor(d, [d.blocos.at(-1)!.id], PLATEIA);
  d = maisUmaPista(d, PISTA, 500);
  d = comCoresCompletas(d, setores);
  const partes = distribuirPorSetor(d);
  const planta = plantaDoDesenho(d);
  const volta = desenhoDaPlanta(JSON.parse(JSON.stringify(planta)) && lerPlanta(JSON.parse(JSON.stringify(planta)))!, partes.map(p => ({ id: p.setor, nome: p.setor, layout: p.layout })), [{ id: PISTA, nome: "Pista", capacidade: 500 }]);
  assert.deepEqual(chaves(volta), chaves(d), "os lugares, os setores e as posições são os mesmos");
  assert.deepEqual(volta.areas, d.areas);
  assert.deepEqual(volta.cores, d.cores);
  assert.deepEqual(volta.palco, d.palco);
  assert.ok(volta.blocos.every(b => b.id.length <= 30 && /^b\d+$/.test(b.id)), "ids curtos, dentro do limite do banco");
  assert.deepEqual(conferirDesenho(volta, setores), []);
});

test("um setor que ainda é só uma lista de fileiras entra no desenho como um bloco, embaixo de tudo", () => {
  const lista = [{ nome: "A", assentos: [1, 2, 3].map(n => ({ numero: n, estado: "livre" as const })) }, { nome: "B", assentos: [1, 2, 3].map(n => ({ numero: n, estado: "livre" as const })) }];
  const d = atribuirSetor(doModelo("corredor"), ["b1"], PLATEIA);
  const com = acrescentarSetorDeFileiras(d, BALCAO, lista);
  assert.equal(com.blocos.length, 2);
  assert.equal(com.blocos[1].setor, BALCAO);
  assert.deepEqual(com.blocos[1].fileiras.map(f => [f.nome, f.lugares]), [["A", 3], ["B", 3]]);
  assert.deepEqual(conferirDesenho(com, setores), []);
  const abaixo = calcularLayout({ versao: 1, blocos: [com.blocos[1]], palco: null }).caixa.y0 > calcularLayout({ versao: 1, blocos: [com.blocos[0]], palco: null }).caixa.y1;
  assert.ok(abaixo, "fica embaixo");
  assert.equal(acrescentarSetorDeFileiras(com, BALCAO, lista), com, "o setor que já está no desenho não entra de novo");
  const torta = [{ nome: "A", assentos: [{ numero: 1, estado: "livre" as const }, { numero: 3, estado: "livre" as const }] }];
  assert.equal(acrescentarSetorDeFileiras(d, PISTA, torta), d, "uma lista que não cabe como bloco (números pulados) não entra");
});

test("as cores: cada setor ganha uma cor diferente e as que já existiam ficam", () => {
  const d = { ...desenhoVazio(), cores: { [PLATEIA]: "#112233" } };
  const com = comCoresCompletas(d, setores);
  assert.equal(com.cores[PLATEIA], "#112233");
  assert.equal(new Set(Object.values(com.cores)).size, 3);
  assert.equal(comCoresCompletas(com, setores), com, "nada a completar devolve o mesmo desenho");
});

test("lugares por setor", () => {
  let d = doModelo("corredor");
  d = atribuirSetor(d, ["b1"], PLATEIA);
  d = { ...d, ...maisUmaMesa(d) };
  d = atribuirSetor(d, [d.blocos.at(-1)!.id], BALCAO);
  const total = lugaresPorSetor(d);
  assert.equal(total.get(PLATEIA), 8 * 14);
  assert.equal(total.get(BALCAO), 4);
});

test("acrescentar um modelo: os blocos entram à direita, sem setor, com ids novos, e nada se sobrepõe", () => {
  let d = atribuirSetor(doModelo("corredor"), ["b1"], PLATEIA);
  d = acrescentarModelo(d, layoutDoModelo("tres-blocos"));
  assert.equal(d.blocos.length, 4);
  assert.deepEqual(d.blocos.slice(1).map(b => b.setor), [null, null, null]);
  assert.equal(new Set(d.blocos.map(b => b.id)).size, 4, "ids não se repetem");
  assert.ok(d.blocos.every(b => /^b\d+$/.test(b.id)));
  assert.equal(d.blocos[0].setor, PLATEIA, "o que já estava não muda");
  assert.deepEqual(conferirLayout({ versao: 1, blocos: d.blocos.map(b => ({ ...b, setor: null })).map((b, i) => ({ ...b, fileiras: i === 0 ? b.fileiras : b.fileiras })), palco: null }).filter(e => e === "blocos_sobrepostos"), [], "os blocos novos não ficam em cima dos que havia");
  const vazio = acrescentarModelo(desenhoVazio(), layoutDoModelo("corredor"));
  assert.equal(vazio.blocos.length, 1);
  assert.ok(vazio.palco, "o primeiro modelo traz o palco");
});

test("o palco acompanha tudo, pistas incluídas, e a planta de fundo se ajusta sem sair dos limites", () => {
  let d = atribuirSetor(doModelo("corredor"), ["b1"], PLATEIA);
  const sem = comPalcoDoDesenho(d).palco!;
  d = maisUmaPista(d, PISTA, 800);
  d = posicionarPista(d, PISTA, d.areas[0].x, -20);
  const com = comPalcoDoDesenho(d).palco!;
  assert.ok(com.y < sem.y, "com a pista lá em cima, o palco sobe");
  const caminho = "0d810000-0000-4000-8000-0000000000a0/0d810000-0000-4000-8000-0000000000b1.webp";
  const f = fundoNovoDoDesenho(caminho, 1600, 900, d);
  assert.ok(Math.abs(f.largura / f.altura - 1600 / 900) < 0.01 && f.opacidade === 40);
  const com1 = comFundoNoDesenho(d, f);
  assert.equal(escalarFundoDoDesenho(com1, 1000).fundo!.largura, 4000);
  assert.ok(escalarFundoDoDesenho(com1, 0.0001).fundo!.largura >= 20);
  assert.equal(opacidadeDoFundoDoDesenho(com1, 3).fundo!.opacidade, 10);
  assert.deepEqual([posicionarFundoDoDesenho(com1, 3.3, -2.2).fundo!.x, posicionarFundoDoDesenho(com1, 3.3, -2.2).fundo!.y], [3.5, -2]);
  assert.equal(comFundoNoDesenho(com1, null).fundo, undefined);
  assert.equal(escalarFundoDoDesenho(d, 2), d, "sem fundo não há o que escalar");
});
