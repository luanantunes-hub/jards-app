import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { APARENCIA_PADRAO, lerAparencia } from "../lib/ticketeria/aparencia";
import { TEMAS_DO_SITE } from "../lib/ticketeria/estados";
import { IDS_DOS_MODELOS, MODELOS_DE_SITE, ehIdDeModelo, paginasDoModelo } from "../lib/ticketeria/modelos-de-site";
import { MAX_BLOCOS_POR_PAGINA, slugDaPagina } from "../lib/ticketeria/site";

// A biblioteca de seções, passo 5: os modelos de site (Companhia de teatro, Casa de espetáculo, Festival e Em branco). Direção aprovada pelo dono em 20/11/2026.

const AGORA = Date.parse("2026-11-21T12:00:00.000Z");
const ctx = (extra: { nome?: string; espacoId?: string | null } = {}) => ({ nome: extra.nome ?? "Cia de Teatro Aurora", agora: AGORA, espacoId: extra.espacoId ?? null });

test("os modelos: o de começar em branco e os três prontos, cada um com nome, frase, tema que existe, cor, menu, rodapé e páginas", () => {
  assert.deepEqual([...IDS_DOS_MODELOS], ["em_branco", "companhia", "casa", "festival"]);
  for (const id of IDS_DOS_MODELOS) {
    const m = MODELOS_DE_SITE[id];
    assert.equal(m.id, id);
    assert.ok(m.nome.length > 3 && m.frase.length > 20 && m.contem.length > 3, id);
    assert.ok((TEMAS_DO_SITE as readonly string[]).includes(m.tema), `${id}: tema`);
    assert.match(m.cor, /^#[0-9A-Fa-f]{6}$/, `${id}: cor`);
    assert.deepEqual(lerAparencia(m.aparencia), m.aparencia, `${id}: o menu e o rodapé do modelo passam pela leitura sem mudar`);
    assert.ok(m.paginas.length >= 1 && m.paginas[0].slug === "inicio", `${id}: a primeira página é o início`);
  }
  assert.deepEqual(MODELOS_DE_SITE.em_branco.aparencia, APARENCIA_PADRAO);
  assert.equal(ehIdDeModelo("festival"), true);
  assert.equal(ehIdDeModelo("qualquer"), false);
});

test("toda página de todo modelo nasce válida: cada bloco passa pela mesma conferência do editor, os endereços das páginas são os que o editor faria e não passam do limite", () => {
  for (const id of IDS_DOS_MODELOS) {
    const paginas = paginasDoModelo(id, ctx());
    const slugs = paginas.map(p => p.slug);
    assert.equal(new Set(slugs).size, slugs.length, `${id}: endereços únicos`);
    assert.deepEqual(paginas.map(p => p.ordem), paginas.map((_, i) => i), `${id}: a ordem é a do modelo`);
    for (const p of paginas) {
      assert.equal(slugDaPagina(p.titulo), p.slug, `${id}/${p.slug}: o endereço é o que o título geraria`);
      assert.ok(p.blocos.length >= 1 && p.blocos.length <= MAX_BLOCOS_POR_PAGINA, `${id}/${p.slug}`);
    }
  }
});

test("a quantidade de páginas bate com o que a folha promete; o texto de 'o que vem' fala a verdade", () => {
  for (const id of ["companhia", "casa", "festival"] as const) {
    const n = paginasDoModelo(id, ctx()).length;
    assert.ok(MODELOS_DE_SITE[id].contem.startsWith(`${n} páginas`), `${id}: ${MODELOS_DE_SITE[id].contem}`);
  }
  assert.equal(MODELOS_DE_SITE.em_branco.contem, "1 página");
});

test("companhia: o próximo evento no destaque, a agenda em grade, o elenco e as perguntas de ingresso; sem endereço de internet de mentira", () => {
  const paginas = paginasDoModelo("companhia", ctx());
  const inicio = paginas[0].blocos;
  assert.deepEqual(inicio.map(b => (b.tipo === "capa" ? `capa:${b.layout}` : b.tipo === "agenda" ? `agenda:${b.layout}` : b.tipo)), ["capa:proximo", "titulo", "agenda:grade", "titulo", "texto"]);
  assert.deepEqual(paginas.map(p => p.slug), ["inicio", "elenco", "como-chegar", "perguntas", "contato"]);
  const faq = paginas.find(p => p.slug === "perguntas")!.blocos[0];
  assert.ok(faq.tipo === "faq" && faq.itens.length === 4 && faq.itens.some(i => /7 dias/.test(i.resposta)), "a regra de reembolso do Jards (7 dias)");
  assert.equal(MODELOS_DE_SITE.companhia.aparencia.cabecalho.layout, "centralizado");
  const tudo = JSON.stringify(paginas);
  assert.ok(!/https?:\/\//.test(tudo), "nenhum link ou imagem de exemplo: a pessoa coloca os seus");
});

test("casa: calendário no início, programação com filtros, acessibilidade e o rodapé em colunas", () => {
  const paginas = paginasDoModelo("casa", ctx());
  assert.deepEqual(paginas.map(p => p.slug), ["inicio", "programacao", "a-casa", "como-chegar", "perguntas", "contato"]);
  assert.ok(paginas[0].blocos.some(b => b.tipo === "agenda" && b.layout === "calendario"));
  assert.ok(paginas[1].blocos.some(b => b.tipo === "agenda" && b.layout === "filtros"));
  assert.ok(paginas[3].blocos.some(b => b.tipo === "titulo" && b.texto === "Acessibilidade"));
  assert.equal(MODELOS_DE_SITE.casa.aparencia.rodape.layout, "colunas");
  assert.equal(MODELOS_DE_SITE.casa.tema, "classico");
});

test("festival: capa de tela cheia com o nome, a contagem até daqui a 90 dias, a programação em lista e o tema da noite", () => {
  const paginas = paginasDoModelo("festival", ctx({ nome: "Festival de Inverno" }));
  const capa = paginas[0].blocos[0];
  assert.ok(capa.tipo === "capa" && capa.layout === "tela_cheia" && capa.titulo === "Festival de Inverno");
  const contagem = paginas[0].blocos[1];
  assert.ok(contagem.tipo === "contagem" && contagem.ate === new Date(AGORA + 90 * 86_400_000).toISOString() && contagem.depois === "Já começou!");
  assert.ok(paginas[0].blocos.some(b => b.tipo === "agenda" && b.layout === "lista"));
  assert.equal(MODELOS_DE_SITE.festival.tema, "noite");
  assert.equal(MODELOS_DE_SITE.festival.aparencia.cabecalho.layout, "minimo");
});

test("em branco: como sempre foi (título, texto e, se a organização tem espaço na Produção, a programação dele)", () => {
  assert.deepEqual(paginasDoModelo("em_branco", ctx()).map(p => p.blocos.map(b => b.tipo)), [["titulo", "texto"]]);
  assert.deepEqual(paginasDoModelo("em_branco", ctx({ espacoId: "0d760000-0000-4000-8000-0000000000e1" }))[0].blocos.map(b => b.tipo), ["titulo", "texto", "programacao"]);
  assert.equal(paginasDoModelo("em_branco", ctx({ nome: "Teatro Central" }))[0].blocos[0].tipo === "titulo" && (paginasDoModelo("em_branco", ctx({ nome: "Teatro Central" }))[0].blocos[0] as { texto: string }).texto, "Teatro Central");
});

test("um modelo com bloco inválido não nasce calado: lança com o modelo, a página e o bloco", () => {
  const original = MODELOS_DE_SITE.companhia.paginas[0].blocos;
  MODELOS_DE_SITE.companhia.paginas[0].blocos = () => [{ tipo: "titulo", texto: "" }];
  try { assert.throws(() => paginasDoModelo("companhia", ctx()), /modelo companhia, página inicio, bloco 1/); } finally { MODELOS_DE_SITE.companhia.paginas[0].blocos = original; }
});

test("a criação do site: o seletor de modelos, o tema e o menu do modelo, e todas as páginas gravadas em rascunho", () => {
  const tela = readFileSync("app/(dashboard)/ingressos/site/page.tsx", "utf8");
  for (const t of ["Começar de um modelo", "IDS_DOS_MODELOS.map", 'type="radio"', "tema: MODELOS_DE_SITE[modelo].tema", "aparencia: MODELOS_DE_SITE[modelo].aparencia", "paginasDoModelo(modelo,", "paginas.map(p =>", "são exemplos: troque todos pelos seus antes de publicar"]) assert.ok(tela.includes(t), t);
  assert.ok(!/blocos_publicados/.test(tela.slice(tela.indexOf("paginasDoModelo(modelo,"), tela.indexOf("paginasDoModelo(modelo,") + 600)), "as páginas nascem em rascunho");
  assert.ok(!/from "node:|server-only/.test(readFileSync("lib/ticketeria/modelos-de-site.ts", "utf8")), "vai para o navegador");
});
