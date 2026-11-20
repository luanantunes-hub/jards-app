import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_SELECAO,
  alternarNaSelecao,
  alternarPaginaNaSelecao,
  aplicouAlgo,
  enderecoDoResultado,
  mensagemDoLote,
  notaDoLote,
  planejarLote,
  podeAdicionarAoCrm,
  traduzirErroDoLote,
  type EmpresaDaBase,
  type EmpresaDoCrm,
  type PedidoDoLote,
  type Selecao,
} from "../lib/patrocinadores-selecao";

const EU = "usuario-eu";
const COLEGA = "usuario-colega";
const ORG = "org-1";

const base = (id: string, nome: string, extra: Partial<EmpresaDaBase> = {}): EmpresaDaBase => ({
  id, nome, setor: "Bancos", site: `https://www.${id}.com.br/inicio`, cidade: "São Paulo", estado: "SP", ...extra,
});

const crm = (id: string, nome: string, extra: Partial<EmpresaDoCrm> = {}): EmpresaDoCrm => ({
  id, nome, empresa_pub_id: null, account_id: EU, tags: [], responsavel_interno_id: null, ...extra,
});

function plano(empresas: EmpresaDaBase[], doCrm: EmpresaDoCrm[], pedido: PedidoDoLote, vocabulario: string[] = []) {
  return planejarLote({ empresas, doCrm, organizacaoId: ORG, usuarioId: EU, pedido, vocabulario });
}

test("quem edita leva empresas para o CRM; leitor, captador e proponente não", () => {
  assert.equal(podeAdicionarAoCrm("admin"), true);
  assert.equal(podeAdicionarAoCrm("colaborador"), true);
  assert.equal(podeAdicionarAoCrm("visualizador"), true, "nome antigo de colaborador");
  assert.equal(podeAdicionarAoCrm("leitor"), false);
  assert.equal(podeAdicionarAoCrm("captador"), false);
  assert.equal(podeAdicionarAoCrm("proponente"), false);
  assert.equal(podeAdicionarAoCrm(null), false, "enquanto o papel não carrega, nada de caixas");
});

test("a seleção marca, desmarca e respeita o limite de 50 por vez", () => {
  const a = base("a", "Alfa");
  let selecao: Selecao = new Map();
  selecao = alternarNaSelecao(selecao, a);
  assert.deepEqual([...selecao.keys()], ["a"]);
  selecao = alternarNaSelecao(selecao, a);
  assert.equal(selecao.size, 0);

  const cheia: Selecao = new Map(Array.from({ length: MAX_SELECAO }, (_, i) => [`e${i}`, base(`e${i}`, `Empresa ${i}`)] as const));
  assert.equal(alternarNaSelecao(cheia, a).size, MAX_SELECAO, "com o limite cheio, a marcação nova não entra");
  assert.equal(alternarNaSelecao(cheia, base("e3", "Empresa 3")).size, MAX_SELECAO - 1, "mas desmarcar sempre pode");
});

test("a caixa do cabeçalho marca a página toda, desmarca quando já está toda marcada e para no limite", () => {
  const pagina = [base("a", "Alfa"), base("b", "Beta"), base("c", "Gama")];
  const marcada = alternarPaginaNaSelecao(new Map(), pagina);
  assert.deepEqual([...marcada.keys()], ["a", "b", "c"]);
  assert.equal(alternarPaginaNaSelecao(marcada, pagina).size, 0);

  const parcial = alternarNaSelecao(new Map(), pagina[1]);
  assert.equal(alternarPaginaNaSelecao(parcial, pagina).size, 3, "página pela metade: completa em vez de limpar");

  const quase: Selecao = new Map(Array.from({ length: MAX_SELECAO - 1 }, (_, i) => [`e${i}`, base(`e${i}`, `Empresa ${i}`)] as const));
  assert.equal(alternarPaginaNaSelecao(quase, pagina).size, MAX_SELECAO, "marca só o que cabe");
  assert.equal(alternarPaginaNaSelecao(new Map(), []).size, 0, "página vazia não faz nada");
});

