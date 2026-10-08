import assert from "node:assert/strict";
import test from "node:test";
import { ROUANET_IN29_2026 } from "../lib/prestacao/regimes/rouanet-in29-2026";
import { validarRegime } from "../lib/prestacao/regimes/schema";
import {
  citacaoNoTexto,
  conferirLeitura,
  lerCaminho,
  lerLeituraDaIa,
  passosDoCaminho,
  promptDaLeituraNormativa,
  regimeAchatado,
  type LeituraDaIa,
  type MudancaLida,
} from "../supabase/functions/_shared/proposta-regime";

const regime = () => structuredClone(ROUANET_IN29_2026) as unknown as Record<string, unknown>;

// Ato fictício no formato do Diário, para as mudanças conferidas.
const ATO = [
  "INSTRUÇÃO NORMATIVA MINC Nº 40, DE 1º DE DEZEMBRO DE 2026",
  "Art. 1º A Instrução Normativa MinC nº 29, de 29 de janeiro de 2026, passa a vigorar com as seguintes alterações:",
  "\"Art. 69. No período improrrogável de 90 (noventa) dias após o término da vigência do projeto, o proponente deverá concluir os pagamentos.\"",
  "\"Art. 22. Os custos de administração não poderão ultrapassar 12% (doze por cento) do valor do projeto.\"",
  "Art. 2º É vedada a contratação de serviços de bufê com recursos incentivados.",
  "Art. 3º Esta Instrução Normativa entra em vigor em 1º de janeiro de 2027 e aplica-se aos projetos aprovados a partir dessa data.",
].join("\n");

const mudanca = (m: Partial<MudancaLida>): MudancaLida => ({
  operacao: "alterar", caminho: "", valorProposto: "null", dispositivo: "art. 1º", citacao: "", explicacao: "", aConfirmar: false, ...m,
});

const leitura = (mudancas: MudancaLida[]): LeituraDaIa => ({
  classificacao: "altera_regra",
  resumo: "Prazo final de 90 dias e teto de administração de 12%.",
  vigencia: "2027-01-01",
  transicao: { aplicaEmAndamento: false, explicacao: "Vale para projetos aprovados a partir de 2027 (art. 3º)." },
  mudancas,
  checagensNovas: [],
});

const DOC = { documento: "IN MinC 40/2026", url: "https://www.in.gov.br/web/dou/-/in-minc-40", texto: ATO };

test("caminhos do regime: chaves, itens por código e por posição", () => {
  assert.deepEqual(passosDoCaminho("orcamento.tetos[codigo=administracao].percentual"), [
    { chave: "orcamento" }, { chave: "tetos" }, { codigo: "administracao" }, { chave: "percentual" },
  ]);
  assert.deepEqual(passosDoCaminho("fontes[0].url"), [{ chave: "fontes" }, { indice: 0 }, { chave: "url" }]);
  assert.equal(passosDoCaminho("orcamento..tetos"), null);
  assert.equal(passosDoCaminho("orcamento.tetos[nome=x]"), null);
  assert.equal(passosDoCaminho(""), null);
  assert.deepEqual(lerCaminho(ROUANET_IN29_2026, "prazos.prestacaoFinal.quantidade"), { existe: true, valor: 60 });
  assert.deepEqual(lerCaminho(ROUANET_IN29_2026, "orcamento.tetos[codigo=administracao].percentual"), { existe: true, valor: 15 });
  assert.equal(lerCaminho(ROUANET_IN29_2026, "orcamento.tetos[codigo=inexistente].percentual").existe, false);

  const achatado = regimeAchatado(ROUANET_IN29_2026);
  assert.match(achatado, /^prazos\.prestacaoFinal\.quantidade = 60$/m);
  assert.match(achatado, /^orcamento\.tetos\[codigo=administracao\]\.percentual = 15$/m);
  assert.match(achatado, /^prazos\.prestacaoFinal\.fonte = IN MinC 29\/2026, art\. 69, caput$/m);
  // O trecho citado e as notas ficam fora do pedido.
  assert.doesNotMatch(achatado, /improrrogável de 60/);
});

