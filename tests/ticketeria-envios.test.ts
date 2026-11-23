import assert from "node:assert/strict";
import test from "node:test";
import { LIMITE_DE_DESTINATARIOS, SEGMENTO_TODOS, processarFila, acaoDoEnvio, comNome, destinatariosDoSegmento, emailDeDivulgacao, enderecoDeCompraDoEnvio, lerEnvio, segmentosDoPublico, vendasPorAcao, type EntradaParaEnvio, type MarcaDaFila, type PortasDaFila } from "../lib/ticketeria/envios";

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
  if (l.ok) assert.deepEqual(l.envio, { canal: "email", assunto: "Últimas vagas", mensagem: "Oi, {nome}!\nRestam poucas.", sessao_id: SESSAO, segmento: SEGMENTO_TODOS, teste: false, comparacao: true, soUltimoAno: false });
  const t = lerEnvio({ ...bom, teste: true });
  assert.ok(t.ok && t.envio.teste);
  for (const [mudanca, problema] of [[{ assunto: "" }, "assunto"], [{ assunto: "a".repeat(151) }, "assunto"], [{ mensagem: "  " }, "mensagem"], [{ mensagem: "a".repeat(5001) }, "mensagem"], [{ sessao_id: "x" }, "sessão"], [{ segmento: "todos" }, "para quem"]] as [object, string][]) {
    const r = lerEnvio({ ...bom, ...mudanca });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.problemas.includes(problema), problema);
  }
  assert.equal(lerEnvio(null).ok, false);
  assert.equal(LIMITE_DE_DESTINATARIOS, 5000);
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
  assert.ok(e.html.includes('<a href="https://x.com/novidades/tok">Escolher o que recebe ou sair da lista</a>'));
  assert.ok(e.texto.includes("Para escolher o que recebe ou sair da lista: https://x.com/novidades/tok"));
  assert.ok(e.texto.includes("aceitou receber novidades de Cia <Atores>"));
});

function fila(pessoas: number, sobre: Partial<PortasDaFila> = {}, agoraInicial = 0) {
  const todas = Array.from({ length: pessoas }, (_, i) => ({ id: `d${i}`, email: `p${i}@x.com`, nome: `Pessoa ${i}`, token: `tok${i}` }));
  let proxima = 0;
  let relogio = agoraInicial;
  const chamadas = { reivindicar: [] as number[], lotes: [] as { chave: string; para: string[] }[], unicos: [] as string[], marcas: [] as MarcaDaFila[], atualizacoes: 0, erros: 0, textos: [] as string[] };
  const p: PortasDaFila = {
    async reivindicar(n) { chamadas.reivindicar.push(n); const lote = todas.slice(proxima, proxima + n); proxima += lote.length; return lote; },
    async enviarLote(emails, chave) { chamadas.lotes.push({ chave, para: emails.map(e => e.para) }); chamadas.textos.push(emails[0].texto); return { ok: true, ids: emails.map(e => `re_${e.para}`) }; },
    async enviarUm(email) { chamadas.unicos.push(email.para); return { ok: true, id: `re_${email.para}` }; },
    async marcar(m) { chamadas.marcas.push(...m); },
    async atualizar() { chamadas.atualizacoes++; return todas.length - proxima + chamadas.marcas.filter(m => !m.ok).length * 0; },
    agora: () => (relogio += 1000),
    registrarErro() { chamadas.erros++; },
    ...sobre,
  };
  return { p, chamadas };
}
const dados = { loja: "Cia", origem: "https://jards.com.br", assunto: "Vagas", mensagem: "Oi, {nome}!", sessao_id: SESSAO, acao: "vagas-20-11", enderecoParaSair: (t: string) => `https://jards.com.br/novidades/${t}` };

test("a fila: lotes de 100 numa chamada só, cada e-mail com o seu token, o link marcado e o nome; marca todo mundo e conclui", async () => {
  const { p, chamadas } = fila(250);
  const r = await processarFila(dados, p);
  assert.deepEqual(r, { enviados: 250, falhas: 0, faltam: 0 });
  assert.deepEqual(chamadas.reivindicar, [100, 100, 100], "pede 100 por vez; quando a atualização diz que não falta ninguém, para");
  assert.deepEqual(chamadas.lotes.map(l => l.para.length), [100, 100, 50]);
  assert.equal(chamadas.unicos.length, 0, "lote que funciona não manda um por um");
  assert.equal(chamadas.lotes[0].chave, "ticketeria-lote-d0-100");
  assert.ok(chamadas.textos[0].includes("Oi, Pessoa!") && chamadas.textos[0].includes(`https://jards.com.br/comprar/${SESSAO}?canal=email&acao=vagas-20-11`) && chamadas.textos[0].includes("https://jards.com.br/novidades/tok0"));
  assert.equal(chamadas.marcas.length, 250);
  assert.ok(chamadas.marcas.every(m => m.ok && m.provedorId === `re_${m.id.replace("d", "p")}@x.com`), "cada pessoa guarda o id do e-mail dela, na ordem do lote");
});

