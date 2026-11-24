import assert from "node:assert/strict";
import test from "node:test";
import { calcularLayout, conferirLayout } from "../lib/ticketeria/mapa-layout";
import { layoutDoModelo } from "../lib/ticketeria/mapa-layout-editor";
import {
  AREA_MAXIMA, AREA_MINIMA, CORES_DOS_SETORES, ESPACO_ENTRE_SETORES, ajustarArea, caminhoDoFundoPelaUrl, caixaDaSala, comTamanhoDaArea, detalheDaArea, comCorDoSetor, comFundo, comOpacidadeDoFundo, completarPlanta, comporSala, conferirPlanta, escalarFundo, fundoNovo, idDoBlocoNaSala, lerPlanta,
  lerSalaDoMapa, moverSetor, partesDoBlocoNaSala, plantaAutomatica, posicionarFundo, urlDoFundo,
  type SetorDesenhado, type SetorEmPe,
} from "../lib/ticketeria/mapa-sala";

const plateia: SetorDesenhado = { id: "11111111-1111-1111-1111-111111111111", nome: "Plateia", layout: layoutDoModelo("tres-blocos") };
const balcao: SetorDesenhado = { id: "22222222-2222-2222-2222-222222222222", nome: "Balcão", layout: layoutDoModelo("corredor") };
const camarote: SetorDesenhado = { id: "33333333-3333-3333-3333-333333333333", nome: "Camarote", layout: layoutDoModelo("continental") };
const lugares = (l: ReturnType<typeof layoutDoModelo>) => calcularLayout(l).lugares.length;

test("a sala arruma os setores um embaixo do outro, sem se tocarem, cada um com a sua cor", () => {
  const planta = plantaAutomatica([plateia, balcao, camarote]);
  assert.equal(planta.setores.length, 3);
  assert.deepEqual(planta.setores.map(s => s.cor), [CORES_DOS_SETORES[0], CORES_DOS_SETORES[1], CORES_DOS_SETORES[2]]);
  const { layout } = comporSala(planta, [plateia, balcao, camarote]);
  assert.equal(lugares(layout), lugares(plateia.layout) + lugares(balcao.layout) + lugares(camarote.layout), "todos os lugares entram");
  assert.deepEqual(conferirLayout(layout), [], "nenhum erro, nem sobreposição");
  assert.deepEqual(conferirPlanta(planta, [plateia, balcao, camarote]), []);
  const y = (id: string) => Math.min(...calcularLayout(layout).lugares.filter(l => l.setor === id).map(l => l.y));
  assert.ok(y(plateia.id) < y(balcao.id) && y(balcao.id) < y(camarote.id), "o primeiro fica mais perto do palco");
  assert.ok(planta.palco && planta.palco.y < y(plateia.id), "o palco fica acima de tudo");
});

test("cada lugar da sala leva o id do seu setor e a chave continua (setor, fileira, número)", () => {
  const planta = plantaAutomatica([plateia, balcao]);
  const { layout, cores } = comporSala(planta, [plateia, balcao]);
  const calculados = calcularLayout(layout).lugares;
  assert.ok(calculados.every(l => l.setor === plateia.id || l.setor === balcao.id));
  assert.equal(cores.get(plateia.id), planta.setores[0].cor);
  const chaves = new Set(calculados.map(l => `${l.setor}|${l.fileira}|${l.numero}`));
  assert.equal(chaves.size, calculados.length, "nenhuma chave repetida, mesmo com fileiras de mesmo nome em setores diferentes");
  const bloco = layout.blocos[0];
  assert.deepEqual(partesDoBlocoNaSala(bloco.id), { setor: plateia.id, bloco: plateia.layout.blocos[0].id });
  assert.equal(idDoBlocoNaSala("a", "b1"), "a:b1");
  assert.equal(partesDoBlocoNaSala("sem-dois-pontos"), null);
});

