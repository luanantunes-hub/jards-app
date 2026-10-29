import assert from "node:assert/strict";
import test from "node:test";
import { POST as atividadesPOST } from "../app/api/mcp/prestacoes/[id]/atividades/route";
import { POST as atualizarAtividadePOST } from "../app/api/mcp/prestacoes/[id]/atividades/atualizar/route";
import { POST as atualizarMetaPOST } from "../app/api/mcp/prestacoes/[id]/metas/atualizar/route";
import { GET as objetoGET } from "../app/api/mcp/prestacoes/[id]/objeto/route";
import { GET as relatorioGET, POST as relatorioPOST } from "../app/api/mcp/prestacoes/[id]/relatorio/route";
import { memoriaFalsa } from "./_helpers/memoria-falsa";
import { DE_OUTRA_ORG, ORG, PRESTACAO, USUARIO, comId, daTabela, ler, pedido, prepararComStorage, type Cenario } from "./_helpers/prestacao-cenario";

const META_OFICINAS = "5c1b0f0e-0000-4000-8000-0000000000b1";
const META_PESSOAS = "5c1b0f0e-0000-4000-8000-0000000000b2";
const META_ALHEIA = "5c1b0f0e-0000-4000-8000-0000000000b9";
const LOCAL_TEATRO = "5c1b0f0e-0000-4000-8000-0000000000b3";
const LOCAL_ALHEIO = "5c1b0f0e-0000-4000-8000-0000000000b8";
const ATIVIDADE_1 = "5c1b0f0e-0000-4000-8000-0000000000b4";
const ATIVIDADE_ALHEIA = "5c1b0f0e-0000-4000-8000-0000000000b7";

function memoriaPadrao() {
  return memoriaFalsa({
    prestacao_metas: [
      { id: META_OFICINAS, prestacao_id: PRESTACAO, descricao: "Oficinas realizadas", unidade: "oficinas", previsto: 10, realizado: null, justificativa: null, ordem: 1 },
      { id: META_PESSOAS, prestacao_id: PRESTACAO, descricao: "Pessoas atendidas", unidade: "pessoas", previsto: 500, realizado: 300, justificativa: null, ordem: 2 },
      { id: META_ALHEIA, prestacao_id: DE_OUTRA_ORG, descricao: "Meta de outra prestação", unidade: null, previsto: 1, realizado: null, justificativa: null, ordem: 1 },
    ],
    prestacao_locais: [
      { id: LOCAL_TEATRO, prestacao_id: PRESTACAO, pais: "Brasil", uf: "SP", municipio: "Campinas", espaco: "Teatro Municipal", inicio: null, fim: null, status: "previsto", justificativa: null, ordem: 1 },
      { id: LOCAL_ALHEIO, prestacao_id: DE_OUTRA_ORG, pais: "Brasil", uf: "RJ", municipio: "Niterói", espaco: null, inicio: null, fim: null, status: "previsto", justificativa: null, ordem: 1 },
    ],
    prestacao_atividades: [
      {
        id: ATIVIDADE_1, prestacao_id: PRESTACAO, titulo: "Oficina de teatro", descricao: "Aula aberta", data_realizacao: "2026-05-10", data_inicio: null, data_fim: null, local: "Teatro Municipal", cidade: "Campinas", estado: "SP",
        publico_atingido: 30, meta_prevista: 40, empregos_diretos: 2, empregos_indiretos: null, democratizacao_descricao: null, acessibilidade_descricao: null, status_realizacao: "realizado",
        justificativa_nao_realizacao: null, meta_id: META_OFICINAS, local_id: LOCAL_TEATRO, ordem: 0,
      },
      { id: ATIVIDADE_ALHEIA, prestacao_id: DE_OUTRA_ORG, titulo: "Atividade de outra prestação", data_realizacao: "2026-05-11", status_realizacao: "realizado", meta_id: null, local_id: null, ordem: 0 },
    ],
    prestacao_relatorio: [],
    assistente_acoes: [],
  });
}

function preparar(cenario: Cenario = { escopo: "write" }) {
  const memoria = memoriaPadrao();
  const preparado = prepararComStorage(cenario, memoria.resolver);
  return { memoria, ...preparado };
}

const objeto = (consulta = "", id: string = PRESTACAO) => objetoGET(pedido(`/prestacoes/${id}/objeto${consulta}`), comId(id));
const registrar = (corpo: unknown, id: string = PRESTACAO) => atividadesPOST(pedido(`/prestacoes/${id}/atividades`, { metodo: "POST", corpo }), comId(id));
const atualizar = (corpo: unknown, id: string = PRESTACAO) => atualizarAtividadePOST(pedido(`/prestacoes/${id}/atividades/atualizar`, { metodo: "POST", corpo }), comId(id));
const atualizarMeta = (corpo: unknown, id: string = PRESTACAO) => atualizarMetaPOST(pedido(`/prestacoes/${id}/metas/atualizar`, { metodo: "POST", corpo }), comId(id));
const relatorio = (id: string = PRESTACAO) => relatorioGET(pedido(`/prestacoes/${id}/relatorio`), comId(id));
const salvar = (corpo: unknown, id: string = PRESTACAO) => relatorioPOST(pedido(`/prestacoes/${id}/relatorio`, { metodo: "POST", corpo }), comId(id));

const oficina = (parcial: Record<string, unknown> = {}) => ({ titulo: "Oficina de dança", data_realizacao: "2026-06-12", status_realizacao: "realizado", ...parcial });
const avisos = (consultas: ReturnType<typeof prepararComStorage>["consultas"]) => daTabela(consultas, "fn_prestacao_avisar_assistente");

