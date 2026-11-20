import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TelaIngressos } from "../components/ticketeria/CompraView";
import { ConfirmarReembolso, PedirReembolso } from "../components/ticketeria/ReembolsoDoPedido";
import { decidirReembolso, type PedidoParaReembolso } from "../lib/ticketeria/pagamento/reembolso";
import {
  RECUSAS_DO_PEDIDO, ehIdDePedido, emailMascarado, lerCodigoDoLink, lerMotivoDaRecusa, limiteDoPedidoDeReembolso, mensagemDoLinkDeReembolso, podePedirReembolsoNaPagina, textoDaConfirmacao,
  type PedidoNaPagina, type ResultadoDaConfirmacao,
} from "../lib/ticketeria/pagamento/reembolso-pagina";

const AGORA = new Date("2026-11-20T15:00:00.000Z");
const pedido = (sobre: Partial<PedidoNaPagina> = {}): PedidoNaPagina => ({ situacao: "pago", pago_em: "2026-11-18T15:00:00.000Z", reembolsado_em: null, total_centavos: 12000, provedor: "asaas", ingresso_usado: false, ...sobre });
const CODIGO = "a".repeat(64);

test("o código do link: 64 letras e números de 0 a 9 e a a f; maiúsculas e espaços nas pontas são aceitos, o resto não", () => {
  assert.equal(lerCodigoDoLink(CODIGO), CODIGO);
  assert.equal(lerCodigoDoLink(`  ${CODIGO.toUpperCase()}\n`), CODIGO);
  for (const torto of ["", "abc", "g".repeat(64), "a".repeat(63), "a".repeat(65), null, undefined, 7, ["a"]]) assert.equal(lerCodigoDoLink(torto), null, String(torto));
  assert.equal(ehIdDePedido("0d760000-0000-4000-8000-0000000000e1"), true);
  assert.equal(ehIdDePedido("0d760000-0000-4000-8000-0000000000"), false);
  assert.equal(ehIdDePedido(undefined), false);
});

test("o botão aparece só com o pedido pago no Asaas, dentro dos 7 dias, sem ingresso usado e sem reembolso", () => {
  assert.equal(podePedirReembolsoNaPagina(pedido(), AGORA), true);
  assert.equal(podePedirReembolsoNaPagina(pedido({ pago_em: "2026-11-13T15:00:00.000Z" }), AGORA), true, "no limite dos 7 dias");
  assert.equal(podePedirReembolsoNaPagina(pedido({ pago_em: "2026-11-13T14:59:59.000Z" }), AGORA), false, "um segundo depois dos 7 dias");
  assert.equal(podePedirReembolsoNaPagina(pedido({ ingresso_usado: true }), AGORA), false);
  assert.equal(podePedirReembolsoNaPagina(pedido({ reembolsado_em: "2026-11-19T10:00:00.000Z" }), AGORA), false);
  assert.equal(podePedirReembolsoNaPagina(pedido({ situacao: "cancelado" }), AGORA), false);
  assert.equal(podePedirReembolsoNaPagina(pedido({ pago_em: null }), AGORA), false);
  assert.equal(podePedirReembolsoNaPagina(pedido({ provedor: null }), AGORA), false);
  assert.equal(podePedirReembolsoNaPagina(pedido({ total_centavos: 0 }), AGORA), false, "ingresso gratuito: não há o que estornar");
  assert.equal(podePedirReembolsoNaPagina(pedido({ pago_em: "lixo" }), AGORA), false);
  assert.equal(limiteDoPedidoDeReembolso("2026-11-13T15:00:00.000Z").toISOString(), "2026-11-20T15:00:00.000Z");
});

test("o e-mail aparece mascarado na página: o começo e o domínio, nunca o endereço inteiro", () => {
  assert.equal(emailMascarado("rita.souza@gmail.com"), "ri***@gmail.com");
  assert.equal(emailMascarado("a@x.com"), "a***@x.com");
  assert.equal(emailMascarado("ab@x.com"), "a***@x.com");
  assert.equal(emailMascarado("sem-arroba"), "o e-mail da compra");
  assert.equal(emailMascarado(""), "o e-mail da compra");
  assert.ok(!emailMascarado("rita.souza@gmail.com").includes("souza"));
});

test("as recusas: cada motivo do banco tem frase e status; pedido que não existe responde como a página do pedido (404); excesso de pedidos, 429", () => {
  for (const motivo of ["nao_encontrado", "fora_do_prazo", "ingresso_usado", "nao_elegivel", "ja_reembolsado", "em_andamento", "aguarde", "muitos_pedidos"] as const) {
    assert.ok(RECUSAS_DO_PEDIDO[motivo].mensagem.length > 5, motivo);
    assert.equal(lerMotivoDaRecusa(motivo), motivo);
  }
  assert.equal(RECUSAS_DO_PEDIDO.nao_encontrado.status, 404);
  assert.equal(RECUSAS_DO_PEDIDO.aguarde.status, 429);
  assert.equal(RECUSAS_DO_PEDIDO.muitos_pedidos.status, 429);
  assert.equal(RECUSAS_DO_PEDIDO.fora_do_prazo.status, 409);
  assert.equal(lerMotivoDaRecusa("toString"), null, "nada herdado do objeto");
  assert.equal(lerMotivoDaRecusa("qualquer"), null);
  assert.equal(lerMotivoDaRecusa(undefined), null);
});

