import test from "node:test";
import assert from "node:assert/strict";
import { abasDaRota, barraTemOQueMostrar, depoisDeAdicionar, escolhasDoComecar, type EscolhasDaLoja } from "../lib/ticketeria/menu";
import { hrefAtivoDoMenu, itemAtivoDoMenu, tituloDaPagina } from "../lib/navigation/rotas";

const MENU = ["/ingressos", "/ingressos/eventos", "/ingressos/vendas", "/ingressos/recebimentos", "/ingressos/divulgacao", "/ingressos/integracoes"];
const acende = (path: string) => hrefAtivoDoMenu(itemAtivoDoMenu(path), MENU);
const rotulos = (path: string, loja?: EscolhasDaLoja) => abasDaRota(path, loja)?.secoes.filter(secao => secao.abas.length > 0).map(secao => secao.abas.map(aba => aba.rotulo).join("+")).join(" | ");
const mais = (path: string, loja?: EscolhasDaLoja) => abasDaRota(path, loja)?.secoes.flatMap(secao => secao.mais).map(m => m.rotulo).join(",") ?? "";
/** Onde o "+" fica: o índice da seção que o traz. */
const secaoDoMais = (path: string, loja: EscolhasDaLoja) => abasDaRota(path, loja)?.secoes.findIndex(secao => secao.mais.length > 0);

const SO_PORTA: EscolhasDaLoja = { canais: ["porta"], usaEspacos: false };
const SO_ONLINE: EscolhasDaLoja = { canais: ["online"], usaEspacos: true };

test("cada página da Ticketeria acende um dos seis itens do menu", () => {
  const esperado: Record<string, string> = {
    "/ingressos": "/ingressos",
    "/ingressos/eventos": "/ingressos/eventos", "/ingressos/eventos/abc": "/ingressos/eventos", "/ingressos/locais": "/ingressos/eventos",
    "/ingressos/vendas": "/ingressos/vendas", "/ingressos/site": "/ingressos/vendas", "/ingressos/porta": "/ingressos/vendas", "/ingressos/porta/relatorio": "/ingressos/vendas", "/ingressos/bilheteria": "/ingressos/vendas",
    "/ingressos/recebimentos": "/ingressos/recebimentos",
    "/ingressos/divulgacao": "/ingressos/divulgacao", "/ingressos/cupons": "/ingressos/divulgacao", "/ingressos/espera": "/ingressos/divulgacao", "/ingressos/publico": "/ingressos/divulgacao",
    "/ingressos/integracoes": "/ingressos/integracoes",
  };
  for (const [rota, item] of Object.entries(esperado)) assert.equal(acende(rota), item, rota);
});

test("as abas aparecem só nas páginas agrupadas e acendem a aba certa", () => {
  assert.equal(abasDaRota("/ingressos"), null);
  assert.equal(abasDaRota("/ingressos/eventos/abc"), null, "a página de um evento não leva a barra");
  assert.equal(abasDaRota("/ingressos/recebimentos"), null);
  assert.equal(abasDaRota("/ingressos/comecar"), null);
  assert.equal(abasDaRota("/ingressos/eventos")?.ativa.rotulo, "Eventos");
  assert.equal(abasDaRota("/ingressos/porta/relatorio")?.ativa.rotulo, "Controle de entrada");
  assert.equal(abasDaRota("/ingressos/publico")?.grupo, "divulgacao");
  assert.equal(abasDaRota("/ingressos/locais")?.ativa.rotulo, "Espaços");
  assert.equal(abasDaRota("/ingressos/site")?.grupo, "vendas");
  assert.equal(abasDaRota("/ingressos/site")?.ativa.rotulo, "Loja online");
});

test("loja que ainda não escolheu (as que já existem): tudo aparece e nenhum + é oferecido", () => {
  assert.equal(rotulos("/ingressos/vendas"), "Pedidos | Loja online+Bilheteria | Controle de entrada");
  assert.equal(rotulos("/ingressos/eventos"), "Eventos+Espaços");
  assert.equal(mais("/ingressos/vendas"), "");
  assert.equal(mais("/ingressos/eventos"), "");
});

