import assert from "node:assert/strict";
import test from "node:test";
import { avaliarProntidao, prazosDaPrestacao, proximoPrazo, quandoVence, type DadosProntidao } from "../lib/prestacao/prontidao";
import { regimePorCodigo } from "../lib/prestacao/regimes";

const ROUANET = regimePorCodigo("rouanet_in29_2026");
const GENERICO = regimePorCodigo("generico");

// Valor do projeto 70 mil (execução); administração 10 mil, dentro do teto de 10.500.
const PRONTA: DadosProntidao = {
  regime: ROUANET,
  identificadorOficial: "261234",
  prazo: "2026-11-30",
  itens: [
    { id: "a", grupo: "execucao", vigente: 70000 },
    { id: "b", grupo: "administracao", vigente: 10000 },
  ],
  comprovantes: [
    { no_id: "a", status: "aceito", valor_extraido: 70000 },
    { no_id: "b", status: "aceito", valor_extraido: 10000 },
  ],
  atividades: 3,
  alteracoesAguardando: 0,
};

const codigos = (dados: DadosProntidao) => avaliarProntidao(dados).pendencias.map(p => p.codigo);

test("tudo em ordem: 100% e nenhuma pendência", () => {
  const prontidao = avaliarProntidao(PRONTA);
  assert.equal(prontidao.percentual, 100);
  assert.deepEqual(prontidao.pendencias, []);
  assert.deepEqual(prontidao.checagens.map(c => c.codigo), ["regime", "prazo", "orcamento", "grupos", "tetos", "comprovacao", "avaliacao", "vinculo", "objeto", "alteracoes"]);
});

test("comprovação pesa mais e as pendências vêm da que mais falta", () => {
  const meio = avaliarProntidao({ ...PRONTA, comprovantes: [{ no_id: "a", status: "aceito", valor_extraido: 40000 }], atividades: 0 });
  assert.deepEqual(meio.pendencias.map(p => p.codigo), ["comprovacao", "objeto"], "falta 50% de peso 4 antes de 100% de peso 1");
  assert.equal(meio.percentual, 76, "peso total 13; faltam 4 × 0,5 + 1 = 3; 10 de 13 = 76,9%, arredondado para baixo");
  assert.match(meio.pendencias[0].detalhe, /R\$\s40\.000,00 de R\$\s80\.000,00 comprovados \(50%\)\. Faltam R\$\s40\.000,00\./);
  assert.equal(meio.pendencias[0].destino, "comprovantes");
});

test("nunca mostra 100% com pendência", () => {
  const quase = avaliarProntidao({ ...PRONTA, comprovantes: [...PRONTA.comprovantes, { no_id: "a", status: "pendente", valor_extraido: 1 }, ...Array.from({ length: 300 }, () => ({ no_id: "a", status: "aceito", valor_extraido: 0 }))] });
  assert.ok(quase.pendencias.length > 0);
  assert.equal(quase.percentual, 99);
});

