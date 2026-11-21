import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TelaEscolherIngressos } from "../components/ticketeria/CompraView";
import { AvisarSheet, EsperaDaLoja, TelaListaDeEspera, TelaNaListaDeEspera } from "../components/ticketeria/ListaDeEsperaView";
import { SairDaEspera } from "../components/ticketeria/SairDaEspera";
import { comIdioma } from "./_helpers/com-idioma";
import { diaDoAviso, emailDoAviso, lerCorpoDaEspera, mensagemDoErroDaEspera, mensagemDoErroDeAvisar, opcoesDeAviso, quandoDaSessao, quandoEntrou, quantasAvisarPorPadrao } from "../lib/ticketeria/espera";
import { avisarEspera, type PessoaParaAvisar, type PortasDoAviso } from "../lib/ticketeria/espera-aviso";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/ /g, " ");
const SESSAO = "0d780000-0000-4000-8000-000000000081";
const INGRESSO = "0d780000-0000-4000-8000-000000000031";
const bom = { sessao_id: SESSAO, ingresso_id: INGRESSO, nome: "  Marina   Prado ", email: " Marina@Teste.com ", quantidade: 2 };

test("o pedido de entrar na lista: lido, aparado e conferido", () => {
  const r = lerCorpoDaEspera(bom);
  assert.deepEqual(r, { ok: true, corpo: { sessao_id: SESSAO, ingresso_id: INGRESSO, nome: "Marina Prado", email: "marina@teste.com", quantidade: 2 } });
  for (const [mudanca, problema] of [
    [{ sessao_id: "x" }, "sessão"], [{ ingresso_id: "" }, "ingresso"], [{ nome: "A" }, "nome"], [{ nome: "A".repeat(121) }, "nome"], [{ email: "sem-arroba" }, "e-mail"], [{ email: "a b@c.d" }, "e-mail"],
    [{ quantidade: 0 }, "quantidade"], [{ quantidade: 51 }, "quantidade"], [{ quantidade: 1.5 }, "quantidade"], [{ quantidade: "2" }, "quantidade"],
  ] as [object, string][]) {
    const l = lerCorpoDaEspera({ ...bom, ...mudanca });
    assert.ok(!l.ok && l.problemas.includes(problema), `${JSON.stringify(mudanca)}: ${JSON.stringify(l)}`);
  }
  assert.equal(lerCorpoDaEspera(null).ok, false);
});

test("os erros viram frases: do comprador e do produtor", () => {
  assert.match(mensagemDoErroDaEspera("ainda_ha_lugar"), /compre direto/);
  assert.match(mensagemDoErroDaEspera("lista_cheia"), /cheia/);
  assert.match(mensagemDoErroDaEspera("sessao_indisponivel"), /não está mais à venda/);
  assert.match(mensagemDoErroDaEspera("comprador_invalido"), /nome e o e-mail/);
  assert.match(mensagemDoErroDaEspera("?"), /Não foi possível entrar/);
  assert.match(mensagemDoErroDeAvisar("sem_lugar"), /Não há lugar livre/);
  assert.match(mensagemDoErroDeAvisar("sessao_de_outra_loja"), /não é desta loja/);
  assert.match(mensagemDoErroDeAvisar("?"), /Não foi possível avisar/);
});

