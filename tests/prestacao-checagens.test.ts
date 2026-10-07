import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CATALOGO_CHECAGENS,
  ENTIDADES,
  executarChecagens,
  fonteDaChecagem,
  pendenciasPorSeveridade,
  RESULTADOS,
  SEVERIDADES,
  STATUS_VERIFICACAO,
  type DespesaDoEstado,
  type EstadoDaPrestacao,
} from "../lib/prestacao/checagens";
import { regimePorCodigo } from "../lib/prestacao/regimes";
import type { PrestacaoFornecedor } from "../lib/supabase/types";

const MIGRATION = "supabase/migrations/20261006200000_prestacao_verificacoes.sql";
// A P3.1 e a P3.2 trocaram a regra dos tipos de entidade: meta, local, atividade e evidência entraram.
const MIGRATION_ENTIDADES = "supabase/migrations/20261007140000_prestacao_evidencias.sql";

const fornecedor: PrestacaoFornecedor = {
  id: "f1", organization_id: "o1", tipo_pessoa: "pj", documento: "11222333000181", nome: null,
  parte_relacionada: false, tipo_relacao: null, grupo_economico: null, observacoes: null,
  razao_social: "PRODUTORA EXEMPLO LTDA", nome_fantasia: null, situacao_cadastral: "ATIVA", data_situacao: "2019-03-11",
  data_abertura: "2019-03-11", cnae_principal: "9001-9/01", cnae_descricao: "Produção teatral",
  cnaes_secundarios: [], natureza_juridica: null, porte: "ME", opcao_mei: false,
  uf: "SP", municipio: "SAO PAULO", socios: [], cnpj_consultado_em: "2026-10-01T12:00:00Z", cnpj_erro: null,
  sancoes: [], sancoes_situacao: "nada_consta", sancoes_consultadas_em: "2026-10-01T12:00:00Z",
  criado_por: null, created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z",
};

const despesa = (campos: Partial<DespesaDoEstado> & Pick<DespesaDoEstado, "id">): DespesaDoEstado => ({
  nome_arquivo: `${campos.id}.pdf`, status: "pendente", no_id: "som", tipo: "nfse", data_doc: "2026-10-02", valor_extraido: 1000,
  fornecedor_id: "f1", numero_documento: "1", chave_acesso: null, iss: 0, inss: 0, irrf: 0, outras_retencoes: 0,
  identificacao_projeto: "presente", justificativa: null, valor_liquido: null, ...campos,
});

const base: EstadoDaPrestacao = {
  regime: null,
  despesas: [],
  fornecedores: [fornecedor],
  documentosDosFornecedores: [
    { fornecedor_id: "f1", tipo: "certidao_tcu", created_at: "2026-10-01T12:00:00Z" },
    { fornecedor_id: "f1", tipo: "cartao_cnpj", created_at: "2026-10-01T12:00:00Z" },
  ],
  itens: [{ id: "som", nome: "Som", cnaes: ["90"], cnaesDe: null }],
  pagamentos: [],
  lancamentos: [],
  hoje: new Date("2026-10-05T12:00:00Z"),
};

const lancamento = (id: string, valor: number, campos: Record<string, unknown> = {}) => ({
  id, data: "2026-10-03", natureza: "debito" as const, valor, historico: `PIX ${id}`, numero_documento: null, numero_normalizado: null, categoria: "pagamento", ...campos,
});

