import assert from "node:assert/strict";
import test from "node:test";
import { chaveDoNome, mesmoNome, resolverDominio } from "../lib/dominio";
import { organizacoesComAcessoAoCrm } from "../lib/mcp/auth";
import { combinarEtapas, combinarOpcoes, escolherEtapaInicial } from "../lib/mcp/funil";
import { tipoDaInteracao, tipoDetalhadoDaInteracao } from "../lib/mcp/relacionamento";
import { comDiasPuros } from "../lib/mcp/consultas";
import {
  ErroMcp,
  booleano,
  dataDe,
  diaEHoraEmBrasilia,
  diaSeguinte,
  erroDoBanco,
  horaDe,
  igualSemCaixa,
  inteiro,
  listaDeTextos,
  numero,
  opcao,
  paginacao,
  paraInstante,
  termoDeBusca,
  texto,
  trechoParaBusca,
  uuidDe,
} from "../lib/mcp/validacao";
import { DEFAULT_ETIQUETAS_CAPTACAO, DEFAULT_ETIQUETAS_INSCRICAO } from "../lib/etiquetas-padrao";
import { DESFECHOS_INSCRICAO, DESFECHOS_NEGOCIACAO } from "../lib/etapas";

const erro400 = (fn: () => unknown, trecho: RegExp) =>
  assert.throws(fn, (e: unknown) => e instanceof ErroMcp && e.status === 400 && trecho.test(e.message));

test("texto corta espaços, recusa o que não é texto e respeita o tamanho", () => {
  assert.equal(texto({ nome: "  Vale  " }, "nome"), "Vale");
  assert.equal(texto({}, "nome"), null);
  assert.equal(texto({ nome: "   " }, "nome"), null);
  erro400(() => texto({}, "nome", { obrigatorio: true }), /Informe nome/);
  erro400(() => texto({ nome: 12 }, "nome"), /deve ser texto/);
  erro400(() => texto({ nome: "abcdef" }, "nome", { max: 3 }), /passa de 3 caracteres/);
});

test("opcao só aceita valores da lista e diz quais são", () => {
  assert.equal(opcao({ tipo: "prospect" }, "tipo", ["prospect", "ex_cliente"] as const), "prospect");
  assert.equal(opcao({}, "tipo", ["prospect"] as const), null);
  erro400(() => opcao({ tipo: "x" }, "tipo", ["prospect", "ex_cliente"] as const), /prospect, ex_cliente/);
});

test("numero aceita número e valor escrito à brasileira, e confere os limites", () => {
  assert.equal(numero({ valor: 150000 }, "valor"), 150000);
  assert.equal(numero({ valor: "150.000,00" }, "valor"), 150000);
  assert.equal(numero({ valor: "50000" }, "valor"), 50000);
  assert.equal(numero({}, "valor"), null);
  erro400(() => numero({ valor: "muito" }, "valor"), /deve ser um número/);
  erro400(() => numero({ valor: -5 }, "valor", { min: 0 }), /no mínimo 0/);
  erro400(() => numero({ nota: 101 }, "nota", { max: 100 }), /no máximo 100/);
  erro400(() => inteiro({ n: 1.5 }, "n"), /inteiro/);
});

test("booleano e uuid entendem o que o assistente costuma mandar", () => {
  assert.equal(booleano({ a: true }, "a"), true);
  assert.equal(booleano({ a: "false" }, "a"), false);
  assert.equal(booleano({}, "a"), null);
  erro400(() => booleano({ a: "talvez" }, "a"), /verdadeiro ou falso/);
  assert.equal(uuidDe({ id: "0A3599FB-29A4-46D7-9AC7-5983FD4F77C8" }, "id"), "0a3599fb-29a4-46d7-9ac7-5983fd4f77c8");
  erro400(() => uuidDe({ id: "123" }, "id"), /UUID válido/);
  erro400(() => uuidDe({}, "id", true), /Informe id/);
});