// ─── Leitura do objeto ──────────────────────────────────────────────────────

test("o objeto traz metas com a situação da tela, locais e atividades, só da prestação pedida e sem dado interno", async () => {
  const { status, corpo } = await (async () => { preparar({ escopo: "read" }); return ler(await objeto()); })();
  assert.equal(status, 200);
  assert.deepEqual(corpo.prestacao.periodo_de_execucao, { inicio: "2026-03-01", fim: "2026-12-31" });
  assert.match(corpo.prestacao.url_atividades, /\/prestacoes\/[0-9a-f-]+\/atividades$/);

  const oficinas = corpo.metas.find((m: { meta_id: string }) => m.meta_id === META_OFICINAS);
  assert.equal(oficinas.situacao, "sem_resultado");
  assert.equal(oficinas.atividades_ligadas, 1);
  assert.equal(oficinas.publico_nas_atividades, 30);
  assert.equal(oficinas.em_texto.previsto, "10 oficinas");

  const pessoas = corpo.metas.find((m: { meta_id: string }) => m.meta_id === META_PESSOAS);
  assert.equal(pessoas.situacao, "abaixo");
  assert.equal(pessoas.percentual, 60);
  assert.equal(pessoas.falta_justificativa, true, "abaixo do previsto sem justificar: o mesmo aviso da tela");

  assert.deepEqual(corpo.metas.map((m: { meta_id: string }) => m.meta_id), [META_OFICINAS, META_PESSOAS], "a meta de outra prestação não aparece");
  assert.deepEqual(corpo.locais.map((l: { local_id: string }) => l.local_id), [LOCAL_TEATRO]);
  assert.equal(corpo.locais[0].local, "Campinas/SP");
  assert.equal(corpo.total_de_atividades, 1);
  assert.equal(corpo.atividades[0].atividade_id, ATIVIDADE_1);
  assert.ok(!JSON.stringify(corpo).includes(DE_OUTRA_ORG) && !JSON.stringify(corpo).includes("criado_por") && !JSON.stringify(corpo).includes(ORG));
});

test("as atividades vêm paginadas e o objeto de outra organização é 404", async () => {
  const { memoria } = preparar({ escopo: "read" });
  for (let i = 0; i < 4; i++) {
    memoria.linhas("prestacao_atividades").push({ id: `5c1b0f0e-0000-4000-8000-00000000c0${i}`, prestacao_id: PRESTACAO, titulo: `Ensaio ${i}`, descricao: null, data_realizacao: `2026-07-0${i + 1}`, status_realizacao: "realizado", meta_id: null, local_id: null, ordem: i + 1 });
  }
  const primeira = await ler(await objeto("?limite=2"));
  assert.equal(primeira.corpo.total_de_atividades, 5);
  assert.equal(primeira.corpo.atividades.length, 2);
  assert.equal(primeira.corpo.proximo_deslocamento, 2);
  const ultima = await ler(await objeto("?limite=2&deslocamento=4"));
  assert.equal(ultima.corpo.atividades.length, 1);
  assert.equal(ultima.corpo.proximo_deslocamento, null);

  assert.equal((await ler(await objeto("", DE_OUTRA_ORG))).status, 404);
});

// ─── Registrar atividades ───────────────────────────────────────────────────

test("registrar atividades grava só o que foi dito, ligada à meta e ao local, com trilha por atividade e um aviso só", async () => {
  const { memoria, consultas } = preparar();
  const { status, corpo } = await ler(
    await registrar({
      atividades: [
        oficina({ descricao: "Aula aberta para jovens", local: "Teatro Municipal", cidade: "Campinas", estado: "sp", publico_atingido: 45, empregos_diretos: 3, meta_id: META_OFICINAS, local_id: LOCAL_TEATRO }),
        oficina({ titulo: "Ensaio geral", data_realizacao: "2026-06-20", status_realizacao: "nao_realizado", justificativa_nao_realizacao: "Chuva forte no dia" }),
      ],
    })
  );
  assert.equal(status, 200);
  assert.equal(corpo.registradas, 2);
  assert.equal(corpo.com_erro, 0);
  assert.match(corpo.prestacao.url, /\/atividades$/);

  const novas = memoria.linhas("prestacao_atividades").filter((a) => a.prestacao_id === PRESTACAO && a.id !== ATIVIDADE_1);
  assert.equal(novas.length, 2);
  const [danca, ensaio] = novas;
  assert.equal(danca.criado_por, USUARIO);
  assert.equal(danca.estado, "SP", "a sigla entra em maiúsculas");
  assert.equal(danca.publico_atingido, 45);
  assert.equal(danca.meta_id, META_OFICINAS);
  assert.equal(danca.status_realizacao, "realizado");
  assert.equal(danca.democratizacao_descricao, null, "o que ninguém disse fica vazio");
  assert.equal(danca.empregos_indiretos, null);
  assert.deepEqual([danca.ordem, ensaio.ordem], [1, 2], "a ordem segue a das atividades que já existiam");
  assert.deepEqual([ensaio.status_realizacao, ensaio.justificativa_nao_realizacao], ["nao_realizado", "Chuva forte no dia"]);

  const trilha = memoria.linhas("assistente_acoes");
  assert.equal(trilha.length, 2);
  assert.ok(trilha.every((a) => a.ferramenta === "registrar_atividades" && a.acao === "criar" && a.tabela === "prestacao_atividades" && a.usuario_id === USUARIO));
  assert.equal(avisos(consultas).length, 1, "um aviso à equipe por chamada");
});

