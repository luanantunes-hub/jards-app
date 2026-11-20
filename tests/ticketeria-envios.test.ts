import assert from "node:assert/strict";
import test from "node:test";
import { LIMITE_DE_DESTINATARIOS, SEGMENTO_TODOS, acaoDoEnvio, comNome, destinatariosDoSegmento, emailDeDivulgacao, enderecoDeCompraDoEnvio, enviarDivulgacao, lerEnvio, segmentosDoPublico, vendasPorAcao, type EntradaParaEnvio, type PortasDoEnvio } from "../lib/ticketeria/envios";

const E1 = "0d760000-0000-4000-8000-0000000000a1";
const E2 = "0d760000-0000-4000-8000-0000000000a2";
const SESSAO = "0d760000-0000-4000-8000-000000000081";
const ped = (id: string, email: string, sessao: string, extra: Record<string, unknown> = {}) => ({ id, sessao_id: sessao, comprador_nome: "Fulana Silva", comprador_email: email, comprador_whatsapp: null, novidades_aceitas_em: "2026-11-10T12:00:00Z", pago_em: "2026-11-10T12:00:00Z", created_at: "2026-11-10T12:00:00Z", ...extra });
const entrada: EntradaParaEnvio = {
  pedidos: [ped("p1", "rita@email.com", "s1"), ped("p2", "carlos@email.com", "s2"), ped("p3", "joana@email.com", "s1", { novidades_aceitas_em: null }), ped("p4", "paulo@email.com", "s1")],
  quantidadePorPedido: { p1: 2, p2: 1, p3: 1, p4: 1 },
  espera: [{ sessao_id: "s2", nome: "Bia", email: "bia@email.com", created_at: "2026-11-09T12:00:00Z" }],
  eventoDaSessao: { s1: "Noite de Jazz", s2: "Hamlet" },
  eventoIdDaSessao: { s1: E1, s2: E2 },
  saidas: ["paulo@email.com"],
};

test("os segmentos: só com gente; quem não aceitou, quem saiu e quem só está na espera não entram", () => {
  assert.deepEqual(segmentosDoPublico(entrada), [
    { id: SEGMENTO_TODOS, rotulo: "Todos que aceitaram novidades", total: 2 },
    { id: `evento:${E2}`, rotulo: "Compraram Hamlet e aceitaram", total: 1 },
    { id: `evento:${E1}`, rotulo: "Compraram Noite de Jazz e aceitaram", total: 1 },
  ].sort((a, b) => (a.id === SEGMENTO_TODOS ? -1 : b.id === SEGMENTO_TODOS ? 1 : a.rotulo.localeCompare(b.rotulo, "pt-BR"))));
  assert.deepEqual(segmentosDoPublico({ ...entrada, pedidos: [], espera: [] }), [], "sem aceite, sem segmento");
});

test("os destinatários: aceitaram e não saíram", () => {
  assert.deepEqual(destinatariosDoSegmento(entrada, SEGMENTO_TODOS).map(d => d.email).sort(), ["carlos@email.com", "rita@email.com"]);
  assert.deepEqual(destinatariosDoSegmento(entrada, `evento:${E2}`).map(d => d.email), ["carlos@email.com"]);
  assert.deepEqual(destinatariosDoSegmento(entrada, `evento:${E1}`).map(d => d.email), ["rita@email.com"], "Paulo comprou e aceitou, mas saiu; Joana não aceitou");
  for (const torto of ["", "evento:", "evento:abc", "tudo", "evento:0d760000-0000-4000-8000-0000000000ff"]) assert.deepEqual(destinatariosDoSegmento(entrada, torto), [], torto);
});

test("o corpo do envio: lido e conferido", () => {
  const bom = { assunto: "  Últimas   vagas ", mensagem: " Oi, {nome}!\r\nRestam poucas. ", sessao_id: SESSAO.toUpperCase(), segmento: SEGMENTO_TODOS };
  const l = lerEnvio(bom);
  assert.ok(l.ok);
  if (l.ok) assert.deepEqual(l.envio, { assunto: "Últimas vagas", mensagem: "Oi, {nome}!\nRestam poucas.", sessao_id: SESSAO, segmento: SEGMENTO_TODOS, teste: false });
  const t = lerEnvio({ ...bom, teste: true });
  assert.ok(t.ok && t.envio.teste);
  for (const [mudanca, problema] of [[{ assunto: "" }, "assunto"], [{ assunto: "a".repeat(151) }, "assunto"], [{ mensagem: "  " }, "mensagem"], [{ mensagem: "a".repeat(5001) }, "mensagem"], [{ sessao_id: "x" }, "sessão"], [{ segmento: "todos" }, "para quem"]] as [object, string][]) {
    const r = lerEnvio({ ...bom, ...mudanca });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.problemas.includes(problema), problema);
  }
  assert.equal(lerEnvio(null).ok, false);
  assert.equal(LIMITE_DE_DESTINATARIOS, 300);
});