test("mover um setor leva todos os blocos dele; setor em cima do outro é erro", () => {
  const planta = plantaAutomatica([plateia, balcao]);
  const antes = comporSala(planta, [plateia, balcao]).layout;
  const movida = moverSetor(planta, plateia.id, 3, 0);
  const depois = comporSala(movida, [plateia, balcao]).layout;
  assert.deepEqual(depois.blocos.filter(b => b.setor === plateia.id).map(b => b.x), antes.blocos.filter(b => b.setor === plateia.id).map(b => b.x + 3));
  assert.deepEqual(depois.blocos.filter(b => b.setor === balcao.id).map(b => b.x), antes.blocos.filter(b => b.setor === balcao.id).map(b => b.x), "o outro setor não mexe");
  const emCima = { ...planta, setores: planta.setores.map(e => ({ ...e, y: 0, x: 0 })) };
  assert.deepEqual(conferirPlanta(emCima, [plateia, balcao]), ["setores_sobrepostos"]);
  assert.deepEqual(conferirPlanta({ ...planta, setores: [] }, [plateia, balcao]), ["sem_setores"]);
});

test("completar a planta tira o setor que sumiu e põe o novo embaixo, com a próxima cor livre, sem mexer nos outros", () => {
  const planta = plantaAutomatica([plateia, balcao]);
  const com = completarPlanta(planta, [plateia, balcao, camarote]);
  assert.deepEqual(com.setores.slice(0, 2), planta.setores, "os que já estavam não mudam");
  assert.equal(com.setores[2].setor, camarote.id);
  assert.equal(com.setores[2].cor, CORES_DOS_SETORES[2]);
  assert.deepEqual(conferirPlanta(com, [plateia, balcao, camarote]), []);
  const sem = completarPlanta(com, [plateia, camarote]);
  assert.deepEqual(sem.setores.map(s => s.setor), [plateia.id, camarote.id]);
  assert.equal(completarPlanta(planta, [plateia, balcao]), planta, "nada a mudar devolve a mesma planta");
  assert.equal(completarPlanta(null, [plateia]).setores.length, 1);
  assert.ok(ESPACO_ENTRE_SETORES > 1);
});

test("a cor do setor só aceita #RRGGBB", () => {
  const planta = plantaAutomatica([plateia]);
  assert.equal(comCorDoSetor(planta, plateia.id, "#112233").setores[0].cor, "#112233");
  assert.equal(comCorDoSetor(planta, plateia.id, "vermelho"), planta);
});

test("lerPlanta confere formato, limites e ids; o que o banco devolve de volta se lê igual", () => {
  const planta = plantaAutomatica([plateia, balcao]);
  assert.deepEqual(lerPlanta(JSON.parse(JSON.stringify(planta))), planta);
  assert.equal(lerPlanta(null), null);
  assert.equal(lerPlanta({ ...planta, versao: 2 }), null);
  assert.equal(lerPlanta({ ...planta, setores: [] }), null);
  assert.equal(lerPlanta({ ...planta, setores: [{ ...planta.setores[0], cor: "azul" }] }), null);
  assert.equal(lerPlanta({ ...planta, setores: [{ ...planta.setores[0], x: 99999 }] }), null);
  assert.equal(lerPlanta({ ...planta, setores: [planta.setores[0], planta.setores[0]] }), null, "setor repetido");
  assert.equal(lerPlanta({ ...planta, setores: [{ ...planta.setores[0], setor: "a:b" }] }), null, "o id do setor não tem dois-pontos");
  assert.equal(lerPlanta({ ...planta, palco: { x: 0, y: 0, largura: 0, altura: 1, rotulo: "P" } }), null);
  assert.equal(lerPlanta({ ...planta, palco: null })?.palco, null);
});

test("lerSalaDoMapa lê a planta e os setores que se desenham, e ignora o setor que não se entende", () => {
  const planta = plantaAutomatica([plateia, balcao]);
  const resposta = JSON.parse(JSON.stringify({ atual: plateia.id, planta, setores: [{ id: plateia.id, nome: "Plateia", layout: plateia.layout }, { id: balcao.id, nome: "Balcão", layout: { versao: 1 } }] }));
  const lida = lerSalaDoMapa(resposta);
  assert.deepEqual(lida?.setores.map(s => s.id), [plateia.id]);
  assert.deepEqual(lida?.setores[0].layout, plateia.layout);
  assert.equal(lida?.atual, plateia.id);
  assert.equal(lerSalaDoMapa({ ...resposta, atual: balcao.id }), null, "o setor da compra tem de estar desenhado");
  assert.equal(lerSalaDoMapa({ ...resposta, atual: undefined }), null);
  assert.equal(lerSalaDoMapa({ planta, setores: [] }), null);
  assert.equal(lerSalaDoMapa({ planta: null, setores: [] }), null);
  assert.equal(lerSalaDoMapa(null), null);
});

