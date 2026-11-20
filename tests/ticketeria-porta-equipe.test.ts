import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PortaDaEquipe } from "../components/ticketeria/PortaDaEquipe";
import { TOKEN_DO_LINK, linksDaEquipe, proximoNomeDeLink, resumoDaEquipe, validadeDoLink } from "../lib/ticketeria/porta";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/ /g, " ");
const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

test("o segredo do link: 64 letras minúsculas e números, nada mais", () => {
  assert.equal(TOKEN_DO_LINK.test(TOKEN), true);
  for (const ruim of ["", "abc", TOKEN.slice(1), TOKEN + "a", TOKEN.toUpperCase(), TOKEN.slice(0, 63) + "-", `${TOKEN.slice(0, 32)}/../${TOKEN.slice(0, 28)}`]) assert.equal(TOKEN_DO_LINK.test(ruim), false, ruim);
});

test("a validade do link: o dia e a hora no fuso do local", () => {
  assert.equal(validadeDoLink("2026-11-30T23:00:00.000Z", "America/Sao_Paulo"), "seg., 30/11 às 20:00");
  assert.equal(validadeDoLink("2026-11-30T23:00:00.000Z", "America/Manaus"), "seg., 30/11 às 19:00");
  assert.equal(validadeDoLink("lixo", "America/Sao_Paulo"), "lixo");
});

test("a lista de links da folha: o endereço leva a origem e o segredo; ligado só se o banco diz; o que não se entende vira nulo", () => {
  const r = linksDaEquipe({ fuso: "America/Sao_Paulo", links: [
    { id: "l1", rotulo: "Porta principal", token: TOKEN, valido_ate: "2026-11-30T23:00:00.000Z", ativo: true },
    { id: "l2", rotulo: "Camarote", token: TOKEN.replace(/a/g, "b"), valido_ate: "2026-11-30T23:00:00.000Z", ativo: false },
  ] }, "https://jards.com.br/");
  assert.deepEqual(r?.map(l => [l.id, l.rotulo, l.endereco, l.valido_ate, l.ativo]), [
    ["l1", "Porta principal", `https://jards.com.br/porta/${TOKEN}`, "seg., 30/11 às 20:00", true],
    ["l2", "Camarote", `https://jards.com.br/porta/${TOKEN.replace(/a/g, "b")}`, "seg., 30/11 às 20:00", false],
  ]);
  assert.deepEqual(linksDaEquipe({ links: [] }, "https://x"), []);
  for (const ruim of [null, {}, { links: "x" }, { links: [{ id: "l", token: "curto" }] }, { links: [{ token: TOKEN }] }]) assert.equal(linksDaEquipe(ruim, "https://x"), null, JSON.stringify(ruim));
});

test("o nome do próximo link: Porta 1, Porta 2... o primeiro que ainda não existe", () => {
  assert.equal(proximoNomeDeLink([]), "Porta 1");
  assert.equal(proximoNomeDeLink(["Porta 1"]), "Porta 2");
  assert.equal(proximoNomeDeLink(["Porta 1", "porta 2 ", "Camarote"]), "Porta 3");
  assert.equal(proximoNomeDeLink(["Porta 2"]), "Porta 1", "preenche o buraco");
  assert.equal(proximoNomeDeLink(["Camarote"]), "Porta 1");
});

test("o resumo da equipe: evento, dia da sessão, nome do link e a contagem; o que não se entende vira nulo", () => {
  const r = resumoDaEquipe({ validos: 96, entraram: 63, fuso: "America/Sao_Paulo", evento: "Hamlet", inicio: "2026-11-29T23:00:00.000Z", link: "Porta 1", recentes: [{ codigo: "K", ingresso: "Inteira", assento: "Plateia · Fileira C · lugar 7", comprador: "Rita", usado_em: "2026-11-29T22:58:00.000Z" }] });
  assert.deepEqual([r?.evento, r?.quando, r?.link, r?.resumo.validos, r?.resumo.entraram, r?.resumo.recentes[0].hora, r?.resumo.recentes[0].assento], ["Hamlet", "dom., 29/11 às 20:00", "Porta 1", 96, 63, "19:58", "Plateia · Fileira C · lugar 7"]);
  assert.equal(resumoDaEquipe({ evento: "X" }), null);
  assert.equal(resumoDaEquipe(null), null);
});

test("a tela da equipe abre com 'Abrindo a porta…' (o resto vem da rota do link) e não leva nada do produtor", () => {
  const h = html(createElement(PortaDaEquipe, { token: TOKEN }));
  assert.ok(h.includes("Abrindo a porta…"));
  for (const proibido of ["Relatório", "Link da equipe", "Desfazer", "Vendas"]) assert.ok(!h.includes(proibido), proibido);
});
