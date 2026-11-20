import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IngressosEmbutidos } from "../components/ticketeria/IngressosEmbutidos";
import { CartaoDaChave, CartaoDoCodigo, GirarChaveSheet } from "../components/ticketeria/IntegracoesView";
import { chaveResumida, codigoDoWidget, poucosNaSessao, type ListaDeEventosNaApi, type SessaoNaApi } from "../lib/ticketeria/integracao";

// O widget de ingressos (script, iframe, lista embutida) e a tela Integrações. Desenhos aprovados pelo dono em 20/11/2026.

const CHAVE = "tkp_" + "ab".repeat(16);
const SCRIPT = readFileSync("public/widget/ingressos.js", "utf8");

type Falso = { attrs: Record<string, string>; style: { cssText: string; height?: string }; contentWindow: object; filhos: Falso[]; src?: string; title?: string; setAttribute(n: string, v: string): void; appendChild(f: Falso): void };
const falso = (): Falso => ({ attrs: {}, style: { cssText: "" }, contentWindow: {}, filhos: [], setAttribute(n, v) { this.attrs[n] = v; }, appendChild(f) { this.filhos.push(f); } });

/** Roda o script do widget num "navegador" falso e devolve o que ele criou e o que escuta. */
function rodar(atributos: Record<string, string>, src = "https://app.jards.com.br/widget/ingressos.js", alvos: Record<string, Falso> = {}) {
  const irmaos: Falso[] = [];
  const pai = { insertBefore: (f: Falso) => { irmaos.push(f); } };
  const script = { src, parentNode: pai, nextSibling: null, getAttribute: (n: string) => atributos[n] ?? null };
  const criados: Falso[] = [];
  const ouvintes: ((e: unknown) => void)[] = [];
  const janela = { addEventListener: (_: string, f: (e: unknown) => void) => { ouvintes.push(f); } };
  const doc = { currentScript: script, createElement: () => { const f = falso(); criados.push(f); return f; }, querySelector: (s: string) => alvos[s] ?? null };
  vm.runInNewContext(SCRIPT, { document: doc, window: janela, URL, isFinite, Math });
  return { criados, irmaos, ouvintes };
}

test("o script cria o iframe do Jards com a chave e o coloca logo depois dele", () => {
  const { criados, irmaos, ouvintes } = rodar({ "data-chave": CHAVE });
  assert.equal(criados.length, 1);
  assert.equal(criados[0].src, `https://app.jards.com.br/embed/ingressos/${CHAVE}`);
  assert.equal(criados[0].title, "Ingressos");
  assert.equal(irmaos.length, 1);
  assert.equal(ouvintes.length, 1);
  assert.match(criados[0].attrs.sandbox, /allow-popups/, "a compra abre em outra aba");
  assert.doesNotMatch(criados[0].attrs.sandbox, /allow-top-navigation/, "o iframe nunca leva a página de fora a outro lugar");
});

test("o script ignora chave que não é de loja, e não faz nada sem ela", () => {
  for (const ruim of ["", "abc", "tkp_curta", CHAVE.toUpperCase(), CHAVE + "x"]) assert.equal(rodar({ "data-chave": ruim }).criados.length, 0, ruim);
  assert.equal(rodar({}).criados.length, 0);
});

test("data-evento só vale se for um id; data-alvo desenha lá dentro", () => {
  const id = "0d760000-0000-4000-8000-0000000000e1";
  assert.match(rodar({ "data-chave": CHAVE, "data-evento": id }).criados[0].src ?? "", new RegExp(`\\?evento=${id}$`));
  assert.equal(rodar({ "data-chave": CHAVE, "data-evento": "x\"><script>" }).criados[0].src, `https://app.jards.com.br/embed/ingressos/${CHAVE}`, "lixo no evento é descartado");
  const alvo = falso();
  const r = rodar({ "data-chave": CHAVE, "data-alvo": "#ingressos" }, undefined, { "#ingressos": alvo });
  assert.equal(alvo.filhos.length, 1);
  assert.equal(r.irmaos.length, 0);
});

