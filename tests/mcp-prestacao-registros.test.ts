import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GET as acoesGET } from "../app/api/mcp/prestacoes/[id]/acoes/route";
import { POST as despesasPOST } from "../app/api/mcp/prestacoes/[id]/despesas/route";
import { POST as evidenciasPOST } from "../app/api/mcp/prestacoes/[id]/evidencias/route";
import { POST as retirarPOST } from "../app/api/mcp/prestacoes/[id]/retirar/route";
import { consolidarDespesa, lerDespesaInformada, type ContextoDaConsolidacao, type DespesaInformada } from "../lib/mcp/prestacao/despesas-gravacao";
import { retirarPelaEquipe, type SessaoDaEquipe } from "../lib/mcp/prestacao/retirada-da-equipe";
import { dependenciasDaRota } from "../lib/mcp/rota";
import { memoriaFalsa, primeiroQueResponder } from "./_helpers/memoria-falsa";
import type { Resolvedor } from "./_helpers/banco-falso";
import { DE_OUTRA_ORG, ITEM_A, ORG, ORIGEM, PRESTACAO, USUARIO, comId, ler, pedido, prepararComStorage } from "./_helpers/prestacao-cenario";

const ARQ_PDF = "5c1b0f0e-0000-4000-8000-0000000000e1";
const ARQ_XML = "5c1b0f0e-0000-4000-8000-0000000000e2";
const ARQ_FOTO = "5c1b0f0e-0000-4000-8000-0000000000e3";
const FORNECEDOR = "5c1b0f0e-0000-4000-8000-0000000000aa";
const META = "5c1b0f0e-0000-4000-8000-0000000000b1";
const META_ALHEIA = "5c1b0f0e-0000-4000-8000-0000000000b2";
const CAMINHO = (pasta: string, id: string, ext: string) => `${ORG}/prestacoes/${PRESTACAO}/${pasta}/${id}.${ext}`;

const caixa = (parcial: Record<string, unknown>) => ({
  prestacao_id: PRESTACAO,
  origem: "texto",
  destino: "despesa",
  situacao: "recebido",
  nome_arquivo: "nf.pdf",
  tipo_real: "pdf",
  tamanho_bytes: 30,
  sha256: "a".repeat(64),
  storage_path: CAMINHO("comprovantes", "5c1b0f0e-0000-4000-8000-00000000c0c0", "pdf"),
  registro_tabela: null,
  registro_id: null,
  detalhe: null,
  expira_em: "2099-01-01T00:00:00Z",
  ...parcial,
});

function memoriaPadrao() {
  return memoriaFalsa({
    assistente_arquivos: [
      caixa({ id: ARQ_PDF, nome_arquivo: "recibo.pdf" }),
      caixa({ id: ARQ_XML, nome_arquivo: "nf-1234.xml", tipo_real: "xml", sha256: "b".repeat(64), storage_path: CAMINHO("comprovantes", "5c1b0f0e-0000-4000-8000-00000000c0c1", "xml") }),
      caixa({ id: ARQ_FOTO, nome_arquivo: "oficina.jpg", tipo_real: "jpeg", destino: "evidencia", sha256: "c".repeat(64), storage_path: CAMINHO("evidencias", "5c1b0f0e-0000-4000-8000-00000000c0c2", "jpg") }),
    ],
    assistente_acoes: [],
    prestacao_comprovantes: [],
    prestacao_evidencias: [],
    prestacao_fornecedores: [{ id: FORNECEDOR, organization_id: ORG, documento: "11222333000181" }],
    prestacao_metas: [{ id: META, prestacao_id: PRESTACAO }, { id: META_ALHEIA, prestacao_id: "5c1b0f0e-0000-4000-8000-0000000000d9" }],
    prestacao_atividades: [],
    prestacao_locais: [],
    prestacao_pagamentos: [],
  });
}

const despesas = (corpo: unknown, id: string = PRESTACAO) => despesasPOST(pedido(`/prestacoes/${id}/despesas`, { metodo: "POST", corpo }), comId(id));
const evidencias = (corpo: unknown, id: string = PRESTACAO) => evidenciasPOST(pedido(`/prestacoes/${id}/evidencias`, { metodo: "POST", corpo }), comId(id));
const retirar = (corpo: unknown, id: string = PRESTACAO) => retirarPOST(pedido(`/prestacoes/${id}/retirar`, { metodo: "POST", corpo }), comId(id));
const acoes = (id: string = PRESTACAO) => acoesGET(pedido(`/prestacoes/${id}/acoes`), comId(id));
const nfe = () => readFile("tests/fixtures/fiscal/nfe-autorizada.xml", "utf8");
const comXml = async () => {
  const xml = await nfe();
  return { download: () => ({ data: new Blob([xml]), error: null }) };
};

// ─── consolidarDespesa: o que o XML diz e o que o assistente informou ───────

