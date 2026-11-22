import test from "node:test";
import assert from "node:assert/strict";
import { abasDaRota, barraTemOQueMostrar, depoisDeAdicionar, escolhasDoComecar, voltaDaRota, type EscolhasDaLoja } from "../lib/ticketeria/menu";
import { hrefAtivoDoMenu, itemAtivoDoMenu, tituloDaPagina } from "../lib/navigation/rotas";

const MENU = ["/ingressos", "/ingressos/eventos", "/ingressos/vender", "/ingressos/recebimentos", "/ingressos/divulgacao", "/ingressos/integracoes"];
const acende = (path: string) => hrefAtivoDoMenu(itemAtivoDoMenu(path), MENU);
const rotulos = (path: string, loja?: EscolhasDaLoja) => abasDaRota(path, loja)?.secoes.filter(secao => secao.abas.length > 0).map(secao => secao.abas.map(aba => aba.rotulo).join("+")).join(" | ");
const mais = (path: string, loja?: EscolhasDaLoja) => abasDaRota(path, loja)?.secoes.flatMap(secao => secao.mais).map(m => m.rotulo).join(",") ?? "";

const SO_PORTA: EscolhasDaLoja = { canais: ["porta"], usaEspacos: false };
const SO_ONLINE: EscolhasDaLoja = { canais: ["online"], usaEspacos: true };

test("cada página da Ticketeria acende um dos seis itens do menu", () => {
  const esperado: Record<string, string> = {
    "/ingressos": "/ingressos",
    "/ingressos/eventos": "/ingressos/eventos", "/ingressos/eventos/abc": "/ingressos/eventos", "/ingressos/locais": "/ingressos/eventos",
    "/ingressos/vender": "/ingressos/vender", "/ingressos/bilheteria": "/ingressos/vender", "/ingressos/site": "/ingressos/vender",
    "/ingressos/recebimentos": "/ingressos/recebimentos", "/ingressos/vendas": "/ingressos/recebimentos", "/ingressos/porta": "/ingressos/recebimentos", "/ingressos/porta/relatorio": "/ingressos/recebimentos",
    "/ingressos/divulgacao": "/ingressos/divulgacao", "/ingressos/cupons": "/ingressos/divulgacao", "/ingressos/espera": "/ingressos/divulgacao", "/ingressos/publico": "/ingressos/divulgacao",
    "/ingressos/integracoes": "/ingressos/integracoes",
  };
  for (const [rota, item] of Object.entries(esperado)) assert.equal(acende(rota), item, rota);
});

test("as abas aparecem só nas páginas agrupadas e acendem a aba certa", () => {
  assert.equal(abasDaRota("/ingressos"), null);
  assert.equal(abasDaRota("/ingressos/vender"), null, "Vendas é a página de caixas: sem abas");
  assert.equal(abasDaRota("/ingressos/bilheteria"), null, "as páginas das caixas não têm abas");
  assert.equal(abasDaRota("/ingressos/site"), null);
  assert.equal(abasDaRota("/ingressos/eventos/abc"), null, "a página de um evento não leva a barra");
  assert.equal(abasDaRota("/ingressos/comecar"), null);
  assert.equal(abasDaRota("/ingressos/eventos")?.ativa.rotulo, "Eventos");
  assert.equal(abasDaRota("/ingressos/porta/relatorio")?.ativa.rotulo, "Controle de entrada");
  assert.equal(abasDaRota("/ingressos/vendas")?.ativa.rotulo, "Pedidos");
  assert.equal(abasDaRota("/ingressos/publico")?.grupo, "divulgacao");
  assert.equal(abasDaRota("/ingressos/locais")?.ativa.rotulo, "Espaços");
});

test("Financeiro tem Recebimentos, Pedidos e o Controle de entrada, para todas as lojas", () => {
  assert.equal(rotulos("/ingressos/recebimentos"), "Recebimentos+Pedidos+Controle de entrada");
  assert.equal(rotulos("/ingressos/vendas", SO_PORTA), "Recebimentos+Pedidos+Controle de entrada", "o canal escolhido não esconde nada daqui");
  assert.equal(rotulos("/ingressos/porta", SO_ONLINE), "Recebimentos+Pedidos+Controle de entrada");
  assert.equal(abasDaRota("/ingressos/recebimentos")?.grupo, "financeiro");
  assert.equal(mais("/ingressos/recebimentos"), "", "Financeiro não tem +");
});

