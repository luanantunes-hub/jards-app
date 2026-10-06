import assert from "node:assert/strict";
import test from "node:test";
import {
  CATALOGO_CHECAGENS,
  captadoDoExtrato,
  destinoDaChecagem,
  executarChecagens,
  type Achado,
  type DespesaDoEstado,
  type EstadoDaPrestacao,
} from "../lib/prestacao/checagens";
import type { NoOrcamento } from "../lib/prestacao/orcamento";
import { GENERICO, regimePorCodigo } from "../lib/prestacao/regimes";
import type { PrestacaoFornecedor } from "../lib/supabase/types";

const ROUANET = regimePorCodigo("rouanet_in29_2026")!;

const fornecedor = (id: string, documento: string, campos: Partial<PrestacaoFornecedor> = {}): PrestacaoFornecedor => ({
  id, organization_id: "o1", tipo_pessoa: "pj", documento, nome: null,
  parte_relacionada: false, tipo_relacao: null, grupo_economico: null, observacoes: null,
  razao_social: `FORNECEDOR ${id.toUpperCase()}`, nome_fantasia: null, situacao_cadastral: "ATIVA", data_situacao: null,
  data_abertura: null, cnae_principal: null, cnae_descricao: null, cnaes_secundarios: [], natureza_juridica: null, porte: null, opcao_mei: false,
  uf: null, municipio: null, socios: [], cnpj_consultado_em: "2026-10-01T12:00:00Z", cnpj_erro: null,
  sancoes: [], sancoes_situacao: "nada_consta", sancoes_consultadas_em: "2026-10-01T12:00:00Z",
  criado_por: null, created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z", ...campos,
});

const no = (id: string, nome: string, valor_total: number, grupo_custo: string): NoOrcamento => ({
  id, nome, versao_id: "v1", parent_id: null, tipo: "item", codigo: null, descricao: null, uf: null, municipio: null,
  grupo_custo, unidade: null, quantidade: null, ocorrencias: null, valor_unitario: null, valor_total, valor_remanejado: 0, ordem: 0,
});

const despesa = (id: string, campos: Partial<DespesaDoEstado>): DespesaDoEstado => ({
  id, nome_arquivo: `${id}.pdf`, status: "pendente", no_id: "som", tipo: "nfse", data_doc: "2026-03-01", valor_extraido: 1000,
  fornecedor_id: "f1", numero_documento: "1", chave_acesso: null, iss: 0, inss: 0, irrf: 0, outras_retencoes: 0,
  identificacao_projeto: "presente", justificativa: null, valor_liquido: null, ...campos,
});

const lancamento = (id: string, valor: number, campos: Record<string, unknown> = {}) => ({
  id, data: "2026-03-05", natureza: "debito" as const, valor, historico: `TED ${id}`, numero_documento: null, numero_normalizado: null, categoria: "pagamento", ...campos,
});

const ESTADO: EstadoDaPrestacao = {
  regime: ROUANET,
  prestacao: { data_aprovacao: "2026-02-01", data_liberacao: "2026-03-01", data_inicio_execucao: "2026-03-01", data_fim_execucao: "2026-11-30" },
  despesas: [
    despesa("d1", { no_id: "som", valor_extraido: 1500, data_doc: "2026-01-10" }),
    despesa("d2", { no_id: "adm", valor_extraido: 1500, data_doc: "2026-03-01" }),
    despesa("d3", { no_id: "adm", valor_extraido: 2500, data_doc: "2026-12-31", fornecedor_id: "f2", justificativa: "Nota emitida no fechamento, serviço prestado em novembro." }),
    despesa("d4", { no_id: "som", valor_extraido: 9000, status: "rejeitado", data_doc: "2025-01-01" }),
  ],
  fornecedores: [fornecedor("f1", "11222333000181"), fornecedor("f2", "44555666000199", { parte_relacionada: true, tipo_relacao: "dirigente" })],
  documentosDosFornecedores: [],
  itens: [{ id: "som", nome: "Som", cnaes: [], cnaesDe: null }, { id: "adm", nome: "Coordenação administrativa", cnaes: [], cnaesDe: null }],
  nos: [no("som", "Som", 1000, "execucao"), no("adm", "Coordenação administrativa", 50000, "administracao")],
  pagamentos: [
    { id: "p1", despesa_id: "d2", forma: "ted", data: "2026-02-15", valor: 1500, favorecido_documento: null, numero_documento: "999", lancamento_id: "l1" },
  ],
  lancamentos: [
    lancamento("ap", 10000, { natureza: "credito", categoria: "aporte", historico: "APORTE" }),
    lancamento("l1", 1500, { numero_documento: "000123", numero_normalizado: "123" }),
  ],
  alteracoes: [{ id: "a1", numero: 1, status: "solicitada", solicitada_em: "2026-09-01" }, { id: "a2", numero: 2, status: "aprovada", solicitada_em: "2026-08-01" }],
  hoje: new Date("2026-10-05T12:00:00Z"),
};