const informada = (parcial: Partial<DespesaInformada> = {}): DespesaInformada => ({
  arquivoId: ARQ_PDF,
  tipo: null,
  valor: null,
  data: null,
  numero: null,
  serie: null,
  chave: null,
  descricao: null,
  retencoes: { iss: 0, inss: 0, irrf: 0, outras: 0 },
  itemId: null,
  fornecedorDocumento: null,
  observacao: null,
  ...parcial,
});
const contextoPuro = (parcial: Partial<ContextoDaConsolidacao> = {}): ContextoDaConsolidacao => ({
  fornecedores: [{ id: FORNECEDOR, documento: "11222333000181" }],
  proponente: null,
  identificador: null,
  chavesUsadas: [],
  itensValidos: new Set([ITEM_A]),
  ...parcial,
});

test("sem XML, vale o que o assistente informou; sem valor a despesa entra com aviso para a equipe completar", () => {
  const completa = consolidarDespesa(informada({ tipo: "recibo", valor: 800, data: "2026-09-10", descricao: "Oficina", numero: "55", itemId: ITEM_A, fornecedorDocumento: "11.222.333/0001-81", retencoes: { iss: 10, inss: 0, irrf: 0, outras: 0 } }), null, contextoPuro());
  assert.ok(completa.ok);
  assert.deepEqual([completa.campos.tipo, completa.campos.valor_extraido, completa.campos.fornecedor_id, completa.campos.no_id, completa.campos.iss], ["recibo", 800, FORNECEDOR, ITEM_A, 10]);
  assert.deepEqual(completa.avisos, []);

  const semValor = consolidarDespesa(informada(), null, contextoPuro());
  assert.ok(semValor.ok);
  assert.equal(semValor.campos.tipo, "outro");
  assert.match(semValor.avisos[0].texto, /sem valor/);
});

test("com XML de nota, o XML manda: valor, número, chave e retenções vêm dele, e a diferença do assistente vira aviso", async () => {
  const resultado = consolidarDespesa(informada({ valor: 999, numero: "9999", tipo: "recibo" }), await nfe(), contextoPuro());
  assert.ok(resultado.ok);
  const { campos, avisos } = resultado;
  assert.deepEqual([campos.tipo, campos.valor_extraido, campos.numero_documento, campos.serie, campos.data_doc], ["nfe", 2500, "1234", "1", "2026-03-15"]);
  assert.equal(campos.chave_acesso, "35260311222333000181550010000012341123456785");
  assert.deepEqual([campos.irrf, campos.outras_retencoes], [37.5, 116.25]);
  assert.equal(campos.fornecedor_id, FORNECEDOR, "o emitente do XML é o fornecedor cadastrado");
  assert.ok(avisos.some((a) => a.nivel === "alerta" && /difere do XML/.test(a.texto)));
});

test("XML que não é nota (evento, HTML) não vira despesa", async () => {
  const evento = consolidarDespesa(informada(), `<procEventoNFe><evento><infEvento/></evento></procEventoNFe>`, contextoPuro());
  assert.ok(!evento.ok);
  assert.match(evento.erro, /evento/);
  const html = consolidarDespesa(informada(), "<html><body>oi</body></html>", contextoPuro());
  assert.ok(!html.ok);
});

test("as regras do banco viram erro claro: chave repetida, retenção maior que o valor e item que não é da prestação", async () => {
  const chave = "35260311222333000181550010000012341123456785";
  const repetida = consolidarDespesa(informada(), await nfe(), contextoPuro({ chavesUsadas: [{ chave, nome: "antiga.pdf" }] }));
  assert.ok(!repetida.ok);
  assert.match(repetida.erro, /já está na prestação/);

  const retencao = consolidarDespesa(informada({ valor: 100, retencoes: { iss: 60, inss: 50, irrf: 0, outras: 0 } }), null, contextoPuro());
  assert.ok(!retencao.ok);
  assert.match(retencao.erro, /retenções somam mais/);

  const item = consolidarDespesa(informada({ valor: 10, itemId: "5c1b0f0e-0000-4000-8000-0000000000ff" }), null, contextoPuro());
  assert.ok(!item.ok);
  assert.match(item.erro, /obter_orcamento_da_prestacao/);

  const curta = consolidarDespesa(informada({ valor: 10, chave: "123" }), null, contextoPuro());
  assert.ok(curta.ok);
  assert.equal(curta.campos.chave_acesso, null);
  assert.match(curta.avisos[0].texto, /44 ou 50/);
});

test("fornecedor que a organização não cadastrou fica sem vínculo, com aviso", () => {
  const r = consolidarDespesa(informada({ valor: 10, fornecedorDocumento: "99.888.777/0001-66" }), null, contextoPuro());
  assert.ok(r.ok);
  assert.equal(r.campos.fornecedor_id, null);
  assert.ok(r.avisos.some((a) => /não está cadastrado/.test(a.texto)));
});