test("lote de tag: quem não está no CRM entra já com a tag, com os dados da base e sem responsável", () => {
  const p = plano([base("itau", "Itaú Unibanco")], [], { tipo: "tag", tags: ["Prospecção"] });
  assert.equal(p.criar.length, 1);
  assert.deepEqual(p.criar[0], {
    organization_id: ORG,
    account_id: EU,
    nome: "Itaú Unibanco",
    nome_key: "itau unibanco",
    tipo: "prospect",
    setor: "Bancos",
    site: "https://www.itau.com.br/inicio",
    domain_key: "itau.com.br",
    cidade: "São Paulo",
    estado: "SP",
    empresa_pub_id: "itau",
    tags: ["Prospecção"],
    responsavel_interno_id: null,
  });
  assert.deepEqual(p.resumo, { criadas: 1, atualizadas: 0, semMudanca: 0, deOutraPessoa: 0 });
  assert.deepEqual(p.gravarTags, []);
  assert.deepEqual(p.gravarResponsavel, []);
});

test("lote de responsável: quem não está no CRM entra já com a pessoa, sem tags", () => {
  const p = plano([base("a", "Alfa")], [], { tipo: "responsavel", pessoaId: COLEGA, nome: "Ana" });
  assert.equal(p.criar[0].responsavel_interno_id, COLEGA);
  assert.deepEqual(p.criar[0].tags, []);
});

test("a tag entra com a grafia que o time já usa", () => {
  const p = plano([base("a", "Alfa")], [], { tipo: "tag", tags: ["musica"] }, ["Música"]);
  assert.deepEqual(p.criar[0].tags, ["Música"]);
});

test("quem já está no CRM (por ligação ou pelo mesmo nome) não é duplicado e recebe a tag", () => {
  const doCrm = [
    crm("c1", "Alfa S.A.", { empresa_pub_id: "a", tags: ["Antiga"] }),
    crm("c2", "BETA", { empresa_pub_id: null }),
  ];
  const p = plano([base("a", "Alfa S.A."), base("b", "Beta"), base("g", "Gama")], doCrm, { tipo: "tag", tags: ["Q1"] });
  assert.deepEqual(p.criar.map((nova) => nova.nome), ["Gama"]);
  assert.deepEqual(p.resumo, { criadas: 1, atualizadas: 2, semMudanca: 0, deOutraPessoa: 0 });
  // a que já tinha "Antiga" fica com as duas; a sem tags só com "Q1": são gravações diferentes
  assert.deepEqual(p.gravarTags.map((g) => g.tags).sort(), [["Antiga", "Q1"], ["Q1"]]);
  assert.deepEqual(p.gravarTags.find((g) => g.tags.length === 2)?.ids, ["c1"]);
  assert.deepEqual(p.gravarTags.find((g) => g.tags.length === 1)?.ids, ["c2"]);
});

test("empresas que acabam com as mesmas tags vão numa gravação só", () => {
  const doCrm = [crm("c1", "Alfa", { empresa_pub_id: "a" }), crm("c2", "Beta", { empresa_pub_id: "b" }), crm("c3", "Gama", { empresa_pub_id: "g" })];
  const p = plano([base("a", "Alfa"), base("b", "Beta"), base("g", "Gama")], doCrm, { tipo: "tag", tags: ["Q1"] });
  assert.equal(p.gravarTags.length, 1);
  assert.deepEqual(p.gravarTags[0].ids, ["c1", "c2", "c3"]);
});

test("quem já tem a tag (mesmo escrita diferente) fica sem mudança", () => {
  const p = plano([base("a", "Alfa")], [crm("c1", "Alfa", { empresa_pub_id: "a", tags: ["Música"] })], { tipo: "tag", tags: ["musica"] });
  assert.deepEqual(p.resumo, { criadas: 0, atualizadas: 0, semMudanca: 1, deOutraPessoa: 0 });
  assert.deepEqual(p.gravarTags, []);
});

test("responsável: troca em quem já está no CRM e deixa quem já era dele", () => {
  const doCrm = [
    crm("c1", "Alfa", { empresa_pub_id: "a", responsavel_interno_id: null }),
    crm("c2", "Beta", { empresa_pub_id: "b", responsavel_interno_id: COLEGA }),
    crm("c3", "Gama", { empresa_pub_id: "g", responsavel_interno_id: "outro" }),
  ];
  const p = plano([base("a", "Alfa"), base("b", "Beta"), base("g", "Gama")], doCrm, { tipo: "responsavel", pessoaId: COLEGA, nome: "Ana" });
  assert.deepEqual(p.gravarResponsavel, ["c1", "c3"]);
  assert.deepEqual(p.resumo, { criadas: 0, atualizadas: 2, semMudanca: 1, deOutraPessoa: 0 });
});

