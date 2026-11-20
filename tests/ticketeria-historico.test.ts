import assert from "node:assert/strict";
import test from "node:test";
import { CANAL_OUTRO, CANAL_SEM_ORIGEM, adivinharColunas, canalDaPlanilha, consolidarGastos, consolidarVendas, importacoesQueSeSobrepoem, lerCorpoDaImportacao, lerCsv, lerDia, modeloDeCsv, semanasDeHistorico, type ImportacaoDaLista } from "../lib/ticketeria/historico";

test("o CSV: separador, aspas, BOM, quebra de linha dentro de campo e linhas vazias", () => {
  const a = lerCsv("﻿Data;Quantidade;Valor\r\n03/03/2025;4;\"240,00\"\r\n\r\n04/03/2025;2;120,00\r\n");
  assert.equal(a.separador, ";");
  assert.deepEqual(a.cabecalho, ["Data", "Quantidade", "Valor"]);
  assert.deepEqual(a.linhas, [["03/03/2025", "4", "240,00"], ["04/03/2025", "2", "120,00"]]);
  assert.equal(lerCsv("a,b,c\n1,2,3\n").separador, ",");
  assert.equal(lerCsv("a\tb\n1\t2\n").separador, "\t");
  assert.deepEqual(lerCsv('nome,obs\n"Silva, Rita","disse ""oi""\nem duas linhas"\n').linhas, [["Silva, Rita", 'disse "oi"\nem duas linhas']]);
  assert.deepEqual(lerCsv("a;b\n1;2").linhas, [["1", "2"]], "sem quebra de linha no fim");
  assert.deepEqual(lerCsv("").linhas, []);
  const grande = lerCsv("d\n" + Array.from({ length: 30 }, (_, i) => String(i)).join("\n"), 10);
  assert.equal(grande.linhas.length, 10);
  assert.equal(grande.truncado, true);
});

test("o dia: formatos do Brasil e ISO, só dia que existe", () => {
  assert.equal(lerDia("03/03/2025"), "2025-03-03");
  assert.equal(lerDia("3/3/25"), "2025-03-03");
  assert.equal(lerDia("2025-03-03"), "2025-03-03");
  assert.equal(lerDia("03-03-2025 14:20"), "2025-03-03");
  assert.equal(lerDia("03/03/2025 14:20:05"), "2025-03-03");
  assert.equal(lerDia("2025-03-03T14:20:00Z"), "2025-03-03");
  assert.equal(lerDia("31/02/2025"), null, "dia que não existe");
  assert.equal(lerDia("2025-13-01"), null);
  assert.equal(lerDia("ontem"), null);
  assert.equal(lerDia(""), null);
  assert.equal(lerDia("03/03/1850"), null, "ano fora do que faz sentido");
});

test("as colunas: adivinha pelo nome do cabeçalho, sem repetir coluna", () => {
  assert.deepEqual(adivinharColunas(["Data do pedido", "Nome", "E-mail", "Qtd", "Valor total", "Canal de divulgação"]), { dia: 0, ingressos: 3, valor: 4, canal: 5 });
  assert.deepEqual(adivinharColunas(["Data", "Valor", "Canal"]), { dia: 0, ingressos: null, valor: 1, canal: 2 });
  assert.deepEqual(adivinharColunas(["Dia", "Gasto", "Plataforma"]), { dia: 0, ingressos: null, valor: 1, canal: 2 });
  assert.deepEqual(adivinharColunas(["a", "b"]), { dia: null, ingressos: null, valor: null, canal: null });
});

test("o canal da planilha: reconhece os conhecidos, recorta o resto, vazio vira o padrão", () => {
  assert.equal(canalDaPlanilha("Instagram Stories", CANAL_SEM_ORIGEM), "instagram");
  assert.equal(canalDaPlanilha("ig", CANAL_SEM_ORIGEM), "instagram");
  assert.equal(canalDaPlanilha("WhatsApp", CANAL_SEM_ORIGEM), "whatsapp");
  assert.equal(canalDaPlanilha("Rádio Cidade FM!", CANAL_SEM_ORIGEM), "radio-cidade-fm");
  assert.equal(canalDaPlanilha("  ", CANAL_SEM_ORIGEM), "sem-origem");
  assert.equal(canalDaPlanilha("???", CANAL_OUTRO), "outro");
});