test("ler a despesa do corpo aponta a posição e o campo errado", () => {
  assert.throws(() => lerDespesaInformada({}, 2), /despesas\[2\]: Informe arquivo_id/);
  assert.throws(() => lerDespesaInformada({ arquivo_id: ARQ_PDF, tipo: "cheque" }, 0), /despesas\[0\]: tipo deve ser um destes/);
  assert.throws(() => lerDespesaInformada({ arquivo_id: ARQ_PDF, valor: "muito" }, 1), /despesas\[1\]: valor deve ser um número/);
  assert.throws(() => lerDespesaInformada({ arquivo_id: "abc" }, 0), /uuid|UUID/i);
  assert.throws(() => lerDespesaInformada("texto", 0), /deve ser um objeto/);
  const ok = lerDespesaInformada({ arquivo_id: ARQ_PDF, valor: "1.234,56", retencoes: { iss: 5 } }, 0);
  assert.equal(ok.valor, 1234.56);
  assert.equal(ok.retencoes.iss, 5);
});

// ─── registrar_despesas ─────────────────────────────────────────────────────

test("a despesa do assistente nasce pendente, com canal assistente, ligada ao arquivo da caixa, e deixa trilha e aviso", async () => {
  const memoria = memoriaPadrao();
  const { consultas } = prepararComStorage({ escopo: "write" }, memoria.resolver);
  const { status, corpo } = await ler(
    await despesas({
      despesas: [{ arquivo_id: ARQ_PDF, tipo: "recibo", valor: 800, data_do_documento: "2026-09-10", descricao: "Oficina de teatro", retencoes: { iss: 40 }, item_id: ITEM_A, fornecedor_documento: "11222333000181" }],
    })
  );
  assert.equal(status, 200);
  assert.equal(corpo.registradas, 1);
  assert.match(corpo.importante, /PENDENTES/);
  const [resultado] = corpo.resultados;
  assert.equal(resultado.ok, true);
  assert.equal(resultado.url, `${ORIGEM}/prestacoes/${PRESTACAO}/comprovantes?despesa=${resultado.despesa_id}`);

  const [despesa] = memoria.linhas("prestacao_comprovantes");
  assert.equal(despesa.id, resultado.despesa_id);
  assert.equal(despesa.status, "pendente");
  assert.equal(despesa.avaliado_por, null);
  assert.equal(despesa.avaliado_em, null);
  assert.equal(despesa.canal, "assistente");
  assert.equal(despesa.enviado_por, USUARIO);
  assert.equal(despesa.origem, "nacional");
  assert.deepEqual(despesa.motivos_ia, []);
  assert.deepEqual([despesa.tipo, despesa.valor_extraido, despesa.iss, despesa.no_id, despesa.fornecedor_id], ["recibo", 800, 40, ITEM_A, FORNECEDOR]);
  assert.equal(despesa.storage_path, CAMINHO("comprovantes", "5c1b0f0e-0000-4000-8000-00000000c0c0", "pdf"));
  assert.equal(despesa.nome_arquivo, "recibo.pdf");
  assert.equal(despesa.prestacao_id, PRESTACAO);

  const arquivo = memoria.linhas("assistente_arquivos").find((l) => l.id === ARQ_PDF)!;
  assert.deepEqual([arquivo.situacao, arquivo.registro_tabela, arquivo.registro_id], ["registrado", "prestacao_comprovantes", despesa.id]);

  const [acao] = memoria.linhas("assistente_acoes");
  assert.deepEqual([acao.ferramenta, acao.acao, acao.tabela, acao.registro_id, acao.plataforma, acao.usuario_id], ["registrar_despesas", "criar", "prestacao_comprovantes", despesa.id, "claude", USUARIO]);
  assert.match(String(acao.resumo), /Oficina de teatro/);
  assert.equal(consultas.filter((c) => c.tabela === "fn_prestacao_avisar_assistente").length, 1, "um aviso por lote");
  assert.equal(consultas.filter((c) => c.tabela === "fn_mcp_prestacao_pode").length, 1, "o banco foi consultado sobre quem edita");
});

test("do XML da nota vêm os dados, e o fornecedor do emitente é ligado sozinho", async () => {
  const memoria = memoriaPadrao();
  prepararComStorage({ escopo: "write" }, memoria.resolver, await comXml());
  const { corpo } = await ler(await despesas({ despesas: [{ arquivo_id: ARQ_XML, item_id: ITEM_A }] }));
  assert.equal(corpo.registradas, 1, JSON.stringify(corpo.resultados));
  const despesa = memoria.linhas("prestacao_comprovantes")[0];
  assert.deepEqual([despesa.tipo, despesa.valor_extraido, despesa.numero_documento, despesa.data_doc], ["nfe", 2500, "1234", "2026-03-15"]);
  assert.equal(despesa.chave_acesso, "35260311222333000181550010000012341123456785");
  assert.equal(despesa.fornecedor_id, FORNECEDOR);
  assert.equal(despesa.status, "pendente");
});

