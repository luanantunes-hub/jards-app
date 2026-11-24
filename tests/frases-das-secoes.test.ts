import assert from "node:assert/strict";
import test from "node:test";
import { escolherFrase } from "../lib/saudacao";
import { FRASES_DAS_SECOES } from "../lib/frases-das-secoes";
import { PACOTES_DE_ILUSTRACOES, PACOTE_ATIVO, caminhoDaIlustracao } from "../lib/pacotes-de-ilustracoes";

const agora = new Date(2026, 10, 18, 10, 0);

test("frases das seções: toda seção tem frase mesmo sem nome nem organização", () => {
  for (const [secao, frases] of Object.entries(FRASES_DAS_SECOES)) {
    const frase = escolherFrase([...frases], { agora }, secao);
    assert.ok(frase, secao);
    assert.doesNotMatch(frase!, /\{/, `${secao}: sobrou marcador`);
  }
});

test("frases das seções: nome entra só pelo primeiro nome e a escolha é fixa no dia", () => {
  const modelos = ["Tudo lido{, nome}?"];
  assert.equal(escolherFrase(modelos, { agora, nome: "Luan Antunes" }), "Tudo lido, Luan?");
  assert.equal(escolherFrase(modelos, { agora, nome: "" }), "Tudo lido?");
  const varias = [...FRASES_DAS_SECOES.atividades];
  const a = escolherFrase(varias, { agora, semente: "u1" }, "atividades");
  assert.equal(escolherFrase(varias, { agora: new Date(2026, 10, 18, 17, 0), semente: "u1" }, "atividades"), a, "mesmo dia, mesma frase");
});

test("frases das seções: frase com {org} só quando a organização tem nome próprio", () => {
  const modelos = ["Deixe o Jards do jeito do time {org}."];
  assert.equal(escolherFrase(modelos, { agora, organizacao: "Platibanda", nome: "Luan" }), "Deixe o Jards do jeito do time Platibanda.");
  assert.equal(escolherFrase(modelos, { agora, organizacao: "Minha organização" }), null);
});

test("ilustração do dia: de 1 ao total do pacote, usa todas no mesmo dia (só as seções que passam do total repetem) e muda no dia seguinte", async () => {
  const { ilustracaoDoDia } = await import("../lib/frases-das-secoes");
  const total = PACOTE_ATIVO.total;
  const secoes = ["painel", ...Object.keys(FRASES_DAS_SECOES)] as Parameters<typeof ilustracaoDoDia>[0][];
  const hoje = secoes.map(s => ilustracaoDoDia(s, agora));
  assert.equal(new Set(hoje).size, Math.min(secoes.length, total), "todas as do pacote aparecem, sem repetir enquanto houver desenho sobrando");
  assert.ok(hoje.slice(0, total).every((n, i) => hoje.indexOf(n) === i), "as primeiras seções, até o total do pacote, não repetem");
  assert.ok(hoje.every(n => n >= 1 && n <= total));
  assert.equal(ilustracaoDoDia("atividades", new Date(2026, 10, 18, 23, 0)), ilustracaoDoDia("atividades", agora), "mesmo dia, mesma ilustração");
  assert.notEqual(ilustracaoDoDia("atividades", new Date(2026, 10, 19, 10, 0)), ilustracaoDoDia("atividades", agora));
});

test("o passo do sorteio nunca tem divisor comum com o total do pacote, e o sorteio percorre qualquer tamanho sem repetir", async () => {
  const { ilustracaoDoDia, passoCoprimo } = await import("../lib/frases-das-secoes");
  assert.equal(passoCoprimo(16, 5), 5);
  assert.equal(passoCoprimo(15, 5), 7, "5 divide 15, então sobe até um passo que serve");
  assert.equal(passoCoprimo(14, 7), 9);
  const secoes = ["painel", ...Object.keys(FRASES_DAS_SECOES)] as Parameters<typeof ilustracaoDoDia>[0][];
  for (const total of [5, 7, 10, 12, 14, 15, 16, 18, 20, 24]) {
    const pacote = { id: "teste", nome: "teste", total };
    const hoje = secoes.map(s => ilustracaoDoDia(s, agora, pacote));
    assert.equal(new Set(hoje).size, Math.min(secoes.length, total), `pacote de ${total}: todas aparecem sem repetir enquanto houver desenho`);
  }
});

test("cada pacote de ilustrações tem a sua pasta, com os arquivos numerados de 01 ao total, sem buraco e sem sobra", async () => {
  const { readdirSync } = await import("node:fs");
  for (const pacote of PACOTES_DE_ILUSTRACOES) {
    const arquivos = readdirSync(new URL(`../public/ilustracoes/${pacote.id}`, import.meta.url)).sort();
    assert.deepEqual(arquivos, Array.from({ length: pacote.total }, (_, i) => `${String(i + 1).padStart(2, "0")}.png`), pacote.nome);
  }
  const pastasDePacote = readdirSync(new URL("../public/ilustracoes", import.meta.url), { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => entrada.name)
    .filter((pasta) => readdirSync(new URL(`../public/ilustracoes/${pasta}`, import.meta.url)).some((arquivo) => /^\d{2}\.png$/.test(arquivo)))
    .sort();
  assert.deepEqual(pastasDePacote, PACOTES_DE_ILUSTRACOES.map((pacote) => pacote.id).sort(), "toda pasta com ilustrações numeradas é um pacote registrado");
});

test("pacotes: o Tamanduá no dia a dia é o ativo, com 15 desenhos, e o endereço de cada um segue a pasta do pacote", () => {
  assert.equal(PACOTE_ATIVO.id, "dia-a-dia");
  assert.equal(PACOTE_ATIVO.nome, "Tamanduá no dia a dia");
  assert.equal(PACOTE_ATIVO.total, 15);
  assert.equal(caminhoDaIlustracao(PACOTE_ATIVO, 3), "/ilustracoes/dia-a-dia/03.png");
  assert.equal(caminhoDaIlustracao(PACOTE_ATIVO, 15), "/ilustracoes/dia-a-dia/15.png");
  assert.equal(new Set(PACOTES_DE_ILUSTRACOES.map((pacote) => pacote.id)).size, PACOTES_DE_ILUSTRACOES.length, "ids únicos");
});

test("o sorteio do dia sempre escolhe dentro do pacote: de 1 ao total dele, qualquer que seja o tamanho", async () => {
  const { ilustracaoDoDia } = await import("../lib/frases-das-secoes");
  const pequeno = { id: "teste", nome: "Pacote de teste", total: 5 };
  for (let dia = 1; dia <= 40; dia++) {
    const n = ilustracaoDoDia("atividades", new Date(2026, 10, dia % 28 + 1), pequeno);
    assert.ok(n >= 1 && n <= 5, `dia ${dia}: ${n}`);
  }
});