const CAMINHO = "0d810000-0000-4000-8000-0000000000a0/0d810000-0000-4000-8000-0000000000b1.webp";

test("o fundo novo cobre o desenho dos setores, centrado, com a proporção da imagem e a opacidade de partida", () => {
  const planta = plantaAutomatica([plateia, balcao]);
  const fundo = fundoNovo(CAMINHO, 2000, 1000, [plateia, balcao], planta);
  assert.equal(fundo.caminho, CAMINHO);
  assert.equal(fundo.opacidade, 40);
  assert.ok(Math.abs(fundo.largura / fundo.altura - 2) < 0.01, "a proporção é a da imagem");
  const lugaresDaSala = calcularLayout(comporSala(planta, [plateia, balcao]).layout).lugares;
  assert.ok(lugaresDaSala.every(l => l.x >= fundo.x && l.x <= fundo.x + fundo.largura && l.y >= fundo.y && l.y <= fundo.y + fundo.altura), "todos os lugares ficam em cima do fundo");
  assert.equal(fundoNovo(CAMINHO, 0, 0, [], { versao: 1, setores: [], palco: null }).largura >= 20, true, "sem setores e sem medidas, ainda dá um fundo");
});

test("a planta com fundo é lida de volta igual, e fundo fora do formato derruba a leitura", () => {
  const base = plantaAutomatica([plateia]);
  const planta = comFundo(base, fundoNovo(CAMINHO, 1600, 900, [plateia], base));
  assert.deepEqual(lerPlanta(JSON.parse(JSON.stringify(planta))), planta);
  assert.equal(lerPlanta(base)?.fundo, undefined, "sem fundo, a planta é a de antes");
  const com = (muda: object) => ({ ...JSON.parse(JSON.stringify(planta)), fundo: { ...planta.fundo, ...muda } });
  assert.equal(lerPlanta(com({ caminho: "../outro/arquivo.webp" })), null, "o caminho tem de ser <organização>/<imagem>.<webp|jpg|png>");
  assert.equal(lerPlanta(com({ caminho: "https://exemplo.com/x.png" })), null, "endereço de fora não vale");
  assert.equal(lerPlanta(com({ opacidade: 5 })), null);
  assert.equal(lerPlanta(com({ opacidade: 40.5 })), null);
  assert.equal(lerPlanta(com({ largura: 0 })), null);
  assert.equal(lerPlanta(com({ x: 99999 })), null);
  assert.equal(lerPlanta({ ...JSON.parse(JSON.stringify(planta)), fundo: "texto" }), null);
  assert.equal(lerPlanta({ ...JSON.parse(JSON.stringify(planta)), fundo: null })?.fundo, undefined, "fundo nulo é sem fundo");
});

test("mover, escalar e a opacidade do fundo: encaixam, mantêm a proporção e ficam nos limites", () => {
  const base = plantaAutomatica([plateia]);
  const planta = comFundo(base, fundoNovo(CAMINHO, 1600, 900, [plateia], base));
  const f = planta.fundo!;
  const movida = posicionarFundo(planta, 3.3, -2.2).fundo!;
  assert.deepEqual([movida.x, movida.y], [3.5, -2], "encaixa em meio lugar");
  const maior = escalarFundo(planta, 1.5).fundo!;
  assert.ok(Math.abs(maior.largura / maior.altura - f.largura / f.altura) < 0.01, "a proporção se mantém");
  assert.ok(Math.abs((maior.x + maior.largura / 2) - (f.x + f.largura / 2)) <= 0.5 && Math.abs((maior.y + maior.altura / 2) - (f.y + f.altura / 2)) <= 0.5, "o centro fica onde estava");
  assert.equal(escalarFundo(planta, 0), planta, "fator inválido não muda nada");
  assert.ok(escalarFundo(planta, 0.0001).fundo!.largura >= 20, "não diminui além de 20");
  assert.ok(escalarFundo(planta, 1000).fundo!.largura <= 4000, "não passa de 4.000");
  assert.equal(comOpacidadeDoFundo(planta, 3).fundo!.opacidade, 10);
  assert.equal(comOpacidadeDoFundo(planta, 400).fundo!.opacidade, 100);
  assert.equal(comOpacidadeDoFundo(planta, 55.4).fundo!.opacidade, 55);
  assert.equal(comOpacidadeDoFundo(base, 50), base, "sem fundo não há o que mudar");
  assert.equal(comFundo(planta, null).fundo, undefined, "tirar o fundo");
});