const csvDeVendas = lerCsv("Data;Nome;Qtd;Valor;Canal\n03/03/2025;Rita;4;240,00;Instagram\n03/03/2025;João;2;120,00;\n03/03/2025;Ana;1;60,00;ig\n04/03/2025;Lia;7;R$ 420,00;whatsapp\nontem;X;1;1;x\n05/03/2025;Y;abc;1;x\n06/03/2025;Z;1;caro;x\n");

test("vendas: soma por dia e canal, aponta as linhas ruins, ignora colunas não apontadas", () => {
  const r = consolidarVendas(csvDeVendas.linhas, { dia: 0, ingressos: 2, valor: 3, canal: 4 });
  assert.deepEqual(r.linhas, [
    { dia: "2025-03-03", canal: "instagram", ingressos: 5, valor_centavos: 30000 },
    { dia: "2025-03-03", canal: "sem-origem", ingressos: 2, valor_centavos: 12000 },
    { dia: "2025-03-04", canal: "whatsapp", ingressos: 7, valor_centavos: 42000 },
  ]);
  assert.deepEqual(r.problemas, [{ linha: 6, motivo: "dia que não dá para ler" }, { linha: 7, motivo: "quantidade que não dá para ler" }, { linha: 8, motivo: "valor que não dá para ler" }]);
  assert.deepEqual([r.lidas, r.inicio, r.fim, r.totalIngressos, r.totalCentavos], [4, "2025-03-03", "2025-03-04", 14, 84000]);
  assert.ok(!JSON.stringify(r).includes("Rita") && !JSON.stringify(r).includes("João"), "nomes nunca entram no que se envia");
});

test("vendas sem coluna de quantidade: cada linha vale um ingresso; sem valor e sem canal também vale", () => {
  const r = consolidarVendas([["03/03/2025"], ["03/03/2025"], ["04/03/2025"]], { dia: 0, ingressos: null, valor: null, canal: null });
  assert.deepEqual(r.linhas, [{ dia: "2025-03-03", canal: "sem-origem", ingressos: 2, valor_centavos: 0 }, { dia: "2025-03-04", canal: "sem-origem", ingressos: 1, valor_centavos: 0 }]);
  assert.equal(r.problemas.length, 0);
  assert.deepEqual(consolidarVendas([], { dia: 0, ingressos: null, valor: null, canal: null }).linhas, []);
  const semDia = consolidarVendas([["x"]], { dia: null, ingressos: null, valor: null, canal: null });
  assert.equal(semDia.linhas.length, 0, "sem coluna de dia nada entra");
});

test("gastos: dia e valor obrigatórios; canal vazio vira outro; soma o mesmo dia e canal", () => {
  const r = consolidarGastos([["01/05/2025", "120,00", "Meta"], ["01/05/2025", "30,50", "meta"], ["02/05/2025", "95,5", ""], ["03/05/2025", "", "google"], ["xx", "1", "x"]], { dia: 0, ingressos: null, valor: 1, canal: 2 });
  assert.deepEqual(r.linhas, [{ dia: "2025-05-01", canal: "meta", gasto_centavos: 15050 }, { dia: "2025-05-02", canal: "outro", gasto_centavos: 9550 }]);
  assert.deepEqual(r.problemas, [{ linha: 5, motivo: "valor que não dá para ler" }, { linha: 6, motivo: "dia que não dá para ler" }]);
  assert.equal(r.totalCentavos, 24600);
});

