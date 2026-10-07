import assert from "node:assert/strict";
import test from "node:test";
import { executarChecagens, type EstadoDaPrestacao, type MetaDoEstado } from "../lib/prestacao/checagens";
import { checarObjeto } from "../lib/prestacao/checagens/checar-objeto";
import {
  erroDaMeta,
  erroDoLocal,
  execucaoTerminou,
  numeroDigitado,
  periodoDoLocal,
  quantidade,
  resumoDaMeta,
  rotuloDoLocal,
  type CamposDoLocal,
} from "../lib/prestacao/objeto";
import { regimePorCodigo } from "../lib/prestacao/regimes";

const ROUANET = regimePorCodigo("rouanet_in29_2026")!;
const HOJE = new Date(2026, 9, 7);

const base = (campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao => ({
  regime: ROUANET, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
  prestacao: { data_fim_execucao: "2026-09-30" }, hoje: HOJE, ...campos,
});
const meta = (campos: Partial<MetaDoEstado>): MetaDoEstado => ({
  id: "m1", descricao: "Oficinas de música", unidade: "oficinas", previsto: 6, realizado: null, justificativa: null, ...campos,
});
const local = (campos: Partial<CamposDoLocal> = {}): CamposDoLocal => ({
  pais: "Brasil", uf: "SP", municipio: "São Paulo", espaco: null, inicio: null, fim: null, status: "previsto", justificativa: null, ...campos,
});

test("local: rótulo, período e as mesmas regras do banco", () => {
  assert.equal(rotuloDoLocal(local()), "São Paulo/SP");
  assert.equal(rotuloDoLocal(local({ pais: "Argentina", uf: null, municipio: "Buenos Aires" })), "Buenos Aires, Argentina");
  assert.equal(periodoDoLocal({ inicio: "2026-03-10", fim: "2026-03-12" }), "10/03/2026 a 12/03/2026");
  assert.equal(periodoDoLocal({ inicio: "2026-03-10", fim: "2026-03-10" }), "10/03/2026");
  assert.equal(periodoDoLocal({ inicio: null, fim: null }), null);

  assert.equal(erroDoLocal(local()), null);
  assert.match(erroDoLocal(local({ uf: null }))!, /UF e o município/);
  assert.equal(erroDoLocal(local({ pais: "Argentina", uf: null, municipio: null })), null, "fora do Brasil, UF não se aplica");
  assert.match(erroDoLocal(local({ inicio: "2026-03-12", fim: "2026-03-10" }))!, /fim vem antes/);
  assert.match(erroDoLocal(local({ status: "nao_realizado" }))!, /pede justificativa/);
  assert.match(erroDoLocal(local({ status: "outras_fontes", justificativa: "x".repeat(501) }))!, /500 caracteres/);
  assert.equal(erroDoLocal(local({ status: "outras_fontes", justificativa: "Pago pela prefeitura." })), null);
});

test("meta: situação, percentual e o que as atividades ligadas mostram", () => {
  const atividades = [
    { meta_id: "m1", status_realizacao: "realizado" as const, publico_atingido: 30 },
    { meta_id: "m1", status_realizacao: "realizado" as const, publico_atingido: 20 },
    { meta_id: "m1", status_realizacao: "nao_realizado" as const, publico_atingido: null },
    { meta_id: "outra", status_realizacao: "realizado" as const, publico_atingido: 99 },
  ];
  assert.deepEqual(resumoDaMeta(meta({}), atividades),
    { atividades: 3, realizadas: 2, publico: 50, situacao: "sem_resultado", percentual: null, faltaJustificativa: false });
  assert.deepEqual([resumoDaMeta(meta({ realizado: 4 }), []).situacao, resumoDaMeta(meta({ realizado: 4 }), []).percentual], ["abaixo", 67]);
  assert.equal(resumoDaMeta(meta({ realizado: 4 }), []).faltaJustificativa, true);
  assert.equal(resumoDaMeta(meta({ realizado: 4, justificativa: "Chuva." }), []).faltaJustificativa, false);
  assert.equal(resumoDaMeta(meta({ realizado: 6 }), []).situacao, "atingida");
  assert.equal(resumoDaMeta(meta({ realizado: 8 }), []).situacao, "acima");
  assert.equal(resumoDaMeta(meta({ previsto: 0, realizado: 2 }), []).percentual, null, "previsto zero não tem percentual");

  assert.equal(quantidade(1500, "pessoas"), "1.500 pessoas");
  assert.equal(quantidade(null, "pessoas"), "—");
  assert.equal(erroDaMeta({ descricao: " ", unidade: null, previsto: 1, realizado: null, justificativa: null }), "Descreva a meta.");
  assert.match(erroDaMeta({ descricao: "x", unidade: null, previsto: -1, realizado: null, justificativa: null })!, /previsto/);
  assert.equal(erroDaMeta({ descricao: "x", unidade: null, previsto: 1, realizado: 0, justificativa: null }), null);
});

test("número digitado: milhar com ponto, decimal com vírgula", () => {
  assert.deepEqual(["1.500", "1500", "2,5", "2.5", "1.234,5", "", "abc"].map(numeroDigitado), [1500, 1500, 2.5, 2.5, 1234.5, null, NaN]);
});

test("execução termina no dia seguinte ao fim", () => {
  assert.equal(execucaoTerminou("2026-10-07", HOJE), false);
  assert.equal(execucaoTerminou("2026-10-06", HOJE), true);
  assert.equal(execucaoTerminou(null, HOJE), false);
});

test("checagens do objeto: sem metas, sem resultado, abaixo do previsto e local sem situação", () => {
  const vazio = checarObjeto(base());
  assert.deepEqual(vazio.map(a => [a.chave, a.severidade]), [["OBJETO_SEM_METAS:prestacao:-", "bloqueio"]], "na Rouanet, metas × resultados é bloqueio");
  assert.equal(vazio[0].fonte?.regra?.codigo, "metas_resultados");
  assert.equal(checarObjeto(base({ regime: null }))[0].severidade, "alerta", "sem regime, alerta");

  const achados = checarObjeto(base({
    metas: [meta({ id: "m1" }), meta({ id: "m2", realizado: 4 }), meta({ id: "m3", realizado: 5, justificativa: "Uma oficina caiu na chuva." }), meta({ id: "m4", realizado: 7 })],
    locais: [
      { id: "l1", pais: "Brasil", uf: "SP", municipio: "São Paulo", status: "previsto" },
      { id: "l2", pais: "Brasil", uf: "RJ", municipio: "Niterói", status: "realizado" },
    ],
  }));
  assert.deepEqual(achados.map(a => [a.chave, a.severidade, a.justificativa]), [
    ["META_SEM_RESULTADO:meta:m1", "bloqueio", null],
    ["META_ABAIXO_DO_PREVISTO:meta:m2", "justificativa", null],
    ["META_ABAIXO_DO_PREVISTO:meta:m3", "justificativa", "Uma oficina caiu na chuva."],
    ["LOCAL_SEM_SITUACAO:local:l1", "alerta", null],
  ]);
  assert.match(achados[0].mensagem, /terminou em 30\/09\/2026/);
  assert.match(achados[1].mensagem, /4 oficinas de 6 oficinas previstos/);
  assert.match(achados[3].mensagem, /São Paulo\/SP/);

  // Antes do fim da execução, meta sem realizado e local previsto ainda não são pendência.
  const emExecucao = checarObjeto(base({ prestacao: { data_fim_execucao: "2026-12-31" }, metas: [meta({})], locais: [{ id: "l1", pais: "Brasil", uf: "SP", municipio: "São Paulo", status: "previsto" }] }));
  assert.deepEqual(emExecucao, []);
});

test("o motor roda a checagem do objeto junto com as outras", () => {
  assert.ok(executarChecagens(base()).some(a => a.codigo === "OBJETO_SEM_METAS"));
  assert.ok(!executarChecagens(base({ metas: [meta({ realizado: 6 })] })).some(a => a.codigo.startsWith("OBJETO_") || a.codigo.startsWith("META_")));
});