test("a ação do link: o assunto em minúsculas, sem acento, com o dia e o mês", () => {
  const dia = new Date("2026-11-20T15:00:00Z");
  assert.equal(acaoDoEnvio("Últimas vagas para Hamlet!", dia), "ultimas-vagas-para-hamlet-20-11");
  assert.equal(acaoDoEnvio("!!!", dia), "envio-20-11");
  assert.ok(acaoDoEnvio("a".repeat(100), dia).length <= 60, "cabe no limite da ação");
  assert.equal(enderecoDeCompraDoEnvio("https://jards.com.br/", SESSAO, "ultimas-vagas-20-11"), `https://jards.com.br/comprar/${SESSAO}?canal=email&acao=ultimas-vagas-20-11`);
});

test("o e-mail: o nome, o botão de comprar, o rodapé e o link de sair; nada do que a pessoa escreve vira HTML", () => {
  assert.equal(comNome("Oi, {nome}! Tudo bem, {nome}?", "Rita Almeida"), "Oi, Rita! Tudo bem, Rita?");
  assert.equal(comNome("Oi, {nome}!", ""), "Oi!");
  const e = emailDeDivulgacao({ loja: "Cia <Atores>", nome: "Rita Almeida", assunto: "Vagas", mensagem: "Oi, {nome}!\n\nUse <b>AMIGOS10</b>.", enderecoDeCompra: "https://x.com/comprar/1?canal=email&acao=a", enderecoParaSair: "https://x.com/novidades/tok" });
  assert.ok(e.html.includes("Oi, Rita!"));
  assert.ok(e.html.includes("&lt;b&gt;AMIGOS10&lt;/b&gt;"), "o HTML da mensagem é escapado");
  assert.ok(!e.html.includes("<b>AMIGOS10"));
  assert.ok(e.html.includes('href="https://x.com/comprar/1?canal=email&amp;acao=a"'));
  assert.ok(e.html.includes("Cia &lt;Atores&gt;"));
  assert.ok(e.html.includes('<a href="https://x.com/novidades/tok">Sair da lista</a>'));
  assert.ok(e.texto.includes("Para sair da lista: https://x.com/novidades/tok"));
  assert.ok(e.texto.includes("aceitou receber novidades de Cia <Atores>"));
});

function portas(sobre: Partial<PortasDoEnvio> = {}) {
  const chamadas = { criar: [] as unknown[], enviados: [] as { para: string; token: string; chave: string; texto: string }[], marcados: [] as [string, boolean][], concluido: null as null | [string, number, number], erros: 0 };
  const p: PortasDoEnvio = {
    async criar(dados) { chamadas.criar.push(dados); return { envio: "env1", destinatarios: dados.destinatarios.map((d, i) => ({ id: `d${i}`, email: d.email, nome: d.nome, token: `tok${i}` })) }; },
    async enviar(e) { chamadas.enviados.push({ para: e.para, token: e.token, chave: e.chave, texto: e.texto }); return { ok: true, id: `r-${e.para}` }; },
    async marcar(id, ok) { chamadas.marcados.push([id, ok]); },
    async concluir(envio, enviados, falhas) { chamadas.concluido = [envio, enviados, falhas]; },
    registrarErro() { chamadas.erros++; },
    ...sobre,
  };
  return { p, chamadas };
}
const pedido = { loja: "Cia", origem: "https://jards.com.br", assunto: "Vagas", mensagem: "Oi, {nome}!", sessao_id: SESSAO, segmento: SEGMENTO_TODOS, destinatarios: [{ email: "a@x.com", nome: "Ana Souza" }, { email: "b@x.com", nome: "Beto" }, { email: "c@x.com", nome: "Cris" }], agora: new Date("2026-11-20T15:00:00Z"), enderecoParaSair: (t: string) => `https://jards.com.br/novidades/${t}` };

test("o fluxo: um e-mail por pessoa, cada um com o seu token, o link marcado e a chave de idempotência; conta e conclui", async () => {
  const { p, chamadas } = portas();
  const r = await enviarDivulgacao(pedido, p);
  assert.deepEqual(r, { envio: "env1", enviados: 3, falhas: 0 });
  assert.deepEqual(chamadas.enviados.map(e => [e.para, e.token, e.chave]), [["a@x.com", "tok0", "ticketeria-envio-d0"], ["b@x.com", "tok1", "ticketeria-envio-d1"], ["c@x.com", "tok2", "ticketeria-envio-d2"]]);
  assert.ok(chamadas.enviados[0].texto.includes("Oi, Ana!"));
  assert.ok(chamadas.enviados[0].texto.includes(`https://jards.com.br/comprar/${SESSAO}?canal=email&acao=vagas-20-11`));
  assert.ok(chamadas.enviados[2].texto.includes("https://jards.com.br/novidades/tok2"));
  assert.deepEqual(chamadas.concluido, ["env1", 3, 0]);
  assert.deepEqual(chamadas.marcados.length, 3);
});