test("o e-mail do link: nome, pedido, o endereço, até quando vale, uso único e 'sem a confirmação, nada acontece'; o HTML escapa o que vem de fora", () => {
  const m = mensagemDoLinkDeReembolso({ nome: "Rita", codigo: "ABCD2345", endereco: "https://jards.com.br/pedido/x/reembolso?c=" + CODIGO, expiraEm: "2026-11-22T15:00:00.000Z" });
  for (const t of ["Olá, Rita!", "pedido ABCD2345", "https://jards.com.br/pedido/x/reembolso?c=" + CODIGO, "12:00", "só pode ser usado uma vez", "nada acontece com o seu pedido", "valor total"]) assert.ok(m.texto.includes(t), `texto sem: ${t}`);
  assert.equal(m.assunto, "Confirme o reembolso do pedido ABCD2345");
  assert.ok(m.html.includes(`href="https://jards.com.br/pedido/x/reembolso?c=${CODIGO}"`));
  const sujo = mensagemDoLinkDeReembolso({ nome: "<b>Rita</b>", codigo: "A\"B", endereco: "https://x.co/?a=1&b=2", expiraEm: "2026-11-22T15:00:00.000Z" });
  assert.ok(!sujo.html.includes("<b>Rita"), "o nome é escapado");
  assert.ok(sujo.html.includes("&lt;b&gt;Rita"));
  assert.ok(sujo.html.includes("a=1&amp;b=2"));
});

test("depois de confirmar: toda saída do motor tem título e frase; só 'estornado' é concluído; o resto não promete dinheiro", () => {
  const todos: ResultadoDaConfirmacao[] = ["estornado", "fora_do_prazo", "nao_elegivel", "ja_reembolsado", "falhou", "repetido", "link_invalido"];
  for (const r of todos) { const t = textoDaConfirmacao(r); assert.ok(t.titulo.length > 3 && t.texto.length > 20, r); assert.equal(t.ok, r === "estornado", r); }
  assert.match(textoDaConfirmacao("estornado").texto, /mesmo meio/);
  assert.match(textoDaConfirmacao("falhou").texto, /análise/);
  assert.doesNotMatch(textoDaConfirmacao("falhou").texto, /devolvemos|devolvido/);
  assert.match(textoDaConfirmacao("link_invalido").texto, /uma vez só/);
});

const pedidoDoMotor = (sobre: Partial<PedidoParaReembolso> = {}): PedidoParaReembolso => ({
  id: "p", loja_id: "l", codigo: "ABCD2345", comprador_nome: "Rita", comprador_email: "rita@exemplo.com", situacao: "pago", total_centavos: 12000, taxa_centavos: 300, produtor_centavos: 11700, custo_meio_centavos: 99,
  pago_em: "2026-11-13T15:00:00.000Z", provedor: "asaas", provedor_ref: "pay_1", reembolsado_em: null, ingresso_usado: false, ...sobre,
});

test("o motor decide pela hora do PEDIDO na página, e não pela da confirmação: pedido no último dia, confirmado depois, ainda é atendido; pedido depois dos 7 dias, não", () => {
  // O banco entrega ao motor o e-mail da compra como remetente e a hora do clique como "chegada".
  const noPrazo = decidirReembolso({ pedido: pedidoDoMotor(), remetente: "rita@exemplo.com", recebidoEm: "2026-11-20T14:00:00.000Z" });
  assert.deepEqual(noPrazo, { acao: "estornar" });
  const tarde = decidirReembolso({ pedido: pedidoDoMotor(), remetente: "rita@exemplo.com", recebidoEm: "2026-11-20T15:00:01.000Z" });
  assert.equal(tarde.acao, "recusar");
  assert.equal(decidirReembolso({ pedido: pedidoDoMotor({ ingresso_usado: true }), remetente: "rita@exemplo.com", recebidoEm: "2026-11-20T14:00:00.000Z" }).acao, "recusar", "ingresso usado entre o pedido e a confirmação: o motor recusa");
  assert.equal(decidirReembolso({ pedido: pedidoDoMotor({ reembolsado_em: "2026-11-19T00:00:00.000Z" }), remetente: "rita@exemplo.com", recebidoEm: "2026-11-20T14:00:00.000Z" }).acao, "recusar", "já reembolsado por e-mail: o motor recusa");
});

const site = { titulo: "Cia de Teste" };
const evento = { titulo: "Hamlet", quando: "Sábado 20:00", local: "Teatro A" };

