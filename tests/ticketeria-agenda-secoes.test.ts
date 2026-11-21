import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AgendaDoSite } from "../components/ticketeria/AgendaDoSite";
import {
  agendaDosEventos, agruparPorMes, botaoDoItem, corDoEspaco, diasComSessao, filtrarAgenda, filtrosDaAgenda, gradeDoMes, linhasDaAgenda, partesDoInstante, periodoDoItem, seloDoItem, type ItemDaAgenda,
} from "../lib/ticketeria/evento-site";
import type { EventoNaApi, SessaoNaApi } from "../lib/ticketeria/integracao";
import { LAYOUTS_DA_AGENDA, ROTULO_DO_LAYOUT_DA_AGENDA, lerBloco } from "../lib/ticketeria/site";

// A biblioteca de seções, passo 2: a Agenda em cinco layouts (carrossel, grade, lista por mês, calendário do mês, com filtros). Desenhos aprovados pelo dono em 20/11/2026.

const AGORA = Date.parse("2026-11-20T15:00:00.000Z");
const sessao = (id: string, inicio: string, extra: Partial<SessaoNaApi> = {}): SessaoNaApi => ({ id, inicio, quando: "Sábado, 28 de novembro, às 20h", local: "Teatro Municipal, Sorocaba/SP", local_nome: "Teatro Municipal", estado: "aberta", a_partir_de_centavos: 4000, poucos: false, url: `https://jards.com.br/comprar/${id}`, ...extra } as SessaoNaApi);
const evento = (slug: string, titulo: string, sessoes: SessaoNaApi[], extra: Partial<EventoNaApi> = {}): EventoNaApi => ({ id: slug, slug, titulo, descricao: `Sobre ${titulo}.`, classificacao: null, imagem: null, sessoes, ...extra });
const EVENTOS = [
  evento("hamlet", "Hamlet", [sessao("h1", "2026-11-28T23:00:00.000Z"), sessao("h2", "2026-11-29T21:00:00.000Z", { poucos: true }), sessao("h3", "2026-12-05T23:00:00.000Z")]),
  evento("mar", "Mar de Dentro", [sessao("m1", "2026-12-05T22:00:00.000Z", { estado: "esgotada", a_partir_de_centavos: null, local_nome: "Sala Azul", local: "Sala Azul, Sorocaba/SP" })]),
  evento("cabare", "Cabaré dos Esquecidos", [sessao("c1", "2026-12-12T23:30:00.000Z", { local_nome: "Sala Azul", local: "Sala Azul, Sorocaba/SP" })], { imagem: "https://a.com/capa.jpg" }),
];
const itens = agendaDosEventos(EVENTOS);
const html = (layout: (typeof LAYOUTS_DA_AGENDA)[number], extra: { itens?: ItemDaAgenda[]; semLinks?: boolean; base?: string } = {}) =>
  renderToStaticMarkup(createElement(AgendaDoSite, { titulo: "Em cartaz", layout, itens: extra.itens ?? itens, base: extra.base ?? "", semLinks: extra.semLinks ?? false, agora: AGORA }));

test("o bloco Agenda: cinco layouts; sem layout é a grade; layout que não existe é recusado; o título segue até 120 letras", () => {
  assert.deepEqual([...LAYOUTS_DA_AGENDA], ["carrossel", "grade", "lista", "calendario", "filtros"]);
  for (const l of LAYOUTS_DA_AGENDA) { assert.deepEqual(lerBloco({ tipo: "agenda", titulo: "Em cartaz", layout: l }), { ok: true, bloco: { tipo: "agenda", titulo: "Em cartaz", layout: l } }); assert.ok(ROTULO_DO_LAYOUT_DA_AGENDA[l].nome.length > 3 && ROTULO_DO_LAYOUT_DA_AGENDA[l].frase.length > 10, l); }
  assert.equal(lerBloco({ tipo: "agenda", titulo: "" }).ok && (lerBloco({ tipo: "agenda", titulo: "" }) as { bloco: { layout: string } }).bloco.layout, "grade");
  assert.equal(lerBloco({ tipo: "agenda", titulo: "", layout: "mosaico" }).ok, false);
  assert.equal(lerBloco({ tipo: "agenda", titulo: "", layout: 7 }).ok, false);
  assert.equal(lerBloco({ tipo: "agenda", titulo: "x".repeat(121), layout: "lista" }).ok, false);
});

test("o dia e a hora no horário de Brasília: 22h de sábado em Brasília ainda é sábado, mesmo já sendo domingo em UTC", () => {
  assert.deepEqual(partesDoInstante("2026-11-29T01:00:00.000Z"), { ano: 2026, mes: 10, dia: 28, semana: 6, hora: 22, minuto: 0 });
  assert.deepEqual(partesDoInstante("2026-12-12T23:30:00.000Z"), { ano: 2026, mes: 11, dia: 12, semana: 6, hora: 20, minuto: 30 });
  assert.equal(partesDoInstante("lixo"), null);
});

