import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buscarNaTicketeria, normalizar } from "../components/ticketeria/BuscaDoTopo";

const eventos = [{ id: "e1", titulo: "Hamlet" }, { id: "e2", titulo: "Cabaré das Sombras" }];
const compras = [
  { id: "c1", codigo: "ABCD1234", comprador: "Larisa Mello", email: "larisa@exemplo.com.br", evento: "Hamlet" },
  { id: "c2", codigo: "ZXCV9876", comprador: "João Pedro", email: "joao@exemplo.com.br", evento: "Cabaré das Sombras" },
];

test("a busca ignora acento e maiúscula", () => {
  assert.equal(normalizar("  Cabaré  "), "cabare");
  assert.deepEqual(buscarNaTicketeria("CABARE", eventos, compras).map(r => r.chave), ["e:e2"]);
  assert.deepEqual(buscarNaTicketeria("joao", eventos, compras).map(r => r.chave), ["c:c2"]);
});

test("acha páginas do módulo, eventos e compras (por nome, e-mail ou código), cada um com o seu destino", () => {
  assert.deepEqual(buscarNaTicketeria("vend", eventos, compras).map(r => [r.grupo, r.href]), [["Páginas", "/ingressos/vendas"]]);
  const hamlet = buscarNaTicketeria("hamlet", eventos, compras);
  assert.deepEqual(hamlet.map(r => r.chave), ["e:e1"], "a compra não entra só porque o evento tem o mesmo nome");
});

test("compra achada leva à tela de vendas já com a compra aberta; sem texto, nada", () => {
  assert.equal(buscarNaTicketeria("larisa", eventos, compras)[0].href, "/ingressos/vendas?compra=c1");
  assert.equal(buscarNaTicketeria("ABCD12", eventos, compras)[0].chave, "c:c1");
  assert.deepEqual(buscarNaTicketeria("   ", eventos, compras), []);
  assert.deepEqual(buscarNaTicketeria("zzzz", eventos, compras), []);
});

test("na Ticketeria o topo tem busca, notificações e configurações, e o menu não tem rodapé nem a bolinha com a letra", async () => {
  const layout = await readFile("app/(dashboard)/layout.tsx", "utf8");
  assert.match(layout, /menuFixoAberto && <BuscaDoTopo organizationId=\{organizationId\} \/>/);
  assert.match(layout, /\{user && <NotificationBell userId=\{user\.id\} \/>\}/);
  assert.match(layout, /\{!menuFixoAberto && <div className="px-2 py-2\.5 border-t/);
  assert.match(layout, /\) : menuFixoAberto \? null : \(/);
  assert.doesNotMatch(layout, /Sair da Ticketeria/);
});
