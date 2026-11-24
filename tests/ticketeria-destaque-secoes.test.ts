import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DestaqueDoSite } from "../components/ticketeria/DestaqueDoSite";
import { agendaDosEventos, botoesDoProximoEvento, chamadaDoProximoEvento, contagemParaOEvento, type ItemDaAgenda } from "../lib/ticketeria/evento-site";
import type { EventoNaApi, SessaoNaApi } from "../lib/ticketeria/integracao";
import { LAYOUTS_DO_DESTAQUE, MAX_SLIDES_DO_DESTAQUE, ROTULO_DO_LAYOUT_DO_DESTAQUE, lerBloco, type Bloco } from "../lib/ticketeria/site";

// A biblioteca de seções, passo 3: o destaque do alto em cinco layouts (imagem de tela cheia, dividido, carrossel, próximo evento, cartão sobreposto). Desenhos aprovados pelo dono em 20/11/2026.

type Destaque = Extract<Bloco, { tipo: "capa" }>;
const ler = (entrada: unknown): Destaque => { const r = lerBloco(entrada); assert.ok(r.ok, r.ok ? "" : r.erro); return (r as unknown as { bloco: Destaque }).bloco; };
const erro = (entrada: unknown): string => { const r = lerBloco(entrada); assert.equal(r.ok, false); return (r as { erro: string }).erro; };
const IMG = "https://exemplo.com/f.jpg";

test("o destaque: cinco layouts; sem layout é a imagem de tela cheia (os blocos antigos seguem valendo); layout que não existe é recusado", () => {
  assert.deepEqual([...LAYOUTS_DO_DESTAQUE], ["tela_cheia", "dividido", "carrossel", "proximo", "cartao"]);
  for (const l of LAYOUTS_DO_DESTAQUE) assert.ok(ROTULO_DO_LAYOUT_DO_DESTAQUE[l].nome.length > 3 && ROTULO_DO_LAYOUT_DO_DESTAQUE[l].frase.length > 10, l);
  assert.equal(ler({ tipo: "capa", titulo: "Hamlet", subtitulo: "De 12 a 20", imagem: IMG, botao_rotulo: "Comprar", botao_url: "https://a.com/c" }).layout, "tela_cheia", "uma capa antiga");
  assert.match(erro({ tipo: "capa", titulo: "x", layout: "mosaico" }), /layouts do destaque/);
  assert.match(erro({ tipo: "capa", titulo: "x", layout: 3 }), /layouts do destaque/);
});

test("os campos de cada layout: título obrigatório, menos no carrossel e no próximo evento; chamada, linha de informação e segundo botão", () => {
  for (const l of ["tela_cheia", "dividido", "cartao"]) assert.match(erro({ tipo: "capa", layout: l, titulo: "" }), /título da capa/, l);
  assert.equal(ler({ tipo: "capa", layout: "proximo", titulo: "" }).layout, "proximo");
  const d = ler({ tipo: "capa", layout: "dividido", titulo: " Jardim ", chamada: " Estreia ", info: "Sáb, 12 de dezembro, 20h · Teatro", botao_rotulo: "Comprar", botao_url: "https://a.com/c", botao2_rotulo: "Ver tudo", botao2_url: "https://a.com/t" });
  assert.deepEqual([d.titulo, d.chamada, d.info, d.botao2_rotulo, d.botao2_url], ["Jardim", "Estreia", "Sáb, 12 de dezembro, 20h · Teatro", "Ver tudo", "https://a.com/t"]);
  assert.match(erro({ tipo: "capa", titulo: "x", chamada: "x".repeat(41) }), /chamada/);
  assert.match(erro({ tipo: "capa", titulo: "x", info: "x".repeat(121) }), /linha de informação/);
  assert.match(erro({ tipo: "capa", titulo: "x", botao2_rotulo: "Ir" }), /segundo botão.*juntos/);
  assert.match(erro({ tipo: "capa", titulo: "x", botao2_rotulo: "Ir", botao2_url: "http://a.com" }), /segundo botão.*https/);
  assert.match(erro({ tipo: "capa", titulo: "x", imagem: "http://a.com/i.jpg" }), /https/);
});