test("o selo e o botão do cartão: esgotado leva à lista de espera; poucos ingressos vira 'Últimos ingressos'; o resto, nada", () => {
  const [hamlet, mar, cabare] = itens;
  assert.deepEqual(seloDoItem(hamlet), { texto: "Últimos ingressos", tom: "poucos" });
  assert.deepEqual(seloDoItem(mar), { texto: "Esgotado", tom: "esgotado" });
  assert.equal(seloDoItem(cabare), null);
  assert.deepEqual(botaoDoItem("aberta"), { texto: "Datas e ingressos", forte: true });
  assert.deepEqual(botaoDoItem("esgotado"), { texto: "Lista de espera", forte: false });
  assert.deepEqual(botaoDoItem("indisponivel"), { texto: "Ver o evento", forte: false });
});

test("o período: uma data só, 'Em cartaz até' quando já começou, ou 'de tal dia a tal dia'", () => {
  const [hamlet, mar] = itens;
  assert.equal(periodoDoItem(mar, AGORA), "Sáb, 5 de dezembro");
  assert.equal(periodoDoItem(hamlet, AGORA), "28 nov a 5 dez");
  assert.equal(periodoDoItem(hamlet, Date.parse("2026-11-29T12:00:00.000Z")), "Em cartaz até 5 de dezembro");
  assert.equal(periodoDoItem({ lista: [] }, AGORA), null);
});

test("as linhas, os meses, o calendário e os filtros saem dos eventos", () => {
  const linhas = linhasDaAgenda(itens);
  assert.deepEqual(linhas.map(l => l.sessao.id), ["h1", "h2", "h3", "m1", "c1"].sort((a, b) => Date.parse(EVENTOS.flatMap(e => e.sessoes).find(x => x.id === a)!.inicio) - Date.parse(EVENTOS.flatMap(e => e.sessoes).find(x => x.id === b)!.inicio)), "todas as sessões, em ordem de data");
  assert.equal(linhas.length, 5);
  assert.deepEqual(linhas.map(l => Date.parse(l.sessao.inicio)), [...linhas.map(l => Date.parse(l.sessao.inicio))].sort((a, b) => a - b), "em ordem de data");
  assert.deepEqual([linhas[0].dia, linhas[0].semana, linhas[0].hora], ["28", "sáb", "20h"]);
  assert.equal(linhas.find(l => l.sessao.id === "c1")?.hora, "20h30");
  const meses = agruparPorMes(linhas, 2026);
  assert.deepEqual(meses.map(m => [m.titulo, m.linhas.length]), [["Novembro", 2], ["Dezembro", 3]]);
  assert.equal(agruparPorMes(linhas, 2025)[0].titulo, "Novembro de 2026", "fora do ano de hoje, o ano aparece");
  assert.deepEqual(gradeDoMes(2026, 10), { vazios: 6, dias: 30, titulo: "Novembro de 2026" }, "1º de novembro de 2026 é domingo: seis espaços antes, porque a semana começa na segunda");
  assert.deepEqual(gradeDoMes(2026, 11), { vazios: 1, dias: 31, titulo: "Dezembro de 2026" });
  const dez = diasComSessao(linhas, 2026, 11);
  assert.deepEqual([...dez.keys()].sort((a, b) => a - b), [5, 12]);
  assert.equal(dez.get(5)?.length, 2, "duas sessões no mesmo dia");
  const f = filtrosDaAgenda(linhas, 2026);
  assert.deepEqual(f.meses.map(m => m.chave), ["2026-11", "2026-12"]);
  assert.deepEqual(f.espacos, ["Teatro Municipal", "Sala Azul"]);
});

test("filtrar: por mês, por espaço e por nome (sem acento e sem maiúscula); o evento fica se alguma sessão passa", () => {
  const nomes = (r: ItemDaAgenda[]) => r.map(i => i.slug);
  assert.deepEqual(nomes(filtrarAgenda(itens, { mes: null, espaco: null, busca: "" })), ["hamlet", "mar", "cabare"]);
  assert.deepEqual(nomes(filtrarAgenda(itens, { mes: "2026-11", espaco: null, busca: "" })), ["hamlet"]);
  assert.deepEqual(nomes(filtrarAgenda(itens, { mes: null, espaco: "Sala Azul", busca: "" })), ["mar", "cabare"]);
  assert.deepEqual(nomes(filtrarAgenda(itens, { mes: "2026-12", espaco: "Sala Azul", busca: "cabare" })), ["cabare"]);
  assert.deepEqual(nomes(filtrarAgenda(itens, { mes: null, espaco: null, busca: "CABARÉ" })), ["cabare"]);
  assert.deepEqual(nomes(filtrarAgenda(itens, { mes: "2026-11", espaco: "Sala Azul", busca: "" })), []);
});