test("a altura só vale vinda do iframe e do endereço do Jards, e fica entre 120 e 4000", () => {
  const { criados, ouvintes } = rodar({ "data-chave": CHAVE });
  const f = criados[0];
  const aviso = (origem: string, fonte: object, dados: unknown) => ouvintes[0]({ origin: origem, source: fonte, data: dados });
  aviso("https://app.jards.com.br", f.contentWindow, { tipo: "jards-ticketeria-altura", altura: 480.4 });
  assert.equal(f.style.height, "480px");
  aviso("https://app.jards.com.br", f.contentWindow, { tipo: "jards-ticketeria-altura", altura: 99999 });
  assert.equal(f.style.height, "4000px");
  aviso("https://app.jards.com.br", f.contentWindow, { tipo: "jards-ticketeria-altura", altura: 3 });
  assert.equal(f.style.height, "120px");
  f.style.height = "300px";
  aviso("https://outro.site", f.contentWindow, { tipo: "jards-ticketeria-altura", altura: 900 });
  aviso("https://app.jards.com.br", {}, { tipo: "jards-ticketeria-altura", altura: 900 });
  aviso("https://app.jards.com.br", f.contentWindow, { tipo: "outra-coisa", altura: 900 });
  aviso("https://app.jards.com.br", f.contentWindow, { tipo: "jards-ticketeria-altura", altura: "900" });
  aviso("https://app.jards.com.br", f.contentWindow, { tipo: "jards-ticketeria-altura", altura: Number.NaN });
  aviso("https://app.jards.com.br", f.contentWindow, null);
  assert.equal(f.style.height, "300px", "nenhum aviso de fora mexeu na altura");
});