test("datas: dia e dia com hora, nunca uma data que não existe", () => {
  assert.equal(dataDe({ d: "2026-10-15" }, "d"), "2026-10-15");
  assert.equal(dataDe({ d: "2026-10-15T09:30" }, "d"), "2026-10-15T09:30");
  assert.equal(dataDe({}, "d"), null);
  erro400(() => dataDe({ d: "15/10/2026" }, "d"), /AAAA-MM-DD/);
  erro400(() => dataDe({ d: "2026-02-30" }, "d"), /não existe/);
  assert.equal(horaDe({ h: "09:30" }, "h"), "09:30");
  erro400(() => horaDe({ h: "25:00" }, "h"), /HH:MM/);
});

test("dia sem hora vira meio-dia de Brasília; hora sem fuso vale Brasília", () => {
  assert.equal(paraInstante("2026-10-15"), "2026-10-15T15:00:00.000Z");
  assert.equal(paraInstante("2026-10-15T09:30"), "2026-10-15T12:30:00.000Z");
  assert.equal(paraInstante("2026-10-15T09:30:00Z"), "2026-10-15T09:30:00.000Z");
  assert.equal(diaSeguinte("2026-10-31"), "2026-11-01");
  assert.equal(diaSeguinte("2026-12-31"), "2027-01-01");
});

test("dia e hora das atividades ficam separados, no horário de Brasília, sem o dia andar", () => {
  assert.equal(diaEHoraEmBrasilia(null), null);
  assert.deepEqual(diaEHoraEmBrasilia("2026-10-15"), { dia: "2026-10-15", hora: null });
  assert.deepEqual(diaEHoraEmBrasilia("2026-10-15T09:30"), { dia: "2026-10-15", hora: "09:30" });
  assert.deepEqual(diaEHoraEmBrasilia("2026-10-15T22:30:00"), { dia: "2026-10-15", hora: "22:30" });
  assert.deepEqual(diaEHoraEmBrasilia("2026-10-16T01:30:00Z"), { dia: "2026-10-15", hora: "22:30" });
  assert.deepEqual(diaEHoraEmBrasilia("2026-10-15T09:30:00-03:00"), { dia: "2026-10-15", hora: "09:30" });
  assert.deepEqual(diaEHoraEmBrasilia("2026-10-15T00:00:00+00:00"), { dia: "2026-10-14", hora: "21:00" });
});

test("a atividade volta com o dia puro, como o app lê", () => {
  const linha = { id: "x", data_inicio: "2026-10-15T00:00:00+00:00", data_prevista: "2026-10-16T00:00:00+00:00", data_realizada: "2026-10-16T14:05:00+00:00", nome: "Ligar" };
  assert.deepEqual(comDiasPuros(linha), { id: "x", data_inicio: "2026-10-15", data_prevista: "2026-10-16", data_realizada: "2026-10-16T14:05:00+00:00", nome: "Ligar" });
  assert.deepEqual(comDiasPuros({ nome: "Sem data", data_prevista: null }), { nome: "Sem data", data_prevista: null });
});

test("listaDeTextos aceita lista ou texto com vírgulas e tira repetidos", () => {
  assert.deepEqual(listaDeTextos({ t: ["a", " b ", "a"] }, "t"), ["a", "b"]);
  assert.deepEqual(listaDeTextos({ t: "rio, são paulo" }, "t"), ["rio", "são paulo"]);
  assert.equal(listaDeTextos({}, "t"), null);
  erro400(() => listaDeTextos({ t: [1] }, "t"), /só textos/);
  erro400(() => listaDeTextos({ t: ["a", "b", "c"] }, "t", { maxItens: 2 }), /até 2 itens/);
});

