import assert from "node:assert/strict";
import test from "node:test";
import {
  avisosDeCapacidade, documentosParaPreencher, documentosSugeridos, itensParaPreencher, lerLinhaDoChecklist, resumoDaConferencia, ROTULO_DA_CONFERENCIA, textoDoResumo, totaisDoChecklist,
} from "../lib/producao/checklist";

test("linha: nome e quantidade; vazio vira 1; recusa o que o banco recusaria", () => {
  assert.deepEqual(lerLinhaDoChecklist({ nome: " Refletor ", quantidade: "" }), { ok: true, nome: "Refletor", quantidade: 1 });
  assert.deepEqual(lerLinhaDoChecklist({ nome: "Caixa", quantidade: "12" }), { ok: true, nome: "Caixa", quantidade: 12 });
  assert.ok(!lerLinhaDoChecklist({ nome: " ", quantidade: "1" }).ok);
  assert.ok(!lerLinhaDoChecklist({ nome: "x".repeat(201), quantidade: "1" }).ok);
  assert.ok(!lerLinhaDoChecklist({ nome: "x", quantidade: "0" }).ok);
  assert.ok(!lerLinhaDoChecklist({ nome: "x", quantidade: "1,5" }).ok);
  assert.ok(!lerLinhaDoChecklist({ nome: "x", quantidade: "100000" }).ok);
});

test("documentos sugeridos por tipo de deslocamento", () => {
  assert.deepEqual(documentosSugeridos("van", "proprio"), ["CNH do motorista (na categoria do veículo)", "Documento do veículo"]);
  assert.ok(documentosSugeridos("caminhao", "proprio").includes("Nota de remessa ou declaração de conteúdo"));
  const onibus = documentosSugeridos("onibus", null);
  assert.ok(onibus.includes("Licença da ANTT do fretamento") && onibus.includes("Lista de passageiros"));
  assert.ok(documentosSugeridos("van", "fretado_combustivel_incluso").includes("Licença da ANTT do fretamento"), "o fretado pede a ANTT mesmo sendo van");
  assert.deepEqual(documentosSugeridos("aviao", null), ["Passagens ou bilhetes", "Documento de identificação de quem viaja"]);
  assert.deepEqual(documentosSugeridos("outro", null), []);
});

test("preencher: itens da data que ainda não estão e documentos sem repetir", () => {
  const ligacoes = [{ item_id: "a", nome: "A", quantidade: 2 }, { item_id: "b", nome: "B", quantidade: 1 }];
  assert.deepEqual(itensParaPreencher(ligacoes, new Set(["a"])), [{ item_id: "b", nome: "B", quantidade: 1 }]);
  assert.deepEqual(documentosParaPreencher(["CNH", "Documento do veículo"], ["cnh ", "Outro"]), ["Documento do veículo"]);
});

test("totais: soma peso e volume dos itens com medida; documento não entra; sem medida é contado", () => {
  const totais = totaisDoChecklist([
    { tipo: "item", quantidade: 10, medidas: { comprimento_cm: 100, largura_cm: 50, altura_cm: 20, peso_kg: 5 } }, // 1 m³ e 50 kg
    { tipo: "item", quantidade: 1, medidas: null },
    { tipo: "documento", quantidade: 1, medidas: null },
  ]);
  assert.deepEqual(totais, { pesoKg: 50, volumeM3: 1, semMedidas: 1 });
});

test("capacidade: avisa peso e volume acima do que o veículo leva; sem capacidade ou sem veículo, nada", () => {
  const totais = { pesoKg: 1250.5, volumeM3: 14.5 };
  assert.deepEqual(avisosDeCapacidade(totais, { capacidade_carga_kg: 1000, capacidade_volume_m3: 12 }), [
    "A carga pesa 1.250,5 kg e o veículo leva 1.000 kg.",
    "A carga ocupa 14,5 m³ e o veículo leva 12 m³.",
  ]);
  assert.deepEqual(avisosDeCapacidade(totais, { capacidade_carga_kg: 1250.5, capacidade_volume_m3: null }), [], "no limite não avisa");
  assert.deepEqual(avisosDeCapacidade(totais, null), []);
});

test("resumo da conferência: contagens, completa só sem pendência, e o texto", () => {
  const linhas = [
    { saida: "conferido" as const, volta: "pendente" as const }, { saida: "conferido" as const, volta: "pendente" as const },
    { saida: "faltou" as const, volta: "pendente" as const }, { saida: "avariado" as const, volta: "pendente" as const }, { saida: "pendente" as const, volta: "pendente" as const },
  ];
  const saida = resumoDaConferencia(linhas, "saida");
  assert.deepEqual(saida, { total: 5, conferidos: 2, faltaram: 1, avariados: 1, pendentes: 1, completa: false });
  assert.equal(textoDoResumo(saida), "2 de 5 conferidos · 1 faltou · 1 avariado");
  assert.equal(resumoDaConferencia([{ saida: "conferido", volta: "conferido" }], "volta").completa, true);
  assert.equal(resumoDaConferencia([], "saida").completa, false);
  assert.equal(textoDoResumo(resumoDaConferencia([], "saida")), "nada a conferir");
  assert.equal(ROTULO_DA_CONFERENCIA.saida.conferido, "Foi");
  assert.equal(ROTULO_DA_CONFERENCIA.volta.conferido, "Voltou");
});
