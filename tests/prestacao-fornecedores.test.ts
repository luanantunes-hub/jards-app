import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  alertasDoFornecedor,
  cnpjValido,
  cpfValido,
  documentoValido,
  formatarCnae,
  formatarDocumento,
  lerCertidoesTcu,
  lerCnpjBrasilApi,
  limparDocumento,
  nomeDoFornecedor,
  resumoDasCertidoes,
} from "../lib/prestacao/fornecedores";
import type { PrestacaoFornecedor } from "../lib/supabase/types";

// Fixtures fictícias no formato real das respostas (BrasilAPI e TCU).
const exemplo = async (nome: string) => JSON.parse(await readFile(`tests/fixtures/fornecedores/${nome}`, "utf8"));

test("CNPJ numérico e alfanumérico, pelo exemplo da Receita", () => {
  assert.equal(cnpjValido("11.222.333/0001-81"), true);
  assert.equal(cnpjValido("00.000.000/0001-91"), true);
  assert.equal(cnpjValido("12.ABC.345/01DE-35"), true, "exemplo oficial do CNPJ alfanumérico");
  assert.equal(cnpjValido("12abc34501de35"), true, "minúsculas valem");
  assert.equal(cnpjValido("12.ABC.345/01DE-36"), false);
  assert.equal(cnpjValido("11.222.333/0001-80"), false);
  assert.equal(cnpjValido("11.111.111/1111-11"), false, "repetido");
  assert.equal(cnpjValido("12.ABC.345/01DE-3A"), false, "os dígitos verificadores são sempre algarismos");
  assert.equal(cnpjValido(""), false);
});

test("CPF", () => {
  assert.equal(cpfValido("529.982.247-25"), true);
  assert.equal(cpfValido("529.982.247-24"), false);
  assert.equal(cpfValido("111.111.111-11"), false);
  assert.equal(cpfValido("5299822472"), false);
});

test("documento guardado limpo e mostrado formatado; CPF mascarado na lista", () => {
  assert.equal(limparDocumento(" 12.abc.345/01de-35 "), "12ABC34501DE35");
  assert.equal(formatarDocumento("12ABC34501DE35"), "12.ABC.345/01DE-35");
  assert.equal(formatarDocumento("52998224725"), "529.982.247-25");
  assert.equal(formatarDocumento("52998224725", { mascararCpf: true }), "***.982.247-**");
  assert.equal(formatarDocumento("P1234567"), "P1234567", "documento estrangeiro fica como veio");
  assert.equal(documentoValido("mei", "11222333000181"), true);
  assert.equal(documentoValido("pf", "11222333000181"), false);
  assert.equal(documentoValido("estrangeiro", "P1234567"), true);
});

test("CNAE no formato da Receita", () => {
  assert.equal(formatarCnae(9001901), "9001-9/01");
  assert.equal(formatarCnae("111301"), "0111-3/01", "zeros à esquerda que o número perde");
  assert.equal(formatarCnae(0), null);
});

test("consulta do CNPJ na BrasilAPI", async () => {
  const dados = lerCnpjBrasilApi(await exemplo("brasilapi-exemplo.json"));
  assert.equal(dados.razao_social, "PRODUTORA EXEMPLO LTDA");
  assert.equal(dados.situacao_cadastral, "ATIVA");
  assert.equal(dados.data_abertura, "2019-03-11");
  assert.equal(dados.cnae_principal, "9001-9/01");
  assert.equal(dados.cnae_descricao, "Produção teatral");
  assert.deepEqual(dados.cnaes_secundarios.map(c => c.codigo), ["7490-1/04", "7739-0/99"]);
  assert.equal(dados.opcao_mei, false);
  assert.deepEqual(dados.socios[0], { nome: "FULANA DE TAL EXEMPLO", qualificacao: "Sócio-Administrador", documento: "***456789**", entrada: "2019-03-11" });
  assert.deepEqual(lerCnpjBrasilApi(null).socios, [], "resposta vazia não quebra");
  assert.deepEqual(lerCnpjBrasilApi({ cnaes_secundarios: [{ codigo: 0, descricao: "" }] }).cnaes_secundarios, [], "a BrasilAPI manda um CNAE 0 quando não há secundários");
});

test("certidões do TCU: uma com 'consta' basta; só 'nada consta' claro limpa", async () => {
  const lido = lerCertidoesTcu(await exemplo("tcu-exemplo.json"));
  assert.equal(lido.certidoes.length, 4);
  assert.deepEqual(lido.certidoes.map(c => c.resultado), ["nada_consta", "nada_consta", "consta", "nada_consta"]);
  assert.equal(lido.situacao, "consta");
  assert.equal(lido.certidoes[2].observacao, "Suspensão temporária até 31/12/2026");

  assert.equal(resumoDasCertidoes([{ resultado: "nada_consta" }, { resultado: "nada_consta" }]), "nada_consta");
  assert.equal(resumoDasCertidoes([{ resultado: "nada_consta" }, { resultado: "a_conferir" }]), "a_conferir");
  assert.equal(resumoDasCertidoes([]), "a_conferir", "sem certidão não é nada consta");
  const variacoes = lerCertidoesTcu({ certidoes: [{ situacao: "Nada Consta" }, { situacao: "NÃO CONSTA" }, { situacao: "Consta" }, { situacao: "EM_PROCESSAMENTO" }] });
  assert.deepEqual(variacoes.certidoes.map(c => c.resultado), ["nada_consta", "nada_consta", "consta", "a_conferir"]);
});

