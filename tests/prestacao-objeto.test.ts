import assert from "node:assert/strict";
import test from "node:test";
import { executarChecagens, type EstadoDaPrestacao, type MetaDoEstado } from "../lib/prestacao/checagens";
import { checarCobertura, checarObjeto } from "../lib/prestacao/checagens/checar-objeto";
import { ancestraisDoNo } from "../lib/prestacao/orcamento";
import { avaliarProntidao } from "../lib/prestacao/prontidao";
import {
  coberturaDaMeta,
  erroDaMeta,
  metaDoItem,
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
  assert.equal(numeroDigitado("1.234,"), 1234, "vírgula da máscara ainda sem os centavos");
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
  const comEvidencia = base({ metas: [meta({ realizado: 6 })], evidencias: [{ id: "e1", tipo: "foto", nome_arquivo: "a.jpg", url: null, atividade_id: null, meta_id: "m1", local_id: null, capturada_em: null, latitude: null, longitude: null, justificativa: null }] });
  assert.ok(!executarChecagens(comEvidencia).some(a => a.codigo.startsWith("OBJETO_") || a.codigo.startsWith("META_")));
});

// ─── P3.3: cobertura por meta e rastreabilidade ─────────────────────────────

const atividade = (id: string, metaId: string | null, status: "realizado" | "nao_realizado" = "realizado") => ({ id, meta_id: metaId, status_realizacao: status });
const ev = (atividadeId: string | null, metaId: string | null = null) => ({ atividade_id: atividadeId, meta_id: metaId });

test("cobertura da meta: atividades realizadas com evidência e evidências diretas", () => {
  const atividades = [atividade("a1", "m1"), atividade("a2", "m1"), atividade("a3", "m1", "nao_realizado"), atividade("a4", "outra")];
  const parcial = coberturaDaMeta({ id: "m1" }, atividades, [ev("a1"), ev("a1"), ev("a4")]);
  assert.deepEqual(parcial, { evidencias: 2, atividadesRealizadas: 2, atividadesComEvidencia: 1, comprovada: false, texto: "1 de 2 atividades realizadas com evidência" });
  assert.equal(coberturaDaMeta({ id: "m1" }, atividades, [ev("a1"), ev("a2")]).comprovada, true);
  assert.deepEqual(coberturaDaMeta({ id: "m2" }, [], [ev(null, "m2"), ev(null, "m2")]), { evidencias: 2, atividadesRealizadas: 0, atividadesComEvidencia: 0, comprovada: true, texto: "2 evidências" });
  assert.equal(coberturaDaMeta({ id: "m3" }, [], []).texto, "Sem evidência");
  assert.equal(coberturaDaMeta({ id: "m1" }, atividades, [ev("a1", "m1")]).evidencias, 1, "a evidência da atividade e da meta conta uma vez");
});

test("a que meta serve a despesa: o agrupador mais próximo acima do item", () => {
  const nos = [
    { id: "produto", parent_id: null }, { id: "meta-oficinas", parent_id: "produto" }, { id: "item-1", parent_id: "meta-oficinas" },
    { id: "item-2", parent_id: "produto" }, { id: "solto", parent_id: null },
  ];
  assert.deepEqual(ancestraisDoNo("item-1", nos), ["produto", "meta-oficinas"]);
  assert.deepEqual(ancestraisDoNo("solto", nos), []);
  const metas = [{ id: "m-produto", no_id: "produto" }, { id: "m-oficinas", no_id: "meta-oficinas" }];
  assert.equal(metaDoItem(ancestraisDoNo("item-1", nos), metas)?.id, "m-oficinas", "a mais próxima vence");
  assert.equal(metaDoItem(ancestraisDoNo("item-2", nos), metas)?.id, "m-produto");
  assert.equal(metaDoItem(ancestraisDoNo("solto", nos), metas), null);
  assert.deepEqual(ancestraisDoNo("a", [{ id: "a", parent_id: "b" }, { id: "b", parent_id: "a" }]), ["b"], "ciclo não trava");
});

test("checagem da cobertura: meta com resultado sem evidência e atividade realizada sem evidência", () => {
  const estado = base({
    metas: [meta({ id: "m1", realizado: 4 }), meta({ id: "m2", realizado: null }), meta({ id: "m3", realizado: 2 })],
    atividades: [
      { id: "a1", titulo: "Oficina 1", data_realizacao: "2026-09-10", data_inicio: null, data_fim: null, local_id: null, meta_id: "m1", status_realizacao: "realizado" },
      { id: "a2", titulo: "Oficina 2", data_realizacao: "2026-12-01", data_inicio: null, data_fim: null, local_id: null, meta_id: "m2", status_realizacao: "realizado" },
      { id: "a3", titulo: "Oficina 3", data_realizacao: "2026-09-12", data_inicio: null, data_fim: null, local_id: null, meta_id: "m3", status_realizacao: "realizado" },
    ],
    evidencias: [{ id: "e1", tipo: "foto", nome_arquivo: "a.jpg", url: null, atividade_id: "a3", meta_id: null, local_id: null, capturada_em: null, latitude: null, longitude: null, justificativa: null }],
  });
  assert.deepEqual(checarCobertura(estado).map(a => [a.chave, a.severidade]), [
    ["META_SEM_EVIDENCIA:meta:m1", "bloqueio"],
    ["META_SEM_EVIDENCIA:meta:m2", "bloqueio"],
    ["ATIVIDADE_SEM_EVIDENCIA:atividade:a1", "alerta"],
  ], "m2 tem atividade realizada; a2 ainda não aconteceu (01/12); m3 e a3 têm evidência");
  assert.equal(checarCobertura({ ...estado, regime: null })[0].severidade, "alerta");
});

test("prontidão: metas comprovadas pesam no lugar das atividades", () => {
  const dados = { regime: null, identificadorOficial: null, prazo: "2026-12-31", itens: [], comprovantes: [], atividades: 3, alteracoesAguardando: 0 };
  const sem = avaliarProntidao(dados).checagens.find(c => c.codigo === "objeto")!;
  assert.equal(sem.titulo, "Atividades do objeto");
  const parcial = avaliarProntidao({ ...dados, objeto: { metas: 4, comprovadas: 1 } }).checagens.find(c => c.codigo === "objeto")!;
  assert.deepEqual([parcial.titulo, parcial.progresso, parcial.destino, parcial.peso], ["Metas comprovadas", 0.25, "objeto", 2]);
  assert.match(parcial.detalhe, /1 de 4 metas comprovadas/);
  assert.equal(avaliarProntidao({ ...dados, objeto: { metas: 0, comprovadas: 0 } }).checagens.find(c => c.codigo === "objeto")!.progresso, 0);
});