test("cada lacuna vira pendência com o que fazer e onde", () => {
  assert.deepEqual(codigos({ ...PRONTA, regime: null }), ["regime"]);
  const semPronac = avaliarProntidao({ ...PRONTA, identificadorOficial: " " }).pendencias[0];
  assert.equal(semPronac.detalhe, "Informe o Pronac.");
  assert.equal(semPronac.progresso, 0.5);
  assert.deepEqual(codigos({ ...PRONTA, prazo: null }), ["prazo"]);
  assert.deepEqual(codigos({ ...PRONTA, itens: [{ id: "a", grupo: null, vigente: 70000 }, PRONTA.itens[1]] }), ["grupos"]);
  const acimaDoTeto = avaliarProntidao({ ...PRONTA, itens: [PRONTA.itens[0], { id: "b", grupo: "administracao", vigente: 12000 }], comprovantes: [{ no_id: "a", status: "aceito", valor_extraido: 70000 }, { no_id: "b", status: "aceito", valor_extraido: 12000 }] });
  assert.deepEqual(acimaDoTeto.pendencias.map(p => p.codigo), ["tetos"]);
  assert.match(acimaDoTeto.pendencias[0].detalhe, /Custos administrativos acima do teto em R\$\s1\.500,00/);
  assert.deepEqual(codigos({ ...PRONTA, comprovantes: [...PRONTA.comprovantes, { no_id: "a", status: "pendente", valor_extraido: 10 }] }), ["avaliacao"]);
  assert.deepEqual(codigos({ ...PRONTA, comprovantes: [...PRONTA.comprovantes, { no_id: null, status: "aceito", valor_extraido: 10 }] }), ["vinculo"]);
  assert.deepEqual(codigos({ ...PRONTA, atividades: 0 }), ["objeto"]);
  assert.deepEqual(codigos({ ...PRONTA, alteracoesAguardando: 2 }), ["alteracoes"]);
});

test("sem orçamento, a comprovação não tem base e manda para o orçamento", () => {
  const vazia = avaliarProntidao({ ...PRONTA, itens: [], comprovantes: [] });
  assert.deepEqual(vazia.pendencias.map(p => p.codigo), ["comprovacao", "orcamento"]);
  assert.equal(vazia.pendencias[0].destino, "orcamento");
  assert.ok(!vazia.checagens.some(c => c.codigo === "grupos"), "grupos só com itens");
});

test("regime sem tetos por grupo não cobra grupo de custo", () => {
  const generica = avaliarProntidao({ ...PRONTA, regime: GENERICO, itens: [{ id: "a", grupo: null, vigente: 80000 }], comprovantes: [{ no_id: "a", status: "aceito", valor_extraido: 80000 }] });
  assert.equal(generica.percentual, 100);
  assert.ok(!generica.checagens.some(c => c.codigo === "grupos" || c.codigo === "tetos"));
});

test("prazos: envio em preparo, análise do órgão depois do envio, resposta às alterações", () => {
  const hoje = "2026-10-05";
  assert.deepEqual(prazosDaPrestacao({ status: "revisao_interna", prazo: "2026-10-20" }, ROUANET, [], hoje),
    [{ data: "2026-10-20", rotulo: "Envio da prestação", quem: "proponente", dias: 15 }]);
  const enviada = prazosDaPrestacao({ status: "enviado", prazo: "2026-08-21", data_envio: "2026-08-20" }, ROUANET, [{ numero: 2, solicitada_em: "2026-09-02" }], hoje);
  assert.deepEqual(enviada.map(p => [p.rotulo, p.data, p.quem]), [
    ["Resposta à alteração nº 2", "2026-10-02", "orgao"],
    ["Análise do órgão", "2027-02-22", "orgao"],
  ], "6 meses do envio caem em 20/02/2027, um sábado, e vão para o dia útil seguinte");
  assert.equal(proximoPrazo(enviada)?.rotulo, "Análise do órgão", "o do órgão que venceu não passa na frente do próximo");
  assert.deepEqual(prazosDaPrestacao({ status: "aprovado", prazo: "2026-08-21" }, ROUANET, [], hoje), []);
});

test("prazo vencido do proponente vem antes de qualquer outro", () => {
  const prazos = prazosDaPrestacao({ status: "rascunho", prazo: "2026-08-21" }, ROUANET, [{ numero: 1, solicitada_em: "2026-10-01" }], "2026-10-05");
  assert.equal(proximoPrazo(prazos)?.rotulo, "Envio da prestação");
  assert.equal(proximoPrazo(prazos)?.dias, -45);
  assert.equal(proximoPrazo([]), null);
  assert.deepEqual([0, 1, 12, -1, -45].map(quandoVence), ["hoje", "amanhã", "em 12 dias", "venceu ontem", "venceu há 45 dias"]);
});