test("semanas de histórico e sobreposição entre importações", () => {
  assert.equal(semanasDeHistorico("2025-03-03", "2025-03-09"), 1);
  assert.equal(semanasDeHistorico("2025-03-03", "2025-03-10"), 2);
  assert.equal(semanasDeHistorico("2025-03-03", "2025-12-14"), 41);
  assert.equal(semanasDeHistorico(null, null), 0);
  assert.equal(semanasDeHistorico("2025-03-10", "2025-03-03"), 0);
  const existentes: ImportacaoDaLista[] = [
    { id: "1", tipo: "vendas", arquivo: "a.csv", periodo_inicio: "2025-03-03", periodo_fim: "2025-12-14", linhas: 10, total_ingressos: 5, total_valor_centavos: 0, created_at: "2026-11-20T00:00:00Z" },
    { id: "2", tipo: "gasto", arquivo: "b.csv", periodo_inicio: "2025-05-01", periodo_fim: "2025-11-30", linhas: 10, total_ingressos: 0, total_valor_centavos: 5, created_at: "2026-11-20T00:00:00Z" },
  ];
  assert.deepEqual(importacoesQueSeSobrepoem(existentes, "vendas", "2025-12-01", "2026-01-31").map(i => i.id), ["1"]);
  assert.deepEqual(importacoesQueSeSobrepoem(existentes, "vendas", "2026-01-01", "2026-01-31"), []);
  assert.deepEqual(importacoesQueSeSobrepoem(existentes, "gasto", "2025-01-01", "2025-05-01").map(i => i.id), ["2"]);
  assert.deepEqual(importacoesQueSeSobrepoem(existentes, "vendas", null, null), []);
});

test("o corpo do pedido de importar: conferido de novo, nada confiável", () => {
  const bom = { tipo: "vendas", arquivo: "  sympla-2025.csv ", linhas: [{ dia: "2025-03-03", canal: "instagram", ingressos: 5, valor_centavos: 30000 }, { dia: "2025-03-04", canal: "sem-origem", ingressos: 1, valor_centavos: 0 }] };
  const r = lerCorpoDaImportacao(bom);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.corpo.arquivo, "sympla-2025.csv");
  assert.ok(lerCorpoDaImportacao({ tipo: "gasto", arquivo: "g.csv", linhas: [{ dia: "2025-05-01", canal: "meta", gasto_centavos: 100 }] }).ok);
  const ruim = (m: object) => lerCorpoDaImportacao({ ...bom, ...m });
  for (const m of [{ tipo: "outro" }, { arquivo: "  " }, { arquivo: 5 }, { linhas: [] }, { linhas: "x" }, { linhas: [{ dia: "2025-02-31", canal: "x", ingressos: 1, valor_centavos: 0 }] },
    { linhas: [{ dia: "2025-03-03", canal: "Canal Torto", ingressos: 1, valor_centavos: 0 }] }, { linhas: [{ dia: "2025-03-03", canal: "x", ingressos: -1, valor_centavos: 0 }] },
    { linhas: [{ dia: "2025-03-03", canal: "x", ingressos: 1.5, valor_centavos: 0 }] }, { linhas: [{ dia: "2025-03-03", canal: "x", ingressos: 1, valor_centavos: "5" }] },
    { linhas: [{ dia: "2025-03-03", canal: "x", ingressos: 1, valor_centavos: 0 }, { dia: "2025-03-03", canal: "x", ingressos: 2, valor_centavos: 0 }] },
    { linhas: Array.from({ length: 20001 }, (_, i) => ({ dia: "2025-03-03", canal: `c${i}`, ingressos: 1, valor_centavos: 0 })) }]) assert.equal(ruim(m).ok, false, JSON.stringify(m).slice(0, 80));
  assert.equal(lerCorpoDaImportacao({ tipo: "gasto", arquivo: "g.csv", linhas: [{ dia: "2025-05-01", canal: "meta", gasto_centavos: "1" }] }).ok, false);
  assert.equal(lerCorpoDaImportacao(null).ok, false);
});

test("o modelo para baixar é um CSV que o próprio Jards lê sem problema", () => {
  const v = lerCsv(modeloDeCsv("vendas"));
  assert.deepEqual(v.cabecalho, ["Data", "Quantidade", "Valor", "Canal"]);
  const rv = consolidarVendas(v.linhas, adivinharColunas(v.cabecalho));
  assert.equal(rv.problemas.length, 0);
  assert.equal(rv.totalIngressos, 13);
  const g = lerCsv(modeloDeCsv("gasto"));
  const rg = consolidarGastos(g.linhas, adivinharColunas(g.cabecalho));
  assert.equal(rg.problemas.length, 0);
  assert.equal(rg.totalCentavos, 25550);
});