test("empresa criada por outra pessoa da equipe é reconhecida, mas não é alterada (só quem criou edita)", () => {
  const doCrm = [crm("c1", "Alfa", { empresa_pub_id: "a", account_id: COLEGA })];
  const p = plano([base("a", "Alfa")], doCrm, { tipo: "tag", tags: ["Q1"] });
  assert.equal(p.criar.length, 0, "não cria uma segunda Alfa");
  assert.deepEqual(p.gravarTags, []);
  assert.deepEqual(p.resumo, { criadas: 0, atualizadas: 0, semMudanca: 0, deOutraPessoa: 1 });
});

test("havendo duas linhas da mesma empresa, vale a que a pessoa pode editar", () => {
  const doCrm = [crm("c1", "Alfa", { empresa_pub_id: "a", account_id: COLEGA }), crm("c2", "Alfa", { empresa_pub_id: "a", account_id: EU })];
  const p = plano([base("a", "Alfa")], doCrm, { tipo: "tag", tags: ["Q1"] });
  assert.deepEqual(p.gravarTags, [{ ids: ["c2"], tags: ["Q1"] }]);
});

test("empresas repetidas no lote entram uma vez só", () => {
  const p = plano([base("a", "Alfa"), base("a", "Alfa"), base("a2", "ALFA")], [], { tipo: "tag", tags: ["Q1"] });
  assert.equal(p.criar.length, 1);
  assert.deepEqual(p.resumo, { criadas: 1, atualizadas: 0, semMudanca: 1, deOutraPessoa: 0 });
});

test("repetir o mesmo pedido não muda nada: o lote é seguro de refazer", () => {
  const primeiro = plano([base("a", "Alfa"), base("b", "Beta")], [], { tipo: "tag", tags: ["Q1"] });
  const depois = primeiro.criar.map((nova, i) => crm(`n${i}`, nova.nome, { empresa_pub_id: nova.empresa_pub_id, tags: nova.tags }));
  const segundo = plano([base("a", "Alfa"), base("b", "Beta")], depois, { tipo: "tag", tags: ["Q1"] });
  assert.equal(segundo.criar.length, 0);
  assert.deepEqual(segundo.resumo, { criadas: 0, atualizadas: 0, semMudanca: 2, deOutraPessoa: 0 });
});

const resumo = (criadas: number, atualizadas: number, semMudanca: number, deOutraPessoa: number) => ({ criadas, atualizadas, semMudanca, deOutraPessoa });
const tag: PedidoDoLote = { tipo: "tag", tags: ["Q1"] };
const ana: PedidoDoLote = { tipo: "responsavel", pessoaId: COLEGA, nome: "Ana" };

test("aviso do lote de tag, no singular e no plural", () => {
  assert.equal(mensagemDoLote(resumo(1, 0, 0, 0), tag), "1 empresa entrou no CRM com a tag “Q1”.");
  assert.equal(mensagemDoLote(resumo(12, 0, 0, 0), tag), "12 empresas entraram no CRM com a tag “Q1”.");
  assert.equal(mensagemDoLote(resumo(9, 3, 0, 0), tag), "9 empresas entraram no CRM e 3 que já estavam ganharam a tag “Q1”.");
  assert.equal(mensagemDoLote(resumo(1, 1, 0, 0), tag), "1 empresa entrou no CRM e 1 que já estava ganhou a tag “Q1”.");
  assert.equal(mensagemDoLote(resumo(0, 3, 0, 0), tag), "3 empresas que já estavam no CRM ganharam a tag “Q1”.");
  assert.equal(mensagemDoLote(resumo(0, 1, 0, 0), tag), "1 empresa que já estava no CRM ganhou a tag “Q1”.");
});

test("aviso do lote de tag com várias tags", () => {
  assert.equal(mensagemDoLote(resumo(2, 0, 0, 0), { tipo: "tag", tags: ["Q1", "Bancos"] }), "2 empresas entraram no CRM com as tags “Q1” e “Bancos”.");
  assert.equal(mensagemDoLote(resumo(2, 0, 0, 0), { tipo: "tag", tags: ["A", "B", "C"] }), "2 empresas entraram no CRM com as tags “A”, “B” e “C”.");
});