test("a mesma nota duas vezes: a segunda é recusada por chave repetida e o arquivo dela continua na caixa", async () => {
  const memoria = memoriaPadrao();
  memoria.linhas("assistente_arquivos").push(caixa({ id: "5c1b0f0e-0000-4000-8000-0000000000e4", nome_arquivo: "nf-1234-de-novo.xml", tipo_real: "xml", sha256: "d".repeat(64), storage_path: CAMINHO("comprovantes", "5c1b0f0e-0000-4000-8000-00000000c0c3", "xml") }));
  prepararComStorage({ escopo: "write" }, memoria.resolver, await comXml());
  const primeira = await ler(await despesas({ despesas: [{ arquivo_id: ARQ_XML }] }));
  assert.equal(primeira.corpo.registradas, 1);
  const segunda = await ler(await despesas({ despesas: [{ arquivo_id: "5c1b0f0e-0000-4000-8000-0000000000e4" }] }));
  assert.equal(segunda.corpo.registradas, 0);
  assert.match(segunda.corpo.resultados[0].erro, /já está na prestação/);
  assert.equal(memoria.linhas("assistente_arquivos").find((l) => l.id === "5c1b0f0e-0000-4000-8000-0000000000e4")!.situacao, "recebido");
  assert.equal(memoria.linhas("prestacao_comprovantes").length, 1);
});

test("num lote, cada despesa vale por si: as boas entram, as ruins voltam com o motivo, e há uma trilha por despesa e um aviso só", async () => {
  const memoria = memoriaPadrao();
  const { consultas } = prepararComStorage({ escopo: "write" }, memoria.resolver);
  const { corpo } = await ler(
    await despesas({
      despesas: [
        { arquivo_id: ARQ_PDF, valor: 100 },
        { arquivo_id: ARQ_PDF, valor: 100 },
        { arquivo_id: "5c1b0f0e-0000-4000-8000-0000000000ee", valor: 5 },
        { arquivo_id: ARQ_FOTO, valor: 5 },
        { arquivo_id: ARQ_XML, valor: 5, item_id: "5c1b0f0e-0000-4000-8000-0000000000ff" },
      ],
    })
  );
  assert.equal(corpo.registradas, 1);
  assert.equal(corpo.com_erro, 4);
  const erros = corpo.resultados.map((r: { ok: boolean; erro?: string }) => (r.ok ? "ok" : r.erro));
  assert.equal(erros[0], "ok");
  assert.match(erros[1], /mais de uma vez/);
  assert.match(erros[2], /não encontrado/);
  assert.match(erros[3], /evidência/);
  assert.equal(memoria.linhas("prestacao_comprovantes").length, 1);
  assert.equal(memoria.linhas("assistente_acoes").length, 1);
  assert.equal(consultas.filter((c) => c.tabela === "fn_prestacao_avisar_assistente").length, 1);
});

test("arquivo que ainda não chegou, já registrado ou descartado não vira despesa", async () => {
  const memoria = memoriaPadrao();
  for (const situacao of ["aguardando", "registrado", "descartado"]) {
    memoria.linhas("assistente_arquivos").push(caixa({ id: `5c1b0f0e-0000-4000-8000-0000000000${situacao === "aguardando" ? "f1" : situacao === "registrado" ? "f2" : "f3"}`, situacao, sha256: null }));
  }
  prepararComStorage({ escopo: "write" }, memoria.resolver);
  const { corpo } = await ler(
    await despesas({ despesas: [{ arquivo_id: "5c1b0f0e-0000-4000-8000-0000000000f1" }, { arquivo_id: "5c1b0f0e-0000-4000-8000-0000000000f2" }, { arquivo_id: "5c1b0f0e-0000-4000-8000-0000000000f3" }] })
  );
  assert.equal(corpo.registradas, 0);
  assert.match(corpo.resultados[0].erro, /ainda não chegou/);
  assert.match(corpo.resultados[1].erro, /já virou despesa/);
  assert.match(corpo.resultados[2].erro, /descartado/);
});

test("pedido mal feito é recusado antes de qualquer gravação", async () => {
  const memoria = memoriaPadrao();
  prepararComStorage({ escopo: "write" }, memoria.resolver);
  assert.equal((await ler(await despesas({}))).status, 400);
  assert.equal((await ler(await despesas({ despesas: [] }))).status, 400);
  assert.equal((await ler(await despesas({ despesas: Array.from({ length: 21 }, () => ({ arquivo_id: ARQ_PDF })) }))).status, 400);
  const tipo = await ler(await despesas({ despesas: [{ arquivo_id: ARQ_PDF }, { arquivo_id: ARQ_XML, tipo: "cheque" }] }));
  assert.equal(tipo.status, 400);
  assert.match(tipo.corpo.error, /despesas\[1\]/);
  assert.equal(memoria.linhas("prestacao_comprovantes").length, 0, "nem a primeira, que estava boa, foi gravada");
});

