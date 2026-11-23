import assert from "node:assert/strict";
import test from "node:test";
import { calcularLayout, conferirLayout } from "../lib/ticketeria/mapa-layout";
import { layoutDoModelo } from "../lib/ticketeria/mapa-layout-editor";
import {
  CORES_DOS_SETORES, ESPACO_ENTRE_SETORES, comCorDoSetor, completarPlanta, comporSala, conferirPlanta, idDoBlocoNaSala, lerPlanta, lerSalaDoMapa, moverSetor, partesDoBlocoNaSala, plantaAutomatica,
  type SetorDesenhado,
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