test("a mesma atividade (título e data) não entra duas vezes: a repetida volta com o id da que já existe", async () => {
  const { memoria } = preparar();
  const corpoDoPedido = { atividades: [oficina()] };
  assert.equal((await ler(await registrar(corpoDoPedido))).corpo.registradas, 1);
  const segundo = await ler(await registrar(corpoDoPedido));
  assert.equal(segundo.corpo.registradas, 0);
  assert.match(segundo.corpo.resultados[0].erro, /Já existe uma atividade/);
  assert.ok(segundo.corpo.resultados[0].atividade_id);
  assert.equal(memoria.linhas("prestacao_atividades").filter((a) => a.titulo === "Oficina de dança").length, 1);

  const daOutra = await ler(await registrar({ atividades: [{ titulo: "Atividade de outra prestação", data_realizacao: "2026-05-11", status_realizacao: "realizado" }] }));
  assert.equal(daOutra.corpo.registradas, 1, "o título repetido numa outra prestação não conta");
});

test("num lote, cada atividade vale por si: vínculo de outra prestação volta com o motivo e as boas entram", async () => {
  const { memoria } = preparar();
  const { corpo } = await ler(
    await registrar({
      atividades: [oficina({ titulo: "Boa", meta_id: META_OFICINAS }), oficina({ titulo: "Meta alheia", meta_id: META_ALHEIA }), oficina({ titulo: "Local alheio", local_id: LOCAL_ALHEIO }), oficina({ titulo: "Outra boa" })],
    })
  );
  assert.equal(corpo.registradas, 2);
  assert.equal(corpo.com_erro, 2);
  assert.match(corpo.resultados[1].erro, /meta_id não é desta prestação/);
  assert.match(corpo.resultados[2].erro, /local_id não é desta prestação/);
  assert.deepEqual(memoria.linhas("prestacao_atividades").filter((a) => a.prestacao_id === PRESTACAO && a.id !== ATIVIDADE_1).map((a) => a.titulo), ["Boa", "Outra boa"]);
});

test("pedido mal feito é recusado antes de gravar, apontando a posição e o campo", async () => {
  const { memoria, consultas } = preparar();
  const casos: [unknown, RegExp][] = [
    [{}, /atividades/],
    [{ atividades: [] }, /atividades/],
    [{ atividades: Array.from({ length: 21 }, (_, i) => oficina({ titulo: `A${i}` })) }, /até 20/],
    [{ atividades: [{ data_realizacao: "2026-06-12" }] }, /atividades\[0\]: Informe titulo/],
    [{ atividades: [{ titulo: "Sem data" }] }, /atividades\[0\]: Informe data_realizacao/],
    [{ atividades: [{ titulo: "Sem status", data_realizacao: "2026-06-12" }] }, /atividades\[0\]: Informe status_realizacao/],
    [{ atividades: [oficina({ status_realizacao: "talvez" })] }, /status_realizacao deve ser um destes/],
    [{ atividades: [oficina(), oficina({ data_realizacao: "12/06/2026" })] }, /atividades\[1\]: data_realizacao/],
    [{ atividades: [oficina({ data_realizacao: "2026-06-12T10:00" })] }, /sem hora/],
    [{ atividades: [oficina({ data_inicio: "2026-06-12", data_fim: "2026-06-10" })] }, /data_fim vem antes/],
    [{ atividades: [oficina({ status_realizacao: "nao_realizado" })] }, /pede justificativa/],
    [{ atividades: [oficina({ estado: "Atlântida" })] }, /estado deve ser a sigla/],
    [{ atividades: [oficina({ publico_atingido: -3 })] }, /publico_atingido/],
    [{ atividades: [oficina({ publico_atingido: 2.5 })] }, /inteiro/],
    [{ atividades: ["texto solto"] }, /atividades\[0\] deve ser um objeto/],
  ];
  for (const [corpo, esperado] of casos) {
    const { status, corpo: resposta } = await ler(await registrar(corpo));
    assert.equal(status, 400, JSON.stringify(corpo).slice(0, 80));
    assert.match(resposta.error, esperado, JSON.stringify(corpo).slice(0, 80));
  }
  assert.equal(memoria.linhas("prestacao_atividades").length, 2, "nada foi gravado");
  assert.equal(avisos(consultas).length, 0);
});

test("null e texto vazio nos opcionais não atrapalham: valem como não informados", async () => {
  const { memoria } = preparar();
  const { corpo } = await ler(
    await registrar({
      atividades: [oficina({ descricao: null, local: "", cidade: null, estado: null, publico_atingido: null, empregos_diretos: null, justificativa_nao_realizacao: null, meta_id: null, local_id: "", data_inicio: null, data_fim: "" })],
    })
  );
  assert.equal(corpo.registradas, 1);
  const gravada = memoria.linhas("prestacao_atividades").find((a) => a.titulo === "Oficina de dança")!;
  assert.deepEqual([gravada.descricao, gravada.estado, gravada.publico_atingido, gravada.meta_id, gravada.local_id, gravada.status_realizacao], [null, null, null, null, null, "realizado"]);
});

test("atividade realizada não leva justificativa de não realização", async () => {
  const { memoria } = preparar();
  await registrar({ atividades: [oficina({ justificativa_nao_realizacao: "esquecida aqui" })] });
  const gravada = memoria.linhas("prestacao_atividades").find((a) => a.titulo === "Oficina de dança")!;
  assert.equal(gravada.justificativa_nao_realizacao, null);
});

// ─── Atualizar atividade ────────────────────────────────────────────────────