test("o script não usa eval nem innerHTML (só cria o iframe)", () => {
  assert.doesNotMatch(SCRIPT, /\beval\(|new Function|innerHTML|document\.write|outerHTML/);
});

const sessao = (extra: Partial<SessaoNaApi> = {}): SessaoNaApi => ({ id: "s1", inicio: "2026-12-12T23:00:00Z", quando: "Sábado, 12 de dezembro, às 20h", local: "Teatro Municipal, São Paulo/SP", estado: "aberta", a_partir_de_centavos: 5000, poucos: false, url: "https://app.jards.com.br/comprar/s1", ...extra });
const lista = (sessoes: SessaoNaApi[], cor = "#282525"): ListaDeEventosNaApi => ({ versao: 1, loja: { nome: "Cia" }, tema: { titulo: "Cia", cor }, eventos: [{ id: "e1", slug: "hamlet", titulo: "Hamlet", descricao: null, classificacao: "14 anos", imagem: null, sessoes }] });

test("a lista embutida: data, local, preço e Comprar em outra aba; poucos, esgotado e indisponível", () => {
  const html = renderToStaticMarkup(createElement(IngressosEmbutidos, { lista: lista([sessao(), sessao({ id: "s2", poucos: true }), sessao({ id: "s3", estado: "esgotada" }), sessao({ id: "s4", estado: "vendas_pausadas" })]) }));
  for (const t of ["Hamlet", "14 anos", "Sábado, 12 de dezembro, às 20h", "Teatro Municipal, São Paulo/SP · a partir de R$", "poucos ingressos", "Esgotado · lista de espera", "Indisponível", "Ingressos por Jards"]) assert.ok(html.includes(t), t);
  assert.equal((html.match(/>Comprar</g) ?? []).length, 2, "só as abertas têm Comprar");
  assert.ok(html.includes('href="https://app.jards.com.br/comprar/s1"') && html.includes('target="_blank"') && html.includes('rel="noopener noreferrer"'), "a compra abre em outra aba, sem passar a janela");
  assert.ok(html.includes("background-color:#282525"), "o botão usa a cor do site da loja");
  assert.ok(renderToStaticMarkup(createElement(IngressosEmbutidos, { lista: lista([sessao()], "#ffffff") })).includes("color:#282525"), "botão claro leva texto escuro");
});

test("a lista embutida: filtra por evento e, sem evento à venda, diz isso", () => {
  const l = lista([sessao()]);
  assert.ok(renderToStaticMarkup(createElement(IngressosEmbutidos, { lista: l, eventoId: "outro" })).includes("Nenhum evento à venda no momento."));
  assert.ok(renderToStaticMarkup(createElement(IngressosEmbutidos, { lista: l, eventoId: "e1" })).includes("Hamlet"));
  assert.ok(renderToStaticMarkup(createElement(IngressosEmbutidos, { lista: { ...l, eventos: [] } })).includes("Nenhum evento à venda no momento."));
});

test("as contas da tela: poucos na sessão, a chave resumida e o código do widget", () => {
  const ing = (livres: number) => ({ id: "i", nome: "x", descricao: null, limite: 4, faixas: livres > 0 ? [{ preco_centavos: 1000, livres }] : [] });
  assert.equal(poucosNaSessao([ing(4), ing(6)]), true);
  assert.equal(poucosNaSessao([ing(5), ing(6)]), false);
  assert.equal(poucosNaSessao([ing(0)]), false);
  assert.equal(chaveResumida(CHAVE), "tkp_abab…abab");
  assert.equal(chaveResumida("lixo"), "");
  assert.equal(codigoDoWidget("https://app.jards.com.br/", CHAVE), `<script src="https://app.jards.com.br/widget/ingressos.js" data-chave="${CHAVE}" async></script>`);
});

test("a tela Integrações: a chave resumida, o código e os botões só para quem edita", () => {
  const cartao = (podeEditar: boolean, ativa = true) => renderToStaticMarkup(createElement(CartaoDaChave, { chave: { chave: CHAVE, ativa }, podeEditar }));
  assert.ok(cartao(true).includes("tkp_abab…abab") && cartao(true).includes("LIGADA") && cartao(true).includes("Desligar") && cartao(true).includes("Gerar outra chave") && cartao(true).includes("Copiar"));
  assert.equal(cartao(true).includes(CHAVE), false, "a chave inteira não aparece na tela");
  assert.ok(cartao(true, false).includes("DESLIGADA") && cartao(true, false).includes("Ligar") && cartao(true, false).includes("não mostram os seus ingressos"));
  assert.equal(cartao(false).includes("Desligar") || cartao(false).includes("Gerar outra chave"), false, "quem só lê não muda a chave");
  const codigo = renderToStaticMarkup(createElement(CartaoDoCodigo, { chave: CHAVE, origem: "https://app.jards.com.br" }));
  assert.ok(codigo.includes("Mostrar os ingressos no seu site") && codigo.includes("Copiar código") && codigo.includes(CHAVE) && codigo.includes("/widget/ingressos.js"), "o código mostra a chave inteira, para copiar");
  assert.ok(codigo.includes("Em breve: plugins do WordPress, Wix e Webflow") && codigo.includes("WordPress, Wix, Webflow, Squarespace"));
  const folha = renderToStaticMarkup(createElement(GirarChaveSheet, { onClose: () => {}, onGirar: async () => null }));
  assert.ok(folha.includes("A chave atual deixa de valer na hora") && folha.includes("Gerar outra chave") && folha.includes("Cancelar"));
});

test("o proxy deixa o script do widget abrir sem login e o menu tem Integrações", () => {
  const proxy = readFileSync("proxy.ts", "utf8");
  assert.match(proxy, /dados\/\|widget\//, "widget/ fora do matcher do proxy");
  assert.match(readFileSync("app/(dashboard)/layout.tsx", "utf8"), /label: "Integrações", href: "\/ingressos\/integracoes"/);
  assert.match(readFileSync("lib/navigation/rotas.ts", "utf8"), /\["\/ingressos\/integracoes", "Integrações"\]/);
  assert.match(readFileSync("next.config.ts", "utf8"), /source: "\/embed\/:path\*"/, "o iframe do widget está em /embed/, a única área que outro site pode embutir");
});
