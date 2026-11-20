import assert from "node:assert/strict";
import test from "node:test";
import {
  cargaPorVeiculo, ondeEstaCadaItem, avisosDeCapacidade, documentosParaPreencher, documentosSugeridos, itensParaPreencher, lerLinhaDoChecklist, resumoDaConferencia, ROTULO_DA_CONFERENCIA, textoDoResumo, totaisDoChecklist,
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

test("carga por veículo: itens por deslocamento contra a capacidade; sem veículo por último; documentos não contam", () => {
  const medidas = new Map([["i1", { comprimento_cm: 100, largura_cm: 100, altura_cm: 100, peso_kg: 100 }]]); // 1 m³ e 100 kg cada
  const veiculos = new Map([
    ["v1", { id: "v1", nome: "Caminhão", capacidade_carga_kg: 500, capacidade_volume_m3: 10 }],
    ["v2", { id: "v2", nome: "Van", capacidade_carga_kg: null, capacidade_volume_m3: null }],
  ]);
  const deslocamentos = [
    { id: "d1", veiculo_id: "v1", rotulo: "Caminhão SP → Campinas", dia: "2026-11-23" }, { id: "d2", veiculo_id: "v2", rotulo: "Van", dia: "2026-11-24" },
    { id: "d3", veiculo_id: null, rotulo: "Carro", dia: "2026-11-23" }, { id: "d4", veiculo_id: "v1", rotulo: "Só documentos", dia: "2026-11-25" },
  ];
  const linhas = [
    { deslocamento_id: "d1", tipo: "item" as const, quantidade: 6, item_id: "i1" }, { deslocamento_id: "d1", tipo: "documento" as const, quantidade: 1, item_id: null },
    { deslocamento_id: "d2", tipo: "item" as const, quantidade: 2, item_id: "i1" }, { deslocamento_id: "d3", tipo: "item" as const, quantidade: 1, item_id: null },
    { deslocamento_id: "d4", tipo: "documento" as const, quantidade: 1, item_id: null },
  ];
  const carga = cargaPorVeiculo(deslocamentos, linhas, medidas, veiculos);
  assert.deepEqual(carga.map(grupo => grupo.nome), ["Caminhão", "Van", "Sem veículo"]);
  assert.deepEqual(carga[0].deslocamentos.map(d => [d.id, d.unidades, d.pesoKg, d.volumeM3]), [["d1", 6, 600, 6]], "o deslocamento só de documentos não aparece");
  assert.deepEqual(carga[0].deslocamentos[0].avisos, ["A carga pesa 600 kg e o veículo leva 500 kg."]);
  assert.deepEqual(carga[1].deslocamentos[0].avisos, [], "sem capacidade cadastrada, sem aviso");
  assert.equal(carga[2].deslocamentos[0].semMedidas, 1);
});

test("onde está cada item: a conferência mais recente decide e quem tem problema vem primeiro", () => {
  const deslocamentos = [
    { id: "ida", veiculo_id: null, rotulo: "Van SP → Campinas", dia: "2026-12-04" },
    { id: "volta", veiculo_id: null, rotulo: "Van Campinas → SP", dia: "2026-12-07" },
    { id: "outro", veiculo_id: null, rotulo: "Caminhão", dia: "2026-12-05" },
  ];
  const linha = (deslocamento_id: string, item_id: string | null, nome: string, saida: "pendente" | "conferido" | "faltou" | "avariado", volta: "pendente" | "conferido" | "faltou" | "avariado", quantidade = 1, tipo: "item" | "documento" = "item") =>
    ({ deslocamento_id, tipo, item_id, nome, quantidade, saida, volta });
  const lista = ondeEstaCadaItem(deslocamentos, [
    linha("ida", "a", "Refletor", "conferido", "conferido", 4),
    linha("volta", "a", "Refletor", "pendente", "pendente", 4),
    linha("ida", "b", "Mesa", "conferido", "pendente", 1),
    linha("ida", "c", "Cabo", "faltou", "pendente", 2),
    linha("outro", "d", "Tela", "pendente", "pendente", 1),
    linha("ida", "e", "Fresnel", "conferido", "avariado", 2),
    linha("ida", null, "CNH", "pendente", "pendente", 1, "documento"),
    linha("ida", null, "Extensão", "pendente", "pendente", 3),
    linha("sumiu", "z", "Fantasma", "conferido", "conferido", 1),
  ]);
  assert.deepEqual(lista.map(item => [item.nome, item.situacao]), [
    ["Cabo", "faltou"], ["Fresnel", "avariado"], ["Mesa", "em_viagem"], ["Extensão", "a_sair"], ["Tela", "a_sair"], ["Refletor", "de_volta"],
  ], "documento e deslocamento desconhecido ficam de fora; faltou e avariado primeiro");
  const refletor = lista.find(item => item.nome === "Refletor");
  assert.equal(refletor?.deslocamento, "Van SP → Campinas", "a volta conferida da ida decide, mesmo com um trecho posterior ainda pendente");
  assert.equal(lista.find(item => item.nome === "Mesa")?.texto, "Saiu; a volta ainda não foi conferida");
  assert.equal(lista.find(item => item.nome === "Cabo")?.texto, "Faltou na saída");
});

test("onde está cada item: um trecho posterior já saído vale mais que a volta anterior", () => {
  const deslocamentos = [
    { id: "ida", veiculo_id: null, rotulo: "Ida", dia: "2026-12-04" },
    { id: "praca2", veiculo_id: null, rotulo: "Outra praça", dia: "2026-12-10" },
  ];
  const lista = ondeEstaCadaItem(deslocamentos, [
    { deslocamento_id: "ida", tipo: "item", item_id: "a", nome: "Refletor", quantidade: 4, saida: "conferido", volta: "conferido" },
    { deslocamento_id: "praca2", tipo: "item", item_id: "a", nome: "Refletor", quantidade: 4, saida: "conferido", volta: "pendente" },
  ]);
  assert.equal(lista.length, 1);
  assert.deepEqual([lista[0].situacao, lista[0].deslocamento], ["em_viagem", "Outra praça"]);
});