test("Vendas: Pedidos e o Controle de entrada são de todos; a Loja online e a Bilheteria, de quem escolheu, e o que falta vira um +", () => {
  assert.equal(rotulos("/ingressos/vendas", SO_PORTA), "Pedidos | Bilheteria | Controle de entrada");
  assert.equal(mais("/ingressos/vendas", SO_PORTA), "Loja online");
  assert.equal(rotulos("/ingressos/vendas", SO_ONLINE), "Pedidos | Loja online | Controle de entrada");
  assert.equal(mais("/ingressos/vendas", SO_ONLINE), "Bilheteria");
  const duas: EscolhasDaLoja = { canais: ["porta", "online"], usaEspacos: true };
  assert.equal(rotulos("/ingressos/vendas", duas), "Pedidos | Loja online+Bilheteria | Controle de entrada");
  assert.equal(mais("/ingressos/vendas", duas), "");
  const nenhum: EscolhasDaLoja = { canais: [], usaEspacos: true };
  assert.equal(rotulos("/ingressos/vendas", nenhum), "Pedidos | Controle de entrada");
  assert.equal(mais("/ingressos/vendas", nenhum), "Loja online,Bilheteria", "sem canal nenhum, os dois viram +");
  assert.equal(secaoDoMais("/ingressos/vendas", SO_PORTA), 1, "o + fica junto da Bilheteria e da Loja online, antes do Controle de entrada");
});

test("Programação: os Espaços só para quem trabalha com espaço; os outros recebem um +", () => {
  assert.equal(rotulos("/ingressos/eventos", SO_PORTA), "Eventos");
  assert.equal(mais("/ingressos/eventos", SO_PORTA), "Espaços");
  assert.equal(rotulos("/ingressos/eventos", SO_ONLINE), "Eventos+Espaços");
  assert.equal(mais("/ingressos/eventos", SO_ONLINE), "");
});

test("a aba da página aberta fica à vista mesmo que a loja não a tenha escolhido (endereço antigo, link do e-mail)", () => {
  assert.equal(rotulos("/ingressos/site", SO_PORTA), "Pedidos | Loja online+Bilheteria | Controle de entrada");
  assert.equal(mais("/ingressos/site", SO_PORTA), "");
  assert.equal(rotulos("/ingressos/locais", SO_PORTA), "Eventos+Espaços");
});

test("a barra de uma aba só e sem + não aparece (Configurações tem só Integrações)", () => {
  const configuracoes = abasDaRota("/ingressos/integracoes")!;
  assert.equal(barraTemOQueMostrar(configuracoes), false);
  assert.equal(barraTemOQueMostrar(abasDaRota("/ingressos/eventos", SO_PORTA)!), true, "uma aba mais um + aparece");
  assert.equal(barraTemOQueMostrar(abasDaRota("/ingressos/vendas")!), true);
});

test("tocar no + grava a escolha sem repetir e sem perder as outras", () => {
  const online = abasDaRota("/ingressos/vendas", SO_PORTA)!.secoes[1].mais[0];
  assert.deepEqual(depoisDeAdicionar(SO_PORTA, online), { canais: ["porta", "online"], usaEspacos: false });
  assert.deepEqual(depoisDeAdicionar({ canais: ["porta", "online"], usaEspacos: false }, online), { canais: ["porta", "online"], usaEspacos: false }, "tocar de novo não repete");
  assert.deepEqual(depoisDeAdicionar({ canais: null, usaEspacos: null }, online), { canais: ["online"], usaEspacos: null }, "de quem não tinha escolhido: o canal entra e o resto segue sem escolha");
  const espacos = abasDaRota("/ingressos/eventos", SO_PORTA)!.secoes[0].mais[0];
  assert.deepEqual(depoisDeAdicionar(SO_PORTA, espacos), { canais: ["porta"], usaEspacos: true });
});

test("o Começar grava a resposta na primeira vez e soma nas seguintes", () => {
  const vazio: EscolhasDaLoja = { canais: null, usaEspacos: null };
  assert.deepEqual(escolhasDoComecar(vazio, { canais: ["porta"], temEspaco: false }), { canais: ["porta"], usaEspacos: false }, "só bilheteria, sem espaço: a primeira vez vale a resposta");
  assert.deepEqual(escolhasDoComecar(vazio, { canais: ["porta", "online"], temEspaco: true }), { canais: ["porta", "online"], usaEspacos: true });
  assert.deepEqual(escolhasDoComecar({ canais: ["porta"], usaEspacos: false }, { canais: ["online"], temEspaco: false }), { canais: ["porta", "online"], usaEspacos: false }, "o segundo evento soma o canal novo");
  assert.deepEqual(escolhasDoComecar({ canais: ["porta", "online"], usaEspacos: true }, { canais: ["porta"], temEspaco: false }), { canais: ["porta", "online"], usaEspacos: true }, "e nunca tira o que já havia");
});

test("os títulos das abas usam os nomes novos", () => {
  assert.equal(tituloDaPagina("/ingressos/eventos"), "Programação — Jards");
  assert.equal(tituloDaPagina("/ingressos/recebimentos"), "Financeiro — Jards");
  assert.equal(tituloDaPagina("/ingressos/locais"), "Espaços — Jards");
  assert.equal(tituloDaPagina("/ingressos/site"), "Loja online — Jards");
  assert.equal(tituloDaPagina("/ingressos/porta"), "Controle de entrada — Jards");
  assert.equal(tituloDaPagina("/ingressos"), "Início — Jards");
});