test("citação conferida letra por letra, com espaços, aspas e reticências", () => {
  assert.equal(citacaoNoTexto(ATO, "No período improrrogável de 90 (noventa) dias após o término da vigência do projeto"), true);
  assert.equal(citacaoNoTexto(ATO, "  “Art. 69. No   período improrrogável de 90 (noventa) dias”  "), true);
  assert.equal(citacaoNoTexto(ATO, "Os custos de administração não poderão ultrapassar ... 12% (doze por cento) do valor do projeto"), true);
  assert.equal(citacaoNoTexto(ATO, "Os custos de administração não poderão ultrapassar 10% (dez por cento)"), false, "valor trocado");
  assert.equal(citacaoNoTexto(ATO, "do valor do projeto ... Os custos de administração"), false, "fora de ordem");
  assert.equal(citacaoNoTexto(ATO, "90 dias"), false, "curto demais");
  assert.equal(citacaoNoTexto(ATO, "prazo de 90 dias ... de bufê"), false, "pedaço curto");
});

test("mudanças aceitas viram a versão seguinte, com a fonte nova e o schema válido", () => {
  const r = conferirLeitura(regime(), leitura([
    mudanca({
      caminho: "prazos.prestacaoFinal.quantidade", valorProposto: "90", dispositivo: "art. 1º (art. 69 da IN 29)",
      citacao: "No período improrrogável de 90 (noventa) dias após o término da vigência do projeto",
    }),
    mudanca({
      caminho: "orcamento.tetos[codigo=administracao].percentual", valorProposto: "12", dispositivo: "art. 1º (art. 22 da IN 29)",
      citacao: "Os custos de administração não poderão ultrapassar 12% (doze por cento) do valor do projeto",
    }),
    mudanca({
      operacao: "incluir", caminho: "despesas.vedadas", dispositivo: "art. 2º",
      valorProposto: JSON.stringify({ codigo: "bufe", descricao: "Serviços de bufê" }),
      citacao: "É vedada a contratação de serviços de bufê com recursos incentivados",
    }),
  ]), DOC);

  assert.equal(r.descartadas.length, 0, JSON.stringify(r.descartadas));
  assert.deepEqual(r.mudancas.map(m => [m.caminho, m.valorAtual, m.valorProposto]), [
    ["prazos.prestacaoFinal.quantidade", 60, 90],
    ["orcamento.tetos[codigo=administracao].percentual", 15, 12],
    ["despesas.vedadas", null, { codigo: "bufe", descricao: "Serviços de bufê" }],
  ]);
  const proposto = r.regimeProposto!;
  assert.equal(proposto.versao, ROUANET_IN29_2026.versao + 1);
  assert.equal(lerCaminho(proposto, "prazos.prestacaoFinal.quantidade").valor, 90);
  assert.deepEqual(lerCaminho(proposto, "prazos.prestacaoFinal.fonte").valor, {
    documento: "IN MinC 40/2026",
    dispositivo: "art. 1º (art. 69 da IN 29)",
    citacao: "No período improrrogável de 90 (noventa) dias após o término da vigência do projeto",
  });
  assert.equal((lerCaminho(proposto, "despesas.vedadas[codigo=bufe].fonte").valor as { documento: string }).documento, "IN MinC 40/2026");
  assert.ok((proposto.fontes as { url: string }[]).some(f => f.url === DOC.url));
  assert.deepEqual(validarRegime(proposto), { ok: true });
  // O regime de origem não muda.
  assert.equal(lerCaminho(ROUANET_IN29_2026, "prazos.prestacaoFinal.quantidade").valor, 60);
});