test("atualizar mexe só nos campos informados e guarda o que havia antes", async () => {
  const { memoria } = preparar();
  const { status, corpo } = await ler(await atualizar({ atividade_id: ATIVIDADE_1, publico_atingido: 52, descricao: "Aula aberta, com intérprete de Libras", substituir: true }));
  assert.equal(status, 200);
  assert.equal(corpo.mudou, true);
  assert.deepEqual([...corpo.campos_mudados].sort(), ["descricao", "publico_atingido"]);
  assert.equal(corpo.atividade.publico_atingido, 52);

  const linha = memoria.linhas("prestacao_atividades").find((a) => a.id === ATIVIDADE_1)!;
  assert.equal(linha.publico_atingido, 52);
  assert.equal(linha.titulo, "Oficina de teatro", "o que não veio fica como está");
  assert.equal(linha.meta_id, META_OFICINAS);
  assert.equal(linha.empregos_diretos, 2);

  const [trilha] = memoria.linhas("assistente_acoes");
  assert.equal(trilha.ferramenta, "atualizar_atividade");
  assert.equal(trilha.acao, "atualizar");
  assert.deepEqual(trilha.antes, { descricao: "Aula aberta", publico_atingido: 30 });
  assert.deepEqual(trilha.depois, { descricao: "Aula aberta, com intérprete de Libras", publico_atingido: 52 });
});

test("null e vazio nos opcionais não mudam nada: só o que foi informado de verdade muda, e limpar esvazia a pedido", async () => {
  const { memoria } = preparar();
  const linha = () => memoria.linhas("prestacao_atividades").find((a) => a.id === ATIVIDADE_1)!;

  // Muitos assistentes mandam null (ou texto vazio) nos campos que não vão usar: isso nunca apaga o que já está lá.
  const soNulos = await ler(await atualizar({ atividade_id: ATIVIDADE_1, descricao: null, local: "", meta_id: null, local_id: "", empregos_diretos: null }));
  assert.equal(soNulos.status, 400, "sem nenhum campo de verdade, o pedido é recusado");
  assert.match(soNulos.corpo.error, /ao menos um campo/);
  assert.deepEqual([linha().descricao, linha().local, linha().meta_id, linha().local_id, linha().empregos_diretos], ["Aula aberta", "Teatro Municipal", META_OFICINAS, LOCAL_TEATRO, 2]);

  const comNulos = await ler(await atualizar({ atividade_id: ATIVIDADE_1, publico_atingido: 40, descricao: null, meta_id: null, local_id: "", substituir: true }));
  assert.deepEqual(comNulos.corpo.campos_mudados, ["publico_atingido"]);
  assert.deepEqual([linha().publico_atingido, linha().descricao, linha().meta_id, linha().local_id], [40, "Aula aberta", META_OFICINAS, LOCAL_TEATRO]);

  const limpar = await ler(await atualizar({ atividade_id: ATIVIDADE_1, limpar: ["empregos_diretos", "local", "meta_id"], substituir: true }));
  assert.equal(limpar.corpo.mudou, true);
  assert.deepEqual([...limpar.corpo.campos_mudados].sort(), ["empregos_diretos", "local", "meta_id"]);
  assert.deepEqual([linha().empregos_diretos, linha().local, linha().meta_id], [null, null, null]);
  assert.deepEqual(memoria.linhas("assistente_acoes").at(-1)!.antes, { empregos_diretos: 2, local: "Teatro Municipal", meta_id: META_OFICINAS });

  const antesDaTrilha = memoria.linhas("assistente_acoes").length;
  const igual = await ler(await atualizar({ atividade_id: ATIVIDADE_1, publico_atingido: 40, substituir: true }));
  assert.equal(igual.corpo.mudou, false, "o mesmo valor não muda nada");
  assert.equal(memoria.linhas("assistente_acoes").length, antesDaTrilha, "e não deixa trilha");
});

test("limpar só aceita campos que podem ficar vazios e não convive com o mesmo campo informado", async () => {
  const { memoria } = preparar();
  for (const [corpo, esperado] of [
    [{ limpar: ["titulo"] }, /limpar aceita só estes campos/],
    [{ limpar: ["data_realizacao"] }, /limpar aceita só estes campos/],
    [{ limpar: ["status_realizacao"] }, /limpar aceita só estes campos/],
    [{ limpar: ["descricao"], descricao: "outra" }, /escolha um dos dois/],
  ] as const) {
    const { status, corpo: resposta } = await ler(await atualizar({ atividade_id: ATIVIDADE_1, ...corpo }));
    assert.equal(status, 400, JSON.stringify(corpo));
    assert.match(resposta.error, esperado);
  }
  assert.equal(memoria.linhas("assistente_acoes").length, 0);
});

test("marcar como não realizada pede justificativa; voltar para realizada limpa a justificativa", async () => {
  const { memoria } = preparar();
  const semMotivo = await ler(await atualizar({ atividade_id: ATIVIDADE_1, status_realizacao: "nao_realizado", substituir: true }));
  assert.equal(semMotivo.status, 400);
  assert.match(semMotivo.corpo.error, /pede justificativa/);

  const ok = await ler(await atualizar({ atividade_id: ATIVIDADE_1, status_realizacao: "nao_realizado", justificativa_nao_realizacao: "Teatro interditado", substituir: true }));
  assert.equal(ok.corpo.mudou, true);
  assert.equal(ok.corpo.atividade.justificativa_da_nao_realizacao, "Teatro interditado");

  const volta = await ler(await atualizar({ atividade_id: ATIVIDADE_1, status_realizacao: "realizado", substituir: true }));
  assert.equal(volta.corpo.mudou, true);
  const linha = memoria.linhas("prestacao_atividades").find((a) => a.id === ATIVIDADE_1)!;
  assert.deepEqual([linha.status_realizacao, linha.justificativa_nao_realizacao], ["realizado", null]);
});