test("a cor de cada espaço é sempre a mesma", () => {
  assert.equal(corDoEspaco("Sala Azul"), corDoEspaco("Sala Azul"));
  assert.match(corDoEspaco("Teatro Municipal"), /^#[0-9A-F]{6}$/);
  assert.ok(new Set(["Sala Azul", "Sala Verde", "Teatro Municipal", "Palco 2", "Foyer", "Praça"].map(corDoEspaco)).size >= 3, "espaços diferentes não caem todos na mesma cor");
});

test("grade: cartões com título, período, botão que diz o que acontece, selos e a cor do espaço; os links levam à página do evento", () => {
  const h = html("grade");
  for (const t of ["Em cartaz", "Hamlet", "Mar de Dentro", "Últimos ingressos", "Esgotado", "Lista de espera", "Datas e ingressos", "28 nov a 5 dez", 'href="/e/hamlet"', 'href="/e/mar"', "Sala Azul"]) assert.ok(h.includes(t), t);
  assert.ok(h.includes('src="https://a.com/capa.jpg"'), "a imagem do evento");
  assert.ok(h.includes("linear-gradient"), "sem imagem, um fundo de cor em vez de cinza");
});

test("carrossel: cartões em fila com a sinopse e as setas", () => {
  const h = html("carrossel");
  for (const t of ["Sobre Hamlet.", "Datas e ingressos", "Mostrar os próximos", "Mostrar os anteriores", "snap-x"]) assert.ok(h.includes(t), t);
});

test("lista por mês: uma linha por sessão, agrupada por mês, com o dia, o horário e o botão da sessão (comprar, lista de espera)", () => {
  const h = html("lista");
  for (const t of ["Novembro", "Dezembro", ">28<", "sáb", "20h30", "Comprar", "Lista de espera", 'href="https://jards.com.br/comprar/h1"', 'target="_blank"']) assert.ok(h.includes(t), t);
  assert.equal(h.includes('href="https://jards.com.br/comprar/m1"'), true, "a sessão esgotada leva à lista de espera da compra");
});

test("calendário do mês: o mês da primeira sessão, os dias marcados e a lista do primeiro dia", () => {
  const h = html("calendario");
  for (const t of ["Novembro de 2026", "Mês anterior", "Próximo mês", "28: 1 sessão", "29: 1 sessão", "Sáb, 28 de novembro", "Hamlet"]) assert.ok(h.includes(t), t);
  assert.ok(h.includes('aria-pressed="true"'), "um dia escolhido");
});

test("com filtros: meses, espaços e busca; todos os eventos até a pessoa filtrar", () => {
  const h = html("filtros");
  for (const t of ["Todos os meses", "Novembro", "Dezembro", "Todos os espaços", "Teatro Municipal", "Sala Azul", 'aria-label="Buscar por nome"', "Hamlet", "Cabaré dos Esquecidos"]) assert.ok(h.includes(t), t);
});

test("na prévia (sem links) nada leva a lugar nenhum; sem evento, a frase de espera", () => {
  for (const l of LAYOUTS_DA_AGENDA) {
    const h = html(l, { semLinks: true, base: "/previa-site/s1" });
    assert.equal(h.includes('href="/previa-site'), false, `${l}: sem link para a página do evento`);
    assert.equal(h.includes('href="/e/'), false, l);
    assert.equal(h.includes("jards.com.br/comprar"), false, `${l}: nem para a compra`);
  }
  for (const l of LAYOUTS_DA_AGENDA) assert.ok(html(l, { itens: [] }).includes("Nenhum evento em cartaz por enquanto"), l);
});

test("o editor: escolher o layout por miniaturas, e o resumo do bloco diz qual", () => {
  const folha = readFileSync("components/ticketeria/BlocosNovosSheet.tsx", "utf8");
  for (const t of ["MiniaturaDaAgenda", "Como mostrar os eventos", "LAYOUTS_DA_AGENDA.map", 'type="radio"', "layoutAgenda", 'case "agenda": return { tipo, titulo, layout: layoutAgenda }']) assert.ok(folha.includes(t), t);
  const editor = readFileSync("components/ticketeria/EditorDoSite.tsx", "utf8");
  assert.ok(editor.includes("ROTULO_DO_LAYOUT_DA_AGENDA[bloco.layout].nome"));
  const view = readFileSync("components/ticketeria/SiteView.tsx", "utf8");
  assert.ok(view.includes("<AgendaDoSite titulo={bloco.titulo} layout={bloco.layout}"));
  assert.ok(!/from "node:|server-only/.test(readFileSync("components/ticketeria/AgendaDoSite.tsx", "utf8")), "vai para o navegador");
});
