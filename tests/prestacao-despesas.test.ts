import assert from "node:assert/strict";
import test from "node:test";
import {
  alertasDaDespesa,
  ehDespesa,
  faltaJustificativa,
  lerChaveAcesso,
  limparChave,
  totalRetido,
  valorLiquido,
  type DespesaParaChecar,
} from "../lib/prestacao/despesas";
import type { PrestacaoFornecedor } from "../lib/supabase/types";

// Chave de exemplo do Manual de Orientação do Contribuinte da NF-e.
const CHAVE_MANUAL = "52060433009911002506550120000007800267301615";

/** Dígito pelo algoritmo do manual, escrito à parte para conferir a lib. */
function digito(base: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += (base.charCodeAt(i) - 48) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function chaveCom(emitente: string, aamm: string, numero: string): string {
  const base = `35${aamm}${emitente}55001${numero.padStart(9, "0")}1${"12345678"}`;
  return base + digito(base);
}

const fornecedor: PrestacaoFornecedor = {
  id: "f1", organization_id: "o1", tipo_pessoa: "pj", documento: "11222333000181", nome: null,
  parte_relacionada: false, tipo_relacao: null, grupo_economico: null, observacoes: null,
  razao_social: "PRODUTORA EXEMPLO LTDA", nome_fantasia: null, situacao_cadastral: "ATIVA", data_situacao: "2019-03-11",
  data_abertura: "2019-03-11", cnae_principal: "9001-9/01", cnae_descricao: "Produção teatral",
  cnaes_secundarios: [{ codigo: "7420-0/01", descricao: "Fotografia" }], natureza_juridica: null, porte: "ME", opcao_mei: false,
  uf: "SP", municipio: "SAO PAULO", socios: [], cnpj_consultado_em: "2026-10-01T12:00:00Z", cnpj_erro: null,
  sancoes: [], sancoes_situacao: "nada_consta", sancoes_consultadas_em: "2026-10-01T12:00:00Z",
  criado_por: null, created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z",
};

const despesa: DespesaParaChecar = {
  tipo: "nfe", data_doc: "2026-10-02", valor_extraido: 1000, fornecedor_id: "f1", numero_documento: "123",
  chave_acesso: chaveCom("11222333000181", "2610", "123"), iss: 0, inss: 0, irrf: 0, outras_retencoes: 0, identificacao_projeto: "presente",
};

const documentos = [
  { tipo: "certidao_tcu" as const, created_at: "2026-10-01T12:00:00Z" },
  { tipo: "cartao_cnpj" as const, created_at: "2026-10-01T12:00:00Z" },
];
const item = { nome: "Cachê de ator", cnaes: ["90"], origem: { nome: "Produção" } };
const hoje = new Date("2026-10-05T12:00:00Z");
const codigos = (a: { codigo: string }[]) => a.map(x => x.codigo);

test("chave de acesso: dígito, emitente, data, série e número; NFS-e nacional pelas posições", () => {
  assert.deepEqual(lerChaveAcesso(CHAVE_MANUAL), {
    ok: true, familia: "nfe", modelo: "55", uf: "52", anoMes: "2006-04", emitente: "33009911002506", serie: "012", numero: "000000780",
  });
  assert.equal(lerChaveAcesso(`${CHAVE_MANUAL.slice(0, 43)}4`)?.ok, false, "dígito trocado");
  assert.equal(lerChaveAcesso(""), null);
  assert.match((lerChaveAcesso("123") as { motivo: string }).motivo, /44.*50/);
  assert.equal(limparChave("5206 0433.0099-1100"), "5206043300991100");

  // CNPJ alfanumérico do exemplo da Receita na posição do emitente.
  const alfa = chaveCom("12ABC34501DE35", "2608", "9");
  assert.deepEqual(lerChaveAcesso(alfa), { ok: true, familia: "nfe", modelo: "55", uf: "35", anoMes: "2026-08", emitente: "12ABC34501DE35", serie: "001", numero: "000000009" });

  const nfse = `3550308${"1"}${"2"}${"11222333000181"}${"0000000000042"}${"2610"}${"123456789"}${"7"}`;
  assert.deepEqual(lerChaveAcesso(nfse), { ok: true, familia: "nfse", municipio: "3550308", anoMes: "2026-10", emitente: "11222333000181", numero: "0000000000042" });
});

test("valores: líquido é o bruto menos as retenções", () => {
  const v = { valor_extraido: 1000, iss: 50, inss: 110, irrf: 15, outras_retencoes: 0 };
  assert.equal(totalRetido(v), 175);
  assert.equal(valorLiquido(v), 825);
  assert.equal(valorLiquido({ ...v, valor_extraido: null }), null);
  assert.ok(ehDespesa("nfse"));
  assert.ok(!ehDespesa("foto"));
});

test("despesa completa e coerente: nenhum alerta", () => {
  assert.deepEqual(alertasDaDespesa({ despesa, fornecedor, documentosDoFornecedor: documentos, item, hoje }), []);
  assert.deepEqual(alertasDaDespesa({ despesa: { ...despesa, tipo: "foto" }, fornecedor: null, item: null }), [], "documento complementar não é despesa");
});

test("CNAE do fornecedor contra os aceitos pelo item, com principal e secundários", () => {
  const fora = alertasDaDespesa({ despesa, fornecedor, documentosDoFornecedor: documentos, item: { nome: "Hospedagem", cnaes: ["5510801"], origem: null }, hoje });
  assert.deepEqual(codigos(fora), ["FORNECEDOR_CNAE"]);
  assert.equal(fora[0].nivel, "alerta");
  assert.match(fora[0].texto, /9001-9\/01, 7420-0\/01.*"Hospedagem": 5510-8\/01/);

  const peloSecundario = alertasDaDespesa({ despesa, fornecedor, documentosDoFornecedor: documentos, item: { nome: "Fotógrafo", cnaes: ["742"], origem: null }, hoje });
  assert.deepEqual(peloSecundario, [], "o CNAE secundário também vale");

  const semCnaes = alertasDaDespesa({ despesa, fornecedor, documentosDoFornecedor: documentos, item: { nome: "Seguro", cnaes: [], origem: null }, hoje });
  assert.deepEqual(semCnaes.map(a => [a.codigo, a.nivel]), [["FORNECEDOR_CNAE", "info"]]);

  const herdado = alertasDaDespesa({ despesa, fornecedor, documentosDoFornecedor: documentos, item: { nome: "Ator", cnaes: ["56"], origem: { nome: "Alimentação" } }, hoje });
  assert.match(herdado[0].texto, /definidos em "Alimentação"/);
});

test("fornecedor: sem cadastro, situação, sanção, cartão CNPJ e certidão perto da data", () => {
  assert.deepEqual(codigos(alertasDaDespesa({ despesa: { ...despesa, fornecedor_id: null, chave_acesso: null }, fornecedor: null, item, hoje })), ["DESPESA_SEM_FORNECEDOR"]);
  assert.deepEqual(alertasDaDespesa({ despesa: { ...despesa, tipo: "guia_tributo", chave_acesso: null }, fornecedor: null, item, hoje }), [], "guia de tributo não tem fornecedor");

  const baixado = alertasDaDespesa({ despesa, fornecedor: { ...fornecedor, situacao_cadastral: "BAIXADA", sancoes_situacao: "consta" }, documentosDoFornecedor: documentos, item, hoje });
  assert.deepEqual(codigos(baixado), ["FORNECEDOR_SITUACAO", "FORNECEDOR_SANCIONADO"]);

  assert.deepEqual(codigos(alertasDaDespesa({ despesa, fornecedor, documentosDoFornecedor: [documentos[0]], item, hoje })), ["FORNECEDOR_SEM_CARTAO_CNPJ"]);

  const semCertidao = alertasDaDespesa({ despesa, fornecedor, documentosDoFornecedor: [documentos[1]], item, hoje });
  assert.deepEqual(semCertidao.map(a => [a.codigo, a.nivel]), [["FORNECEDOR_CERTIDAO_DA_DATA", "alerta"]]);
  const antiga = alertasDaDespesa({ despesa: { ...despesa, data_doc: "2026-06-01", chave_acesso: chaveCom("11222333000181", "2606", "123") }, fornecedor, documentosDoFornecedor: documentos, item, hoje });
  assert.deepEqual(antiga.map(a => [a.codigo, a.nivel]), [["FORNECEDOR_CERTIDAO_DA_DATA", "info"]]);
  assert.match(antiga[0].texto, /122 dias da data do documento \(01\/06\/2026\)/);
});

test("chave de acesso na despesa: emitente, data, número e repetida", () => {
  const outroEmitente = alertasDaDespesa({ despesa: { ...despesa, chave_acesso: CHAVE_MANUAL }, fornecedor, documentosDoFornecedor: documentos, item, hoje });
  assert.deepEqual(outroEmitente.map(a => [a.codigo, a.nivel]), [["DOC_CHAVE_INVALIDA", "alerta"], ["DOC_CHAVE_INVALIDA", "info"], ["DOC_CHAVE_INVALIDA", "info"]]);
  assert.match(outroEmitente[1].texto, /emissão em 04\/2006/);
  assert.match(outroEmitente[2].texto, /número na chave é 780, e o informado é 123/);

  const repetida = alertasDaDespesa({ despesa, fornecedor, documentosDoFornecedor: documentos, item, outrasChaves: [despesa.chave_acesso!], hoje });
  assert.deepEqual(codigos(repetida), ["NFE_CHAVE_REPETIDA"]);

  const semChave = alertasDaDespesa({ despesa: { ...despesa, chave_acesso: null }, fornecedor, documentosDoFornecedor: documentos, item, hoje });
  assert.deepEqual(semChave.map(a => [a.codigo, a.nivel]), [["DOC_CHAVE_INVALIDA", "info"]]);
});

test("documento e retenções: PJ com recibo, RPA sem INSS, serviço sem retenção, valores e identificação", () => {
  const base = { ...despesa, chave_acesso: null };
  assert.deepEqual(codigos(alertasDaDespesa({ despesa: { ...base, tipo: "recibo" }, fornecedor, documentosDoFornecedor: documentos, item, hoje })), ["DOC_PJ_SEM_NF"]);

  const pf: PrestacaoFornecedor = { ...fornecedor, tipo_pessoa: "pf", documento: "52998224725", cnae_principal: null, cnaes_secundarios: null, situacao_cadastral: null, sancoes_situacao: null, cnpj_consultado_em: null, sancoes_consultadas_em: null };
  assert.deepEqual(codigos(alertasDaDespesa({ despesa: { ...base, tipo: "rpa" }, fornecedor: pf, item, hoje })), ["DOC_RETENCOES"]);
  assert.deepEqual(alertasDaDespesa({ despesa: { ...base, tipo: "rpa", inss: 110 }, fornecedor: pf, item, hoje }), []);

  const servico = alertasDaDespesa({ despesa: { ...base, tipo: "nfse" }, fornecedor, documentosDoFornecedor: documentos, item, hoje });
  assert.deepEqual(servico.map(a => [a.codigo, a.nivel]), [["DOC_RETENCOES", "info"]]);

  const demais = alertasDaDespesa({ despesa: { ...base, valor_extraido: 100, iss: 80, irrf: 30, identificacao_projeto: "ausente" }, fornecedor, documentosDoFornecedor: documentos, item: null, hoje });
  assert.deepEqual(codigos(demais), ["DOC_RETENCOES", "DESPESA_SEM_ITEM", "DOC_CHAVE_INVALIDA", "DOC_IDENTIFICACAO_PROJETO"]);
  assert.deepEqual(codigos(alertasDaDespesa({ despesa: { ...base, valor_extraido: null }, fornecedor, documentosDoFornecedor: documentos, item, hoje })), ["DESPESA_SEM_VALOR", "DOC_CHAVE_INVALIDA"]);

  assert.ok(faltaJustificativa(demais, ""));
  assert.ok(!faltaJustificativa(demais, "Fornecedor é do Simples; retenção não se aplica."));
  assert.ok(!faltaJustificativa([{ codigo: "DOC_RETENCOES", nivel: "info", texto: "" }], null), "só informação não pede justificativa");
});

test("banco: despesa no comprovante e CNAEs no orçamento (migration 20261006180000)", async () => {
  const { readFile } = await import("node:fs/promises");
  const sql = (await readFile("supabase/migrations/20261006180000_prestacao_despesas.sql", "utf8")).replace(/--.*$/gm, "");
  for (const tipo of ["nfse", "cupom", "rpci", "fatura", "apolice", "nota_debito"]) {
    assert.match(sql, new RegExp(`add value if not exists '${tipo}'`), `tipo ${tipo} no enum`);
  }
  assert.match(sql, /fornecedor_id uuid references public\.prestacao_fornecedores\(id\) on delete restrict/, "fornecedor com despesa não é excluído");
  assert.match(sql, /valor_liquido numeric\s+generated always as \(valor_extraido - iss - inss - irrf - outras_retencoes\) stored/);
  assert.match(sql, /iss \+ inss \+ irrf \+ outras_retencoes <= valor_extraido/);
  assert.match(sql, /create unique index if not exists \w+\s+on public\.prestacao_comprovantes \(prestacao_id, chave_acesso\) where chave_acesso is not null/);
  assert.match(sql, /raise exception 'fornecedor_de_outra_organizacao' using errcode = 'check_violation'/);
  assert.match(sql, /before insert or update of fornecedor_id, prestacao_id on public\.prestacao_comprovantes/);
  assert.match(sql, /n\.ordem, n\.cnaes_aceitos/, "copiar a versão leva os CNAEs");
  assert.match(sql, /check \(public\.fn_cnaes_validos\(cnaes_aceitos\)\)/);
  assert.doesNotMatch(sql, /\bdrop\b/i);
});