test("atualizar recusa pedido sem campo, vínculo de outra prestação e atividade que não é desta prestação", async () => {
  const { memoria } = preparar();
  assert.equal((await ler(await atualizar({ atividade_id: ATIVIDADE_1 }))).status, 400);
  assert.equal((await ler(await atualizar({}))).status, 400);
  assert.equal((await ler(await atualizar({ atividade_id: "abc", descricao: "x" }))).status, 400);
  const meta = await ler(await atualizar({ atividade_id: ATIVIDADE_1, meta_id: META_ALHEIA }));
  assert.equal(meta.status, 400);
  assert.match(meta.corpo.error, /meta_id não é desta prestação/);
  assert.equal((await ler(await atualizar({ atividade_id: ATIVIDADE_ALHEIA, descricao: "invadida" }))).status, 404, "atividade de outra prestação");
  assert.equal(memoria.linhas("prestacao_atividades").find((a) => a.id === ATIVIDADE_ALHEIA)!.descricao, undefined);
  assert.equal(memoria.linhas("assistente_acoes").length, 0);
});

test("trocar ou esvaziar o que a equipe já lançou numa atividade pede substituir=true; completar o que está vazio é livre", async () => {
  const { memoria } = preparar();
  const linha = () => memoria.linhas("prestacao_atividades").find((a) => a.id === ATIVIDADE_1)!;

  // Completar: campos vazios (empregos_indiretos, acessibilidade) entram sem confirmação.
  const completa = await ler(await atualizar({ atividade_id: ATIVIDADE_1, empregos_indiretos: 5, acessibilidade_descricao: "Rampa e intérprete de Libras" }));
  assert.equal(completa.status, 200);
  assert.deepEqual([...completa.corpo.campos_mudados].sort(), ["acessibilidade_descricao", "empregos_indiretos"]);

  // Trocar: publico_atingido (30) e descricao já têm valor.
  const recusa = await ler(await atualizar({ atividade_id: ATIVIDADE_1, publico_atingido: 99, descricao: "Outra descrição", empregos_indiretos: 6 }));
  assert.equal(recusa.status, 409);
  assert.match(recusa.corpo.error, /já tem valor em descricao, publico_atingido, empregos_indiretos/);
  assert.match(recusa.corpo.error, /substituir=true/);
  assert.deepEqual(recusa.corpo.valores_atuais, { publico_atingido: 30, descricao: "Aula aberta", empregos_indiretos: 5 });
  assert.deepEqual([linha().publico_atingido, linha().descricao, linha().empregos_indiretos], [30, "Aula aberta", 5], "nada mudou");

  // Esvaziar também pede.
  const esvazia = await ler(await atualizar({ atividade_id: ATIVIDADE_1, limpar: ["local"] }));
  assert.equal(esvazia.status, 409);
  assert.equal(linha().local, "Teatro Municipal");

  const confirmada = await ler(await atualizar({ atividade_id: ATIVIDADE_1, publico_atingido: 99, substituir: true }));
  assert.equal(confirmada.status, 200);
  assert.equal(linha().publico_atingido, 99);
  assert.deepEqual(memoria.linhas("assistente_acoes").at(-1)!.antes, { publico_atingido: 30 });
});

// ─── Atualizar meta ─────────────────────────────────────────────────────────

test("atualizar meta lança o realizado e a justificativa e devolve os números da tela", async () => {
  const { memoria } = preparar();
  const { status, corpo } = await ler(await atualizarMeta({ meta_id: META_OFICINAS, realizado: 8, justificativa: "Duas oficinas foram adiadas por falta de espaço" }));
  assert.equal(status, 200);
  assert.equal(corpo.mudou, true);
  assert.equal(corpo.meta.realizado, 8);
  assert.equal(corpo.meta.situacao, "abaixo");
  assert.equal(corpo.meta.percentual, 80);
  assert.equal(corpo.meta.falta_justificativa, false);

  const linha = memoria.linhas("prestacao_metas").find((m) => m.id === META_OFICINAS)!;
  assert.equal(linha.realizado, 8);
  assert.equal(linha.previsto, 10, "o previsto não muda por aqui");
  assert.equal(linha.descricao, "Oficinas realizadas");

  const [trilha] = memoria.linhas("assistente_acoes");
  assert.equal(trilha.ferramenta, "atualizar_meta");
  assert.deepEqual(trilha.antes, { realizado: null, justificativa: null });
  assert.deepEqual(trilha.depois, { realizado: 8, justificativa: "Duas oficinas foram adiadas por falta de espaço" });
});

test("a meta abaixo do previsto sem justificativa volta marcada para a pessoa justificar", async () => {
  preparar();
  const { corpo } = await ler(await atualizarMeta({ meta_id: META_OFICINAS, realizado: 7 }));
  assert.equal(corpo.meta.falta_justificativa, true);
  const batida = await ler(await atualizarMeta({ meta_id: META_OFICINAS, realizado: 10, substituir: true }));
  assert.equal(batida.corpo.meta.situacao, "atingida");
  assert.equal(batida.corpo.meta.falta_justificativa, false);
});