test("quem não pode editar não registra despesa, e a prestação de outra organização é 404", async () => {
  for (const [cenario, esperado] of [
    [{ escopo: "read" as const }, 403],
    [{ escopo: "write" as const, emVigor: false }, 402],
    [{ escopo: "write" as const, papel: "leitor" }, 403],
    [{ escopo: "write" as const, podeEditarNoBanco: false }, 403],
  ] as const) {
    const memoria = memoriaPadrao();
    prepararComStorage(cenario, memoria.resolver);
    assert.equal((await ler(await despesas({ despesas: [{ arquivo_id: ARQ_PDF }] }))).status, esperado, JSON.stringify(cenario));
    assert.equal(memoria.linhas("prestacao_comprovantes").length, 0);
  }
  const memoria = memoriaPadrao();
  prepararComStorage({ escopo: "write" }, memoria.resolver);
  assert.equal((await ler(await despesas({ despesas: [{ arquivo_id: ARQ_PDF }] }, DE_OUTRA_ORG))).status, 404);
});

test("se a trilha não puder ser gravada, a despesa não fica: o banco volta ao estado de antes e o erro não vaza", async () => {
  const memoria = memoriaPadrao();
  const semTrilha: Resolvedor = (c) => (c.tabela === "assistente_acoes" && c.acao === "insert" ? { error: { message: "disco cheio abc123" } } : undefined);
  prepararComStorage({ escopo: "write" }, primeiroQueResponder(semTrilha, memoria.resolver));
  const silenciar = console.error;
  console.error = () => undefined;
  try {
    const { status, corpo } = await ler(await despesas({ despesas: [{ arquivo_id: ARQ_PDF, valor: 10 }] }));
    assert.equal(status >= 400, true);
    assert.ok(!/abc123|disco/.test(corpo.error), corpo.error);
  } finally {
    console.error = silenciar;
  }
  assert.equal(memoria.linhas("prestacao_comprovantes").length, 0, "a despesa foi desfeita");
  assert.equal(memoria.linhas("assistente_arquivos").find((l) => l.id === ARQ_PDF)!.situacao, "recebido", "o arquivo voltou a esperar");
});

// ─── registrar_evidencia ────────────────────────────────────────────────────

test("evidência por link e por arquivo: canal assistente, vínculos conferidos, trilha e aviso", async () => {
  const memoria = memoriaPadrao();
  const { consultas } = prepararComStorage({ escopo: "write" }, memoria.resolver);
  const { status, corpo } = await ler(
    await evidencias({
      evidencias: [
        { url: "https://exemplo.org/noticia", tipo: "clipping", descricao: "Matéria sobre o festival", meta_id: META, requisitos: ["divulgacao"] },
        { arquivo_id: ARQ_FOTO, descricao: "Oficina de teatro", capturada_em: "2026-09-10T14:30", latitude: -25.43, longitude: -49.27, meta_id: META },
      ],
    })
  );
  assert.equal(status, 200);
  assert.equal(corpo.registradas, 2);
  const [link, foto] = memoria.linhas("prestacao_evidencias");
  assert.deepEqual([link.canal, link.tipo, link.url, link.storage_path, link.origem_dados, link.criado_por], ["assistente", "clipping", "https://exemplo.org/noticia", null, null, USUARIO]);
  assert.deepEqual(link.requisitos, ["divulgacao"]);
  assert.deepEqual([foto.canal, foto.tipo, foto.mime_type, foto.origem_dados, foto.meta_id], ["assistente", "foto", "image/jpeg", "informado", META]);
  assert.equal(foto.storage_path, CAMINHO("evidencias", "5c1b0f0e-0000-4000-8000-00000000c0c2", "jpg"));
  assert.equal(memoria.linhas("assistente_arquivos").find((l) => l.id === ARQ_FOTO)!.situacao, "registrado");
  assert.equal(memoria.linhas("assistente_acoes").length, 2);
  assert.equal(consultas.filter((c) => c.tabela === "fn_prestacao_avisar_assistente").length, 1);
});

test("evidência recusa vínculo de outra prestação, arquivo de despesa e pedidos sem pé nem cabeça", async () => {
  const memoria = memoriaPadrao();
  prepararComStorage({ escopo: "write" }, memoria.resolver);
  const alheia = await ler(await evidencias({ evidencias: [{ url: "https://exemplo.org/a", meta_id: META_ALHEIA }] }));
  assert.equal(alheia.corpo.registradas, 0);
  assert.match(alheia.corpo.resultados[0].erro, /meta_id não é desta prestação/);
  const despesaComoEvidencia = await ler(await evidencias({ evidencias: [{ arquivo_id: ARQ_PDF }] }));
  assert.match(despesaComoEvidencia.corpo.resultados[0].erro, /registrar_despesas/);

  for (const item of [{}, { url: "https://a.org/x", arquivo_id: ARQ_FOTO }, { url: "ftp://a.org/x" }, { url: "https://a.org/x", latitude: -25 }, { url: "https://a.org/x", requisitos: ["inventado"] }, { url: "https://a.org/x", tipo: "audio" }]) {
    assert.equal((await ler(await evidencias({ evidencias: [item] }))).status, 400, JSON.stringify(item));
  }
  assert.equal((await ler(await evidencias({ evidencias: Array.from({ length: 11 }, () => ({ url: "https://a.org/x" })) }))).status, 400);
  assert.equal(memoria.linhas("prestacao_evidencias").length, 0);
});