test("a fila: lote que falha manda um por um; quem falha conta como falha e não derruba os outros; erro ao mandar vai ao registro", async () => {
  const { p, chamadas } = fila(4, {
    async enviarLote() { return { ok: false }; },
    async enviarUm(email) { if (email.para === "p1@x.com") throw new Error("provedor"); return { ok: email.para !== "p2@x.com", id: "re_ok" }; },
  });
  const r = await processarFila(dados, p);
  assert.deepEqual(r, { enviados: 2, falhas: 2, faltam: 0 });
  assert.deepEqual(chamadas.marcas.map(m => [m.id, m.ok]), [["d0", true], ["d1", false], ["d2", false], ["d3", true]]);
  assert.equal(chamadas.erros, 1);
  const torto = fila(2, { async enviarLote() { return { ok: true, ids: ["so-um"] }; } });
  const r2 = await processarFila(dados, torto.p);
  assert.equal(r2.enviados, 2, "lote com resposta que não confere vira um por um");
  assert.equal(torto.chamadas.unicos.length, 2);
});

test("a fila: acabou o tempo da rodada, larga o resto para a próxima; fila vazia só atualiza", async () => {
  const curta = fila(500);
  const r = await processarFila({ ...dados, orcamentoMs: 2500 }, curta.p);
  assert.ok(r.enviados > 0 && r.enviados < 500, "mandou só o que coube no tempo");
  assert.ok(r.faltam > 0, "e diz quantas faltam");
  const vazia = fila(0);
  assert.deepEqual(await processarFila(dados, vazia.p), { enviados: 0, falhas: 0, faltam: 0 });
  assert.equal(vazia.chamadas.atualizacoes, 1);
  assert.equal(vazia.chamadas.lotes.length, 0);
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

test("o envio de divulgação sai do domínio da loja (nunca de um domínio do Jards), com o clique único de sair da lista, e fica desligado sem a chave", async () => {
  const { readFile } = await import("node:fs/promises");
  const fonte = await readFile("lib/email/divulgacao.ts", "utf8");
  assert.doesNotMatch(fonte, /TICKETERIA_NOVIDADES_EMAIL_FROM/, "o remetente vem de cada loja, não de uma variável única");
  assert.match(fonte, /de: RemetenteDoEnvio/);
  assert.doesNotMatch(fonte, /TRANSACTIONAL_EMAIL_FROM/, "não usa o remetente dos ingressos e do login");
  assert.match(fonte, /"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"/);
  assert.match(fonte, /notConfigured: true/);
  const rota = await readFile("app/api/ticketeria/lojas/[id]/envios/route.ts", "utf8");
  assert.match(rota, /envio_desligado/);
  assert.match(rota, /email_nao_ativo/);
  assert.match(rota, /conferirEnvio/);
  assert.match(rota, /autorizarLoja/);
});

test("a fila no servidor: o POST só cria e dispara depois da resposta, o cron é protegido e roda a cada minuto, e o lote usa o endpoint de lote", async () => {
  const { readFile } = await import("node:fs/promises");
  const rota = await readFile("app/api/ticketeria/lojas/[id]/envios/route.ts", "utf8");
  assert.match(rota, /import \{ after, type NextRequest \}/);
  assert.match(rota, /after\(async \(\) => \{/);
  assert.match(rota, /resposta\(\{ envio: criado, total: destinatarios\.length, comparacao: preparo\?\.comparacao\.length \?\? 0, enviando: true \}, 202\)/);
  assert.doesNotMatch(rota, /enviarDivulgacao/, "não manda mais e-mail dentro do pedido");
  const cron = await readFile("app/api/ticketeria/envios/processar/route.ts", "utf8");
  assert.match(cron, /cron_indisponivel"\s*\}, 503/);
  assert.match(cron, /nao_autorizado"\s*\}, 401/);
  assert.match(cron, /timingSafeEqual/);
  assert.match(cron, /\.eq\("canal", "email"\)\.eq\("situacao", "enviando"\)/, "só e-mail em andamento");
  const vercel = JSON.parse(await readFile("vercel.json", "utf8")) as { crons: { path: string; schedule: string }[] };
  assert.ok(vercel.crons.some(c => c.path === "/api/ticketeria/envios/processar" && c.schedule === "* * * * *"));
  const lib = await readFile("lib/email/divulgacao.ts", "utf8");
  assert.match(lib, /"\/emails\/batch"/);
  assert.match(lib, /emails\.length > 100/, "o lote tem no máximo 100");
  assert.match(lib, /resposta\.status !== 429 && resposta\.status < 500/, "tenta de novo só quando o Resend pede calma ou falha do lado dele");
  const sql = (await readFile("supabase/tests/ticketeria_envios_fila.test.sql", "utf8"));
  assert.match(sql, /select plan\(16\)/);
});

test("a tela mostra 'N de M' enquanto o e-mail está na fila", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { EnviosDaLoja } = await import("../components/ticketeria/EnviosView");
  const h = renderToStaticMarkup(createElement(EnviosDaLoja, { envios: [{ id: "e1", assunto: "Grande", canal: "email", quando: "2026-11-14T13:00:00Z", destinatarios: 1200, enviados: 400, falhas: 0, situacao: "enviando", ingressos: 0, vendido_centavos: 0 }] }));
  assert.ok(h.includes("400 de 1.200"));
  assert.ok(h.includes("enviando…"));
});
