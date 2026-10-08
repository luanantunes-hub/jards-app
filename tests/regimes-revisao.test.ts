import assert from "node:assert/strict";
import test from "node:test";
import { ROUANET_IN29_2026 } from "../lib/prestacao/regimes/rouanet-in29-2026";
import {
  diferencaEntreVersoes,
  montarRascunho,
  regrasQueBloqueiamEnvio,
  resumoDasMudancas,
  rotuloDoCaminho,
  valorLegivel,
  type MudancaRevisada,
} from "../lib/prestacao/regimes/revisao";
import { lerCaminho } from "../supabase/functions/_shared/proposta-regime";

const publicado = () => structuredClone(ROUANET_IN29_2026) as unknown as Record<string, unknown>;
const VERSAO = ROUANET_IN29_2026.versao + 1;

const prazo: MudancaRevisada = {
  operacao: "alterar", caminho: "prazos.prestacaoFinal.quantidade", valor: 90,
  documento: "IN MinC 40/2026", dispositivo: "art. 1º (art. 69 da IN 29)",
  citacao: "No período improrrogável de 90 (noventa) dias após o término da vigência do projeto",
};
const teto: MudancaRevisada = {
  operacao: "alterar", caminho: "orcamento.tetos[codigo=administracao].percentual", valor: 12,
  documento: "IN MinC 40/2026", dispositivo: "art. 1º (art. 22 da IN 29)",
  citacao: "não poderá ultrapassar o limite de 12% (doze por cento) do valor do projeto",
};

test("o rascunho aplica as mudanças revisadas, a versão e a vigência, e passa no schema", () => {
  const r = montarRascunho(publicado(), [prazo, { ...teto, valor: 13 }], { versao: VERSAO, vigenteDesde: "2027-01-01" });
  assert.ok(r.ok, r.ok ? "" : r.erros.join("; "));
  assert.equal(r.regime.versao, VERSAO);
  assert.equal(r.regime.vigenteDesde, "2027-01-01");
  assert.equal(lerCaminho(r.regime, "prazos.prestacaoFinal.quantidade").valor, 90);
  // O valor corrigido na revisão vale no lugar do proposto.
  assert.equal(lerCaminho(r.regime, "orcamento.tetos[codigo=administracao].percentual").valor, 13);
  assert.deepEqual(lerCaminho(r.regime, "orcamento.tetos[codigo=administracao].fonte").valor, {
    documento: "IN MinC 40/2026", dispositivo: "art. 1º (art. 22 da IN 29)",
    citacao: "não poderá ultrapassar o limite de 12% (doze por cento) do valor do projeto",
  });
});

test("o rascunho recusa mudança sem fonte, de outro tipo ou fora do schema", () => {
  const semFonte = montarRascunho(publicado(), [{ ...prazo, dispositivo: " " }], { versao: VERSAO });
  assert.deepEqual(semFonte, { ok: false, erros: ["prazos.prestacaoFinal.quantidade: diga o documento e o dispositivo de onde vem a regra"] });

  const tipo = montarRascunho(publicado(), [{ ...prazo, valor: "noventa" }], { versao: VERSAO });
  assert.deepEqual(tipo, { ok: false, erros: ["prazos.prestacaoFinal.quantidade: o valor proposto é texto, e o atual é número"] });

  // Texto no lugar de texto, mas fora da lista de unidades do schema.
  const schema = montarRascunho(publicado(), [{ ...prazo, caminho: "prazos.prestacaoFinal.unidade", valor: "semanas" }], { versao: VERSAO });
  assert.equal(schema.ok, false);
  assert.ok(!schema.ok && schema.erros.some(e => e.includes("unidade")), JSON.stringify(schema));
});

test("a diferença entre versões lista cada parâmetro e a fonte que mudaram", () => {
  const r = montarRascunho(publicado(), [prazo], { versao: VERSAO, vigenteDesde: "2027-01-01" });
  assert.ok(r.ok);
  const diferencas = diferencaEntreVersoes(ROUANET_IN29_2026, r.regime);
  assert.deepEqual(diferencas, [
    { caminho: "vigenteDesde", antes: JSON.stringify(ROUANET_IN29_2026.vigenteDesde), depois: "\"2027-01-01\"" },
    { caminho: "prazos.prestacaoFinal.quantidade", antes: "60", depois: "90" },
    { caminho: "prazos.prestacaoFinal.fonte", antes: "IN MinC 29/2026, art. 69, caput", depois: "IN MinC 40/2026, art. 1º (art. 69 da IN 29)" },
  ]);
  // Do banco, as chaves voltam em outra ordem (jsonb): a fonte continua depois do valor.
  const doBanco = JSON.parse(JSON.stringify(r.regime, (_, v) => (v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).sort(([x], [y]) => x.length - y.length || x.localeCompare(y))) : v)));
  assert.deepEqual(diferencaEntreVersoes(ROUANET_IN29_2026, doBanco).map(d => d.caminho), [
    "prazos.prestacaoFinal.quantidade", "prazos.prestacaoFinal.fonte", "vigenteDesde",
  ]);
  assert.equal(rotuloDoCaminho(r.regime, "vigenteDesde"), "Vigente desde");
  assert.deepEqual(diferencaEntreVersoes(ROUANET_IN29_2026, ROUANET_IN29_2026), []);
});