test("evidência também exige quem pode editar", async () => {
  for (const cenario of [{ escopo: "read" as const }, { escopo: "write" as const, papel: "leitor" }, { escopo: "write" as const, podeEditarNoBanco: false }]) {
    const memoria = memoriaPadrao();
    prepararComStorage(cenario, memoria.resolver);
    assert.ok((await ler(await evidencias({ evidencias: [{ url: "https://a.org/x" }] }))).status >= 400);
    assert.equal(memoria.linhas("prestacao_evidencias").length, 0);
  }
});

// ─── Duas chamadas ao mesmo tempo ───────────────────────────────────────────

test("duas chamadas ao mesmo tempo com o mesmo arquivo criam uma despesa só: a segunda é recusada", async () => {
  const memoria = memoriaPadrao();
  prepararComStorage({ escopo: "write" }, memoria.resolver);
  const pedido1 = despesas({ despesas: [{ arquivo_id: ARQ_PDF, valor: 800, descricao: "Oficina" }] });
  const pedido2 = despesas({ despesas: [{ arquivo_id: ARQ_PDF, valor: 800, descricao: "Oficina" }] });
  const [r1, r2] = [await ler(await pedido1), await ler(await pedido2)];

  assert.equal(r1.corpo.registradas + r2.corpo.registradas, 1, "só uma venceu");
  assert.equal(memoria.linhas("prestacao_comprovantes").length, 1, "uma despesa, não duas com o mesmo arquivo");
  const perdedora = [r1, r2].find((r) => r.corpo.registradas === 0)!;
  assert.match(perdedora.corpo.resultados[0].erro, /já está sendo registrado ou já foi registrado/);
  const arquivo = memoria.linhas("assistente_arquivos").find((l) => l.id === ARQ_PDF)!;
  assert.equal(arquivo.situacao, "registrado");
  assert.equal(arquivo.registro_id, memoria.linhas("prestacao_comprovantes")[0].id);
  assert.equal(memoria.linhas("assistente_acoes").length, 1);
});

test("o mesmo vale para evidência: duas chamadas ao mesmo tempo, uma evidência", async () => {
  const memoria = memoriaPadrao();
  prepararComStorage({ escopo: "write" }, memoria.resolver);
  const p1 = evidencias({ evidencias: [{ arquivo_id: ARQ_FOTO, descricao: "Oficina de teatro" }] });
  const p2 = evidencias({ evidencias: [{ arquivo_id: ARQ_FOTO, descricao: "Oficina de teatro" }] });
  const [r1, r2] = [await ler(await p1), await ler(await p2)];
  assert.equal(r1.corpo.registradas + r2.corpo.registradas, 1);
  assert.equal(memoria.linhas("prestacao_evidencias").length, 1);
});

test("se a despesa não puder ser criada, o arquivo volta à caixa e pode ser registrado de novo", async () => {
  const memoria = memoriaPadrao();
  prepararComStorage({ escopo: "write" }, primeiroQueResponder((c) => (c.tabela === "prestacao_comprovantes" && c.acao === "insert" ? { error: { message: "violates check", code: "23514" } } : undefined), memoria.resolver));
  const { corpo } = await ler(await despesas({ despesas: [{ arquivo_id: ARQ_PDF, valor: 800, descricao: "Oficina" }] }));
  assert.equal(corpo.registradas, 0);
  assert.match(corpo.resultados[0].erro, /O banco recusou os dados da despesa/);
  const arquivo = memoria.linhas("assistente_arquivos").find((l) => l.id === ARQ_PDF)!;
  assert.deepEqual([arquivo.situacao, arquivo.registro_tabela ?? null, arquivo.registro_id ?? null], ["recebido", null, null], "o arquivo não ficou preso como registrado");
});

// ─── Ações do assistente e retirar ──────────────────────────────────────────

async function comUmaDespesa(cenario: Parameters<typeof prepararComStorage>[0] = { escopo: "write" }, extra: Resolvedor = () => undefined) {
  const memoria = memoriaPadrao();
  const preparado = prepararComStorage(cenario, primeiroQueResponder(extra, memoria.resolver));
  const { corpo } = await ler(await despesas({ despesas: [{ arquivo_id: ARQ_PDF, valor: 800, descricao: "Oficina" }] }));
  assert.equal(corpo.registradas, 1);
  const acaoId = memoria.linhas("assistente_acoes")[0].id as string;
  return { memoria, acaoId, despesaId: corpo.resultados[0].despesa_id as string, ...preparado };
}

test("a lista de ações mostra o que o assistente fez, com o id para retirar e sem dado interno", async () => {
  const { memoria } = await comUmaDespesa();
  const { status, corpo } = await ler(await acoes());
  assert.equal(status, 200);
  assert.equal(corpo.total, 1);
  const [acao] = corpo.acoes;
  assert.equal(acao.acao_id, memoria.linhas("assistente_acoes")[0].id);
  assert.equal(acao.pode_retirar, true);
  assert.equal(acao.assistente, "claude");
  assert.match(acao.o_que_fez, /Oficina/);
  assert.ok(!JSON.stringify(corpo).includes("storage"));
});