const de = (achados: Achado[], codigo: string) => achados.filter(a => a.codigo === codigo);

test("período: documento fora da aprovação ao fim da execução e pagamento antes da liberação, com a severidade do regime", () => {
  const achados = executarChecagens(ESTADO);
  const fora = de(achados, "DOC_FORA_VIGENCIA");
  assert.deepEqual(fora.map(a => [a.entidade.id, a.chave.split(":").at(-1), a.severidade]), [["d1", "antes", "alerta"], ["d3", "depois", "alerta"]], "a recusada fica de fora");
  assert.match(fora[0].mensagem, /antes da aprovação \(01\/02\/2026\)/);
  assert.equal(fora[0].fonte?.regra?.codigo, "data_de_emissao");
  assert.equal(fora[1].justificativa, "Nota emitida no fechamento, serviço prestado em novembro.", "a justificativa da despesa vale");

  const liberacao = de(achados, "LIBERACAO_MINIMA");
  assert.deepEqual(liberacao.map(a => [a.entidade.id, a.severidade]), [["p1", "justificativa"]]);
  assert.match(liberacao[0].mensagem, /antes da liberação dos recursos \(01\/03\/2026\)/);
  assert.match(liberacao[0].fonte?.dispositivo ?? "", /art\. 56/);
});

test("conciliação: número do pagamento diferente do extrato, sem pontos e zeros à esquerda", () => {
  const numero = de(executarChecagens(ESTADO), "NUMERO_PAGAMENTO_DIVERGENTE");
  assert.equal(numero.length, 1);
  assert.equal(numero[0].severidade, "alerta", "a Rouanet trata como alerta (Módulo II)");
  assert.match(numero[0].mensagem, /número 999, e o débito do extrato, 123/);
  const igual = executarChecagens({ ...ESTADO, pagamentos: [{ ...ESTADO.pagamentos[0], numero_documento: "0.123" }] });
  assert.equal(de(igual, "NUMERO_PAGAMENTO_DIVERGENTE").length, 0);
});

test("orçamento: despesas acima do vigente do item, teto do grupo e alteração sem decisão", () => {
  const achados = executarChecagens(ESTADO);
  const saldo = de(achados, "ITEM_SEM_SALDO");
  assert.deepEqual(saldo.map(a => [a.chave, a.severidade]), [["ITEM_SEM_SALDO:prestacao:-:som", "bloqueio"]], "a recusada não soma");
  assert.match(saldo[0].mensagem, /"Som" somam R\$\s1\.500,00, acima do vigente \(R\$\s1\.000,00\)/);

  const teto = de(achados, "TETO_GRUPO_CUSTO");
  assert.ok(teto.some(a => a.chave.endsWith(":administracao")), "administração acima do teto da Rouanet");
  assert.ok(teto.every(a => a.fonte?.documento), "com a fonte do teto");

  const alteracao = de(achados, "ALTERACAO_PENDENTE");
  assert.deepEqual(alteracao.map(a => [a.chave, a.severidade]), [["ALTERACAO_PENDENTE:prestacao:-:a1", "bloqueio"]], "só a pedida, sem decisão");
  assert.equal(destinoDaChecagem("ALTERACAO_PENDENTE"), "orcamento");
});

