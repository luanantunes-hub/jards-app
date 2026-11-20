import assert from "node:assert/strict";
import test from "node:test";
import { CABECALHOS_PUBLICOS, CHAVE_PUBLICA, LIMITE_DE_POUCOS, VERSAO_DA_API, estadoNaApi, ingressoNaApi, lerChaveDaLoja, menorPreco, sessaoDetalhada, urlDeCompra } from "../lib/ticketeria/integracao";
import type { IngressoDaVitrine, VitrineDaSessao } from "../lib/ticketeria/vitrine";

// A API pública da Ticketeria (I0, parte 1): a forma da resposta e as contas. Sem banco e sem servidor.

const ingresso = (livres: number[], extra: Partial<IngressoDaVitrine> = {}): IngressoDaVitrine => ({ id: "i1", nome: "Pista", descricao: null, limite: 6, faixas: livres.map((l, n) => ({ preco_centavos: 5000 + n * 1000, livres: l })), ...extra });
const vitrine = (estado: VitrineDaSessao["estado"], ingressos: IngressoDaVitrine[]): VitrineDaSessao => ({
  estado, sessao_id: "0d760000-0000-4000-8000-0000000000e1", parcelas_max: 3, site: { titulo: "Teatro A", cor: "#282525" },
  evento: { titulo: "Hamlet", descricao: "Uma peça", classificacao: "14 anos", quando: "Sábado, 12 de dezembro, às 20h", local: "Teatro A, São Paulo/SP" }, ingressos,
});

test("a chave pública: tkp_ e 32 letras e números minúsculos", () => {
  assert.ok(CHAVE_PUBLICA.test("tkp_" + "a1".repeat(16)));
  for (const ruim of ["", "tkp_abc", "TKP_" + "a1".repeat(16), "tkp_" + "g1".repeat(16), "tkp_" + "a1".repeat(17), " tkp_" + "a1".repeat(16)]) assert.equal(CHAVE_PUBLICA.test(ruim), false, ruim);
});

test("o ingresso na API mostra se há e se são poucos, e nunca quantos restam", () => {
  assert.deepEqual(ingressoNaApi(ingresso([40])), { id: "i1", nome: "Pista", descricao: null, limite_por_pedido: 6, numerado: false, setor: null, disponivel: true, poucos: false, preco_centavos: 5000 });
  assert.equal(ingressoNaApi(ingresso([LIMITE_DE_POUCOS])).poucos, true);
  assert.equal(ingressoNaApi(ingresso([LIMITE_DE_POUCOS + 1])).poucos, false);
  assert.equal(ingressoNaApi(ingresso([3, 50])).poucos, false, "soma as faixas: 53 não são poucos");
  assert.equal(ingressoNaApi(ingresso([3, 4])).poucos, true, "soma as faixas: 7 são poucos");
  const esgotado = ingressoNaApi(ingresso([]));
  assert.deepEqual([esgotado.disponivel, esgotado.poucos, esgotado.preco_centavos], [false, false, null]);
  assert.deepEqual(ingressoNaApi(ingresso([20], { numerado: { setor: "Plateia" } })).setor, "Plateia");
  assert.equal(JSON.stringify(ingressoNaApi(ingresso([7]))).includes("livres"), false, "nenhuma contagem sai");
});

test("o estado: o da vitrine, e aberta sem nenhum ingresso com vaga vira esgotada", () => {
  assert.equal(estadoNaApi(vitrine("aberta", [ingresso([5])])), "aberta");
  assert.equal(estadoNaApi(vitrine("aberta", [ingresso([]), ingresso([0])])), "esgotada");
  assert.equal(estadoNaApi(vitrine("aberta", [])), "esgotada");
  assert.equal(estadoNaApi(vitrine("sessao_cancelada", [])), "cancelada");
  assert.equal(estadoNaApi(vitrine("sessao_encerrada", [])), "encerrada");
  assert.equal(estadoNaApi(vitrine("vendas_pausadas", [])), "vendas_pausadas");
  assert.equal(estadoNaApi(vitrine("nao_publicado", [])), "vendas_pausadas", "o rascunho não aparece como diferente");
});

test("o menor preço é o da faixa da vez do ingresso mais barato com vaga", () => {
  assert.equal(menorPreco([ingresso([5]), { ...ingresso([5]), id: "i2", faixas: [{ preco_centavos: 3000, livres: 2 }] }]), 3000);
  assert.equal(menorPreco([{ ...ingresso([0]), faixas: [] }]), null);
  assert.equal(menorPreco([]), null);
});

test("a sessão detalhada: versão, endereço de compra, estado, tema, parcelas e ingressos", () => {
  const s = sessaoDetalhada(vitrine("aberta", [ingresso([5])]), "https://app.jards.com.br/");
  assert.equal(s.versao, VERSAO_DA_API);
  assert.equal(s.sessao.url, "https://app.jards.com.br/comprar/0d760000-0000-4000-8000-0000000000e1");
  assert.equal(urlDeCompra("https://x.com/", "abc"), "https://x.com/comprar/abc");
  assert.deepEqual([s.estado, s.parcelas_max, s.tema.cor, s.ingressos.length, s.evento.titulo], ["aberta", 3, "#282525", 1, "Hamlet"]);
});

test("a chave da loja para a tela do produtor: lida com cuidado, com o endereço da API", () => {
  const chave = "tkp_" + "ab".repeat(16);
  assert.deepEqual(lerChaveDaLoja({ chave, ativa: true }, "https://app.jards.com.br/"), { chave, ativa: true, api: `https://app.jards.com.br/api/ticketeria/publico/${chave}` });
  for (const ruim of [null, [], {}, { chave: "x", ativa: true }, { chave, ativa: "sim" }, "texto"]) assert.equal(lerChaveDaLoja(ruim, "https://x"), null, JSON.stringify(ruim));
});

test("os cabeçalhos públicos: leitura aberta a qualquer site, só GET, com cache curto", () => {
  assert.equal(CABECALHOS_PUBLICOS["access-control-allow-origin"], "*");
  assert.equal(CABECALHOS_PUBLICOS["access-control-allow-methods"], "GET, OPTIONS");
  assert.match(CABECALHOS_PUBLICOS["cache-control"], /s-maxage=30/);
  assert.equal(Object.keys(CABECALHOS_PUBLICOS).some(k => k.includes("credentials")), false, "sem cookies entre sites");
});