test("as páginas das caixas de Vendas têm o caminho de volta e as outras não", () => {
  assert.deepEqual(voltaDaRota("/ingressos/bilheteria"), { rotulo: "Vendas", href: "/ingressos/vender" });
  assert.deepEqual(voltaDaRota("/ingressos/site"), { rotulo: "Vendas", href: "/ingressos/vender" });
  assert.equal(voltaDaRota("/ingressos/vender"), null, "na própria página de caixas, nada a voltar");
  assert.equal(voltaDaRota("/ingressos/vendas"), null, "os Pedidos moram em Financeiro");
  assert.equal(voltaDaRota("/ingressos/eventos"), null);
});

test("loja que ainda não escolheu: Programação mostra tudo e nenhum + é oferecido", () => {
  assert.equal(rotulos("/ingressos/eventos"), "Eventos+Espaços");
  assert.equal(mais("/ingressos/eventos"), "");
});

test("Programação: os Espaços só para quem trabalha com espaço; os outros recebem um +", () => {
  assert.equal(rotulos("/ingressos/eventos", SO_PORTA), "Eventos");
  assert.equal(mais("/ingressos/eventos", SO_PORTA), "Espaços");
  assert.equal(rotulos("/ingressos/eventos", SO_ONLINE), "Eventos+Espaços");
  assert.equal(mais("/ingressos/eventos", SO_ONLINE), "");
});

test("a aba da página aberta fica à vista mesmo que a loja não a tenha escolhido (endereço antigo, link do e-mail)", () => {
  assert.equal(rotulos("/ingressos/locais", SO_PORTA), "Eventos+Espaços");
});

test("a barra de uma aba só e sem + não aparece (Configurações tem só Integrações)", () => {
  assert.equal(barraTemOQueMostrar(abasDaRota("/ingressos/integracoes")!), false);
  assert.equal(barraTemOQueMostrar(abasDaRota("/ingressos/eventos", SO_PORTA)!), true, "uma aba mais um + aparece");
  assert.equal(barraTemOQueMostrar(abasDaRota("/ingressos/recebimentos")!), true);
});

test("tocar no + grava a escolha sem repetir e sem perder as outras", () => {
  const espacos = abasDaRota("/ingressos/eventos", SO_PORTA)!.secoes[0].mais[0];
  assert.deepEqual(depoisDeAdicionar(SO_PORTA, espacos), { canais: ["porta"], usaEspacos: true });
  const online = { rotulo: "Site próprio", href: "/ingressos/site", grava: { canal: "online" as const } };
  assert.deepEqual(depoisDeAdicionar(SO_PORTA, online), { canais: ["porta", "online"], usaEspacos: false });
  assert.deepEqual(depoisDeAdicionar({ canais: ["porta", "online"], usaEspacos: false }, online), { canais: ["porta", "online"], usaEspacos: false }, "tocar de novo não repete");
  assert.deepEqual(depoisDeAdicionar({ canais: null, usaEspacos: null }, online), { canais: ["online"], usaEspacos: null });
});

test("o Começar grava a resposta na primeira vez e soma nas seguintes", () => {
  const vazio: EscolhasDaLoja = { canais: null, usaEspacos: null };
  assert.deepEqual(escolhasDoComecar(vazio, { canais: ["porta"], temEspaco: false }), { canais: ["porta"], usaEspacos: false });
  assert.deepEqual(escolhasDoComecar(vazio, { canais: ["porta", "online"], temEspaco: true }), { canais: ["porta", "online"], usaEspacos: true });
  assert.deepEqual(escolhasDoComecar({ canais: ["porta"], usaEspacos: false }, { canais: ["online"], temEspaco: false }), { canais: ["porta", "online"], usaEspacos: false });
  assert.deepEqual(escolhasDoComecar({ canais: ["porta", "online"], usaEspacos: true }, { canais: ["porta"], temEspaco: false }), { canais: ["porta", "online"], usaEspacos: true });
});

test("os títulos das abas usam os nomes novos", () => {
  assert.equal(tituloDaPagina("/ingressos/eventos"), "Programação — Jards");
  assert.equal(tituloDaPagina("/ingressos/vender"), "Vendas — Jards");
  assert.equal(tituloDaPagina("/ingressos/vendas"), "Pedidos — Jards");
  assert.equal(tituloDaPagina("/ingressos/recebimentos"), "Recebimentos — Jards");
  assert.equal(tituloDaPagina("/ingressos/locais"), "Espaços — Jards");
  assert.equal(tituloDaPagina("/ingressos/divulgacao"), "Marketing — Jards", "Divulgação virou Marketing");
  assert.equal(tituloDaPagina("/ingressos/site"), "Loja online — Jards");
  assert.equal(tituloDaPagina("/ingressos/porta"), "Controle de entrada — Jards");
  assert.equal(tituloDaPagina("/ingressos"), "Início — Jards");
});