test("aviso do lote de responsável", () => {
  assert.equal(mensagemDoLote(resumo(3, 0, 0, 0), ana), "3 empresas entraram no CRM com Ana como responsável.");
  assert.equal(mensagemDoLote(resumo(9, 3, 0, 0), ana), "9 empresas entraram no CRM e 3 que já estavam passaram para Ana.");
  assert.equal(mensagemDoLote(resumo(0, 1, 0, 0), ana), "1 empresa que já estava no CRM passou para Ana.");
});

test("aviso conta também quem já estava como pedido e quem ficou como estava", () => {
  assert.equal(mensagemDoLote(resumo(0, 0, 1, 0), tag), "A empresa já estava no CRM com a tag “Q1”.");
  assert.equal(mensagemDoLote(resumo(0, 0, 3, 0), tag), "As 3 empresas já estavam no CRM com a tag “Q1”.");
  assert.equal(mensagemDoLote(resumo(0, 0, 3, 0), ana), "As 3 empresas já estavam no CRM com Ana como responsável.");
  assert.equal(mensagemDoLote(resumo(4, 0, 2, 0), tag), "4 empresas entraram no CRM com a tag “Q1”. 2 já tinham a tag.");
  assert.equal(mensagemDoLote(resumo(4, 0, 1, 0), ana), "4 empresas entraram no CRM com Ana como responsável. 1 já era de Ana.");
  assert.equal(mensagemDoLote(resumo(4, 0, 0, 1), tag), "4 empresas entraram no CRM com a tag “Q1”. 1 empresa é de outra pessoa da equipe e ficou como estava.");
  assert.equal(mensagemDoLote(resumo(0, 0, 0, 2), tag), "2 empresas são de outra pessoa da equipe e ficaram como estavam.");
  assert.equal(mensagemDoLote(resumo(0, 0, 0, 0), tag), "Nenhuma empresa para adicionar.");
});

test("o aviso leva para as empresas do CRM já filtradas pela tag ou pelo responsável", () => {
  assert.equal(enderecoDoResultado({ tipo: "tag", tags: ["Música & Arte", "Outra"] }), "/empresas-crm?tag=M%C3%BAsica%20%26%20Arte");
  assert.equal(enderecoDoResultado(ana), `/empresas-crm?responsavel=${COLEGA}`);
});

test("o limite de criações por minuto vira um pedido para esperar; o resto leva a mensagem do banco", () => {
  assert.equal(traduzirErroDoLote("RATE_LIMIT: Limite de criação atingido. Aguarde 1 minuto."), "Muitas empresas criadas em pouco tempo. Espere 1 minuto e tente de novo.");
  assert.equal(traduzirErroDoLote("falha de rede"), "Não foi possível adicionar ao CRM. falha de rede");
});

test("só há lista para mostrar quando o lote deixou alguma empresa no CRM do jeito pedido", () => {
  assert.equal(aplicouAlgo(resumo(1, 0, 0, 0)), true, "entrou");
  assert.equal(aplicouAlgo(resumo(0, 2, 0, 0)), true, "mudou");
  assert.equal(aplicouAlgo(resumo(0, 0, 3, 0)), true, "já estava assim");
  assert.equal(aplicouAlgo(resumo(0, 0, 0, 2)), false, "tudo é de outra pessoa: nada mudou, a tela de sucesso mentiria");
  assert.equal(aplicouAlgo(resumo(0, 0, 0, 0)), false);
});

test("a tela de sucesso só escreve o que ficou de fora", () => {
  assert.equal(notaDoLote(resumo(5, 2, 1, 0)), null, "tudo aplicado: só o check");
  assert.equal(notaDoLote(resumo(5, 0, 0, 1)), "1 empresa é de outra pessoa da equipe e ficou como estava.");
  assert.equal(notaDoLote(resumo(0, 3, 0, 2)), "2 empresas são de outra pessoa da equipe e ficaram como estavam.");
  // é a mesma frase do aviso completo
  assert.ok(mensagemDoLote(resumo(4, 0, 0, 1), { tipo: "tag", tags: ["Q1"] }).endsWith(notaDoLote(resumo(4, 0, 0, 1)) as string));
});