test("concentração: fornecedor e partes relacionadas acima de 20% do captado pelos aportes do extrato", () => {
  assert.equal(captadoDoExtrato(ESTADO), 1_000_000, "R$ 10.000,00 em centavos");
  const achados = executarChecagens(ESTADO);
  const porFornecedor = de(achados, "FORNECEDOR_CONCENTRACAO");
  assert.deepEqual(porFornecedor.map(a => [a.chave.split(":").slice(-2).join(":"), a.severidade, a.dados.percentual]), [
    ["raiz:11222333", "bloqueio", 30],
    ["raiz:44555666", "bloqueio", 25],
  ]);
  assert.match(porFornecedor[0].mensagem, /30% do valor captado \(R\$\s10\.000,00\); o limite é 20%/);
  assert.match(porFornecedor[0].mensagem, /exceção da norma/);
  const partes = de(achados, "PROPONENTE_PARTES_RELACIONADAS");
  assert.deepEqual(partes.map(a => [a.severidade, a.dados.percentual]), [["bloqueio", 25]]);

  // Mesmo grupo econômico soma junto; abaixo do limite, nada.
  const grupo = executarChecagens({
    ...ESTADO,
    fornecedores: [fornecedor("f1", "11222333000181", { grupo_economico: "Grupo Som" }), fornecedor("f2", "44555666000199", { grupo_economico: "Grupo Som" })],
  });
  assert.deepEqual(de(grupo, "FORNECEDOR_CONCENTRACAO").map(a => [a.chave.split(":").slice(-2).join(":"), a.dados.percentual]), [["grupo:grupo som", 55]]);
  const abaixo = executarChecagens({ ...ESTADO, lancamentos: [lancamento("ap", 100000, { natureza: "credito", categoria: "aporte" })] });
  assert.equal(de(abaixo, "FORNECEDOR_CONCENTRACAO").length + de(abaixo, "PROPONENTE_PARTES_RELACIONADAS").length, 0);
});

test("sem dado: limite sem captado e prestação sem datas viram não calculável", () => {
  const semCaptado = executarChecagens({ ...ESTADO, lancamentos: [lancamento("l1", 1500, { numero_normalizado: "123" })] });
  const semBase = de(semCaptado, "LIMITE_SEM_BASE");
  assert.deepEqual(semBase.map(a => [a.chave.split(":").at(-1), a.resultado, a.severidade]), [["fornecedor", "nao_calculavel", "info"], ["proponente", "nao_calculavel", "info"]]);
  assert.match(semBase[0].mensagem, /Importe o extrato da conta de captação/);

  const semDatas = executarChecagens({ ...ESTADO, prestacao: {} });
  assert.deepEqual(de(semDatas, "DATAS_DA_PRESTACAO").map(a => a.chave.split(":").at(-1)), ["periodo", "liberacao"]);
  assert.equal(de(semDatas, "DOC_FORA_VIGENCIA").length + de(semDatas, "LIBERACAO_MINIMA").length, 0);
});

test("regime genérico: sem limites nem liberação, e o período só avisa", () => {
  const achados = executarChecagens({ ...ESTADO, regime: GENERICO });
  assert.equal(de(achados, "FORNECEDOR_CONCENTRACAO").length + de(achados, "PROPONENTE_PARTES_RELACIONADAS").length + de(achados, "LIMITE_SEM_BASE").length, 0);
  assert.equal(de(achados, "LIBERACAO_MINIMA").length, 0);
  assert.ok(de(achados, "DOC_FORA_VIGENCIA").every(a => a.severidade === "info"));
  assert.ok(de(achados, "ALTERACAO_PENDENTE").every(a => a.severidade === "info"));
  assert.equal(de(achados, "ITEM_SEM_SALDO").length, 1, "item sem saldo vale para todo regime");
});

test("contrato: todo código emitido está no catálogo, com destino, e as chaves são únicas", () => {
  for (const estado of [ESTADO, { ...ESTADO, regime: GENERICO }, { ...ESTADO, prestacao: {}, lancamentos: [] }]) {
    const achados = executarChecagens(estado);
    for (const a of achados) {
      assert.ok(a.codigo in CATALOGO_CHECAGENS, a.codigo);
      assert.ok(destinoDaChecagem(a.codigo));
    }
    assert.equal(new Set(achados.map(a => a.chave)).size, achados.length);
  }
});