test("quantas pessoas avisar: opções em ordem de chegada e a de saída cabe nos lugares livres", () => {
  const pessoas = [{ nome: "Marina Prado", quantidade: 2 }, { nome: "Carlos Lima", quantidade: 1 }, { nome: "Beatriz Nogueira", quantidade: 4 }];
  assert.deepEqual(opcoesDeAviso(pessoas), [
    { value: "1", label: "A primeira pessoa (Marina, 2 ingressos)" },
    { value: "2", label: "As 2 primeiras (3 ingressos)" },
    { value: "3", label: "Todas as 3 esperando (7 ingressos)" },
  ]);
  assert.deepEqual(opcoesDeAviso([{ nome: "Rita Souza", quantidade: 1 }]), [{ value: "1", label: "Rita (1 ingresso)" }]);
  assert.deepEqual(opcoesDeAviso([]), []);
  const muitas = Array.from({ length: 12 }, (_, i) => ({ nome: `P${i}`, quantidade: 1 }));
  const o = opcoesDeAviso(muitas);
  assert.equal(o.length, 9, "as 8 primeiras e a de todas");
  assert.deepEqual(o[o.length - 1], { value: "12", label: "Todas as 12 esperando (12 ingressos)" });
  assert.equal(quantasAvisarPorPadrao(pessoas, 3), 2, "2 + 1 = 3 lugares: as 2 primeiras");
  assert.equal(quantasAvisarPorPadrao(pessoas, 2), 1);
  assert.equal(quantasAvisarPorPadrao(pessoas, 1), 1, "a primeira pede 2 e só há 1: avisa ela mesmo assim (pelo menos uma)");
  assert.equal(quantasAvisarPorPadrao(pessoas, 100), 3);
  assert.equal(quantasAvisarPorPadrao([], 5), 1);
});

test("as datas da lista: no fuso do local e no horário de Brasília", () => {
  assert.equal(quandoDaSessao("2026-11-29T23:00:00Z"), "dom., 29 nov. · 20h");
  assert.equal(quandoDaSessao("2026-11-29T23:30:00Z"), "dom., 29 nov. · 20h30");
  assert.equal(quandoDaSessao("2026-11-29T23:00:00Z", "America/Manaus"), "dom., 29 nov. · 19h");
  assert.equal(quandoEntrou("2026-11-18T00:04:00Z"), "17/11 · 21:04");
  assert.equal(diaDoAviso("2026-11-19T15:00:00Z"), "19/11");
});

test("o e-mail do aviso: o link de compra, o de sair, e nada de reserva; o texto do usuário é escapado", () => {
  const m = emailDoAviso({ nome: "Marina <b>Prado</b>", evento: "Hamlet & Cia", ingresso: "Inteira", quando: "dom., 29 nov. · 20h", enderecoDeCompra: "https://jards.com.br/comprar/s1", enderecoParaSair: "https://jards.com.br/espera/t1" });
  assert.equal(m.assunto, "Voltaram ingressos: Hamlet & Cia");
  assert.ok(m.texto.includes("https://jards.com.br/comprar/s1") && m.texto.includes("https://jards.com.br/espera/t1") && m.texto.includes("não ficam reservados"));
  assert.ok(m.html.includes('href="https://jards.com.br/comprar/s1"') && m.html.includes('href="https://jards.com.br/espera/t1"'));
  assert.ok(m.html.includes("Hamlet &amp; Cia") && !m.html.includes("<b>Prado</b>"), "o que a pessoa digitou não vira HTML");
  assert.ok(m.texto.startsWith("Olá, Marina!"), "só o primeiro nome");
});

function portas(sobre: Partial<PortasDoAviso> = {}, pessoas: PessoaParaAvisar[] = [
  { id: "p1", nome: "Marina Prado", email: "marina@teste.invalid", token: "t1", quantidade: 2 },
  { id: "p2", nome: "Carlos Lima", email: "carlos@teste.invalid", token: "t2", quantidade: 1 },
]) {
  const visto = { avisar: [] as unknown[], desfeitos: [] as string[][], emails: [] as string[], erros: [] as unknown[] };
  const p: PortasDoAviso = {
    async avisar(loja, sessao, ingresso, quantas) { visto.avisar.push([loja, sessao, ingresso, quantas]); return pessoas; },
    async desfazer(ids) { visto.desfeitos.push(ids); },
    async dados() { return { evento: "Hamlet", ingresso: "Inteira", quando: "dom., 29 nov. · 20h" }; },
    async enviarEmail(para) { visto.emails.push(para); return true; },
    enderecoDeCompra: s => `https://jards.com.br/comprar/${s}`,
    enderecoParaSair: t => `https://jards.com.br/espera/${t}`,
    registrarErro: erro => visto.erros.push(erro),
    ...sobre,
  };
  return { p, visto };
}
const entrada = { loja: "l1", sessao: "s1", ingresso: "i1", quantas: 2 };