test("a busca nunca deixa o texto da pessoa mexer no filtro do banco", () => {
  assert.equal(termoDeBusca("Vale, S.A.)"), "Vale S.A.");
  assert.equal(termoDeBusca("a%b_c\"d'e*f"), "a b c d e f");
  assert.equal(termoDeBusca("   "), null);
  assert.equal(termoDeBusca(null), null);
  assert.equal(trechoParaBusca("Banco do Brasil (BB)"), "Banco do Brasil");
  assert.equal(trechoParaBusca("Itaú Unibanco"), "Itaú Unibanco");
  assert.equal(igualSemCaixa("a_b%c\\d"), "a\\_b\\%c\\\\d");
});

test("paginacao limita a 100 e nunca anda para trás", () => {
  assert.deepEqual(paginacao(new URLSearchParams()), { limite: 20, deslocamento: 0 });
  assert.deepEqual(paginacao(new URLSearchParams("limite=500&deslocamento=40")), { limite: 100, deslocamento: 40 });
  assert.deepEqual(paginacao(new URLSearchParams("limite=-3&deslocamento=-9")), { limite: 1, deslocamento: 0 });
  assert.deepEqual(paginacao(new URLSearchParams("limite=abc&deslocamento=xyz")), { limite: 20, deslocamento: 0 });
});

test("erros do banco viram resposta que o assistente entende, sem texto interno", () => {
  assert.equal(erroDoBanco({ code: "23503", message: "violates foreign key" }).status, 400);
  assert.equal(erroDoBanco({ code: "23505", message: "duplicate key" }).status, 409);
  assert.equal(erroDoBanco({ code: "42501", message: "Sem permissão" }).status, 403);
  const plano = erroDoBanco({ code: "P0001", message: "Limite do plano gratuito atingido: 1 proponente." });
  assert.equal(plano.status, 402);
  assert.match(plano.message, /1 proponente.*meu-plano/);
  assert.equal(erroDoBanco({ code: "P0001", message: "RATE_LIMIT: Limite de criação atingido." }).status, 429);
  const interno = erroDoBanco({ code: "XX000", message: "relation \"segredo\" does not exist" });
  assert.equal(interno.status, 500);
  assert.ok(!/segredo/.test(interno.message));
});

test("domínio do site e comparação de nomes seguem a regra do app", () => {
  assert.equal(resolverDominio("https://www.vale.com/pt/sustentabilidade"), "vale.com");
  assert.equal(resolverDominio("vale.com"), "vale.com");
  assert.equal(resolverDominio("  "), null);
  assert.equal(resolverDominio(null), null);
  assert.equal(chaveDoNome("  Itaú Cultural "), "itau cultural");
  assert.ok(mesmoNome("ITAÚ  Cultural", "itau cultural"));
  assert.ok(!mesmoNome("Itaú", "Itaú Cultural"));
});

test("só a equipe com o módulo de captação usa o conector; captador e proponente externos ficam de fora", () => {
  const membros = [
    { organization_id: "a", papel: "admin", modulos_acesso: ["captacao", "prestacao"] },
    { organization_id: "b", papel: "admin", modulos_acesso: ["prestacao"] },
    { organization_id: "c", papel: "captador", modulos_acesso: ["captacao"] },
    { organization_id: "d", papel: "proponente", modulos_acesso: ["captacao"] },
    { organization_id: "e", papel: "admin", modulos_acesso: null },
  ];
  assert.deepEqual(organizacoesComAcessoAoCrm(membros), ["a", "e"]);
  assert.deepEqual(organizacoesComAcessoAoCrm([]), []);
});