test("despesa: cada alerta vira um achado com chave estável, e a justificativa da despesa vale só para o que pede texto", () => {
  const estado: EstadoDaPrestacao = {
    ...base,
    despesas: [
      despesa({ id: "d1", tipo: "recibo", no_id: null, justificativa: "  Dispensa legal anexada.  " }),
      despesa({ id: "d2", status: "rejeitado", no_id: null }),
      despesa({ id: "d3", tipo: "foto", no_id: null }),
    ],
    pagamentos: [{ id: "p1", despesa_id: "d1", forma: "saque", data: "2026-10-01", valor: 1000, favorecido_documento: null, numero_documento: null, lancamento_id: null }],
  };
  const achados = executarChecagens(estado);
  assert.ok(achados.every(a => a.entidade.id === "d1" || a.entidade.tipo !== "despesa"), "recusada e documento complementar ficam de fora");

  const porCodigo = Object.fromEntries(achados.map(a => [a.codigo, a]));
  assert.equal(porCodigo.DESPESA_SEM_ITEM.resultado, "nao_calculavel");
  assert.equal(porCodigo.DESPESA_SEM_ITEM.chave, "DESPESA_SEM_ITEM:despesa:d1");
  assert.equal(porCodigo.DOC_PJ_SEM_NF.severidade, "alerta");
  assert.equal(porCodigo.DOC_PJ_SEM_NF.justificativa, "Dispensa legal anexada.");
  assert.equal(porCodigo.PAGAMENTO_ANTECIPADO.chave, "PAGAMENTO_ANTECIPADO:despesa:d1:p1", "um achado por pagamento");
  assert.equal(porCodigo.PAGAMENTO_MEIO.chave, "PAGAMENTO_MEIO:despesa:d1:saque");
  assert.equal(porCodigo.PAGAMENTO_SEM_NUMERO.severidade, "info");
  assert.equal(porCodigo.PAGAMENTO_SEM_NUMERO.justificativa, null, "aviso de info não leva justificativa");
  assert.equal(porCodigo.EXTRATO_AUSENTE.entidade.tipo, "prestacao", "pagamento sem extrato nenhum vira um achado só");

  assert.deepEqual(executarChecagens(estado).map(a => a.chave), achados.map(a => a.chave), "mesmo estado, mesmas chaves");
  assert.equal(new Set(achados.map(a => a.chave)).size, achados.length, "chaves únicas");
});

test("CNAE: item sem CNAEs definidos é não calculável; CNAE fora dos aceitos é revisar", () => {
  const semCnaes = executarChecagens({ ...base, itens: [{ id: "som", nome: "Som", cnaes: [], cnaesDe: null }], despesas: [despesa({ id: "d1" })] });
  assert.equal(semCnaes.find(a => a.codigo === "FORNECEDOR_CNAE")?.resultado, "nao_calculavel");
  const fora = executarChecagens({ ...base, itens: [{ id: "som", nome: "Som", cnaes: ["5510801"], cnaesDe: null }], despesas: [despesa({ id: "d1" })] });
  const cnae = fora.find(a => a.codigo === "FORNECEDOR_CNAE");
  assert.equal(cnae?.resultado, "revisar");
  assert.equal(cnae?.severidade, "alerta");
});