test("o carrossel: de 1 a 5 destaques, cada um com título, frase, imagem e botão; os outros layouts não guardam destaques", () => {
  const slide = (n: number) => ({ titulo: `Destaque ${n}`, frase: "Frase", imagem: IMG, botao_rotulo: "Ver", botao_url: "https://a.com/x" });
  const ok = ler({ tipo: "capa", layout: "carrossel", titulo: "", slides: [slide(1), slide(2)] });
  assert.equal(ok.slides.length, 2);
  assert.equal(ok.slides[1].titulo, "Destaque 2");
  assert.equal(ler({ tipo: "capa", layout: "tela_cheia", titulo: "x", slides: [slide(1)] }).slides.length, 0, "tela cheia não guarda destaques");
  assert.match(erro({ tipo: "capa", layout: "carrossel", titulo: "", slides: [] }), /1 a 5 destaques/);
  assert.match(erro({ tipo: "capa", layout: "carrossel", titulo: "", slides: Array.from({ length: MAX_SLIDES_DO_DESTAQUE + 1 }, (_, i) => slide(i)) }), /1 a 5 destaques/);
  assert.match(erro({ tipo: "capa", layout: "carrossel", titulo: "", slides: [{ ...slide(1), titulo: "" }] }), /Destaque 1: o título/);
  assert.match(erro({ tipo: "capa", layout: "carrossel", titulo: "", slides: [slide(1), { ...slide(2), imagem: "http://a.com/i.jpg" }] }), /imagem do destaque 2.*https/);
  assert.match(erro({ tipo: "capa", layout: "carrossel", titulo: "", slides: [{ ...slide(1), botao_rotulo: "Ver", botao_url: "" }] }), /botão do destaque 1.*juntos/);
});

const sessao = (id: string, inicio: string, extra: Partial<SessaoNaApi> = {}): SessaoNaApi => ({ id, inicio, quando: "Sáb, 28 de novembro, às 20h", local: "Teatro Municipal, Sorocaba/SP", local_nome: "Teatro Municipal", estado: "aberta", a_partir_de_centavos: 4000, poucos: false, url: `https://jards.com.br/comprar/${id}`, ...extra } as SessaoNaApi);
const evento = (slug: string, titulo: string, sessoes: SessaoNaApi[], extra: Partial<EventoNaApi> = {}): EventoNaApi => ({ id: slug, slug, titulo, descricao: null, classificacao: null, imagem: null, sessoes, ...extra });
const AGORA = Date.parse("2026-11-20T15:00:00.000Z");
const hamlet = agendaDosEventos([evento("hamlet", "Hamlet", [sessao("h1", "2026-11-28T23:00:00.000Z"), sessao("h2", "2026-12-05T23:00:00.000Z")], { imagem: "https://a.com/capa.jpg" })])[0];
const esgotado = agendaDosEventos([evento("mar", "Mar de Dentro", [sessao("m1", "2026-12-05T22:00:00.000Z", { estado: "esgotada", a_partir_de_centavos: null })])])[0];

test("o próximo evento: a chamada conta os dias; o botão principal leva à compra (à venda), à lista de espera (esgotado) ou ao evento; 'Ver todas as datas' só com mais de uma", () => {
  assert.equal(chamadaDoProximoEvento(contagemParaOEvento(hamlet.lista, AGORA)), "Próximo espetáculo · faltam 8 dias");
  assert.equal(chamadaDoProximoEvento({ dias: 1 }), "Próximo espetáculo · amanhã");
  assert.equal(chamadaDoProximoEvento({ dias: 0 }), "Próximo espetáculo · hoje");
  assert.equal(chamadaDoProximoEvento(null), "Próximo espetáculo");
  assert.deepEqual(botoesDoProximoEvento(hamlet), { principal: { texto: "Escolher ingressos", url: "https://jards.com.br/comprar/h1" }, secundario: { texto: "Ver todas as datas" } });
  assert.deepEqual(botoesDoProximoEvento(esgotado), { principal: { texto: "Entrar na lista de espera", url: "https://jards.com.br/comprar/m1" }, secundario: null });
  assert.deepEqual(botoesDoProximoEvento({ estado: "indisponivel", lista: [], slug: "x" } as unknown as ItemDaAgenda), { principal: { texto: "Ver o evento", url: null }, secundario: null });
});

const html = (bloco: unknown, extra: { agenda?: ItemDaAgenda[]; semLinks?: boolean } = {}) =>
  renderToStaticMarkup(createElement(DestaqueDoSite, { bloco: ler(bloco), cor: "#1C0E33", agenda: extra.agenda ?? [], base: "", semLinks: extra.semLinks ?? false, agora: AGORA }));

test("imagem de tela cheia: chamada, título, frase, dois botões e o degradê para ler; sem imagem, a cor do site", () => {
  const h = html({ tipo: "capa", layout: "tela_cheia", titulo: "Hamlet", subtitulo: "Uma montagem íntima.", chamada: "Estreia", imagem: IMG, botao_rotulo: "Escolher ingressos", botao_url: "https://a.com/c", botao2_rotulo: "Ver a programação", botao2_url: "https://a.com/p" });
  for (const t of ["Hamlet", "Uma montagem íntima.", "Estreia", "Escolher ingressos", "Ver a programação", `src="${IMG}"`, "from-black/70", 'rel="noopener noreferrer"']) assert.ok(h.includes(t), t);
  assert.ok(html({ tipo: "capa", layout: "tela_cheia", titulo: "Só cor" }).includes("linear-gradient(150deg, #1C0E33") && !html({ tipo: "capa", layout: "tela_cheia", titulo: "Só cor" }).includes("<img"));
});