test("o funil da organização segue a regra da tela: padrões, ajustes, removidas e etapas próprias", () => {
  const padrao = combinarEtapas(DEFAULT_ETIQUETAS_CAPTACAO, "captacao", [], new Set(), DESFECHOS_NEGOCIACAO);
  assert.deepEqual(padrao.map((e) => e.chave), ["prospeccao", "primeiro_contato", "proposta_enviada", "em_negociacao", "aprovado", "recusado", "renovacao"]);
  assert.deepEqual(padrao.filter((e) => e.desfecho).map((e) => e.chave), ["aprovado", "recusado"]);

  const personalizado = combinarEtapas(
    DEFAULT_ETIQUETAS_CAPTACAO,
    "captacao",
    [
      { entidade: "captacao", key: "prospeccao", label: "Mapeamento", ordem: 1 },
      { entidade: "captacao", key: "diligencia", label: "Diligência", ordem: 9 },
      { entidade: "captacao", key: "antes", label: "Antes", ordem: 2 },
      { entidade: "inscricao", key: "outra", label: "De outro funil", ordem: 1 },
    ],
    new Set(["captacao:renovacao", "captacao:antes"]),
    DESFECHOS_NEGOCIACAO
  );
  assert.equal(personalizado[0].nome, "Mapeamento");
  assert.ok(!personalizado.some((e) => e.chave === "renovacao" || e.chave === "antes" || e.chave === "outra"));
  assert.equal(personalizado.at(-1)?.chave, "diligencia");

  const inscricao = combinarEtapas(DEFAULT_ETIQUETAS_INSCRICAO, "inscricao", [], new Set(), DESFECHOS_INSCRICAO);
  assert.deepEqual(inscricao.filter((e) => e.desfecho).map((e) => e.chave), ["aprovado", "reprovado", "cancelado"]);
});

test("negociação nova nasce na primeira etapa em aberto e nunca em aprovado ou recusado", () => {
  const etapas = combinarEtapas(DEFAULT_ETIQUETAS_CAPTACAO, "captacao", [], new Set(), DESFECHOS_NEGOCIACAO);
  assert.equal(escolherEtapaInicial(etapas, null), "prospeccao");
  assert.equal(escolherEtapaInicial(etapas, "em_negociacao"), "em_negociacao");
  assert.throws(() => escolherEtapaInicial(etapas, "aprovado"), (e: unknown) => e instanceof ErroMcp && /Fechar negócio/.test(e.message));
  assert.throws(() => escolherEtapaInicial(etapas, "inventada"), (e: unknown) => e instanceof ErroMcp && /prospeccao/.test(e.message));
  const soDesfechos = etapas.filter((e) => e.desfecho);
  assert.throws(() => escolherEtapaInicial(soDesfechos, null), (e: unknown) => e instanceof ErroMcp);
});

test("origens, canais e resultados: o que a organização cadastrou vem antes dos padrões", () => {
  const padroes = combinarOpcoes("canal", []);
  assert.ok(padroes.some((o) => o.chave === "whatsapp") && padroes.some((o) => o.chave === "email"));
  const proprias = combinarOpcoes("canal", [
    { categoria: "canal", chave: "evento", label: "Evento", ordem: 5, ativo: true },
    { categoria: "canal", chave: "inativo", label: "Inativo", ordem: 6, ativo: false },
    { categoria: "origem", chave: "outra", label: "De outra lista", ordem: 1, ativo: true },
  ]);
  assert.equal(proprias[0].chave, "evento");
  assert.ok(!proprias.some((o) => o.chave === "inativo" || o.chave === "outra"));
  assert.ok(proprias.some((o) => o.chave === "email"));
});

test("o canal vira o mesmo tipo de interação que a tela grava", () => {
  assert.equal(tipoDaInteracao("whatsapp"), "mensagem");
  assert.equal(tipoDaInteracao("videoconferencia"), "reuniao");
  assert.equal(tipoDaInteracao("presencial"), "reuniao");
  assert.equal(tipoDaInteracao("email"), "email");
  assert.equal(tipoDetalhadoDaInteracao("telefone"), "ligacao");
  assert.equal(tipoDetalhadoDaInteracao("presencial"), "reuniao");
  assert.equal(tipoDetalhadoDaInteracao("linkedin"), "mensagem");
});