test("retirar apaga a despesa pendente que o assistente criou, tira o arquivo do Storage e deixa a trilha", async () => {
  const { memoria, acaoId, despesaId, chamadas } = await comUmaDespesa();
  const { status, corpo } = await ler(await retirar({ acao_id: acaoId }));
  assert.equal(status, 200);
  assert.deepEqual(corpo.retirado, { tabela: "prestacao_comprovantes", id: despesaId });
  assert.equal(memoria.linhas("prestacao_comprovantes").length, 0);
  assert.deepEqual(chamadas.filter((c) => c.acao === "remove").at(-1)?.argumentos, [[CAMINHO("comprovantes", "5c1b0f0e-0000-4000-8000-00000000c0c0", "pdf")]]);
  assert.equal(memoria.linhas("assistente_arquivos").find((l) => l.id === ARQ_PDF)!.situacao, "descartado");
  const criada = memoria.linhas("assistente_acoes").find((a) => a.id === acaoId)!;
  assert.ok(criada.desfeita_em && criada.desfeita_por === USUARIO);
  assert.ok(memoria.linhas("assistente_acoes").some((a) => a.acao === "retirar" && a.registro_id === despesaId));

  const depois = await ler(await acoes());
  assert.equal(depois.corpo.acoes.find((a: { acao_id: string }) => a.acao_id === acaoId).pode_retirar, false);
  assert.equal((await ler(await retirar({ acao_id: acaoId }))).status, 409, "retirar duas vezes");
});

test("retirar recusa o que a equipe já avaliou, o que foi enviado ao órgão, o que tem vínculo e o que não é do assistente", async () => {
  const sempreTravado: Resolvedor = (c) => (c.tabela === "fn_prestacao_trava_do_registro" ? { data: "vigente" } : undefined);

  const avaliada = await comUmaDespesa();
  avaliada.memoria.linhas("prestacao_comprovantes")[0].status = "aceito";
  assert.equal((await ler(await retirar({ acao_id: avaliada.acaoId }))).status, 409);
  assert.equal(avaliada.memoria.linhas("prestacao_comprovantes").length, 1);

  const enviada = await comUmaDespesa({ escopo: "write" }, sempreTravado);
  const resposta = await ler(await retirar({ acao_id: enviada.acaoId }));
  assert.equal(resposta.status, 409);
  assert.match(resposta.corpo.error, /enviado ao órgão/);
  assert.equal(enviada.memoria.linhas("prestacao_comprovantes").length, 1);

  const ligada = await comUmaDespesa();
  ligada.memoria.linhas("prestacao_pagamentos").push({ id: "5c1b0f0e-0000-4000-8000-0000000000aa", despesa_id: ligada.despesaId });
  const comPagamento = await ler(await retirar({ acao_id: ligada.acaoId }));
  assert.equal(comPagamento.status, 409);
  assert.match(comPagamento.corpo.error, /pagamento/);

  const alheia = await comUmaDespesa();
  alheia.memoria.linhas("prestacao_comprovantes")[0].canal = "equipe";
  const daEquipe = await ler(await retirar({ acao_id: alheia.acaoId }));
  assert.equal(daEquipe.status, 409);
  assert.equal(alheia.memoria.linhas("prestacao_comprovantes").length, 1, "nunca apaga o que a equipe criou");
});

test("se a equipe aceita a despesa entre a leitura e o apagamento, retirar não apaga: o apagamento repete a condição e confere", async () => {
  // O banco de verdade tem a despesa já aceita; a leitura que o retirar fez (um instante antes) ainda a via pendente.
  const { memoria, acaoId, despesaId } = await comUmaDespesa();
  memoria.linhas("prestacao_comprovantes")[0].status = "aceito";
  const leituraAntiga: Resolvedor = (c) =>
    c.tabela === "prestacao_comprovantes" && c.acao === "select" && String(c.colunas).includes("canal")
      ? { data: { id: despesaId, canal: "assistente", status: "pendente", storage_path: "x/y.pdf", nome_arquivo: "recibo.pdf", valor_extraido: 800 } }
      : undefined;
  prepararComStorage({ escopo: "write" }, primeiroQueResponder(leituraAntiga, memoria.resolver));

  const { status, corpo } = await ler(await retirar({ acao_id: acaoId }));
  assert.equal(status, 409);
  assert.match(corpo.error, /acabou de avaliar/);
  assert.equal(memoria.linhas("prestacao_comprovantes").length, 1, "a despesa aceita continua lá");
  assert.equal(memoria.linhas("assistente_acoes").find((a) => a.id === acaoId)!.desfeita_em ?? null, null, "e a ação não foi dada como retirada");
});