test("avisar: manda um e-mail para cada pessoa que o banco marcou, com o link de sair dela", async () => {
  const mensagens: { para: string; texto: string }[] = [];
  const { p, visto } = portas({ async enviarEmail(para, m) { mensagens.push({ para, texto: m.texto }); return true; } });
  assert.deepEqual(await avisarEspera(entrada, p), { avisadas: 2, falharam: 0 });
  assert.deepEqual(visto.avisar, [["l1", "s1", "i1", 2]]);
  assert.deepEqual(mensagens.map(m => m.para), ["marina@teste.invalid", "carlos@teste.invalid"]);
  assert.ok(mensagens[0].texto.includes("/espera/t1") && mensagens[1].texto.includes("/espera/t2"), "cada um recebe o seu link");
  assert.ok(mensagens[0].texto.includes("/comprar/s1"));
  assert.deepEqual(visto.desfeitos, [], "ninguém falhou: nada a desfazer");
});

test("avisar: quem não recebeu o e-mail volta para a vez (e o erro é registrado)", async () => {
  const { p, visto } = portas({ async enviarEmail(para) { if (para.startsWith("carlos")) throw new Error("caiu"); return true; } });
  assert.deepEqual(await avisarEspera(entrada, p), { avisadas: 1, falharam: 1 });
  assert.deepEqual(visto.desfeitos, [["p2"]]);
  assert.equal(visto.erros.length, 1);
  const recusado = portas({ async enviarEmail() { return false; } });
  assert.deepEqual(await avisarEspera(entrada, recusado.p), { avisadas: 0, falharam: 2 });
  assert.deepEqual(recusado.visto.desfeitos, [["p1", "p2"]], "e-mail recusado pelo provedor também devolve a vez");
});

test("avisar: sem os dados do e-mail ninguém é avisado e todos voltam; sem ninguém na fila, nada acontece; o erro do banco sobe", async () => {
  const semDados = portas({ async dados() { throw new Error("sem sessão"); } });
  assert.deepEqual(await avisarEspera(entrada, semDados.p), { avisadas: 0, falharam: 2 });
  assert.deepEqual(semDados.visto.desfeitos, [["p1", "p2"]]);
  assert.deepEqual(semDados.visto.emails, []);
  const vazia = portas({}, []);
  assert.deepEqual(await avisarEspera(entrada, vazia.p), { avisadas: 0, falharam: 0 });
  assert.deepEqual(vazia.visto.desfeitos, []);
  const semLugar = portas({ async avisar() { throw new Error("sem_lugar"); } });
  await assert.rejects(() => avisarEspera(entrada, semLugar.p), /sem_lugar/);
  const desfazerCai = portas({ async enviarEmail() { return false; }, async desfazer() { throw new Error("banco fora"); } });
  assert.deepEqual(await avisarEspera(entrada, desfazerCai.p), { avisadas: 0, falharam: 2 }, "falha ao desfazer não derruba a resposta");
  assert.equal(desfazerCai.visto.erros.length, 1);
});

const evento = { titulo: "Hamlet", quando: "sáb., 29 nov. · 20h", local: "Teatro" };
const site = { titulo: "Cia Teste" };

test("a compra: ingresso esgotado mostra 'Esgotado' e 'Avise-me se voltar', sem preço; o que ainda tem não muda", () => {
  const ingressos = [{ id: "i1", nome: "Inteira", descricao: null, limite: 10, faixas: [] }, { id: "i2", nome: "Meia", descricao: null, limite: 10, faixas: [{ preco_centavos: 3000, livres: 5 }] }];
  const com = html(createElement(TelaEscolherIngressos, { site, evento, ingressos, quantidades: {}, onEntrarNaEspera: () => {} }));
  assert.ok(com.includes("Esgotado") && com.includes("Avise-me se voltar") && com.includes("R$ 30,00"));
  assert.ok(!com.includes("Gratuito"), "esgotado não aparece como gratuito");
  const sem = html(createElement(TelaEscolherIngressos, { site, evento, ingressos, quantidades: {} }));
  assert.ok(sem.includes("Esgotado") && !sem.includes("Avise-me"), "sem a ação, só o selo");
});