test("na meta, null e vazio não mudam nada e limpar esvazia o realizado ou a justificativa a pedido", async () => {
  const { memoria } = preparar();
  const meta = () => memoria.linhas("prestacao_metas").find((m) => m.id === META_PESSOAS)!;
  const nulos = await ler(await atualizarMeta({ meta_id: META_PESSOAS, realizado: null, justificativa: null }));
  assert.equal(nulos.status, 400);
  assert.equal(meta().realizado, 300, "o resultado já lançado não some por causa de um null");

  const juntos = await ler(await atualizarMeta({ meta_id: META_PESSOAS, justificativa: "Chuva afastou o público", realizado: null }));
  assert.deepEqual(juntos.corpo.campos_mudados, ["justificativa"]);
  assert.equal(meta().realizado, 300);

  const limpar = await ler(await atualizarMeta({ meta_id: META_PESSOAS, limpar: ["realizado"], substituir: true }));
  assert.equal(limpar.corpo.mudou, true);
  assert.equal(meta().realizado, null);
  assert.equal(meta().justificativa, "Chuva afastou o público");
  assert.equal(limpar.corpo.meta.situacao, "sem_resultado");

  const previsto = await ler(await atualizarMeta({ meta_id: META_PESSOAS, limpar: ["previsto"] }));
  assert.equal(previsto.status, 400, "o previsto não se esvazia por aqui");
  assert.equal(meta().previsto, 500);
});

test("na meta, completar o que está vazio é livre; trocar o resultado ou a justificativa que já existem pede substituir=true", async () => {
  const { memoria } = preparar();
  const meta = () => memoria.linhas("prestacao_metas").find((m) => m.id === META_PESSOAS)!;

  const completa = await ler(await atualizarMeta({ meta_id: META_PESSOAS, justificativa: "Chuva afastou o público" }));
  assert.equal(completa.status, 200, "a justificativa estava vazia");

  const recusa = await ler(await atualizarMeta({ meta_id: META_PESSOAS, realizado: 100, justificativa: "Outra razão" }));
  assert.equal(recusa.status, 409);
  assert.match(recusa.corpo.error, /A meta já tem valor em realizado, justificativa/);
  assert.deepEqual(recusa.corpo.valores_atuais, { realizado: 300, justificativa: "Chuva afastou o público" });
  assert.deepEqual([meta().realizado, meta().justificativa], [300, "Chuva afastou o público"], "o que a equipe tinha continua lá");

  const confirmada = await ler(await atualizarMeta({ meta_id: META_PESSOAS, realizado: 100, substituir: true }));
  assert.equal(confirmada.status, 200);
  assert.equal(meta().realizado, 100);
  assert.deepEqual(memoria.linhas("assistente_acoes").at(-1)!.antes, { realizado: 300 });
});

test("atualizar meta recusa número negativo, texto longo, pedido vazio e meta de outra prestação", async () => {
  const { memoria } = preparar();
  assert.equal((await ler(await atualizarMeta({ meta_id: META_OFICINAS, realizado: -1 }))).status, 400);
  assert.equal((await ler(await atualizarMeta({ meta_id: META_OFICINAS, justificativa: "x".repeat(2001) }))).status, 400);
  assert.equal((await ler(await atualizarMeta({ meta_id: META_OFICINAS }))).status, 400);
  assert.equal((await ler(await atualizarMeta({ realizado: 3 }))).status, 400);
  assert.equal((await ler(await atualizarMeta({ meta_id: META_ALHEIA, realizado: 1 }))).status, 404);
  assert.equal(memoria.linhas("prestacao_metas").find((m) => m.id === META_ALHEIA)!.realizado, null);
  assert.equal(memoria.linhas("assistente_acoes").length, 0);

  const igual = await ler(await atualizarMeta({ meta_id: META_PESSOAS, realizado: 300 }));
  assert.equal(igual.corpo.mudou, false, "o mesmo valor não mexe em nada");
  assert.equal(memoria.linhas("assistente_acoes").length, 0);
});

// ─── Relatório do objeto ────────────────────────────────────────────────────

test("o relatório lista as seções do modelo do regime, o que cada uma pede e as lacunas, sem despejar o texto montado pelo Jards", async () => {
  preparar({ escopo: "read" });
  const { status, corpo } = await ler(await relatorio());
  assert.equal(status, 200);
  assert.equal(corpo.modelo, "salic");
  assert.ok(corpo.lacunas > 0);
  const porId = new Map(corpo.secoes.map((s: { secao_id: string }) => [s.secao_id, s]));
  const etapas = porId.get("etapas") as { pode_preencher: boolean; texto: { obrigatorio: boolean; limite_de_caracteres: number; preenchido: boolean } };
  assert.equal(etapas.pode_preencher, true);
  assert.equal(etapas.texto.obrigatorio, true);
  assert.equal(etapas.texto.preenchido, false);
  assert.equal(etapas.texto.limite_de_caracteres, 5000);
  const empregos = porId.get("empregos") as { numeros: { id: string; valor: number | null }[] };
  assert.deepEqual(empregos.numeros.map((n) => n.id), ["diretos", "indiretos"]);
  const locais = porId.get("locais") as { pode_preencher: boolean };
  assert.equal(locais.pode_preencher, false, "seção montada a partir dos dados não se escreve por aqui");
  assert.ok(!("paragrafos" in (locais as object)));
  assert.match(corpo.prestacao.url, /\/envio\/objeto$/);
  assert.equal((await ler(await relatorio(DE_OUTRA_ORG))).status, 404);
});