test("o endereço do fundo vai e volta: o caminho vem da URL pública da biblioteca, e só dela", () => {
  const url = urlDoFundo(CAMINHO, "https://abc.supabase.co/");
  assert.equal(url, `https://abc.supabase.co/storage/v1/object/public/ticketeria-site/${CAMINHO}`);
  assert.equal(caminhoDoFundoPelaUrl(url), CAMINHO);
  assert.equal(caminhoDoFundoPelaUrl(`${url}?v=2`), CAMINHO);
  assert.equal(caminhoDoFundoPelaUrl("https://abc.supabase.co/storage/v1/object/public/outro-espaco/x.webp"), null);
  assert.equal(caminhoDoFundoPelaUrl("https://abc.supabase.co/storage/v1/object/public/ticketeria-site/../../etc/passwd"), null);
});

const pista: SetorEmPe = { id: "44444444-4444-4444-4444-444444444444", nome: "Pista", capacidade: 800 };
const gramado: SetorEmPe = { id: "55555555-5555-5555-5555-555555555555", nome: "Gramado", capacidade: 1 };

test("a sala com pista: a área em pé vem em cima, perto do palco, e nada se toca", () => {
  const planta = plantaAutomatica([plateia, balcao], "Palco", [pista]);
  assert.equal(planta.setores.length, 3);
  assert.equal(planta.setores[0].setor, pista.id, "a pista é a primeira");
  assert.ok(planta.setores[0].area && planta.setores[0].area.largura >= 20 && planta.setores[0].area.altura >= 6);
  assert.equal(planta.setores[1].area, undefined, "os setores numerados não têm área");
  const { layout, areas, cores } = comporSala(planta, [plateia, balcao], [pista]);
  assert.equal(areas.length, 1);
  assert.deepEqual([areas[0].nome, areas[0].detalhe, areas[0].cor], ["Pista", "Em pé · 800 pessoas", planta.setores[0].cor]);
  assert.equal(cores.get(pista.id), areas[0].cor);
  assert.equal(layout.blocos.every(b => b.setor !== pista.id), true, "a pista não vira bloco de lugares");
  assert.deepEqual(conferirPlanta(planta, [plateia, balcao], [pista]), []);
  const caixa = caixaDaSala(layout, areas)!;
  assert.ok(planta.palco && planta.palco.y < caixa.y0, "o palco fica acima de tudo, pista incluída");
  const lugaresY = Math.min(...calcularLayout(layout).lugares.map(l => l.y));
  assert.ok(areas[0].y + areas[0].altura < lugaresY, "a pista fica acima da plateia");
});

test("só com áreas em pé a sala também serve; sem nada, não", () => {
  const planta = plantaAutomatica([], "Palco", [pista, gramado]);
  assert.deepEqual(conferirPlanta(planta, [], [pista, gramado]), []);
  assert.equal(comporSala(planta, [], [pista, gramado]).areas[1].detalhe, "Em pé · 1 pessoa", "singular");
  assert.deepEqual(conferirPlanta({ ...planta, setores: [] }, [], []), ["sem_setores"]);
  assert.deepEqual(conferirPlanta(planta, [], []), ["sem_setores"], "a planta cita a pista, mas a sala já não a tem");
  assert.equal(detalheDaArea(1234), "Em pé · 1.234 pessoas");
});

test("área em cima de área, ou em cima de lugares, é erro", () => {
  const planta = plantaAutomatica([plateia], "Palco", [pista, gramado]);
  const mover = (setor: string, x: number, y: number) => ({ ...planta, setores: planta.setores.map(e => (e.setor === setor ? { ...e, x, y } : e)) });
  const a = planta.setores.find(e => e.setor === pista.id)!;
  assert.deepEqual(conferirPlanta(mover(gramado.id, a.x + 1, a.y + 1), [plateia], [pista, gramado]), ["setores_sobrepostos"], "área sobre área");
  const lugaresDaPlateia = calcularLayout(comporSala(planta, [plateia], [pista, gramado]).layout).lugares;
  assert.deepEqual(conferirPlanta(mover(pista.id, lugaresDaPlateia[0].x - 2, lugaresDaPlateia[0].y - 2), [plateia], [pista, gramado]), ["setores_sobrepostos"], "lugares dentro da área");
});