test("retirar só vale para ação do assistente desta prestação que criou algo; acao_id errado ou de outro tipo é recusado", async () => {
  const { memoria } = await comUmaDespesa();
  memoria.linhas("assistente_acoes").push({ id: "5c1b0f0e-0000-4000-8000-0000000000b9", prestacao_id: PRESTACAO, ferramenta: "rodar_verificacoes", acao: "verificar", plataforma: "claude", tabela: null, registro_id: null, resumo: "Rodou", desfeita_em: null, created_at: "2026-10-19T10:00:00Z" });
  assert.equal((await ler(await retirar({ acao_id: "5c1b0f0e-0000-4000-8000-0000000000b9" }))).status, 400);
  assert.equal((await ler(await retirar({ acao_id: "5c1b0f0e-0000-4000-8000-0000000000bb" }))).status, 404);
  assert.equal((await ler(await retirar({}))).status, 400);
  assert.equal((await ler(await retirar({ acao_id: "abc" }))).status, 400);
});

test("retirar também exige quem pode editar, e a trilha de outra organização não aparece", async () => {
  const { memoria, acaoId } = await comUmaDespesa();
  prepararComStorage({ escopo: "read" }, memoria.resolver);
  assert.equal((await ler(await retirar({ acao_id: acaoId }))).status, 403);
  prepararComStorage({ escopo: "write", podeEditarNoBanco: false }, memoria.resolver);
  assert.equal((await ler(await retirar({ acao_id: acaoId }))).status, 403);
  prepararComStorage({ escopo: "write" }, memoria.resolver);
  assert.equal((await ler(await retirar({ acao_id: acaoId }, DE_OUTRA_ORG))).status, 404);
  assert.equal((await ler(await acoes(DE_OUTRA_ORG))).status, 404);
  assert.equal(memoria.linhas("prestacao_comprovantes").length, 1);
});

// ─── A equipe retira pelo app ───────────────────────────────────────────────

const PESSOA_DA_EQUIPE = "5c1b0f0e-0000-4000-8000-0000000000f9";
const sessaoDaEquipe = (parcial: Partial<SessaoDaEquipe> = {}): SessaoDaEquipe => ({ userId: PESSOA_DA_EQUIPE, enxerga: async () => true, podeEditar: async () => true, ...parcial });
const retirarPelaEquipeAcao = (acaoId: string, sessao: SessaoDaEquipe = sessaoDaEquipe(), prestacaoId: string = PRESTACAO) =>
  retirarPelaEquipe({ sessao, admin: dependenciasDaRota.criarAdmin(), prestacaoId, acaoId });

test("a equipe retira pelo app a despesa do assistente: mesma retirada do conector, com a trilha em nome de quem retirou", async () => {
  const { memoria, acaoId, despesaId } = await comUmaDespesa();
  const { retirado, resumo } = await retirarPelaEquipeAcao(acaoId);
  assert.deepEqual(retirado, { tabela: "prestacao_comprovantes", id: despesaId });
  assert.match(resumo, /Retirou a despesa/);
  assert.equal(memoria.linhas("prestacao_comprovantes").length, 0);

  const criada = memoria.linhas("assistente_acoes").find((a) => a.id === acaoId)!;
  assert.ok(criada.desfeita_em);
  assert.equal(criada.desfeita_por, PESSOA_DA_EQUIPE);
  const trilha = memoria.linhas("assistente_acoes").find((a) => a.acao === "retirar")!;
  assert.equal(trilha.ferramenta, "retirada_pela_equipe");
  assert.equal(trilha.usuario_id, PESSOA_DA_EQUIPE);
  assert.equal(trilha.chave_id, null);
  assert.equal(memoria.linhas("assistente_arquivos").find((l) => l.id === ARQ_PDF)!.situacao, "descartado");
});

test("a equipe só retira o que a prestação dela permite: sem ver é 404, sem editar é 403, e nada é apagado", async () => {
  const { memoria, acaoId } = await comUmaDespesa();
  await assert.rejects(retirarPelaEquipeAcao(acaoId, sessaoDaEquipe({ enxerga: async () => false })), { status: 404 });
  await assert.rejects(retirarPelaEquipeAcao(acaoId, sessaoDaEquipe({ podeEditar: async () => false })), { status: 403 });
  assert.equal(memoria.linhas("prestacao_comprovantes").length, 1);
  assert.equal(memoria.linhas("assistente_acoes").find((a) => a.id === acaoId)!.desfeita_em ?? null, null);
});

test("as conferências da retirada valem também para a equipe: avaliada, já retirada e ação que não existe", async () => {
  const avaliada = await comUmaDespesa();
  avaliada.memoria.linhas("prestacao_comprovantes")[0].status = "aceito";
  await assert.rejects(retirarPelaEquipeAcao(avaliada.acaoId), { status: 409 });
  assert.equal(avaliada.memoria.linhas("prestacao_comprovantes").length, 1);

  const { acaoId } = await comUmaDespesa();
  await retirarPelaEquipeAcao(acaoId);
  await assert.rejects(retirarPelaEquipeAcao(acaoId), { status: 409, message: "Esta ação já foi retirada." });
  await assert.rejects(retirarPelaEquipeAcao("5c1b0f0e-0000-4000-8000-0000000000bb"), { status: 404, message: "Esta ação não existe mais." });
});