test("salvar a seção grava o texto na chave do modelo, deixa trilha e avisa a equipe", async () => {
  const { memoria, consultas } = preparar();
  const antes = (await ler(await relatorio())).corpo.secoes.find((s: { secao_id: string }) => s.secao_id === "etapas");
  const { status, corpo } = await ler(await salvar({ secao_id: "etapas", texto: "  O projeto levou oficinas a 6 bairros da cidade.  " }));
  assert.equal(status, 200);
  assert.equal(corpo.mudou, true);
  assert.deepEqual(corpo.campos_gravados, ["texto"]);

  const [linha] = memoria.linhas("prestacao_relatorio");
  assert.equal(linha.prestacao_id, PRESTACAO);
  assert.equal(linha.secao, "salic:etapas");
  assert.equal(linha.conteudo, "O projeto levou oficinas a 6 bairros da cidade.");

  const [trilha] = memoria.linhas("assistente_acoes");
  assert.equal(trilha.ferramenta, "salvar_secao_do_relatorio");
  assert.equal(trilha.acao, "criar");
  assert.equal(trilha.registro_id, linha.id);
  assert.equal(avisos(consultas).length, 1);

  const depois = await ler(await relatorio());
  const etapas = depois.corpo.secoes.find((s: { secao_id: string }) => s.secao_id === "etapas");
  assert.equal(etapas.texto.preenchido, true);
  assert.equal(etapas.texto.atual, "O projeto levou oficinas a 6 bairros da cidade.");
  assert.equal(etapas.lacunas, antes.lacunas - 1, "a lacuna do campo obrigatório some");
});

test("texto que já existe não é trocado sem substituir=true; com ele, o de antes vai para a trilha", async () => {
  const { memoria } = preparar();
  await salvar({ secao_id: "acessibilidade", texto: "Rampa de acesso e intérprete de Libras." });

  const recusa = await ler(await salvar({ secao_id: "acessibilidade", texto: "Outro texto." }));
  assert.equal(recusa.status, 409);
  assert.match(recusa.corpo.error, /substituir=true/);
  assert.equal(recusa.corpo.texto_atual, "Rampa de acesso e intérprete de Libras.");
  assert.equal(memoria.linhas("prestacao_relatorio")[0].conteudo, "Rampa de acesso e intérprete de Libras.");

  const igual = await ler(await salvar({ secao_id: "acessibilidade", texto: "Rampa de acesso e intérprete de Libras." }));
  assert.equal(igual.status, 200);
  assert.equal(igual.corpo.mudou, false, "o mesmo texto não conta como troca");

  const troca = await ler(await salvar({ secao_id: "acessibilidade", texto: "Outro texto.", substituir: true }));
  assert.equal(troca.corpo.mudou, true);
  assert.equal(memoria.linhas("prestacao_relatorio")[0].conteudo, "Outro texto.");
  const trilha = memoria.linhas("assistente_acoes").at(-1)!;
  assert.equal(trilha.acao, "atualizar");
  assert.deepEqual(trilha.antes, { texto: "Rampa de acesso e intérprete de Libras." });
  assert.deepEqual(trilha.depois, { texto: "Outro texto." });
});

test("os números da seção entram como JSON do modelo; trocar um que existe também pede substituir=true", async () => {
  const { memoria } = preparar();
  const primeiro = await ler(await salvar({ secao_id: "empregos", numeros: [{ id: "diretos", valor: 3 }] }));
  assert.deepEqual(primeiro.corpo.campos_gravados, ["numeros"]);
  const linha = memoria.linhas("prestacao_relatorio").find((l) => l.secao === "salic:empregos:numeros")!;
  assert.deepEqual(JSON.parse(String(linha.conteudo)), { diretos: 3 });

  const acrescenta = await ler(await salvar({ secao_id: "empregos", numeros: [{ id: "indiretos", valor: "12" }] }));
  assert.equal(acrescenta.status, 200);
  assert.deepEqual(JSON.parse(String(linha.conteudo)), { diretos: 3, indiretos: 12 }, "o número que já estava fica");

  const recusa = await ler(await salvar({ secao_id: "empregos", numeros: [{ id: "diretos", valor: 5 }] }));
  assert.equal(recusa.status, 409);
  assert.deepEqual(recusa.corpo.numeros_atuais, { diretos: 3, indiretos: 12 });

  const troca = await ler(await salvar({ secao_id: "empregos", numeros: [{ id: "diretos", valor: 5 }], substituir: true }));
  assert.equal(troca.corpo.mudou, true);
  assert.deepEqual(JSON.parse(String(linha.conteudo)), { diretos: 5, indiretos: 12 });
  assert.deepEqual(memoria.linhas("assistente_acoes").at(-1)!.antes, { diretos: 3 });
});

test("texto null junto de números é ignorado, não é erro", async () => {
  const { memoria } = preparar();
  const { status, corpo } = await ler(await salvar({ secao_id: "empregos", texto: null, numeros: [{ id: "diretos", valor: 2 }], substituir: null }));
  assert.equal(status, 200);
  assert.deepEqual(corpo.campos_gravados, ["numeros"]);
  assert.equal(memoria.linhas("prestacao_relatorio").length, 1);
});

test("um pedido com texto e números recusado por um deles não grava nenhum", async () => {
  const { memoria } = preparar();
  await salvar({ secao_id: "empregos", numeros: [{ id: "diretos", valor: 3 }] });
  const antes = memoria.linhas("prestacao_relatorio").length;
  const recusa = await ler(await salvar({ secao_id: "empregos", texto: "Gerou vagas para a cidade.", numeros: [{ id: "diretos", valor: 9 }] }));
  assert.equal(recusa.status, 409);
  assert.equal(memoria.linhas("prestacao_relatorio").length, antes, "o texto não ficou gravado");
  assert.ok(!memoria.linhas("prestacao_relatorio").some((l) => l.secao === "salic:empregos"));

  const ok = await ler(await salvar({ secao_id: "empregos", texto: "Gerou vagas para a cidade.", numeros: [{ id: "indiretos", valor: 4 }] }));
  assert.deepEqual(ok.corpo.campos_gravados, ["texto", "numeros"]);
  assert.equal(ok.corpo.acao_ids.length, 2);
});