const base: PrestacaoFornecedor = {
  id: "f", organization_id: "o", tipo_pessoa: "pj", documento: "11222333000181", nome: null,
  parte_relacionada: false, tipo_relacao: null, grupo_economico: null, observacoes: null,
  razao_social: "PRODUTORA EXEMPLO LTDA", nome_fantasia: "EXEMPLO PRODUCOES", situacao_cadastral: "ATIVA",
  data_situacao: "2019-03-11", data_abertura: "2019-03-11", cnae_principal: "9001-9/01", cnae_descricao: "Produção teatral",
  cnaes_secundarios: [], natureza_juridica: null, porte: null, opcao_mei: false, uf: "SP", municipio: "SAO PAULO", socios: [],
  cnpj_consultado_em: "2026-10-05T18:00:00Z", cnpj_erro: null, sancoes: [], sancoes_situacao: "nada_consta",
  sancoes_consultadas_em: "2026-10-05T18:00:00Z", criado_por: null, created_at: "", updated_at: "",
};
const codigos = (f: Partial<PrestacaoFornecedor>, hoje = new Date("2026-10-06T12:00:00Z")) =>
  alertasDoFornecedor({ ...base, ...f }, hoje).map(a => a.codigo);

test("alertas do fornecedor", () => {
  assert.deepEqual(codigos({}), [], "ativo, consultado e sem sanção");
  assert.deepEqual(codigos({ situacao_cadastral: "BAIXADA" }), ["FORNECEDOR_SITUACAO"]);
  assert.deepEqual(codigos({ sancoes_situacao: "consta", sancoes: [{ emissor: "CGU", tipo: "CEIS", descricao: "CEIS", situacao: "CONSTA", observacao: null, emitida_em: null, resultado: "consta" }] }), ["FORNECEDOR_SANCIONADO"]);
  assert.deepEqual(codigos({ sancoes_situacao: "indisponivel" }), ["FORNECEDOR_SANCOES_A_CONFERIR"]);
  assert.deepEqual(codigos({ cnpj_consultado_em: null, sancoes_situacao: null, sancoes_consultadas_em: null }), ["FORNECEDOR_NAO_CONSULTADO"]);
  assert.deepEqual(codigos({ documento: "11222333000180" }), ["FORNECEDOR_DOCUMENTO"]);
  assert.deepEqual(codigos({}, new Date("2027-02-01T12:00:00Z")), ["FORNECEDOR_CONSULTA_ANTIGA"]);
  assert.deepEqual(codigos({ parte_relacionada: true, tipo_relacao: "dirigente" }), ["PARTE_RELACIONADA"]);
  assert.deepEqual(codigos({ opcao_mei: true }), ["FORNECEDOR_TIPO"], "a Receita diz MEI e o cadastro diz PJ");
  assert.deepEqual(codigos({ tipo_pessoa: "mei" }), ["FORNECEDOR_TIPO"], "o cadastro diz MEI e a Receita não");
  assert.deepEqual(codigos({ tipo_pessoa: "pf", documento: "52998224725", cnpj_consultado_em: null, sancoes_situacao: null, sancoes_consultadas_em: null }), [], "pessoa física não tem consulta pública");
  const sancao = alertasDoFornecedor({ ...base, sancoes_situacao: "consta", sancoes: [{ emissor: "CGU", tipo: "CEIS", descricao: "Cadastro Nacional de Empresas Inidôneas e Suspensas", situacao: "CONSTA", observacao: null, emitida_em: null, resultado: "consta" }] })[0];
  assert.match(sancao.texto, /Inidôneas e Suspensas/);
});

test("nome do fornecedor: o da pessoa, depois a razão social, depois o fantasia", () => {
  assert.equal(nomeDoFornecedor({ ...base, nome: "Som do Seu Zé" }), "Som do Seu Zé");
  assert.equal(nomeDoFornecedor(base), "PRODUTORA EXEMPLO LTDA");
  assert.equal(nomeDoFornecedor({ ...base, razao_social: null }), "EXEMPLO PRODUCOES");
  assert.equal(nomeDoFornecedor({ nome: null, nome_fantasia: null, razao_social: null, documento: "52998224725" }), "***.982.247-**");
});

test("banco: a consulta pública só entra pela função, com papel de quem edita", async () => {
  const sql = (await readFile("supabase/migrations/20261006150000_prestacao_fornecedores.sql", "utf8")).replace(/--.*$/gm, "");
  assert.match(sql, /alter table public\.prestacao_fornecedores enable row level security/);
  assert.match(sql, /revoke insert, update on public\.prestacao_fornecedores from authenticated, anon/);
  const concedidas = [...sql.matchAll(/grant (insert|update) \(([^)]+)\)/g)].flatMap(m => m[2].split(",").map(c => c.trim()));
  for (const coluna of ["razao_social", "situacao_cadastral", "socios", "sancoes", "sancoes_situacao", "cnpj_consultado_em"]) {
    assert.ok(!concedidas.includes(coluna), `o navegador não pode gravar ${coluna}`);
  }
  assert.match(sql, /auth_prestacao_org_pode\(organization_id, 'editar'\)/);
  assert.match(sql, /new\.documento is distinct from old\.documento/, "trocar o documento limpa a consulta");
  assert.doesNotMatch(sql, /\bdrop\b/i);

  const funcao = await readFile("supabase/functions/consultar-fornecedor/index.ts", "utf8");
  assert.ok(funcao.indexOf('rpc("auth_prestacao_org_pode"') < funcao.indexOf(".update(campos)"), "confere o papel antes de gravar");
  assert.match(funcao, /from\("prestacao_fornecedores"\)\s*\.select\("id, organization_id, tipo_pessoa, documento"\)/, "lê o fornecedor com o token de quem chama");
  const config = await readFile("supabase/config.toml", "utf8");
  assert.match(config, /\[functions\.consultar-fornecedor\]\s+verify_jwt = true/);
});