test("a página do pedido: com o botão, explica o caminho e deixa o e-mail como reserva; passado o prazo, diz isso; sem o botão, só o e-mail", () => {
  const base = { site, evento, comprador: "Rita", pedido: "ABCD2345", emailDeReembolso: "reembolso@exemplo.com", ingressos: [{ codigo: "K7M2QX9HTR", nome: "Inteira" }] };
  const pode = renderToStaticMarkup(createElement(TelaIngressos, { ...base, reembolso: { estado: "pode", acao: createElement("button", null, "BOTAO-AQUI") } }));
  for (const t of ["Precisa de reembolso?", "link de confirmação", "BOTAO-AQUI", "reembolso@exemplo.com", "reembolso - código do ingresso"]) assert.ok(pode.includes(t), `falta: ${t}`);
  const passou = renderToStaticMarkup(createElement(TelaIngressos, { ...base, reembolso: { estado: "prazo_passou" } }));
  assert.match(passou, /prazo de 7 dias da compra para pedir reembolso já passou/);
  assert.doesNotMatch(passou, /reembolso@exemplo\.com/);
  const antigo = renderToStaticMarkup(createElement(TelaIngressos, base));
  assert.ok(antigo.includes("reembolso@exemplo.com") && !antigo.includes("link de confirmação"), "sem o estado, a página segue como era");
});

test("o botão e a janela: pergunta com o e-mail mascarado e a regra de que só o link confirma; a página do link mostra o valor e só estorna no botão", () => {
  const botao = renderToStaticMarkup(createElement(PedirReembolso, { pedido: "0d760000-0000-4000-8000-0000000000e1", codigo: "ABCD2345", emailMascarado: "ri***@gmail.com" }));
  for (const t of ["Pedir reembolso", "<dialog", "Pedir reembolso do pedido ABCD2345", "ri***@gmail.com", "só sai quando você abrir o link e confirmar", "Enviar o link ao meu e-mail", "Voltar"]) assert.ok(botao.includes(t), `falta: ${t}`);
  const conf = renderToStaticMarkup(createElement(ConfirmarReembolso, { site, pedido: "0d760000-0000-4000-8000-0000000000e1", codigoDoLink: CODIGO, codigo: "ABCD2345", totalCentavos: 12000, valeAte: "22/11 às 12:00" }));
  for (const t of ["Confirmar o reembolso", "R$", "120,00", "pedido ABCD2345", "Confirmar reembolso", "voltar ao pedido", "22/11 às 12:00", "só pode ser usado uma vez", "Cia de Teste"]) assert.ok(conf.replace(/\s/g, " ").includes(t) || conf.replace(/\s/g, " ").includes(t.replace(/\s/g, " ")), `falta: ${t}`);
  assert.ok(!conf.includes(CODIGO), "o código do link não vai no HTML");
});

test("o que a página não pode fazer: abrir o link não gasta nada; confirmar confere o Asaas antes de gastar; as telas não importam nada de servidor", async () => {
  const pagina = await readFile("app/pedido/[id]/reembolso/page.tsx", "utf8");
  assert.ok(pagina.includes("verLinkDeReembolso") && !pagina.includes("confirmarReembolsoPelaPagina") && !pagina.includes("consumir"), "a página só olha");
  assert.match(pagina, /robots: \{ index: false/);
  assert.match(pagina, /referrer: "no-referrer"/, "o código do link não vai no Referer");
  const servidor = await readFile("lib/ticketeria/pagamento/reembolso-pagina-servidor.ts", "utf8");
  assert.ok(servidor.indexOf("ambienteDoAsaas()") < servidor.indexOf("fn_ticketeria_reembolso_link_consumir"), "sem Asaas, responde antes de gastar o link");
  assert.ok(servidor.includes('p_hash: sha256('), "o banco só recebe o hash");
  assert.ok(!/console\.(log|error)\([^)]*codigo[^)]*\)/.test(servidor.replace(/\[ticketeria\][^"]*"/g, "")), "o código do link não vai para o log");
  for (const arquivo of ["components/ticketeria/ReembolsoDoPedido.tsx", "lib/ticketeria/pagamento/reembolso-pagina.ts"]) {
    const texto = await readFile(arquivo, "utf8");
    assert.ok(!/from "node:|server-only/.test(texto), `${arquivo} vai para o navegador`);
  }
  const proxy = await readFile("proxy.ts", "utf8");
  assert.ok(proxy.includes('["/api/ticketeria/pedido", '), "há limite por IP");
  const rotaPedir = await readFile("app/api/ticketeria/pedido/[id]/reembolso/route.ts", "utf8");
  const rotaConfirmar = await readFile("app/api/ticketeria/pedido/[id]/reembolso/confirmar/route.ts", "utf8");
  for (const rota of [rotaPedir, rotaConfirmar]) { assert.ok(rota.includes("export async function POST") && !rota.includes("export async function GET"), "só POST"); assert.ok(rota.includes("no-store")); }
});