test("salvar recusa seção que não existe, que o Jards monta sozinho, texto vazio ou longo demais e número inválido", async () => {
  const { memoria, consultas } = preparar();
  const inexistente = await ler(await salvar({ secao_id: "nao-existe", texto: "x" }));
  assert.equal(inexistente.status, 404);
  assert.match(inexistente.corpo.error, /etapas/);
  const montada = await ler(await salvar({ secao_id: "locais", texto: "x" }));
  assert.equal(montada.status, 400);
  assert.match(montada.corpo.error, /não tem campo de texto/);
  assert.equal((await ler(await salvar({ secao_id: "etapas", texto: "   " }))).status, 400, "o assistente não apaga nem esvazia seção");
  assert.equal((await ler(await salvar({ secao_id: "etapas", texto: "x".repeat(5001) }))).status, 400);
  assert.equal((await ler(await salvar({ secao_id: "etapas" }))).status, 400);
  assert.equal((await ler(await salvar({ secao_id: "etapas", numeros: [{ id: "diretos", valor: 1 }] }))).status, 400, "etapas não tem números");
  assert.equal((await ler(await salvar({ secao_id: "empregos", numeros: [{ id: "diretos", valor: -2 }] }))).status, 400);
  assert.equal((await ler(await salvar({ secao_id: "empregos", numeros: [{ id: "diretos", valor: 1.5 }] }))).status, 400);
  assert.equal((await ler(await salvar({ secao_id: "empregos", numeros: [{ id: "outro", valor: 1 }] }))).status, 400);
  assert.equal((await ler(await salvar({ secao_id: "empregos", numeros: [{ id: "diretos", valor: 1 }, { id: "diretos", valor: 2 }] }))).status, 400);
  assert.equal(memoria.linhas("prestacao_relatorio").length, 0);
  assert.equal(memoria.linhas("assistente_acoes").length, 0);
  assert.equal(avisos(consultas).length, 0);
});

// ─── Quem pode gravar ───────────────────────────────────────────────────────

test("as quatro gravações exigem quem pode editar: chave só leitura, módulo só para consulta, papel leitor e recusa do banco", async () => {
  const gravacoes: [string, () => Promise<Response>][] = [
    ["registrar", () => registrar({ atividades: [oficina()] })],
    ["atualizar atividade", () => atualizar({ atividade_id: ATIVIDADE_1, descricao: "x" })],
    ["atualizar meta", () => atualizarMeta({ meta_id: META_OFICINAS, realizado: 1 })],
    ["salvar seção", () => salvar({ secao_id: "etapas", texto: "x" })],
  ];
  for (const [cenario, esperado] of [
    [{ escopo: "read" as const }, 403],
    [{ escopo: "write" as const, emVigor: false }, 402],
    [{ escopo: "write" as const, papel: "leitor" }, 403],
    [{ escopo: "write" as const, podeEditarNoBanco: false }, 403],
  ] as const) {
    for (const [nome, chamar] of gravacoes) {
      const { memoria } = preparar(cenario);
      const { status } = await ler(await chamar());
      assert.equal(status, esperado, `${nome}: ${JSON.stringify(cenario)}`);
      assert.equal(memoria.linhas("assistente_acoes").length, 0);
      assert.equal(memoria.linhas("prestacao_relatorio").length, 0);
      assert.equal(memoria.linhas("prestacao_atividades").length, 2);
    }
  }
});

test("as gravações da prestação de outra organização são 404 e nada muda", async () => {
  const { memoria } = preparar();
  assert.equal((await ler(await registrar({ atividades: [oficina()] }, DE_OUTRA_ORG))).status, 404);
  assert.equal((await ler(await atualizar({ atividade_id: ATIVIDADE_ALHEIA, descricao: "x" }, DE_OUTRA_ORG))).status, 404);
  assert.equal((await ler(await atualizarMeta({ meta_id: META_ALHEIA, realizado: 1 }, DE_OUTRA_ORG))).status, 404);
  assert.equal((await ler(await salvar({ secao_id: "etapas", texto: "x" }, DE_OUTRA_ORG))).status, 404);
  assert.equal(memoria.linhas("assistente_acoes").length, 0);
});

test("se a trilha não puder ser gravada, a gravação não fica: atividade nova, atividade mudada, meta e relatório voltam ao que eram", async () => {
  // Um banco que recusa só a gravação da trilha.
  const banco = memoriaPadrao();
  prepararComStorage({ escopo: "write" }, (c) => (c.tabela === "assistente_acoes" && c.acao === "insert" ? { error: { message: "trilha fora do ar" } } : banco.resolver(c)));

  const nova = await ler(await registrar({ atividades: [oficina({ titulo: "Sem trilha" })] }));
  assert.equal(nova.status, 500);
  assert.ok(!JSON.stringify(nova.corpo).includes("trilha fora do ar"), "o erro interno não vaza");
  assert.equal(banco.linhas("prestacao_atividades").filter((a) => a.titulo === "Sem trilha").length, 0);

  assert.equal((await ler(await atualizar({ atividade_id: ATIVIDADE_1, publico_atingido: 99, substituir: true }))).status, 500);
  assert.equal(banco.linhas("prestacao_atividades").find((a) => a.id === ATIVIDADE_1)!.publico_atingido, 30);

  assert.equal((await ler(await atualizarMeta({ meta_id: META_OFICINAS, realizado: 9 }))).status, 500);
  assert.equal(banco.linhas("prestacao_metas").find((m) => m.id === META_OFICINAS)!.realizado, null);

  assert.equal((await ler(await salvar({ secao_id: "etapas", texto: "Texto novo." }))).status, 500);
  assert.equal(banco.linhas("prestacao_relatorio").length, 0, "a linha nova do relatório saiu");
});