test("conciliação: débito sem despesa bloqueia, parcial diz quanto falta, tarifa não espera despesa", () => {
  const estado: EstadoDaPrestacao = {
    ...base,
    despesas: [despesa({ id: "d1", valor_extraido: 1500 })],
    lancamentos: [
      lancamento("l1", 1000),
      lancamento("l2", 500),
      lancamento("l3", 12.5, { categoria: "tarifa", historico: "TARIFA" }),
      lancamento("l4", 300),
      lancamento("l5", 50, { natureza: "credito", categoria: "aporte" }),
    ],
    pagamentos: [
      { id: "p1", despesa_id: "d1", forma: "pix", data: "2026-10-03", valor: 200, favorecido_documento: null, numero_documento: "1", lancamento_id: "l2" },
      { id: "p2", despesa_id: "d1", forma: "pix", data: "2026-10-03", valor: 400, favorecido_documento: null, numero_documento: "2", lancamento_id: "l4" },
      { id: "p3", despesa_id: "d1", forma: "pix", data: "2026-10-04", valor: 900, favorecido_documento: null, numero_documento: "3", lancamento_id: null },
    ],
  };
  const conciliacao = executarChecagens(estado).filter(a => ["DEBITO_SEM_COMPROVANTE", "LANCAMENTO_EXCEDIDO", "PAGAMENTO_SEM_LANCAMENTO", "EXTRATO_AUSENTE"].includes(a.codigo));
  assert.deepEqual(conciliacao.map(a => [a.codigo, a.entidade.id, a.severidade]), [
    ["DEBITO_SEM_COMPROVANTE", "l1", "bloqueio"],
    ["DEBITO_SEM_COMPROVANTE", "l2", "bloqueio"],
    ["LANCAMENTO_EXCEDIDO", "l4", "alerta"],
    ["PAGAMENTO_SEM_LANCAMENTO", "p3", "alerta"],
  ]);
  assert.match(conciliacao[1].mensagem, /R\$\s200,00 ligados a despesas, faltam R\$\s300,00/);
  assert.equal(conciliacao[0].chave, conciliacao[0].chave.replace(/#\d+$/, ""), "parcial e pendente usam a mesma chave do lançamento");
  assert.equal(conciliacao[0].chave, "DEBITO_SEM_COMPROVANTE:lancamento:l1");
});

test("fonte: vem da regra do regime da prestação, ou da dimensão; sem regime, nenhuma", () => {
  const rouanet = regimePorCodigo("rouanet_in29_2026");
  assert.ok(rouanet);
  assert.match(fonteDaChecagem(rouanet, "PAGAMENTO_SEM_NUMERO")?.dispositivo ?? "", /29/);
  assert.equal(fonteDaChecagem(rouanet, "PAGAMENTO_SEM_NUMERO")?.regra?.codigo, "numero_do_pagamento");
  assert.equal(fonteDaChecagem(rouanet, "DEBITO_SEM_COMPROVANTE")?.regra?.codigo, "documento_anexo");
  assert.equal(fonteDaChecagem(rouanet, "PAGAMENTO_MEIO")?.regra?.codigo, "saque_cheque_cartao");
  assert.equal(fonteDaChecagem(null, "PAGAMENTO_MEIO"), null);
  const comRegime = executarChecagens({ ...base, regime: rouanet, despesas: [despesa({ id: "d1" })], lancamentos: [lancamento("l1", 10)] });
  assert.ok(comRegime.find(a => a.codigo === "DEBITO_SEM_COMPROVANTE")?.fonte?.documento);
});

test("pendências: abertas por severidade, sem info nem as decididas", () => {
  assert.deepEqual(pendenciasPorSeveridade([
    { severidade: "bloqueio", status: "aberta" },
    { severidade: "alerta", status: "aberta" },
    { severidade: "alerta", status: "justificada" },
    { severidade: "info", status: "aberta" },
    { severidade: "justificativa", status: "dispensada" },
  ]), { bloqueio: 1, alerta: 1, justificativa: 0 });
});

test("contrato: catálogo cobre o que as checagens emitem, e o banco aceita os mesmos valores", async () => {
  const estado: EstadoDaPrestacao = {
    ...base,
    despesas: [
      despesa({ id: "d1", tipo: "recibo", no_id: null, fornecedor_id: null, valor_extraido: null }),
      despesa({ id: "d2", chave_acesso: "123", identificacao_projeto: "ausente" }),
    ],
    fornecedores: [{ ...fornecedor, situacao_cadastral: "BAIXADA", sancoes_situacao: "consta", cnpj_consultado_em: "2020-01-01T00:00:00Z" }],
    pagamentos: [{ id: "p1", despesa_id: "d2", forma: "pix", data: "2026-10-03", valor: 2000, favorecido_documento: "99999999000191", numero_documento: null, lancamento_id: null }],
    lancamentos: [lancamento("l1", 10)],
  };
  for (const a of executarChecagens(estado)) {
    assert.ok(a.codigo in CATALOGO_CHECAGENS, `${a.codigo} no catálogo`);
  }

  const sql = await readFile(MIGRATION, "utf8");
  const lista = (nome: string) => {
    const m = sql.match(new RegExp(`${nome} text not null[^\\n]*check \\(${nome} in \\(([^)]*)\\)\\)`));
    assert.ok(m, `check de ${nome} na migration`);
    return m[1].split(",").map(v => v.trim().replace(/'/g, ""));
  };
  assert.deepEqual(lista("severidade"), [...SEVERIDADES]);
  assert.deepEqual(lista("resultado"), [...RESULTADOS]);
  const entidades = (await readFile(MIGRATION_ENTIDADES, "utf8")).match(/check \(entidade_tipo in \(([^)]*)\)\)/);
  assert.ok(entidades, "check de entidade_tipo na migration da P3.2");
  assert.deepEqual(entidades[1].split(",").map(v => v.trim().replace(/'/g, "")), [...ENTIDADES]);
  assert.deepEqual(lista("status"), [...STATUS_VERIFICACAO]);
});