test("dividido: texto à esquerda com a linha de data e local, imagem à direita; no celular a imagem vem primeiro", () => {
  const h = html({ tipo: "capa", layout: "dividido", titulo: "O Jardim das Cerejeiras", chamada: "Estreia", info: "Sáb, 12 de dezembro, 20h · Teatro Municipal", imagem: IMG, botao_rotulo: "Escolher ingressos", botao_url: "https://a.com/c" });
  for (const t of ["O Jardim das Cerejeiras", "Sáb, 12 de dezembro, 20h · Teatro Municipal", "md:grid-cols-2", "order-1 min-h-[15rem]", "Escolher ingressos"]) assert.ok(h.includes(t), t);
});

test("carrossel: um quadro por destaque, setas, pausa, pontos; só o destaque à vista fica disponível para leitores de tela e para o clique", () => {
  const h = html({ tipo: "capa", layout: "carrossel", titulo: "", slides: [{ titulo: "Hamlet", frase: "Até 6 de dezembro", imagem: IMG, botao_rotulo: "Ingressos", botao_url: "https://a.com/1" }, { titulo: "Mar de Dentro", frase: "", imagem: "", botao_rotulo: "", botao_url: "" }] });
  for (const t of ['aria-roledescription="carrossel"', "Pausar", "Destaque anterior", "Próximo destaque", "Hamlet", "Mar de Dentro", 'aria-hidden="false"', 'aria-hidden="true"', "motion-reduce:transition-none"]) assert.ok(h.includes(t), t);
  assert.equal((h.match(/aria-roledescription="destaque"/g) ?? []).length, 2);
  const um = html({ tipo: "capa", layout: "carrossel", titulo: "", slides: [{ titulo: "Só um", frase: "", imagem: "", botao_rotulo: "", botao_url: "" }] });
  assert.ok(!um.includes("Pausar") && !um.includes("Próximo destaque"), "com um destaque só, sem controles");
});

test("próximo evento: lido do evento (título, data, espaço, preço), com os botões de compra e das datas; na prévia nada leva a lugar nenhum; sem evento, a prévia explica e o site some", () => {
  const h = html({ tipo: "capa", layout: "proximo", titulo: "" }, { agenda: [hamlet] });
  for (const t of ["Próximo espetáculo · faltam 8 dias", "Hamlet", "Sáb, 28 de novembro, às 20h", "Teatro Municipal", "a partir de R$", "Escolher ingressos", 'href="https://jards.com.br/comprar/h1"', "Ver todas as datas", 'href="/e/hamlet"', 'src="https://a.com/capa.jpg"']) assert.ok(h.includes(t), t);
  const previa = html({ tipo: "capa", layout: "proximo", titulo: "" }, { agenda: [hamlet], semLinks: true });
  assert.equal(previa.includes("<a "), false, "na prévia, sem links");
  assert.ok(previa.includes("Hamlet") && previa.includes("Ver todas as datas"));
  assert.ok(html({ tipo: "capa", layout: "proximo", titulo: "" }, { semLinks: true }).includes("aparece aqui quando houver um evento publicado"));
  assert.equal(html({ tipo: "capa", layout: "proximo", titulo: "" }), "", "no site no ar, sem evento, nada");
});

test("cartão sobreposto: imagem com o cartão da frase e do botão por cima", () => {
  const h = html({ tipo: "capa", layout: "cartao", titulo: "Teatro de câmara em Sorocaba", subtitulo: "Doze anos de estrada.", imagem: IMG, botao_rotulo: "Ver a programação", botao_url: "https://a.com/p" });
  for (const t of ["Teatro de câmara em Sorocaba", "Doze anos de estrada.", "Ver a programação", "-mt-14", "shadow-"]) assert.ok(h.includes(t), t);
});

test("o editor e o site: miniaturas, escolha do layout, campos por layout; o site no ar carrega os eventos quando o destaque é o próximo evento", () => {
  const folha = readFileSync("components/ticketeria/BlocosNovosSheet.tsx", "utf8");
  for (const t of ["MiniaturaDoDestaque", "Como mostrar o destaque", "LAYOUTS_DO_DESTAQUE.map", "layoutDestaque", "Outro destaque", "Nada a preencher", "Segundo botão: texto (opcional)", "Data e local (opcional)", 'layout: layoutDestaque']) assert.ok(folha.includes(t), t);
  const publico = readFileSync("lib/ticketeria/site-publico.ts", "utf8");
  assert.ok(publico.includes('b.tipo === "capa" && b.layout === "proximo"'), "a consulta dos eventos também vale para o destaque");
  assert.ok(readFileSync("components/ticketeria/SiteView.tsx", "utf8").includes("<DestaqueDoSite bloco={bloco}"));
  assert.ok(readFileSync("components/ticketeria/EditorDoSite.tsx", "utf8").includes("ROTULO_DO_LAYOUT_DO_DESTAQUE[bloco.layout].nome"));
  assert.ok(!/from "node:|server-only/.test(readFileSync("components/ticketeria/DestaqueDoSite.tsx", "utf8")), "vai para o navegador");
});
