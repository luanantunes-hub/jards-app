import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { moduloDaBusca, notificacaoDoModulo } from "../lib/notificacoes-modulo";

test("na Ticketeria só valem as notificações do módulo: categoria, evento ou link", () => {
  assert.equal(notificacaoDoModulo({ categoria: "ticketeria" }, "ticketeria"), true);
  assert.equal(notificacaoDoModulo({ categoria: "sistema", event_key: "ticketeria_venda_paga" }, "ticketeria"), true);
  assert.equal(notificacaoDoModulo({ categoria: "sistema", tipo: "ticketeria_reembolso" }, "ticketeria"), true);
  assert.equal(notificacaoDoModulo({ categoria: "sistema", link: "/ingressos/vendas" }, "ticketeria"), true);
  assert.equal(notificacaoDoModulo({ link: "/ingressos" }, "ticketeria"), true);
});

test("o resto do Jards fica de fora do sino da Ticketeria", () => {
  assert.equal(notificacaoDoModulo({ categoria: "editais", tipo: "edital", link: "/editais-abertos" }, "ticketeria"), false);
  assert.equal(notificacaoDoModulo({ categoria: "atividades", event_key: "atividade_atrasada", link: "/atividades" }, "ticketeria"), false);
  assert.equal(notificacaoDoModulo({ categoria: "propostas", link: "/ingressosxyz" }, "ticketeria"), false, "só /ingressos e o que está debaixo dele");
  assert.equal(notificacaoDoModulo({}, "ticketeria"), false);
});

test("?modulo=ticketeria vira o módulo; qualquer outra coisa, nenhum", () => {
  assert.equal(moduloDaBusca("?modulo=ticketeria"), "ticketeria");
  assert.equal(moduloDaBusca("?modulo=captacao"), null);
  assert.equal(moduloDaBusca(""), null);
});

test("o sino da Ticketeria não busca editais e a lista completa respeita o módulo", async () => {
  const sino = await readFile("components/notifications/NotificationBell.tsx", "utf8");
  assert.match(sino, /modulo \? \{ data: \[\] \} : await supabase\s*\.from\("editais"\)/);
  assert.match(sino, /notificacaoDoModulo\(n, modulo\)/);
  assert.match(sino, /\/notificacoes\?modulo=\$\{modulo\}/);
  const layout = await readFile("app/(dashboard)/layout.tsx", "utf8");
  assert.match(layout, /<NotificationBell userId=\{user\.id\} modulo=\{menuFixoAberto \? "ticketeria" : undefined\} \/>/);
  const pagina = await readFile("app/(dashboard)/notificacoes/page.tsx", "utf8");
  assert.match(pagina, /moduloDaBusca\(window\.location\.search\)/);
});