test("o fluxo: quem falha conta como falha e não derruba os outros; erro ao marcar vai ao registro", async () => {
  const { p, chamadas } = portas({
    async enviar(e) { if (e.para === "b@x.com") throw new Error("provedor fora"); return { ok: e.para !== "c@x.com", id: "r" }; },
    async marcar(id) { if (id === "d0") throw new Error("banco"); },
  });
  const r = await enviarDivulgacao(pedido, p);
  assert.deepEqual(r, { envio: "env1", enviados: 1, falhas: 2 });
  assert.deepEqual(chamadas.concluido, ["env1", 1, 2]);
  assert.equal(chamadas.erros, 2, "o provedor que lançou e o banco que falhou");
});

test("as vendas de cada envio: as compras pagas que voltaram pela ação", () => {
  assert.deepEqual(vendasPorAcao([{ id: "p1", total_centavos: 6000, origem_acao: "vagas-20-11" }, { id: "p2", total_centavos: 12000, origem_acao: "vagas-20-11" }, { id: "p3", total_centavos: 500, origem_acao: "outra-20-11" }, { id: "p4", total_centavos: 900, origem_acao: null }], { p1: 1, p2: 2, p3: 1, p4: 3 }),
    { "vagas-20-11": { ingressos: 3, vendido_centavos: 18000 }, "outra-20-11": { ingressos: 1, vendido_centavos: 500 } });
});

test("a tela: a lista de envios e a folha de um novo envio", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { EnviosDaLoja, NovoEnvioSheet } = await import("../components/ticketeria/EnviosView");
  const lista = renderToStaticMarkup(createElement(EnviosDaLoja, { envios: [{ id: "1", assunto: "Últimas vagas", canal: "email", quando: "2026-11-14T13:00:00Z", destinatarios: 312, enviados: 310, falhas: 2, situacao: "enviado", ingressos: 38, vendido_centavos: 205200 }] }));
  for (const t of ["Últimas vagas", "14/11 às 10:00", "310", "2 não saíram", "38", "R$"]) assert.ok(lista.includes(t), t);
  assert.ok(renderToStaticMarkup(createElement(EnviosDaLoja, { envios: [] })).includes("Nenhum envio ainda"));
  const base = { segmentos: [{ id: SEGMENTO_TODOS, rotulo: "Todos que aceitaram novidades", total: 842 }], sessoes: [{ id: SESSAO, evento: "Hamlet", quando: "06/12 às 20:00" }], origem: "https://jards.com.br", onClose() {} };
  const folha = renderToStaticMarkup(createElement(NovoEnvioSheet, { ...base, ligado: true }));
  for (const t of ["Novo envio", "Para quem", "Todos que aceitaram novidades (842)", "Hamlet · 06/12 às 20:00", "Enviar teste para mim", "Enviar para 842 pessoas"]) assert.ok(folha.includes(t), t);
  assert.ok(!folha.includes("não está ligado"), "ligado: sem aviso");
  const desligado = renderToStaticMarkup(createElement(NovoEnvioSheet, { ...base, ligado: false }));
  assert.ok(desligado.includes("O envio de e-mail ainda não está ligado"));
  assert.match(desligado, /<button[^>]*disabled=""[^>]*>Enviar para 842 pessoas<\/button>/, "desligado: não envia");
  const semGente = renderToStaticMarkup(createElement(NovoEnvioSheet, { ...base, segmentos: [], ligado: true }));
  assert.ok(semGente.includes("Ninguém aceitou receber novidades ainda"));
});

test("as mensagens de erro do envio e a página de privacidade", async () => {
  const { mensagemDoErroDoEnvio } = await import("../lib/ticketeria/envios");
  assert.ok(mensagemDoErroDoEnvio("destinatarios_demais", { total: 500, limite: 300 }).includes("500"));
  assert.ok(mensagemDoErroDoEnvio("envio_desligado").includes("não está ligado"));
  assert.ok(mensagemDoErroDoEnvio("qualquer").includes("Tente de novo"));
  const { readFile } = await import("node:fs/promises");
  const pagina = await readFile("app/privacidade/page.tsx", "utf8");
  for (const t of ['id="s13"', "Ingressos e novidades dos organizadores", "Quero receber novidades e ofertas deste produtor", 'id="s14" num="14" title="Contato"', "20 de novembro de 2026"]) assert.ok(pagina.includes(t), t);
});

test("o envio de divulgação sai por remetente próprio, com o clique único de sair da lista, e fica desligado sem ele", async () => {
  const { readFile } = await import("node:fs/promises");
  const fonte = await readFile("lib/email/divulgacao.ts", "utf8");
  assert.match(fonte, /TICKETERIA_NOVIDADES_EMAIL_FROM/);
  assert.doesNotMatch(fonte, /TRANSACTIONAL_EMAIL_FROM/, "não usa o remetente dos ingressos e do login");
  assert.match(fonte, /"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"/);
  assert.match(fonte, /notConfigured: true/);
  const rota = await readFile("app/api/ticketeria/lojas/[id]/envios/route.ts", "utf8");
  assert.match(rota, /envio_desligado/);
  assert.match(rota, /autorizarLoja/);
});