test("só mudança em regra de bloqueio pede a segunda aprovação", () => {
  const soPrazo = montarRascunho(publicado(), [prazo], { versao: VERSAO });
  assert.ok(soPrazo.ok);
  assert.deepEqual(regrasQueBloqueiamEnvio(ROUANET_IN29_2026, soPrazo.regime), []);

  const comTeto = montarRascunho(publicado(), [prazo, teto], { versao: VERSAO });
  assert.ok(comTeto.ok);
  assert.deepEqual(regrasQueBloqueiamEnvio(ROUANET_IN29_2026, comTeto.regime), ["orcamento.tetos[codigo=administracao]"]);

  // Uma regra que passa de alerta a bloqueio também conta.
  const base = publicado();
  const regra = (lerCaminho(base, "despesas.regras").valor as { codigo: string; severidade: string }[])[0];
  regra.severidade = "alerta";
  const subiu = montarRascunho(base, [{
    operacao: "alterar", caminho: `despesas.regras[codigo=${regra.codigo}].severidade`, valor: "bloqueio",
    documento: "IN MinC 40/2026", dispositivo: "art. 3º",
  }], { versao: VERSAO });
  assert.ok(subiu.ok, subiu.ok ? "" : subiu.erros.join("; "));
  assert.deepEqual(regrasQueBloqueiamEnvio(base, subiu.regime), [`despesas.regras[codigo=${regra.codigo}]`]);
});

test("o resumo para quem usa o regime junta o item que entrou e põe a fonte ao lado", () => {
  const base = publicado();
  // A regra nova sem fonte própria recebe a do documento que a incluiu.
  const regra = { ...(lerCaminho(base, "despesas.regras").valor as Record<string, unknown>[])[0] };
  delete regra.fonte;
  const r = montarRascunho(base, [
    prazo,
    { operacao: "incluir", caminho: "despesas.regras", valor: { ...regra, codigo: "bufe_vedado", descricao: "Serviços de bufê não são aceitos." },
      documento: "IN MinC 40/2026", dispositivo: "art. 2º" },
    { operacao: "remover", caminho: `despesas.regras[codigo=${regra.codigo}]`, valor: null, documento: "IN MinC 40/2026", dispositivo: "art. 4º" },
  ], { versao: VERSAO, vigenteDesde: "2027-01-01" });
  assert.ok(r.ok, r.ok ? "" : r.erros.join("; "));
  assert.deepEqual(resumoDasMudancas(ROUANET_IN29_2026, r.regime), [
    { rotulo: "Vigente desde", tipo: "mudou", antes: "30/01/2026", depois: "01/01/2027", fonte: null },
    {
      rotulo: "Prazos › Concluir os pagamentos e enviar o relatório final no Salic", tipo: "mudou",
      antes: "60 dias corridos", depois: "90 dias corridos", fonte: "IN MinC 40/2026, art. 1º (art. 69 da IN 29)",
    },
    { rotulo: "Período e despesas vedadas › Serviços de bufê não são aceitos.", tipo: "entrou", antes: null, depois: null, fonte: "IN MinC 40/2026, art. 2º" },
    { rotulo: "Período e despesas vedadas › Despesa anterior à Portaria de captação não é ressarcida.", tipo: "saiu", antes: null, depois: null, fonte: "IN MinC 29/2026, art. 47, § 3º" },
  ]);
  assert.deepEqual(resumoDasMudancas(ROUANET_IN29_2026, ROUANET_IN29_2026), []);

  const comTeto = montarRascunho(publicado(), [teto], { versao: VERSAO });
  assert.ok(comTeto.ok);
  assert.deepEqual(resumoDasMudancas(ROUANET_IN29_2026, comTeto.regime), [{
    rotulo: "Orçamento, grupos e tetos › Custos de administração, incluindo tarifas necessárias", tipo: "mudou",
    antes: "15%", depois: "12%", fonte: "IN MinC 40/2026, art. 1º (art. 22 da IN 29)",
  }]);
});

test("rótulo e valor para ler na tela", () => {
  assert.equal(rotuloDoCaminho(ROUANET_IN29_2026, "prazos.prestacaoFinal.quantidade"), "Prazos › Concluir os pagamentos e enviar o relatório final no Salic › quantidade");
  assert.equal(rotuloDoCaminho(ROUANET_IN29_2026, "orcamento.tetos[codigo=administracao].percentual"),
    "Orçamento, grupos e tetos › Custos de administração, incluindo tarifas necessárias › percentual");
  assert.equal(valorLegivel(12.5), "12,5");
  assert.equal(valorLegivel(true), "sim");
  assert.equal(valorLegivel({ codigo: "bufe", descricao: "Serviços de bufê" }), "Serviços de bufê");
  assert.equal(valorLegivel(null), "—");
});