test("as telas do comprador: o formulário, o erro e a confirmação", () => {
  const props = { site, evento, ingresso: { nome: "Inteira" }, valores: { nome: "Marina", email: "m@x.co" }, quantidade: 2, max: 4 };
  const f = html(createElement(TelaListaDeEspera, props));
  for (const t of ["Avise-me se voltar", "Inteira esgotado", "Entrar na lista", "Voltar", "não fica reservado", "apagamos depois da sessão"]) assert.ok(f.includes(t), `falta: ${t}`);
  assert.ok(html(createElement(TelaListaDeEspera, { ...props, erro: "Confira o e-mail." })).includes('role="alert"'));
  assert.ok(html(createElement(TelaListaDeEspera, { ...props, trabalhando: true })).includes("Entrando…"));
  const ok = html(createElement(TelaNaListaDeEspera, { site, evento, ingresso: { nome: "Inteira" }, email: "m@x.co", quantidade: 2 }));
  for (const t of ["Você está na lista", "2 lugares", "m@x.co", "quem comprar primeiro leva", "Voltar aos ingressos"]) assert.ok(ok.includes(t), `falta: ${t}`);
  assert.ok(html(createElement(TelaNaListaDeEspera, { site, evento, ingresso: { nome: "Inteira" }, email: "m@x.co", quantidade: 1 })).includes("um lugar"));
});

test("a página de sair da lista: a pergunta, com o botão", () => {
  const h = html(comIdioma(createElement(SairDaEspera, { token: "0d780000-0000-4000-8000-0000000000aa" })));
  assert.ok(h.includes("Sair da lista de espera?") && h.includes("Sair da lista"));
  assert.ok(html(comIdioma(createElement(SairDaEspera, { token: "0d780000-0000-4000-8000-0000000000aa" }), "de")).includes("Von der Warteliste abmelden?"));
});

test("a tela do produtor: a lista por ingresso, o vazio e a folha de avisar", () => {
  const vazio = html(createElement(EsperaDaLoja, { sessoes: [] }));
  assert.ok(vazio.includes("Ninguém na lista de espera"));
  const pessoa = (id: string, nome: string, avisado_em: string | null) => ({ id, nome, email: `${id}@x.co`, quantidade: 2, entrou: "18/11 · 21:04", avisado_em });
  const sessoes = [{ id: "s1", titulo: "Hamlet", quando: "dom., 29 nov. · 20h · Teatro", ingressos: [
    { id: "i1", nome: "Inteira", livres: 3, pessoas: [pessoa("p1", "Marina", null), pessoa("p2", "Rafael", "19/11")] },
    { id: "i2", nome: "Camarote", livres: 0, pessoas: [pessoa("p3", "Lúcia", null)] },
  ] }];
  const lista = html(createElement(EsperaDaLoja, { sessoes, onAvisar: () => {} }));
  for (const t of ["Hamlet", "dom., 29 nov. · 20h · Teatro", "1 pessoa esperando", "2 ingressos", "3 lugares livres agora", "esgotado", "ESPERANDO", "AVISADO 19/11", "Marina", "p1@x.co"]) assert.ok(lista.includes(t), `falta: ${t}`);
  assert.equal((lista.match(/disabled=""/g) ?? []).length, 1, "só o ingresso esgotado tem o botão de avisar desligado");
  const sheet = html(createElement(AvisarSheet, { ingresso: "Inteira", sessao: "Hamlet · dom., 29 nov. · 20h", livres: 3, opcoes: [{ value: "1", label: "A primeira pessoa (Marina, 2 ingressos)" }], quantas: "1", onClose: () => {} }));
  for (const t of ["Avisar quem espera", "3 lugares livres", "Voltaram ingressos para Hamlet", "Enviar avisos", "A primeira pessoa"]) assert.ok(sheet.includes(t), `falta: ${t}`);
});