test("mudança sem citação no texto, de outro tipo, igual, inexistente ou na identidade cai com o motivo", () => {
  const r = conferirLeitura(regime(), leitura([
    mudanca({ caminho: "prazos.prestacaoFinal.quantidade", valorProposto: "120", citacao: "No período improrrogável de 120 (cento e vinte) dias" }),
    mudanca({ caminho: "prazos.prestacaoFinal.quantidade", valorProposto: "\"noventa\"", citacao: "No período improrrogável de 90 (noventa) dias" }),
    mudanca({ caminho: "orcamento.tetos[codigo=administracao].percentual", valorProposto: "15", citacao: "Os custos de administração não poderão ultrapassar 12%" }),
    mudanca({ caminho: "orcamento.tetos[codigo=nao_existe].percentual", valorProposto: "12", citacao: "Os custos de administração não poderão ultrapassar 12%" }),
    mudanca({ caminho: "codigo", valorProposto: "\"rouanet_in40\"", citacao: "Os custos de administração não poderão ultrapassar 12%" }),
    mudanca({ operacao: "incluir", caminho: "despesas.vedadas", valorProposto: JSON.stringify({ codigo: "taxa_administracao", descricao: "x" }), citacao: "É vedada a contratação de serviços de bufê" }),
    mudanca({ operacao: "trocar", caminho: "prazos.prestacaoFinal.quantidade", valorProposto: "90", citacao: "No período improrrogável de 90 (noventa) dias" }),
  ]), DOC);
  assert.deepEqual(r.mudancas, []);
  assert.equal(r.regimeProposto, null);
  assert.deepEqual(r.descartadas.map(d => d.motivo), [
    "o trecho citado não está no texto guardado",
    "o valor proposto é texto, e o atual é número",
    "o valor proposto é igual ao atual",
    "o caminho não existe no regime",
    "código, versão, área e mecanismo do regime não mudam por proposta",
    "a lista já tem um item com o código taxa_administracao",
    "operação desconhecida",
  ]);
});

test("resposta da IA lida sem confiar no formato", () => {
  assert.equal(lerLeituraDaIa(null), null);
  assert.equal(lerLeituraDaIa({ classificacao: "talvez" }), null);
  const lida = lerLeituraDaIa({
    classificacao: "informativo",
    resumo: "Prorroga a dedução.",
    vigencia: "31/12/2031",
    transicao: { aplicaEmAndamento: "sim", explicacao: "Vale já." },
    mudancas: [{ operacao: "alterar", caminho: "x", valorProposto: 3 }, "lixo"],
  });
  assert.ok(lida);
  assert.equal(lida.vigencia, null);
  assert.equal(lida.transicao.aplicaEmAndamento, null);
  assert.deepEqual(lida.mudancas, [{ operacao: "alterar", caminho: "x", valorProposto: "3", dispositivo: "", citacao: "", explicacao: "", aConfirmar: false }]);
  assert.deepEqual(lida.checagensNovas, []);
});

test("o pedido traz o documento, os trechos que mudaram e o regime achatado", () => {
  const pedido = promptDaLeituraNormativa({
    documento: { titulo: "IN MinC 29/2026, com as alterações", tipo: "Página", orgao: "Ministério da Cultura", publicadoEm: "2026-10-08", url: null },
    texto: ATO,
    trechosQueMudaram: "ANTES: Art. 69. No período improrrogável de 60\nAGORA: Art. 69. No período improrrogável de 90",
    regime: { codigo: "rouanet_in29_2026", nome: "Lei Rouanet", versao: 2, normaReferencia: "IN MinC 29/2026", achatado: "prazos.prestacaoFinal.quantidade = 60" },
  });
  assert.match(pedido, /Página vigiada: IN MinC 29\/2026, com as alterações \(Ministério da Cultura\), coletada em 08\/10\/2026/);
  assert.match(pedido, /ANTES: Art\. 69/);
  assert.match(pedido, /prazos\.prestacaoFinal\.quantidade = 60/);
  assert.match(pedido, /copiado letra por letra/);
});