test("ajustar o tamanho da área: encaixa em meio lugar e fica entre 2 e 400", () => {
  const planta = plantaAutomatica([plateia], "Palco", [pista]);
  const antes = planta.setores[0].area!;
  const maior = ajustarArea(planta, pista.id, 1, 2).setores[0].area!;
  assert.deepEqual([maior.largura, maior.altura], [antes.largura + 1, antes.altura + 2]);
  assert.equal(comTamanhoDaArea(planta, pista.id, 0, 0).setores[0].area!.largura, AREA_MINIMA);
  assert.equal(comTamanhoDaArea(planta, pista.id, 9999, 9999).setores[0].area!.altura, AREA_MAXIMA);
  assert.equal(comTamanhoDaArea(planta, pista.id, 10.3, 7.8).setores[0].area!.largura, 10.5);
  assert.equal(ajustarArea(planta, plateia.id, 1, 1), planta, "setor numerado não tem área");
});

test("completar a planta com pista: a pista que entra vai embaixo, e quem muda de tipo troca de desenho", () => {
  const velha = plantaAutomatica([plateia, balcao]);
  const com = completarPlanta(velha, [plateia, balcao], [pista]);
  assert.deepEqual(com.setores.slice(0, 2), velha.setores, "os que já estavam não mudam");
  assert.equal(com.setores[2].setor, pista.id);
  assert.ok(com.setores[2].area);
  assert.deepEqual(conferirPlanta(com, [plateia, balcao], [pista]), []);
  assert.equal(completarPlanta(com, [plateia, balcao], [pista]), com, "nada a mudar devolve a mesma planta");
  // o balcão virou área em pé
  const virou = completarPlanta(com, [plateia], [pista, { id: balcao.id, nome: "Balcão", capacidade: 300 }]);
  assert.ok(virou.setores.find(e => e.setor === balcao.id)?.area, "o balcão agora é área");
  assert.equal(virou.setores.find(e => e.setor === balcao.id)?.cor, com.setores.find(e => e.setor === balcao.id)?.cor, "e mantém a cor");
  // a pista virou numerada
  const voltou = completarPlanta(com, [plateia, balcao, { ...camarote, id: pista.id }], []);
  assert.equal(voltou.setores.find(e => e.setor === pista.id)?.area, undefined, "a pista, agora numerada, perde a área");
  // a pista sumiu
  assert.equal(completarPlanta(com, [plateia, balcao], []).setores.some(e => e.setor === pista.id), false);
});

test("a planta com área é lida de volta igual, e área fora do limite derruba a leitura", () => {
  const planta = plantaAutomatica([plateia], "Palco", [pista]);
  assert.deepEqual(lerPlanta(JSON.parse(JSON.stringify(planta))), planta);
  const com = (area: unknown) => ({ ...JSON.parse(JSON.stringify(planta)), setores: [{ ...planta.setores[0], area }, planta.setores[1]] });
  assert.equal(lerPlanta(com({ largura: 1, altura: 10 })), null);
  assert.equal(lerPlanta(com({ largura: 10, altura: 401 })), null);
  assert.equal(lerPlanta(com("grande")), null);
  assert.equal(lerPlanta(com(null))?.setores[0].area, undefined, "área nula é sem área");
});

test("lerSalaDoMapa traz os setores em pé, e ignora o que não se entende", () => {
  const planta = plantaAutomatica([plateia], "Palco", [pista]);
  const base = { atual: plateia.id, planta, setores: [{ id: plateia.id, nome: "Plateia", layout: plateia.layout }] };
  const lida = lerSalaDoMapa(JSON.parse(JSON.stringify({ ...base, em_pe: [{ id: pista.id, nome: "Pista", capacidade: 800 }, { id: "x", nome: "Ruim", capacidade: 0 }, { id: 3 }] })));
  assert.deepEqual(lida?.emPe, [pista]);
  assert.deepEqual(lerSalaDoMapa(JSON.parse(JSON.stringify(base)))?.emPe, [], "sem a chave, nenhum setor em pé");
});

test("o fundo novo também cobre as áreas em pé", () => {
  const planta = plantaAutomatica([plateia], "Palco", [pista]);
  const fundo = fundoNovo(CAMINHO, 1600, 900, [plateia], planta, [pista]);
  const a = comporSala(planta, [plateia], [pista]).areas[0];
  assert.ok(a.x >= fundo.x && a.x + a.largura <= fundo.x + fundo.largura && a.y >= fundo.y && a.y + a.altura <= fundo.y + fundo.altura);
});
